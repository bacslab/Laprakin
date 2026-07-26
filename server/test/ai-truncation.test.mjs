// Regresi untuk kegagalan produksi 25 Juli 2026: job generate gagal dua kali
// dengan "Analisis gambar dari AI tidak lengkap".
//
// Gemini membalas HTTP 200 dengan finishReason MAX_TOKENS ketika output
// terpotong. generateAiContent dahulu tidak memeriksanya, sehingga JSON separuh
// jadi dikembalikan seolah sukses dan baru meledak di JSON.parse pemanggil.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'laprakin-ai-test-'));
process.env.LAPRAKIN_DATA_DIR = dataDir;
process.env.LAPRAKIN_UPLOAD_DIR = path.join(dataDir, 'uploads');
process.env.LAPRAKIN_PUBLIC_MEDIA_DIR = path.join(dataDir, 'public-media');
process.env.GEMINI_API_KEY = `AIza${'x'.repeat(32)}`;

const { generateAiContent, aiThinkingConfigFor } = await import('../src/ai.js');

process.on('exit', () => {
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* dibersihkan OS */ }
});

const realFetch = globalThis.fetch;
function stubGemini(handler) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body);
    return { ok: true, status: 200, json: async () => handler(body, calls.length) };
  };
  return { calls, restore: () => { globalThis.fetch = realFetch; } };
}

const reply = (text, finishReason = 'STOP') => ({
  candidates: [{ finishReason, content: { parts: [{ text }] } }],
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
});

const jsonRequest = {
  purpose: 'document_evidence',
  mode: 'thinking',
  contents: [{ role: 'user', parts: [{ text: 'analisis' }] }],
  maxOutputTokens: 3200,
  responseMimeType: 'application/json',
  responseJsonSchema: { type: 'object' },
};

test('respons JSON terpotong dicoba ulang dengan budget token lebih besar', async () => {
  // Percobaan pertama terpotong, percobaan kedua lengkap.
  const stub = stubGemini((_body, call) => (call === 1
    ? reply('{"evidence":[{"fileId":"a"', 'MAX_TOKENS')
    : reply('{"evidence":[]}')));
  try {
    const result = await generateAiContent(jsonRequest);
    assert.equal(result.text, '{"evidence":[]}');
    assert.equal(stub.calls.length, 2);
    assert.equal(stub.calls[0].generationConfig.maxOutputTokens, 3200);
    assert.ok(
      stub.calls[1].generationConfig.maxOutputTokens > 3200,
      'percobaan kedua harus memakai budget lebih besar, bukan mengulang permintaan identik',
    );
  } finally {
    stub.restore();
  }
});

test('JSON yang tetap terpotong menghasilkan error jelas, bukan teks separuh jadi', async () => {
  const stub = stubGemini(() => reply('{"evidence":[{"fileId":"a"', 'MAX_TOKENS'));
  try {
    await assert.rejects(
      () => generateAiContent(jsonRequest),
      (error) => error.code === 'AI_OUTPUT_TRUNCATED',
    );
  } finally {
    stub.restore();
  }
});

test('output terpotong tidak lagi menyamar sebagai balasan sukses', async () => {
  // Inti regresinya: sebelum perbaikan, potongan JSON ini dikembalikan apa adanya
  // dan pemanggil baru gagal saat JSON.parse.
  const stub = stubGemini(() => reply('{"evidence":[{"fileId":"a"', 'MAX_TOKENS'));
  try {
    const error = await generateAiContent(jsonRequest).then(() => null, (caught) => caught);
    assert.ok(error, 'permintaan terpotong seharusnya gagal, bukan mengembalikan teks');
    assert.notEqual(error.code, undefined);
  } finally {
    stub.restore();
  }
});

test('respons teks biasa tidak terpengaruh pemeriksaan pemotongan', async () => {
  // Hanya respons terstruktur yang diperlakukan keras; balasan chat panjang
  // tetap boleh dikembalikan apa adanya.
  const stub = stubGemini(() => reply('jawaban panjang yang terpotong', 'MAX_TOKENS'));
  try {
    const result = await generateAiContent({
      purpose: 'chat',
      mode: 'basic',
      contents: [{ role: 'user', parts: [{ text: 'halo' }] }],
      maxOutputTokens: 1200,
    });
    assert.equal(result.text, 'jawaban panjang yang terpotong');
    assert.equal(stub.calls.length, 1);
  } finally {
    stub.restore();
  }
});

test('mode thinking memang meminta anggaran berpikir yang memakan budget output', () => {
  // Menjelaskan mengapa batch besar mudah terpotong pada Gemini 3.
  assert.deepEqual(aiThinkingConfigFor({ model: 'gemini-3.6-flash', mode: 'thinking' }), { thinkingLevel: 'medium' });
  assert.deepEqual(aiThinkingConfigFor({ model: 'gemini-3.6-flash', mode: 'basic' }), { thinkingLevel: 'minimal' });
  assert.deepEqual(aiThinkingConfigFor({ model: 'gemini-2.5-flash', mode: 'thinking' }), { thinkingBudget: 2048 });
});
