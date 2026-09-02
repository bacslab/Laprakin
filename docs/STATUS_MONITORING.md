# Monitoring status Laprakin

## Endpoint monitor

Gunakan `https://laprakin.app/api/status` sebagai monitor liveness publik. Endpoint ini tidak memerlukan sesi dan tidak mengembalikan credential, token, isi dokumen, atau detail konfigurasi rahasia.

## Status yang diharapkan

- HTTP `200` berarti proses API dapat menerima dan menjawab request.
- `status: "ok"` berarti proses hidup dan database dapat diakses.
- `status: "degraded"` berarti proses masih menjawab, tetapi salah satu dependency liveness belum siap. Periksa `checks.database` dan `checks.ai`; AI yang sengaja belum dikonfigurasi dilaporkan sebagai `not_configured` dan bukan kegagalan liveness.
- HTTP selain `200`, timeout, atau body yang bukan JSON adalah kegagalan monitor.

`/api/health` dipertahankan untuk kompatibilitas klien dan probe lama. Gunakan `/api/health/ready` bila membutuhkan pemeriksaan dependency wajib untuk deployment; endpoint readiness dapat mengembalikan HTTP `503` ketika dependency wajib belum siap.

## Ambang alert

Buat alert setelah 3 kegagalan berturut-turut dalam rentang 5 menit. Pulihkan alert setelah 2 pemeriksaan berturut-turut kembali HTTP `200` dengan body JSON valid.

## Respons insiden

Pemilik respons: pemilik on-call Laprakin. Saat alert aktif, cek status endpoint, log terstruktur berdasarkan `requestId`, lalu periksa database dan readiness AI. Jika proses tidak dapat menjawab, restart satu instance sesuai prosedur deployment dan eskalasi ke pemilik layanan bila dua pemeriksaan berikutnya masih gagal.
