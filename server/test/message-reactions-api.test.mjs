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

function createClient(base, device) {
  const cookies = new Map();
  let csrf = '';
  return {
    async request(endpoint, options = {}) {
      const response = await fetch(`${base}/api${endpoint}`, {
        ...options,
        headers: {
          'content-type': 'application/json',
          'x-laprakin-device': device,
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

async function registerVerified(client, email) {
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
  return verification.payload.user;
}

test('message reactions persist, reverse, remove, stay owner-only, and expose aggregate-only analytics', { timeout: 120000 }, async () => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-message-reactions-'));
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
  const root = path.resolve(import.meta.dirname, '../..');
  const databasePath = path.join(sandbox, 'data', 'laprakin.sqlite');
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
      ADMIN_MFA_REQUIRED: 'false',
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

    const ownerClient = createClient(base, 'reaction-owner-device');
    const owner = await registerVerified(ownerClient, `reaction-owner-${randomUUID()}@example.test`);
    await ownerClient.request('/wallet/claim-welcome', { method: 'POST', body: '{}' });
    const created = await ownerClient.request('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ title: 'Reaction test', configuration: { courseName: 'Jaringan', moduleTitle: 'Routing' } }),
    });
    assert.equal(created.response.status, 201, created.payload.error?.message);
    const requestId = `reaction-${randomUUID()}`;
    const sent = await ownerClient.request(`/chat/sessions/${created.payload.session.id}/messages`, {
      method: 'POST',
      headers: { 'idempotency-key': requestId },
      body: JSON.stringify({ requestId, content: 'Jelaskan routing statis untuk pengujian privasi.', aiMode: 'basic', allowExternalAi: false }),
    });
    assert.equal(sent.response.status, 200, sent.payload.error?.message);
    const assistant = sent.payload.messages.find((message) => message.role === 'assistant');
    assert.ok(assistant?.id);

    const liked = await ownerClient.request(`/chat/messages/${assistant.id}/reaction`, {
      method: 'PUT',
      body: JSON.stringify({ reaction: 'like' }),
    });
    assert.equal(liked.response.status, 200, liked.payload.error?.message);
    assert.equal(liked.payload.reaction.reaction, 'like');
    const reloadedLiked = await ownerClient.request(`/chat/sessions/${created.payload.session.id}`);
    assert.equal(reloadedLiked.payload.messages.find((message) => message.id === assistant.id).reaction, 'like');

    const disliked = await ownerClient.request(`/chat/messages/${assistant.id}/reaction`, {
      method: 'PUT',
      body: JSON.stringify({ reaction: 'dislike', reasonCode: 'unclear' }),
    });
    assert.equal(disliked.response.status, 200, disliked.payload.error?.message);
    assert.equal(disliked.payload.reaction.reaction, 'dislike');
    const reloadedDisliked = await ownerClient.request(`/chat/sessions/${created.payload.session.id}`);
    assert.equal(reloadedDisliked.payload.messages.find((message) => message.id === assistant.id).reaction, 'dislike');

    const otherClient = createClient(base, 'reaction-other-device');
    await registerVerified(otherClient, `reaction-other-${randomUUID()}@example.test`);
    const forbidden = await otherClient.request(`/chat/messages/${assistant.id}/reaction`, {
      method: 'PUT',
      body: JSON.stringify({ reaction: 'like' }),
    });
    assert.equal(forbidden.response.status, 404);
    assert.equal(forbidden.payload.error.code, 'CHAT_MESSAGE_NOT_FOUND');

    const database = new DatabaseSync(databasePath);
    try {
      const row = database.prepare('SELECT * FROM message_reactions WHERE owner_user_id = ? AND message_id = ?').get(owner.id, assistant.id);
      assert.equal(row.reaction, 'dislike');
      assert.equal(row.reason_code, 'unclear');
      assert.equal(row.request_id, requestId);
      assert.equal(row.provider_id, 'local');
      assert.equal(row.model_id, 'local-unconfigured');
      assert.ok(row.configuration_revision);
      assert.ok(row.prompt_template_revision);
      database.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(owner.id);
    } finally {
      database.close();
    }

    const analytics = await ownerClient.request('/admin/ai/reactions?days=30');
    assert.equal(analytics.response.status, 200, analytics.payload.error?.message);
    assert.equal(analytics.payload.total, 1);
    assert.equal(analytics.payload.counts.dislike, 1);
    const analyticsJson = JSON.stringify(analytics.payload);
    assert.equal(analyticsJson.includes('Jelaskan routing statis'), false);
    assert.equal(analyticsJson.includes('content'), false);

    const removed = await ownerClient.request(`/chat/messages/${assistant.id}/reaction`, { method: 'DELETE', body: '{}' });
    assert.equal(removed.response.status, 200, removed.payload.error?.message);
    assert.equal(removed.payload.reaction, null);
    const reloadedRemoved = await ownerClient.request(`/chat/sessions/${created.payload.session.id}`);
    assert.equal(reloadedRemoved.payload.messages.find((message) => message.id === assistant.id).reaction, '');
  } finally {
    await closeProcess(child);
    await rm(sandbox, { recursive: true, force: true });
  }
});
