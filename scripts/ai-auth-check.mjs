import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'development';
const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'laprakin-ai-auth-'));
process.env.LAPRAKIN_DATA_DIR = path.join(testRoot, 'data');
process.env.NARAROUTER_API_KEY = 'nararouter-contract-key';
process.env.NARAROUTER_BASE_URL = 'https://router.contract.test/v1';
process.env.NARAROUTER_MAX_RETRIES = '2';
process.env.AI_MAX_REQUESTS_PER_HOUR = '5';
process.env.AI_MAX_REQUESTS_PER_DAY = '100';

const requests = [];
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url: String(url), options });
  if (String(url).endsWith('/models')) return new Response(JSON.stringify({ data: [
    { id: 'mistral-medium-3.5', context_length: 256000, supportsReasoning: true, supportsStructuredOutput: true },
    { id: 'stepfun-3.7-flash', context_length: 256000, supportsVision: true, supportsReasoning: true },
    { id: 'mistral-large', context_length: 256000, supportsReasoning: true },
  ] }), { status: 200 });
  const body = JSON.parse(options.body || '{}');
  return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: body.response_format ? '{"status":"ready"}' : 'READY' } }], usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 } }), { status: 200 });
};

const [{ generateAiContent, aiThinkingConfigFor, selectAiRoute }, { db }] = await Promise.all([
  import('../server/src/ai.js'),
  import('../server/src/db.js'),
]);
const purpose = `contract-${crypto.randomBytes(6).toString('hex')}`;
const generated = await generateAiContent({ purpose, contents: [{ role: 'user', parts: [{ text: 'Tes provider.' }] }], maxOutputTokens: 80 });
assert.equal(generated.text, 'READY');
assert.equal(generated.provider, 'nararouter');
assert.ok(requests.find((request) => request.options.headers?.authorization === 'Bearer nararouter-contract-key'));
assert.ok(requests.every((request) => !String(request.url).includes('googleapis')));
assert.deepEqual(aiThinkingConfigFor({ model: 'mistral-medium-3.5', mode: 'thinking' }), { model: 'mistral-medium-3.5', reasoning_effort: 'medium' });
assert.equal(selectAiRoute({ purpose: 'document' }).model, 'mistral-medium-3.5');
assert.equal(selectAiRoute({ purpose: 'visual evidence', requiresVision: true }).model, 'stepfun-3.7-flash');
const structured = await generateAiContent({ purpose: `${purpose}-structured`, contents: [{ role: 'user', parts: [{ text: 'JSON' }] }], maxOutputTokens: 80, responseMimeType: 'application/json', responseJsonSchema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] } });
assert.deepEqual(JSON.parse(structured.text), { status: 'ready' });
const usage = db.prepare('SELECT * FROM ai_usage_events WHERE purpose = ? ORDER BY created_at DESC LIMIT 1').get(purpose);
assert.equal(usage.provider, 'nararouter');
assert.equal(usage.total_tokens, 18);
assert.equal(Object.hasOwn(usage, 'prompt'), false);
console.log('NaraRouter auth, discovery, routing, structured output, and metadata contract passed.');
