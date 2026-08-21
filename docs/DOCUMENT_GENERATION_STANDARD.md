# Standar Minimum Dokumen Hasil Laprakin

Dokumen ini adalah kontrak minimum untuk setiap laporan praktikum yang dibuat Laprakin. Hasil yang tidak memenuhi satu saja ketentuan wajib belum boleh ditandai selesai atau ditawarkan untuk diunduh.

## 1. Urutan Acuan

1. Template DOCX yang diunggah pengguna adalah acuan utama untuk bentuk dokumen.
2. Instruksi dosen dan ketentuan tertulis pada modul menentukan isi serta urutan pembahasan.
3. Data, parameter, hasil, dan bukti milik pengguna menentukan fakta yang boleh ditulis.
4. `server/assets/templates/default-laprak.docx` dipakai hanya bila tidak ada template DOCX khusus.
5. Pengetahuan umum boleh dipakai untuk menjelaskan teori, tetapi tidak boleh menciptakan hasil praktik, angka, perintah, referensi, gambar, atau keberhasilan yang tidak terdapat pada bahan.

## 2. Pembelajaran Template

Sebelum isi disusun, Laprakin wajib memetakan seluruh pola yang dapat dipertahankan dari template:

- ukuran halaman, orientasi, margin, kolom, jarak header/footer, dan section break;
- cover, logo, identitas institusi, header, footer, nomor halaman, theme, relationship, dan media;
- font, ukuran, warna, ketebalan, perataan, spasi, indentasi, tab, border, serta hierarki heading;
- urutan bagian, sistem penomoran, tabel, caption, gambar, lampiran, dan pola pergantian halaman;
- seluruh field dinamis yang boleh diganti dan seluruh elemen tetap yang tidak boleh diubah.

Template sumber tidak boleh dimodifikasi. Dokumen hasil dibuat dari salinan, field dinamis diganti, dan bagian yang tidak termasuk ruang perubahan wajib tetap utuh. Bila template memiliki beberapa section atau pola halaman, seluruh pola wajib dipelajari; halaman pertama saja tidak cukup.

## 3. Struktur Isi Minimum

Dokumen wajib memiliki paling sedikit tiga bagian substantif yang mengikuti template atau modul. Jika keduanya tidak menentukan urutan, gunakan susunan berikut:

1. dasar teori, tujuan, atau konteks praktikum;
2. langkah kerja, konfigurasi, atau metode;
3. hasil, pengujian, dan pembahasan;
4. kesimpulan jika diminta atau tersedia dalam pola template.

Setiap bagian wajib:

- menjelaskan tindakan, alasan teknis, bukti yang terkait, dan arti hasil yang benar-benar tersedia;
- memakai paragraf lengkap dan spesifik, bukan kalimat pengisi atau pola tulisan generik;
- mempertahankan istilah, nilai, satuan, konfigurasi, dan urutan yang terdapat pada bahan;
- bebas dari placeholder, marker internal, instruksi sistem, pesan kesalahan, dan data milik pemilik template lama.

Identitas mahasiswa, NIM/NPM, kelas, program studi, jurusan, dosen, dan tahun akademik hanya boleh berada pada slot cover. Isi laporan tidak boleh membuat bagian `Identitas Praktikum` atau biodata baru.

## 4. Bukti, Gambar, dan Caption

- Setiap gambar relevan hanya boleh muncul satu kali.
- Gambar ditempatkan setelah narasi yang dibuktikannya dan tidak boleh melewati lebar area tulis.
- Rasio gambar wajib dipertahankan; gambar tidak boleh gepeng, terpotong, pecah karena diperbesar, atau bertumpuk dengan teks.
- Caption memakai format `Gambar N. Judul spesifik`, urut tanpa loncatan, dan berada bersama gambarnya.
- Caption dan penjelasan gambar wajib memakai Bahasa Indonesia baku; istilah produk, menu, protokol, dan command pada bukti boleh dipertahankan sebagaimana tampilannya.
- Setelah gambar terdapat penjelasan faktual mengenai hubungan gambar dengan langkah atau hasil. Penjelasan tidak boleh menebak isi yang tidak terbaca.
- Logo, dekorasi template, gambar duplikat, dan media yang hanya mengatur format tidak boleh dimasukkan sebagai bukti praktikum.

## 5. Tata Letak DOCX

- Cover harus berada pada halaman tersendiri.
- Body dimulai tepat pada halaman berikutnya tanpa halaman kosong tambahan.
- Gaya Normal, Heading 1, Heading 2, Heading 3, list, caption, dan tabel wajib konsisten.
- Teks akademik harus terbaca, kontras, dan mengikuti warna template; template default memakai teks hitam.
- Paragraf tidak boleh terpotong, bertumpuk, keluar margin, atau menghasilkan jarak kosong yang tidak wajar.
- Heading tidak boleh tertinggal sendirian di akhir halaman.
- Tabel wajib memiliki lebar kolom, padding, alignment, dan header berulang yang sesuai; teks tidak boleh menempel border atau terpotong.
- Header, footer, nomor halaman, logo, theme, style, numbering, relationship, media, dan section properties dari template wajib tetap terpelihara kecuali pengguna meminta perubahan.

## 6. Pemeriksaan Sebelum Selesai

Sebelum status dokumen menjadi selesai, sistem wajib menjalankan pemeriksaan berikut:

1. memastikan semua bagian, gambar, caption, dan field dinamis sudah terisi atau sengaja dikosongkan sesuai aturan;
2. memastikan tidak ada fakta, hasil, angka, command, referensi, atau keberhasilan yang dibuat-buat;
3. memeriksa struktur paket DOCX, relationship, media, section, style, numbering, header, dan footer;
4. membuat preview DOCX dan memeriksa setiap halaman untuk clipping, overlap, tabel rusak, font hilang, gambar keluar batas, caption terpisah, serta halaman kosong;
5. mengulang penyusunan dan pemeriksaan secara otomatis bila hasil belum lolos;
6. menyimpan dokumen hanya setelah seluruh gerbang lulus.

Mahasiswa tidak boleh diminta menekan tombol untuk mengulang analisis atau memulai penyusunan. Setelah bahan dikirim, rangkaian membaca bahan, mempelajari template, menyusun isi, menata Word, memeriksa hasil, dan menyimpan dokumen wajib berjalan otomatis di server serta tetap berlanjut ketika halaman ditutup atau dimuat ulang.

## 7. Kriteria Lulus

Dokumen dinyatakan lulus hanya bila:

- isi dapat ditelusuri ke bahan pengguna atau pengetahuan umum yang diizinkan;
- struktur dan gaya dikenali sebagai turunan langsung dari template yang dipilih;
- cover dan elemen tetap template tidak berubah di luar slot dinamis;
- seluruh halaman rapi, terbaca, konsisten, dan bebas cacat visual;
- file dapat dibuka sebagai DOCX, dipreview, dan diunduh tanpa perbaikan manual dari pengguna.
