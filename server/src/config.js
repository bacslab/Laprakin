import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const environmentDirectory = path.resolve(directory, '..');
const inheritedEnvironment = new Set(Object.keys(process.env));
const runtimeEnvironment = process.env.NODE_ENV === 'production' ? 'production' : 'development';

function loadEnvironmentFile(filename, protectedKeys = null) {
  const filePath = path.join(environmentDirectory, filename);
  if (!fs.existsSync(filePath)) return;
  const parsed = dotenv.parse(fs.readFileSync(filePath));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) process.env[key] = value;
    if (protectedKeys) protectedKeys.add(key);
  }
}

if (runtimeEnvironment === 'production') {
  loadEnvironmentFile('.env.production.local');
  loadEnvironmentFile('.env.local');
  loadEnvironmentFile('.env.production');
  loadEnvironmentFile('.env');
} else {
  const developmentKeys = new Set(inheritedEnvironment);
  loadEnvironmentFile('.env.development.local', developmentKeys);
  loadEnvironmentFile('.env.local', developmentKeys);
  loadEnvironmentFile('.env.development', developmentKeys);

  const productionLocalPath = path.join(environmentDirectory, '.env.production.local');
  if (fs.existsSync(productionLocalPath)) {
    const productionLocal = dotenv.parse(fs.readFileSync(productionLocalPath));
    for (const [key, value] of Object.entries(productionLocal)) {
      if (/^GEMINI_(?:API_KEY|MODEL(?:_.+)?)$/.test(key) && !developmentKeys.has(key)) {
        process.env[key] = value;
        developmentKeys.add(key);
      }
    }
  }

  loadEnvironmentFile('.env');

  for (const key of ['NODE_ENV', 'PORT', 'SERVE_STATIC', 'APP_URL', 'API_URL', 'ALLOWED_ORIGINS', 'TRUST_PROXY_HOPS', 'AI_REQUIRED']) {
    if (!developmentKeys.has(key)) delete process.env[key];
  }
}

const nodeEnv = runtimeEnvironment;
const publicMediaDir = path.resolve(process.env.LAPRAKIN_PUBLIC_MEDIA_DIR || path.resolve(directory, '../public-media'));
const manualEmailAuthOnly = process.env.MANUAL_EMAIL_AUTH_ONLY
  ? process.env.MANUAL_EMAIL_AUTH_ONLY !== 'false'
  : nodeEnv === 'production';

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function boundedInt(value, fallback, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, positiveInt(value, fallback)));
}

function csv(value = '') {
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

export const config = {
  port: positiveInt(process.env.PORT, 4000),
  nodeEnv,
  isProd: nodeEnv === 'production',
  // APP_URL/API_URL are canonical; FRONTEND_URL/BACKEND_URL are supported aliases for split deployments.
  appUrl: process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173',
  apiUrl: process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:4000',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  deviceSecret: process.env.DEVICE_HMAC_SECRET || 'dev-device-secret-change-me',
  tokenSecret: process.env.TOKEN_HMAC_SECRET || process.env.JWT_SECRET || 'dev-token-secret-change-me',
  adminEmail: (process.env.ADMIN_EMAIL || 'hilmimubarok2006@gmail.com').trim().toLowerCase(),
  geminiKey: process.env.GEMINI_API_KEY || '',
  geminiKeyValid: /^AIza[0-9A-Za-z_-]{20,}$/.test(process.env.GEMINI_API_KEY || ''),
  geminiModel: process.env.GEMINI_MODEL || process.env.GEMINI_MODEL_BASIC || 'gemini-3.5-flash-lite',
  geminiModelBasic: process.env.GEMINI_MODEL_BASIC || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  geminiModelThinking: process.env.GEMINI_MODEL_THINKING || 'gemini-3.6-flash',
  geminiModelXtraThink: process.env.GEMINI_MODEL_XTRATHINK || 'gemini-3.6-flash',
  geminiModelDocument: process.env.GEMINI_MODEL_DOCUMENT || 'gemini-3.6-flash',
  geminiModelSupport: process.env.GEMINI_MODEL_SUPPORT || 'gemini-3.5-flash-lite',
  aiRequired: process.env.AI_REQUIRED ? process.env.AI_REQUIRED !== 'false' : nodeEnv === 'production',
  aiRequestTimeoutMs: boundedInt(process.env.AI_REQUEST_TIMEOUT_MS, 45000, 5000, 120000),
  aiMaxRetries: boundedInt(process.env.AI_MAX_RETRIES, 2, 1, 4),
  aiMaxRequestsPerHour: boundedInt(process.env.AI_MAX_REQUESTS_PER_HOUR, 60, 5, 500),
  aiMaxRequestsPerDay: boundedInt(process.env.AI_MAX_REQUESTS_PER_DAY, 5000, 100, 100000),
  aiContextCharacters: boundedInt(process.env.AI_CONTEXT_CHARACTERS, 24000, 4000, 80000),
  aiAttachmentCharacters: boundedInt(process.env.AI_ATTACHMENT_CHARACTERS, 18000, 2000, 60000),
  referralHoldDays: Math.max(0, Number(process.env.REFERRAL_HOLD_DAYS ?? 7)),
  paymentsMode: process.env.PAYMENTS_MODE || 'manual',
  // MIDTRANS_ENVIRONMENT is canonical; MIDTRANS_IS_PRODUCTION is accepted for deployment compatibility.
  midtransEnvironment: (process.env.MIDTRANS_ENVIRONMENT === 'production' || process.env.MIDTRANS_IS_PRODUCTION === 'true') ? 'production' : 'sandbox',
  midtransServerKey: process.env.MIDTRANS_SERVER_KEY || '',
  midtransClientKey: process.env.MIDTRANS_CLIENT_KEY || '',
  // QRIS-only Snap checkout. `other_qris` is configured server-side in payments.js.
  midtransVerifyStatus: process.env.MIDTRANS_VERIFY_STATUS !== 'false',
  maxUploadBytes: positiveInt(process.env.MAX_UPLOAD_MB, 20) * 1024 * 1024,
  maxFilesPerUpload: positiveInt(process.env.MAX_FILES_PER_UPLOAD, 12),
  maxFilesPerDocument: positiveInt(process.env.MAX_FILES_PER_DOCUMENT, 40),
  // Persistent session: diperpanjang saat user aktif, tetap dapat dicabut lewat logout/reset password.
  sessionDays: positiveInt(process.env.SESSION_DAYS, 30),
  trustProxyHops: Math.max(0, Math.min(5, Number(process.env.TRUST_PROXY_HOPS || 0) || 0)),
  jobPollMs: positiveInt(process.env.JOB_POLL_MS, 750),
  jobMaxAttempts: positiveInt(process.env.JOB_MAX_ATTEMPTS, 2),
  jobStaleMinutes: positiveInt(process.env.JOB_STALE_MINUTES, 15),
  cleanupIntervalHours: positiveInt(process.env.CLEANUP_INTERVAL_HOURS, 24),
  retentionSweepMinutes: positiveInt(process.env.RETENTION_SWEEP_MINUTES, 60),
  emailMode: process.env.EMAIL_MODE || 'console',
  mailFrom: process.env.MAIL_FROM || 'Laprakin <noreply@localhost>',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: positiveInt(process.env.SMTP_PORT, 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  googleClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI || `${process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:4000'}/api/auth/google/callback`,
  manualEmailAuthOnly,
  googleOauthRequired: !manualEmailAuthOnly && (process.env.GOOGLE_OAUTH_REQUIRED ? process.env.GOOGLE_OAUTH_REQUIRED !== 'false' : false),
  googleRequestTimeoutMs: boundedInt(process.env.GOOGLE_REQUEST_TIMEOUT_MS, 10000, 3000, 30000),
  supportAiEnabled: process.env.SUPPORT_AI_ENABLED !== 'false',
  supportMaxMessagesPerHour: positiveInt(process.env.SUPPORT_MAX_MESSAGES_PER_HOUR, 30),
  allowedOrigins: csv(process.env.ALLOWED_ORIGINS || process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173'),
  serveStatic: process.env.SERVE_STATIC === 'true',
  staticClientDir: path.resolve(directory, '../../client/dist'),
  dataDir: path.resolve(process.env.LAPRAKIN_DATA_DIR || path.resolve(directory, '../data')),
  uploadDir: path.resolve(process.env.LAPRAKIN_UPLOAD_DIR || path.resolve(directory, '../uploads')),
  azureStorageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
  azureBlobContainerName: process.env.AZURE_BLOB_CONTAINER_NAME || 'user-documents',
  publicMediaDir,
  landingMediaDir: path.join(publicMediaDir, 'landing'),
  featureUpdateMediaDir: path.join(publicMediaDir, 'feature-updates'),
  emailMediaDir: path.join(publicMediaDir, 'email'),
};

function productionUrl(value) {
  try {
    const url = new URL(value);
    return { url, valid: url.protocol === 'https:' };
  } catch {
    return { url: null, valid: false };
  }
}

export function productionConfigChecks() {
  const app = productionUrl(config.appUrl);
  const api = productionUrl(config.apiUrl);
  const redirect = productionUrl(config.googleRedirectUri);
  const secretValues = [process.env.JWT_SECRET, process.env.DEVICE_HMAC_SECRET, process.env.TOKEN_HMAC_SECRET];
  const secretsReady = secretValues.every((value) => typeof value === 'string' && value.length >= 32)
    && new Set(secretValues).size === secretValues.length;
  const configuredModels = [config.geminiModelBasic, config.geminiModelThinking, config.geminiModelXtraThink, config.geminiModelDocument, config.geminiModelSupport];
  const modelsStable = configuredModels.every((model) => !/(?:latest|preview|experimental|exp-|gemini-2\.0)/i.test(model));
  const originsReady = app.valid && config.allowedOrigins.length > 0 && config.allowedOrigins.every((origin) => {
    const parsed = productionUrl(origin);
    return parsed.valid;
  }) && config.allowedOrigins.includes(app.url?.origin);
  const googleCredentialsReady = !config.googleOauthRequired || Boolean(config.googleClientId && config.googleClientSecret);
  const googleRedirectReady = !config.googleOauthRequired || (redirect.valid && api.valid
    && redirect.url.origin === api.url.origin
    && redirect.url.pathname === '/api/auth/google/callback');
  const smtpReady = config.emailMode === 'smtp'
    && Boolean(config.smtpHost && config.smtpUser && config.smtpPass)
    && !/@localhost\b/i.test(config.mailFrom);
  const paymentsReady = config.paymentsMode === 'midtrans'
    && config.midtransEnvironment === 'production'
    && Boolean(config.midtransServerKey && config.midtransClientKey);

  return [
    { name: 'runtime production', ok: config.isProd, detail: config.isProd ? 'NODE_ENV=production' : `NODE_ENV=${config.nodeEnv}` },
    { name: 'public HTTPS URLs', ok: app.valid && api.valid, detail: app.valid && api.valid ? `${app.url.origin} · ${api.url.origin}` : 'APP_URL dan API_URL wajib HTTPS' },
    { name: 'allowed origins', ok: originsReady, detail: originsReady ? `${config.allowedOrigins.length} origin HTTPS` : 'ALLOWED_ORIGINS wajib HTTPS dan memuat origin APP_URL' },
    { name: 'reverse proxy trust', ok: config.trustProxyHops >= 1, detail: config.trustProxyHops >= 1 ? `${config.trustProxyHops} hop` : 'TRUST_PROXY_HOPS minimal 1 di belakang Cloudflare/reverse proxy' },
    { name: 'application secrets', ok: secretsReady, detail: secretsReady ? '3 secret unik, minimal 32 karakter' : 'JWT_SECRET, DEVICE_HMAC_SECRET, dan TOKEN_HMAC_SECRET wajib unik dan minimal 32 karakter' },
    { name: 'AI required and credential', ok: config.aiRequired && config.geminiKeyValid, detail: config.aiRequired && config.geminiKeyValid ? 'AI_REQUIRED=true dan API key Gemini valid' : 'Set AI_REQUIRED=true dan gunakan API key Gemini berformat AIza...' },
    { name: 'stable AI models', ok: modelsStable, detail: modelsStable ? [...new Set(configuredModels)].join(', ') : 'Model preview/latest/experimental tidak diizinkan' },
    { name: 'verified email authentication', ok: smtpReady, detail: smtpReady ? 'Registrasi email terverifikasi aktif; Google OAuth dapat berjalan berdampingan' : 'SMTP production wajib untuk verifikasi email manual' },
    { name: 'Google OAuth credential', ok: googleCredentialsReady, detail: config.googleOauthRequired ? (googleCredentialsReady ? 'Credential Google tersedia' : 'Client ID dan client secret wajib tersedia') : 'Google OAuth dinonaktifkan' },
    { name: 'Google OAuth HTTPS callback', ok: googleRedirectReady, detail: config.googleOauthRequired ? (googleRedirectReady ? config.googleRedirectUri : 'Callback wajib memakai origin API_URL dan path /api/auth/google/callback') : 'Google OAuth dinonaktifkan' },
    { name: 'transactional email', ok: smtpReady, detail: smtpReady ? config.smtpHost : 'EMAIL_MODE=smtp, credential SMTP, dan MAIL_FROM non-localhost wajib tersedia' },
    { name: 'Midtrans production', ok: paymentsReady, detail: paymentsReady ? 'Midtrans production aktif' : 'PAYMENTS_MODE=midtrans, environment production, dan kedua key wajib tersedia' },
    { name: 'admin identity', ok: Boolean(process.env.ADMIN_EMAIL && /@/.test(process.env.ADMIN_EMAIL)), detail: process.env.ADMIN_EMAIL ? 'ADMIN_EMAIL dikonfigurasi' : 'ADMIN_EMAIL wajib eksplisit pada production' },
  ];
}

export function validateProductionConfig() {
  if (!config.isProd) return;
  const failed = productionConfigChecks().filter((check) => !check.ok);
  if (failed.length) throw new Error(`Konfigurasi production belum lengkap: ${failed.map((check) => check.name).join(', ')}.`);
}
