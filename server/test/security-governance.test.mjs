import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildAuditRow } from '../src/admin-audit.js';
import { createTotpSecret, adminMfaRequired, verifyTotpCode } from '../src/mfa.js';

test('admin audit rows hash IP and redact payload secrets', () => {
  const row = buildAuditRow({ actorUserId: 'u1', action: 'grant_credit', target: 'u2', payloadDiff: { token: 'secret', amount: 2 }, ipAddress: '127.0.0.1' });
  assert.notEqual(row.ip_hash, '127.0.0.1');
  assert.equal(row.payload_diff.token, '[REDACTED]');
  assert.equal(row.payload_diff.amount, 2);
});

test('administrator MFA is opt-in and verifies the generated TOTP secret', () => {
  const userId = `mfa-test-${Date.now()}`;
  const secret = createTotpSecret(userId);
  assert.match(secret, /^[A-Z2-7]+$/);
  assert.equal(adminMfaRequired({ role: 'user' }), false);
  assert.equal(adminMfaRequired({ role: 'admin', mfaEnrolled: true }), true);
  assert.equal(verifyTotpCode(userId, '000000'), false);
});

test('security middleware keeps explicit origin and baseline hardening headers', async () => {
  const source = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  assert.match(source, /Access-Control-Allow-Origin/);
  assert.match(source, /X-Content-Type-Options/);
  assert.match(source, /X-Frame-Options/);
  assert.match(source, /config\.allowedOrigins\.includes\(origin\)/);
});
