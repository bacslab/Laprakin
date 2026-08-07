#!/usr/bin/env node
/* Laprakin-specific, opt-in benchmark. It uses only synthetic representative data. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../server/src/config.js';

if (!config.naraRouterApiKey) throw new Error('Isi NARAROUTER_API_KEY sebelum menjalankan benchmark.');

const tasks = [
  { id: 'report-id', purpose: 'Indonesian practicum report', prompt: 'Tulis kesimpulan laporan praktikum jaringan dalam Bahasa Indonesia. Gunakan fakta: DHCP memberi alamat 192.168.10.20, lease 3600 detik, dan tiga klien menerima alamat.', expected: ['192.168.10.20', '3600', 'tiga'] },
  { id: 'screenshot-evidence', purpose: 'screenshot evidence', prompt: 'Analisis bukti visual secara konservatif. Pisahkan OBSERVED, INFERRED, dan UNKNOWN. Bukti teks yang terbaca: interface eth0 beralamat 10.0.0.4/24.', expected: ['eth0', '10.0.0.4/24', 'UNKNOWN'] },
  { id: 'command-output', purpose: 'command output interpretation', prompt: 'Jelaskan output perintah secara teknis tanpa mengarang. Output: ping 8.8.8.8 berhasil 4/4 dengan rata-rata 21 ms.', expected: ['4/4', '21 ms'] },
  { id: 'revision', purpose: 'document revision', prompt: 'Perbaiki paragraf laporan agar formal dan ringkas. Pertahankan fakta bahwa server memakai port 8080 dan statusnya ready.', expected: ['8080', 'ready'] },
  { id: 'router-json', purpose: 'JSON router response', prompt: 'Kembalikan JSON valid dengan keys route dan reasoning_effort. Pilih route document dan reasoning_effort high.', expected: ['route', 'reasoning_effort', 'document', 'high'] },
  { id: 'quiz', purpose: 'comprehension quiz', prompt: 'Buat satu soal quiz dari laporan. Fakta sumber: VLAN 20 digunakan untuk perangkat mahasiswa. Jangan memakai fakta lain.', expected: ['VLAN 20', 'mahasiswa'] },
  { id: 'technical-explanation', purpose: 'technical explanation', prompt: 'Jelaskan singkat mengapa DNS diperlukan sebelum membuka domain. Bedakan fakta teknis dari asumsi.', expected: ['DNS'] },
];

function modelName(model) { return String(model.id || model.name || '').replace(/^models\//, ''); }
function chooseModel(models, patterns) { return patterns.map((pattern) => models.find((model) => pattern.test(modelName(model)))).find(Boolean); }
function jsonScore(text) { try { JSON.parse(String(text).replace(/^```json\s*/i, '').replace(/```$/i, '').trim()); return 1; } catch { return 0; } }

const modelsResponse = await fetch(`${config.naraRouterBaseUrl}/models`, { headers: { authorization: `Bearer ${config.naraRouterApiKey}` } });
if (!modelsResponse.ok) throw new Error(`Discovery model gagal: HTTP ${modelsResponse.status}`);
const modelsPayload = await modelsResponse.json();
const models = Array.isArray(modelsPayload.data) ? modelsPayload.data : [];
const selected = {
  stepfun: chooseModel(models, [/stepfun.*3[._ -]?7.*flash/i, /stepfun.*flash/i, /step[-_ ]?3.*flash/i]),
  medium: chooseModel(models, [/mistral.*medium.*3[._ -]?5/i, /mistral.*medium/i]),
  large: chooseModel(models, [/mistral.*large/i]),
};
if (Object.values(selected).some((model) => !model)) throw new Error(`Roster tidak lengkap untuk benchmark: ${Object.entries(selected).filter(([, model]) => !model).map(([key]) => key).join(', ')}`);

async function run(model, task) {
  const startedAt = Date.now();
  const response = await fetch(`${config.naraRouterBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.naraRouterApiKey}` },
    body: JSON.stringify({ model: modelName(model), messages: [{ role: 'system', content: 'Jawab berbasis fakta yang diberikan. Jangan mengarang.' }, { role: 'user', content: task.prompt }], max_tokens: 900 }),
  });
  const payload = await response.json().catch(() => ({}));
  const text = String(payload.choices?.[0]?.message?.content || '');
  const normalized = text.toLowerCase();
  const expectedHits = task.expected.filter((value) => normalized.includes(value.toLowerCase())).length;
  return {
    model: modelName(model), task: task.id, purpose: task.purpose,
    factualGrounding: expectedHits / task.expected.length,
    hallucinationRate: /\b(?:mungkin|diasumsikan|contoh lain)\b/i.test(text) ? 1 : 0,
    schemaValidity: task.id === 'router-json' ? jsonScore(text) : 1,
    instructionAdherence: text && !/saya tidak bisa|tidak dapat membantu/i.test(text) ? 1 : 0,
    documentCompleteness: text.length >= 120 ? 1 : 0,
    evidenceAccuracy: task.id.includes('evidence') ? expectedHits / task.expected.length : null,
    latencyMs: Date.now() - startedAt,
    tokenConsumption: Number(payload.usage?.total_tokens || 0),
  };
}

const results = [];
for (const [label, model] of Object.entries(selected)) {
  for (const task of tasks) results.push(await run(model, task));
}
const outputPath = path.resolve('bench-results', `nararouter-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), dataset: 'synthetic-laprakin-representative-tasks', models: Object.fromEntries(Object.entries(selected).map(([key, model]) => [key, modelName(model)])), results }, null, 2));
console.log(JSON.stringify({ ok: true, outputPath, models: Object.fromEntries(Object.entries(selected).map(([key, model]) => [key, modelName(model)])), taskCount: tasks.length }, null, 2));
