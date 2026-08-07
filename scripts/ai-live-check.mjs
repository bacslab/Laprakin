import { generateAiContent } from '../server/src/ai.js';
import { config } from '../server/src/config.js';
import { db } from '../server/src/db.js';

if (!config.naraRouterApiKey) throw new Error('NARAROUTER_API_KEY belum tersedia.');

const startedAt = new Date().toISOString();
const scenarios = [
  { name: 'basic', purpose: 'chat', mode: 'basic', maxOutputTokens: 900 },
  { name: 'thinking', purpose: 'chat', mode: 'thinking', maxOutputTokens: 1600 },
  { name: 'xtrathink', purpose: 'chat', mode: 'xtrathink', maxOutputTokens: 2600 },
  { name: 'support', purpose: 'support', mode: 'basic', maxOutputTokens: 180 },
];

try {
  const checks = [];
  for (const scenario of scenarios) {
    const result = await generateAiContent({
      purpose: scenario.purpose,
      mode: scenario.mode,
      contents: [{ role: 'user', parts: [{ text: 'Balas hanya dengan kata READY.' }] }],
      maxOutputTokens: scenario.maxOutputTokens,
    });
    if (!result.text.toUpperCase().includes('READY')) throw new Error(`${scenario.name} tidak memenuhi contract readiness.`);
    checks.push({ name: scenario.name, model: result.model, ok: true });
  }

  const document = await generateAiContent({
    purpose: 'document',
    mode: 'thinking',
    contents: [{ role: 'user', parts: [{ text: 'Buat satu status readiness.' }] }],
    maxOutputTokens: 5000,
    responseMimeType: 'application/json',
    responseJsonSchema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['ready'] } },
      required: ['status'],
      additionalProperties: false,
    },
  });
  const parsed = JSON.parse(document.text);
  if (parsed.status !== 'ready') throw new Error('Structured output dokumen tidak memenuhi contract readiness.');
  checks.push({ name: 'document', model: document.model, ok: true, structuredOutput: true });

  console.log(JSON.stringify({ ok: true, checks }, null, 2));
} finally {
  db.prepare('DELETE FROM ai_usage_events WHERE user_id IS NULL AND created_at >= ?').run(startedAt);
}
