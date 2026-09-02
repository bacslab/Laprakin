import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import {
  createAiSecretStore,
  createEnvelopeSecretStore,
  createKeyVaultSecretStore,
  parseCredentialMasterKey,
} from '../src/ai-secret-store.js';

function testStore() {
  const store = new DatabaseSync(':memory:');
  store.exec('PRAGMA foreign_keys=ON');
  return store;
}

test('credential master key accepts only exact 32-byte hex or base64 material', () => {
  const key = crypto.randomBytes(32);
  assert.deepEqual(parseCredentialMasterKey(key.toString('hex')), key);
  assert.deepEqual(parseCredentialMasterKey(key.toString('base64')), key);
  assert.throws(() => parseCredentialMasterKey('short-key'), /exactly 32 bytes/);
  assert.throws(() => parseCredentialMasterKey('z'.repeat(64)), /exactly 32 bytes/);
});

test('envelope store uses AES-256-GCM metadata and never persists or returns plaintext', () => {
  const database = testStore();
  const secret = 'nara-live-secret-that-must-never-leak';
  try {
    const secretStore = createEnvelopeSecretStore({
      masterKey: crypto.randomBytes(32),
      keyVersion: 'master-2026-09',
      store: database,
    });
    const metadata = secretStore.put({ providerId: 'nararouter', value: secret, actorUserId: 'admin-1' });

    assert.equal(metadata.configured, true);
    assert.equal(metadata.maskedValue, 'Configured •••• leak');
    assert.equal(metadata.secretVersion, 1);
    assert.equal(metadata.keyVersion, 'master-2026-09');
    assert.equal(JSON.stringify(metadata).includes(secret), false);
    assert.equal(secretStore.get({ providerId: 'nararouter', reference: metadata.reference, version: 1 }), secret);

    const row = database.prepare('SELECT * FROM ai_provider_secrets WHERE id = ?').get(metadata.reference);
    assert.equal(Buffer.from(row.iv, 'base64url').length, 12);
    assert.equal(Buffer.from(row.auth_tag, 'base64url').length, 16);
    assert.notEqual(row.ciphertext, secret);
    assert.equal(JSON.stringify(row).includes(secret), false);
  } finally {
    database.close();
  }
});

test('AAD binds ciphertext to provider and secret version and rejects malformed records safely', () => {
  const database = testStore();
  const secret = 'credential-do-not-echo-on-auth-failure';
  try {
    const secretStore = createEnvelopeSecretStore({ masterKey: crypto.randomBytes(32), store: database });
    const metadata = secretStore.put({ providerId: 'nararouter', value: secret, actorUserId: 'admin-1' });
    database.prepare('UPDATE ai_provider_secrets SET provider_id = ? WHERE id = ?').run('other-provider', metadata.reference);
    assert.throws(
      () => secretStore.get({ providerId: 'other-provider', reference: metadata.reference, version: 1 }),
      (error) => error.code === 'AI_SECRET_AUTHENTICATION_FAILED' && !error.message.includes(secret),
    );

    database.prepare('UPDATE ai_provider_secrets SET provider_id = ?, iv = ? WHERE id = ?')
      .run('nararouter', Buffer.alloc(8).toString('base64url'), metadata.reference);
    assert.throws(
      () => secretStore.get({ providerId: 'nararouter', reference: metadata.reference, version: 1 }),
      (error) => error.code === 'AI_SECRET_RECORD_INVALID' && !error.message.includes(secret),
    );
  } finally {
    database.close();
  }
});

test('rotation preserves versioned references while deletion destroys encrypted material', () => {
  const database = testStore();
  try {
    let clock = Date.parse('2026-09-03T00:00:00.000Z');
    const secretStore = createEnvelopeSecretStore({
      masterKey: crypto.randomBytes(32),
      store: database,
      now: () => new Date(clock).toISOString(),
    });
    const first = secretStore.put({ providerId: 'nararouter', value: 'first-provider-key', actorUserId: 'admin-1' });
    clock += 60_000;
    const second = secretStore.put({ providerId: 'nararouter', value: 'second-provider-key', actorUserId: 'admin-2' });

    assert.equal(first.secretVersion, 1);
    assert.equal(second.secretVersion, 2);
    assert.equal(second.rotatedAt, '2026-09-03T00:01:00.000Z');
    assert.equal(secretStore.get({ providerId: 'nararouter', reference: first.reference, version: 1 }), 'first-provider-key');
    assert.equal(secretStore.get({ providerId: 'nararouter', reference: second.reference, version: 2 }), 'second-provider-key');

    const deleted = secretStore.delete({ providerId: 'nararouter', reference: second.reference, version: 2 });
    assert.equal(deleted.deleted, true);
    const row = database.prepare('SELECT ciphertext, iv, auth_tag, deleted_at FROM ai_provider_secrets WHERE id = ?').get(second.reference);
    assert.equal(row.ciphertext, '');
    assert.equal(row.iv, '');
    assert.equal(row.auth_tag, '');
    assert.ok(row.deleted_at);
    assert.throws(
      () => secretStore.get({ providerId: 'nararouter', reference: second.reference, version: 2 }),
      (error) => error.code === 'AI_SECRET_NOT_FOUND',
    );
  } finally {
    database.close();
  }
});

test('master-key rotation can decrypt prior key versions only through an explicit keyring', () => {
  const database = testStore();
  try {
    const oldKey = crypto.randomBytes(32);
    const newKey = crypto.randomBytes(32);
    const oldStore = createEnvelopeSecretStore({ masterKey: oldKey, keyVersion: 'master-v1', store: database });
    const oldSecret = oldStore.put({ providerId: 'nararouter', value: 'credential-from-v1' });
    const rotatedStore = createEnvelopeSecretStore({
      masterKey: newKey,
      keyVersion: 'master-v2',
      previousKeys: { 'master-v1': oldKey },
      store: database,
    });
    assert.equal(rotatedStore.get({ providerId: 'nararouter', reference: oldSecret.reference, version: 1 }), 'credential-from-v1');
    const newSecret = rotatedStore.put({ providerId: 'nararouter', value: 'credential-from-v2' });
    assert.equal(newSecret.keyVersion, 'master-v2');

    const missingOldKey = createEnvelopeSecretStore({ masterKey: newKey, keyVersion: 'master-v2', store: database });
    assert.throws(
      () => missingOldKey.get({ providerId: 'nararouter', reference: oldSecret.reference, version: 1 }),
      (error) => error.code === 'AI_SECRET_AUTHENTICATION_FAILED',
    );
  } finally {
    database.close();
  }
});

test('production creation fails closed without a configured vault or dedicated key', () => {
  assert.throws(
    () => createAiSecretStore({ config: { isProd: true, aiSecretStore: 'envelope', aiCredentialMasterKey: '' } }),
    (error) => error.code === 'AI_SECRET_STORE_NOT_CONFIGURED',
  );
  assert.throws(
    () => createAiSecretStore({ config: { isProd: false, aiSecretStore: 'envelope', aiCredentialMasterKey: '' } }),
    (error) => error.code === 'AI_SECRET_STORE_NOT_CONFIGURED',
  );
  const ephemeral = createAiSecretStore({
    config: { isProd: false, aiSecretStore: 'envelope', aiCredentialMasterKey: '' },
    allowEphemeral: true,
    store: testStore(),
  });
  assert.equal(ephemeral.kind, 'ephemeral-envelope');
});

test('Azure Key Vault store uses managed secret versions and returns masked metadata only', async () => {
  const calls = [];
  const client = {
    async setSecret(name, value, options) {
      calls.push({ operation: 'set', name, value, options });
      return { name, properties: { version: 'azure-version-1', createdOn: new Date('2026-09-03T01:00:00.000Z') } };
    },
    async getSecret(name, options) {
      calls.push({ operation: 'get', name, options });
      return { value: 'azure-provider-key' };
    },
    async beginDeleteSecret(name) {
      calls.push({ operation: 'delete', name });
      return { async pollUntilDone() { calls.push({ operation: 'deleted', name }); } };
    },
  };
  const secretStore = createKeyVaultSecretStore({
    vaultUrl: 'https://laprakin-test.vault.azure.net',
    client,
    now: () => '2026-09-03T01:00:00.000Z',
  });
  const metadata = await secretStore.put({ providerId: 'nararouter', value: 'azure-provider-key', actorUserId: 'admin-1' });

  assert.equal(secretStore.kind, 'azure-key-vault');
  assert.equal(metadata.reference, 'azure-key-vault:laprakin-ai-nararouter');
  assert.equal(metadata.secretVersion, 'azure-version-1');
  assert.equal(metadata.maskedValue, 'Configured •••• -key');
  assert.equal(JSON.stringify(metadata).includes('azure-provider-key'), false);
  assert.equal(calls[0].options.contentType, 'application/x-laprakin-ai-credential');
  assert.equal(calls[0].options.tags.providerId, 'nararouter');
  assert.equal(await secretStore.get({ providerId: 'nararouter', reference: metadata.reference, version: metadata.secretVersion }), 'azure-provider-key');
  assert.equal((await secretStore.delete({ providerId: 'nararouter', reference: metadata.reference, version: metadata.secretVersion })).deleted, true);
  assert.deepEqual(calls.map((call) => call.operation), ['set', 'get', 'delete', 'deleted']);
});

test('Azure Key Vault errors are sanitized and never echo credential values', async () => {
  const secret = 'azure-secret-that-must-not-escape';
  const secretStore = createKeyVaultSecretStore({
    vaultUrl: 'https://laprakin-test.vault.azure.net',
    client: { async setSecret() { throw new Error(`upstream rejected ${secret}`); } },
  });
  await assert.rejects(
    secretStore.put({ providerId: 'nararouter', value: secret, actorUserId: 'admin-1' }),
    (error) => error.code === 'AI_SECRET_VAULT_UNAVAILABLE' && !error.message.includes(secret),
  );
});
