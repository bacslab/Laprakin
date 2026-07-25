import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function createClient(base, device) {
  const cookies = new Map();
  let csrf = '';

  function headers(extra = {}) {
    return {
      'x-laprakin-device': device,
      ...(cookies.size ? { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') } : {}),
      ...(csrf ? { 'x-laprakin-csrf': csrf } : {}),
      ...extra,
    };
  }

  async function request(endpoint, options = {}, expectedStatus = 200) {
    const response = await fetch(`${base}/api${endpoint}`, {
      ...options,
      headers: headers({
        ...(options.body && !(options.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {}),
      }),
    });
    const setCookies = response.headers.getSetCookie?.() || [response.headers.get('set-cookie')].filter(Boolean);
    for (const setCookie of setCookies) {
      const [nameValue] = setCookie.split(';');
      const separator = nameValue.indexOf('=');
      if (separator > 0) cookies.set(nameValue.slice(0, separator), nameValue.slice(separator + 1));
    }
    const payload = await response.json();
    assert.equal(response.status, expectedStatus, payload?.error?.message || `${options.method || 'GET'} ${endpoint}`);
    if (payload.csrfToken) csrf = payload.csrfToken;
    return payload;
  }

  return {
    headers,
    request,
    async registerAndVerify(email) {
      const registration = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'KataSandi-Uji-2026' }),
      }, 201);
      await request('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ token: registration.developmentVerificationToken }),
      });
      const session = await request('/auth/me');
      csrf = session.csrfToken;
      return session.user;
    },
  };
}

const root = path.resolve(import.meta.dirname, '..');
const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-admin-ops-'));
const port = await availablePort();
const base = `http://127.0.0.1:${port}`;
const adminEmail = `admin-${Date.now()}@example.test`;
const server = spawn(process.execPath, ['server/src/index.js'], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(port),
    APP_URL: 'http://localhost:5173',
    API_URL: base,
    ALLOWED_ORIGINS: 'http://localhost:5173',
    ADMIN_EMAIL: adminEmail,
    GEMINI_API_KEY: '',
    LAPRAKIN_DATA_DIR: path.join(sandbox, 'data'),
    LAPRAKIN_UPLOAD_DIR: path.join(sandbox, 'uploads'),
    EMAIL_MODE: 'console',
    MANUAL_EMAIL_AUTH_ONLY: 'true',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let logs = '';
let testDb = null;
server.stdout.on('data', (chunk) => { logs += chunk; });
server.stderr.on('data', (chunk) => { logs += chunk; });

try {
  const started = Date.now();
  let ready = false;
  while (Date.now() - started < 30000) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) {
        ready = true;
        break;
      }
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert.equal(ready, true, `API gagal start:\n${logs}`);

  const admin = createClient(base, `admin-${Date.now()}`);
  const studentA = createClient(base, `student-a-${Date.now()}`);
  const studentB = createClient(base, `student-b-${Date.now()}`);
  const adminUser = await admin.registerAndVerify(adminEmail);
  const userA = await studentA.registerAndVerify(`student-a-${Date.now()}@example.test`);
  const userB = await studentB.registerAndVerify(`student-b-${Date.now()}@example.test`);
  assert.equal(adminUser.role, 'admin');

  testDb = new DatabaseSync(path.join(sandbox, 'data', 'laprakin.sqlite'));
  const timestamp = new Date().toISOString();
  testDb.prepare(`
    INSERT INTO wallet_entries (
      id, user_id, bucket, amount, reason, reference_type, reference_id, created_at
    ) VALUES (?, ?, 'paid', 1, 'Contract paid credit', 'contract', ?, ?)
  `).run(randomUUID(), userB.id, randomUUID(), timestamp);
  testDb.prepare(`
    INSERT INTO ai_usage_events (
      id, user_id, purpose, mode, provider, model, status,
      input_tokens, output_tokens, total_tokens, latency_ms, error_code, created_at
    ) VALUES (?, ?, 'document-generate', 'basic', 'gemini', 'contract-model', 'success',
      120, 80, 200, 450, '', ?)
  `).run(randomUUID(), userA.id, timestamp);
  const alertId = randomUUID();
  testDb.prepare(`
    INSERT INTO admin_alerts (
      id, kind, severity, user_id, summary, error_code, status, created_at
    ) VALUES (?, 'generation_failed', 'critical', ?, 'Dokumen gagal dibuat setelah kredit dipakai.', 'CONTRACT_FAILURE', 'open', ?)
  `).run(alertId, userA.id, timestamp);

  const users = await admin.request('/admin/users');
  assert.deepEqual(new Set(users.users.map((user) => user.id)), new Set([userA.id, userB.id]));
  assert.equal(users.users.some((user) => 'nim' in user || 'documents' in user), false);

  const personalKey = `personal-${randomUUID()}`;
  const personalGrant = await admin.request('/admin/credits/grant', {
    method: 'POST',
    body: JSON.stringify({
      audience: 'user',
      userId: userA.id,
      amount: 3,
      reason: 'Kompensasi pengujian dokumen',
      idempotencyKey: personalKey,
    }),
  }, 201);
  assert.equal(personalGrant.recipientCount, 1);
  const duplicateGrant = await admin.request('/admin/credits/grant', {
    method: 'POST',
    body: JSON.stringify({
      audience: 'user',
      userId: userA.id,
      amount: 3,
      reason: 'Kompensasi pengujian dokumen',
      idempotencyKey: personalKey,
    }),
  });
  assert.equal(duplicateGrant.duplicate, true);

  const paidGrant = await admin.request('/admin/credits/grant', {
    method: 'POST',
    body: JSON.stringify({
      audience: 'paid',
      amount: 2,
      reason: 'Bonus pengguna berbayar',
      idempotencyKey: `paid-${randomUUID()}`,
    }),
  }, 201);
  assert.equal(paidGrant.recipientCount, 1);
  const allGrant = await admin.request('/admin/credits/grant', {
    method: 'POST',
    body: JSON.stringify({
      audience: 'all',
      amount: 1,
      reason: 'Bonus seluruh pengguna terverifikasi',
      idempotencyKey: `all-${randomUUID()}`,
    }),
  }, 201);
  assert.equal(allGrant.recipientCount, 2);

  const personalCredits = testDb.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM wallet_entries
    WHERE user_id = ? AND bucket = 'admin'
  `).get(userA.id);
  const paidCredits = testDb.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM wallet_entries
    WHERE user_id = ? AND bucket = 'admin'
  `).get(userB.id);
  assert.equal(Number(personalCredits.total), 4);
  assert.equal(Number(paidCredits.total), 3);

  const usage = await admin.request(`/admin/ai/usage?days=1&userId=${encodeURIComponent(userA.id)}`);
  assert.equal(usage.byUser[0].userId, userA.id);
  assert.equal(usage.byUser[0].totalTokens, 200);
  assert.equal(usage.recent.some((entry) => 'prompt' in entry || 'output' in entry || 'document' in entry), false);

  const alerts = await admin.request('/admin/alerts?status=open');
  assert.ok(alerts.alerts.some((alert) => alert.id === alertId && alert.severity === 'critical'));
  await admin.request(`/admin/alerts/${alertId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'resolved' }),
  });
  const resolved = await admin.request('/admin/alerts?status=resolved');
  assert.ok(resolved.alerts.some((alert) => alert.id === alertId && alert.status === 'resolved'));

  const controller = new AbortController();
  const stream = await fetch(`${base}/api/admin/events`, {
    headers: admin.headers(),
    signal: controller.signal,
  });
  assert.match(stream.headers.get('content-type') || '', /^text\/event-stream/);
  const firstEvent = await stream.body.getReader().read();
  controller.abort();
  assert.match(new TextDecoder().decode(firstEvent.value), /event: ready/);

  console.log('Admin operations passed: credit grants are targeted and idempotent, AI telemetry is metadata-only, and alerts stream in real time.');
} finally {
  testDb?.close();
  server.kill();
  await new Promise((resolve) => server.once('exit', resolve));
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await rm(sandbox, { recursive: true, force: true });
      break;
    } catch (error) {
      if (error?.code !== 'EBUSY' || attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
}
