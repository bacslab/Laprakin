import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'development';
const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'laprakin-ai-auth-'));
process.env.LAPRAKIN_DATA_DIR = path.join(testRoot, 'data');
process.env.GEMINI_API_KEY = 'AIzaServerOnlyTestKey_12345678901234567890';
process.env.AI_MAX_RETRIES = '2';
process.env.AI_MAX_REQUESTS_PER_HOUR = '5';
process.env.AI_MAX_REQUESTS_PER_DAY = '100';
process.env.GOOGLE_OAUTH_CLIENT_ID = '123456789-test.apps.googleusercontent.com';
process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost:4000/api/auth/google/callback';
process.env.MANUAL_EMAIL_AUTH_ONLY = 'false';
process.env.GOOGLE_OAUTH_REQUIRED = 'true';

const requests = [];
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url: String(url), options });
  if (String(url).includes('/.well-known/openid-configuration')) {
    return new Response(JSON.stringify({
      issuer: 'https://accounts.google.com',
      authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      token_endpoint: 'https://oauth2.googleapis.com/token',
      jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
      code_challenge_methods_supported: ['S256'],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if ((options.method || 'GET') === 'GET' && String(url).includes('/v1beta/models/')) {
    const model = decodeURIComponent(String(url).split('/').pop());
    return new Response(JSON.stringify({
      name: `models/${model}`,
      supportedGenerationMethods: ['generateContent'],
      inputTokenLimit: 1000000,
      outputTokenLimit: 64000,
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  const generationRequests = requests.filter((request) => String(request.url).includes(':generateContent'));
  if (generationRequests.length === 1) {
    return new Response(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED' } }), {
      status: 429,
      headers: { 'content-type': 'application/json' },
    });
  }
  const requestBody = JSON.parse(String(options.body || '{}'));
  const requestText = JSON.stringify(requestBody.contents || []);
  if (
    requestText.includes('Trigger document fallback')
    && String(url).includes('/gemini-3.6-flash:generateContent')
  ) {
    return new Response(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED' } }), {
      status: 429,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (
    requestText.includes('Trigger empty document fallback')
    && String(url).includes('/gemini-3.6-flash:generateContent')
  ) {
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [] } }],
      usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 0, totalTokenCount: 11 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (requestText.includes('Trigger safety contract')) {
    return new Response(JSON.stringify({
      promptFeedback: { blockReason: 'SAFETY' },
      usageMetadata: { promptTokenCount: 4, totalTokenCount: 4 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  const responseText = requestBody.generationConfig?.responseFormat
    ? '{"status":"ready"}'
    : 'Respons provider nyata.';
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: responseText }] } }],
    usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 7, totalTokenCount: 18 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};

const purpose = `contract-${crypto.randomBytes(6).toString('hex')}`;
const [{ generateAiContent, aiThinkingConfigFor }, { db }, {
  cleanupExpiredResources,
  createGoogleAuthorizationState,
  requestPasswordReset,
  resetPassword,
}] = await Promise.all([
  import('../server/src/ai.js'),
  import('../server/src/db.js'),
  import('../server/src/services.js'),
]);

const generated = await generateAiContent({
  purpose,
  contents: [{ role: 'user', parts: [{ text: 'Tes provider.' }] }],
  maxOutputTokens: 80,
});
assert.equal(generated.text, 'Respons provider nyata.');
const generationRequests = requests.filter((request) => String(request.url).includes(':generateContent'));
assert.equal(generationRequests.length, 2, '429 harus dicoba ulang satu kali.');
assert.equal(new URL(generationRequests[1].url).search, '', 'API key tidak boleh berada di query string.');
assert.equal(generationRequests[1].options.headers['x-goog-api-key'], 'AIzaServerOnlyTestKey_12345678901234567890');
const standardBody = JSON.parse(generationRequests[1].options.body);
assert.equal(standardBody.safetySettings.length, 4);
assert.ok(standardBody.safetySettings.every((setting) => setting.threshold === 'BLOCK_MEDIUM_AND_ABOVE'));
assert.deepEqual(standardBody.generationConfig.thinkingConfig, { thinkingLevel: 'minimal' });
assert.deepEqual(aiThinkingConfigFor({ model: 'gemini-3.6-flash', mode: 'thinking', purpose: 'chat' }), { thinkingLevel: 'medium' });
assert.deepEqual(aiThinkingConfigFor({ model: 'gemini-3.6-flash', mode: 'xtrathink', purpose: 'chat' }), { thinkingLevel: 'high' });
assert.deepEqual(aiThinkingConfigFor({ model: 'gemini-3.5-flash', mode: 'thinking', purpose: 'document' }), { thinkingLevel: 'high' });

const documentFallbackStart = requests.length;
const documentFallback = await generateAiContent({
  purpose: 'document_evidence',
  mode: 'thinking',
  contents: [{ role: 'user', parts: [{ text: 'Trigger document fallback' }] }],
  maxOutputTokens: 80,
});
const documentFallbackRequests = requests.slice(documentFallbackStart)
  .filter((request) => String(request.url).includes(':generateContent'));
assert.equal(documentFallback.model, 'gemini-3.5-flash-lite');
assert.ok(documentFallbackRequests.some((request) => String(request.url).includes('/gemini-3.6-flash:generateContent')));
assert.ok(documentFallbackRequests.some((request) => String(request.url).includes('/gemini-3.5-flash-lite:generateContent')));

const emptyDocumentFallback = await generateAiContent({
  purpose: 'document_evidence',
  mode: 'thinking',
  contents: [{ role: 'user', parts: [{ text: 'Trigger empty document fallback' }] }],
  maxOutputTokens: 80,
});
assert.equal(emptyDocumentFallback.model, 'gemini-3.5-flash-lite');
assert.equal(emptyDocumentFallback.text, 'Respons provider nyata.');

const structured = await generateAiContent({
  purpose: `${purpose}-structured`,
  contents: [{ role: 'user', parts: [{ text: 'Tes structured output.' }] }],
  maxOutputTokens: 80,
  responseMimeType: 'application/json',
  responseJsonSchema: {
    type: 'object',
    properties: { status: { type: 'string', enum: ['ready'] } },
    required: ['status'],
    additionalProperties: false,
  },
});
assert.deepEqual(JSON.parse(structured.text), { status: 'ready' });
const structuredRequest = requests.filter((request) => String(request.url).includes(':generateContent')).at(-1);
const structuredBody = JSON.parse(structuredRequest.options.body);
assert.equal(structuredBody.generationConfig.responseFormat.text.mimeType, 'APPLICATION_JSON');
assert.equal(structuredBody.generationConfig.responseFormat.text.schema.type, 'object');
assert.equal(structuredBody.generationConfig.responseMimeType, undefined);
assert.equal(structuredBody.generationConfig.responseJsonSchema, undefined);

await assert.rejects(
  generateAiContent({
    purpose: `${purpose}-safety`,
    contents: [{ role: 'user', parts: [{ text: 'Trigger safety contract' }] }],
    maxOutputTokens: 40,
  }),
  (error) => error.code === 'AI_SAFETY_BLOCKED' && error.status === 422,
);

const dailyPurpose = `daily-${crypto.randomBytes(6).toString('hex')}`;
const insertDailyUsage = db.prepare(`
  INSERT INTO ai_usage_events (
    id, user_id, purpose, mode, provider, model, status, created_at
  ) VALUES (?, NULL, ?, 'basic', 'gemini', 'contract-model', 'success', ?)
`);
for (let index = 0; index < 100; index += 1) {
  insertDailyUsage.run(`${dailyPurpose}-${index}`, dailyPurpose, new Date().toISOString());
}
await assert.rejects(
  generateAiContent({
    purpose: `${dailyPurpose}-blocked`,
    contents: [{ role: 'user', parts: [{ text: 'Tes batas harian.' }] }],
    maxOutputTokens: 40,
  }),
  (error) => error.code === 'AI_DAILY_LIMIT' && error.status === 429,
);
db.prepare('DELETE FROM ai_usage_events WHERE purpose = ?').run(dailyPurpose);

const usage = db.prepare('SELECT * FROM ai_usage_events WHERE purpose = ? ORDER BY created_at DESC LIMIT 1').get(purpose);
assert.equal(usage.status, 'success');
assert.equal(usage.total_tokens, 18);
assert.equal(Object.hasOwn(usage, 'prompt'), false);
assert.equal(Object.hasOwn(usage, 'output'), false);

const quotaUserId = `quota-${crypto.randomBytes(6).toString('hex')}`;
const quotaTimestamp = new Date().toISOString();
db.prepare(`INSERT INTO users (id, email, password_hash, full_name, role, referral_code, created_at, updated_at) VALUES (?, ?, ?, '', 'student', ?, ?, ?)`)
  .run(quotaUserId, `${quotaUserId}@example.test`, 'not-a-login-hash', quotaUserId, quotaTimestamp, quotaTimestamp);
const concurrent = await Promise.allSettled(Array.from({ length: 6 }, (_, index) => generateAiContent({
  userId: quotaUserId,
  purpose: `quota-${index}`,
  contents: [{ role: 'user', parts: [{ text: `Tes quota ${index}` }] }],
  maxOutputTokens: 40,
})));
assert.equal(concurrent.filter((result) => result.status === 'fulfilled').length, 5);
const quotaRejection = concurrent.find((result) => result.status === 'rejected');
assert.equal(quotaRejection.reason.code, 'AI_USER_RATE_LIMIT');

const google = createGoogleAuthorizationState('/application/should-not-pass');
const authorizationUrl = new URL(google.url);
assert.equal(authorizationUrl.origin, 'https://accounts.google.com');
assert.equal(authorizationUrl.searchParams.get('code_challenge_method'), 'S256');
assert.ok(authorizationUrl.searchParams.get('code_challenge'));
assert.ok(authorizationUrl.searchParams.get('nonce'));
const oauthState = db.prepare('SELECT * FROM oauth_states ORDER BY created_at DESC LIMIT 1').get();
assert.equal(oauthState.redirect_path, '/app');

const googleOnlyUserId = `google-password-${crypto.randomBytes(6).toString('hex')}`;
const googleOnlyEmail = `${googleOnlyUserId}@example.test`;
db.prepare(`
  INSERT INTO users (
    id, email, password_hash, full_name, role, email_verified_at,
    referral_code, google_sub, auth_provider, created_at, updated_at
  ) VALUES (?, ?, 'not-a-login-hash', 'Google User', 'student', ?, ?, ?, 'google', ?, ?)
`).run(
  googleOnlyUserId,
  googleOnlyEmail,
  quotaTimestamp,
  googleOnlyUserId,
  `google-sub-${googleOnlyUserId}`,
  quotaTimestamp,
  quotaTimestamp,
);
const passwordRequest = await requestPasswordReset(googleOnlyEmail);
assert.ok(passwordRequest.resetToken);
const googleWithPassword = await resetPassword(passwordRequest.resetToken, 'Production-ready-password-123');
assert.equal(googleWithPassword.authProvider, 'password+google');

const expiredTimestamp = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
const expiredOauthId = `expired-oauth-${crypto.randomBytes(6).toString('hex')}`;
const expiredResetId = `expired-reset-${crypto.randomBytes(6).toString('hex')}`;
const expiredAiUsageId = `expired-ai-${crypto.randomBytes(6).toString('hex')}`;
db.prepare(`
  INSERT INTO oauth_states (
    id, state_hash, nonce, code_verifier, redirect_path, expires_at, created_at
  ) VALUES (?, ?, 'expired-nonce', 'expired-verifier', '/app', ?, ?)
`).run(expiredOauthId, `expired-state-${expiredOauthId}`, expiredTimestamp, expiredTimestamp);
db.prepare(`
  INSERT INTO password_reset_tokens (
    id, user_id, token_hash, expires_at, created_at
  ) VALUES (?, ?, ?, ?, ?)
`).run(expiredResetId, googleOnlyUserId, `expired-token-${expiredResetId}`, expiredTimestamp, expiredTimestamp);
db.prepare(`
  INSERT INTO ai_usage_events (
    id, user_id, purpose, mode, provider, model, status, created_at
  ) VALUES (?, NULL, 'expired-contract', 'basic', 'gemini', 'contract-model', 'success', ?)
`).run(expiredAiUsageId, expiredTimestamp);
const cleanup = await cleanupExpiredResources();
assert.ok(cleanup.purgedOauthStates >= 1);
assert.ok(cleanup.purgedPasswordResetTokens >= 1);
assert.ok(cleanup.purgedAiUsageEvents >= 1);
assert.equal(db.prepare('SELECT 1 FROM oauth_states WHERE id = ?').get(expiredOauthId), undefined);
assert.equal(db.prepare('SELECT 1 FROM password_reset_tokens WHERE id = ?').get(expiredResetId), undefined);
assert.equal(db.prepare('SELECT 1 FROM ai_usage_events WHERE id = ?').get(expiredAiUsageId), undefined);

const { verifyProductionIntegrations } = await import('../server/src/integrations.js');
const integrations = await verifyProductionIntegrations();
assert.equal(integrations.ok, true);
assert.ok(integrations.gemini.models.every((model) => model.supportsGenerateContent));
assert.equal(integrations.googleOidc.checks.pkceS256, true);

db.prepare('DELETE FROM ai_usage_events WHERE purpose = ?').run(purpose);
db.prepare('DELETE FROM ai_usage_events WHERE purpose = ?').run(`${purpose}-structured`);
db.prepare('DELETE FROM ai_usage_events WHERE purpose = ?').run(`${purpose}-safety`);
db.prepare('DELETE FROM ai_usage_events WHERE user_id = ?').run(quotaUserId);
db.prepare('DELETE FROM users WHERE id = ?').run(quotaUserId);
db.prepare('DELETE FROM oauth_states WHERE id = ?').run(oauthState.id);
db.prepare('DELETE FROM notifications WHERE user_id = ?').run(googleOnlyUserId);
db.prepare('DELETE FROM audit_logs WHERE actor_user_id = ?').run(googleOnlyUserId);
db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(googleOnlyUserId);
db.prepare('DELETE FROM users WHERE id = ?').run(googleOnlyUserId);
db.close();
await fs.rm(testRoot, { recursive: true, force: true });
console.log('AI/Auth contract passed: retry + secret transport + telemetry + PKCE + redirect allowlist + live readiness contract');
