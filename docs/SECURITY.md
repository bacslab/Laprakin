# Security & Academic Guardrails — Laprakin V3

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
