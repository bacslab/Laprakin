import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'development';
process.env.GEMINI_API_KEY = 'server-only-test-key';
process.env.AI_MAX_RETRIES = '2';
process.env.AI_MAX_REQUESTS_PER_HOUR = '5';
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
const [{ generateAiContent }, { db }, { createGoogleAuthorizationState }] = await Promise.all([
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
assert.equal(generationRequests[1].options.headers['x-goog-api-key'], 'server-only-test-key');
const standardBody = JSON.parse(generationRequests[1].options.body);
assert.equal(standardBody.safetySettings.length, 4);
assert.ok(standardBody.safetySettings.every((setting) => setting.threshold === 'BLOCK_MEDIUM_AND_ABOVE'));

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
console.log('AI/Auth contract passed: retry + secret transport + telemetry + PKCE + redirect allowlist + live readiness contract');
