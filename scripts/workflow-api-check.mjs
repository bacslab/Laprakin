import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

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

const root = path.resolve(import.meta.dirname, '..');
const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-workflow-'));
const port = await availablePort();
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server/src/index.js'], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(port),
    APP_URL: 'http://localhost:5173',
    API_URL: base,
    ALLOWED_ORIGINS: 'http://localhost:5173',
    GEMINI_API_KEY: 'workflow-guard-does-not-call-provider',
    LAPRAKIN_DATA_DIR: path.join(sandbox, 'data'),
    LAPRAKIN_UPLOAD_DIR: path.join(sandbox, 'uploads'),
    JOB_POLL_MS: '100',
    EMAIL_MODE: 'console',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let logs = '';
server.stdout.on('data', (chunk) => { logs += chunk; });
server.stderr.on('data', (chunk) => { logs += chunk; });

let cookie = '';
let csrf = '';
const device = `workflow-${Date.now()}`;

async function request(endpoint, options = {}, expectedStatus = 200) {
  const response = await fetch(`${base}/api${endpoint}`, {
    ...options,
    headers: {
      'x-laprakin-device': device,
      ...(cookie ? { cookie } : {}),
      ...(csrf ? { 'x-laprakin-csrf': csrf } : {}),
      ...(options.body && !(options.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const payload = await response.json();
  assert.equal(response.status, expectedStatus, payload?.error?.message || `${options.method || 'GET'} ${endpoint}`);
  return payload;
}

try {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    try {
      const health = await fetch(`${base}/api/health`);
      if (health.ok) break;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert.equal((await fetch(`${base}/api/health`)).ok, true, `API gagal start:\n${logs}`);

  const email = `workflow-${Date.now()}@example.test`;
  const registration = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'KataSandi-Uji-2026' }),
  }, 201);
  const verification = await request('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ token: registration.developmentVerificationToken }),
  });
  csrf = verification.csrfToken;

  const chat = await request('/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ title: 'Laprak baru', configuration: { allowExternalAi: true } }),
  }, 201);
  const result = await request(`/chat/sessions/${chat.session.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: 'Asep', aiMode: 'basic', allowExternalAi: true }),
  });
  assert.equal(result.session.title, 'Laprak baru');
  assert.equal(result.workflow.stage, 'intake');
  assert.equal(result.workflow.canCreateDocument, false);
  assert.match(result.messages.at(-1).content, /belum punya konteks/i);

  const blocked = await request(`/chat/sessions/${chat.session.id}/document`, { method: 'POST', body: '{}' }, 422);
  assert.equal(blocked.error.code, 'CHAT_CONTEXT_INCOMPLETE');
  assert.match(blocked.error.message, /konteks belum cukup/i);

  console.log('Workflow API passed: “Asep” tetap intake dan pembuatan dokumen diblokir.');
} finally {
  server.kill();
  await new Promise((resolve) => server.once('exit', resolve));
  await rm(sandbox, { recursive: true, force: true });
}
