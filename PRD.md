# Product Requirements Document — Laprakin

## 1. Ringkasan Eksekutif

Laprakin adalah platform AI berbasis web yang membantu mahasiswa mengubah bahan praktikum dan instruksi akademik menjadi draft dokumen yang lebih runtut, rapi, dapat direvisi, dan dapat diekspor. Produk berfokus pada laporan praktikum, tetapi harus cukup fleksibel untuk proposal, makalah, paper, jurnal sederhana, dokumentasi proyek, dan dokumen akademik lain.

Laprakin bukan sekadar chat AI umum. Produk menggabungkan:

- workspace berbasis percakapan;
- pengelolaan file, chat, project, dan dokumen;
- konfigurasi akademik yang terstruktur;
- template DOCX default yang mempertahankan cover kampus;
- mode AI bertingkat;
- proses review dan revisi;
- versi dokumen, preview, quiz singkat, dan export dokumen;
- credit satuan dan subscription;
- pembayaran QRIS dinamis Midtrans;
- admin console, CMS landing, credit grant, dan alert operasional;
- perlindungan privasi serta integritas akademik.

Nilai utama Laprakin adalah mengurangi pekerjaan administratif penyusunan dokumen tanpa mengambil alih tanggung jawab akademik pengguna.

---

## 2. Visi Produk

Menjadi workspace AI akademik yang paling praktis bagi mahasiswa Indonesia untuk menyusun dokumentasi tugas dan praktikum dari bahan nyata yang mereka miliki, dengan alur yang transparan, dapat dikontrol, dan mudah diperiksa kembali.

### 2.1 Pernyataan Nilai

> Fokus praktikum dan pembelajaran; urusan merapikan laprak, Laprakin bantu kerjakan.

### 2.2 Janji Produk

Laprakin membantu pengguna:

1. mengumpulkan bahan dalam satu workspace;
2. memahami struktur tugas;
3. menyusun draft berdasarkan konteks nyata;
4. memperbaiki bagian tertentu tanpa memulai ulang;
5. memeriksa kelengkapan dokumen;
6. mengekspor hasil yang tetap dapat diedit;
7. menjaga file dan percakapan tetap privat secara default.

---

## 3. Masalah yang Diselesaikan

Mahasiswa sering menghadapi masalah berikut:

- instruksi dosen tersebar di chat, modul, LMS, dan file berbeda;
- screenshot hasil praktikum tidak terorganisasi;
- struktur laporan berbeda antar mata kuliah;
- AI umum menghasilkan jawaban generik dan tidak mengikuti modul;
- revisi harus dilakukan berulang kali dari awal;
- pengguna kesulitan menjaga konsistensi gaya, istilah, dan format;
- file hasil akhir sulit dilacak;
- pembayaran subscription tidak selalu cocok untuk kebutuhan mahasiswa yang hanya sesekali memakai layanan;
- pengguna membutuhkan alur yang jelas, bukan sekadar kotak chat kosong.

Laprakin menyelesaikan masalah tersebut dengan workflow khusus dokumen akademik, dukungan bahan, mode AI, penyimpanan terstruktur, dan pilihan pembayaran fleksibel.

---

## 4. Tujuan Produk

### 4.1 Tujuan Utama

- Mempercepat penyusunan draft akademik berbasis bahan pengguna.
- Meningkatkan keteraturan struktur dan kelengkapan dokumen.
- Mengurangi waktu yang dihabiskan untuk pekerjaan format dan penataan ulang.
- Memberikan kontrol penuh kepada pengguna atas hasil akhir.
- Menyediakan monetisasi yang sesuai pasar mahasiswa Indonesia.
- Menyediakan sistem operasional yang dapat dimonitor dan dikelola admin.

### 4.2 Sasaran Pengalaman

Pengguna baru harus dapat:

1. memahami fungsi produk dalam kurang dari 30 detik di landing page;
2. masuk atau mendaftar tanpa kebingungan;
3. membuat chat pertama dan mengunggah bahan dalam kurang dari 2 menit;
4. mengetahui mode AI yang tersedia dan alasan mode tertentu terkunci;
5. menghasilkan draft pertama dengan alur yang jelas;
6. menemukan kembali chat, project, dokumen, dan transaksi dengan mudah.

### 4.3 Sasaran Bisnis

- Mendorong pengguna gratis mencoba minimal satu workflow lengkap.
- Mengonversi pengguna yang membutuhkan tambahan laprak melalui pembelian satuan.
- Mengonversi pengguna aktif rutin ke Pro.
- Mengonversi pengguna dengan kebutuhan berat ke Max.
- Mengurangi kegagalan pembayaran dan komplain aktivasi melalui webhook yang aman dan idempoten.

---

## 5. Prinsip Produk

### 5.1 Bahan Pengguna adalah Sumber Utama

Sistem harus memprioritaskan modul, file, screenshot, link, instruksi, dan konteks yang diberikan pengguna. Internet hanya digunakan ketika dibutuhkan dan diizinkan oleh konfigurasi workflow.

### 5.2 Tidak Membuat Bukti Palsu

Sistem tidak boleh membuat hasil eksperimen, screenshot, angka pengujian, tabel observasi, atau bukti praktikum palsu. Ketika bahan tidak cukup, sistem harus meminta pengguna melengkapi data atau memberi placeholder yang jelas.

### 5.3 Pengguna Tetap Bertanggung Jawab

Setiap hasil harus diposisikan sebagai draft. UI harus mengingatkan pengguna untuk memeriksa isi, sumber, angka, kesimpulan, dan format sebelum dikumpulkan.

### 5.4 Privasi sebagai Default

Chat, file, project, dan dokumen tidak boleh menjadi publik secara otomatis. Admin tidak boleh membaca isi privat pengguna melalui panel operasional biasa.

### 5.5 Sederhana di Permukaan, Terstruktur di Dalam

UI harus terasa sederhana seperti chat modern, tetapi backend harus menyimpan struktur, metadata, status, histori, dan audit secara lengkap.

### 5.6 Harga Tidak Dipercaya dari Frontend

Semua harga, diskon, total, entitlement, dan status pembayaran harus dihitung atau diverifikasi di server.

### 5.7 Satu Sumber Kebenaran

Plan, credit, entitlement mode AI, status pembayaran, dan hak akses harus memiliki sumber kebenaran tunggal di backend.

---

## 6. Target Pengguna

### 6.1 Pengguna Utama

Mahasiswa diploma, sarjana terapan, dan sarjana yang rutin membuat dokumen akademik berbasis praktikum atau proyek.

### 6.2 Persona

#### Mahasiswa Praktikum Harian

- Menggunakan Laprakin beberapa kali per minggu.
- Memiliki modul dan screenshot.
- Membutuhkan proses cepat dan hemat credit.
- Mode utama: Basic.

#### Mahasiswa Tugas Kompleks

- Membuat laporan panjang, proposal, atau makalah.
- Membutuhkan analisis struktur dan hubungan antarbagian.
- Mode utama: Thinking.

#### Mahasiswa Semester Padat

- Memiliki banyak tugas sekaligus.
- Membutuhkan batas penggunaan, penyimpanan, dan kualitas tertinggi.
- Mode utama: XtraThink.

#### Pengguna Satuan

- Tidak ingin berlangganan.
- Membeli satu atau beberapa credit sesuai kebutuhan.
- Tetap membutuhkan akses Thinking sesuai aturan entitlement.

#### Admin Operasional

- Mengelola landing, feedback, risiko, transaksi, audit, dan retensi.
- Tidak boleh membaca isi chat/file pengguna tanpa mekanisme dukungan yang sah dan tercatat.

---

## 7. Ruang Lingkup

### 7.1 Termasuk dalam Ruang Lingkup

- Landing page publik.
- Pricing publik.
- Registrasi, login, verifikasi email, reset password, dan logout semua perangkat.
- Workspace chat.
- Upload bahan.
- Mode AI Basic, Thinking, dan XtraThink.
- Chat recents, pinned, folder, project, archive, rename, dan delete.
- Dokumen kerja, review, revisi, versi, task, note, parameter, dan export.
- Credit satuan dan subscription Pro/Max.
- QRIS dinamis Midtrans.
- Settings, bahasa, appearance, billing history, help, dan feedback.
- Admin console.
- CMS landing dan media.
- Audit log, risk review, dan retention.
- Tema System, Light, dan Dark untuk seluruh aplikasi selain landing.
- Bahasa Indonesia dan Inggris untuk UI.
- Paket source dan paket Windows tanpa `npm install` untuk kebutuhan lokal/demo.

### 7.2 Di Luar Ruang Lingkup Utama

- Aplikasi native iOS/Android.
- Kolaborasi real-time multi-user.
- Marketplace template pihak ketiga.
- Pemeriksa plagiarisme penuh.
- Verifikasi ilmiah otomatis terhadap hasil eksperimen.
- Integrasi LMS kampus penuh.
- Sinkronisasi production-ready Google Drive/Gmail sebelum OAuth dan kebijakan data diselesaikan.
- Penyimpanan cloud multi-region pada tahap awal.

---

## 8. Identitas Merek dan Desain

### 8.1 Logo

- Brandmark terbaru adalah simbol tunggal tanpa lettermark di dalam mark.
- Bentuk logo harus dipertahankan konsisten pada favicon, navbar, workspace, admin, pricing, auth, dan aset promosi.
- Avatar pengguna tidak boleh menggunakan logo. Avatar menggunakan inisial nama/email pengguna.

### 8.2 Palet Utama

Aksen lama berwarna oranye tidak boleh digunakan pada UI baru.

| Token             |          Nilai | Penggunaan                                         |
| ----------------- | -------------: | -------------------------------------------------- |
| `brand-lime`      |      `#C2FF33` | CTA, active accent, highlight utama                |
| `brand-mint`      |      `#45FFA2` | gradient, secondary accent                         |
| `brand-lime-dark` |      `#79AA00` | teks/ikon lime pada permukaan terang               |
| `landing-bg`      |      `#0F0F0F` | background landing                                 |
| `app-dark-bg`     | charcoal gelap | background aplikasi dark mode, bukan hitam absolut |
| `app-light-bg`    |     warm white | background aplikasi light mode                     |

Gradient utama:

```css
linear-gradient(180deg, #C2FF33 31.7%, #45FFA2 100%)
```

### 8.3 Aturan Aksen

- Semua tombol utama, focus ring, active state, badge penting, dan highlight menggunakan tone lime/mint.
- Tidak boleh ada sisa token oranye pada workspace, pricing, settings, admin, billing, dialog, toast, atau landing.
- Teks pada tombol lime harus hitam/charcoal untuk kontras.
- Hover tidak boleh menjadi satu-satunya tempat perubahan warna; state default harus sudah sesuai desain.

### 8.4 Tipografi

Font utama:

- Plus Jakarta Sans untuk UI dan body.
- Wittgenstein untuk aksen editorial/italic pada headline landing.
- Coolvetica hanya ketika dibutuhkan untuk detail display tertentu.
- Fallback harus didefinisikan agar layout tetap stabil.

### 8.5 Motion

- Animasi harus halus dan mendukung pemahaman, bukan sekadar dekorasi.
- Hormati `prefers-reduced-motion`.
- Tidak boleh ada animasi yang menghalangi interaksi atau menyebabkan layout shift besar.

---

## 9. Arsitektur Informasi

### 9.1 Halaman Publik

- `/` — Landing page.
- `/pricing` — Satu-satunya halaman pricing.
- `/login` — Login.
- `/register` — Registrasi.
- `/verify` — Verifikasi email.
- `/forgot-password` — Permintaan reset password.
- `/reset-password` — Reset password.

### 9.2 Area Pengguna

- `/app` — Workspace/chat awal.
- `/app/chat/:id` — Percakapan.
- `/app/projects` — Daftar project.
- `/app/projects/:id` — Detail project.
- `/app/documents` — Library dokumen.
- `/app/documents/:id` — Dokumen kerja.
- `/app/settings` atau modal settings — Pengaturan.

### 9.3 Redirect Legacy

- `/billing` dan `/app/billing` harus diarahkan ke `/pricing`.
- Riwayat transaksi tetap berada di Settings → Billing.

### 9.4 Admin

- `/admin` — Dashboard monitoring.
- `/admin/feedback` — Feedback.
- `/admin/risk` — Risk review.
- `/admin/cms` — CMS landing.
- `/admin/audit` — Audit log.
- `/admin/retention` — Retention.
- `/admin/payments` — Monitoring order dan fulfilment bila tersedia.

---

## 10. Landing Page

### 10.1 Tujuan

Landing harus menjelaskan produk, workflow, bukti manfaat, fitur, FAQ, dan CTA dalam satu narasi visual yang kuat. Landing bersifat fixed dark theme dan tidak mengikuti appearance workspace.

### 10.2 Acuan Visual

Landing harus mengikuti desain Figma utama sebagai sumber kebenaran untuk:

- ukuran;
- spacing;
- grid;
- typography;
- radius;
- posisi asset;
- urutan section;
- komposisi desktop.

Desktop utama divalidasi pada frame 1440 px. Responsive tablet/mobile harus dibuat sebagai layout adaptif, bukan mengecilkan seluruh halaman menggunakan `transform: scale()`.

### 10.3 Navbar

Persyaratan:

- berbentuk pill lebar;
- sticky/fixed di atas viewport;
- transparan atau sangat ringan saat berada di hero;
- memiliki glass blur/distortion setelah meninggalkan hero;
- menampilkan logo, wordmark, badge BETA, menu, Workspace, dan Login;
- full-width dengan margin responsif;
- tetap terbaca di atas background gelap;
- mobile menggunakan menu ringkas yang dapat diakses keyboard.

Menu:

- Cara pakai;
- Fitur;
- Harga;
- FAQ.

### 10.4 Hero

Konten:

- headline “Fokus praktikum, Serahkan Laprak.”;
- subheadline yang menekankan fokus belajar/praktikum;
- CTA “Coba sekarang”;
- slot video kosong;
- foreground/hill asset bertema Laprakin.

Aturan placeholder:

- Jika video belum tersedia, tampilkan bidang kosong sesuai warna dan radius desain.
- Jangan membuat mockup palsu, garis skeleton, fake UI, card, tombol, atau animasi placeholder yang tidak ada di desain.
- CMS harus dapat mengganti bidang kosong dengan MP4/WebM.

### 10.5 Statement Section

Menampilkan pernyataan nilai besar yang menonjolkan kata “Laprakin” dengan gradient lime.

### 10.6 Cara Pakai

Workflow utama:

1. Masuk ke workspace.
2. Kirim tugas, modul, link, screenshot, atau bahan praktikum.
3. Pilih mode AI.
4. Lengkapi konteks akademik.
5. Tinjau dan rapikan draft.
6. Revisi hingga sesuai.
7. Export saat siap.

Interaksi:

- carousel horizontal;
- card aktif berada di tengah;
- bagian card sebelum/sesudah dapat terlihat di sisi viewport;
- dapat digeser dengan mouse/touch;
- tombol prev/next menyatu dengan carousel, bukan diletakkan jauh di atas;
- mendukung keyboard;
- autoplay tidak wajib.

Media card:

- tetap kosong sampai media diunggah;
- tidak boleh menampilkan mockup buatan developer.

### 10.7 Sumber yang Dibutuhkan

Section menjelaskan bahwa Laprakin dapat menerima:

- modul;
- PDF;
- DOCX;
- screenshot/foto;
- link;
- tabel/CSV/XLSX;
- template;
- catatan teks.

Jika desain hanya menyediakan heading/slot kosong, jangan menambahkan mockup yang tidak ada pada Figma.

### 10.8 Compare

Tujuan: membandingkan AI umum dengan Laprakin.

Persyaratan:

- dua dokumen A4 ditampilkan berdekatan dan sejajar;
- AI lain berada di kiri dan tetap sama pada semua tab;
- Laprakin berada di kanan dan mendapatkan highlight lime;
- tidak ada badge “VS”;
- tab Basic, Thinking, XtraThink hanya mengganti dokumen Laprakin;
- PDF scrollable di dalam frame;
- scrollbar disembunyikan secara visual tanpa menghilangkan fungsi scroll;
- tombol “Lihat PDF” membuka dokumen penuh;
- ukuran tidak terlalu ramping dan menjaga proporsi A4;
- desktop menampilkan dua dokumen dalam satu layar bila memungkinkan;
- mobile menggunakan horizontal swipe atau stacked layout yang tetap terbaca.

### 10.9 Fitur Laprakin

Minimal empat card:

1. Semua bahan dalam satu tempat.
2. Mode AI sesuai kebutuhan.
3. Draft yang dapat direvisi.
4. Bukan cuma laprak — mendukung proposal, makalah, paper, jurnal sederhana, dan dokumentasi akademik.

Media card tetap kosong hingga diisi CMS.

### 10.10 FAQ

Minimal delapan FAQ dengan accordion:

- Apa itu Laprakin?
- Apakah Laprakin membuat bukti praktikum?
- File apa saja yang bisa dikirim?
- Apa perbedaan Basic, Thinking, dan XtraThink?
- Apakah hasil langsung siap dikumpulkan?
- Bisakah digunakan selain laporan praktikum?
- Apakah file pengguna privat?
- Bagaimana proses export dan pembayaran?

Accordion harus:

- dapat digunakan keyboard;
- memiliki `aria-expanded`;
- satu atau beberapa item dapat terbuka sesuai keputusan UX;
- animasi tidak mengganggu.

### 10.11 CTA Akhir dan Footer

CTA akhir:

- logo 3D/brand asset;
- copy singkat;
- tombol “Coba sekarang”.

Footer:

- margin kiri, kanan, dan bawah konsisten;
- background berakhir bersih tanpa strip abu-abu;
- menggunakan tone teks yang terbaca;
- informasi legal, produk, bantuan, dan akses dapat ditambahkan tanpa merusak komposisi;
- responsif.

---

## 11. Authentication dan Akun

### 11.1 Registrasi

Field minimal:

- email;
- password;
- konfirmasi password;
- nama opsional pada tahap pertama.

Persyaratan:

- validasi server-side;
- password disimpan dengan bcrypt;
- email harus unik;
- verifikasi email wajib sebelum pengguna dapat memakai workspace/generate;
- rate limiting;
- pesan error tidak membocorkan informasi akun.

### 11.2 Login

- email dan password;
- session menggunakan cookie aman;
- opsi remember session sesuai kebijakan keamanan;
- setelah login dari pricing, pengguna kembali ke plan/produk yang dipilih.

### 11.3 Verifikasi dan Reset Password

- token satu kali;
- token memiliki masa berlaku;
- token disimpan dalam bentuk hash/HMAC;
- setelah berhasil digunakan, token tidak dapat dipakai ulang.

### 11.4 Device Management

- daftar perangkat/sesi aktif;
- logout perangkat saat ini;
- logout semua perangkat;
- perubahan password dapat mengakhiri sesi lain.

### 11.5 Role

- `user`;
- `admin`.

Admin ditetapkan melalui konfigurasi deployment atau mekanisme role yang terkontrol. Tidak boleh mengandalkan hardcode email pada production.

---

## 12. Workspace

### 12.1 Tujuan

Workspace adalah pusat aktivitas pengguna untuk chat, project, dokumen, upload bahan, mode AI, dan konfigurasi akademik.

### 12.2 Layout

Desktop:

- sidebar kiri;
- area utama;
- header ringan yang menyatu dengan canvas;
- panel konfigurasi kanan hanya bila dibutuhkan.

Mobile:

- sidebar menjadi drawer;
- tidak ada horizontal overflow;
- composer tetap dapat digunakan ketika keyboard virtual terbuka.

### 12.3 Sidebar Expanded

Menampilkan:

- logo dan nama Laprakin;
- tombol collapse;
- Chat baru;
- Chats;
- Projects;
- Dokumen;
- Recents;
- Bantuan;
- Feedback;
- Settings;
- profil/account row.

### 12.4 Sidebar Collapsed

- hanya satu ikon kontrol expand/collapse pada bagian atas;
- tidak menampilkan logo tambahan yang menyebabkan dua ikon;
- account row tetap dapat diklik;
- popover account muncul di sebelah kanan dan tidak terpotong;
- avatar tetap inisial pengguna;
- tooltip muncul saat hover/focus.

### 12.5 Account Popover

Konten:

- avatar inisial;
- nama/email;
- plan aktif;
- Upgrade/Manage plan;
- Personalisasi;
- Jurusan & prodi;
- Settings;
- Help;
- Log out.

Aturan:

- panah berada di ujung kanan sidebar;
- popover tidak permanen;
- tertutup ketika klik di luar, Escape, navigasi, atau timeout 5 detik tanpa interaksi;
- tetap dapat digunakan ketika sidebar collapsed.

### 12.6 Workspace Header

- warna tidak dibedakan secara kontras dari canvas utama;
- menampilkan status plan secara ringkas;
- user Free: `Free plan · Upgrade`;
- user Pro: `Pro · Upgrade/Manage`;
- user Max: `Max · Manage`;
- label Free hilang setelah subscription aktif;
- jika subscription basic lama masih ada, migrasikan menjadi Pro.

---

## 13. Chat dan Composer

### 13.1 Empty State

- composer berada di pusat area utama;
- sapaan berada tepat di atas composer;
- sapaan tidak terlalu besar;
- tidak ada paragraf instruksi panjang di tengah;
- nama pengguna dapat ditampilkan secara personal.

Contoh:

> Mau laprakin apa hari ini, Muba?

### 13.2 Composer

Desain composer mengacu pada pola chat modern:

- card charcoal rounded besar;
- placeholder di area atas;
- tombol `+` di kiri bawah;
- selector mode AI di kanan bawah;
- ikon microphone;
- tombol kirim/waveform;
- shortcut chips di bawah pada empty state.

Shortcut awal:

- Laprak;
- Proposal;
- Makalah;
- Tugas akhir;
- Jurnal.

Shortcut harus mengarah ke mode dokumen akademik yang benar-benar didukung. Integrasi eksternal yang belum tersedia tidak boleh ditampilkan sebagai fitur aktif.

### 13.3 Input

- Enter mengirim;
- Shift+Enter membuat baris baru;
- paste gambar membuat attachment;
- drag and drop file membuat attachment;
- textarea auto-grow hingga batas tertentu;
- state disabled saat request berjalan;
- draft input tidak hilang karena popup atau perubahan minor.

### 13.4 Upload Attachment

Jenis file:

- PDF;
- DOCX;
- TXT;
- Markdown;
- CSV;
- XLSX;
- PNG;
- JPG/JPEG;
- WebP.

Backend harus:

- memvalidasi MIME dan ekstensi;
- membatasi ukuran dan jumlah file;
- menyimpan metadata;
- melakukan scanning/inspection bila tersedia;
- menolak file berbahaya;
- tidak mengekspos path server;
- menampilkan thumbnail/preview nyata untuk PDF, DOCX, gambar, dan file teks bila ekstraksi preview tersedia;
- tidak langsung memproses file saat dipilih atau di-drop; pemrosesan dimulai setelah user mengirim chat.

### 13.5 Attachment Kind

- Modul/artikel;
- Screenshot/bukti;
- Template;
- Data.

### 13.6 Chat Response

Setiap message menyimpan:

- role;
- content;
- timestamp;
- mode AI;
- links yang terdeteksi;
- attachment context;
- status request bila diperlukan.

---

## 14. Mode AI

### 14.1 Basic

- tersedia untuk semua pengguna;
- cocok untuk laprak harian;
- fokus pada respons cepat dan struktur umum;
- konsumsi credit mengikuti konfigurasi server.

### 14.2 Thinking

Akses jika salah satu kondisi terpenuhi:

- pengguna memiliki credit berbayar yang masih aktif; atau
- subscription Pro aktif; atau
- subscription Max aktif.

Tujuan:

- analisis lebih terarah;
- struktur lebih dalam;
- pemeriksaan hubungan antarbagian;
- instruksi lebih kompleks.

### 14.3 XtraThink

- hanya tersedia untuk subscription Max aktif;
- ditujukan untuk tugas kompleks dan dokumen panjang;
- prioritas kualitas dibanding kecepatan.

### 14.4 Enforcement

- mode tidak hanya dikunci di UI;
- server memverifikasi entitlement pada setiap request;
- request yang dimanipulasi harus ditolak;
- alasan lock ditampilkan dengan jelas;
- CTA upgrade mengarah ke `/pricing`.

### 14.5 Provider Abstraction

Backend harus menyediakan lapisan routing AI agar masing-masing mode dapat dipetakan ke:

- provider;
- model;
- reasoning effort;
- token limit;
- timeout;
- cost multiplier;
- fallback.

Credential provider tidak boleh berada di client.

### 14.6 Status Implementasi

Backend saat ini sudah memiliki routing model/mode server-side untuk Basic, Thinking, XtraThink, Document, dan Support. Mode tetap harus diuji ulang setiap kali konfigurasi provider berubah, dan klaim kualitas mode hanya boleh mengikuti konfigurasi server yang benar-benar aktif.

---

## 15. Recents, Search, dan Chat Management

### 15.1 Recents

- menampilkan judul chat;
- fallback judul: `Chat baru`;
- tidak menampilkan label “Belum dikelompokkan”;
- chat yang belum masuk project tetap tampil langsung;
- pinned chat tampil pada kelompok Disematkan.

### 15.2 Search Recents

- ikon search muncul saat area Recents di-hover atau focus-within;
- pencarian berdasarkan judul dan nama folder/project;
- tidak ada fitur sort;
- keyboard accessible;
- clear search mudah ditemukan.

### 15.3 Menu Tiga Titik

Tombol berada di ujung kanan item dan berisi:

- Ubah nama;
- Pindahkan ke folder/project;
- Pin/Unpin;
- Arsip;
- Hapus.

Aturan:

- menu otomatis tertutup setelah 5 detik tanpa interaksi;
- delete membutuhkan custom confirmation dialog;
- tidak menggunakan `window.alert`, `window.confirm`, atau `window.prompt`;
- menu tidak boleh berada di tengah row.

### 15.4 Archive dan Delete

- Archive dapat dipulihkan sesuai kebijakan.
- Delete menggunakan soft delete bila retensi diperlukan.
- Penghapusan permanen mengikuti retention policy.
- Semua operasi memverifikasi ownership di server.

---

## 16. Projects

### 16.1 Tujuan

Project mengelompokkan chat, sumber, dan dokumen berdasarkan mata kuliah, tugas, atau topik.

### 16.2 Daftar Projects

- search project;
- filter Semua, Dibuat oleh kamu, Dibagikan dengan kamu;
- tombol Project baru;
- nama dan waktu perubahan;
- menu tiga titik.

### 16.3 Pembuatan Project

- menggunakan custom dialog;
- nama wajib;
- validasi panjang;
- tidak menggunakan browser prompt.

### 16.4 Detail Project

- nama project;
- composer “Chat baru di [nama project]”;
- tab Chats;
- tab Sumber;
- daftar chat dan dokumen;
- menu share dan project settings ketika fitur tersedia.

### 16.5 Sharing

Sharing dapat disiapkan sebagai fitur bertahap. Bila belum tersedia, UI tidak boleh memberikan kesan bahwa kolaborasi sudah aktif.

---

## 17. Dokumen Kerja

### 17.1 Tipe Dokumen

- Laporan praktikum;
- Proposal;
- Makalah;
- Paper;
- Jurnal sederhana;
- Dokumentasi proyek;
- Custom document.

### 17.2 Metadata

- judul;
- mata kuliah;
- judul modul;
- dosen;
- tahun akademik;
- program studi;
- kelas;
- deadline;
- prioritas;
- profile/recipe dokumen;
- struktur custom.

### 17.3 Struktur Laporan

Default laporan praktikum mengikuti template DOCX default yang disimpan di `server/assets/templates/default-laprak.docx`. Cover harus dipertahankan dari template, termasuk posisi logo, alignment, section break, margin, header/footer, dan style Word. Sistem hanya boleh mengganti field dinamis seperti mata kuliah, modul/topik, dosen, NIP, identitas user, kelas, prodi, jurusan, dan tahun akademik.

Bagian isi tidak boleh membuat ulang identitas praktikum. Identitas user hanya tampil di cover. Struktur isi default:

- pendahuluan atau dasar teori singkat bila dibutuhkan oleh instruksi/template;
- alat dan bahan bila tersedia dari modul;
- langkah kerja/implementasi;
- hasil dan pembahasan;
- analisis output;
- kesimpulan;
- lampiran bila diperlukan.

Struktur harus dapat dikustomisasi dari template yang diunggah user. Template custom dianalisis sebagai struktur dan format, bukan diubah destruktif.

### 17.4 Pembuatan Dokumen

Flow:

1. pengguna mengumpulkan bahan;
2. pengguna melengkapi konteks;
3. sistem membuat dokumen kerja;
4. file dipetakan ke bagian dokumen;
5. sistem melakukan scan/analyze;
6. sistem menghasilkan draft;
7. pengguna review dan revisi;
8. sistem membuat versi;
9. pengguna export.

Jika konteks sudah cukup, AI harus mengeksekusi pekerjaan dan hanya bertanya ketika dokumen benar-benar tidak bisa disusun tanpa jawaban user. Setiap chat yang menghasilkan atau merevisi dokumen wajib memiliki document card. Revisi harus divalidasi agar tetap dalam konteks dokumen sebelum job edit dibuat.

### 17.5 Evidence Mapping

Setiap file/screenshot dapat dipetakan ke:

- section type;
- step number;
- step title;
- caption;
- display order;
- status review.

Untuk laporan praktikum, setiap gambar/screenshot yang masuk ke isi wajib memiliki caption dan penjelasan setelah gambar. Penjelasan harus menyebut apa yang tampak pada gambar, hubungannya dengan langkah praktikum, dan arti hasilnya. Sistem tidak boleh menduplikasi gambar atau membuat deskripsi umum seperti "Gambar X, deskripsi gambar" tanpa konteks.

### 17.6 Parameter dan Template Inspection

- parameter dokumen dapat dibuat/diubah;
- template yang diunggah dapat dianalisis;
- sistem tidak boleh mengubah template secara destruktif tanpa konfirmasi;
- pengguna dapat melihat hasil inspection;
- cover template harus dipreservasi byte-safe sejauh memungkinkan;
- merge DOCX harus menjaga media, relationship, style, theme, section properties, header, dan footer dari template;
- template default wajib melewati quality check agar cover tetap sama dan isi dimulai tanpa halaman kosong tambahan.

### 17.7 Task dan Note

- task otomatis berdasarkan workflow;
- task manual;
- due date;
- status todo/done;
- note dokumen;
- urutan task.

### 17.8 Versioning

- membuat snapshot versi;
- melihat timestamp dan label;
- restore versi;
- restore tidak menghapus histori lama;
- audit restore;
- preview dokumen menampilkan pilihan versi/revisi melalui dropdown pada sidebar preview.

### 17.9 Review Checklist

Contoh check:

- struktur lengkap;
- sumber tersedia;
- bukti nyata tersedia;
- angka telah diperiksa;
- istilah konsisten;
- kesimpulan sesuai hasil;
- format sesuai instruksi;
- pengguna telah membaca ulang.

### 17.10 Export

Format awal:

- DOCX.

Ketentuan:

- export dibuat server-side;
- file memiliki expiry bila disimpan sementara;
- hanya owner yang dapat mengunduh;
- nama file aman;
- export tidak mengubah dokumen sumber;
- status export dan error terlihat jelas.

### 17.11 Quiz Sebelum Unduh

Quiz adalah validasi singkat pemahaman dokumen, bukan ujian sulit.

- Wajib untuk user Free dan user yang memakai credit satuan.
- User subscription dapat langsung unduh atau menyelesaikan quiz.
- Pertanyaan hanya berasal dari isi laprak yang sudah dibuat.
- Jawaban dominan singkat, idealnya 1-5 kata atau pilihan ringkas.
- UI mengikuti tema aktif, kontras jelas, tidak memakai warna-warni yang keluar dari design system.
- Ambang lulus dan retry harus configurable server-side.

---

## 18. Pricing dan Monetisasi

### 18.1 Satu Halaman Pricing

Semua entry point berikut mengarah ke `/pricing`:

- landing;
- workspace header;
- account popover;
- settings billing;
- legacy billing URL.

Pengunjung dapat melihat plan tanpa login. Login baru diwajibkan ketika akan checkout produk berbayar.

### 18.2 Tampilan Pricing

- langsung menampilkan card plan;
- heading pendek, tidak berlebihan;
- compact seperti referensi;
- tombol semua card sejajar;
- mengikuti tema System/Light/Dark;
- responsive;
- tidak menampilkan profil, logo besar, atau history transaksi.

### 18.3 Produk dan Harga Default

Harga harus dikelola server-side dan dapat diubah tanpa mengubah client.

| SKU      | Produk |      Harga Default | Entitlement                                  |
| -------- | ------ | -----------------: | -------------------------------------------- |
| `free`   | Free   |                Rp0 | credit awal dan fitur dasar                  |
| `credit` | Satuan | Rp3.900 per laprak | credit sesuai quantity, tanpa subscription   |
| `pro`    | Pro    | Rp29.900 / 30 hari | 12 credit, Thinking, penyimpanan lebih besar |
| `max`    | Max    | Rp45.900 / 30 hari | 20 credit, XtraThink, batas tertinggi        |

Default benefit yang ditampilkan dapat mencakup:

#### Free

- 2 credit awal;
- 3 revisi per laprak;
- 100 MB penyimpanan.

#### Satuan

- quantity 1–20;
- tanpa subscription;
- hingga 5 revisi per laprak;
- masa aktif credit hingga 180 hari.

#### Pro

- 12 credit / 30 hari;
- Thinking terbuka;
- 1 GB penyimpanan.

#### Max

- 20 credit / 30 hari;
- XtraThink terbuka;
- 5 GB penyimpanan.

Benefit dan harga merupakan konfigurasi server-side dan harus konsisten antara pricing, quote, checkout, invoice, dan fulfilment.

### 18.4 Quantity Credit

- kontrol minus/plus;
- minimum 1;
- maksimum 20 atau nilai server;
- total ditampilkan dari response quote server;
- frontend tidak mengirim harga.

### 18.5 Current Plan

- plan aktif terlihat di workspace/account;
- halaman pricing menandai current plan;
- tindakan menyesuaikan status: pilih, upgrade, manage, atau tidak tersedia;
- downgrade memiliki aturan waktu yang jelas.

### 18.6 History Transaksi

Lokasi: Settings → Billing.

Menampilkan:

- tanggal;
- order ID internal;
- produk;
- jumlah;
- total;
- status;
- metode QRIS;
- tombol refresh status bila pending;
- detail ringkas.

---

## 19. Pembayaran QRIS Dinamis Midtrans

### 19.1 Prinsip

- hanya QRIS;
- QR unik per order;
- nominal dihitung backend;
- status pembayaran tidak dipercaya dari frontend;
- entitlement aktif setelah webhook valid;
- fulfilment idempoten.

### 19.2 Checkout Flow

1. User memilih SKU dan quantity.
2. Client mengirim SKU + quantity.
3. Backend memvalidasi user dan produk.
4. Backend mengambil harga resmi.
5. Backend menghitung subtotal, diskon, dan gross amount.
6. Backend membuat order internal pending.
7. Backend membuat transaksi Midtrans QRIS-only.
8. Client membuka Snap/redirect.
9. Midtrans mengirim webhook.
10. Backend memverifikasi webhook/status API.
11. Backend memperbarui order.
12. Backend mengaktifkan credit/subscription satu kali.
13. Client menampilkan status terbaru.

### 19.3 Order Snapshot

Simpan:

- order ID;
- user ID;
- item SKU;
- quantity;
- harga unit saat checkout;
- subtotal;
- diskon;
- gross amount;
- currency;
- Midtrans transaction ID;
- Snap token/redirect URL sesuai kebutuhan;
- payment type;
- transaction status;
- fraud status;
- timestamps;
- fulfilment status;
- cart hash/idempotency key.

### 19.4 QRIS-only

Payload Midtrans harus membatasi metode ke channel QRIS yang didukung akun. Tidak boleh mengaktifkan kartu, VA, e-wallet non-QRIS, atau metode lain dari aplikasi.

### 19.5 Anti-Duplicate Checkout

- double click tidak membuat banyak order;
- cart identik yang masih pending dapat menggunakan order yang sama;
- idempotency berdasarkan user, cart hash, dan window waktu;
- order yang expired membuat order baru hanya setelah status terkonfirmasi.

### 19.6 Webhook Security

Validasi:

- signature SHA-512 sesuai Midtrans;
- order ID;
- gross amount;
- status transaksi;
- fraud status bila relevan;
- payment channel;
- order internal;
- optional status API verification.

### 19.7 Status

- pending;
- settlement;
- capture bila relevan;
- expire;
- cancel;
- deny;
- refund;
- partial refund.

### 19.8 Fulfilment

- credit/subscription hanya diberikan sekali;
- webhook duplicate tidak menggandakan entitlement;
- tabel fulfilment mencatat item yang sudah diberikan;
- refund memiliki kebijakan pencabutan entitlement yang eksplisit;
- perubahan dicatat dalam wallet/subscription ledger.

### 19.9 Branding

- display name: Laprakin;
- logo Laprakin di dashboard Midtrans;
- hide order ID/header bila fitur dashboard tersedia;
- tidak memakai identitas palsu;
- UI menjelaskan bahwa aplikasi pembayaran dapat menampilkan nama merchant resmi sesuai PJP/QRIS.

### 19.10 Environment

- `MIDTRANS_SERVER_KEY`;
- `MIDTRANS_CLIENT_KEY`;
- `MIDTRANS_IS_PRODUCTION` atau `MIDTRANS_ENVIRONMENT`;
- `PAYMENTS_MODE`;
- `APP_URL`;
- `API_URL`;
- `ALLOWED_ORIGINS`.

Secret tidak boleh masuk ke repository atau bundle client.

---

## 20. Settings

### 20.1 Settings Sidebar Search

- field search di sidebar settings;
- mencari kategori dan subkategori;
- hasil filter langsung;
- clear search;
- keyboard accessible.

### 20.2 General

- Language: Indonesia / English;
- Appearance: System / Light / Dark;
- default Appearance: System;
- perubahan sistem perangkat diikuti otomatis ketika mode System aktif.

### 20.3 Profile

- nama lengkap;
- email read-only atau flow khusus;
- NIM;
- kelas;
- jurusan;
- program studi.

### 20.4 Personalization

- gaya penulisan;
- tone;
- perspektif saya/kami;
- preferensi struktur;
- instruksi default.

### 20.5 Billing

- current plan ringkas;
- link manage/upgrade ke `/pricing`;
- transaction history;
- refresh status;
- tidak menampilkan semua card plan di settings.

### 20.6 Security

- ubah password;
- perangkat aktif;
- logout semua perangkat;
- custom confirmation dialog.

### 20.7 Help dan Feedback

- modal/panel, bukan memutus workspace;
- feedback category;
- rating;
- body;
- izin dihubungi;
- izin quote publik;
- alias publik opsional.

---

## 21. Bahasa dan Lokalisasi

### 21.1 Cakupan

Semua UI sistem harus berubah sesuai bahasa:

- navbar aplikasi;
- sidebar;
- settings;
- pricing;
- billing status;
- dialog;
- toast;
- admin;
- auth;
- empty state;
- label mode AI;
- tanggal dan format angka.

### 21.2 Yang Tidak Diterjemahkan Otomatis

- isi chat pengguna;
- nama project;
- judul dokumen;
- nama file;
- konten CMS yang hanya tersedia dalam satu bahasa;
- hasil dokumen.

### 21.3 Implementasi

- key-based i18n;
- fallback ke Indonesia;
- tidak mengandalkan pencarian dan penggantian DOM secara penuh;
- format tanggal menggunakan locale aktif.

---

## 22. Tema dan Design Tokens Aplikasi

### 22.1 Landing

Landing selalu dark sesuai desain brand.

### 22.2 Aplikasi

- System default;
- Light;
- Dark.

### 22.3 Dark Mode

- charcoal/abu gelap;
- tidak hitam total;
- panel memiliki perbedaan halus;
- active state memakai abu/lime tint, bukan oranye;
- popup tanpa shadow berat.

### 22.4 Light Mode

- warm white;
- border lembut;
- lime digunakan terkontrol;
- kontras memenuhi standar aksesibilitas.

### 22.5 Persistensi

- preference disimpan untuk user login;
- fallback local storage sebelum profile tersedia;
- sinkron antarhalaman.

---

## 23. Notification, Toast, Dialog, dan Popover

### 23.1 Toast

- muncul di kanan atas;
- tidak blur seluruh layar;
- otomatis hilang setelah 5 detik;
- pause ketika hover/focus;
- status success, error, info, warning;
- tidak menggunakan alert browser.

### 23.2 Dialog

- custom;
- mengikuti tema;
- minimalis;
- tanpa shadow berlebihan;
- focus trap;
- Escape menutup bila aman;
- destructive action jelas.

### 23.3 Popover

- menutup ketika klik luar;
- menutup dengan Escape;
- menutup setelah 5 detik idle;
- tidak terpotong viewport/sidebar;
- posisi adaptif.

---

## 24. Admin Console

### 24.1 Prinsip Privasi Admin

Admin melihat metadata operasional, bukan isi privat pengguna. Akses khusus untuk support harus:

- diminta/diizinkan;
- terbatas waktu;
- tercatat;
- memiliki tujuan jelas.

### 24.2 Monitoring

Dashboard minimal:

- total user;
- user aktif;
- chat/documents created;
- order pending/success/failed;
- feedback terbuka;
- risk event;
- job gagal;
- storage usage;
- usage AI per model/mode, token, latency, dan error tanpa prompt/output;
- alert operasional realtime untuk kegagalan generate/export dan kasus credit terpotong tanpa dokumen berhasil dibuat.

### 24.3 Feedback

- list dan filter;
- detail;
- status open/in review/resolved;
- admin note;
- reply;
- promote menjadi testimonial hanya jika user memberi izin public quote.

### 24.4 Risk Review

- event type;
- severity;
- status;
- user metadata minimum;
- reviewer;
- timestamp;
- keputusan;
- audit.

### 24.5 CMS Landing

Admin dapat mengubah:

- announcement;
- CTA;
- testimonial berizin;
- video hero/tutorial;
- media Cara Pakai;
- media Fitur;
- PDF compare Basic;
- PDF compare Thinking;
- PDF compare XtraThink;
- hero/hill assets bila diperlukan;
- FAQ;
- copy section;
- urutan dan visibility section.

Media placeholder tetap kosong bila belum ada file.

### 24.6 Audit Log

Mencatat:

- login admin;
- perubahan CMS;
- pemberian credit admin;
- feedback status/reply;
- risk review;
- retention run;
- perubahan payment/order manual;
- support access;
- perubahan role.

### 24.7 Credit Grant

Admin dapat menambah credit melalui console dengan target:

- satu user spesifik;
- seluruh user;
- user paid.

Grant harus memakai CSRF, role guard admin, audit log, alasan administratif, idempotency key, dan tidak boleh menerima harga atau entitlement dari browser.

### 24.8 Admin Alerts

Admin menerima alert realtime untuk kejadian yang membutuhkan tindakan:

- job generate/export gagal;
- refund credit otomatis gagal;
- credit sudah didebit tetapi dokumen tidak valid atau tidak terbentuk;
- provider AI timeout/error berulang;
- error server yang berdampak pada user.

Alert hanya menyimpan metadata operasional dan dapat ditandai resolved/reopened.

### 24.9 Retention

- preview jumlah data yang akan dihapus;
- run manual dengan konfirmasi;
- kebijakan per jenis data;
- hasil run dicatat;
- kegagalan dapat ditelusuri.

---

## 25. Data Model Konseptual

### 25.1 Identity

- Users;
- Devices;
- User Devices;
- Password Reset Tokens;
- OAuth States;
- Notifications.

### 25.2 Workspace

- Chat Sessions;
- Chat Messages;
- Chat Attachments;
- Projects/Groups;
- Documents;
- Document Files;
- Evidence Mappings;
- Report Sections;
- Document Versions;
- Document Parameters;
- Document Tasks;
- Document Notes;
- Review Checks;
- Exports;
- Jobs;
- File Scans;
- Template Inspections.

### 25.3 Commerce

- Wallet Entries;
- Subscriptions;
- Payment Orders;
- Payment Fulfilments;
- Payment Webhook Events;
- Referrals bila digunakan.

### 25.4 Support dan Operations

- Support Threads;
- Support Messages;
- Support Access;
- Feedback Items;
- Feedback Replies;
- Risk Events;
- Admin Credit Grants;
- Admin Alerts;
- AI Usage Events;
- CMS Entries;
- Audit Logs;
- Email Outbox.

### 25.5 Relasi Utama

- User memiliki banyak chat, attachment, document, order, wallet entry, dan subscription.
- Chat dapat memiliki banyak message dan attachment.
- Chat dapat terhubung ke document.
- Document memiliki files, mappings, sections, versions, tasks, notes, checks, dan exports.
- Payment order memiliki item snapshot, webhook events, dan fulfilments.
- Feedback dimiliki user dan dapat memiliki reply admin.

---

## 26. API dan Validasi

### 26.1 Prinsip API

- JSON REST API;
- auth cookie;
- CSRF untuk operasi state-changing;
- Zod atau schema validator;
- consistent error shape;
- ownership check;
- rate limiting;
- audit pada operasi sensitif.

### 26.2 Error Shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input tidak valid.",
    "fieldErrors": {}
  }
}
```

### 26.3 API Groups

- `/api/auth/*`;
- `/api/profile`;
- `/api/chat/*`;
- `/api/documents/*`;
- `/api/jobs/*`;
- `/api/pricing/*`;
- `/api/payments/*`;
- `/api/wallet/*`;
- `/api/feedback`;
- `/api/support/*`;
- `/api/admin/credits/grant`;
- `/api/admin/ai/usage`;
- `/api/admin/alerts`;
- `/api/admin/events`;
- `/api/admin/*`.

### 26.4 Ownership

Setiap endpoint chat/document/file harus memverifikasi bahwa resource dimiliki user atau user memiliki izin eksplisit.

### 26.5 Idempotency

Wajib untuk:

- checkout;
- webhook;
- fulfilment;
- export job bila retry;
- background job tertentu.

---

## 27. Security dan Privasi

### 27.1 Authentication Security

- bcrypt password hashing;
- secure, httpOnly, sameSite cookies;
- strong production secrets;
- token expiry;
- rate limit login/register/reset;
- session revocation.

### 27.2 CSRF dan CORS

- CSRF token untuk request mutasi;
- origin allowlist;
- credentials hanya pada origin yang diizinkan;
- production tidak menerima wildcard origin dengan credentials.

### 27.3 File Security

- limit size;
- MIME validation;
- filename sanitization;
- isolated storage;
- scan status;
- no executable serving;
- signed/authorized download.

### 27.4 Payment Security

- server key tidak pernah ke client;
- webhook signature;
- amount comparison;
- status API verification bila dikonfigurasi;
- secret redaction di log;
- fulfilment ledger.

### 27.5 Privacy

- file private default;
- tidak menjual data;
- admin tidak membaca isi tanpa support access;
- retention policy;
- user dapat menghapus data sesuai kebijakan;
- log tidak menyimpan isi sensitif secara berlebihan.

---

## 28. Non-Functional Requirements

### 28.1 Performance

- landing LCP target < 2,5 detik pada koneksi baik;
- app initial load < 3 detik;
- interaksi menu < 100 ms;
- API umum p95 < 500 ms tanpa AI/job eksternal;
- gambar WebP/AVIF;
- lazy load media di bawah fold;
- PDF preview tidak memblokir initial render.

### 28.2 Reliability

- graceful error state;
- retry job;
- webhook idempotent;
- database transaction untuk fulfilment;
- health endpoint;
- structured logs.

### 28.3 Accessibility

- keyboard navigation;
- visible focus;
- semantic HTML;
- alt text;
- form labels;
- contrast minimum WCAG AA;
- reduced motion;
- modal focus trap;
- screen reader state untuk accordion/popover.

### 28.4 Responsiveness

Target minimum:

- 360 px mobile;
- 768 px tablet;
- 1024 px laptop;
- 1440 px desktop reference;
- 1920 px wide desktop.

Tidak boleh ada horizontal scroll tidak disengaja.

### 28.5 Browser

- Chrome/Edge terbaru;
- Firefox terbaru;
- Safari terbaru;
- mobile Chrome/Safari.

---

## 29. Observability dan Analytics

### 29.1 Event Produk

- landing CTA clicked;
- pricing viewed;
- plan selected;
- login/register completed;
- chat created;
- file uploaded;
- mode selected/locked clicked;
- document created;
- generation started/completed/failed;
- document version created/restored;
- quiz started/passed/failed;
- export completed;
- checkout created;
- payment settled/expired/failed;
- feedback submitted.

### 29.2 Privacy Analytics

- jangan mengirim isi chat/file ke analytics;
- gunakan ID pseudonim;
- consent sesuai kebutuhan;
- admin analytics hanya agregat.

### 29.3 Operational Logs

- request ID;
- route;
- status;
- duration;
- user ID hashed/pseudonymous bila perlu;
- order ID;
- job ID;
- model/mode;
- token estimate;
- latency;
- error code;
- alert ID bila dibuat;
- tidak mencatat secret.

---

## 30. Success Metrics

### 30.1 Activation

- persentase user baru yang membuat chat pertama;
- persentase user yang mengunggah bahan;
- persentase user yang membuat dokumen pertama;
- waktu menuju draft pertama.

### 30.2 Engagement

- weekly active users;
- chat per active user;
- document per active user;
- revision count;
- export completion rate;
- project adoption.

### 30.3 Monetization

- pricing-to-checkout conversion;
- checkout-to-settlement conversion;
- pembelian satuan vs subscription;
- Pro/Max retention;
- payment failure rate;
- webhook fulfilment latency.

### 30.4 Quality

- generation failure rate;
- user rating;
- support ticket rate;
- duplicate fulfilment count harus 0;
- percentage dokumen yang melewati review checklist.

---

## 31. Functional Acceptance Criteria

### 31.1 Landing

- Desktop 1440 px secara visual sesuai Figma melalui screenshot overlay.
- Placeholder media kosong saat belum diisi.
- Tidak ada aksen oranye.
- Navbar sticky dan tidak menutupi konten.
- Semua section responsive.

### 31.2 Workspace

- Empty composer benar-benar center.
- Sidebar collapsed hanya menampilkan satu control icon.
- Account popover berfungsi di collapsed state.
- Avatar berupa inisial.
- UI mengikuti System/Light/Dark.

### 31.3 Chat

- User dapat mengirim teks dan file.
- File yang dipilih/di-drop tidak diproses sebelum user menekan Enter/kirim.
- Lampiran user tampil di sisi user dengan thumbnail/preview nyata bila tersedia.
- Mode dikunci server-side.
- Chat menu rename/move/pin/archive/delete berfungsi.
- Search Recents berfungsi.
- Tidak ada label “Belum dikelompokkan”.
- Chat yang menghasilkan dokumen selalu menampilkan alur berpikir ringkas, jawaban AI, lalu document card.
- AI hanya bertanya ketika konteks wajib tidak tersedia; jika konteks cukup, AI menjalankan penyusunan/revisi.

### 31.4 Dokumen

- DOCX export memakai template default dan tidak membuat bagian Identitas Praktikum di body.
- Cover default tetap sama dari template kecuali field dinamis.
- Setiap gambar di body memiliki caption dan penjelasan kontekstual setelah gambar.
- Preview dokumen dapat memilih versi/revisi dari dropdown.
- User Free/credit wajib melewati quiz singkat sebelum unduh; user subscription dapat langsung unduh.

### 31.5 Projects

- User dapat membuat project dengan custom dialog.
- Chat dapat dipindahkan ke project.
- Project detail menampilkan chat dan sumber.

### 31.6 Pricing

- Hanya satu halaman `/pricing`.
- Plan dan satuan terlihat tanpa login.
- Tombol sejajar.
- Quote berasal dari backend.
- Riwayat transaksi hanya di Settings → Billing.

### 31.7 Payment

- QRIS satu-satunya metode.
- Nominal tidak dapat dimanipulasi.
- Webhook palsu tidak memberikan entitlement.
- Duplicate webhook tidak menambah credit dua kali.
- Status pending/success/fail/expired/cancel jelas.

### 31.8 Admin

- CMS dapat mengganti media tanpa edit source.
- Testimonial hanya dari feedback berizin.
- Audit log mencatat tindakan admin.
- Admin tidak dapat membuka isi privat dari monitoring biasa.
- Admin dapat memberi credit ke satu user, semua user, atau user paid dengan idempotency dan audit.
- Admin dapat melihat usage AI metadata-only per user/model/mode tanpa prompt/output.
- Admin menerima alert realtime untuk kegagalan generate/export dan credit recovery.

---

## 32. Testing Strategy

### 32.1 Unit Test

- pricing calculation;
- entitlement mode;
- signature verification;
- status mapping;
- fulfilment idempotency;
- validation schema;
- permission checks.
- template DOCX merge contract;
- quiz access policy.

### 32.2 Integration Test

- auth flow;
- chat creation;
- attachment upload;
- document workflow;
- payment checkout;
- webhook settlement;
- duplicate webhook;
- refund/expire;
- CMS upload;
- admin role;
- admin credit grant;
- admin alert resolve/reopen;
- AI usage metadata-only.

### 32.3 E2E

- landing → pricing → login → checkout;
- register → chat → upload → document → export;
- upload evidence → generate DOCX → quiz/download gate;
- email-verified password change;
- pin/rename/move/archive/delete chat;
- create project;
- language/theme switch;
- admin CMS update reflected on landing.

### 32.4 Visual Regression

- capture 1440 px landing;
- overlay dengan Figma;
- threshold per section;
- desktop/tablet/mobile snapshots;
- light/dark workspace snapshots.

### 32.5 Security Test

- CSRF bypass;
- IDOR;
- file upload bypass;
- webhook spoofing;
- amount manipulation;
- duplicate fulfilment;
- dependency audit;
- leaked secret scan;
- brute force;
- XSS in chat/feedback/CMS;
- path traversal.

---

## 33. Deployment dan Environment

### 33.1 Runtime

- Node.js 22+;
- React + Vite client;
- Express server;
- SQLite untuk local/beta;
- static client served oleh server pada paket production lokal.

### 33.2 Production Recommendation

- reverse proxy HTTPS;
- persistent volume/database;
- backup;
- object storage untuk file/media bila skala naik;
- SMTP production;
- Midtrans production keys;
- monitoring/log aggregation;
- migration strategy dari SQLite ketika concurrency meningkat.

### 33.3 Current Production Deployment

Status implementasi saat ini:

- production berjalan di `https://laprakin.app`;
- origin production memakai Docker Compose single-instance pada VPS;
- revision production terakhir yang terdokumentasi: `a9a2c92`;
- `/api/health/ready` harus mengembalikan database `ready`, worker `idle`, AI `configured`, dan Google OAuth `configured`;
- static tutorial media harus tersaji sebagai file media asli, bukan fallback HTML SPA;
- source rollback production disimpan di server deploy agar rollback cepat dapat dilakukan bila health check gagal.

Deployment production saat ini tetap kategori single-instance. Untuk skala publik besar, database, queue, dan object storage harus dipisahkan.

### 33.4 No-NPM Package

Paket lokal Windows dapat menyertakan:

- `node_modules`;
- `client/dist`;
- launcher `.bat`;
- `.env.example`;
- dokumentasi.

Tetap membutuhkan Node.js 22+. Paket no-NPM bukan pengganti deployment production yang benar.

### 33.5 Required Secrets

- JWT secret;
- device/token HMAC secret;
- SMTP credentials;
- Midtrans server/client key;
- AI provider credentials;
- optional OAuth credentials.

---

## 34. Rollout Plan

Status saat ini: fitur inti sudah dipush ke `main` dan dideploy ke production `laprakin.app` sebagai private beta single-instance.

### Phase 1 - Internal Readiness

Status: selesai untuk baseline saat ini.

- workflow chat/document sudah divalidasi melalui E2E lokal;
- template DOCX default dan quality gate sudah memiliki test kontrak;
- admin CMS, admin credit grant, AI usage, dan admin alert sudah tersedia;
- dependency audit production menunjukkan 0 vulnerability saat verifikasi terakhir;
- backup/rollback production tersedia pada deployment VPS.

### Phase 2 - Closed Beta

Status: aktif/berjalan.

- user terbatas;
- monitor generation quality;
- collect feedback;
- tune pricing/credit;
- monitor QRIS fulfilment;
- perbaiki onboarding;
- pantau admin alert untuk kegagalan generate/export dan credit recovery.

### Phase 3 - Public Beta

Status: sebagian aktif. AI dan Google OAuth production sudah terkonfigurasi; pembukaan publik tetap menunggu kesiapan operasional, payment production, policy final, dan monitoring eksternal yang konsisten.

- production Midtrans;
- production SMTP dengan deliverability monitoring;
- published privacy/terms/academic policy;
- support process;
- uptime monitoring eksternal;
- incident response sederhana.

### Phase 4 - Scale

Status: belum menjadi prioritas sebelum traffic stabil.

- database migration bila perlu;
- object storage;
- queue worker;
- analytics dashboard;
- collaboration/integration bertahap.

---

## 35. Risks dan Mitigasi

| Risiko                              | Dampak            | Mitigasi                                                         |
| ----------------------------------- | ----------------- | ---------------------------------------------------------------- |
| Hasil AI tidak sesuai modul         | Trust turun       | Prioritaskan bahan user, review checklist, mode/provider routing |
| Pengguna membuat bukti palsu        | Risiko akademik   | Guardrail, larangan eksplisit, minta bahan nyata                 |
| Harga dimanipulasi frontend         | Kerugian          | Server-side catalog dan quote                                    |
| Webhook duplicate                   | Credit ganda      | Fulfilment idempoten dan unique constraint                       |
| File berbahaya                      | Security incident | MIME validation, scan, isolated storage                          |
| Landing berat                       | Conversion turun  | Optimasi image/video, lazy load                                  |
| Admin membuka data privat           | Privacy breach    | Metadata-only admin, support access audited                      |
| AI mode hanya kosmetik              | Misleading        | Provider abstraction dan test output wajib                       |
| SQLite lock saat skala naik         | Downtime          | Migration plan ke DB production                                  |
| Nama merchant terlihat              | Komplain branding | Jelaskan aturan QRIS/PJP secara jujur                            |
| Credit terdebit tapi dokumen gagal  | Trust turun       | Refund otomatis, admin alert realtime, dan audit job             |
| Template cover bergeser             | Trust turun       | Contract test DOCX, preservasi media/section/style, preview      |

---

## 36. Known Gaps Menuju Public Beta Lebih Luas

- Finalisasi Midtrans production dan uji webhook dari internet publik.
- Pastikan SMTP production dipantau dengan deliverability dan bounce handling.
- Tambahkan monitoring eksternal/uptime alert di luar health endpoint internal.
- Uji visual landing dan workspace pada perangkat nyata yang lebih luas.
- Lengkapi policy final: Terms, Privacy Policy, dan Academic Integrity Policy.
- Tentukan kebijakan refund dan pencabutan entitlement secara legal/operasional.
- Siapkan migrasi dari SQLite/job in-process ke database dan queue terpisah saat traffic naik.
- Evaluasi kebutuhan object storage privat untuk upload dan export.
- Lanjutkan audit route admin/ownership setiap kali endpoint baru ditambahkan.
- Pastikan i18n memakai key-based translation pada seluruh UI sebelum lokalisasi diperluas.

---

## 37. Open Product Decisions

Keputusan berikut harus didokumentasikan sebelum public launch:

1. Berapa konsumsi credit per mode?
2. Apakah credit subscription hangus pada akhir periode atau rollover?
3. Apakah credit satuan dapat digunakan untuk XtraThink tanpa Max?
4. Berapa batas ukuran file per plan?
5. Berapa lama file disimpan setelah akun tidak aktif?
6. Bagaimana mekanisme refund setelah sebagian credit digunakan?
7. Apakah project sharing masuk public beta?
8. Provider/model AI apa untuk tiap mode?
9. Apakah web search aktif otomatis atau harus dipilih pengguna?
10. Apakah export PDF diperlukan selain DOCX?

Sebelum keputusan final, nilai tersebut harus tetap configurable server-side dan tidak disebarkan sebagai janji permanen.

---

## 38. Definition of Done

Sebuah fitur dianggap selesai jika:

- requirement dan acceptance criteria terpenuhi;
- UI mengikuti design tokens;
- responsive;
- keyboard accessible;
- error/loading/empty state tersedia;
- validasi client dan server tersedia;
- permission/ownership diperiksa;
- audit ditambahkan bila sensitif;
- test unit/integration/E2E yang relevan lulus;
- dokumentasi diperbarui;
- tidak ada secret di source;
- build production berhasil;
- smoke test berhasil;
- tidak merusak fitur existing.

---

## 39. Ringkasan Prioritas

### Must Have

- Auth aman.
- Workspace chat dan upload.
- Basic/Thinking/XtraThink dengan server enforcement.
- Recents dan project management.
- Dokumen dan export.
- Unified pricing.
- Credit satuan + Pro + Max.
- QRIS Midtrans aman dan idempoten.
- Settings, theme, language.
- Admin CMS, feedback, audit, risk.
- Landing sesuai Figma dan brand lime.

### Should Have

- Version restore.
- Task/note/review checklist.
- Payment refresh.
- Support access audited.
- Visual regression pipeline.
- Template inspection.

### Could Have

- Google Drive/Gmail integration.
- Project sharing.
- PDF export.
- Cloud storage integration.
- LMS integration.
- Native mobile app.

---

## 40. Penutup

Laprakin harus menjadi workspace akademik yang terasa sederhana bagi pengguna, tetapi memiliki fondasi teknis yang aman, terstruktur, dan dapat dikembangkan. Fokus produk bukan menghasilkan dokumen secara instan tanpa tanggung jawab, melainkan membantu mahasiswa mengolah bahan nyata menjadi draft yang lebih rapi, transparan, dan mudah diperiksa.

Keberhasilan produk ditentukan oleh tiga hal: kualitas workflow, kepercayaan pengguna, dan konsistensi antara janji UI dengan perilaku backend.

---

## 41. Feature Update CMS

### Tujuan

Admin dapat mengumumkan perubahan produk melalui console yang terpisah dari workspace user. User menerima popup yang relevan tanpa terganggu berulang kali.

### Requirement

- Admin console memakai route `/admin` dan role guard server-side.
- Konten memiliki status draft, published, scheduled, dan archived.
- Konten mendukung gambar, label versi, ringkasan, body, maksimal enam highlight, CTA internal, prioritas, audience, serta masa kedaluwarsa.
- Upload gambar hanya menerima PNG, JPG, atau WEBP maksimal 5 MB dan wajib lolos signature validation.
- Workspace memeriksa update saat dibuka dan saat user kembali setelah idle minimal lima menit.
- Receipt disimpan per user di server agar update yang sudah dilihat tidak muncul ulang lintas perangkat.
- Preference update produk dihormati.
- Draft, konten expired, jadwal mendatang, dan audience yang tidak sesuai tidak boleh bocor ke user.
- Semua perubahan admin memakai CSRF, role authorization, validasi schema, dan audit log.

### Acceptance Criteria

- User biasa menerima `403` pada seluruh endpoint CMS admin.
- Admin dapat membuat draft, upload gambar, menjadwalkan, mempublikasikan, dan mengarsipkan update.
- File dengan MIME gambar tetapi signature palsu ditolak.
- Popup hanya muncul sekali setelah receipt `seen` tersimpan.
- Build, smoke test, integration test CMS, dan dependency audit lulus.
