import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForApi(base) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('API MFA tidak siap dalam batas waktu.');
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
      const setCookies = response.headers.getSetCookie?.() || [];
      if (!setCookies.length && response.headers.get('set-cookie')) setCookies.push(response.headers.get('set-cookie'));
      for (const setCookie of setCookies) {
        const nameValue = setCookie.split(';')[0];
        const separator = nameValue.indexOf('=');
        if (separator > 0) cookies.set(nameValue.slice(0, separator), nameValue.slice(separator + 1));
      }
      const payload = await response.json();
      if (payload.csrfToken) csrf = payload.csrfToken;
      assert.equal(response.status, options.expectedStatus || 200, payload.error?.message || endpoint);
      return payload;
    },
  };
}

test('enforced admin MFA blocks console access until enrollment and step-up verify', { timeout: 120000 }, async () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-admin-mfa-'));
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
  const unique = `${Date.now()}-${randomUUID()}`;
  const email = `admin-${unique}@example.test`;
  const child = spawn(process.execPath, ['server/src/index.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'development', PORT: String(port), APP_URL: 'http://localhost:5173', API_URL: base,
      ALLOWED_ORIGINS: 'http://localhost:5173', ADMIN_EMAIL: email, ADMIN_MFA_REQUIRED: 'true',
      NARAROUTER_API_KEY: '', AI_REQUIRED: 'false', MANUAL_EMAIL_AUTH_ONLY: 'true', EMAIL_MODE: 'console',
      LAPRAKIN_DATA_DIR: path.join(sandbox, 'data'), LAPRAKIN_UPLOAD_DIR: path.join(sandbox, 'uploads'),
      LAPRAKIN_PUBLIC_MEDIA_DIR: path.join(sandbox, 'public-media'),
    },
    stdio: 'ignore',
  });
  try {
    await waitForApi(base);
    const client = createClient(base, `admin-mfa-${unique}`);
    const registration = await client.request('/auth/register', {
      method: 'POST', expectedStatus: 201, body: JSON.stringify({ email, password: 'KataSandi-Uji-2026' }),
    });
    await client.request('/auth/verify', {
      method: 'POST', body: JSON.stringify({ token: registration.developmentVerificationToken }),
    });

    const status = await client.request('/admin/mfa/status');
    assert.equal(status.mfa.required, true);
    const blocked = await client.request('/admin/overview', { expectedStatus: 428 });
    assert.equal(blocked.error.code, 'ADMIN_MFA_ENROLLMENT_REQUIRED');

    const enrollment = await client.request('/admin/mfa/enroll', { method: 'POST', expectedStatus: 201, body: '{}' });
    assert.match(enrollment.secret, /^[A-Z2-7]+$/);
    const { totpCodeForTest } = await import('../src/mfa.js');
    const code = totpCodeForTest(enrollment.secret, Math.floor(Date.now() / 30000));
    const verified = await client.request('/admin/mfa/verify', { method: 'POST', body: JSON.stringify({ code }) });
    assert.equal(verified.mfa.verified, true);
    const overview = await client.request('/admin/overview');
    assert.equal(typeof overview.stats.users, 'number');
    const audit = await client.request('/admin/audit');
    assert.ok(audit.events.some((row) => row.action === 'admin.mfa_enrolled'));
    assert.ok(audit.events.some((row) => row.action === 'admin.mfa_verified'));
  } finally {
    child.kill();
    await new Promise((resolve) => child.once('exit', resolve));
    await rm(sandbox, { recursive: true, force: true });
  }
});
