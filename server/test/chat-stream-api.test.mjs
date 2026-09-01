import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import net from 'node:net';
import test from 'node:test';

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

async function closeProcess(child) {
  if (child.exitCode !== null) return;
  child.kill();
  await new Promise((resolve) => child.once('exit', resolve));
}

test('chat API relays provider deltas before returning the canonical response', async () => {
  const providerPort = await availablePort();
  const apiPort = await availablePort();
  const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-stream-api-'));
  const modelOutput = JSON.stringify({
    action: 'RESPOND',
    message: 'Jawaban progresif tersedia.',
    title: 'Tes Streaming',
    courseName: 'Jaringan Komputer',
    moduleTitle: 'Static Routing',
    projectName: 'Jaringan Komputer',
  });
  const splitAt = modelOutput.indexOf('progresif');
  let sawStreamRequest = false;
  const provider = http.createServer(async (request, response) => {
    if (request.url === '/v1/models') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ data: [{ id: 'mistral-medium-test', context_length: 128000, supportsVision: false, supportsReasoning: true, supportsStructuredOutput: true }] }));
      return;
    }
    if (request.url !== '/v1/chat/completions') {
      response.writeHead(404);
      response.end();
      return;
    }
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw || '{}');
    if (body.stream) {
      sawStreamRequest = true;
      response.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' });
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: modelOutput.slice(0, splitAt) } }] })}\n\n`);
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: modelOutput.slice(splitAt) } }] })}\n\n`);
      response.end('data: [DONE]\n\n');
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ steps: [
        { title: 'Membaca konteks', detail: 'Memeriksa bahan.', phase: 'read_sources' },
        { title: 'Menyusun konteks', detail: 'Mengelompokkan informasi.', phase: 'organize' },
        { title: 'Menyiapkan draft', detail: 'Menentukan struktur.', phase: 'draft' },
        { title: 'Memeriksa hasil', detail: 'Menandai langkah berikutnya.', phase: 'verify' },
      ] }) } }],
    }));
  });
  await new Promise((resolve) => provider.listen(providerPort, '127.0.0.1', resolve));

  const server = spawn(process.execPath, ['server/src/index.js'], {
    cwd: path.resolve(import.meta.dirname, '../..'),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(apiPort),
      APP_URL: 'http://localhost:5173',
      API_URL: `http://127.0.0.1:${apiPort}`,
      ALLOWED_ORIGINS: 'http://localhost:5173',
      NARAROUTER_API_KEY: 'stream-test-key',
      NARAROUTER_BASE_URL: `http://127.0.0.1:${providerPort}/v1`,
      NARAROUTER_MAX_RPM: '600',
      NARAROUTER_MAX_CONCURRENCY: '2',
      AI_MAX_RETRIES: '1',
      LAPRAKIN_DATA_DIR: path.join(sandbox, 'data'),
      LAPRAKIN_UPLOAD_DIR: path.join(sandbox, 'uploads'),
      LAPRAKIN_PUBLIC_MEDIA_DIR: path.join(sandbox, 'public-media'),
      EMAIL_MODE: 'console',
      MANUAL_EMAIL_AUTH_ONLY: 'true',
      JOB_POLL_MS: '100',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  server.stdout.on('data', (chunk) => { logs += chunk; });
  server.stderr.on('data', (chunk) => { logs += chunk; });
  const base = `http://127.0.0.1:${apiPort}`;
  const cookies = new Map();
  let csrf = '';
  const device = `stream-api-${randomUUID()}`;
  const request = async (endpoint, options = {}) => {
    const response = await fetch(`${base}/api${endpoint}`, {
      ...options,
      headers: {
        'x-laprakin-device': device,
        ...(cookies.size ? { cookie: [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ') } : {}),
        ...(csrf ? { 'x-laprakin-csrf': csrf } : {}),
        ...(options.body && !(options.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
    for (const setCookie of response.headers.getSetCookie?.() || [response.headers.get('set-cookie')].filter(Boolean)) {
      const [nameValue] = setCookie.split(';');
      const separator = nameValue.indexOf('=');
      if (separator > 0) cookies.set(nameValue.slice(0, separator), nameValue.slice(separator + 1));
    }
    const type = response.headers.get('content-type') || '';
    const payload = type.includes('application/json') ? await response.json() : await response.text();
    return { response, payload };
  };

  try {
    const started = Date.now();
    while (Date.now() - started < 30000) {
      try {
        if ((await fetch(`${base}/api/health`)).ok) break;
      } catch { /* server masih start */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const registration = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: `stream-${Date.now()}@example.test`, password: 'KataSandi-Uji-2026' }),
    });
    assert.equal(registration.response.status, 201, logs);
    const verification = await request('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token: registration.payload.developmentVerificationToken }),
    });
    assert.equal(verification.response.status, 200, logs);
    csrf = verification.payload.csrfToken;
    const created = await request('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ title: 'Laprak baru', configuration: { courseName: 'Jaringan Komputer', moduleTitle: 'Static Routing', allowExternalAi: true } }),
    });
    assert.equal(created.response.status, 201, logs);
    const sessionId = created.payload.session.id;
    await request('/wallet/claim-welcome', { method: 'POST', body: '{}' });
    const streamed = await request(`/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { accept: 'text/event-stream' },
      body: JSON.stringify({ content: 'Jelaskan Static Routing.', aiMode: 'basic', allowExternalAi: true }),
    });
    assert.equal(streamed.response.status, 200, streamed.payload);
    assert.match(streamed.response.headers.get('content-type') || '', /text\/event-stream/);
    const events = streamed.payload.split('\n\n')
      .filter((block) => block.startsWith('data: '))
      .map((block) => JSON.parse(block.slice(6)));
    assert.ok(events.filter((event) => event.type === 'delta').length >= 2);
    assert.equal(events.at(-1).type, 'done');
    assert.equal(events.at(-1).message.session.id, sessionId);
    assert.equal(events.at(-1).message.messages.at(-1).role, 'assistant');
    assert.equal(sawStreamRequest, true);
  } finally {
    await closeProcess(server);
    await new Promise((resolve) => provider.close(resolve));
    await rm(sandbox, { recursive: true, force: true });
  }
});

