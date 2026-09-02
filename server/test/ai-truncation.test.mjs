import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'laprakin-ai-test-'));
process.env.LAPRAKIN_DATA_DIR = dataDir;
process.env.LAPRAKIN_UPLOAD_DIR = path.join(dataDir, 'uploads');
process.env.LAPRAKIN_PUBLIC_MEDIA_DIR = path.join(dataDir, 'public-media');
process.env.NARAROUTER_API_KEY = 'test-nararouter-key';
process.env.NARAROUTER_BASE_URL = 'https://router.test/v1';
process.env.NARAROUTER_MAX_RPM = '8';
process.env.NARAROUTER_MAX_CONCURRENCY = '2';

const { config } = await import('../src/config.js');
const { generateAiContent, aiThinkingConfigFor } = await import('../src/ai.js');
config.naraRouterMaxRpm = 600;
config.aiMaxRetries = 1;
config.aiCircuitFailureThreshold = 20;

process.on('exit', () => {
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* dibersihkan OS */ }
});

function stubNara(handler) {
  const calls = [];
  let completionCount = 0;
  const adapter = {
    async discoverModels() {
      return [
        { id: 'mistral-medium-3.5', context_length: 256000, supportsVision: false, supportsReasoning: true, supportsStructuredOutput: true },
        { id: 'stepfun-3.7-flash', context_length: 256000, supportsVision: true, supportsReasoning: true, supportsStructuredOutput: true },
        { id: 'mistral-large', context_length: 256000, supportsVision: false, supportsReasoning: true, supportsStructuredOutput: true },
      ];
    },
    async complete(body) {
      completionCount += 1;
      const call = { url: 'https://router.test/v1/chat/completions', body: { ...body, max_tokens: body.maxOutputTokens } };
      calls.push(call);
      return handler(call.body, completionCount);
    },
  };
  return { calls, providerAdapters: { get: () => adapter }, restore() {} };
}

const reply = (content, finishReason = 'stop') => ({
  choices: [{ finish_reason: finishReason, message: { content } }],
  usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
});

const jsonRequest = {
  purpose: 'document_evidence',
  mode: 'thinking',
  contents: [{ role: 'user', parts: [{ text: 'analisis' }] }],
  maxOutputTokens: 3200,
  responseMimeType: 'application/json',
  responseJsonSchema: { type: 'object', properties: { evidence: { type: 'array' } }, required: ['evidence'] },
};

test('respons JSON terpotong dicoba ulang dengan budget token lebih besar', async () => {
  const stub = stubNara((_body, call) => (call === 2
    ? reply('{"evidence":[]}', 'stop')
    : reply('{"evidence":[', 'length')));
  try {
    const result = await generateAiContent({ ...jsonRequest, providerAdapters: stub.providerAdapters });
    assert.equal(result.text, '{"evidence":[]}');
    const completions = stub.calls.filter((call) => call.url.endsWith('/chat/completions'));
    assert.equal(completions.length, 2);
    assert.ok(completions[1].body.max_tokens >= completions[0].body.max_tokens);
  } finally { stub.restore(); }
});

test('JSON yang tetap terpotong menghasilkan error jelas', async () => {
  const stub = stubNara(() => reply('{"evidence":[', 'length'));
  try { await assert.rejects(() => generateAiContent({ ...jsonRequest, providerAdapters: stub.providerAdapters }), (error) => error.code === 'AI_OUTPUT_TRUNCATED' || error.code === 'AI_SCHEMA_INVALID'); }
  finally { stub.restore(); }
});

test('respons teks biasa tidak terpengaruh pemeriksaan pemotongan terstruktur', async () => {
  const stub = stubNara(() => reply('jawaban panjang yang terpotong', 'length'));
  try {
    const result = await generateAiContent({ purpose: 'chat', contents: [{ role: 'user', parts: [{ text: 'halo' }] }], maxOutputTokens: 1200, providerAdapters: stub.providerAdapters });
    assert.equal(result.text, 'jawaban panjang yang terpotong');
  } finally { stub.restore(); }
});

test('reasoning effort provider-independent', () => {
  assert.deepEqual(aiThinkingConfigFor({ model: 'mistral-medium-3.5', mode: 'thinking' }), { model: 'mistral-medium-3.5', reasoning_effort: 'medium' });
  assert.deepEqual(aiThinkingConfigFor({ model: 'mistral-large', mode: 'xtrathink' }), { model: 'mistral-large', reasoning_effort: 'high' });
});
