# Checklist sebelum public beta

## Wajib sebelum menerima pengguna publik

- [ ] Ganti JWT, device HMAC, dan token HMAC secret dengan nilai acak yang berbeda.
- [ ] Aktifkan domain HTTPS dan isi `APP_URL`, `API_URL`, dan `ALLOWED_ORIGINS` dengan origin publik yang benar.
- [ ] Konfigurasikan SMTP dan uji register, resend verification, serta reset password dari email sungguhan.
- [ ] Tambahkan bot challenge server-side sebelum reward/promo publik dibuka.
- [ ] Tentukan kebijakan retensi file dan jalankan backup terenkripsi + restore drill.
- [ ] Tulis Terms of Use, Privacy Policy, dan Academic Use Policy.
- [ ] Jangan membuka payment sampai provider dan webhook signature verification selesai.

## Sangat disarankan saat penggunaan meningkat

- [ ] Pindahkan upload dari filesystem ke private S3/R2 bucket.
- [ ] Pindahkan job queue dari SQLite single-instance ke Redis/BullMQ worker.
- [ ] Tambahkan monitoring error tanpa menyimpan isi dokumen atau isi file di telemetry.
- [ ] Tambahkan admin review workflow untuk promo/referral yang ditahan.
- [ ] Uji export DOCX dengan template kampus nyata yang diizinkan.
