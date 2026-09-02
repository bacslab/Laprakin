## 21.0.7 - 2026-09-02

- Menyimpan enrollment TOTP admin secara terenkripsi, menolak replay code, dan menambahkan challenge step-up pada seluruh route admin dengan UI enrollment yang bisa dipulihkan secara terkontrol.
- Menjadikan audit admin queryable dengan filter aman dan pencatatan mutation terstruktur yang konsisten tanpa raw IP, token, atau isi dokumen.
- Menambahkan pemeriksaan password opsional berbasis range query k-anonim serta memigrasikan surface Auth ke translation key Indonesia/Inggris.
- Memigrasikan seluruh copy publik Landing, termasuk navigasi, workflow, sumber, fitur, FAQ, CTA, footer, dan label aksesibilitas, ke translation key Indonesia/Inggris.
- Memindahkan label komponen dan nilai status layanan yang dinamis ke translation key Indonesia/Inggris.
- Memigrasikan copy publik Pricing, status pembayaran, dan fallback fitur plan ke translation key Indonesia/Inggris.
- Memigrasikan halaman Billing beserta katalog plan, checkout, dan status pembayaran ke translation key Indonesia/Inggris.
- Memindahkan aturan utama Auth yang viewport-locked ke stylesheet section terpisah dengan contract test, sambil mempertahankan responsive behavior.
- Memindahkan override khusus Auth ke layer stylesheet terpisah dan menurunkan budget compatibility `!important` secara terukur.
- Memindahkan aturan aktif public Pricing dan standalone Billing ke `client/src/styles/pricing.css` dengan breakpoint responsive dan contract test.
- Memigrasikan tutorial Workspace, Composer, mode AI, shortcut prompt, dan label bahan ke translation key Indonesia/Inggris.
- Memigrasikan label preview PDF/Word/file, sumber terlampir, dan aksi lampiran ke translation key Indonesia/Inggris.

## 21.0.6 - 2026-09-02

- Mengekstrak formatter umum dan utilitas normalisasi akademik ke modul client yang dapat diuji secara langsung.
- Mengekstrak `BrandMark`, `Button`, `IconButton`, dan `CustomSelect` dari monolith client tanpa mengubah props atau semantik DOM.
- Menambahkan batas konteks state untuk chat, dokumen, dan UI, serta modul halaman auth, landing, workspace, dan admin sebagai boundary migrasi bertahap.
- Menambahkan lazy loading berbasis route dengan fallback loading yang dapat diumumkan screen reader, plus chunk terpisah untuk halaman utama.
- Menambahkan navigasi keyboard, focus trap, focus return, dan atribut ARIA pada dropdown serta dialog yang disentuh pada fase ini.
- Menambahkan fondasi locale Indonesia/Inggris dengan fallback ke Bahasa Indonesia tanpa menghapus copy utama aplikasi.
- Menambahkan parser SSE dan fallback JSON untuk transport chat, redaksi audit admin dengan hash IP, helper TOTP opsional, serta checker metadata release semver.
- Menghubungkan relay chunk provider AI ke endpoint chat dengan heartbeat, pembatalan saat client terputus, retry sebelum delta pertama, pemeriksaan output bertahap, dan payload kanonis di event akhir.
- Mengaktifkan `helmet` untuk CSP dan header hardening, serta `cors` dengan whitelist origin eksplisit untuk API.

## 21.0.5 - 2026-09-02

- Menambahkan fondasi design token untuk accent, tema charcoal, panel, teks, spacing, radius, shadow, font, dan breakpoint.
- Menambahkan deklarasi cascade layer terurut serta stylesheet landing terisolasi tanpa mengubah markup halaman.

## 21.0.4 - 2026-09-02

- Menambahkan log JSON terstruktur dengan redaksi field rahasia, isi dokumen, dan durasi request.
- Menambahkan adapter pelaporan exception ke Sentry yang hanya aktif saat `SENTRY_DSN` tersedia.
- Menambahkan endpoint liveness publik `/api/status` tanpa mengubah kontrak `/api/health`, beserta panduan monitoring dan respons insiden.

## 21.0.3 - 2026-09-02

- Menambahkan batas safety aplikasi untuk mendeteksi permintaan pengungkapan kredensial, penyebaran malware, dan konten seksual terlarang berisiko tinggi.
- Menormalkan serta membungkus teks lampiran sebagai sumber tidak tepercaya sebelum masuk ke prompt AI, termasuk batas panjang dan pembersihan karakter kontrol.
- Memeriksa output AI sebelum disimpan ke chat atau draft dokumen, dengan respons aman dan audit code tanpa menyimpan isi sensitif.

## 21.0.2 - 2026-09-02

- Menambahkan kontrol `Ubah pesan` pada pesan user untuk mengirim revisi dari titik percakapan yang dipilih.
- Menambahkan kontrol `Buat ulang jawaban` pada jawaban AI, dengan state busy, notice berbahasa Indonesia, dan fokus kembali ke composer saat mode edit aktif.
- Menambahkan helper client dan kontrak test untuk request edit/regenerate tanpa mengubah endpoint chat lama.

## 21.0.1 - Revisi chat server-side tahap 1

- Menambahkan kontrak domain revisi pesan chat di server untuk mode `edit` dan `regenerate`, termasuk validasi sumber pesan user dan nomor revisi berurutan.
- Menambahkan endpoint aditif `POST /api/chat/sessions/:id/messages/:messageId/revise` yang mengembalikan payload percakapan kanonis yang sama ditambah metadata revisi.
- Saat revisi berhasil, server mempertahankan cabang chat sampai pesan sumber lalu mengganti pesan setelahnya secara aman tanpa mengubah kontrak endpoint pesan chat yang sudah ada.

## V37 - Laprak Template, Admin Ops, and Production Private Beta

- Added the default DOCX template contract for laprak export: cover preservation, dynamic cover fields, no body identity section, and contextual explanation after every image.
- Added admin operations documentation for credit grants, metadata-only AI usage, realtime alerts, and credit recovery when document jobs fail.
- Documented production private beta deployment on `laprakin.app`, active revision `a9a2c92`, health checks, static media verification, and rollback source.
- Updated security notes for email-verified password changes, dependency audit status, router dependency removal, admin privacy, and document guardrails.
- Updated beta checklist with template DOCX tests, admin ops tests, quiz/download gate checks, and production health/media checks.

## V36 — Compact Pricing Header & Aligned Actions
- Added a concise pricing headline and helper text above the plan cards.
- Standardized the action slot on every pricing card so Free, Satuan, Pro, and Max CTAs stay on the same horizontal row.
- Preserved the unified `/pricing` route and no-NPM package structure.

# V32

- Rebuilt landing navigation as a pinned rounded header over the full-viewport hero.
- Repaired hero attachment/mode/send row, compacted compare PDF alignment, and normalized responsive footer colors and bottom surface.

## V30 — Landing polish

- Sticky transparent full-width landing navigation; fullscreen hero aligns with the same gutter.
- Removed VS badge and promoted the Laprakin compare card visually.
- Refined responsive pricing and footer.
- Standalone Windows package includes runtime dependencies; no npm install required.

# V29 — Transparent Landing Navigation & Compare Emphasis

- Made the landing navbar transparent and removed section links from the header.
- Added the compact AI mode selector next to the hero send action.
- Reworked Compare so the AI-chat PDF remains stable while only Laprakin output changes by mode.
- Moved compact mode tabs into the Laprakin comparison card, added clear AI-vs-Laprakin emphasis, and retained A4 PDF cards.
- Unified footer outer gutter with the hero, strengthened responsive behavior, and set all footer copy to charcoal contrast colors.

## V25 — AI modes & comparison tabs

- Adds Basic, Thinking, and XtraThink selectors directly beside the chat send action.
- Basic is available to every user; Thinking is server-gated by an active Pro/Max subscription or available paid Laprakin credit; XtraThink is server-gated by an active Max subscription.
- The selected mode is written into message metadata, and the backend rejects forged requests for locked modes.
- Rebuilds landing comparison as a compact tabbed PDF panel for Basic, Thinking, and XtraThink.
- Embeds the supplied Basic comparison PDFs in the Basic tab; CMS now exposes independent PDF fields for Basic, Thinking, and XtraThink pairs.
- Keeps comparison panel within a desktop viewport, makes PDF documents interactively scrollable without the custom hover-pan behavior, and repairs footer contrast/responsiveness.


## V24 — Projects workspace and sidebar repair

- Adds a Projects workspace driven by the existing chat grouping data, with index, search, project detail, chat creation, and source view.
- Repairs collapsed sidebar header so it renders one actual collapse/expand icon only.
- Keeps chat titles visible in expanded Recents and anchors the three-dot action trigger at the far right of each row.

# V20.7 — Compare & Hero Layout Repair

- Restored the compare container as a rounded, content-height orange card and removed the legacy dark inner layer.
- Reworked the hero composer flow so the textarea, upload row, and send action cannot overlap.
- Added short-viewport safeguards for compact desktop windows.


## 20.5.0-beta.1 — Stable Navigation & Orange Gradient Polish
- Replaced scroll-driven landing navigation state with a single immutable fixed glass header to prevent size, position, and transform jitter.
- Applied lighter orange-only gradients to the PDF comparison section and landing footer, removing dark/brown visual treatment.


## V20.4 — Viewport Hero, Two-PDF Compare & Video Tutorial
- Hero landing menggunakan tinggi viewport dengan margin atas, bawah, kanan, dan kiri yang responsif.
- Section perbedaan sekarang membandingkan dua PDF: AI lain dan Laprakin; keduanya bisa diunggah/diubah dari CMS.
- Tutorial landing diganti menjadi video MP4/WEBM yang diputar otomatis saat section terlihat.
- Navigasi route tidak lagi meremount aplikasi pada setiap perpindahan halaman dan ditambah recovery boundary agar kegagalan render tidak berakhir sebagai white screen.
- Tata letak Admin Console diperbaiki dengan area scroll terisolasi, header sticky, serta CMS media yang stabil.
- Build production dibangun ulang tanpa runtime patch DOM lama.

# Changelog

## V20.1
- Dark mode workspace pengguna dan admin diubah ke palet charcoal abu gelap ala Claude: background utama #1F1F1E, panel #1E1E1D/#242422, card/input #2C2C2A, serta border abu netral.
- Menghilangkan nuansa hitam pekat dan cokelat pada surface dark mode, termasuk chat, sidebar, composer, settings, modal, dan seluruh console admin.

## V20
- Navbar landing fixed ke viewport dengan glass light yang stabil saat scroll.
- Hero responsive dengan stage rounded dan composer file/paste image.
- Tutorial gesture/drag dengan navigasi overlay pada gambar.
- Menghapus section CTA lama yang redundan.
- Preview perbandingan mendukung gambar/WEBP atau PDF yang bergerak saat hover.
- CMS admin menambah upload dan URL media untuk hero, perbandingan, serta tiga gambar tutorial.
- Token settings user menggunakan mode light/dark workspace, tanpa warna hard-code.
- Console admin memiliki token sendiri serta toggle tema lokal.

# Changelog

## V19
- Pisahkan routing dan tampilan console admin dari workspace mahasiswa.
- Perbaiki token Settings agar light/dark mengikuti pilihan user secara konsisten.
- Perbaiki alignment account popover di sidebar.
- Perbaiki sticky glass navbar landing.
- Revisi urutan landing: Hero → Layanan → Perbedaan → Tutorial → Harga → Ulasan → Footer.
- Tambah tutorial carousel dengan gambar dummy eksternal dan fallback visual.
- Perbaiki hero attach, spacing, dan CTA compact.


## V18
- Memperbaiki sistem token light/dark agar Settings, input, dropdown, Billing, Storage, dan modal mengikuti mode workspace aktif.
- Landing contrast dan footer diperbaiki dengan warna serta ukuran teks yang lebih mudah dibaca.
- Memisahkan admin menjadi workspace operasional tersendiri tanpa AI chat.
- Admin console mencakup Monitoring, Feedback, Risk Review, CMS Landing, Audit Log, dan Retensi.
- Admin tetap hanya melihat metadata anonim, bukan isi chat, file, dokumen, email, NIM, IP, atau fingerprint.


## V17
- Perbaikan token warna workspace dan Settings dark surface.
- Form setup awal dan konteks chat dibuat lebih ringkas, dengan lampiran modul/paper/screenshot.
- Navbar landing berubah menjadi floating dark-glass setelah scroll.
- Perbandingan landing memakai palet terracotta lembut, footer diperluas dan kontras.
- Role admin bootstrap server-side untuk hilmimubarok2006@gmail.com.

# Changelog

## V16
- Harga diperbarui: Gratis 2 laprak, Satuan Rp3.900/laprak, Bulanan 12 laprak Rp29.900, Pro 20 laprak Rp45.900.
- Hanya paket Bulanan diberi highlight “Direkomendasikan”; semua kartu memakai bahasa visual yang sama.
- Menu akun compact bergaya popover.
- Settings dark modal dengan sidebar internal: General, Notifications, Personalization, Billing, Data controls, Storage, Safety, Security and login, Jurusan & prodi, Keyboard.
- Composer multi-line rounded, plus attach, siap untuk teks panjang.
- Chatroom auto-title dari konteks pertama, rename saat hover, klasifikasi mata kuliah, dan drag-sort tersimpan.

# Changelog

## V15
- Hero menjadi gradient stage rounded dalam viewport pertama.
- Composer hero dan workspace mendukung paste gambar dari clipboard serta thumbnail sebelum dikirim.
- Tambah transisi halaman ringan.
- Landing diurutkan ulang: Tentang → Ulasan → Perbandingan oranye → Cara kerja → Harga.
- Footer orange disamakan dengan gaya hero.

# Changelog

## V14
- Hero landing memenuhi satu layar dan nav berada sebagai overlay.
- Composer hero dikunci tinggi, resize browser dimatikan, dan lampiran file dapat ditambah berulang.
- Tambah Lenis untuk smooth scrolling dan GSAP + ScrollTrigger untuk reveal scroll ringan.
- Jarak antar section landing ditambah agar ritmenya lebih editorial.

# Changelog

## V14
- Dark mode workspace now also covers every settings, billing, feedback, help, notification, and select popup surface.
- Dark mode switch moved to workspace header.
- AI messages sit left; user messages sit right in compact bubbles.
- Image attachments show small authenticated thumbnails.
- Fresh account setup lives inside the first chat and is saved to Settings after completion.
- Hero prompt and selected files survive the login step using browser session storage + IndexedDB.
- Added Jurusan lainnya and Prodi lainnya.
- Pricing/revision policy: Gratis 2 laprak with 3 revisions/report; Satuan and Bulanan 5; Pro Rp49.900 with 25 laprak, 15 revisions/report, 5 GB storage.

# Changelog

## V12
- Memperbaiki dark mode menggunakan token warna workspace untuk input, dropdown, modal, settings, billing, dan kartu konteks.
- Landing dibuat full-bleed agar mengikuti lebar viewport tanpa gutter luar yang besar.
- Mengurangi density workspace: sidebar, header, composer, form konteks, kartu dokumen, dan panel konfigurasi.
- Memperbaiki ukuran sidebar/panel ketika collapse dan mencegah kebocoran lebar panel saat tertutup.
- Toast dipindah ke atas agar tidak menutupi composer.
- Menetapkan hover hanya pada warna/border/background, tanpa floating atau shadow lift.

# Changelog

## V11
- Landing responsive dengan hero prompt terpusat tanpa mockup gambar.
- Perbandingan AI reguler vs Laprakin memakai visual alur, bukan tabel.
- Workspace compact, zero horizontal overflow, sidebar/panel collapse lebih bersih.
- Composer dipusatkan saat belum ada chat.
- Settings sidebar: gaya penulisan, jurusan/prodi, billing, storage, keamanan.
- Dark mode workspace dan custom dropdown/checkbox.
- Help dan Feedback tetap modal.
- Hover hanya warna/border; tidak ada efek floating.

# Changelog

## V10 — Chat-first refinement

- Landing dirombak menjadi hero centered + AI chat composer, tanpa mockup gambar dan tanpa eyebrow.
- Semua CTA utama memakai solid orange; tidak ada tombol gradient.
- Perbandingan AI reguler vs Laprakin diubah menjadi tabel alur kerja yang konkret.
- Ditambah section ulasan dengan placeholder transparan sampai testimoni pengguna yang berizin tersedia.
- Pricing diperjelas: Gratis 2 credit, satuan Rp4.900 per laprak dengan quantity 1–20, dan Bulanan Rp29.900 untuk 16 laprak per 30 hari.
- Workspace dirombak: sidebar kiri dengan navigasi Chat/Dokumen/Harga, center chat lebar, panel konfigurasi kanan khusus laprak.
- Sidebar kiri dan panel kanan memiliki transisi collapse yang halus; mobile memakai drawer.
- Help, Feedback, Notification, dan Settings menjadi modal/sheet sehingga chat tidak ditinggalkan.
- Settings menyatukan personalisasi, profil akademik, jurusan/prodi, storage, dan keamanan akun.
- Halaman Credit lama tidak lagi dipakai; akses credit diarahkan ke halaman Harga.
- Ditambah endpoint pricing quote, storage summary, dan aktivasi sandbox satuan yang hanya aktif pada development/manual payments.
- Subscription sandbox kini memberi 16 credit agar sesuai paket Rp29.900/30 hari.

## V20.2 — Billing workspace & interaction polish
- Billing sekarang berada di halaman workspace khusus melalui Settings > Billing; Settings hanya menjadi pintu masuk.
- Halaman Billing menampilkan current plan, tindakan manage/upgrade yang menyesuaikan plan aktif, dan history transaksi.
- Menambahkan endpoint `/api/billing` untuk ringkasan billing dan riwayat akun tanpa mengekspos isi chat atau dokumen.
- Sidebar compact menampilkan logo Laprakin dan menampilkan ikon expand hanya saat hover; empty state “Belum ada chat.” disembunyikan saat sidebar collapse.
- Account-row chevron dirapikan ke sisi kanan.
- Seluruh popup tanpa shadow; toast dan notification diposisikan ke kanan atas. Notifikasi tidak lagi memakai modal tengah/blur.
- Empty workspace menggunakan headline personal “mau laprakin apa hari ini, user?” tanpa copy onboarding di tengah.

## V20.3 — Landing navigation, media preview, and CMS polish
- Rebuilt the landing navbar as a full-width fixed glass layer with a stable viewport position.
- Kept tutorial previous/next controls inside the image and added pointer drag/swipe support.
- Removed the deprecated “Mulai dari bahan yang sudah ada” landing section when present.
- Expanded landing CMS copy controls and retained image/PDF/WEBP media editing for hero, comparison, and tutorial visuals.
- Updated comparison PDF/image preview hover scrolling, responsive full-width hero, footer scale, and neutral contrast palette.
- Unified admin console tokens with the charcoal dark workspace palette and added partial CMS update protection.

## V21.0 — QRIS Dinamis Midtrans

- Menambahkan cart server-authoritative untuk credit dan subscription dengan snapshot harga/order.
- Checkout Snap dikunci ke `other_qris` agar hanya QRIS dinamis yang tersedia.
- Menambahkan idempotensi checkout, verifikasi signature webhook, verifikasi Status API, dan ledger fulfilment satu kali.
- Menambahkan halaman/status billing QRIS yang dapat refresh setelah callback Snap.
- Memperbarui environment, dokumentasi sandbox/production, branding Laprakin, dan checklist deployment.

## V22 — Workspace controls & plan naming
- Repaired sidebar collapse controls, account popover positioning, and dark charcoal tokens.
- Added pin, rename, move-to-folder, archive, and permanent delete actions to recent chats.
- Centered the first-chat greeting/composer and enlarged the greeting.
- Made toast notifications and transient popovers auto-dismiss after five seconds.
- Renamed visible subscription tiers: monthly/basic is now **Pro**, legacy Pro is now **Max**.
- Simplified the standalone billing plan UI and aligned it with the saved user theme.

## V23 — Workspace language, focused pricing, and theme consistency
- Reduced and vertically centered the first-chat greeting/composer group.
- Reworked `/billing` as a plan-only pricing page; transaction history is now available in Settings > Billing.
- Converted account-popover branding to user initials, and kept the sidebar-collapse control icon-only.
- Applied one persisted appearance preference across workspace, settings, billing, admin, and authentication pages; landing keeps its independent visual system.
- Added a functional Indonesian/English UI language runtime that updates visible interface labels, prompts, controls, and date locale when the language preference is changed.


## V26 — Viewport Compare & Responsive Footer

- Redesigned landing comparison into a viewport-first editorial section: explanatory copy at left and larger two-PDF comparison cards at right.
- Added comparison kicker, description, active-mode caption, and preserved Basic / Thinking / XtraThink tabs.
- PDF cards now prioritize readable first-page previews, remain scrollable, and visually mask native scroll rails for a cleaner embedded appearance.
- Added responsive breakpoints for comparison cards, services, tutorial, pricing, reviews, and the footer.
- Footer now wraps cleanly from four columns to two/one columns without white copy on the orange gradient.

## V27 — Fluid landing layout
- Removed the coloured rounded container from the document comparison section while retaining the editorial compare layout and prominent PDF cards.
- Added fluid landing gutters and responsive section spacing across desktop, tablet, and mobile.
- Refined compare and footer stacking behavior for narrow screens.

## V28 — Balanced hero spacing and A4 compare cards
- Normalized hero card gutter on every side below the sticky navigation.
- Changed the comparison PDF viewports to portrait A4 proportions that scale from available viewport height and grid width.
- Preserved side-by-side desktop comparison and swipeable mobile cards without allowing the visual cards to create runaway section height.

## V31 — System theme & custom workspace dialogs
- Added Appearance: System / Light / Dark. New installations follow the device color scheme by default and react to system theme changes.
- Replaced browser prompt/confirm dialogs with theme-aware Laprakin dialogs for projects, folders, chat deletion, and logout-all.
- Made the Recents settings control functional with persisted sort choices (recently updated or title A–Z).
- Removed the visible "Belum dikelompokkan" label while keeping ungrouped chats in the Recents list.


## V33
- Navbar landing transparan di hero dan berubah menjadi glass ketika melewati hero; jarak PDF compare diperketat.

## V34 — Public Pricing & Sidebar Search
- Added a standalone public `/pricing` route. Visitors can view Free, Pro, and Max plans before signing in; selecting a paid plan only asks for login when checkout is about to start.
- Preserved selected plan intent across login, then opens `/billing?plan=...` for QRIS checkout.
- Replaced Recents sort controls with a hover-only chat search control.
- Added a Settings sidebar search field that filters settings categories.


## V35 — Unified compact pricing
- Replaced the separate billing plan page with one canonical `/pricing` flow.
- Added a compact four-card pricing view: Free, one-off credit, Pro, and Max.
- Added one-off credit quantity selection and QRIS checkout directly in the same pricing route after authentication.
- Redirected legacy `/billing`, `/app/billing`, workspace header, account menu, and Settings plan links to `/pricing`.

## V38 — Motion Landing & Brand Refresh
- Rebuilt the public landing visual system with an original motion-showcase direction.
- Added a video-ready placeholder frame for CMS video uploads.
- Replaced brandmark and favicon assets with the supplied Laprakin logo.
- Kept workspace, pricing, billing, admin, and payment flows unchanged.
