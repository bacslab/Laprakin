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
  await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 5_000))]);
}

async function assertNoHorizontalOverflow(page, surface) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.equal(overflow, 0, `${surface} has ${overflow}px horizontal overflow`);
}

const root = path.resolve(import.meta.dirname, '..');
const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-public-ui-'));
const apiPort = await availablePort();
const webPort = await availablePort();
const apiBase = `http://127.0.0.1:${apiPort}`;
const webBase = `http://127.0.0.1:${webPort}`;
const screenshotDir = path.join(root, 'output', 'playwright', 'public-pages');
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => localStorage.setItem('laprakin-preferences', JSON.stringify({ language: 'en', theme: 'light' })));
  const page = await context.newPage();
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${String(error)}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/^Failed to load resource: the server responded with a status of 401/.test(message.text())) {
      browserErrors.push(`console: ${message.text()}`);
    }
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    const url = new URL(response.url());
    if (response.status() === 401 && url.pathname === '/api/auth/me') return;
    browserErrors.push(`response: ${response.status()} ${url.pathname}`);
  });

  await page.goto(`${webBase}/pricing`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Choose the plan that fits.', exact: true }).waitFor();
  assert.equal(await page.locator('.pricing-compact-card').count(), 4);
  assert.equal(await page.locator('[class*="public-pricing-"], [class*="landing-"], [class*="hero-"], [class*="compare-"]').count(), 0);
  await assertNoHorizontalOverflow(page, 'Pricing desktop');
  await page.screenshot({ path: path.join(screenshotDir, 'pricing-desktop.png'), fullPage: true });

  await page.getByRole('button', { name: 'Choose Pro', exact: true }).click();
  await page.waitForURL('**/auth?next=*');
  assert.match(new URL(page.url()).searchParams.get('next') || '', /^\/checkout\?plan=monthly$/);
  await page.getByRole('heading', { name: 'Log in', exact: true }).waitFor();
  const authTypography = await page.locator('.auth-card').evaluate((card) => {
    const style = (selector) => getComputedStyle(card.querySelector(selector));
    return {
      heading: parseFloat(style('h1').fontSize),
      description: parseFloat(style('.auth-card-heading > p').fontSize),
      label: parseFloat(style('.auth-form label').fontSize),
      input: parseFloat(style('.auth-form input').fontSize),
      submit: parseFloat(style('.auth-submit').fontSize),
    };
  });
  assert.ok(authTypography.heading >= 20 && authTypography.heading <= 22, `Auth heading scale drifted: ${JSON.stringify(authTypography)}`);
  assert.ok(authTypography.description >= 10 && authTypography.description <= 12, `Auth description scale drifted: ${JSON.stringify(authTypography)}`);
  assert.ok(authTypography.label >= 9.5 && authTypography.label <= 11, `Auth label scale drifted: ${JSON.stringify(authTypography)}`);
  assert.ok(authTypography.input >= 10.5 && authTypography.input <= 12, `Auth input scale drifted: ${JSON.stringify(authTypography)}`);
  assert.ok(authTypography.submit >= 10.5 && authTypography.submit <= 12, `Auth submit scale drifted: ${JSON.stringify(authTypography)}`);
  await assertNoHorizontalOverflow(page, 'Auth desktop');
  await page.screenshot({ path: path.join(screenshotDir, 'auth-desktop.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${webBase}/auth`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Log in', exact: true }).waitFor();
  await assertNoHorizontalOverflow(page, 'Auth mobile');
  await page.screenshot({ path: path.join(screenshotDir, 'auth-mobile.png'), fullPage: true });
  await page.goto(`${webBase}/pricing`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Choose the plan that fits.', exact: true }).waitFor();
  assert.equal(await page.locator('.pricing-compact-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns), '362px');
  await assertNoHorizontalOverflow(page, 'Pricing mobile');
  await page.screenshot({ path: path.join(screenshotDir, 'pricing-mobile.png'), fullPage: true });
  assert.deepEqual(browserErrors, [], `Browser errors:\n${browserErrors.join('\n')}`);

  console.log('Public pages UI passed: Pricing desktop/390px, four live cards, Auth handoff, no retired public classes, and no horizontal overflow.');
  console.log(`screenshots: ${path.relative(root, screenshotDir)}`);
} finally {
  await browser?.close();
  await Promise.all([stopProcess(web), stopProcess(api)]);
  await rm(sandbox, { recursive: true, force: true });
}
