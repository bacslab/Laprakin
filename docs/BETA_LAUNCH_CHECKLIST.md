# Checklist sebelum public beta

## Wajib sebelum menerima pengguna publik

- [ ] Ganti JWT, device HMAC, dan token HMAC secret dengan nilai acak yang berbeda.
- [ ] Aktifkan domain HTTPS dan isi `APP_URL`, `API_URL`, dan `ALLOWED_ORIGINS` dengan origin publik yang benar.
- [ ] Konfigurasikan SMTP dan uji register, resend verification, serta reset password dari email sungguhan.
- [ ] Tambahkan bot challenge server-side sebelum reward/promo publik dibuka.
- [ ] Tentukan kebijakan retensi file dan jalankan backup terenkripsi + restore drill.
- [ ] Tulis Terms of Use, Privacy Policy, dan Academic Use Policy.
- [ ] Jangan membuka payment sampai provider dan webhook signature verification selesai.
- [ ] Jalankan `npm run test:template-docx` setiap kali template default atau export DOCX berubah.
- [ ] Jalankan `npm run test:admin-ops` setiap kali credit grant, usage log, atau admin alerts berubah.
- [ ] Pastikan `/api/health/ready` production mengembalikan database `ready`, worker `idle`, AI `configured`, dan Google OAuth `configured`.
- [ ] Pastikan tutorial/static media production tidak jatuh ke fallback HTML SPA.
- [ ] Uji quiz/download gate untuk Free, credit satuan, dan subscription.

## Sangat disarankan saat penggunaan meningkat

- [ ] Pindahkan upload dari filesystem ke private S3/R2 bucket.
- [ ] Pindahkan job queue dari SQLite single-instance ke Redis/BullMQ worker.
- [ ] Tambahkan monitoring error tanpa menyimpan isi dokumen atau isi file di telemetry.
- [ ] Tambahkan admin review workflow untuk promo/referral yang ditahan.
- [x] Uji export DOCX dengan template kampus nyata yang diizinkan sebagai template default awal.
- [ ] Tambahkan monitoring eksternal untuk admin alerts dan uptime.
