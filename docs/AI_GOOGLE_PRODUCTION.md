# Konfigurasi AI production

Dokumen ini dipertahankan untuk kompatibilitas tautan lama. Provider production Laprakin adalah NaraRouter, bukan layanan Google AI.

Set minimum backend:

```dotenv
AI_REQUIRED=true
NARAROUTER_API_KEY=...
NARAROUTER_BASE_URL=https://router.bynara.id/v1
NARAROUTER_MAX_RPM=8
NARAROUTER_MAX_CONCURRENCY=2
AI_MODEL_DOCUMENT=auto
AI_MODEL_VISION=auto
AI_MODEL_REVIEWER=auto
AI_MODEL_CHAT=auto
```

Server mengambil `/v1/models` saat startup dan menggunakan cache capability bila discovery sementara gagal. Production readiness membutuhkan key, registry yang berhasil diambil atau cache yang valid, serta sekurangnya satu model text yang kompatibel. Vision dilaporkan terpisah dan tidak membuat server gagal start ketika sementara tidak tersedia.

Cloudflare Workers AI hanya emergency fallback opsional dan tidak diperlukan untuk startup:

```dotenv
CLOUDFLARE_AI_ENABLED=false
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_AI_TOKEN=
CLOUDFLARE_AI_MODEL=@cf/google/gemma-4-26b-a4b-it
```

Semua credential hanya berada di server. Admin hanya melihat metadata operasional dari `ai_usage_events`.
