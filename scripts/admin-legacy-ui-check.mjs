import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

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

const adminSnapshotSelectors = [
  '.admin-workspace', '.admin-sidebar', '.admin-main', '.admin-header', '.admin-content',
  '.admin-route-status', '.admin-list-controls', '.admin-privacy-note', '.admin-metric-grid',
  '.admin-panel', '.admin-panel-head', '.admin-list', '.admin-inline', '.admin-actions',
  '.admin-user-picker', '.admin-access-detail', '.admin-restriction-form', '.admin-broadcast-grid',
  '.admin-pricing-grid', '.cms-form', '.cms-copy-section', '.cms-media-card',
];

async function adminComputedSnapshot(page) {
  return page.evaluate((selectors) => Object.fromEntries(selectors.map((selector) => {
    const element = [...document.querySelectorAll(selector)].find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      const style = getComputedStyle(candidate);
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
    if (!element) return [selector, null];
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return [selector, {
      rect: [rect.x, rect.y, rect.width, rect.height].map((value) => Math.round(value * 100) / 100),
      display: style.display,
      position: style.position,
      gridTemplateColumns: style.gridTemplateColumns,
      gap: style.gap,
      padding: style.padding,
      borderRadius: style.borderRadius,
      backgroundColor: style.backgroundColor,
      color: style.color,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      overflow: style.overflow,
      maxHeight: style.maxHeight,
    }];
  })), adminSnapshotSelectors);
}

const root = path.resolve(import.meta.dirname, '..');
const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-admin-legacy-ui-'));
const apiPort = await availablePort();
const webPort = await availablePort();
const apiBase = `http://127.0.0.1:${apiPort}`;
const webBase = `http://127.0.0.1:${webPort}`;
const email = 'admin-legacy-ui@example.test';
const studentEmail = 'student-legacy-ui@example.test';
const studentRoomTitle = 'Browser-only private room title';
const studentRawMessage = 'Browser-only private conversation content';
const password = 'KataSandi-Uji-2026';
const screenshotDir = path.join(root, 'output', 'playwright', 'admin-legacy');
const baselinePath = path.join(root, 'client', 'test', 'visual-baselines', 'admin-legacy-computed.json');
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
  const studentRegistration = await fetch(`${apiBase}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-laprakin-device': 'student-legacy-ui' },
    body: JSON.stringify({ email: studentEmail, password }),
  });
  const studentRegistrationPayload = await studentRegistration.json();
  assert.equal(studentRegistration.status, 201, JSON.stringify(studentRegistrationPayload));
  const studentVerification = await fetch(`${apiBase}/api/auth/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-laprakin-device': 'student-legacy-ui' },
    body: JSON.stringify({ token: studentRegistrationPayload.developmentVerificationToken }),
  });
  assert.equal(studentVerification.ok, true, await studentVerification.text());
  const seedDb = new DatabaseSync(path.join(sandbox, 'data', 'laprakin.sqlite'));
  const insertUser = seedDb.prepare(`INSERT INTO users (id, email, password_hash, full_name, role, email_verified_at, created_at, updated_at) VALUES (?, ?, 'browser-test', ?, 'student', ?, ?, ?)`);
  for (let index = 0; index < 30; index += 1) {
    const createdAt = new Date(Date.UTC(2026, 8, 3, 0, 0, index)).toISOString();
    insertUser.run(randomUUID(), `pagination-${String(index).padStart(2, '0')}@example.test`, `Pagination ${index}`, createdAt, createdAt, createdAt);
  }
  const seededRoomId = `room-${randomUUID()}`;
  const seededAt = '2026-09-03T00:10:00.000Z';
  seedDb.prepare('INSERT INTO chat_sessions (id, owner_user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(seededRoomId, studentRegistrationPayload.user.id, studentRoomTitle, seededAt, seededAt);
  seedDb.prepare("INSERT INTO chat_messages (id, session_id, owner_user_id, role, content, created_at) VALUES (?, ?, ?, 'user', ?, ?)").run(`message-${randomUUID()}`, seededRoomId, studentRegistrationPayload.user.id, studentRawMessage, seededAt);
  seedDb.close();

  browser = await chromium.launch({ headless: true, executablePath: browserExecutable() });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const browserErrors = [];
  const apiRequests = [];
  const apiRequestTargets = [];
  page.on('pageerror', (error) => browserErrors.push(String(error)));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/admin/')) {
      apiRequests.push(url.pathname);
      apiRequestTargets.push(`${url.pathname}${url.search}`);
    }
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
    '/api/admin/pricing',
    '/api/admin/appeals',
    '/api/admin/broadcasts',
    '/api/admin/feature-updates',
    '/api/admin/capabilities',
  ];
  const routes = [
    ['/admin', ['/api/admin/overview'], 'Monitoring'],
    ['/admin/credits', ['/api/admin/users'], 'Kredit user'],
    ['/admin/pricing', ['/api/admin/pricing'], 'Harga & diskon'],
    ['/admin/alerts', ['/api/admin/alerts'], 'Error realtime'],
    ['/admin/integrations', ['/api/admin/ai/usage'], 'AI & Login'],
    ['/admin/updates', ['/api/admin/feature-updates'], 'Updates'],
    ['/admin/broadcasts', ['/api/admin/users', '/api/admin/broadcasts'], 'Email user'],
    ['/admin/feedback', ['/api/admin/feedback'], 'Feedback'],
    ['/admin/users', ['/api/admin/users', '/api/admin/capabilities'], 'Akses user'],
    ['/admin/appeals', ['/api/admin/appeals'], 'Appeal'],
    ['/admin/risk', ['/api/admin/overview'], 'Risk review'],
    ['/admin/cms', ['/api/admin/cms/landing'], 'Landing CMS'],
    ['/admin/audit', ['/api/admin/audit'], 'Audit log'],
    ['/admin/retention', [], 'Retensi'],
  ];
  const computedSnapshots = {};

  for (const [route, expectedEndpoints, heading] of routes) {
    apiRequests.length = 0;
    await page.goto(`${webBase}${route}`);
    await page.getByRole('heading', { name: heading, exact: true, level: 1 }).waitFor();
    await page.getByText(/Terakhir diperbarui:/).waitFor();
    const routeDataRequests = apiRequests.filter((requestPath) => dataEndpoints.some((endpoint) => requestPath === endpoint || requestPath.startsWith(`${endpoint}/`)));
    for (const expectedEndpoint of expectedEndpoints) assert.equal(routeDataRequests.some((requestPath) => requestPath === expectedEndpoint || requestPath.startsWith(`${expectedEndpoint}/`)), true, `${route} missed ${expectedEndpoint}:\n${apiRequests.join('\n')}`);
    const unrelated = routeDataRequests.filter((requestPath) => !expectedEndpoints.some((expectedEndpoint) => requestPath === expectedEndpoint || requestPath.startsWith(`${expectedEndpoint}/`)));
    assert.deepEqual(unrelated, [], `${route} requested unrelated Admin resources:\n${unrelated.join('\n')}`);
    computedSnapshots[route] = await adminComputedSnapshot(page);
  }

  if (process.env.UPDATE_ADMIN_BASELINES === '1') {
    await writeFile(baselinePath, `${JSON.stringify(computedSnapshots, null, 2)}\n`);
  } else {
    const expectedSnapshots = JSON.parse(await readFile(baselinePath, 'utf8'));
    assert.deepEqual(computedSnapshots, expectedSnapshots, 'Legacy Admin computed styles changed from the audited baseline.');
  }

  const studentQuery = studentRegistrationPayload.user.id.slice(0, 12);
  await page.goto(`${webBase}/admin/users?q=${encodeURIComponent(studentQuery)}&limit=25`);
  await page.getByLabel('Cari', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Cari', { exact: true }).inputValue(), studentQuery);
  const studentButton = page.locator('.admin-user-picker .admin-list>button').first();
  const studentRef = (await studentButton.locator('b').textContent()).trim();
  assert.match(studentRef, /^U-[A-F0-9]{8}$/);
  assert.equal((await page.locator('body').textContent()).includes(studentEmail), false, 'Ordinary Admin rendered a target email.');
  assert.equal(await page.getByRole('button', { name: 'Tampilkan identitas sementara' }).count(), 0, 'The admin role received a PII reveal control.');
  await studentButton.click();
  await page.waitForURL(`**/admin/users/${studentRegistrationPayload.user.id}?q=${studentQuery}&limit=25`);
  await page.reload();
  await page.getByText(studentRef, { exact: true }).first().waitFor();
  await page.getByText(/^R-[A-F0-9]{8}$/).waitFor();
  const privateBoundaryText = await page.locator('body').textContent();
  assert.equal(privateBoundaryText.includes(studentEmail), false, 'Ordinary Admin rendered a target email after deep-link reload.');
  assert.equal(privateBoundaryText.includes(studentRoomTitle), false, 'Ordinary Admin rendered a private room title.');
  assert.equal(privateBoundaryText.includes(studentRawMessage), false, 'Ordinary Admin rendered private chat content.');
  assert.equal(page.url().includes(`/admin/users/${studentRegistrationPayload.user.id}?q=${studentQuery}&limit=25`), true);

  const roleDb = new DatabaseSync(path.join(sandbox, 'data', 'laprakin.sqlite'));
  roleDb.exec('PRAGMA busy_timeout = 10000');
  roleDb.prepare("UPDATE users SET role = 'privacy_admin' WHERE id = ?").run(registrationPayload.user.id);
  roleDb.close();
  await page.reload();
  await page.getByRole('heading', { name: 'Akses break-glass', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Buka konten sementara' }).count(), 0, 'PII capability unexpectedly granted content access.');
  await page.getByLabel('Catatan akses', { exact: true }).fill('Investigasi tiket dukungan UI-1234.');
  await page.getByRole('button', { name: 'Tampilkan identitas sementara' }).click();
  await page.getByText(studentEmail, { exact: true }).waitFor();
  await page.getByText(/Akses berakhir dalam \d+ detik/).waitFor();
  await page.getByRole('button', { name: 'Tutup dan cabut' }).click();
  await page.getByText(studentEmail, { exact: true }).waitFor({ state: 'detached', timeout: 5000 });

  const contentRoleDb = new DatabaseSync(path.join(sandbox, 'data', 'laprakin.sqlite'));
  contentRoleDb.exec('PRAGMA busy_timeout = 10000');
  contentRoleDb.prepare("UPDATE users SET role = 'content_forensics_admin' WHERE id = ?").run(registrationPayload.user.id);
  contentRoleDb.close();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.getByRole('heading', { name: 'Akses break-glass', exact: true }).waitFor({ timeout: 5000 });
  assert.equal(await page.getByRole('button', { name: 'Tampilkan identitas sementara' }).count(), 0, 'Content capability unexpectedly granted PII access.');
  await page.getByLabel('Catatan akses', { exact: true }).fill('Investigasi insiden keamanan UI-5678.');
  await page.getByRole('button', { name: 'Buka konten sementara' }).click();
  await page.getByText(studentRoomTitle, { exact: true }).waitFor();
  await page.getByText(studentRawMessage, { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Tutup dan cabut' }).click();
  await page.getByText(studentRoomTitle, { exact: true }).waitFor({ state: 'detached', timeout: 5000 });
  const restoreRoleDb = new DatabaseSync(path.join(sandbox, 'data', 'laprakin.sqlite'));
  restoreRoleDb.exec('PRAGMA busy_timeout = 10000');
  restoreRoleDb.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(registrationPayload.user.id);
  restoreRoleDb.close();

  await page.goto(`${webBase}/admin/users?limit=10`);
  await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
  await page.waitForURL('**/admin/users?cursor=10&limit=10');
  await page.getByText('Halaman 2', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Sebelumnya', exact: true }).click();
  await page.waitForURL('**/admin/users?cursor=0&limit=10');
  await page.reload();
  assert.equal(await page.getByLabel('Cari', { exact: true }).inputValue(), '');

  apiRequestTargets.length = 0;
  await page.goto(`${webBase}/admin/alerts?q=CONTRACT&status=open&limit=10`);
  await page.getByText(/Terakhir diperbarui:/).waitFor();
  assert.equal(await page.getByLabel('Cari', { exact: true }).inputValue(), 'CONTRACT');
  assert.equal(await page.getByLabel('Status', { exact: true }).inputValue(), 'open');
  assert.equal(apiRequestTargets.some((target) => target.includes('/api/admin/alerts?') && target.includes('q=CONTRACT') && target.includes('status=open') && target.includes('limit=10')), true, apiRequestTargets.join('\n'));
  await page.reload();
  assert.equal(await page.getByLabel('Status', { exact: true }).inputValue(), 'open');

  const errorCountBeforeRenderProof = browserErrors.length;
  let malformedOverviewOnce = true;
  await page.route(`${apiBase}/api/admin/overview*`, async (route) => {
    if (malformedOverviewOnce) {
      malformedOverviewOnce = false;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.continue();
  });
  await page.goto(`${webBase}/admin`);
  await page.getByText('Bagian ini mengalami masalah tampilan', { exact: true }).waitFor();
  assert.equal(await page.locator('.admin-sidebar').isVisible(), true, 'The Admin shell disappeared during a render failure.');
  await page.getByRole('button', { name: 'Coba muat ulang' }).click();
  await page.getByText(/Terakhir diperbarui:/).waitFor();
  const expectedRenderErrors = browserErrors.splice(errorCountBeforeRenderProof);
  assert.equal(expectedRenderErrors.length >= 1, true, 'The malformed route did not surface a render error.');
  assert.equal(expectedRenderErrors.every((message) => message.includes("reading 'users'")), true, expectedRenderErrors.join('\n'));

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
  console.log(`Legacy Admin UI passed: fourteen isolated direct routes, URL-backed user deep link, route render/data failure recovery, persistent shell, freshness, desktop, and 390px mobile. Screenshots: ${screenshotDir}`);
} finally {
  await browser?.close().catch(() => {});
  await Promise.all([stopProcess(apiProcess), stopProcess(webProcess)]);
  await rm(sandbox, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
}
