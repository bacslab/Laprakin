# Deployment Notes - Laprakin V22 Production Private Beta

Dokumen ini untuk **private beta single-instance**. Production saat ini berjalan di `https://laprakin.app` melalui Docker Compose pada VPS. Jangan membuka aplikasi untuk publik luas sebelum item keamanan, legal, payment, monitoring, dan operasional di bawah benar-benar ditangani.

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

### Production VPS saat ini

- Domain publik: `https://laprakin.app`.
- Runtime: Docker Compose single-instance.
- Revision production terakhir yang terdokumentasi: `a9a2c92`.
- Health check publik: `https://laprakin.app/api/health/ready`.
- Health ready yang sehat mengembalikan database `ready`, worker `idle`, AI `configured`, dan Google OAuth `configured`.
- Static media tutorial harus tersaji sebagai `video/webm`, bukan fallback `text/html`.
- Source rollback terakhir disimpan di VPS sebagai `/opt/laprakin-rollback-20260725T184021Z`.
- Repository di server production bukan working tree Git; deployment dilakukan dari archive source revision yang sudah dipush.

### Render Blueprint

Repository menyediakan `render.yaml` untuk satu web service Docker di region Singapore dengan persistent disk. Saat membuat Blueprint, isi seluruh variable yang ditandai `sync: false` langsung di dashboard Render. Jangan menaruh nilainya di repository.

Persistent disk memakai mount `/var/data/laprakin` untuk database, upload privat, dan media CMS. Deployment tanpa disk persisten hanya cocok untuk preview karena data akan hilang ketika instance diganti atau restart.

Catatan: deployment production aktif saat ini bukan Render. Render blueprint tetap disimpan sebagai opsi deployment alternatif.

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
- [ ] Admin memantau `/api/admin/alerts` atau SSE `/api/admin/events` untuk job gagal dan credit recovery.
- [ ] Endpoint admin credit grant diuji dengan target satu user, semua user, dan user paid.
- [ ] Contract test template DOCX lulus setelah template default atau logic export diubah.
- [ ] Quiz/download gate diuji untuk user Free, credit satuan, dan subscription.
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

Repository menyediakan `ops/backup-laprakin.sh` dan systemd timer untuk snapshot SQLite yang konsisten, upload privat, serta media CMS. Backup dienkripsi AES-256-CBC/PBKDF2 dan disimpan 30 hari secara default.

```bash
sudo install -d -o root -g root -m 700 /var/backups/laprakin
sudo install -m 0644 ops/laprakin-backup.service /etc/systemd/system/
sudo install -m 0644 ops/laprakin-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now laprakin-backup.timer
sudo systemctl start laprakin-backup.service
```

### Arsip dan kunci enkripsi berada di luar direktori aplikasi

Arsip disimpan di `/var/backups/laprakin/` dan kuncinya di `/var/backups/laprakin/.backup-key`, **bukan** di dalam `/opt/laprakin`. Ini wajib: proses deploy merotasi `/opt/laprakin` menjadi `/opt/laprakin-rollback-*`, sehingga arsip dan kunci yang berada di dalamnya akan terlantar. Karena skrip membuat kunci baru bila file kunci tidak ditemukan, kondisi itu membuat seluruh arsip lama **permanen tidak dapat didekripsi**.

Unit systemd memanggil skrip lewat `/bin/bash` karena deploy dari archive dapat menghapus bit executable (`status=203/EXEC` bila dipanggil langsung).

Unit backup berjalan sebagai `root` karena Docker Compose perlu membaca `server/.env` yang tetap dijaga `root:root` dengan permission `0600`; permission secret tidak perlu dilonggarkan hanya agar backup berjalan.

Salin `.backup-key` ke password manager/secret vault terpisah, dan sinkronkan arsip ke object storage privat. Backup lokal pada disk VM yang sama bukan pengganti backup offsite.

### Lapisan Azure

Selain backup aplikasi di atas, VM dilindungi Recovery Services vault `rsv-laprakin-prod` (resource group `RG-LAPRAKIN-PROD`, region `australiaeast`) dengan `DefaultPolicy` harian. Snapshot manual dapat dibuat kapan saja; sertakan `--location australiaeast` secara eksplisit karena policy region subscription menolak permintaan tanpa lokasi.

```bash
az snapshot create -g RG-LAPRAKIN-PROD -n snap-laprakin-$(date +%Y%m%d) \
  --source disk-laprakin-prod-au --location australiaeast --sku Standard_LRS
```

### Uji restore

Restore diverifikasi dengan mendekripsi arsip terbaru ke direktori sementara, lalu memeriksa `PRAGMA integrity_check` pada SQLite hasil ekstraksi. Lakukan minimal sekali setiap kali skrip backup atau skema database berubah.

## 4a. Deploy otomatis dari GitHub

Model **tarik**, bukan dorong. VM yang memeriksa GitHub, karena port 22 dibatasi ke IP operator sedangkan runner GitHub Actions ber-IP dinamis. Konsekuensinya baik: tidak ada port yang perlu dibuka, dan tidak ada private key SSH yang dititipkan sebagai secret di GitHub.

### Alur

1. Commit masuk ke `main`.
2. Workflow `test.yml` menjalankan unit test dan `npm audit`.
3. Job `release` memajukan branch `release` ke commit tersebut **hanya bila keduanya lulus**.
4. `laprakin-deploy.timer` di VM memeriksa `release` setiap lima menit.
5. Bila ada revisi baru: backup → `git archive` ke `/opt/laprakin` → build `laprakin-laprakin:candidate` → jalankan container **canary** terisolasi di port 4555 dengan data sementara → tunggu `/api/health/ready` → baru promosikan ke `latest` dan restart produksi.

Commit yang gagal test tidak pernah mencapai `release`. Image yang gagal boot tidak pernah dipromosikan; produksi tetap melayani image lama. Bila produksi ternyata tidak sehat setelah promosi, skrip mengembalikan `laprakin-laprakin:previous` tanpa menunggu operator.

Canary bukan formalitas: deploy 26 Juli 2026 sempat membuat produksi crash-loop karena sebuah rute memakai `const` multer yang dideklarasikan ratusan baris di bawahnya. `node --check` meloloskannya karena sintaksnya sah. Hanya menjalankan modulnya yang menangkap kelas kesalahan ini.

### Pemasangan

```bash
sudo install -o root -g root -m 750 ops/laprakin-deploy.sh /usr/local/bin/
sudo install -m 0644 ops/laprakin-deploy.service ops/laprakin-deploy.timer /etc/systemd/system/
sudo install -d -o root -g root -m 700 /var/lib/laprakin-deploy
sudo ssh-keygen -t ed25519 -N "" -C "laprakin-vm-deploy-readonly" -f /var/lib/laprakin-deploy/deploy-key
sudo systemctl daemon-reload && sudo systemctl enable --now laprakin-deploy.timer
```

Daftarkan `deploy-key.pub` di **GitHub → repository → Settings → Deploy keys**, **tanpa** mencentang write access. Kunci ini hanya perlu membaca. Selama belum didaftarkan, skrip keluar diam-diam tanpa mengirim notifikasi agar inbox tidak dibanjiri selama setup.

### Operasi harian

```bash
sudo systemctl start laprakin-deploy.service         # deploy sekarang, tanpa menunggu timer
sudo journalctl -u laprakin-deploy.service -n 40     # riwayat deploy
cat /var/lib/laprakin-deploy/deployed-revision       # revisi yang sedang aktif
```

Rollback manual bila diperlukan:

```bash
docker tag laprakin-laprakin:previous laprakin-laprakin:latest
cd /opt/laprakin && docker compose up -d --no-build
```

Kosongkan `deployed-revision` untuk memaksa deploy ulang pada siklus berikutnya. Untuk membekukan deployment sementara, `sudo systemctl stop laprakin-deploy.timer`.

### Batas yang perlu disadari

Tidak ada environment staging. Commit yang lulus test dan berhasil boot akan langsung dilihat pengguna, meskipun secara fungsional keliru. Gerbang yang ada menahan kegagalan test dan kegagalan boot, bukan kekeliruan logika.

## 5a. Monitoring dan alert

Dua lapis, karena keduanya buta terhadap hal yang berbeda.

**Azure Monitor** memantau metrik host dan mengirim email lewat action group `ag-laprakin-ops`:

| Alert | Kondisi | Severity |
| --- | --- | --- |
| `alert-laprakin-vm-down` | `VmAvailabilityMetric < 1` selama 5 menit | 0 |
| `alert-laprakin-memory-low` | memori tersedia < 100 MB selama 15 menit | 1 |
| `alert-laprakin-cpu-high` | CPU > 85% selama 15 menit | 2 |
| `alert-laprakin-cpu-credits-low` | kredit burstable B-series < 20 | 2 |

**Watchdog lokal** (`ops/laprakin-watchdog.sh`, timer tiap 15 menit) memeriksa empat hal yang tidak terlihat dari Azure: ruang disk root, kesegaran arsip backup, container aplikasi berjalan, dan `/api/health/ready` mengembalikan `ok:true`. Notifikasi hanya dikirim saat status berubah, plus pesan pemulihan saat normal kembali. `laprakin-backup.service` juga memiliki `OnFailure=` yang mengirim 20 baris log terakhir bila backup gagal.

```bash
sudo install -o root -g root -m 750 ops/laprakin-notify.sh /usr/local/bin/
sudo install -o root -g root -m 750 ops/laprakin-watchdog.sh /usr/local/bin/
sudo install -m 0644 ops/laprakin-watchdog.service ops/laprakin-watchdog.timer ops/laprakin-backup-failure.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now laprakin-watchdog.timer
```

Skrip ops dipasang ke `/usr/local/bin`, bukan dijalankan dari `/opt/laprakin`, agar tetap ada selama jendela deploy ketika direktori aplikasi sedang dirotasi.

### OPS_ALERT_EMAIL wajib diisi

Tujuan notifikasi dibaca dari `OPS_ALERT_EMAIL`, bukan `ADMIN_EMAIL`. Keduanya sengaja dipisah: `ADMIN_EMAIL` menentukan akun mana yang dipromosikan menjadi admin aplikasi setiap login, sehingga mengubahnya demi notifikasi akan sekaligus mengubah hak akses. Skrip menolak mengirim ke alamat `@example.test`/`@example.com` agar placeholder tidak lolos diam-diam.

### Yang masih belum tercakup

Uptime check dari luar jaringan Azure. Bila VM dan Azure Monitor sama-sama bermasalah, tidak ada pihak ketiga yang memberi tahu. Perlu layanan eksternal (UptimeRobot, Better Uptime, atau sejenisnya) yang menembak `https://laprakin.app/api/health/ready`.

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
- Gunakan `npm run verify:production`, `/api/health/ready`, dan panel **Admin → AI & Login** untuk pemeriksaan operasional. Ketiganya hanya menampilkan status dan metadata aman.
- Pastikan `server/.env` dimiliki operator deployment, permission `0600`, tidak masuk image, dan tidak pernah masuk repository.
- Jika secret sempat tampil, anggap telah bocor: buat credential baru, deploy, verifikasi integrasi, lalu cabut credential lama. Rotasi `JWT_SECRET`, `DEVICE_HMAC_SECRET`, dan `TOKEN_HMAC_SECRET` juga mengakhiri sesi lama.
- Gemini API key harus dibatasi hanya ke `generativelanguage.googleapis.com`. Resend SMTP memakai key `sending_access`, bukan `full_access`.
- Google OAuth client secret dan Midtrans Server Key harus dirotasi dari dashboard provider; lakukan deploy dan verifikasi sebelum menonaktifkan secret lama agar downtime minimum.
