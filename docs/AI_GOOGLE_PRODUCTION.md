# AI + Google Login Production

## Yang perlu disiapkan pemilik produk

1. **Domain HTTPS final** untuk `APP_URL` dan `API_URL`. Tentukan sekarang apakah keduanya satu domain atau split domain.
2. **Project Google Cloud/AI Studio** dengan billing dan quota alert aktif.
3. **Gemini auth key atau restricted key** khusus backend Laprakin. Simpan di secret manager sebagai `GEMINI_API_KEY`; jangan pernah memakai prefix `VITE_`.
4. **Google OAuth Web client** dengan consent screen, privacy policy, terms, support email, dan domain terverifikasi.
5. **Authorized redirect URI** yang cocok persis dengan `https://<API_URL>/api/auth/google/callback`.
6. **Akun uji Google** selama consent screen masih berstatus Testing, lalu publish/verify sebelum public launch.
7. **SMTP production**, **Midtrans production**, persistent database/storage, backup terenkripsi, monitoring error, uptime check, dan alert biaya.
8. **Data legal**: Privacy Policy harus menyebut isi chat/file yang dikirim ke provider AI ketika opsi external AI aktif, tujuan pemrosesan, retensi, dan cara penghapusan.

## Checklist console untuk `laprakin.app`

- Google OAuth application type: **Web application**.
- Authorized JavaScript origin: `https://laprakin.app`.
- Authorized redirect URI: `https://laprakin.app/api/auth/google/callback` tanpa trailing slash.
- OAuth consent screen homepage: `https://laprakin.app/`.
- Privacy Policy: `https://laprakin.app/privacy`.
- Terms of Service: `https://laprakin.app/terms`.
- Authorized domain: `laprakin.app`, lalu verifikasi kepemilikan domain melalui Google Search Console.
- Selama app berstatus Testing, tambahkan akun Google penguji. Sebelum public launch, publish ke Production dan selesaikan brand verification bila diminta Google.
- Batasi API key hanya untuk **Generative Language API / Gemini API**. Tambahkan pembatasan IP hanya setelah outbound IP Azure dipastikan statis.
- Atur project spend cap dan usage alert di Google AI Studio. Limit internal Laprakin tidak menggantikan limit billing provider.

## Perilaku yang sudah diimplementasikan

- Workspace chat memanggil Gemini sungguhan; respons regex lama telah dihapus.
- Basic, Thinking, XtraThink, dokumen, dan support dapat memakai model stable yang berbeda.
- API key dikirim melalui header `x-goog-api-key` dari backend saja.
- Request AI memiliki timeout, retry terbatas untuk error sementara, quota per user, serta metering token/latency tanpa menyimpan prompt atau output.
- Lampiran dipotong berdasarkan batas karakter/ukuran. Prompt sistem melarang fabrikasi data dan memperlakukan isi file sebagai input tidak tepercaya.
- Dokumen memakai structured JSON output dan tetap divalidasi sebelum disimpan.
- Google login memakai Authorization Code, state, nonce, PKCE S256, one-time state, signature RS256, cache JWKS, audience/issuer/expiry/nonce/authorized-party checks, serta timeout jaringan.
- Akun Google-only dapat membuat kata sandi melalui link email tanpa memutus koneksi Google.
- State OAuth, token reset yang kedaluwarsa, dan telemetry AI lama dibersihkan otomatis oleh retention worker.
- Homepage, Privacy Policy, dan Terms of Service tersedia sebagai route publik pada domain production.
- Production gagal start bila credential wajib belum lengkap atau model memakai alias preview/latest/deprecated.

## Environment production

Gunakan `server/.env.production.example` sebagai template production dan `docs/CLOUDFLARE_GO_LIVE.md` untuk cutover domain, lalu set minimal:

```env
NODE_ENV=production
AI_REQUIRED=true
GEMINI_API_KEY=...
GEMINI_MODEL_XTRATHINK=gemini-3.6-flash
AI_MAX_REQUESTS_PER_DAY=5000
MANUAL_EMAIL_AUTH_ONLY=false
GOOGLE_OAUTH_REQUIRED=true
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://app.domain.id/api/auth/google/callback
```

Pin model stable eksplisit. Jangan memakai alias `latest`, model `preview`, `experimental`, atau model yang sudah masuk jadwal shutdown.

## Verifikasi sebelum launch

1. Setelah seluruh secret production terpasang, jalankan `NODE_ENV=production npm run verify:production`. Perintah ini memeriksa konfigurasi, integritas database, write access storage, akses key ke seluruh model Gemini, dan Google OIDC Discovery tanpa melakukan generate berbayar.
2. Jalankan `npm ci`, `npm run build`, `npm run test:smoke`, `npm run test:e2e`, `npm run test:ai-auth`, dan `npm audit --omit=dev`.
   Untuk menguji generasi nyata seluruh mode dengan request kecil, jalankan `npm run test:ai-live`.
3. Buka `/api/health/ready`; pastikan status AI dan Google `configured`.
4. Dari akun admin, panggil `POST /api/admin/integrations/check` dan pastikan semua model serta OIDC berstatus sehat.
5. Uji login Google: berhasil, user membatalkan, state salah, callback diulang, dan akun email yang sudah ada.
6. Uji chat tiap mode, dokumen dengan PDF/DOCX/gambar, provider timeout, 429, dan quota user.
7. Pantau `GET /api/admin/ai/usage?days=30`. Endpoint hanya mengembalikan jumlah call, token, latency, model, dan error—tanpa prompt atau output.
8. Periksa tabel `ai_usage_events` hanya berisi metadata operasional—tidak boleh ada prompt, isi file, atau output AI.
9. Uji backup/restore database, upload, dan public media.
10. Jalankan DAST pada staging yang identik dengan production dan lakukan review manual otorisasi horizontal untuk setiap resource user.

Tidak ada sistem yang dapat dijamin “100% tidak bisa ditembus”. Target production yang benar adalah defense-in-depth, pengujian berulang, patch dependency, monitoring, incident response, dan bukti bahwa kontrol kritis bekerja.

## Diagnostik tanpa membocorkan credential

- Gunakan `npm run verify:production` untuk memeriksa model Gemini, Google OIDC, database, storage, dan client bundle.
- Gunakan `/api/health/ready` untuk probe uptime. Jangan memakai `docker compose config`, `docker inspect`, atau `printenv` sebagai output support karena environment production dapat ikut tercetak.
- Jangan pernah mengirim API key atau client secret melalui screenshot, chat, command output, atau issue tracker.
- Setelah rotasi, jalankan `npm run test:ai-live`, verifikasi SMTP tanpa mengirim email, dan lakukan satu login Google nyata sebelum mencabut credential lama.
