# Keamanan akun admin

## Identitas khusus

- Production wajib mengisi `ADMIN_EMAIL` secara eksplisit. Aplikasi tidak memiliki
  email admin fallback.
- Gunakan akun khusus operasional Laprakin, bukan email harian, akun personal,
  alamat notifikasi, atau akun milik vendor.
- Simpan kredensial dan recovery code di password manager tim. Jangan menaruhnya
  di repository, issue, log, atau file deployment yang ikut Git.
- Perubahan `ADMIN_EMAIL` adalah perubahan hak akses. Lakukan melalui change
  record, verifikasi pemilik baru, lalu cabut sesi akun lama.

## MFA dan step-up

Kontrol production yang disetujui adalah identity-aware proxy di depan `/admin`
dan `/api/admin/*`, dengan MFA dari identity provider dan masa autentikasi ulang
maksimal 8 jam. Kebijakan proxy harus berlaku untuk browser maupun request API;
menyembunyikan menu admin di frontend bukan kontrol akses.

Bila Google OAuth dipakai sebagai identity provider, akun khusus admin wajib
mengaktifkan Verifikasi 2 Langkah dan menggunakan passkey atau security key
sebagai faktor utama. Recovery email, nomor pemulihan, dan backup code juga harus
dimiliki organisasi. Login email dan kata sandi Laprakin saja tidak dihitung
sebagai MFA.

Jangan membuka akses admin ke internet sebelum proxy/MFA diuji dari sesi baru,
sesi kedaluwarsa, dan akun non-admin. Penerapan proxy atau IdP baru berada di
lapisan deployment; aplikasi tidak menambah penyedia identitas baru.

## Session dan boundary

- `ADMIN_SESSION_HOURS` default 8 jam dan dibatasi 1–12 jam. User biasa tetap
  mengikuti `SESSION_DAYS`.
- Logout, reset password, dan pencabutan sesi menaikkan `session_version`, sehingga
  token lama tidak lagi diterima.
- Semua endpoint `/api/admin/*` wajib memakai `requireAdmin`; mutation juga wajib
  memakai `requireCsrf` dan mencatat `audit(...)`.
- Regression test menjalankan akun student dan admin yang terpisah, memeriksa
  respons `403 ADMIN_ONLY`, cookie timeout, inventaris route, CSRF, dan audit log.

Jalankan sebelum release:

```bash
node --test server/test/authorization-boundaries.test.mjs
NODE_ENV=production npm run verify:production
```

## Respons insiden admin

1. Nonaktifkan akses akun pada identity provider atau proxy.
2. Ganti password dan faktor pemulihan yang dicurigai.
3. Cabut semua sesi akun melalui mekanisme reset/revoke session.
4. Tinjau `/api/admin/audit`, event risiko, serta log proxy untuk rentang waktu
   insiden; jangan menyalin data sensitif ke issue publik.
5. Pulihkan akses hanya setelah identitas, MFA, dan perangkat admin diverifikasi.
