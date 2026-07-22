# Admin Privacy Guardrails — Laprakin V9

Admin console dibuat untuk operasional, bukan untuk mengawasi isi tugas mahasiswa.

## Yang terlihat oleh admin
- Jumlah user, dokumen, job, storage agregat, dan aktivitas harian agregat.
- Feedback yang memang dikirim user beserta status dan balasan.
- Kode user pseudonim seperti `U-1A2B3C4D`, bukan email, NIM, nama lengkap, IP, atau device ID.
- Kejadian perlu ditinjau yang berasal dari metadata minimal, misalnya lonjakan jumlah upload, banyak akun pada perangkat yang sama, lonjakan generate, atau percobaan CS di luar scope berulang.

## Yang tidak tersedia di admin console
- Isi chat laprak.
- Isi draft, section, file upload, PDF/DOCX, screenshot, atau export Word mahasiswa.
- Raw IP address, raw device fingerprint, dan email user.
- Aksi otomatis untuk memblokir user berdasarkan risk event.

## Prinsip review
Risk event bukan vonis pelanggaran. Admin hanya dapat menandai `reviewed` atau `dismissed`; keputusan akun yang berdampak harus memakai proses terpisah, alasan yang terdokumentasi, dan jalur banding.

## Testimoni
Testimoni hanya dapat dibuat dari feedback yang secara eksplisit mencentang izin publikasi. Admin masih harus mengaktifkan status `published` melalui CMS sebelum kutipan terlihat di landing page.
