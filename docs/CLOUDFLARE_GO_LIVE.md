# Cloudflare Go-Live Runbook

Status saat runbook ini dibuat:

- Gemini Basic, Thinking, XtraThink, Support, dan Document structured output sudah lolos request live.
- Google OAuth localhost sudah menukar authorization code, memverifikasi ID token, membuat akun Google terverifikasi, dan membuka workspace.
- Production private beta saat ini aktif di `https://laprakin.app` melalui VPS Docker Compose.
- Public beta luas tetap menunggu kesiapan SMTP, Midtrans production, policy final, monitoring eksternal, dan proses support.

## 1. Cutover DNS

1. Salin seluruh record DNS aktif dari Name.com sebelum mengganti nameserver.
2. Tambahkan domain ke Cloudflare dan cocokkan record penting, terutama MX, SPF, DKIM, DMARC, serta record verifikasi Google.
3. Ganti nameserver di Name.com ke pasangan nameserver yang diberikan Cloudflare.
4. Buat record `app` menuju origin/deployment Laprakin. Aktifkan proxy Cloudflare bila origin memang menerima traffic melalui Cloudflare.
5. Jangan hapus konfigurasi lama sampai resolusi publik, email, dan aplikasi sudah diuji dari jaringan berbeda.

## 2. TLS dan origin

1. Pasang sertifikat publik valid atau Cloudflare Origin CA pada origin.
2. Gunakan **SSL/TLS Full (strict)**. Jangan memakai Flexible karena koneksi Cloudflare ke origin tidak terenkripsi end-to-end.
3. Paksa HTTPS dan pastikan tidak ada redirect loop.
4. Batasi akses origin bila memungkinkan, atau gunakan Cloudflare Tunnel agar port origin tidak terbuka langsung.
5. Set `TRUST_PROXY_HOPS` sesuai jumlah proxy nyata. Template single-hop memakai `1`; jangan menaikkannya tanpa memahami topologi.

Referensi: [Cloudflare Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/) dan [Cloudflare Origin CA](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/).

## 3. Environment production

1. Jalankan `npm run prepare:production-env` untuk membuat `server/.env.production.local` yang diabaikan Git dan berisi tiga secret aplikasi acak. Script tidak mencetak secret dan menolak menimpa file yang sudah ada.
2. Salin nilainya ke secret store platform, lalu hapus file lokal bila sudah tidak dibutuhkan.
3. Ganti `example.test` dengan hostname final yang sama pada `APP_URL`, `API_URL`, `ALLOWED_ORIGINS`, dan callback Google.
   Untuk deployment aktif saat ini gunakan `https://laprakin.app`.
4. Set `AI_REQUIRED=true` dan `GOOGLE_OAUTH_REQUIRED=true` agar server gagal start bila integrasi wajib hilang.
5. Aktifkan SMTP production serta Midtrans production sebelum membuka registrasi dan checkout publik.

## 4. Google OAuth cutover

1. Tambahkan URI berikut pada OAuth Web Client yang sama:
   `https://app.<domain-final>/api/auth/google/callback`
2. Pertahankan callback localhost selama development masih diperlukan.
3. Pastikan scheme, hostname, port, path, dan trailing slash cocok persis. Google menolak perbedaan apa pun sebagai `redirect_uri_mismatch`.
4. Isi homepage, Privacy Policy, Terms, support email, dan authorized domain pada consent screen.
5. Publish consent screen atau tambahkan akun uji bila aplikasi masih berstatus Testing.

Referensi: [Google OAuth untuk web server](https://developers.google.com/identity/protocols/oauth2/web-server) dan [Google OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies).

## 5. Gemini production

1. Simpan `GEMINI_API_KEY` hanya di secret store backend.
2. Gunakan Gemini auth key terbaru atau key yang dibatasi khusus Gemini API; jangan gunakan unrestricted standard key.
3. Aktifkan billing budget, quota, dan alert biaya.
4. Setelah deployment, jalankan `npm run test:ai-live` dari environment yang dapat mengakses provider.
5. Pantau call, token, latency, dan error melalui tab **AI & Login** di Admin Console. Prompt, file, dan output tidak disimpan pada telemetry.

Referensi: [Keamanan Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key).

## 6. Release gate

Jalankan dari environment production yang sebenarnya:

```bash
npm ci
npm run build
npm run test:production-config
npm run test:ai-auth
npm run test:ai-live
npm run test:smoke
npm run verify:production
npm audit --omit=dev
```

Release hanya boleh dilanjutkan bila `verify:production` menghasilkan `ok: true`, `/api/health/ready` sehat, login Google production selesai sampai workspace, email benar-benar terkirim, dan webhook QRIS sandbox/production sudah diverifikasi.
