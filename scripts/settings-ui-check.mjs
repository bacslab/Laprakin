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

function rgb(value) {
  const channels = String(value).match(/[\d.]+/g)?.slice(0, 3).map(Number);
  assert.equal(channels?.length, 3, `Expected an RGB color, received ${value}`);
  return channels;
}

function luminance(value) {
  const channels = rgb(value).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

function durationSeconds(value) {
  return Math.max(...String(value).split(',').map((part) => {
    const item = part.trim();
    if (item.endsWith('ms')) return Number.parseFloat(item) / 1000;
    if (item.endsWith('s')) return Number.parseFloat(item);
    return 0;
  }));
}

async function settingsSnapshot(page) {
  return page.locator('.settings-modal').evaluate((modal) => {
    const workspace = document.querySelector('.workspace');
    const side = modal.querySelector('.settings-side');
    const content = modal.querySelector('.settings-content');
    const heading = modal.querySelector('.settings-pane-header h2');
    const description = modal.querySelector('.settings-pane-header p');
    const workspaceStyle = getComputedStyle(workspace);
    const modalStyle = getComputedStyle(modal);
    const contentStyle = getComputedStyle(content);
    return {
      bodyTheme: document.body.dataset.laprakinTheme,
      themeDark: workspace.classList.contains('theme-dark'),
      contrast: workspace.dataset.contrast,
      motion: workspace.dataset.motion,
      workspaceBackground: workspaceStyle.backgroundColor,
      modalBackground: modalStyle.backgroundColor,
      sideBackground: getComputedStyle(side).backgroundColor,
      contentBackground: contentStyle.backgroundColor,
      headingColor: getComputedStyle(heading).color,
      descriptionColor: getComputedStyle(description).color,
      colorScheme: modalStyle.colorScheme,
      lineToken: workspaceStyle.getPropertyValue('--workspace-line').trim(),
      mutedToken: workspaceStyle.getPropertyValue('--workspace-muted').trim(),
      modalTransition: modalStyle.transitionDuration,
      contentTransition: contentStyle.transitionDuration,
    };
  });
}

async function assertTheme(page, expected, label) {
  await page.waitForFunction((theme) => document.body.dataset.laprakinTheme === theme, expected);
  const state = await settingsSnapshot(page);
  assert.equal(state.bodyTheme, expected, `${label}: body theme`);
  assert.equal(state.themeDark, expected === 'dark', `${label}: workspace theme class`);
  assert.equal(state.colorScheme, expected, `${label}: settings color-scheme`);
  for (const [surface, color] of Object.entries({ modal: state.modalBackground, side: state.sideBackground, content: state.contentBackground })) {
    const value = luminance(color);
    assert.ok(expected === 'dark' ? value < 0.12 : value > 0.70, `${label}: ${surface} luminance ${value} (${color})`);
  }
  assert.ok(contrast(state.headingColor, state.contentBackground) >= 4.5, `${label}: heading contrast`);
  assert.ok(contrast(state.descriptionColor, state.contentBackground) >= 4.5, `${label}: description contrast`);
  return state;
}

async function assertNoHorizontalOverflow(page, surface) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.equal(overflow, 0, `${surface} has ${overflow}px horizontal overflow`);
}

const root = path.resolve(import.meta.dirname, '..');
const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-settings-ui-'));
const apiPort = await availablePort();
const webPort = await availablePort();
const apiBase = `http://127.0.0.1:${apiPort}`;
const webBase = `http://127.0.0.1:${webPort}`;
const email = `settings-ui-${Date.now()}@example.test`;
const password = 'KataSandi-Uji-2026';
const screenshotDir = path.join(root, 'output', 'playwright', 'settings');
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
  await Promise.all([waitFor(`${apiBase}/api/health`, () => serverLogs), waitFor(webBase, () => webLogs)]);
  browser = await chromium.launch({ headless: true, executablePath: browserExecutable() });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', reducedMotion: 'no-preference' });
  await context.addInitScript(() => {
    if (!localStorage.getItem('laprakin-preferences')) {
      localStorage.setItem('laprakin-preferences', JSON.stringify({ language: 'en', theme: 'system', contrast: 'default', reducedMotion: false, compact: false }));
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

  await page.goto(`${webBase}/auth`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click();
  await page.getByRole('button', { name: 'Verify now', exact: true }).click();
  await page.waitForURL('**/app');
  authenticated = true;
  const closeTutorial = page.getByRole('button', { name: 'Close tutorial', exact: true });
  await closeTutorial.waitFor();
  await closeTutorial.click();
  await page.locator('.tutorial-overlay').waitFor({ state: 'detached' });

  const settingsTrigger = page.getByRole('button', { name: 'Settings', exact: true });
  await settingsTrigger.focus();
  await settingsTrigger.click();
  const settingsDialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await settingsDialog.waitFor();
  assert.equal(await settingsDialog.evaluate((dialog) => dialog.contains(document.activeElement)), true, 'Settings must move initial focus inside the dialog');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Close settings', 'Settings must focus its first visible control');
  await page.keyboard.press('Escape');
  await settingsDialog.waitFor({ state: 'detached' });
  assert.equal(await settingsTrigger.evaluate((button) => button === document.activeElement), true, 'Settings must return focus to its trigger');
  await settingsTrigger.click();

  await assertTheme(page, 'dark', 'system dark');
  await page.screenshot({ path: path.join(screenshotDir, 'settings-dark.png'), fullPage: true });
  await page.getByRole('radio', { name: 'Light theme', exact: true }).click();
  await assertTheme(page, 'light', 'forced light under dark OS');
  await page.screenshot({ path: path.join(screenshotDir, 'settings-light.png'), fullPage: true });
  await page.getByRole('radio', { name: 'Dark theme', exact: true }).click();
  await assertTheme(page, 'dark', 'forced dark');
  await page.getByRole('radio', { name: 'Follow system', exact: true }).click();
  await assertTheme(page, 'dark', 'system follows dark OS');
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  const defaultContrast = await assertTheme(page, 'light', 'system follows live light OS');

  await page.getByRole('button', { name: 'Contrast', exact: true }).click();
  await page.getByRole('option', { name: 'High', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.workspace')?.dataset.contrast === 'high');
  const highContrast = await settingsSnapshot(page);
  assert.notEqual(highContrast.lineToken, defaultContrast.lineToken, 'High contrast must change the line token');
  assert.notEqual(highContrast.mutedToken, defaultContrast.mutedToken, 'High contrast must change the muted token');
  assert.ok(contrast(highContrast.descriptionColor, highContrast.contentBackground) >= 7, 'High-contrast description must reach 7:1');

  await page.getByRole('button', { name: 'Keyboard', exact: true }).click();
  await page.getByRole('heading', { name: 'Interaction and motion', exact: true }).waitFor();
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('.workspace')?.dataset.motion === 'reduce');
  let motion = await settingsSnapshot(page);
  assert.ok(durationSeconds(motion.modalTransition) <= 0.001 && durationSeconds(motion.contentTransition) <= 0.001, 'System reduced motion must suppress Settings transitions');
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await page.waitForFunction(() => document.querySelector('.workspace')?.dataset.motion === 'full');
  await page.getByText('Reduce motion', { exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.workspace')?.dataset.motion === 'reduce');
  motion = await settingsSnapshot(page);
  assert.ok(durationSeconds(motion.modalTransition) <= 0.001 && durationSeconds(motion.contentTransition) <= 0.001, 'User reduced motion must suppress Settings transitions');

  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const workspace = document.querySelector('.workspace');
    return workspace?.dataset.contrast === 'high' && workspace?.dataset.motion === 'reduce';
  });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('heading', { name: 'Workspace appearance', exact: true }).waitFor();
  await assertTheme(page, 'light', 'persisted system-light mobile');
  assert.equal((await settingsSnapshot(page)).contrast, 'high');
  assert.equal((await settingsSnapshot(page)).motion, 'reduce');
  await assertNoHorizontalOverflow(page, 'Settings 390px high contrast');
  await page.screenshot({ path: path.join(screenshotDir, 'settings-mobile-high-contrast.png'), fullPage: true });
  assert.deepEqual(browserErrors, [], `Browser errors:\n${browserErrors.join('\n')}`);

  console.log('settings browser check passed: system/light/dark, high contrast, reduced motion, focus, persistence, 390px');
  console.log(`screenshots: ${path.relative(root, screenshotDir)}`);
} finally {
  await browser?.close();
  await Promise.all([stopProcess(web), stopProcess(api)]);
  await rm(sandbox, { recursive: true, force: true });
}
