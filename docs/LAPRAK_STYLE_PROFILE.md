# Laprakin Report Style Profile

Profil ini menjadi acuan dokumen akademik Laprakin setelah update template DOCX default. Isi dokumen sumber tidak ditanamkan ke provider AI sebagai data permanen; aplikasi memakai struktur, template, dan quality gate berikut untuk menyusun laporan praktikum.

## Struktur

- Cover formal pada halaman tersendiri dan dipertahankan dari template DOCX default.
- Identitas praktikum/user hanya boleh tampil di cover. Body tidak boleh membuat section `Identitas Praktikum`, biodata, NIM/NPM, kelas, prodi, atau jurusan sebagai bagian isi.
- Pembahasan memakai hierarki bernomor: dasar teori singkat bila perlu, langkah teknis, hasil/pembahasan, analisis output, dan kesimpulan.
- Satu langkah menghubungkan tindakan, parameter/command, alasan teknis, bukti, dan hasil yang diamati.
- Screenshot atau gambar ditempatkan setelah narasi terkait dan diberi caption `Gambar N. ...`.
- Setelah setiap gambar wajib ada penjelasan kontekstual: apa yang tampak, langkah apa yang dibuktikan, dan arti hasilnya.
- Bahasa harus divariasikan per user secara terkendali agar dokumen tidak identik antar pengguna, tanpa mengubah fakta teknis atau mengarang data.

## Format DOCX

- Template default berada di `server/assets/templates/default-laprak.docx`.
- Cover, logo, header/footer, style, theme, section properties, dan relationship Word dipreservasi dari template.
- Sistem hanya mengganti field dinamis pada cover: mata kuliah, modul/topik, dosen, NIP, identitas user, kelas, prodi, jurusan, dan tahun akademik.
- A4 portrait dengan margin mengikuti template.
- Times New Roman 12 pt untuk isi, 1,5 spasi, rata kiri-kanan.
- Seluruh teks akademik berwarna hitam. Heading tidak memakai theme color Word.
- Caption 10,5 pt, hitam, rata tengah.
- Tidak ada branding Laprakin di footer dokumen akademik.

## Quality Gate

- Prompt satu kata atau konteks samar tidak boleh membuat dokumen.
- Draft membutuhkan topik, konteks mata kuliah/modul, instruksi, dan bukti hasil.
- AI tidak boleh membuat angka, command, hasil, screenshot, atau kesimpulan yang tidak diberikan user.
- Export ditolak bila identitas belum lengkap, bukti belum dipetakan, marker data masih tersisa, isi masih memakai kalimat generik, section identitas muncul di body, atau gambar tidak memiliki penjelasan.
- Contract test template wajib menjaga cover default tetap sama, memastikan body mulai tanpa halaman kosong tambahan, dan memastikan tidak ada section identitas praktikum di body.
