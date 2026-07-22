# Feature Update CMS

CMS update fitur berada di `/admin` dan tidak memakai shell workspace user. Hanya akun dengan `role=admin` yang dapat membaca atau mengubah konten.

## Alur admin

1. Buka **Feature updates** di admin console.
2. Buat draft, isi judul, ringkasan, penjelasan, highlight, audience, dan CTA internal.
3. Upload PNG/JPG/WEBP maksimal 5 MB. Server memeriksa signature file sebelum menyimpan.
4. Pilih `Published` untuk tayang sekarang atau isi jadwal tayang untuk publikasi mendatang.
5. Gunakan masa kedaluwarsa bila update hanya relevan sementara.

## Alur workspace

- Workspace meminta satu update pending ketika dibuka.
- Workspace memeriksa kembali saat user kembali setelah idle minimal lima menit.
- Update yang sudah dilihat dicatat server-side per user sehingga tidak muncul ulang di perangkat lain.
- Preference **Update produk** dapat dimatikan dari Settings.
- Draft, update terjadwal yang belum waktunya, update expired, dan audience yang tidak sesuai tidak pernah dikirim ke client.

## Data dan keamanan

- Isi update dirender sebagai teks React, bukan HTML mentah.
- CTA hanya menerima path internal.
- URL gambar hanya boleh berasal dari endpoint upload CMS update.
- Create, update, archive, upload, dan receipt memakai CSRF.
- Aktivitas admin dan receipt dicatat di audit log tanpa menyimpan isi chat atau dokumen user.
