# Keamanan penyimpanan file user

## Model storage production

File user tidak pernah disajikan sebagai static asset. Metadata menyimpan nama
asli hanya untuk tampilan dan `Content-Disposition`; path fisik memakai identifier
acak dan hanya mempertahankan ekstensi aman. Direktori disegmentasi berdasarkan
owner dan resource, lalu setiap download atau preview melewati session serta query
`owner_user_id` pada API aplikasi.

Production aktif memakai volume privat yang hanya di-mount ke container aplikasi.
Adapter Azure Blob tetap opsional dan bukan alasan untuk memindahkan provider.
Saat `AZURE_STORAGE_CONNECTION_STRING` diaktifkan, adapter membuat container bila
perlu, memeriksa ACL, dan menghapus public blob/container access sambil
mempertahankan stored access policy yang sudah ada. Upload mengembalikan blob name
internal, bukan URL permanen; download dilakukan server-side setelah authorization.

## Azure checklist

- Storage account menolak anonymous blob access di level account.
- Container `AZURE_BLOB_CONTAINER_NAME` tidak memiliki `blob` atau `container`
  public access.
- Connection string hanya tersedia pada secret store production dan tidak pernah
  dikirim ke client atau GitHub issue.
- Jangan menyimpan `BlockBlobClient.url` di response API. Bila short-lived SAS
  dipakai di masa depan, batasi ke satu blob, read-only, HTTPS, dan masa berlaku
  beberapa menit.
- Jalankan integration check setelah perubahan ACL; hasil `privateAccess: true`
  wajib terlihat sebelum storage tersebut dipakai.

## Penghapusan dan retensi

- Menghapus file dari Settings menghapus byte fisik secara best effort dan menandai
  semua referensi milik owner yang sama.
- Menghapus dokumen atau akun menandai file document dan chat sebagai terhapus.
- Retention sweep menghapus byte serta metadata setelah masa tenggang 7 hari,
  termasuk export DOCX dan attachment chat. Ini menjaga jendela restore dokumen
  tanpa mempertahankan file tanpa batas.
- Backup terenkripsi mengikuti jadwal retensi backup terpisah di `DEPLOYMENT.md`.

Regression test memverifikasi download file, preview, attachment, dan export tidak
dapat diakses user lain maupun admin yang bukan owner. Test juga memastikan nama
storage opaque dan account deletion masuk ke purge fisik setelah masa tenggang.
