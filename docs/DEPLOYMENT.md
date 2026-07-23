# Deployment Notes 窶・Laprakin V21 QRIS

Dokumen ini untuk **private beta single-instance**. Jangan membuka aplikasi untuk publik sebelum item keamanan, legal, dan operasional di bawah benar-benar ditangani.

## 1. Environment production minimal

```env
NODE_ENV=production
PORT=4000
APP_URL=https://app.domain-kamu.id
API_URL=https://app.domain-kamu.id
ALLOWED_ORIGINS=https://app.domain-kamu.id
TRUST_PROXY_HOPS=1

JWT_SECRET=panjang-random-minimal-32-karakter
DEVICE_HMAC_SECRET=secret-acak-berbeda
TOKEN_HMAC_SECRET=secret-token-acak-berbeda

EMAIL_MODE=smtp
MAIL_FROM=Laprakin <noreply@domain-kamu.id>
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_SECURE=false

AI_REQUIRED=true
GEMINI_API_KEY=secret-dari-google-ai-studio
GEMINI_MODEL_BASIC=gemini-3.5-flash-lite
GEMINI_MODEL_THINKING=gemini-3.6-flash
GEMINI_MODEL_XTRATHINK=gemini-3.6-flash
GEMINI_MODEL_DOCUMENT=gemini-3.5-flash
GEMINI_MODEL_SUPPORT=gemini-3.5-flash-lite
AI_REQUEST_TIMEOUT_MS=45000
AI_MAX_RETRIES=2
AI_MAX_REQUESTS_PER_HOUR=60
AI_MAX_REQUESTS_PER_DAY=5000

MANUAL_EMAIL_AUTH_ONLY=false
GOOGLE_OAUTH_REQUIRED=true
GOOGLE_OAUTH_CLIENT_ID=web-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=google-client-secret
GOOGLE_OAUTH_REDIRECT_URI=https://app.domain-kamu.id/api/auth/google/callback
GOOGLE_REQUEST_TIMEOUT_MS=10000
REFERRAL_HOLD_DAYS=7
PAYMENTS_MODE=midtrans
MIDTRANS_ENVIRONMENT=production
MIDTRANS_IS_PRODUCTION=true
MIDTRANS_SERVER_KEY=midtrans-server-key
MIDTRANS_CLIENT_KEY=midtrans-client-key
MIDTRANS_VERIFY_STATUS=true

MAX_UPLOAD_MB=20
MAX_FILES_PER_UPLOAD=12
MAX_FILES_PER_DOCUMENT=40
SESSION_DAYS=30
JOB_POLL_MS=750
JOB_MAX_ATTEMPTS=2
RETENTION_SWEEP_MINUTES=60
```

## 2. Docker deployment

```bash
cp server/.env.example server/.env
# isi semua environment production

docker compose up -d --build
```

Gunakan reverse proxy TLS (misalnya Caddy, Nginx, Cloudflare Tunnel, atau platform deployment pilihanmu) di depan port 4000. Paksa HTTPS untuk domain publik.

### Render Blueprint

Repository menyediakan `render.yaml` untuk satu web service Docker di region Singapore dengan persistent disk. Saat membuat Blueprint, isi seluruh variable yang ditandai `sync: false` langsung di dashboard Render. Jangan menaruh nilainya di repository.

Persistent disk memakai mount `/var/data/laprakin` untuk database, upload privat, dan media CMS. Deployment tanpa disk persisten hanya cocok untuk preview karena data akan hilang ketika instance diganti atau restart.

## 3. Before public beta

- [ ] Secret production dibuat ulang, tidak memakai default.
- [ ] HTTPS aktif.
- [ ] SMTP transactional diuji.
- [ ] Database dan uploads masuk backup terenkripsi.
- [ ] Folder `server/public-media/` masuk backup agar gambar CMS tidak hilang.
- [ ] Restore backup pernah diuji, bukan hanya dibuat.
- [ ] Turnstile atau anti-bot provider dipasang dan diverifikasi server-side.
- [ ] Midtrans Server Key dan Client Key production sudah diisi.
- [ ] Notification URL Midtrans diarahkan ke `/api/payments/midtrans/notification`.
- [ ] Channel QRIS Midtrans sudah aktif untuk akun merchant.
- [ ] Checkout Snap hanya menampilkan QRIS (`other_qris`).
- [ ] Payment provider, Status API, dan webhook signature diuji pada sandbox.
- [ ] Uji ulang webhook yang sama untuk memastikan credit/subscription tidak digandakan.
- [ ] Error monitoring dan alerting dipasang.
- [ ] Terms of Use, Privacy Policy, dan Academic Use Policy tersedia.
- [ ] Alur hapus akun dan support access diuji.
- [ ] User test dengan bahan praktikum nyata yang sudah diizinkan dilakukan.
- [ ] Tidak ada API key di browser/client bundle.
- [ ] Gemini auth key/restricted key, billing alert, quota, dan model stable sudah diverifikasi.
- [ ] Google OAuth consent screen dipublish dan redirect URI production cocok persis.
- [ ] `/api/health/ready` mengembalikan `ai: configured` dan `googleOauth: configured`.
- [ ] `NODE_ENV=production npm run verify:production` lulus menggunakan secret dan domain production yang sebenarnya.
- [ ] Admin memantau `/api/admin/ai/usage` untuk lonjakan call, token, latency, dan error provider.
- [ ] `ADMIN_EMAIL` memakai akun khusus admin dan password manager; jangan memakai akun harian.
- [ ] MFA admin atau identity-aware proxy aktif sebelum akses admin dibuka ke internet.
- [ ] Antivirus/malware scanner untuk upload aktif sebelum menerima file publik berskala besar.

## 4. Keterbatasan arsitektur saat ini

Job queue V3 dijalankan satu process Node dan statusnya disimpan di SQLite. Itu cocok untuk local/private beta atau satu server kecil. Saat traffic bertambah, pindahkan job worker ke Redis/BullMQ dan storage file ke S3/R2/private object storage.

## 5. Backups

Backup minimal mencakup:

1. `server/data/laprakin.sqlite`.
2. Folder private `server/uploads/`.
3. Folder `server/public-media/` untuk gambar landing dan feature update.
4. `.env` disimpan terpisah dan aman, bukan di repository.

Simpan backup terenkripsi. Jangan menyimpan file laporan atau database user pada repository Git.

## 6. QRIS production checklist

- Gunakan `PAYMENTS_MODE=midtrans`, `MIDTRANS_ENVIRONMENT=production`, dan HTTPS publik.
- Daftarkan `https://api.domain-kamu.id/api/payments/midtrans/notification` sebagai Payment Notification URL di dashboard Midtrans.
- Konfigurasikan merchant display name dan logo resmi **Laprakin** di dashboard sesuai data legal akun.
- Jangan menaruh Server Key di client/Vite/environment browser.
- Baca `docs/PAYMENTS_MIDTRANS.md` sebelum membuka transaksi publik.

## 7. AI dan Google login

Ikuti checklist rinci pada `docs/AI_GOOGLE_PRODUCTION.md`. Production sengaja gagal start bila `AI_REQUIRED=true` atau `GOOGLE_OAUTH_REQUIRED=true` tetapi credential belum lengkap.

## 8. Penanganan secret dan diagnostik aman

- Jangan menyalin output `docker compose config`, `docker inspect`, `printenv`, atau isi `server/.env` ke chat, issue, log publik, maupun tiket support. Perintah tersebut dapat menampilkan seluruh credential production.
- Gunakan `npm run verify:production`, `/api/health/ready`, dan panel **Admin 竊・AI & Login** untuk pemeriksaan operasional. Ketiganya hanya menampilkan status dan metadata aman.
- Pastikan `server/.env` dimiliki operator deployment, permission `0600`, tidak masuk image, dan tidak pernah masuk repository.
- Jika secret sempat tampil, anggap telah bocor: buat credential baru, deploy, verifikasi integrasi, lalu cabut credential lama. Rotasi `JWT_SECRET`, `DEVICE_HMAC_SECRET`, dan `TOKEN_HMAC_SECRET` juga mengakhiri sesi lama.
- Gemini API key harus dibatasi hanya ke `generativelanguage.googleapis.com`. Resend SMTP memakai key `sending_access`, bukan `full_access`.
- Google OAuth client secret dan Midtrans Server Key harus dirotasi dari dashboard provider; lakukan deploy dan verifikasi sebelum menonaktifkan secret lama agar downtime minimum.

