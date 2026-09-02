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
  memakai `requireCsrf` dan mencatat `audit(...)`. Middleware step-up MFA berlaku
  seragam setelah autentikasi untuk seluruh permukaan admin, termasuk event dan
  panel yang baru ditambahkan.
- Regression test menjalankan akun student dan admin yang terpisah, memeriksa
  respons `403 ADMIN_ONLY`, cookie timeout, inventaris route, CSRF, dan audit log.

## Origin dan response headers

API hanya merefleksikan origin yang ada di `ALLOWED_ORIGINS` atau application URL
yang dikonfigurasi. Origin yang tidak terdaftar menerima `ORIGIN_DENIED`; credential
tidak pernah direfleksikan untuk origin tersebut. Header dasar mencakup `nosniff`,
penolakan frame, content-security policy, cross-origin policy, dan default no-store.

## Pemeriksaan password

Deployment dapat mengaktifkan `PASSWORD_BREACH_CHECK=true`. Server memakai range
query k-anonim ke Have I Been Pwned sehingga password utuh tidak pernah dikirim;
password yang terdeteksi ditolak saat registrasi atau reset. Jika layanan pemeriksa
tidak tersedia, pendaftaran tetap berjalan dan hanya dicatat sebagai warning teknis.

## Admin audit

`recordAdminAudit` membuat baris audit terstruktur untuk setiap request mutation
admin. Payload diff di-redact secara rekursif untuk credential, token, cookie,
password, prompt, isi dokumen, dan raw source. IP disimpan sebagai hash SHA-256
satu arah dan tidak diekspos sebagai alamat mentah. `/api/admin/audit` mendukung
filter `action`, `actorUserId`, `limit`, dan `cursor`, serta hanya mengembalikan
metadata aman.

## TOTP opsional

`createTotpSecret(userId)` membuat secret Base32 yang disimpan terenkripsi di tabel
`admin_mfa_secrets`; `verifyTotpCode(userId, code)` menerima window 30 detik saat
ini serta satu window di sebelahnya untuk toleransi jam dan menolak replay pada
time-step yang sama. User biasa tidak ditantang. `ADMIN_MFA_REQUIRED=true`
mewajibkan enrollment; endpoint `/api/admin/mfa/status`, `/enroll`, dan `/verify`
menyediakan setup dan step-up UI. Setelah berhasil, sesi admin memperoleh jendela
step-up `ADMIN_MFA_WINDOW_MINUTES` (default 30 menit). Recovery dilakukan dengan
menghapus enrollment dari storage terkelola setelah identitas admin diverifikasi,
lalu enroll ulang—jangan mengirim secret melalui log atau issue.

## Respons insiden admin

1. Nonaktifkan akses akun pada identity provider atau proxy.
2. Ganti password dan faktor pemulihan yang dicurigai.
3. Cabut semua sesi akun melalui mekanisme reset/revoke session.
4. Tinjau `/api/admin/audit`, event risiko, serta log proxy untuk rentang waktu
   insiden; jangan menyalin data sensitif ke issue publik.
5. Pulihkan akses hanya setelah identitas, MFA, dan perangkat admin diverifikasi.
