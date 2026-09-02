import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { config } from '../src/config.js';
import { db } from '../src/db.js';
import {
  createTotpSecret,
  getAdminMfaStatus,
  verifyTotpCode,
  totpCodeForTest,
} from '../src/mfa.js';

test('admin TOTP enrollment survives a fresh lookup and rejects replayed codes', () => {
  const userId = `mfa-persist-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `${userId}@example.test`;
  const timestamp = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, email_verified_at, created_at, updated_at)
    VALUES (?, ?, 'test-hash', 'admin', ?, ?, ?)
  `).run(userId, email, timestamp, timestamp, timestamp);

  try {
    const secret = createTotpSecret(userId);
    const status = getAdminMfaStatus(userId);
    const code = totpCodeForTest(secret, Math.floor(Date.now() / 30000));

    assert.equal(status.enrolled, true);
    assert.equal(status.userId, userId);
    assert.equal(verifyTotpCode(userId, code), true);
    assert.equal(verifyTotpCode(userId, code), false);
  } finally {
    db.prepare('DELETE FROM admin_mfa_secrets WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  }
});

test('admin MFA rejects persisted secrets with a truncated GCM authentication tag', () => {
  const userId = `mfa-truncated-tag-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `${userId}@example.test`;
  const timestamp = new Date().toISOString();
  const secret = 'JBSWY3DPEHPK3PXP';
  const key = crypto.createHash('sha256').update(String(config.tokenSecret)).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const truncatedTag = cipher.getAuthTag().subarray(0, 12);
  const persistedCiphertext = [iv, truncatedTag, ciphertext]
    .map((part) => part.toString('base64url'))
    .join('.');

  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, email_verified_at, created_at, updated_at)
    VALUES (?, ?, 'test-hash', 'admin', ?, ?, ?)
  `).run(userId, email, timestamp, timestamp, timestamp);
  db.prepare(`
    INSERT INTO admin_mfa_secrets (user_id, secret_ciphertext, enrolled_at, last_verified_step)
    VALUES (?, ?, ?, NULL)
  `).run(userId, persistedCiphertext, timestamp);

  try {
    const code = totpCodeForTest(secret, Math.floor(Date.now() / 30000));
    assert.equal(verifyTotpCode(userId, code), false);
  } finally {
    db.prepare('DELETE FROM admin_mfa_secrets WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  }
});
