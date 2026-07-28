# Analisa Kelayakan Free-Tier LLM API untuk Laprakin

Tanggal analisa: 26 Juli 2026.
Basis: audit call site di `server/src/ai.js` + `server/src/services.js`, data pemakaian nyata dari tabel `ai_usage_events` (188 request, 22–26 Juli 2026), dan tokenisasi sample modul praktikum yang ada di repo. Snapshot limit provider per Juli 2026 — angka bisa berubah sewaktu-waktu.

---

## 1. Ringkasan Kebutuhan Laprakin (hasil profiling codebase)

### 1.1 Arsitektur AI saat ini

Provider tunggal: **Google Gemini** via REST `generativelanguage.googleapis.com/v1beta/...:generateContent` (`server/src/ai.js:143`). Tidak ada SDK; fetch mentah dengan retry + model-fallback chain. Model default (`server/src/config.js:82-87`):

| Purpose | Model | Dipakai untuk |
|---|---|---|
| basic/chat | `gemini-3.5-flash-lite` | router chat, workplan |
| thinking/xtrathink | `gemini-3.6-flash` | mode berpikir |
| document | `gemini-3.6-flash` | draft, evidence, quiz |
| support | `gemini-3.5-flash-lite` | CS bot |

Delapan call site LLM, semuanya lewat `generateAiContent()`:

| Call site | Purpose | Input tipikal | `maxOutputTokens` |
|---|---|---|---|
| `services.js:138` support bot | support | ~0.4K tok | 180 |
| `services.js:1218` workplan chat | chat | 1–8K tok (+gambar) | 2.600 |
| `services.js:1369` router chat (ASK/RESPOND/GENERATE) | chat | 1–16K tok (+gambar) | 1.600 |
| `services.js:1471` validasi revisi | chat | 1–6K tok | 1.600 |
| `services.js:1563` ringkasan hasil kerja | chat | 1–3K tok | 420 |
| `services.js:2326` analisa bukti visual (batch 4 gambar) | document_evidence | ~7K tok | 9.000 |
| `services.js:2460` draft laporan (+retry quality gate) | document | 2–17K tok | 5.000–7.000 |
| `services.js:2833` quiz pemahaman | document_quiz | ~1.2K tok | 14.000 |

Ada eskalasi budget otomatis saat output terpotong: `maxOutputTokens × 3` sampai ceiling **32.768** (`ai.js:202,290-291`).

### 1.2 Kebutuhan fitur — YA/TIDAK dengan bukti kode

| Kebutuhan | Jawaban | Bukti |
|---|---|---|
| **Vision (analisa foto bukti)** | **YA — fitur inti** | `services.js:2324` kirim `inlineData` base64 (batch 4 gambar) untuk pipeline evidence; `services.js:1102,1223,1374` kirim gambar lampiran di chat. Tanpa vision, fitur pemetaan bukti praktikum mati. |
| **Structured output / JSON mode** | **YA — hard requirement** | 6 dari 8 call site pakai `responseJsonSchema` + `responseMimeType: 'application/json'`; hasil di-`JSON.parse` dan **gagal keras** (HTTP 502 `AI_INVALID_JSON` / `AI_EVIDENCE_INVALID`) kalau tidak valid. Ada deteksi truncation berbasis `finishReason: MAX_TOKENS` (`ai.js:198-200`). |
| **Function calling** | **TIDAK** | Nol `tools`/`functionDeclarations` di codebase. Pola router (ASK/RESPOND/GENERATE) diimplementasi via JSON enum, bukan tool call. |
| **Streaming ke frontend** | **TIDAK** | Semua call `generateContent` (non-stream). SSE di `index.js:3752` hanya stream progress job dari DB, bukan token. Generate jalan sebagai background job — latensi 20–30 detik per call bisa diterima. |
| **Reasoning/thinking mode** | YA (dipakai aktif) | Semua purpose dokumen pakai `mode: 'thinking'`; `thinkingConfig`/`thinkingLevel` dikirim (`ai.js:42-53`). Token thinking ikut kepotong dari budget output. |

**Minimal context window realistis per job:**
- Tokenisasi sample repo (BPE cl100k, via gpt-tokenizer): Modul-3-DHCP.pdf = 5.094 chars = **1.017 token**; MODUL_2-BDL.pdf = 11.023 chars = **2.450 token** → rasio teks teknis Indonesia ± **4,5–5 chars/token**.
- Cap di kode: modul di-slice 12.000 chars (≈2.600 tok), attachment 18.000 chars (≈3.900 tok), history chat 24.000 chars (≈5.200 tok), evidence notes 12.000 chars (≈2.600 tok).
- Worst case terukur di produksi: input **9.238 token** (draft), **7.024 token** (evidence, 4 gambar). Worst case teoretis chat penuh (history + attachment + 4 gambar): ±16K token input. Draft revisi menyertakan seluruh section lama: bisa 17K+, teoretis 40K+.
- Output diminta sampai 14K (quiz), ceiling retry 32K, dan thinking ikut dihitung.
- → **Floor: 32K context window. Aman: 64K+ dengan output cap ≥ 16K.** Provider yang meng-cap 8K input/context langsung gugur untuk pipeline dokumen.

### 1.3 Angka pemakaian nyata (ai_usage_events, 22–26 Juli 2026, n=188)

| Purpose | n sukses | Input p50/p90/max | Output p50/p90 | Total avg (incl. thinking) | Latensi p50 |
|---|---|---|---|---|---|
| chat | 78 | 1.088 / 2.529 / 3.399 | 158 / 326 | ~1.3K | 1,7 s |
| document (draft) | 34 | 1.921 / 4.291 / 9.238 | 844 / 1.217 | **7.1K** | 19 s |
| document_evidence | 27 | 6.975 / 7.024 / 7.024 | 503 / 804 | **9.5K** | 14 s |
| document_quiz | 4 | ~1.223 | ~1.768 | **7.2K** | 23 s |

Catatan: total >> input+output karena token thinking. Sudah tercatat **6× `GEMINI_RESOURCE_EXHAUSTED`** (429) di free tier Gemini saat ini — masalah kapasitas bukan hipotesis.

### 1.4 Estimasi beban — asumsi 50 user aktif/hari × 2 laporan/user

Profil call per laporan (dari jalur kode + rasio data nyata 25 Juli: 50 chat call vs 24 draft call, 34 draft sukses untuk 23 dokumen ≈ 1,5 call/dokumen):

| Komponen | Call/laporan | Token/call (total) |
|---|---|---|
| Chat router + workplan + summary | 4–6 | ~1.3K |
| Evidence (ceil(gambar/4), tipikal 4–8 gambar) | 1–2 | ~9.5K |
| Draft + rewrite quality-gate | 1,5 | ~7K |
| Quiz (opsional, ~25% dokumen) | 0,25 | ~7K |
| **Total per laporan** | **±9 call** | **±33K token** |

Proyeksi harian (100 laporan/hari):

| Metrik | Nilai | Pembanding aktual (peak 25 Jul) |
|---|---|---|
| Request/hari | **±1.000** | 101 |
| Token/hari (incl. thinking) | **±3,3M** (input murni ±1,5M; output ±0,4M) | 400K |
| Peak RPM (burst deadline 20:00–01:00, 40% job dalam 3 jam, 5–8 generate-job paralel; tiap job menembakkan 4–8 call berurutan) | **20–30 RPM** | 6 sukses/menit (15 incl. error) |
| Token/menit saat peak | 5–10K sustained, **burst 1 call = 7–9,5K** | — |

Skala linear: 300 user aktif/hari ≈ 6.000 req & 20M token/hari.

---

## 2. Matriks Kelayakan

Kebutuhan acuan: vision ✔, JSON schema ✔, context ≥32K, output ≥14K, ±1.000 req/hari, peak 20–30 RPM, ±3,3M tok/hari, app **komersial publik** (subscription berbayar via Midtrans), data = laporan + PII mahasiswa.

| Provider | context_fit | throughput_fit | vision | json_mode | tos_risk | privacy_risk | **Verdict** |
|---|---|---|---|---|---|---|---|
| GitHub Models | ✘ 8K in/4K out < quiz 14K & draft retry 7K | ✘ 50–150 req/hari vs 1.000 | ✔ | ✔ | **HIGH** (prototyping-only) | HIGH | **TIDAK COCOK** |
| Mistral La Plateforme | ✔ | ✔ 60 RPM, ~33M tok/hari | ✔ Pixtral | ✔ | MEDIUM (free = experiment plan) | **HIGH** (free tier dipakai training) | **COCOK BERSYARAT** |
| Groq | ✔ ctx | ✘✘ **6K TPM < 1 call evidence/draft (7–9,5K)** | ✔ | ✔ | LOW | MEDIUM | **TIDAK COCOK** |
| Cerebras | ✘ ctx cap 8K | ✘ 1M tok/hari < 3,3M | ✘ | ✔ | MEDIUM | MEDIUM | **TIDAK COCOK** |
| OpenRouter :free | ✔ (Maverick 1M) | △ 20 RPM mepet; 1.000 req/hari **hanya** dgn top-up $10, tanpa headroom | ✔ | △ per-model | MEDIUM (roster rotasi) | HIGH (logging per-provider) | **COCOK BERSYARAT** |
| NVIDIA NIM | ✔ | ✘ ~1.000 credits one-time ≈ 1 hari beban | ✔ | △ | **HIGH** (evaluation-only) | MEDIUM | **TIDAK COCOK** |
| Cloudflare Workers AI | △ | ✘ neurons harian habis cepat di model besar | △ terbatas | △ | LOW | MEDIUM | **TIDAK COCOK** |
| Z.ai | ✔ 200K ctx | ✘ **1 concurrent** vs 5–8 job paralel | ✘ (GLM-Flash text) | ✔ | **HIGH** (non-commercial carve-out) | MEDIUM | **TIDAK COCOK** |
| Cohere | ✔ | ✘✘ ~1.000 call/**bulan** ≈ kebutuhan 1 hari | ✘ Command | ✔ | HIGH (trial) | MEDIUM | **TIDAK COCOK** |

*(Kolom streaming dihilangkan: tidak dibutuhkan — semua call non-stream via background job.)*

**Alasan 1 kalimat per provider:**
- **GitHub Models — TIDAK COCOK:** cap 4K output membunuh quiz (14K) dan draft-retry (7K), kuota 50–150 req/hari cuma 5–15% kebutuhan, dan ToS prototyping-only tidak sah untuk app berbayar publik.
- **Mistral — COCOK BERSYARAT:** satu-satunya free tier yang muat kapasitas (60 RPM, ~1B tok/bulan) plus vision (Pixtral) dan JSON schema, tapi free tier dipakai training — wajib strip PII mahasiswa dari prompt + verifikasi nomor HP + adapter API.
- **Groq — TIDAK COCOK:** limit 6K TPM (org-level) lebih kecil dari SATU call evidence/draft Laprakin (7–9,5K token), jadi pipeline dokumen tidak bisa jalan sama sekali.
- **Cerebras — TIDAK COCOK:** context di-cap 8K (butuh 16K+ input), tidak ada vision untuk fitur bukti, dan 1M token/hari di bawah kebutuhan 3,3M.
- **OpenRouter :free — COCOK BERSYARAT:** dengan status top-up $10 (1.000 req/hari) dan Llama 4 Maverick (vision, 1M ctx) angkanya pas tapi tanpa headroom dan roster :free bisa rotasi — layak sebagai fallback pool, bukan primary.
- **NVIDIA NIM — TIDAK COCOK:** kredit one-time habis dalam ±1 hari beban penuh dan ToS evaluation-only melarang produksi.
- **Cloudflare Workers AI — TIDAK COCOK:** kuota neurons harian habis terlalu cepat di model kelas 100B+ untuk 3,3M token/hari, dan dukungan vision + JSON schema di katalognya tambal sulam (paling banter buat CS bot 180-token).
- **Z.ai — TIDAK COCOK:** carve-out non-commercial bertabrakan langsung dengan subscription berbayar Laprakin, dan 1 concurrent request membuat antrian job deadline-malam menumpuk (boleh dipakai untuk dev/staging).
- **Cohere — TIDAK COCOK:** ±1.000 call/bulan setara kebutuhan satu hari, dan keluarga Command di trial tidak punya vision.

**Temuan lintas provider (penting):** kode saat ini *hard-wired* ke Gemini — endpoint, parsing `candidates/usageMetadata/finishReason`, `thinkingConfig`, `safetySettings`, format schema Gemini (`type: 'OBJECT'`), error code `GEMINI_*`, validasi key `^AIza`, sampai model fallback chain (`ai.js` keseluruhan; `config.js:81`). **Tidak ada provider di atas yang drop-in.** Migrasi apa pun = refactor `ai.js` ke klien OpenAI-compatible atau lewat proxy LiteLLM. Selain itu `services.js:1344-1351` mengirim PII (nama, NIM, kelas, institusi, nama+NIP dosen) di prompt router chat — untuk provider yang training dari data free tier, ini bocoran data pribadi, bukan cuma laporan.

---

## 3. Rekomendasi Routing

**Reality check dulu:** kombinasi free tier yang benar-benar bisa menampung beban tanpa mematikan fitur inti cuma **Mistral (primary) + OpenRouter :free (fallback)** — dan dua-duanya bersyarat. Sementara total biaya paid untuk beban yang sama cuma **~$15–25/bulan** (lihat §5). Kalau tujuan free tier adalah hemat, bandingkan dengan jam engineering untuk refactor + juggling kuota.

Kalau tetap jalan free-tier:

| Peran | Model | Alasan |
|---|---|---|
| **Primary — draft, router, quiz** | `mistral/mistral-medium-latest` | Kuota terbesar, JSON schema, 60 RPM |
| **Primary — evidence (vision)** | `mistral/pixtral-large-latest` | Satu-satunya vision free-tier berkapasitas cukup |
| **Fallback saat 429/5xx** | `openrouter/meta-llama/llama-4-maverick:free` | Vision + 1M ctx; wajib akun dengan top-up $10 |
| **Task-specific: long-doc** (modul >100K tok) | `openrouter/meta-llama/llama-4-maverick:free` | Context 1M |
| **Task-specific: support bot / fast** | `mistral/mistral-small-latest` | Output cuma 180 token, tidak perlu model besar |
| **Dev/staging saja** | `zai/glm-4.7-flash` | 200K ctx gratis; carve-out non-commercial melarang produksi |

Prasyarat sebelum route apa pun ke provider non-Gemini:
1. **Strip PII** dari `taskContext` (identitas hanya dipakai untuk cover DOCX secara lokal, tidak perlu ada di prompt).
2. Refactor `requestGemini()` → klien OpenAI-compat (atau arahkan ke LiteLLM proxy), termasuk mapping `responseJsonSchema` → `response_format.json_schema` dan gambar `inlineData` → `image_url` base64.
3. Update consent copy (`EXTERNAL_AI_CONSENT_KEY`) karena data pindah pihak ketiga baru.

## 4. Contoh Config LiteLLM (routing + fallback 429)

```yaml
# litellm-config.yaml — Laprakin
model_list:
  # ---- grup teks utama (draft, router chat, quiz) ----
  - model_name: laprakin-draft
    litellm_params:
      model: mistral/mistral-medium-latest
      api_key: os.environ/MISTRAL_API_KEY
      rpm: 50            # jaga di bawah ~1 RPS free tier
  - model_name: laprakin-draft-free   # fallback pool
    litellm_params:
      model: openrouter/meta-llama/llama-4-maverick:free
      api_key: os.environ/OPENROUTER_API_KEY
      rpm: 18            # di bawah cap 20 RPM

  # ---- grup vision (analisa bukti, lampiran gambar chat) ----
  - model_name: laprakin-vision
    litellm_params:
      model: mistral/pixtral-large-latest
      api_key: os.environ/MISTRAL_API_KEY
      rpm: 50
  - model_name: laprakin-vision-free
    litellm_params:
      model: openrouter/meta-llama/llama-4-maverick:free
      api_key: os.environ/OPENROUTER_API_KEY
      rpm: 18

  # ---- support bot (output 180 token) ----
  - model_name: laprakin-support
    litellm_params:
      model: mistral/mistral-small-latest
      api_key: os.environ/MISTRAL_API_KEY

router_settings:
  routing_strategy: simple-shuffle
  num_retries: 2
  timeout: 120
  allowed_fails: 3           # setelah 3 gagal, cooldown deployment
  cooldown_time: 60
  fallbacks:                 # dipicu saat 429 / provider error
    - laprakin-draft: ["laprakin-draft-free"]
    - laprakin-vision: ["laprakin-vision-free"]
  context_window_fallbacks:  # modul super panjang -> Maverick 1M ctx
    - laprakin-draft: ["laprakin-draft-free"]

litellm_settings:
  drop_params: true          # buang param yang tidak didukung provider tujuan
```

Server Laprakin lalu memanggil `http://litellm:4000/v1/chat/completions` dengan `model: "laprakin-draft"` dst. — retry/fallback 429 ditangani proxy, dan `ai.js` cukup diganti sekali ke format OpenAI.

## 5. Trigger Wajib Migrate ke Paid + Estimasi Biaya

Migrate begitu **salah satu** terpenuhi:

1. **Volume:** request/hari sustained > **700** (70% cap fallback OpenRouter) atau token/hari > **20M** (≈60% pro-rata 1B/bulan Mistral) — di kurva pertumbuhan Laprakin itu ±**300 user aktif/hari**.
2. **Reliabilitas:** error 429/5xx > **2–3% per hari selama 7 hari**, atau keluhan "draft gagal" di jam deadline (aktual sekarang saja sudah ada 6× RESOURCE_EXHAUSTED dengan <10 user).
3. **Privasi/compliance:** ada kampus atau user yang minta jaminan *no-training* — tidak ada free tier di daftar ini yang bisa menjaminnya; ini trigger non-negosiabel karena prompt memuat data mahasiswa.
4. **ToS:** provider mengubah syarat free tier (roster :free OpenRouter, experiment plan Mistral) — anggap bisa hilang kapan saja.

**Estimasi biaya paid @ 100 laporan/hari** (baseline DeepSeek ~$0.14/M input, ~$0.28–1.10/M output):

| Komponen | Volume/bulan | Biaya |
|---|---|---|
| Teks (draft, router, quiz) — DeepSeek | in ±45M, out ±12M | $6,3 + $3–13 |
| Vision (evidence) — DeepSeek tidak punya vision; pakai Gemini Flash-Lite paid (~$0.10/$0.40) | in ±32M, out ±2M | $3,2 + $0,8 |
| **Total** | | **≈ $15–25/bulan (± Rp250–400rb)** |

Skala linear: 300 user aktif/hari ≈ $45–75/bulan. Catatan: tetap di Gemini paid (Flash-Lite $0.10/M in) menghasilkan angka yang hampir sama **tanpa refactor apa pun** — opsi dengan total cost of ownership terendah.

---

## Lampiran: Benchmark Empiris (Step 4)

Skrip: `scripts/bench-providers/bench.mjs` (Node, tanpa dependency).
- Payload: ~3.075 token teks praktikum **sintetis** (bukan file user — file upload asli tidak boleh dikirim ke provider pihak ketiga) + instruksi bab "Pembahasan", output JSON `{judul, isi}`.
- Ukur: latensi total, TTFT (via streaming), token in/out, validitas JSON; raw output → `bench-results/` (sudah masuk `.gitignore`).
- Max 3 request/provider; provider tanpa key di-SKIP; key dibaca dari `.env` / `server/.env`.
- Status 26 Juli 2026: **belum ada API key provider mana pun di env** → semua SKIP, belum ada angka empiris. Gemini produksi sengaja di-gate `BENCH_INCLUDE_GEMINI=1` supaya tidak memakan kuota diam-diam.

```bash
node scripts/bench-providers/bench.mjs
```

Isi key per provider (`MISTRAL_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, dst.) lalu jalankan ulang; model bisa dioverride via `BENCH_MODEL_<PROVIDER>`.
