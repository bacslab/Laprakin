import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

async function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForApi(base) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch { /* still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Privacy test API did not become ready.');
}

function createClient(base, device) {
  const cookies = new Map();
  let csrf = '';
  return {
    async request(endpoint, options = {}) {
      const response = await fetch(`${base}/api${endpoint}`, {
        ...options,
        headers: {
          'x-laprakin-device': device,
          ...(cookies.size ? { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') } : {}),
          ...(csrf ? { 'x-laprakin-csrf': csrf } : {}),
          ...(options.body ? { 'content-type': 'application/json' } : {}),
          ...(options.headers || {}),
        },
      });
      for (const setCookie of response.headers.getSetCookie?.() || [response.headers.get('set-cookie')].filter(Boolean)) {
        const [nameValue] = setCookie.split(';');
        const separator = nameValue.indexOf('=');
        if (separator > 0) cookies.set(nameValue.slice(0, separator), nameValue.slice(separator + 1));
      }
      const payload = response.status === 204 ? null : await response.json();
      if (payload?.csrfToken) csrf = payload.csrfToken;
      return { status: response.status, payload };
    },
    async registerAndVerify(email) {
      const registered = await this.request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password: 'KataSandi-Uji-2026' }) });
      assert.equal(registered.status, 201, registered.payload?.error?.message);
      const verified = await this.request('/auth/verify', { method: 'POST', body: JSON.stringify({ token: registered.payload.developmentVerificationToken }) });
      assert.equal(verified.status, 200, verified.payload?.error?.message);
      return verified.payload.user;
    },
  };
}

async function verifyAdminMfa(client) {
  const enrollment = await client.request('/admin/mfa/enroll', { method: 'POST', body: '{}' });
  assert.equal(enrollment.status, 201, enrollment.payload?.error?.message);
  const { totpCodeForTest } = await import('../src/mfa.js');
  const code = totpCodeForTest(enrollment.payload.secret, Math.floor(Date.now() / 30_000));
  const verified = await client.request('/admin/mfa/verify', { method: 'POST', body: JSON.stringify({ code }) });
  assert.equal(verified.status, 200, verified.payload?.error?.message);
}

function assertNoIdentity(payload, email, fullName, roomTitle) {
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes(email), false, serialized);
  assert.equal(serialized.includes(fullName), false, serialized);
  assert.equal(serialized.includes(roomTitle), false, serialized);
}

test('admin identity and chat content are default-deny with separate audited break-glass grants', { timeout: 120_000 }, async () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-admin-privacy-'));
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
  const adminEmail = `admin-privacy-${randomUUID()}@example.test`;
  const victimEmail = `victim-${randomUUID()}@example.test`;
  const victimName = 'Identitas Sangat Rahasia';
  const roomTitle = 'Judul Skripsi Rahasia';
  const rawMessage = 'Isi percakapan privat untuk investigasi.';
  const child = spawn(process.execPath, ['server/src/index.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'development', PORT: String(port), APP_URL: 'http://localhost:5173', API_URL: base,
      ALLOWED_ORIGINS: 'http://localhost:5173', ADMIN_EMAIL: adminEmail, ADMIN_MFA_REQUIRED: 'true',
      NARAROUTER_API_KEY: '', AI_REQUIRED: 'false', MANUAL_EMAIL_AUTH_ONLY: 'true', EMAIL_MODE: 'console',
      LAPRAKIN_DATA_DIR: path.join(sandbox, 'data'), LAPRAKIN_UPLOAD_DIR: path.join(sandbox, 'uploads'),
      LAPRAKIN_PUBLIC_MEDIA_DIR: path.join(sandbox, 'public-media'),
      JWT_SECRET: 'privacy-test-jwt-secret-2026-unique', DEVICE_HMAC_SECRET: 'privacy-test-device-secret-2026-unique',
      TOKEN_HMAC_SECRET: 'privacy-test-token-secret-2026-unique',
    },
    stdio: 'ignore',
  });
  let store;
  try {
    await waitForApi(base);
    const admin = createClient(base, `privacy-admin-${randomUUID()}`);
    const victim = createClient(base, `privacy-victim-${randomUUID()}`);
    const adminUser = await admin.registerAndVerify(adminEmail);
    const victimUser = await victim.registerAndVerify(victimEmail);
    await verifyAdminMfa(admin);

    store = new DatabaseSync(path.join(sandbox, 'data', 'laprakin.sqlite'));
    store.exec('PRAGMA busy_timeout = 10000');
    const createdAt = new Date().toISOString();
    const roomId = `room-${randomUUID()}`;
    store.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(victimName, victimUser.id);
    store.prepare('INSERT INTO chat_sessions (id, owner_user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(roomId, victimUser.id, roomTitle, createdAt, createdAt);
    store.prepare("INSERT INTO chat_messages (id, session_id, owner_user_id, role, content, created_at) VALUES (?, ?, ?, 'user', ?, ?)").run(`msg-${randomUUID()}`, roomId, victimUser.id, rawMessage, createdAt);
    store.prepare("INSERT INTO account_appeals (id, user_id, email_hash, message, created_at) VALUES (?, ?, 'hash', 'Please review this access restriction carefully.', ?)").run(`appeal-${randomUUID()}`, victimUser.id, createdAt);
    store.prepare("INSERT INTO admin_alerts (id, kind, severity, user_id, summary, created_at) VALUES (?, 'privacy_test', 'warning', ?, ?, ?)").run(`alert-${randomUUID()}`, victimUser.id, `Alert for ${victimEmail}`, createdAt);
    store.prepare("INSERT INTO ai_usage_events (id, user_id, purpose, model, status, total_tokens, created_at) VALUES (?, ?, 'chat', 'test-model', 'success', 17, ?)").run(`usage-${randomUUID()}`, victimUser.id, createdAt);

    const capabilities = await admin.request('/admin/capabilities');
    assert.equal(capabilities.status, 200);
    assert.equal(capabilities.payload.capabilities.includes('users.pii.reveal'), false);
    assert.equal(capabilities.payload.capabilities.includes('users.content.reveal'), false);

    const users = await admin.request(`/admin/users?userId=${encodeURIComponent(victimUser.id)}`);
    assert.equal(users.status, 200);
    assert.equal(users.payload.users.length, 1);
    assert.match(users.payload.users[0].userRef, /^U-[A-F0-9]{8}$/);
    assert.equal('email' in users.payload.users[0], false);
    assert.equal('fullName' in users.payload.users[0], false);
    const rooms = await admin.request(`/admin/users/${encodeURIComponent(victimUser.id)}/rooms`);
    assert.equal(rooms.status, 200);
    assert.match(rooms.payload.rooms[0].roomRef, /^R-[A-F0-9]{8}$/);
    assert.equal('title' in rooms.payload.rooms[0], false);
    const appeals = await admin.request('/admin/appeals?status=all');
    const alerts = await admin.request('/admin/alerts?status=all');
    const usage = await admin.request('/admin/ai/usage');
    assertNoIdentity({ users: users.payload, rooms: rooms.payload, appeals: appeals.payload, alerts: alerts.payload, usage: usage.payload }, victimEmail, victimName, roomTitle);
    assert.equal(JSON.stringify({ rooms: rooms.payload, usage: usage.payload }).includes(rawMessage), false);

    const normalAdminDenied = await admin.request(`/admin/users/${victimUser.id}/pii-access`, { method: 'POST', body: JSON.stringify({ reasonCode: 'support_case', reasonNote: 'Investigating support ticket SUP-1234.', durationMinutes: 5 }) });
    assert.equal(normalAdminDenied.status, 403);
    assert.equal(normalAdminDenied.payload.error.code, 'ADMIN_CAPABILITY_REQUIRED');

    store.prepare("UPDATE users SET role = 'privacy_admin' WHERE id = ?").run(adminUser.id);
    const piiGrantResponse = await admin.request(`/admin/users/${victimUser.id}/pii-access`, { method: 'POST', body: JSON.stringify({ reasonCode: 'support_case', reasonNote: 'Investigating support ticket SUP-1234.', durationMinutes: 5 }) });
    assert.equal(piiGrantResponse.status, 201, piiGrantResponse.payload?.error?.message);
    assert.equal(piiGrantResponse.payload.access.scope, 'pii');
    assert.equal('email' in piiGrantResponse.payload, false);
    const piiRead = await admin.request(`/admin/break-glass/${piiGrantResponse.payload.access.id}/pii`);
    assert.equal(piiRead.status, 200, piiRead.payload?.error?.message);
    assert.equal(piiRead.payload.pii.email, victimEmail);
    assert.equal(piiRead.payload.pii.fullName, victimName);

    const privacyContentDenied = await admin.request(`/admin/users/${victimUser.id}/rooms/${roomId}/content-access`, { method: 'POST', body: JSON.stringify({ reasonCode: 'security_incident', reasonNote: 'Investigating security incident SEC-42.', durationMinutes: 5 }) });
    assert.equal(privacyContentDenied.status, 403);
    store.prepare("UPDATE users SET role = 'content_forensics_admin' WHERE id = ?").run(adminUser.id);
    const contentGrantResponse = await admin.request(`/admin/users/${victimUser.id}/rooms/${roomId}/content-access`, { method: 'POST', body: JSON.stringify({ reasonCode: 'security_incident', reasonNote: 'Investigating security incident SEC-42.', durationMinutes: 5 }) });
    assert.equal(contentGrantResponse.status, 201, contentGrantResponse.payload?.error?.message);
    const contentRead = await admin.request(`/admin/break-glass/${contentGrantResponse.payload.access.id}/content`);
    assert.equal(contentRead.status, 200, contentRead.payload?.error?.message);
    assert.equal(contentRead.payload.content.title, roomTitle);
    assert.equal(contentRead.payload.content.messages[0].content, rawMessage);

    const revoke = await admin.request(`/admin/break-glass/${contentGrantResponse.payload.access.id}`, { method: 'DELETE' });
    assert.equal(revoke.status, 204);
    const revokedRead = await admin.request(`/admin/break-glass/${contentGrantResponse.payload.access.id}/content`);
    assert.equal(revokedRead.status, 403);
    assert.equal(revokedRead.payload.error.code, 'BREAK_GLASS_GRANT_REVOKED');

    const audit = await admin.request('/admin/audit?limit=100');
    assert.equal(audit.status, 200);
    const actions = new Set(audit.payload.events.map((event) => event.action));
    for (const action of ['admin.pii_access_granted', 'admin.pii_accessed', 'admin.content_access_granted', 'admin.content_accessed', 'admin.break_glass_revoked']) {
      assert.equal(actions.has(action), true, `Missing audit action: ${action}`);
    }
  } finally {
    store?.close();
    if (child.exitCode === null) child.kill();
    await new Promise((resolve) => child.exitCode === null ? child.once('exit', resolve) : resolve());
    await rm(sandbox, { recursive: true, force: true });
  }
});
