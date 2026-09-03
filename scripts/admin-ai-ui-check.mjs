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
  await Promise.race([
    once(child, 'exit'),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
}

const root = path.resolve(import.meta.dirname, '..');
const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-admin-ai-ui-'));
const apiPort = await availablePort();
const webPort = await availablePort();
const apiBase = `http://127.0.0.1:${apiPort}`;
const webBase = `http://127.0.0.1:${webPort}`;
const email = `admin-ai-ui-${Date.now()}@example.test`;
const password = 'KataSandi-Uji-2026';
const screenshotDir = path.join(root, 'output', 'playwright', 'admin-ai');
await mkdir(screenshotDir, { recursive: true });

let serverLogs = '';
let webLogs = '';
const api = spawn(process.execPath, ['server/src/index.js'], {
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
api.stdout.on('data', (chunk) => { serverLogs += chunk; });
api.stderr.on('data', (chunk) => { serverLogs += chunk; });

const viteEntry = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const web = spawn(process.execPath, [viteEntry, '--host', '127.0.0.1', '--port', String(webPort)], {
  cwd: path.join(root, 'client'),
  env: { ...process.env, VITE_API_URL: `${apiBase}/api` },
  stdio: ['ignore', 'pipe', 'pipe'],
});
web.stdout.on('data', (chunk) => { webLogs += chunk; });
web.stderr.on('data', (chunk) => { webLogs += chunk; });

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
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const browserErrors = [];
  const apiRequests = [];
  page.on('pageerror', (error) => browserErrors.push(String(error)));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/admin/')) apiRequests.push(url.pathname);
  });

  await page.goto(`${webBase}/auth?next=${encodeURIComponent('/admin/ai/providers')}`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Masuk ke workspace' }).click();
  await page.waitForURL('**/admin/ai/providers');
  await page.getByRole('heading', { name: 'Verifikasi dua langkah diperlukan' }).waitFor();
  await page.getByRole('button', { name: 'Mulai enrollment' }).click();
  const mfaSecret = (await page.locator('.admin-mfa-secret code').textContent()).trim();
  await page.getByLabel('Kode 6 digit').fill(totpCode(mfaSecret));
  await page.getByRole('button', { name: 'Verifikasi dan buka console' }).click();
  await page.getByRole('heading', { name: 'Provider', exact: true }).waitFor();

  assert.equal(apiRequests.some((url) => /\/admin\/(?:overview|feedback|audit|cms|users|alerts)/.test(url)), false, apiRequests.join('\n'));
  assert.equal(await page.getByRole('navigation', { name: 'Navigasi Admin AI' }).isVisible(), true);
  assert.equal(await page.getByRole('link', { name: 'Provider', exact: true }).getAttribute('href'), '/admin/ai/providers');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  const noticeClose = page.getByRole('button', { name: 'Tutup notifikasi' });
  if (await noticeClose.count()) await noticeClose.click();
  await page.screenshot({ path: path.join(screenshotDir, 'providers-desktop.png'), fullPage: true });

  await page.getByRole('button', { name: 'Provider', exact: true }).click();
  await page.getByLabel('Provider ID', { exact: true }).fill('ui-check');
  await page.getByLabel('Nama tampilan', { exact: true }).fill('UI Check Provider');
  await page.getByLabel('Base URL', { exact: true }).fill('https://router.bynara.id/v1');
  await page.getByLabel('Alasan perubahan', { exact: true }).fill('Browser contract verification');
  const providerResponsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/admin/ai/providers');
  await page.getByRole('button', { name: 'Simpan draft' }).click();
  const providerResponse = await providerResponsePromise;
  const providerPayload = await providerResponse.json();
  assert.equal(providerResponse.status(), 201, `${JSON.stringify(providerPayload)}\n${serverLogs}`);
  await page.waitForURL('**/admin/ai/providers/ui-check**');
  await page.getByRole('heading', { name: 'UI Check Provider', exact: true, level: 1 }).waitFor();
  const credential = page.getByLabel('Credential baru', { exact: true });
  assert.equal(await credential.getAttribute('type'), 'password');
  assert.equal(await credential.getAttribute('autocomplete'), 'new-password');
  assert.equal(await page.getByRole('button', { name: /reveal|show/i }).count(), 0);
  for (const label of ['Model terkait', 'Route terkait', 'Terakhir diuji', 'Panggilan sukses terakhir']) {
    assert.equal(await page.getByText(label, { exact: true }).isVisible(), true, `Missing provider summary: ${label}`);
  }

  await page.goto(`${webBase}/admin/ai/models?revisionId=${encodeURIComponent(providerPayload.revision.id)}`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Registry model', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Model', exact: true }).click();
  await page.getByLabel('Provider ID', { exact: true }).fill('ui-check');
  await page.getByLabel('Model ID', { exact: true }).fill('ui-model');
  await page.getByLabel('Alasan perubahan', { exact: true }).fill('Browser model lifecycle verification');
  const modelResponsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/admin/ai/models');
  await page.getByRole('button', { name: 'Simpan draft' }).click();
  const modelResponse = await modelResponsePromise;
  const modelPayload = await modelResponse.json();
  assert.equal(modelResponse.status(), 201, `${JSON.stringify(modelPayload)}\n${serverLogs}`);
  await page.getByText('ui-model', { exact: true }).waitFor();
  const capabilityButton = page.getByRole('button', { name: 'Uji capability' });
  await capabilityButton.focus();
  await capabilityButton.click();
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.locator('.admin-ai-sidebar').getAttribute('inert'), '');
  const closeDialogButton = page.getByRole('button', { name: 'Tutup dialog' });
  await closeDialogButton.focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.getByRole('dialog').getByRole('button', { name: 'Batal' }).evaluate((node) => node === document.activeElement), true);
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(await capabilityButton.evaluate((node) => node === document.activeElement), true);
  assert.equal(await page.getByRole('button', { name: 'Nonaktifkan model' }).isVisible(), true);
  await page.screenshot({ path: path.join(screenshotDir, 'models-actions-desktop.png'), fullPage: true });

  const routes = [
    ['/admin/ai/models', 'Registry model'],
    ['/admin/ai/routing', 'Routing'],
    ['/admin/ai/health', 'Health & canary'],
    ['/admin/ai/changes', 'Riwayat perubahan'],
  ];
  for (const [route, title] of routes) {
    await page.goto(`${webBase}${route}`, { waitUntil: 'networkidle' });
    try {
      await page.getByRole('heading', { name: title, exact: true }).waitFor({ timeout: 10_000 });
    } catch (error) {
      const diagnostic = {
        route,
        currentUrl: page.url(),
        text: (await page.locator('body').innerText()).slice(0, 2_000),
        browserErrors,
        recentAdminRequests: apiRequests.slice(-12),
      };
      throw new Error(`Admin AI deep-link diagnostic: ${JSON.stringify(diagnostic)}`, { cause: error });
    }
  }

  await page.goto(`${webBase}/admin/ai/health`, { waitUntil: 'networkidle' });
  for (const label of ['Latency p50 / p95', 'First-token p50 / p95', 'Success / fallback', 'Error operasional']) {
    assert.equal(await page.getByText(label, { exact: true }).isVisible(), true, `Missing health metric: ${label}`);
  }
  assert.equal(await page.getByRole('button', { name: 'Buka circuit' }).isVisible(), true);
  assert.equal(await page.getByRole('button', { name: 'Aktifkan maintenance' }).isVisible(), true);
  await page.locator('.admin-ai-main').evaluate((node) => node.scrollTo(0, node.scrollHeight));
  await page.screenshot({ path: path.join(screenshotDir, 'health-operations-desktop.png'), fullPage: true });
  await page.goto(`${webBase}/admin/ai/changes`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Riwayat perubahan', exact: true }).waitFor();

  await page.getByRole('button', { name: 'Ubah tema admin' }).click();
  await page.locator('.admin-ai-shell.theme-dark').waitFor();
  const darkCanvas = await page.locator('.admin-ai-shell').evaluate((node) => getComputedStyle(node).backgroundColor);
  assert.notEqual(darkCanvas, 'rgba(0, 0, 0, 0)');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('navigation', { name: 'Navigasi Admin AI' }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  assert.equal(await page.getByRole('link', { name: 'Provider', exact: true }).isVisible(), true);
  await page.screenshot({ path: path.join(screenshotDir, 'changes-mobile-dark.png'), fullPage: true });

  await page.evaluate(() => {
    const prefs = JSON.parse(localStorage.getItem('laprakin-preferences') || '{}');
    localStorage.setItem('laprakin-preferences', JSON.stringify({ ...prefs, language: 'en', theme: 'light' }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Change history', exact: true }).waitFor();
  assert.equal(await page.getByRole('navigation', { name: 'Admin AI navigation' }).isVisible(), true);

  let failHealthOnce = true;
  await page.route(`${apiBase}/api/admin/ai/health*`, async (route) => {
    if (failHealthOnce) {
      failHealthOnce = false;
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  await page.goto(`${webBase}/admin/ai/health`);
  await page.getByRole('alert').waitFor();
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.getByRole('heading', { name: 'Health & canary', exact: true }).waitFor();
  await page.locator('.admin-ai-health-grid').first().waitFor();

  const navLink = page.getByRole('link', { name: 'Providers', exact: true });
  await navLink.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/admin/ai/providers');
  assert.deepEqual(browserErrors, []);

  const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(`${webBase}/auth`, { waitUntil: 'domcontentloaded' });
  const reducedAnimation = await reducedPage.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  assert.equal(reducedAnimation, true);
  await reducedContext.close();
  await context.close();

  console.log(`Admin AI UI passed: isolated deep links, secret-safe credential input, English/Indonesian copy, failure retry, keyboard navigation, dark theme, reduced motion, desktop, and 390px mobile. Screenshots: ${screenshotDir}`);
} finally {
  await browser?.close().catch(() => {});
  await Promise.all([stopProcess(api), stopProcess(web)]);
  await rm(sandbox, { recursive: true, force: true });
}
