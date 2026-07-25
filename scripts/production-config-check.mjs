import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const productionEnv = {
  ...process.env,
  NODE_ENV: 'production',
  APP_URL: 'https://app.example.test',
  API_URL: 'https://app.example.test',
  ALLOWED_ORIGINS: 'https://app.example.test',
  TRUST_PROXY_HOPS: '1',
  JWT_SECRET: 'jwt-secret-production-contract-0000000001',
  DEVICE_HMAC_SECRET: 'device-secret-production-contract-000002',
  TOKEN_HMAC_SECRET: 'token-secret-production-contract-0000003',
  ADMIN_EMAIL: 'admin@example.test',
  EMAIL_MODE: 'smtp',
  MAIL_FROM: 'Laprakin <noreply@example.test>',
  SMTP_HOST: 'smtp.example.test',
  SMTP_USER: 'smtp-user',
  SMTP_PASS: 'smtp-password',
  AI_REQUIRED: 'true',
  GEMINI_API_KEY: 'AIzaProductionContractKey_123456789012345',
  MANUAL_EMAIL_AUTH_ONLY: 'false',
  GOOGLE_OAUTH_REQUIRED: 'true',
  GOOGLE_OAUTH_CLIENT_ID: 'contract.apps.googleusercontent.com',
  GOOGLE_OAUTH_CLIENT_SECRET: 'contract-secret',
  GOOGLE_OAUTH_REDIRECT_URI: 'https://app.example.test/api/auth/google/callback',
  PAYMENTS_MODE: 'midtrans',
  MIDTRANS_ENVIRONMENT: 'production',
  MIDTRANS_IS_PRODUCTION: 'true',
  MIDTRANS_SERVER_KEY: 'Mid-server-contract',
  MIDTRANS_CLIENT_KEY: 'Mid-client-contract',
};

const code = `
  const { productionConfigChecks, validateProductionConfig } = await import('./server/src/config.js');
  const checks = productionConfigChecks();
  validateProductionConfig();
  process.stdout.write(JSON.stringify(checks));
`;
const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
  cwd: process.cwd(),
  env: productionEnv,
  encoding: 'utf8',
});

assert.equal(result.status, 0, result.stderr || result.stdout);
const checks = JSON.parse(result.stdout);
assert.ok(checks.length >= 12);
assert.ok(checks.every((check) => check.ok), checks.filter((check) => !check.ok).map((check) => check.name).join(', '));
console.log(`Production config contract passed: ${checks.length} mandatory checks`);
