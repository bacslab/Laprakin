# Security & Academic Guardrails - Laprakin V4

## Implemented baseline

- Session cookie HTTP-only.
- CSRF token untuk aksi state-changing.
- Input validation dan auth/upload rate limits.
- Signature check dan SHA-256 duplicate detection saat upload.
- Private filesystem storage dan owner-only download.
- Pseudonymous device trust (HMAC), bukan tracker untuk iklan.
- Audit log untuk aksi penting.
- Temporary support access dengan expiry.
- File scan heuristik untuk password/token/key yang terbaca sebagai teks.
- Consent sebelum pemrosesan AI eksternal.
- Role guard terpisah untuk `/admin` dan seluruh API admin.
- CMS feature update menggunakan draft/publish, CSRF, audit log, dan receipt per user.
- Upload gambar CMS diverifikasi dari signature file, bukan hanya ekstensi/MIME browser.
- CSP, clickjacking protection, origin allowlist, dan pesan error production yang generik.
- Email verification wajib sebelum user memakai workspace/generate.
- Ganti password berjalan melalui verifikasi email, bukan perubahan langsung dari settings.
- Admin credit grant memakai role guard, CSRF, idempotency, alasan administratif, dan audit log.
- AI usage log hanya menyimpan metadata operasional, bukan prompt, output, atau isi file.
- Admin alert realtime dibuat untuk kegagalan generate/export dan kasus credit recovery.
- Dependency production diaudit dengan `npm audit --omit=dev`; hasil verifikasi terakhir 0 vulnerability.
- Routing frontend memakai router internal yang hanya menerima path lokal.

## Batas yang perlu dipahami

File scan bukan antivirus dan bukan DLP enterprise. Ia hanya mengingatkan pola kredensial umum pada file yang bisa diekstrak. User tetap bertanggung jawab menghapus password, token, API key, dan data sensitif sebelum membagikan dokumen.

## Guardrail akademik

Laprakin tidak boleh:

- menciptakan data pengukuran/eksperimen;
- mengubah bukti gagal menjadi bukti berhasil;
- membuat screenshot pihak lain tampak sebagai milik user;
- membuat referensi akademik palsu;
- menawarkan bypass plagiarism checker atau AI detector;
- menjanjikan nilai atau persetujuan dosen.

Jika bahan kurang, generator fallback harus menggunakan marker `[PERLU DIISI USER]` alih-alih mengarang fakta.

## Guardrail dokumen

- Template cover default dipreservasi; sistem hanya mengganti field dinamis yang memang disediakan.
- Body dokumen tidak boleh membuat section identitas praktikum atau biodata user.
- Setiap gambar/screenshot yang masuk ke body wajib memiliki caption dan penjelasan kontekstual.
- Export ditolak jika marker data, bukti palsu, gambar tanpa penjelasan, atau section identitas body masih ditemukan.
