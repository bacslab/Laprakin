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
      const payload = await response.json();
      if (payload.csrfToken) csrf = payload.csrfToken;
      return { status: response.status, payload };
    },
    async registerAndVerify(email) {
      const registered = await this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'KataSandi-Uji-2026' }),
      });
      assert.equal(registered.status, 201, registered.payload?.error?.message);
      const verified = await this.request('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ token: registered.payload.developmentVerificationToken }),
      });
      assert.equal(verified.status, 200, verified.payload?.error?.message);
      csrf = verified.payload.csrfToken;
      return verified.payload.user;
    },
  };
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill();
  await new Promise((resolve) => child.once('exit', resolve));
}

test('admin APIs enforce named capabilities independently of frontend visibility', { timeout: 120_000 }, async () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-admin-capabilities-'));
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
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
      JWT_SECRET: 'capability-test-jwt-secret-2026-unique',
      DEVICE_HMAC_SECRET: 'capability-test-device-secret-2026-unique',
      TOKEN_HMAC_SECRET: 'capability-test-token-secret-2026-unique',
    },
    stdio: 'ignore',
  });

  let database = null;
  try {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      try {
        if ((await fetch(`${base}/api/health`)).ok) break;
      } catch { /* server is still starting */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const client = createClient(base, `capability-${randomUUID()}`);
    const user = await client.registerAndVerify(`capability-${randomUUID()}@example.test`);
    const studentDenied = await client.request('/admin/capabilities');
    assert.equal(studentDenied.status, 403);
    assert.equal(studentDenied.payload.error.code, 'ADMIN_CAPABILITY_REQUIRED');

    database = new DatabaseSync(path.join(sandbox, 'data', 'laprakin.sqlite'));
    database.prepare("UPDATE users SET role = 'support_admin' WHERE id = ?").run(user.id);

    const manifest = await client.request('/admin/capabilities');
    assert.equal(manifest.status, 200);
    assert.equal(manifest.payload.role, 'support_admin');
    assert.deepEqual(manifest.payload.capabilities, [
      'users.view',
      'users.restrict',
      'appeals.review',
      'incidents.manage',
    ]);

    const users = await client.request('/admin/users');
    assert.equal(users.status, 200);
    const aiUsageDenied = await client.request('/admin/ai/usage');
    assert.equal(aiUsageDenied.status, 403);
    assert.equal(aiUsageDenied.payload.error.code, 'ADMIN_CAPABILITY_REQUIRED');
    const creditsDenied = await client.request('/admin/credits/grant', {
      method: 'POST',
      body: JSON.stringify({ audience: 'all', amount: 1, reason: 'test' }),
    });
    assert.equal(creditsDenied.status, 403);
    assert.equal(creditsDenied.payload.error.code, 'ADMIN_CAPABILITY_REQUIRED');
  } finally {
    database?.close();
    await stopServer(child);
    await rm(sandbox, { recursive: true, force: true });
  }
});
