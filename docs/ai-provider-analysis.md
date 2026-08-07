# Arsitektur AI Laprakin

Laprakin memakai NaraRouter sebagai satu-satunya provider AI utama melalui API OpenAI-compatible:

`https://router.bynara.id/v1`

Server menyimpan `NARAROUTER_API_KEY` hanya di environment backend. Key tidak pernah dikirim ke browser.

## Discovery dan routing

Saat startup server mengambil `GET /v1/models` dan menyimpan capability registry di `LAPRAKIN_DATA_DIR/ai-model-registry.json`. Registry mencatat model, provider, batas konteks, dukungan vision, reasoning, structured output, dan tools. Jika discovery sementara gagal, cache terakhir tetap dipakai; tanpa key atau model text yang valid, readiness tetap gagal secara terkontrol.

`selectAiRoute()` memilih model berdasarkan workload dan capability aktual:

| Workload | Preferensi | Effort |
| --- | --- | --- |
| chat/support/router | model text medium yang ditemukan | low/medium |
| document/workplan/quiz | Mistral Medium 3.5 jika tersedia | medium/high |
| visual evidence/screenshot | StepFun 3.7 Flash jika capability vision tersedia | medium/high |
| repair/review/hard reasoning | Mistral Large jika tersedia | high |

Nama model tidak dikirim sebagai alias buatan. `auto` selalu di-resolve lokal dari registry. Model yang tidak mengiklankan vision tidak pernah menerima permintaan gambar.

## Fallback dan kualitas

Fallback hanya dipicu oleh kegagalan deterministik: 429, 5xx, timeout, empty response, model unavailable, output terpotong, JSON invalid, schema failure, atau bagian laporan yang hilang. Fallback text mengikuti urutan model kompatibel di registry, lalu Cloudflare Workers AI hanya bila `CLOUDFLARE_AI_ENABLED=true` dan credential-nya lengkap. Tidak ada fallback diam-diam ke provider lain.

Output terstruktur divalidasi sebelum diterima. Model yang mendukung native structured output memakainya; model lain menerima instruksi schema ketat dan hasilnya tetap diparse serta divalidasi server-side.

## Quota dan observability

Semua request melewati global FIFO queue dengan prioritas job dokumen, batas `NARAROUTER_MAX_RPM=8`, concurrency `NARAROUTER_MAX_CONCURRENCY=2`, exponential backoff, jitter, dan dukungan retry provider. Setiap model memiliki circuit breaker sendiri.

`ai_usage_events` menyimpan provider, model, purpose, mode, input/output/reasoning/total tokens, latency, status, error code, fallback count, dan fallback reason. Prompt, output, file, dan dokumen privat tidak disimpan.
