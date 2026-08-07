import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { config, productionConfigChecks } from '../server/src/config.js';
import { db } from '../server/src/db.js';
import { verifyProductionIntegrations } from '../server/src/integrations.js';

const checks = [];
function record(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
}

async function filesUnder(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = `${directory}/${entry.name}`;
    return entry.isDirectory() ? filesUnder(target) : [target];
  }));
  return nested.flat();
}

for (const check of productionConfigChecks()) record(check.name, check.ok, check.detail);

try {
  const quickCheck = db.prepare('PRAGMA quick_check').get();
  record('database integrity', quickCheck?.quick_check === 'ok', quickCheck?.quick_check || 'unknown');
} catch (error) {
  record('database integrity', false, error.message);
}

for (const [name, directory] of [['data directory', config.dataDir], ['upload directory', config.uploadDir], ['feature media directory', config.featureUpdateMediaDir]]) {
  try {
    await fs.mkdir(directory, { recursive: true });
    await fs.access(directory, fsConstants.R_OK | fsConstants.W_OK);
    record(name, true);
  } catch (error) {
    record(name, false, error.message);
  }
}

try {
  const bundleFiles = await filesUnder(config.staticClientDir);
  const backendSecrets = [
    config.naraRouterApiKey,
    config.googleClientSecret,
    config.jwtSecret,
    config.deviceSecret,
    config.tokenSecret,
    config.midtransServerKey,
    config.smtpPass,
  ].filter((value) => typeof value === 'string' && value.length >= 12);
  let leaked = false;
  for (const file of bundleFiles) {
    const content = await fs.readFile(file);
    if (backendSecrets.some((secret) => content.includes(Buffer.from(secret)))) {
      leaked = true;
      break;
    }
  }
  record('client bundle secret scan', !leaked, leaked ? 'Secret backend terdeteksi pada bundle client' : `${bundleFiles.length} file diperiksa`);
} catch (error) {
  record('client bundle secret scan', false, `Build client belum siap: ${error.code || error.message}`);
}

const integrations = await verifyProductionIntegrations();
record('NaraRouter credentials and model registry', integrations.naraRouter.ok, integrations.naraRouter.models?.map((item) => item.model || item).join(', '));
record('Google OIDC discovery', integrations.googleOidc.ok, integrations.googleOidc.code || integrations.googleOidc.redirectOrigin || '');

const failed = checks.filter((check) => !check.ok);
console.log(JSON.stringify({ ok: failed.length === 0, checks, integrations }, null, 2));
if (failed.length) process.exitCode = 1;
