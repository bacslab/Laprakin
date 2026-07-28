import { config } from './config.js';

const GOOGLE_DISCOVERY_URL = 'https://accounts.google.com/.well-known/openid-configuration';

async function fetchJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, redirect: 'error', signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
}

function publicNetworkError(error) {
  if (error?.name === 'AbortError') return { code: 'TIMEOUT', message: 'Pengecekan melewati batas waktu.' };
  return { code: 'NETWORK_ERROR', message: 'Endpoint integrasi tidak dapat dihubungi.' };
}

export async function verifyGeminiIntegration() {
  if (!config.geminiKeyValid) return { ok: false, code: config.geminiKey ? 'AI_CREDENTIAL_INVALID' : 'AI_NOT_CONFIGURED', models: [] };
  const models = [...new Set([
    config.geminiModelBasic,
    config.geminiModelThinking,
    config.geminiModelXtraThink,
    config.geminiModelDocument,
    config.geminiModelSupport,
  ])];
  const results = [];
  for (const model of models) {
    try {
      const { response, payload } = await fetchJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,
        { headers: { 'x-goog-api-key': config.geminiKey } },
        config.googleRequestTimeoutMs,
      );
      const supportsGenerateContent = Array.isArray(payload.supportedGenerationMethods)
        && payload.supportedGenerationMethods.includes('generateContent');
      results.push({
        model,
        ok: response.ok && supportsGenerateContent,
        status: response.status,
        supportsGenerateContent,
        inputTokenLimit: Number(payload.inputTokenLimit || 0),
        outputTokenLimit: Number(payload.outputTokenLimit || 0),
      });
    } catch (error) {
      results.push({ model, ok: false, status: 0, ...publicNetworkError(error) });
    }
  }
  return { ok: results.length > 0 && results.every((item) => item.ok), models: results };
}

export async function verifyGoogleOidcIntegration() {
  if (!config.googleOauthRequired) return { ok: true, disabled: true, code: 'GOOGLE_OAUTH_DISABLED' };
  if (!config.googleClientId || !config.googleClientSecret) return { ok: false, code: 'GOOGLE_OAUTH_NOT_CONFIGURED' };
  try {
    const { response, payload } = await fetchJson(GOOGLE_DISCOVERY_URL, {}, config.googleRequestTimeoutMs);
    const redirectUrl = new URL(config.googleRedirectUri);
    const checks = {
      discoveryReachable: response.ok,
      issuer: payload.issuer === 'https://accounts.google.com',
      authorizationEndpoint: payload.authorization_endpoint === 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: payload.token_endpoint === 'https://oauth2.googleapis.com/token',
      jwksEndpoint: payload.jwks_uri === 'https://www.googleapis.com/oauth2/v3/certs',
      pkceS256: Array.isArray(payload.code_challenge_methods_supported) && payload.code_challenge_methods_supported.includes('S256'),
      redirectPath: redirectUrl.pathname === '/api/auth/google/callback',
    };
    return { ok: Object.values(checks).every(Boolean), checks, redirectOrigin: redirectUrl.origin };
  } catch (error) {
    return { ok: false, ...publicNetworkError(error) };
  }
}

export async function verifyAzureBlobIntegration() {
  if (!config.azureStorageConnectionString) return { ok: false, code: 'AZURE_BLOB_NOT_CONFIGURED', containerName: config.azureBlobContainerName };
  try {
    const { isAzureBlobConfigured } = await import('./azure-blob.js');
    return { ok: isAzureBlobConfigured(), containerName: config.azureBlobContainerName };
  } catch (error) {
    return { ok: false, code: 'AZURE_BLOB_ERROR', error: error.message };
  }
}

export async function verifyProductionIntegrations() {
  const [gemini, googleOidc, azureBlob] = await Promise.all([
    verifyGeminiIntegration(),
    verifyGoogleOidcIntegration(),
    verifyAzureBlobIntegration(),
  ]);
  return { ok: gemini.ok && googleOidc.ok, gemini, googleOidc, azureBlob, checkedAt: new Date().toISOString() };
}

