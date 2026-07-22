# Pembayaran QRIS Dinamis Midtrans

Implementasi ini memakai **Midtrans Snap** dengan channel `other_qris` saja. Browser hanya mengirim SKU dan quantity; server Laprakin menghitung harga resmi, menyimpan snapshot order, membuat Snap token, dan memverifikasi hasil pembayaran sebelum credit atau subscription diaktifkan.

> Tidak ada QRIS statis atau QR buatan aplikasi. Setiap order menggunakan checkout QRIS dinamis dari Midtrans dan nilai nominal dikirim dari backend.

## 1. Environment variable

Salin `server/.env.example` menjadi `server/.env`, lalu isi minimal berikut untuk Midtrans:

```env
# Wajib untuk pembayaran live/sandbox Midtrans
PAYMENTS_MODE=midtrans
MIDTRANS_ENVIRONMENT=sandbox
# Optional alias for platforms that use a boolean switch
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_SERVER_KEY=SB-Mid-server-...
MIDTRANS_CLIENT_KEY=SB-Mid-client-...
MIDTRANS_VERIFY_STATUS=true

# URL publik aplikasi. APP_URL dipakai callback selesai; API_URL dipakai untuk callback OAuth.
APP_URL=https://app.domain-kamu.id
API_URL=https://api.domain-kamu.id
# Bila frontend/backend dipisahkan, alias ini juga didukung:
FRONTEND_URL=https://app.domain-kamu.id
BACKEND_URL=https://api.domain-kamu.id
ALLOWED_ORIGINS=https://app.domain-kamu.id
```

`MIDTRANS_SERVER_KEY` **hanya** boleh berada di server (`server/.env`), tidak di React/Vite, source client, atau repository. `MIDTRANS_CLIENT_KEY` boleh dikirim oleh endpoint `/api/payments/config` karena hanya digunakan Snap di browser.

Untuk deploy satu domain yang meng-host UI dan API yang sama, cukup gunakan domain itu pada `APP_URL`, `API_URL`, dan `ALLOWED_ORIGINS` sesuai arsitektur yang digunakan.

## 2. Menjalankan lokal

```bash
npm install
cp server/.env.example server/.env
npm run dev
```

Buka `http://localhost:5173`, masuk dengan akun yang sudah **verified**, lalu buka halaman `/billing`.

- `PAYMENTS_MODE=manual` dipakai untuk development lokal tanpa dana nyata. Ia mensimulasikan entitlement, bukan QRIS sungguhan.
- Untuk QRIS sandbox sungguhan, ubah ke `PAYMENTS_MODE=midtrans`, isi Sandbox Server Key dan Client Key, serta expose endpoint webhook dengan tunnel HTTPS seperti ngrok/Cloudflare Tunnel.

## 3. Cara kerja cart dan harga

1. UI mengirim `items: [{ sku, quantity }]` ke `POST /api/pricing/quote` dan `POST /api/payments/checkout`.
2. Backend hanya menerima SKU `credit`, `monthly`, atau `pro`; data harga dari browser diabaikan.
3. Backend menghitung subtotal, diskon (saat ini `0`), total, dan `gross_amount`; lalu menyimpan snapshot item dan harga pada `payment_orders`.
4. Satu order boleh berisi credit plus maksimal satu subscription.
5. Index database mencegah dua klik cepat menghasilkan dua order aktif untuk keranjang yang sama.

SKU dan harga resmi berada di `server/src/payments.js` pada `PRODUCT_CATALOGUE`/`PRICING`. Ubah harga di sana atau pindahkan ke database admin bila nanti katalog diperluas; jangan mengambil nilai harga final dari browser.

## 4. Konfigurasi Midtrans Sandbox

1. Di dashboard Midtrans, ambil **Sandbox Server Key** dan **Sandbox Client Key**.
2. Set `MIDTRANS_ENVIRONMENT=sandbox`.
3. Pastikan channel **QRIS** untuk akun sandbox/merchant Anda sudah diaktifkan sesuai instruksi Midtrans.
4. Set payment notification URL ke endpoint HTTPS publik:

```text
https://api.domain-kamu.id/api/payments/midtrans/notification
```

5. Jalankan checkout dari `/billing`. Snap akan dibuka dengan `enabled_payments: ["other_qris"]`, sehingga customer hanya melihat QRIS.

## 5. Pindah ke production

Sebelum go-live:

```env
NODE_ENV=production
PAYMENTS_MODE=midtrans
MIDTRANS_ENVIRONMENT=production
MIDTRANS_IS_PRODUCTION=true
MIDTRANS_SERVER_KEY=Mid-server-...
MIDTRANS_CLIENT_KEY=Mid-client-...
MIDTRANS_VERIFY_STATUS=true
APP_URL=https://app.domain-kamu.id
API_URL=https://api.domain-kamu.id
ALLOWED_ORIGINS=https://app.domain-kamu.id
EMAIL_MODE=smtp
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
JWT_SECRET=<nilai-random-panjang>
DEVICE_HMAC_SECRET=<nilai-random-panjang-lain>
TOKEN_HMAC_SECRET=<nilai-random-panjang-ketiga>
```

Aplikasi memang menolak start production bila payment masih manual atau Midtrans key kosong. Selalu gunakan HTTPS publik dan tes ulang notification URL setelah domain, proxy, atau path API berubah.

## 6. Webhook dan status aman

Endpoint webhook:

```text
POST /api/payments/midtrans/notification
```

Server melakukan seluruh pemeriksaan ini:

- Verifikasi signature SHA-512 dari `order_id + status_code + gross_amount + Server Key`.
- Mencocokkan order ID dan nominal dengan order internal.
- Bila `MIDTRANS_VERIFY_STATUS=true`, meminta Status API Midtrans dari server dan memakai respons itu sebagai sumber status tambahan.
- Menerima status pending, settlement/capture, expire, cancel, deny, refund/partial refund.
- Hanya status settlement atau capture yang valid yang dapat mengaktifkan entitlement.
- Memastikan kanal yang dibayar tetap QRIS.
- Menyimpan event webhook dan menggunakan `payment_fulfillments` dengan primary key `order_id`, sehingga retry webhook tidak pernah menambah credit atau subscription dua kali.

Callback dari Snap di browser dan tombol **Refresh status** tidak pernah menambah credit secara langsung. Refresh hanya meminta server melakukan Status API Midtrans.

## 7. Branding Laprakin

Payload item Snap selalu dikirim dengan branding **Laprakin**. Asset brandmark tersedia pada `client/public/brand/laprakin-mark.png`; unggah asset itu secara manual pada dashboard Midtrans jika format/ukuran dashboard menerimanya. Di dashboard Midtrans buka **Snap Preference → Theme and Logo** untuk mengatur logo Laprakin, warna/tema, serta menonaktifkan `Use Header` bila ingin header besar Snap tidak ditampilkan. Pada **Snap Preference / Snap Checkout Settings**, aktifkan `Hide order ID` bila opsi itu tersedia pada akun Anda.

Aplikasi tidak memakai nama palsu. QRIS/PJP atau aplikasi pembayaran customer masih dapat menampilkan nama merchant resmi yang terdaftar pada akun Midtrans/QRIS; hal itu tidak boleh disembunyikan dengan cara yang melanggar aturan.

Pengaturan header, logo, dan penyembunyian order ID adalah preference Dashboard Midtrans yang sah, bukan trik front-end. Jangan mengandalkan aplikasi untuk menyembunyikan identitas merchant resmi dari aplikasi pembayaran customer.

## 8. QRIS-only checkout

Server mengirim:

```json
{
  "enabled_payments": ["other_qris"]
}
```

Jangan menambahkan channel lain pada payload tersebut bila tujuan checkout wajib QRIS saja. Channel `other_qris` membutuhkan aktivasi QRIS sesuai konfigurasi merchant Midtrans; bila akun belum aktif, Snap akan menolak atau tidak menampilkan QRIS.

## 9. Test sandbox dan webhook

1. Jalankan application dan tunnel HTTPS ke API lokal.
2. Isi notification URL dashboard dengan URL tunnel + `/api/payments/midtrans/notification`.
3. Buat checkout QRIS dari `/billing`.
4. Selesaikan test payment mengikuti metode sandbox Midtrans untuk QRIS yang aktif pada akun.
5. Pastikan riwayat berubah menjadi `paid`, subscription/credit hanya bertambah satu kali, lalu kirim ulang notification yang sama dari dashboard untuk memastikan tetap idempotent.
6. Uji status `pending`, `expire`, `cancel`, `deny`, dan `refund` dengan simulator/dashboard sesuai kemampuan akun sandbox.

Catatan biaya: QRIS dinamis biasanya memiliki MDR atau biaya per transaksi berdasarkan kategori merchant dan perjanjian dengan Midtrans/PJP. Jangan mengklaim QRIS “gratis 100%” tanpa konfirmasi tertulis dari akun merchant Anda.

## 10. File yang diubah

- `server/src/payments.js` — katalog server-side, quote cart, Snap QRIS-only, status API, signature validation, fulfilment idempoten.
- `server/src/index.js` — endpoint quote, checkout, order status/refresh, webhook Midtrans.
- `server/src/db.js` — snapshot order, metadata Midtrans, index idempotensi checkout dan webhook.
- `server/src/services.js` — billing history membaca snapshot order dan status QRIS.
- `server/src/config.js` — environment mode, API URL alias, verification toggle.
- `server/.env.example` — seluruh environment QRIS/Midtrans yang diperlukan, termasuk alias `MIDTRANS_IS_PRODUCTION`.
- `client/src/main.jsx` — billing cart multi-item, checkout QRIS, polling/status refresh.
- `client/src/styles.css` — state UI checkout dan status pembayaran.
- `README.md`, `docs/DEPLOYMENT.md` — instruksi deploy dan ringkasan integrasi.

## Referensi resmi

- Snap API: https://docs.midtrans.com/docs/snap-snap-integration-guide
- QRIS / Other QRIS: https://docs.midtrans.com/reference/other-qris
- HTTP notification & signature: https://docs.midtrans.com/docs/https-notification-webhooks
- Status API: https://docs.midtrans.com/reference/get-status-1
