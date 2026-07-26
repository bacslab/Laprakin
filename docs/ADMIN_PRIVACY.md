# Admin Privacy Guardrails - Laprakin V10

Admin console dibuat untuk operasional, bukan untuk mengawasi isi tugas mahasiswa.

## Yang terlihat oleh admin

- Jumlah user, dokumen, job, storage agregat, dan aktivitas harian agregat.
- Feedback yang memang dikirim user beserta status dan balasan.
- Kode user pseudonim seperti `U-1A2B3C4D`, bukan email, NIM, nama lengkap, IP, atau device ID.
- Kejadian perlu ditinjau yang berasal dari metadata minimal, misalnya lonjakan jumlah upload, banyak akun pada perangkat yang sama, lonjakan generate, atau percobaan CS di luar scope berulang.
- AI usage metadata: model/mode, jumlah call, token, latency, status error, dan waktu kejadian.
- Admin alerts untuk kegagalan generate/export, refund credit otomatis gagal, provider timeout/error berulang, atau credit terdebit tanpa dokumen valid.
- Riwayat admin credit grant: target, jumlah credit, alasan, waktu, admin actor, dan idempotency key.

## Yang tidak tersedia di admin console

- Isi chat laprak.
- Isi draft, section, file upload, PDF/DOCX, screenshot, atau export Word mahasiswa.
- Raw IP address, raw device fingerprint, dan email user.
- Prompt AI, output AI mentah, dan isi lampiran.
- Aksi otomatis untuk memblokir user berdasarkan risk event.

## Prinsip review

Risk event bukan vonis pelanggaran. Admin hanya dapat menandai `reviewed` atau `dismissed`; keputusan akun yang berdampak harus memakai proses terpisah, alasan yang terdokumentasi, dan jalur banding.

Credit grant dan alert resolution adalah tindakan operasional. Keduanya harus dicatat di audit log dan tidak boleh dipakai untuk membaca isi dokumen user.

## Testimoni

Testimoni hanya dapat dibuat dari feedback yang secara eksplisit mencentang izin publikasi. Admin masih harus mengaktifkan status `published` melalui CMS sebelum kutipan terlihat di landing page.
