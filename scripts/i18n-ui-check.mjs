import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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
    process.platform === 'win32' ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : '',
    process.platform === 'win32' ? 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe' : '',
    process.platform === 'win32' ? 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe' : '',
    chromium.executablePath(),
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

async function assertNoHorizontalOverflow(page, surface) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.equal(overflow, 0, `${surface} has ${overflow}px horizontal overflow`);
}

const root = path.resolve(import.meta.dirname, '..');
const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-i18n-ui-'));
const apiPort = await availablePort();
const webPort = await availablePort();
const apiBase = `http://127.0.0.1:${apiPort}`;
const webBase = `http://127.0.0.1:${webPort}`;
const email = `i18n-ui-${Date.now()}@example.test`;
const password = 'KataSandi-Uji-2026';
const screenshotDir = path.join(root, 'output', 'playwright', 'i18n');
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

  browser = await chromium.launch({ headless: true, executablePath: browserExecutable() });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  await context.addInitScript(() => {
    if (!localStorage.getItem('laprakin-preferences')) {
      localStorage.setItem('laprakin-preferences', JSON.stringify({ language: 'en', theme: 'light', compact: false }));
    }
  });
  const page = await context.newPage();
  const browserErrors = [];
  let authenticated = false;
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${String(error)}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (!authenticated && /^Failed to load resource: the server responded with a status of 401/.test(message.text())) return;
    browserErrors.push(`console: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    const url = new URL(response.url());
    if (!authenticated && response.status() === 401 && url.pathname === '/api/auth/me') return;
    browserErrors.push(`response: ${response.status()} ${url.pathname}`);
  });

  await page.goto(`${webBase}/auth`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Log in', exact: true }).waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click();
  await page.getByRole('button', { name: 'Verify now', exact: true }).click();
  await page.waitForURL('**/app');
  authenticated = true;

  const closeTutorial = page.getByRole('button', { name: 'Close tutorial', exact: true });
  await closeTutorial.waitFor({ timeout: 10_000 });
  await closeTutorial.click();
  await page.locator('.tutorial-overlay').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Chats', exact: true }).waitFor();
  assert.equal((await page.locator('.header-title b').textContent()).trim(), 'Laprakin chat');
  assert.equal(await page.locator('.workspace').getAttribute('data-language'), 'en');
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.locator('[data-legacy-i18n]').count(), 0);
  await assertNoHorizontalOverflow(page, 'English workspace desktop');
  await page.screenshot({ path: path.join(screenshotDir, 'workspace-en.png'), fullPage: true });

  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  const englishNotifications = page.getByRole('dialog', { name: 'Notifications', exact: true });
  await englishNotifications.waitFor();
  const englishNotificationStatus = (await englishNotifications.locator('header small').textContent()).trim();
  assert.match(englishNotificationStatus, /^(?:\d+ new|All caught up)$/);
  const markAllRead = englishNotifications.getByRole('button', { name: 'Mark all as read', exact: true });
  if (await markAllRead.count()) {
    await markAllRead.click();
    await englishNotifications.getByText('All caught up', { exact: true }).waitFor();
  }
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('heading', { name: 'Workspace appearance', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Language', exact: true }).click();
  await page.getByRole('option', { name: 'Indonesian', exact: true }).click();
  await page.getByRole('heading', { name: 'Tampilan workspace', exact: true }).waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'id');
  assert.equal(await page.locator('.workspace').getAttribute('data-language'), 'id');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('heading', { name: 'Tampilan workspace', exact: true }).waitFor();
  await assertNoHorizontalOverflow(page, 'Indonesian settings mobile');
  await page.screenshot({ path: path.join(screenshotDir, 'settings-id.png'), fullPage: true });
  await page.getByRole('button', { name: 'Tutup settings', exact: true }).click();

  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Buka navigasi', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).waitFor();
  const closeNavigation = page.getByRole('button', { name: 'Tutup navigasi', exact: true });
  await closeNavigation.focus();
  await closeNavigation.press('Enter');
  await page.getByRole('button', { name: 'Notifikasi', exact: true }).click();
  const indonesianNotifications = page.getByRole('dialog', { name: 'Notifikasi', exact: true });
  await indonesianNotifications.waitFor();
  await indonesianNotifications.getByText('Semua sudah dibaca', { exact: true }).waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'id');
  assert.equal(await page.locator('[data-legacy-i18n]').count(), 0);
  await assertNoHorizontalOverflow(page, 'Indonesian workspace mobile');
  assert.deepEqual(browserErrors, [], `Browser errors:\n${browserErrors.join('\n')}`);

  console.log('i18n browser check passed: Auth, Workspace, Settings, Notifications; EN/ID; desktop/390px');
  console.log(`screenshots: ${path.relative(root, screenshotDir)}`);
} finally {
  await browser?.close();
  await Promise.all([stopProcess(web), stopProcess(api)]);
  await rm(sandbox, { recursive: true, force: true });
}
