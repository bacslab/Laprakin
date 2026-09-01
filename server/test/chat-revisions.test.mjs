import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildRevisionPlan,
  validateRevisionRequest,
} from '../src/chat-revisions.js';

async function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function createClient(base, device) {
  const cookies = new Map();
  let csrf = '';

  function headers(extra = {}, includeCsrf = true) {
    return {
      'x-laprakin-device': device,
      ...(cookies.size ? { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') } : {}),
      ...(includeCsrf && csrf ? { 'x-laprakin-csrf': csrf } : {}),
      ...extra,
    };
  }

  async function raw(endpoint, options = {}) {
    const { skipCsrf = false, ...fetchOptions } = options;
    const response = await fetch(`${base}/api${endpoint}`, {
      ...fetchOptions,
      headers: headers({
        ...(fetchOptions.body && !(fetchOptions.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        ...(fetchOptions.headers || {}),
      }, !skipCsrf),
    });
    const setCookies = response.headers.getSetCookie?.() || [response.headers.get('set-cookie')].filter(Boolean);
    for (const setCookie of setCookies) {
      const [nameValue] = setCookie.split(';');
      const separator = nameValue.indexOf('=');
      if (separator > 0) cookies.set(nameValue.slice(0, separator), nameValue.slice(separator + 1));
    }
    const contentType = response.headers.get('content-type') || '';
    const payload = response.status === 204
      ? null
      : contentType.includes('application/json')
        ? await response.json()
        : await response.text();
    if (payload?.csrfToken) csrf = payload.csrfToken;
    return { status: response.status, payload };
  }

  async function request(endpoint, options = {}, expectedStatus = 200) {
    const result = await raw(endpoint, options);
    assert.equal(
      result.status,
      expectedStatus,
      result.payload?.error?.message || `${options.method || 'GET'} ${endpoint}`,
    );
    return result.payload;
  }

  return {
    raw,
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
      return request('/auth/me');
    },
  };
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

test('edit keeps the source branch and replaces messages after it', () => {
  const messages = [
    { id: 'user-1', role: 'user', content: 'Konteks praktikum' },
    { id: 'assistant-1', role: 'assistant', content: 'Jawaban awal' },
    { id: 'user-2', role: 'user', content: 'Pertanyaan asli' },
    { id: 'assistant-2', role: 'assistant', content: 'Jawaban kedua' },
  ];

  const result = buildRevisionPlan(messages, 'user-2', 'edit', 'Tulis ulang bagian metode');

  assert.deepEqual(result.retainedMessages.map(({ id }) => id), ['user-1', 'assistant-1', 'user-2']);
  assert.equal(result.userContent, 'Tulis ulang bagian metode');
  assert.equal(result.revisionNumber, 1);
});

test('regenerate reuses the source user content without duplicating it', () => {
  const messages = [
    { id: 'user-1', role: 'user', content: 'Konteks praktikum' },
    { id: 'assistant-1', role: 'assistant', content: 'Jawaban awal' },
    { id: 'user-2', role: 'user', content: 'Pertanyaan asli' },
    { id: 'assistant-2', role: 'assistant', content: 'Jawaban kedua' },
  ];

  const result = buildRevisionPlan(messages, 'user-2', 'regenerate');

  assert.equal(result.userContent, 'Pertanyaan asli');
  assert.equal(result.retainedMessages.length, 3);
});

test('revision rejects an assistant source and an empty edit', () => {
  const messages = [
    { id: 'user-1', role: 'user', content: 'Konteks praktikum' },
    { id: 'assistant-1', role: 'assistant', content: 'Jawaban awal' },
    { id: 'user-2', role: 'user', content: 'Pertanyaan asli' },
    { id: 'assistant-2', role: 'assistant', content: 'Jawaban kedua' },
  ];

  assert.throws(() => buildRevisionPlan(messages, 'assistant-2', 'regenerate'), /USER_MESSAGE_REQUIRED/);
  assert.throws(() => buildRevisionPlan(messages, 'user-2', 'edit', '   '), /CONTENT_REQUIRED/);
});

test('validateRevisionRequest normalizes mode and content rules', () => {
  assert.deepEqual(
    validateRevisionRequest({ mode: 'edit', content: '  Perbaiki hasil akhir  ' }),
    { mode: 'edit', content: 'Perbaiki hasil akhir' },
  );
  assert.deepEqual(
    validateRevisionRequest({ mode: 'regenerate', content: 'akan diabaikan' }),
    { mode: 'regenerate', content: '' },
  );
  assert.throws(() => validateRevisionRequest({ mode: 'rewrite' }), /MODE_INVALID/);
});

test('revision API replaces only the trailing branch and returns the canonical payload shape', { timeout: 120_000 }, async () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-chat-revision-'));
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
  const unique = `${Date.now()}-${randomUUID()}`;
  const child = spawn(process.execPath, ['server/src/index.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(port),
      APP_URL: 'http://localhost:5173',
      API_URL: base,
      ALLOWED_ORIGINS: 'http://localhost:5173',
      ADMIN_EMAIL: `admin-${unique}@example.test`,
      NARAROUTER_API_KEY: '',
      AI_REQUIRED: 'false',
      LAPRAKIN_DATA_DIR: path.join(sandbox, 'data'),
      LAPRAKIN_UPLOAD_DIR: path.join(sandbox, 'uploads'),
      LAPRAKIN_PUBLIC_MEDIA_DIR: path.join(sandbox, 'public-media'),
      EMAIL_MODE: 'console',
      MANUAL_EMAIL_AUTH_ONLY: 'true',
      JWT_SECRET: 'chat-revision-test-jwt-secret-2026-unique',
      DEVICE_HMAC_SECRET: 'chat-revision-test-device-secret-2026-unique',
      TOKEN_HMAC_SECRET: 'chat-revision-test-token-secret-2026-unique',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let logs = '';
  child.stdout.on('data', (chunk) => { logs = `${logs}${chunk}`.slice(-20_000); });
  child.stderr.on('data', (chunk) => { logs = `${logs}${chunk}`.slice(-20_000); });

  try {
    const startedAt = Date.now();
    let ready = false;
    while (Date.now() - startedAt < 30_000) {
      try {
        if ((await fetch(`${base}/api/health`)).ok) {
          ready = true;
          break;
        }
      } catch { /* server still starting */ }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    assert.equal(ready, true, `API gagal start:\n${logs}`);

    const client = createClient(base, `chat-revision-${unique}`);
    await client.registerAndVerify(`student-${unique}@example.test`);

    const conversation = await client.request('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Laprak revisi',
        configuration: {
          allowExternalAi: true,
        },
      }),
    }, 201);

    const initial = await client.request(`/chat/sessions/${conversation.session.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content: 'Untuk mata kuliah Jaringan Komputer dengan materi Static Routing, jelaskan dua langkah konfigurasi paling penting.',
        aiMode: 'basic',
        allowExternalAi: true,
      }),
    });

    const sourceMessage = initial.messages.find((message) => message.role === 'user');
    assert.ok(sourceMessage?.id, 'Pesan sumber user harus tersimpan sebelum revisi.');
    assert.equal(initial.messages.filter((message) => message.role === 'assistant').length, 1);

    const revised = await client.request(`/chat/sessions/${conversation.session.id}/messages/${sourceMessage.id}/revise`, {
      method: 'POST',
      body: JSON.stringify({
        mode: 'edit',
        content: 'Tulis ulang dengan fokus pada konfigurasi static routing.',
      }),
    });

    assert.equal(revised.session.id, conversation.session.id);
    assert.equal(Array.isArray(revised.messages), true);
    assert.equal(Array.isArray(revised.attachments), true);
    assert.equal(typeof revised.workflow.state, 'string');
    assert.deepEqual(revised.revision, {
      sourceMessageId: sourceMessage.id,
      mode: 'edit',
      revisionNumber: 1,
    });
    assert.equal(revised.messages.length, 3);
    assert.equal(revised.messages[0].id, sourceMessage.id);
    assert.equal(revised.messages[1].role, 'user');
    assert.equal(revised.messages[1].content, 'Tulis ulang dengan fokus pada konfigurasi static routing.');
    assert.equal(revised.messages[1].meta?.revision?.sourceMessageId, sourceMessage.id);
    assert.equal(revised.messages[1].meta?.revision?.mode, 'edit');
    assert.equal(revised.messages[1].meta?.revision?.revisionNumber, 1);
    assert.equal(revised.messages[2].role, 'assistant');
    assert.equal(revised.messages[2].meta?.revision?.sourceMessageId, sourceMessage.id);

    const refreshed = await client.request(`/chat/sessions/${conversation.session.id}`);
    assert.equal(refreshed.messages.length, 3);
    assert.equal(refreshed.messages[1].content, 'Tulis ulang dengan fokus pada konfigurasi static routing.');
  } finally {
    await stopServer(child);
    await rm(sandbox, { recursive: true, force: true });
  }
});
