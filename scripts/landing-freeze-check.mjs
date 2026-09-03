import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const captureBaseline = process.argv.includes('--capture-baseline');
const root = path.resolve(import.meta.dirname, '..');
const baselineDir = path.join(root, 'client', 'test', 'visual-baselines');
const outputDir = path.join(root, 'output', 'playwright', 'landing-freeze');
const viewports = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
};

function browserExecutable() {
  const candidates = [
    process.env.LAPRAKIN_BROWSER_EXECUTABLE,
    process.platform === 'win32' ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : '',
    process.platform === 'win32' ? 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe' : '',
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
    try { if ((await fetch(url)).ok) return; } catch { /* Vite is starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${url}\n${logs()}`);
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 5_000))]);
}

async function capture(page, url, screenshotPath, preferences) {
  await page.addInitScript((prefs) => {
    localStorage.setItem('laprakin-preferences', JSON.stringify(prefs));
  }, preferences);
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Unauthorized' } }) }));
  await page.route('**/api/public/landing', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ media: {}, copy: {} }) }));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('.fg-page').waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);

  const metrics = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('.fg-gradient-button')];
    const root = getComputedStyle(document.querySelector('.fg-page'));
    return {
      page: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        lime: root.getPropertyValue('--fg-lime').trim(),
        mint: root.getPropertyValue('--fg-mint').trim(),
      },
      ctas: buttons.map((button) => {
        const span = button.querySelector('span');
        const buttonStyle = getComputedStyle(button);
        const spanStyle = getComputedStyle(span);
        const bounds = button.getBoundingClientRect();
        return {
          buttonFamily: buttonStyle.fontFamily,
          spanFamily: spanStyle.fontFamily,
          buttonWeight: buttonStyle.fontWeight,
          spanWeight: spanStyle.fontWeight,
          bounds: {
            x: Math.floor(bounds.left + window.scrollX),
            y: Math.floor(bounds.top + window.scrollY),
            width: Math.ceil(bounds.width),
            height: Math.ceil(bounds.height),
          },
        };
      }),
    };
  });
  assert.equal(metrics.ctas.length, 2, 'Expected hero and final CTA');
  assert.equal(metrics.page.overflow, 0, 'Landing must not overflow horizontally');
  await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });
  return metrics;
}

function loadPng(file) {
  return PNG.sync.read(readFileSync(file));
}

function maskedPixelDiff(beforePath, afterPath, beforeBoxes, afterBoxes, diffPath) {
  const before = loadPng(beforePath);
  const after = loadPng(afterPath);
  assert.equal(after.width, before.width, 'Screenshot widths differ');
  assert.equal(after.height, before.height, 'Screenshot heights differ');
  const mask = new Uint8Array(before.width * before.height);
  for (const box of [...beforeBoxes, ...afterBoxes]) {
    const left = Math.max(0, box.x - 2);
    const top = Math.max(0, box.y - 2);
    const right = Math.min(before.width, box.x + box.width + 2);
    const bottom = Math.min(before.height, box.y + box.height + 2);
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) mask[(y * before.width) + x] = 1;
    }
  }
  const maskedBefore = Buffer.from(before.data);
  const maskedAfter = Buffer.from(after.data);
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index]) continue;
    const offset = index * 4;
    maskedBefore.fill(0, offset, offset + 4);
    maskedAfter.fill(0, offset, offset + 4);
  }
  const diff = new PNG({ width: before.width, height: before.height });
  const changed = pixelmatch(maskedBefore, maskedAfter, diff.data, before.width, before.height, { threshold: 0 });
  return writeFile(diffPath, PNG.sync.write(diff)).then(() => changed);
}

function exactPixelDiff(leftPath, rightPath) {
  const left = loadPng(leftPath);
  const right = loadPng(rightPath);
  assert.equal(right.width, left.width);
  assert.equal(right.height, left.height);
  return pixelmatch(left.data, right.data, null, left.width, left.height, { threshold: 0 });
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

await mkdir(baselineDir, { recursive: true });
await mkdir(outputDir, { recursive: true });
const webPort = await availablePort();
const webBase = `http://127.0.0.1:${webPort}`;
let webLogs = '';
const web = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], {
  cwd: path.join(root, 'client'),
  env: { ...process.env, VITE_API_URL: '/api' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
web.stdout.on('data', (chunk) => { webLogs += chunk; });
web.stderr.on('data', (chunk) => { webLogs += chunk; });

try {
  await waitFor(webBase, () => webLogs);
  const browser = await chromium.launch({
    headless: true,
    executablePath: browserExecutable(),
    args: ['--disable-gpu', '--force-color-profile=srgb'],
  });
  const results = {};
  try {
    for (const [name, viewport] of Object.entries(viewports)) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce', colorScheme: 'light', deviceScaleFactor: 1 });
      const page = await context.newPage();
      const currentPath = captureBaseline
        ? path.join(baselineDir, `landing-${name}.png`)
        : path.join(outputDir, `landing-${name}-after.png`);
      const metrics = await capture(page, webBase, currentPath, { theme: 'system', accent: 'lime', language: 'id' });

      if (captureBaseline) {
        await writeFile(path.join(baselineDir, `landing-${name}.json`), `${JSON.stringify(metrics, null, 2)}\n`);
        results[name] = { baseline: currentPath, sha256: sha256(currentPath), metrics };
      } else {
        for (const cta of metrics.ctas) {
          assert.match(cta.buttonFamily, /^"?Plus Jakarta Sans Variable"?/i);
          assert.match(cta.spanFamily, /^"?Plus Jakarta Sans Variable"?/i);
          assert.ok(Number.parseInt(cta.buttonWeight, 10) >= 700, cta);
          assert.equal(cta.spanWeight, cta.buttonWeight, cta);
        }
        assert.equal(await page.evaluate(() => document.fonts.check('700 24px "Plus Jakarta Sans Variable"')), true);
        assert.equal(metrics.page.lime.toLowerCase(), '#c2ff33');
        assert.equal(metrics.page.mint.toLowerCase(), '#45ffa2');
        const baselinePath = path.join(baselineDir, `landing-${name}.png`);
        const baselineMetrics = JSON.parse(readFileSync(path.join(baselineDir, `landing-${name}.json`), 'utf8'));
        const changedOutsideCtas = await maskedPixelDiff(
          baselinePath,
          currentPath,
          baselineMetrics.ctas.map((cta) => cta.bounds),
          metrics.ctas.map((cta) => cta.bounds),
          path.join(outputDir, `landing-${name}-diff.png`),
        );
        assert.equal(changedOutsideCtas, 0, `${name}: pixels changed outside CTA rectangles`);

        const preferenceContext = await browser.newContext({ viewport, reducedMotion: 'reduce', colorScheme: 'dark', deviceScaleFactor: 1 });
        const preferencePage = await preferenceContext.newPage();
        const preferencePath = path.join(outputDir, `landing-${name}-workspace-preferences.png`);
        const preferenceMetrics = await capture(preferencePage, webBase, preferencePath, { theme: 'dark', accent: 'blue', language: 'id' });
        assert.equal(preferenceMetrics.page.lime.toLowerCase(), '#c2ff33');
        assert.equal(preferenceMetrics.page.mint.toLowerCase(), '#45ffa2');
        const preferenceChanges = exactPixelDiff(currentPath, preferencePath);
        assert.equal(preferenceChanges, 0, `${name}: workspace theme/accent changed Landing pixels`);
        await preferenceContext.close();
        results[name] = { current: currentPath, sha256: sha256(currentPath), changedOutsideCtas, preferenceChanges, metrics };
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  const metricsPath = path.join(outputDir, captureBaseline ? 'baseline-capture.json' : 'verification.json');
  await writeFile(metricsPath, `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify({ mode: captureBaseline ? 'baseline' : 'verify', results }, null, 2));
} finally {
  await stopProcess(web);
}
