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
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function closeProcess(child) {
  if (child.exitCode !== null) return;
  child.kill();
  await new Promise((resolve) => child.once('exit', resolve));
}

function createClient(base) {
  const cookies = new Map();
  let csrf = '';
  return {
    async request(endpoint, options = {}) {
      const response = await fetch(`${base}/api${endpoint}`, {
        ...options,
        headers: {
          'content-type': 'application/json',
          'x-laprakin-device': 'chat-idempotency-device',
          ...(cookies.size ? { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') } : {}),
          ...(csrf ? { 'x-laprakin-csrf': csrf } : {}),
          ...(options.headers || {}),
        },
      });
      for (const setCookie of response.headers.getSetCookie?.() || [response.headers.get('set-cookie')].filter(Boolean)) {
        const [nameValue] = setCookie.split(';');
        const separator = nameValue.indexOf('=');
        if (separator > 0) cookies.set(nameValue.slice(0, separator), nameValue.slice(separator + 1));
      }
      const payload = await response.json();
      if (payload.csrfToken) csrf = payload.csrfToken;
      return { response, payload };
    },
  };
}

test('chat replay with one request ID returns one canonical exchange and rejects different input', { timeout: 120000 }, async () => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-chat-idempotency-api-'));
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
  const root = path.resolve(import.meta.dirname, '../..');
  const child = spawn(process.execPath, ['server/src/index.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(port),
      APP_URL: 'http://localhost:5173',
      API_URL: base,
      ALLOWED_ORIGINS: 'http://localhost:5173',
      NARAROUTER_API_KEY: '',
      AI_REQUIRED: 'false',
      MANUAL_EMAIL_AUTH_ONLY: 'true',
      EMAIL_MODE: 'console',
      LAPRAKIN_DATA_DIR: path.join(sandbox, 'data'),
      LAPRAKIN_UPLOAD_DIR: path.join(sandbox, 'uploads'),
      LAPRAKIN_PUBLIC_MEDIA_DIR: path.join(sandbox, 'public-media'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (chunk) => { logs += chunk; });
  child.stderr.on('data', (chunk) => { logs += chunk; });
  try {
    const deadline = Date.now() + 30000;
    let ready = false;
    while (Date.now() < deadline) {
      try {
        if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; }
      } catch { /* server is starting */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, logs);

    const client = createClient(base);
    const email = `chat-idempotency-${randomUUID()}@example.test`;
    const registration = await client.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'KataSandi-Uji-2026' }),
    });
    assert.equal(registration.response.status, 201, registration.payload.error?.message);
    const verification = await client.request('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token: registration.payload.developmentVerificationToken }),
    });
    assert.equal(verification.response.status, 200, verification.payload.error?.message);
    const claim = await client.request('/wallet/claim-welcome', { method: 'POST', body: '{}' });
    assert.equal(claim.response.status, 200, claim.payload.error?.message);
    const created = await client.request('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ title: 'Laprak baru', configuration: { courseName: 'Jaringan', moduleTitle: 'Routing', allowExternalAi: true } }),
    });
    assert.equal(created.response.status, 201, created.payload.error?.message);
    const sessionId = created.payload.session.id;
    const requestId = `chat-${randomUUID()}`;
    const body = { requestId, content: 'Jelaskan routing statis.', aiMode: 'basic', allowExternalAi: true };

    const first = await client.request(`/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'idempotency-key': requestId },
      body: JSON.stringify(body),
    });
    const second = await client.request(`/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'idempotency-key': requestId },
      body: JSON.stringify(body),
    });
    assert.equal(first.response.status, 200, first.payload.error?.message);
    assert.equal(second.response.status, 200, second.payload.error?.message);
    assert.deepEqual(second.payload.messages.map((message) => message.id), first.payload.messages.map((message) => message.id));
    assert.equal(second.payload.messages.filter((message) => message.role === 'user' && message.content === body.content).length, 1);
    assert.equal(second.payload.messages.filter((message) => message.role === 'assistant').length, 1);

    const conflict = await client.request(`/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'idempotency-key': requestId },
      body: JSON.stringify({ ...body, content: 'Input berbeda.' }),
    });
    assert.equal(conflict.response.status, 409);
    assert.equal(conflict.payload.error.code, 'IDEMPOTENCY_KEY_REUSED');

    const mismatch = await client.request(`/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'idempotency-key': `other-${randomUUID()}` },
      body: JSON.stringify({ ...body, requestId: `body-${randomUUID()}` }),
    });
    assert.equal(mismatch.response.status, 400);
    assert.equal(mismatch.payload.error.code, 'IDEMPOTENCY_KEY_MISMATCH');

    const snapshot = await client.request(`/mutations/${requestId}`);
    assert.equal(snapshot.response.status, 200);
    assert.equal(snapshot.payload.requestId, requestId);
    assert.equal(snapshot.payload.state, 'completed');
    assert.deepEqual(snapshot.payload.response.messages.map((message) => message.id), first.payload.messages.map((message) => message.id));

    const database = new DatabaseSync(path.join(sandbox, 'data', 'laprakin.sqlite'), { readOnly: true });
    try {
      const messages = database.prepare(`
        SELECT role, request_id FROM chat_messages
        WHERE owner_user_id = ? AND request_id = ? ORDER BY created_at
      `).all(first.payload.session.owner_user_id || verification.payload.user.id, requestId);
      assert.deepEqual(messages.map((message) => message.role), ['user', 'assistant']);
      assert.equal(messages.every((message) => message.request_id === requestId), true);
      const creditOperations = database.prepare(`
        SELECT COUNT(*) AS count FROM wallet_entries
        WHERE user_id = ? AND request_id = ?
      `).get(verification.payload.user.id, requestId);
      assert.equal(creditOperations.count, 1);
    } finally {
      database.close();
    }
  } finally {
    await closeProcess(child);
    await rm(sandbox, { recursive: true, force: true });
  }
});
