import crypto from 'node:crypto';
import { ManagedIdentityCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { nanoid } from 'nanoid';
import { db } from './db.js';
import { now as currentTimestamp } from './utils.js';

const PROVIDER_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;

class AiSecretStoreError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AiSecretStoreError';
    this.code = code;
  }
}

export function parseCredentialMasterKey(value) {
  const source = String(value || '').trim();
  let key = null;
  if (/^[a-f0-9]{64}$/i.test(source)) key = Buffer.from(source, 'hex');
  else if (/^[a-z0-9+/]+={0,2}$/i.test(source) && source.length % 4 === 0) key = Buffer.from(source, 'base64');
  if (!key || key.length !== 32) {
    throw new AiSecretStoreError('AI credential master key must contain exactly 32 bytes.', 'AI_SECRET_MASTER_KEY_INVALID');
  }
  return key;
}

function ensureSchema(store) {
  store.exec(`
    CREATE TABLE IF NOT EXISTS ai_provider_secrets (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      secret_version INTEGER NOT NULL,
      key_version TEXT NOT NULL,
      ciphertext TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      last_four TEXT NOT NULL,
      actor_user_id TEXT,
      created_at TEXT NOT NULL,
      rotated_at TEXT,
      deleted_at TEXT,
      UNIQUE(provider_id, secret_version)
    );
    CREATE INDEX IF NOT EXISTS idx_ai_provider_secrets_provider
      ON ai_provider_secrets(provider_id, secret_version DESC);
  `);
}

function assertProviderId(providerId) {
  const normalized = String(providerId || '').trim().toLowerCase();
  if (!PROVIDER_ID.test(normalized)) {
    throw new AiSecretStoreError('Provider ID is invalid.', 'AI_SECRET_PROVIDER_INVALID');
  }
  return normalized;
}

function associatedData(providerId, secretVersion, keyVersion) {
  return Buffer.from(`laprakin.ai-credential|${providerId}|${secretVersion}|${keyVersion}`, 'utf8');
}

function decodePart(value, expectedLength, code = 'AI_SECRET_RECORD_INVALID') {
  try {
    const part = Buffer.from(String(value || ''), 'base64url');
    if (part.length !== expectedLength) throw new Error('invalid length');
    return part;
  } catch {
    throw new AiSecretStoreError('Encrypted credential record is invalid.', code);
  }
}

function publicMetadata(row) {
  if (!row) return null;
  return {
    configured: !row.deleted_at,
    reference: row.id,
    providerId: row.provider_id,
    secretVersion: Number(row.secret_version),
    keyVersion: row.key_version,
    fingerprint: row.fingerprint,
    lastFour: row.last_four,
    maskedValue: `Configured •••• ${row.last_four}`,
    actorUserId: row.actor_user_id || null,
    createdAt: row.created_at,
    rotatedAt: row.rotated_at || null,
    deletedAt: row.deleted_at || null,
  };
}

export function createEnvelopeSecretStore({
  masterKey,
  keyVersion = 'v1',
  previousKeys = {},
  store = db,
  now = currentTimestamp,
  randomBytes = crypto.randomBytes,
  kind = 'envelope',
} = {}) {
  const key = Buffer.isBuffer(masterKey) ? Buffer.from(masterKey) : parseCredentialMasterKey(masterKey);
  if (key.length !== 32) {
    throw new AiSecretStoreError('AI credential master key must contain exactly 32 bytes.', 'AI_SECRET_MASTER_KEY_INVALID');
  }
  const normalizedKeyVersion = String(keyVersion || '').trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(normalizedKeyVersion)) {
    throw new AiSecretStoreError('Credential key version is invalid.', 'AI_SECRET_KEY_VERSION_INVALID');
  }
  const keyring = new Map([[normalizedKeyVersion, key]]);
  for (const [version, value] of Object.entries(previousKeys || {})) {
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(version)) {
      throw new AiSecretStoreError('Credential key version is invalid.', 'AI_SECRET_KEY_VERSION_INVALID');
    }
    const priorKey = Buffer.isBuffer(value) ? Buffer.from(value) : parseCredentialMasterKey(value);
    if (priorKey.length !== 32) {
      throw new AiSecretStoreError('AI credential master key must contain exactly 32 bytes.', 'AI_SECRET_MASTER_KEY_INVALID');
    }
    keyring.set(version, priorKey);
  }
  ensureSchema(store);

  return {
    kind,
    put({ providerId, value, actorUserId = null }) {
      const normalizedProviderId = assertProviderId(providerId);
      const plaintext = String(value || '');
      if (!plaintext) throw new AiSecretStoreError('Credential value is required.', 'AI_SECRET_VALUE_REQUIRED');
      const timestamp = now();
      let transactionOpen = false;
      try {
        store.exec('BEGIN IMMEDIATE');
        transactionOpen = true;
        const prior = store.prepare(`
          SELECT secret_version FROM ai_provider_secrets
          WHERE provider_id = ? ORDER BY secret_version DESC LIMIT 1
        `).get(normalizedProviderId);
        const secretVersion = Number(prior?.secret_version || 0) + 1;
        const iv = randomBytes(12);
        if (!Buffer.isBuffer(iv) || iv.length !== 12) {
          throw new AiSecretStoreError('Credential IV generation failed.', 'AI_SECRET_IV_INVALID');
        }
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
        cipher.setAAD(associatedData(normalizedProviderId, secretVersion, normalizedKeyVersion));
        const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const authenticationTag = cipher.getAuthTag();
        const id = nanoid();
        store.prepare(`
          INSERT INTO ai_provider_secrets (
            id, provider_id, secret_version, key_version, ciphertext, iv, auth_tag,
            fingerprint, last_four, actor_user_id, created_at, rotated_at, deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        `).run(
          id,
          normalizedProviderId,
          secretVersion,
          normalizedKeyVersion,
          ciphertext.toString('base64url'),
          iv.toString('base64url'),
          authenticationTag.toString('base64url'),
          crypto.createHash('sha256').update(plaintext).digest('hex').slice(0, 16),
          plaintext.slice(-4),
          actorUserId ? String(actorUserId) : null,
          timestamp,
          prior ? timestamp : null,
        );
        store.exec('COMMIT');
        transactionOpen = false;
        return publicMetadata(store.prepare('SELECT * FROM ai_provider_secrets WHERE id = ?').get(id));
      } catch (error) {
        if (transactionOpen) store.exec('ROLLBACK');
        if (error instanceof AiSecretStoreError) throw error;
        throw new AiSecretStoreError('Credential could not be stored.', 'AI_SECRET_STORE_WRITE_FAILED');
      }
    },

    get({ providerId, reference, version }) {
      const normalizedProviderId = assertProviderId(providerId);
      const row = store.prepare(`
        SELECT * FROM ai_provider_secrets
        WHERE id = ? AND provider_id = ? AND secret_version = ? AND deleted_at IS NULL
      `).get(String(reference || ''), normalizedProviderId, Number(version));
      if (!row) throw new AiSecretStoreError('Credential reference is unavailable.', 'AI_SECRET_NOT_FOUND');
      const decryptionKey = keyring.get(row.key_version);
      if (!decryptionKey) {
        throw new AiSecretStoreError('Credential authentication failed.', 'AI_SECRET_AUTHENTICATION_FAILED');
      }
      const iv = decodePart(row.iv, 12);
      const authenticationTag = decodePart(row.auth_tag, 16);
      let ciphertext;
      try {
        ciphertext = Buffer.from(String(row.ciphertext || ''), 'base64url');
      } catch {
        throw new AiSecretStoreError('Encrypted credential record is invalid.', 'AI_SECRET_RECORD_INVALID');
      }
      if (!ciphertext.length) throw new AiSecretStoreError('Encrypted credential record is invalid.', 'AI_SECRET_RECORD_INVALID');
      try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', decryptionKey, iv, { authTagLength: 16 });
        decipher.setAAD(associatedData(normalizedProviderId, Number(row.secret_version), row.key_version));
        decipher.setAuthTag(authenticationTag);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
      } catch {
        throw new AiSecretStoreError('Credential authentication failed.', 'AI_SECRET_AUTHENTICATION_FAILED');
      }
    },

    delete({ providerId, reference, version }) {
      const normalizedProviderId = assertProviderId(providerId);
      const timestamp = now();
      const result = store.prepare(`
        UPDATE ai_provider_secrets
        SET ciphertext = '', iv = '', auth_tag = '', deleted_at = ?
        WHERE id = ? AND provider_id = ? AND secret_version = ? AND deleted_at IS NULL
      `).run(timestamp, String(reference || ''), normalizedProviderId, Number(version));
      if (!result.changes) throw new AiSecretStoreError('Credential reference is unavailable.', 'AI_SECRET_NOT_FOUND');
      return { deleted: true, reference: String(reference), providerId: normalizedProviderId, secretVersion: Number(version), deletedAt: timestamp };
    },

    metadata({ providerId, reference, version }) {
      const normalizedProviderId = assertProviderId(providerId);
      return publicMetadata(store.prepare(`
        SELECT * FROM ai_provider_secrets WHERE id = ? AND provider_id = ? AND secret_version = ?
      `).get(String(reference || ''), normalizedProviderId, Number(version)));
    },
  };
}

function assertVaultUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.vault\.azure\.net$/i.test(url.hostname)
      || url.username || url.password || (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
      throw new Error('invalid vault URL');
    }
    return url.origin;
  } catch {
    throw new AiSecretStoreError('Azure Key Vault URL is invalid.', 'AI_SECRET_VAULT_URL_INVALID');
  }
}

function keyVaultName(providerId) {
  return `laprakin-ai-${assertProviderId(providerId)}`;
}

function assertKeyVaultReference(providerId, reference) {
  const name = keyVaultName(providerId);
  if (String(reference || '') !== `azure-key-vault:${name}`) {
    throw new AiSecretStoreError('Credential reference is unavailable.', 'AI_SECRET_NOT_FOUND');
  }
  return name;
}

function keyVaultFailure() {
  return new AiSecretStoreError('Azure Key Vault is unavailable for this credential operation.', 'AI_SECRET_VAULT_UNAVAILABLE');
}

export function createKeyVaultSecretStore({
  vaultUrl,
  managedIdentityClientId = '',
  client = null,
  now = currentTimestamp,
} = {}) {
  const normalizedVaultUrl = assertVaultUrl(vaultUrl);
  let secretClient = client;
  if (!secretClient) {
    const credential = managedIdentityClientId
      ? new ManagedIdentityCredential(String(managedIdentityClientId))
      : new ManagedIdentityCredential();
    secretClient = new SecretClient(normalizedVaultUrl, credential);
  }

  return {
    kind: 'azure-key-vault',
    async put({ providerId, value, actorUserId = null }) {
      const normalizedProviderId = assertProviderId(providerId);
      const plaintext = String(value || '');
      if (!plaintext) throw new AiSecretStoreError('Credential value is required.', 'AI_SECRET_VALUE_REQUIRED');
      const name = keyVaultName(normalizedProviderId);
      const fingerprint = crypto.createHash('sha256').update(plaintext).digest('hex').slice(0, 16);
      const lastFour = plaintext.slice(-4);
      try {
        const result = await secretClient.setSecret(name, plaintext, {
          contentType: 'application/x-laprakin-ai-credential',
          tags: {
            providerId: normalizedProviderId,
            fingerprint,
            lastFour,
            ...(actorUserId ? { actorUserId: String(actorUserId) } : {}),
          },
        });
        const secretVersion = String(result?.properties?.version || '');
        if (!secretVersion) throw keyVaultFailure();
        const createdAt = result?.properties?.createdOn?.toISOString?.() || now();
        return {
          configured: true,
          reference: `azure-key-vault:${name}`,
          providerId: normalizedProviderId,
          secretVersion,
          keyVersion: 'azure-managed',
          fingerprint,
          lastFour,
          maskedValue: `Configured •••• ${lastFour}`,
          actorUserId: actorUserId ? String(actorUserId) : null,
          createdAt,
          rotatedAt: createdAt,
          deletedAt: null,
        };
      } catch (error) {
        if (error instanceof AiSecretStoreError) throw error;
        throw keyVaultFailure();
      }
    },

    async get({ providerId, reference, version }) {
      const normalizedProviderId = assertProviderId(providerId);
      const name = assertKeyVaultReference(normalizedProviderId, reference);
      try {
        const result = await secretClient.getSecret(name, { version: String(version || '') });
        if (typeof result?.value !== 'string' || !result.value) {
          throw new AiSecretStoreError('Credential reference is unavailable.', 'AI_SECRET_NOT_FOUND');
        }
        return result.value;
      } catch (error) {
        if (error instanceof AiSecretStoreError) throw error;
        throw keyVaultFailure();
      }
    },

    async delete({ providerId, reference, version }) {
      const normalizedProviderId = assertProviderId(providerId);
      const name = assertKeyVaultReference(normalizedProviderId, reference);
      try {
        const poller = await secretClient.beginDeleteSecret(name);
        await poller?.pollUntilDone?.();
        return { deleted: true, reference: String(reference), providerId: normalizedProviderId, secretVersion: String(version || ''), deletedAt: now() };
      } catch {
        throw keyVaultFailure();
      }
    },
  };
}

export function createAiSecretStore({ config = {}, store = db, allowEphemeral = false } = {}) {
  if (config.aiSecretStore === 'azure-key-vault') {
    return createKeyVaultSecretStore({
      vaultUrl: config.azureKeyVaultUrl,
      managedIdentityClientId: config.azureManagedIdentityClientId,
    });
  }
  if (config.aiCredentialMasterKey) {
    return createEnvelopeSecretStore({
      masterKey: config.aiCredentialMasterKey,
      keyVersion: config.aiCredentialKeyVersion || 'v1',
      previousKeys: config.aiCredentialPreviousKeys || {},
      store,
    });
  }
  if (!config.isProd && allowEphemeral) {
    return createEnvelopeSecretStore({ masterKey: crypto.randomBytes(32), keyVersion: 'ephemeral', store, kind: 'ephemeral-envelope' });
  }
  throw new AiSecretStoreError('AI credential secret store is not configured.', 'AI_SECRET_STORE_NOT_CONFIGURED');
}

export { AiSecretStoreError };
