#!/usr/bin/env node
/**
 * Benchmark free-tier LLM provider untuk beban kerja Laprakin.
 *
 * Payload meniru satu job drafting nyata: ~3K token teks praktikum (sintetis,
 * BUKAN file user) + instruksi menyusun bab "Pembahasan" berbahasa Indonesia
 * dengan output JSON {judul, isi}.
 *
 * Aturan:
 * - Key dibaca dari env / .env / server/.env. Provider tanpa key di-SKIP.
 * - Maksimal 3 request per provider (1 warmup + 2 terukur).
 * - Raw output disimpan ke bench-results/ untuk review kualitas bahasa manual.
 * - Tidak menyentuh kode production; murni skrip baca-saja.
 *
 * Pemakaian:
 *   node scripts/bench-providers/bench.mjs            # semua provider yang punya key
 *   node scripts/bench-providers/bench.mjs groq mistral  # subset
 *   BENCH_MODEL_NARAROUTER=<alias-dari-model-registry> node scripts/bench-providers/bench.mjs nararouter
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const resultsDir = path.join(repoRoot, 'bench-results');
const REQUESTS_PER_PROVIDER = 3;
const DELAY_BETWEEN_REQUESTS_MS = 5000;
const REQUEST_TIMEOUT_MS = 120000;

function loadDotEnv(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch { /* file .env opsional */ }
}
loadDotEnv(path.join(repoRoot, '.env'));
loadDotEnv(path.join(repoRoot, 'server', '.env'));

/** ~3K token teks praktikum sintetis (≈14K karakter, rasio ±4.7 chars/token). */
function buildPracticumText() {
  const sections = [];
  sections.push(`MODUL PRAKTIKUM JARINGAN KOMPUTER
Topik: Konfigurasi DHCP Server pada Router MikroTik
Tujuan: mahasiswa mampu mengonfigurasi DHCP server, memverifikasi lease alamat, dan menganalisis lalu lintas DORA (Discover, Offer, Request, Acknowledge) menggunakan Wireshark.

Alat dan bahan: satu unit router MikroTik RB951, dua laptop client, kabel UTP straight-through, aplikasi Winbox 3.41, serta Wireshark 4.2.`);
  const steps = [
    ['Reset konfigurasi router', 'system reset-configuration no-defaults=yes', 'router kembali ke keadaan kosong tanpa konfigurasi bawaan'],
    ['Pemberian alamat IP pada interface', 'ip address add address=192.168.10.1/24 interface=ether2', 'interface ether2 menjadi gateway segmen LAN praktikum'],
    ['Pembuatan IP pool', 'ip pool add name=pool-lab ranges=192.168.10.20-192.168.10.120', 'rentang 101 alamat disiapkan untuk client'],
    ['Aktivasi DHCP server', 'ip dhcp-server add name=dhcp-lab interface=ether2 address-pool=pool-lab lease-time=10m', 'server melayani permintaan alamat pada ether2 dengan masa sewa sepuluh menit'],
    ['Penetapan network DHCP', 'ip dhcp-server network add address=192.168.10.0/24 gateway=192.168.10.1 dns-server=192.168.10.1', 'client menerima gateway dan DNS yang benar'],
    ['Verifikasi lease pada client pertama', 'ipconfig /renew', 'laptop pertama memperoleh 192.168.10.20 dengan subnet mask 255.255.255.0'],
    ['Verifikasi lease pada client kedua', 'ipconfig /renew', 'laptop kedua memperoleh 192.168.10.21 tanpa konflik alamat'],
    ['Penangkapan paket DORA', 'filter tampilan wireshark: bootp', 'empat tahap DHCP Discover, Offer, Request, dan Acknowledge terekam berurutan'],
    ['Pengujian static lease', 'ip dhcp-server lease make-static', 'alamat client pertama dikunci agar tidak berpindah saat lease habis'],
    ['Pengujian konektivitas antar client', 'ping 192.168.10.21 -n 10', 'sepuluh balasan diterima dengan rata-rata waktu 1 ms tanpa packet loss'],
  ];
  steps.forEach(([title, command, observation], index) => {
    sections.push(`Langkah ${index + 1}: ${title}
Perintah yang dijalankan: ${command}
Hasil pengamatan: ${observation}. Praktikan mencatat waktu eksekusi, membandingkan keluaran terminal dengan modul acuan, lalu mengambil tangkapan layar sebagai bukti. Apabila keluaran berbeda dari ekspektasi, langkah diulang setelah memeriksa kembali pengetikan perintah, status interface, dan tabel routing. Seluruh nilai yang muncul pada terminal disalin apa adanya ke lembar kerja tanpa dibulatkan supaya laporan tetap dapat diaudit terhadap kondisi laboratorium.
Analisis singkat: konfigurasi pada langkah ini berkaitan langsung dengan layanan alamat dinamis karena ${observation}. Praktikan juga membandingkan perilaku sebelum dan sesudah perintah dijalankan untuk memastikan perubahan benar-benar berasal dari konfigurasi yang dilakukan, bukan dari kondisi sisa percobaan sebelumnya.`);
  });
  sections.push(`Data pengamatan tambahan:
Tabel lease menunjukkan dua entri aktif dengan status bound. Waktu tunggu rata-rata proses DORA dari Discover sampai Acknowledge adalah 0,18 detik pada percobaan pertama dan 0,11 detik pada percobaan kedua. Ketika lease-time diubah dari sepuluh menit menjadi dua menit, client memperbarui alamat pada detik ke-60 sesuai perilaku renewal T1. Percobaan pelepasan alamat dengan ipconfig /release menghapus entri dari tabel lease dalam waktu kurang dari dua detik. Kapasitas pool berkurang dari 101 menjadi 99 alamat saat kedua client aktif, dan kembali penuh setelah keduanya melepaskan alamat.`);
  let text = sections.join('\n\n');
  while (text.length < 14000) {
    text += `\n\nCatatan pengulangan percobaan ke-${Math.floor(text.length / 1000)}: percobaan diulang dengan nilai lease-time berbeda untuk memastikan konsistensi perilaku renewal, dan seluruh hasil tetap sesuai dengan teori tahapan DORA yang dijelaskan pada modul. Praktikan memverifikasi ulang tabel ARP, tabel lease, serta log router untuk memastikan tidak ada permintaan DHCP dari perangkat di luar daftar alat praktikum.`;
  }
  return text.slice(0, 14500);
}

const SYSTEM_PROMPT = 'Kamu menyusun bagian laporan praktikum berbahasa Indonesia formal-akademik. Gunakan hanya fakta dari bahan yang diberikan, jangan mengarang nilai atau hasil baru, dan jawab hanya dengan JSON valid berbentuk {"judul": string, "isi": string}.';
const USER_INSTRUCTION = `Susun bab "Pembahasan" untuk laporan praktikum berdasarkan bahan berikut. Ketentuan:
- Bahasa Indonesia formal-akademik, 350-500 kata, paragraf mengalir (bukan bullet).
- Hubungkan langkah konfigurasi, hasil pengamatan, dan teori DHCP (DORA, lease, pool).
- Sebutkan nilai-nilai spesifik dari bahan (alamat IP, waktu, jumlah alamat) tanpa mengubahnya.
- Balas HANYA JSON: {"judul": string, "isi": string}.

BAHAN PRAKTIKUM:
`;

/**
 * Definisi provider. `key` = nama env var. Model bisa dioverride via
 * BENCH_MODEL_<ID> (mis. BENCH_MODEL_GROQ=llama-4-scout-17b).
 * Snapshot roster Juli 2026; katalog free tier sering berubah.
 */
const PROVIDERS = [
  { id: 'github', label: 'GitHub Models', key: 'GITHUB_TOKEN', base: 'https://models.github.ai/inference', model: 'openai/gpt-4.1' },
  { id: 'mistral', label: 'Mistral La Plateforme', key: 'MISTRAL_API_KEY', base: 'https://api.mistral.ai/v1', model: 'mistral-medium-latest' },
  { id: 'groq', label: 'Groq', key: 'GROQ_API_KEY', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { id: 'cerebras', label: 'Cerebras', key: 'CEREBRAS_API_KEY', base: 'https://api.cerebras.ai/v1', model: 'gpt-oss-120b' },
  { id: 'openrouter', label: 'OpenRouter :free', key: 'OPENROUTER_API_KEY', base: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-4-maverick:free' },
  { id: 'nvidia', label: 'NVIDIA NIM', key: 'NVIDIA_API_KEY', base: 'https://integrate.api.nvidia.com/v1', model: 'meta/llama-4-maverick-17b-128e-instruct' },
  { id: 'cloudflare', label: 'Cloudflare Workers AI', key: 'CLOUDFLARE_API_TOKEN', extraKey: 'CLOUDFLARE_ACCOUNT_ID', base: null, model: '@cf/openai/gpt-oss-120b' },
  { id: 'zai', label: 'Z.ai', key: 'ZAI_API_KEY', base: 'https://api.z.ai/api/paas/v4', model: 'glm-4.7-flash' },
  { id: 'cohere', label: 'Cohere', key: 'COHERE_API_KEY', base: 'https://api.cohere.com', model: 'command-a-03-2025', style: 'cohere' },
  { id: 'nararouter', label: 'NaraRouter', key: 'NARAROUTER_API_KEY', base: process.env.NARAROUTER_BASE_URL || 'https://router.bynara.id/v1', model: process.env.AI_MODEL_DOCUMENT || 'auto' },
];

function providerModel(provider) {
  return process.env[`BENCH_MODEL_${provider.id.toUpperCase()}`] || provider.model;
}

function checkJson(rawText) {
  try {
    const cleaned = String(rawText || '').trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
      .replace(/^[^{]*(\{)/s, '$1');
    const parsed = JSON.parse(cleaned);
    const ok = typeof parsed?.judul === 'string' && typeof parsed?.isi === 'string' && parsed.isi.length > 200;
    return { valid: ok, wordCount: ok ? parsed.isi.split(/\s+/).length : 0 };
  } catch {
    return { valid: false, wordCount: 0 };
  }
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** OpenAI-compatible chat/completions dengan streaming untuk mengukur TTFT. */
async function runOpenAiCompat(provider, prompt, { jsonMode = true } = {}) {
  const base = provider.id === 'cloudflare'
    ? `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`
    : provider.base;
  const body = {
    model: providerModel(provider),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    max_tokens: 1600,
    temperature: 0.4,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (jsonMode) body.response_format = { type: 'json_object' };
  const started = Date.now();
  const response = await fetchWithTimeout(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env[provider.key]}`,
      ...(provider.id === 'openrouter' ? { 'HTTP-Referer': 'https://laprakin.app', 'X-Title': 'Laprakin bench' } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = (await response.text()).slice(0, 400);
    // Sebagian provider menolak response_format atau stream_options; coba ulang polos.
    if (response.status === 400 && jsonMode) return runOpenAiCompat(provider, prompt, { jsonMode: false });
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  let text = '';
  let ttftMs = null;
  let usage = null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const data = line.replace(/^data:\s*/, '').trim();
      if (!data || data === '[DONE]' || !line.startsWith('data:')) continue;
      try {
        const chunk = JSON.parse(data);
        const delta = chunk.choices?.[0]?.delta?.content || '';
        if (delta && ttftMs === null) ttftMs = Date.now() - started;
        text += delta;
        if (chunk.usage) usage = chunk.usage;
      } catch { /* keep-alive / chunk non-JSON */ }
    }
  }
  return {
    text,
    ttftMs,
    latencyMs: Date.now() - started,
    inputTokens: usage?.prompt_tokens ?? null,
    outputTokens: usage?.completion_tokens ?? null,
    jsonModeUsed: jsonMode,
  };
}

async function runCohere(provider, prompt) {
  const started = Date.now();
  const response = await fetchWithTimeout(`${provider.base}/v2/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env[provider.key]}` },
    body: JSON.stringify({
      model: providerModel(provider),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1600,
      temperature: 0.4,
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 400)}`);
  const payload = await response.json();
  return {
    text: (payload.message?.content || []).map((part) => part.text || '').join(''),
    ttftMs: null,
    latencyMs: Date.now() - started,
    inputTokens: payload.usage?.billed_units?.input_tokens ?? null,
    outputTokens: payload.usage?.billed_units?.output_tokens ?? null,
    jsonModeUsed: true,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const filterIds = process.argv.slice(2).map((value) => value.toLowerCase());
  fs.mkdirSync(resultsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const prompt = USER_INSTRUCTION + buildPracticumText();
  console.log(`Payload: ~${prompt.length} karakter (~${Math.round(prompt.length / 4.7)} token perkiraan)\n`);

  const summary = [];
  for (const provider of PROVIDERS) {
    if (filterIds.length && !filterIds.includes(provider.id)) continue;
    if (provider.optIn && process.env[provider.optIn] !== '1') {
      console.log(`SKIP ${provider.label}: set ${provider.optIn}=1 untuk mengikutsertakan (memakai kuota produksi).`);
      continue;
    }
    if (!process.env[provider.key] || (provider.extraKey && !process.env[provider.extraKey])) {
      console.log(`SKIP ${provider.label}: env ${provider.key}${provider.extraKey ? ` + ${provider.extraKey}` : ''} tidak di-set.`);
      continue;
    }
    console.log(`\n=== ${provider.label} (${providerModel(provider)}) ===`);
    const runs = [];
    for (let runIndex = 1; runIndex <= REQUESTS_PER_PROVIDER; runIndex += 1) {
      try {
        const runner = provider.style === 'cohere' ? runCohere : runOpenAiCompat;
        const result = await runner(provider, prompt);
        const json = checkJson(result.text);
        runs.push({ run: runIndex, warmup: runIndex === 1, ...result, jsonValid: json.valid, wordCount: json.wordCount });
        console.log(`  run ${runIndex}${runIndex === 1 ? ' (warmup)' : ''}: ${result.latencyMs} ms total, TTFT ${result.ttftMs ?? '-'} ms, in ${result.inputTokens ?? '?'} / out ${result.outputTokens ?? '?'} tok, JSON ${json.valid ? 'VALID' : 'INVALID'}${json.valid ? ` (${json.wordCount} kata)` : ''}`);
        fs.writeFileSync(
          path.join(resultsDir, `${stamp}-${provider.id}-run${runIndex}.json`),
          JSON.stringify({ provider: provider.id, model: providerModel(provider), ...runs.at(-1) }, null, 2),
        );
      } catch (error) {
        runs.push({ run: runIndex, error: String(error.message || error).slice(0, 300) });
        console.log(`  run ${runIndex}: GAGAL — ${runs.at(-1).error}`);
      }
      if (runIndex < REQUESTS_PER_PROVIDER) await sleep(DELAY_BETWEEN_REQUESTS_MS);
    }
    const measured = runs.filter((run) => !run.error && !run.warmup);
    summary.push({
      provider: provider.id,
      model: providerModel(provider),
      ok: measured.length,
      failed: runs.filter((run) => run.error).length,
      avgLatencyMs: measured.length ? Math.round(measured.reduce((total, run) => total + run.latencyMs, 0) / measured.length) : null,
      avgTtftMs: measured.some((run) => run.ttftMs) ? Math.round(measured.filter((run) => run.ttftMs).reduce((total, run) => total + run.ttftMs, 0) / measured.filter((run) => run.ttftMs).length) : null,
      jsonValidRate: runs.filter((run) => !run.error).length ? runs.filter((run) => run.jsonValid).length / runs.filter((run) => !run.error).length : 0,
    });
  }

  if (summary.length) {
    fs.writeFileSync(path.join(resultsDir, `${stamp}-summary.json`), JSON.stringify(summary, null, 2));
    console.log('\n=== RINGKASAN ===');
    console.table(summary);
    console.log(`Raw output tersimpan di bench-results/ — review manual kualitas bahasa Indonesianya dari sana.`);
  } else {
    console.log('\nTidak ada provider yang dijalankan. Isi API key di server/.env atau .env lalu jalankan ulang.');
  }
}

main().catch((error) => {
  console.error('Benchmark gagal:', error);
  process.exitCode = 1;
});
