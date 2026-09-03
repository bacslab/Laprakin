import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

function browserExecutable() {
  const candidates = [
    process.env.LAPRAKIN_BROWSER_EXECUTABLE,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  ].filter(Boolean);
  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) throw new Error('No supported local Chromium browser was found. Set LAPRAKIN_BROWSER_EXECUTABLE.');
  return executable;
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function fromBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let buffer = 0;
  const output = [];
  for (const character of String(value || '').replace(/=+$/, '').toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) continue;
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) { output.push((buffer >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(output);
}

function totpCode(secret, at = Date.now()) {
  const message = Buffer.alloc(8);
  message.writeBigInt64BE(BigInt(Math.floor(at / 30_000)));
  const digest = createHmac('sha1', fromBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  const number = ((digest[offset] & 127) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(number % 1_000_000).padStart(6, '0');
}

async function waitFor(url, logs) {
  const started = Date.now();
  while (Date.now() - started < 45_000) {
    try { if ((await fetch(url)).ok) return; } catch { /* service is starting */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${url}\n${logs()}`);
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 5_000))]);
}

const root = path.resolve(import.meta.dirname, '..');
const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-admin-legacy-ui-'));
const apiPort = await availablePort();
const webPort = await availablePort();
const apiBase = `http://127.0.0.1:${apiPort}`;
const webBase = `http://127.0.0.1:${webPort}`;
const email = `admin-legacy-ui-${Date.now()}@example.test`;
const password = 'KataSandi-Uji-2026';
const screenshotDir = path.join(root, 'output', 'playwright', 'admin-legacy');
await mkdir(screenshotDir, { recursive: true });

let serverLogs = '';
let webLogs = '';
const apiProcess = spawn(process.execPath, ['server/src/index.js'], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(apiPort),
    APP_URL: webBase,
    API_URL: apiBase,
    ALLOWED_ORIGINS: webBase,
    ADMIN_EMAIL: email,
    ADMIN_MFA_REQUIRED: 'true',
    NARAROUTER_API_KEY: '',
    CLOUDFLARE_AI_TOKEN: '',
    EMAIL_MODE: 'console',
    MANUAL_EMAIL_AUTH_ONLY: 'true',
    LAPRAKIN_DATA_DIR: path.join(sandbox, 'data'),
    LAPRAKIN_UPLOAD_DIR: path.join(sandbox, 'uploads'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
apiProcess.stdout.on('data', (chunk) => { serverLogs += chunk; });
apiProcess.stderr.on('data', (chunk) => { serverLogs += chunk; });

const viteEntry = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const webProcess = spawn(process.execPath, [viteEntry, '--host', '127.0.0.1', '--port', String(webPort)], {
  cwd: path.join(root, 'client'),
  env: { ...process.env, VITE_API_URL: `${apiBase}/api` },
  stdio: ['ignore', 'pipe', 'pipe'],
});
webProcess.stdout.on('data', (chunk) => { webLogs += chunk; });
webProcess.stderr.on('data', (chunk) => { webLogs += chunk; });

let browser;
try {
  await Promise.all([
    waitFor(`${apiBase}/api/health`, () => serverLogs),
    waitFor(webBase, () => webLogs),
  ]);

  const registration = await fetch(`${apiBase}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const registrationPayload = await registration.json();
  assert.equal(registration.status, 201, JSON.stringify(registrationPayload));
  const verification = await fetch(`${apiBase}/api/auth/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: registrationPayload.developmentVerificationToken }),
  });
  assert.equal(verification.ok, true, await verification.text());

  browser = await chromium.launch({ headless: true, executablePath: browserExecutable() });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const browserErrors = [];
  const apiRequests = [];
  page.on('pageerror', (error) => browserErrors.push(String(error)));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/admin/')) apiRequests.push(url.pathname);
  });

  await page.goto(`${webBase}/auth?next=${encodeURIComponent('/admin/audit')}`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Masuk ke workspace' }).click();
  await page.waitForURL('**/admin/audit');
  await page.getByRole('heading', { name: 'Verifikasi dua langkah diperlukan' }).waitFor();
  await page.getByRole('button', { name: 'Mulai enrollment' }).click();
  const mfaSecret = (await page.locator('.admin-mfa-secret code').textContent()).trim();
  await page.getByLabel('Kode 6 digit').fill(totpCode(mfaSecret));
  await page.getByRole('button', { name: 'Verifikasi dan buka console' }).click();
  await page.getByText(/Terakhir diperbarui:/).waitFor();

  const dataEndpoints = [
    '/api/admin/overview',
    '/api/admin/users',
    '/api/admin/feedback',
    '/api/admin/cms/landing',
    '/api/admin/audit',
    '/api/admin/alerts',
    '/api/admin/ai/usage',
  ];
  const routes = [
    ['/admin', '/api/admin/overview', 'Monitoring'],
    ['/admin/users', '/api/admin/users', 'Akses user'],
    ['/admin/feedback', '/api/admin/feedback', 'Feedback'],
    ['/admin/cms', '/api/admin/cms/landing', 'Landing CMS'],
    ['/admin/audit', '/api/admin/audit', 'Audit log'],
    ['/admin/alerts', '/api/admin/alerts', 'Error realtime'],
  ];

  for (const [route, expectedEndpoint, heading] of routes) {
    apiRequests.length = 0;
    await page.goto(`${webBase}${route}`);
    await page.getByRole('heading', { name: heading, exact: true, level: 1 }).waitFor();
    await page.getByText(/Terakhir diperbarui:/).waitFor();
    const routeDataRequests = apiRequests.filter((requestPath) => dataEndpoints.some((endpoint) => requestPath === endpoint || requestPath.startsWith(`${endpoint}/`)));
    assert.equal(routeDataRequests.some((requestPath) => requestPath === expectedEndpoint || requestPath.startsWith(`${expectedEndpoint}/`)), true, `${route} missed ${expectedEndpoint}:\n${apiRequests.join('\n')}`);
    const unrelated = routeDataRequests.filter((requestPath) => !(requestPath === expectedEndpoint || requestPath.startsWith(`${expectedEndpoint}/`)));
    assert.deepEqual(unrelated, [], `${route} requested unrelated Admin resources:\n${unrelated.join('\n')}`);
  }

  let failAuditOnce = true;
  await page.route(`${apiBase}/api/admin/audit*`, async (route) => {
    if (failAuditOnce) {
      failAuditOnce = false;
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  await page.goto(`${webBase}/admin/audit`);
  await page.getByRole('heading', { name: 'Audit log', exact: true, level: 1 }).waitFor();
  const alert = page.getByRole('alert');
  await alert.waitFor();
  assert.equal(await page.locator('.admin-sidebar').isVisible(), true, 'The Admin shell disappeared during a route failure.');
  await alert.getByRole('button', { name: 'Coba muat ulang' }).click();
  await alert.waitFor({ state: 'detached' });
  await page.getByText(/Terakhir diperbarui:/).waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  await page.screenshot({ path: path.join(screenshotDir, 'audit-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${webBase}/admin/cms`);
  await page.getByText(/Terakhir diperbarui:/).waitFor();
  await page.screenshot({ path: path.join(screenshotDir, 'cms-desktop.png'), fullPage: true });

  assert.deepEqual(browserErrors, []);
  await context.close();
  console.log(`Legacy Admin UI passed: six isolated direct routes, local failure recovery, persistent shell, freshness, desktop, and 390px mobile. Screenshots: ${screenshotDir}`);
} finally {
  await browser?.close().catch(() => {});
  await Promise.all([stopProcess(apiProcess), stopProcess(webProcess)]);
  await rm(sandbox, { recursive: true, force: true });
}
