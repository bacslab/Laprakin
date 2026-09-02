import assert from 'node:assert/strict';
import test from 'node:test';

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
