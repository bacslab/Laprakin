import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { startE2eProvider } from './lib/e2e-provider.mjs';

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
    try { if ((await fetch(url)).ok) return; } catch { /* process is starting */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for local E2E API.\n${logs()}`);
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 5_000))]);
}

const root = path.resolve(import.meta.dirname, '..');
const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-e2e-local-'));
const provider = await startE2eProvider();
const apiPort = await availablePort();
const apiBase = `http://127.0.0.1:${apiPort}`;
let serverLogs = '';
const api = spawn(process.execPath, ['server/src/index.js'], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(apiPort),
    APP_URL: 'http://127.0.0.1:5173',
    API_URL: apiBase,
    ALLOWED_ORIGINS: 'http://127.0.0.1:5173',
    NARAROUTER_API_KEY: 'synthetic-e2e-key',
    NARAROUTER_BASE_URL: provider.baseUrl,
    AI_PROVIDER_ALLOWED_HOSTS: provider.host,
    AI_PROVIDER_ALLOWED_PORTS: String(provider.port),
    AI_ALLOW_TEST_LOOPBACK: 'true',
    NARAROUTER_MAX_RPM: '600',
    NARAROUTER_MAX_CONCURRENCY: '2',
    AI_MAX_RETRIES: '1',
    AI_REQUEST_TIMEOUT_MS: '1000',
    AI_CONNECT_TIMEOUT_MS: '1000',
    LAPRAKIN_DATA_DIR: path.join(sandbox, 'data'),
    LAPRAKIN_UPLOAD_DIR: path.join(sandbox, 'uploads'),
    LAPRAKIN_PUBLIC_MEDIA_DIR: path.join(sandbox, 'public-media'),
    EMAIL_MODE: 'console',
    MANUAL_EMAIL_AUTH_ONLY: 'true',
    JOB_POLL_MS: '100',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
api.stdout.on('data', (chunk) => { serverLogs += chunk; });
api.stderr.on('data', (chunk) => { serverLogs += chunk; });

try {
  await waitFor(`${apiBase}/api/health`, () => serverLogs);
  const e2e = spawn(process.execPath, ['scripts/e2e.mjs'], {
    cwd: root,
    env: { ...process.env, E2E_BASE_URL: apiBase },
    stdio: 'inherit',
  });
  const [exitCode] = await once(e2e, 'exit');
  if (exitCode !== 0) throw new Error(`Local API E2E exited with code ${exitCode}.\n${serverLogs}`);
  console.log(`Local API E2E harness passed with ${provider.requests.length} metadata-only synthetic provider requests.`);
} finally {
  await stop(api);
  await provider.close();
  await rm(sandbox, { recursive: true, force: true });
}
