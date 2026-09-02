import crypto from 'node:crypto';
import { config } from './config.js';
import { db } from './db.js';
import { isPrivilegedUser } from './admin-capabilities.js';
import { now } from './utils.js';

const secrets = new Map();
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(String(config.tokenSecret)).digest();

function ensureSchema(store = db) {
  store.exec(`
    CREATE TABLE IF NOT EXISTS admin_mfa_secrets (
      user_id TEXT PRIMARY KEY,
      secret_ciphertext TEXT NOT NULL,
      enrolled_at TEXT NOT NULL,
      last_verified_step INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_admin_mfa_enrolled ON admin_mfa_secrets(enrolled_at DESC);
  `);
}

function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

function decryptSecret(value) {
  try {
    const [ivValue, tagValue, ciphertextValue] = String(value || '').split('.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(ivValue, 'base64url'), {
      authTagLength: 16,
    });
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

function persistedSecret(userId, store = db) {
  ensureSchema(store);
  const row = store.prepare('SELECT secret_ciphertext FROM admin_mfa_secrets WHERE user_id = ?').get(String(userId));
  return row ? decryptSecret(row.secret_ciphertext) : '';
}

function toBase32(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { output += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function fromBase32(value) {
  let bits = 0;
  let buffer = 0;
  const output = [];
  for (const character of String(value || '').replace(/=+$/, '').toUpperCase()) {
    const index = ALPHABET.indexOf(character);
    if (index < 0) continue;
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) { output.push((buffer >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(output);
}

function codeFor(secret, counter) {
  const message = Buffer.alloc(8);
  message.writeBigInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', fromBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  const number = ((digest[offset] & 127) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(number % 1000000).padStart(6, '0');
}

export function createTotpSecret(userId, { store = db, persist = true } = {}) {
  const secret = toBase32(crypto.randomBytes(20));
  secrets.set(String(userId), secret);
  if (persist) {
    ensureSchema(store);
    const user = store.prepare('SELECT id, role FROM users WHERE id = ? AND deleted_at IS NULL').get(String(userId));
    if (isPrivilegedUser(user)) {
      store.prepare(`
        INSERT INTO admin_mfa_secrets (user_id, secret_ciphertext, enrolled_at, last_verified_step)
        VALUES (?, ?, ?, NULL)
        ON CONFLICT(user_id) DO UPDATE SET secret_ciphertext = excluded.secret_ciphertext,
          enrolled_at = excluded.enrolled_at, last_verified_step = NULL
      `).run(String(userId), encryptSecret(secret), now());
    }
  }
  return secret;
}

export function verifyTotpCode(userId, code, at = Date.now(), { store = db, persist = true } = {}) {
  const secret = secrets.get(String(userId)) || (persist ? persistedSecret(userId, store) : '');
  if (!secret || !/^\d{6}$/.test(String(code))) return false;
  const counter = Math.floor(Number(at) / 30000);
  const matchedCounter = [-1, 0, 1].map((offset) => counter + offset)
    .find((candidate) => codeFor(secret, candidate) === String(code));
  if (matchedCounter == null) return false;
  if (persist) {
    ensureSchema(store);
    const result = store.prepare(`
      UPDATE admin_mfa_secrets
      SET last_verified_step = ?
      WHERE user_id = ? AND (last_verified_step IS NULL OR last_verified_step < ?)
    `).run(matchedCounter, String(userId), matchedCounter);
    if (!result.changes && store.prepare('SELECT 1 FROM admin_mfa_secrets WHERE user_id = ?').get(String(userId))) return false;
  }
  return true;
}

export function getAdminMfaStatus(userId, { store = db } = {}) {
  ensureSchema(store);
  const row = store.prepare('SELECT user_id, enrolled_at FROM admin_mfa_secrets WHERE user_id = ?').get(String(userId));
  return { userId: String(userId), enrolled: Boolean(row), enrolledAt: row?.enrolled_at || null };
}

export function adminMfaRequired(user, { enforced = false } = {}) {
  return isPrivilegedUser(user) && (enforced || Boolean(user.mfaEnrolled ?? user.mfa_enrolled));
}

export { codeFor as totpCodeForTest };
