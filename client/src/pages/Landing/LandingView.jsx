import { ArrowLeft, ArrowRight, FileImage, FileSpreadsheet, FileText, Link2, Play, Plus } from 'lucide-react';

const STATEMENT_COPY = 'Laprakin membantu merapikan proses penulisan, supaya energi kamu tetap tercurah pada praktikum dan proses belajar.';
const STATEMENT_WORDS = STATEMENT_COPY.split(' ');
const STATEMENT_LINES = [
  ['Laprakin', 'membantu'],
  ['merapikan', 'proses'],
  ['penulisan,', 'supaya', 'energi'],
  ['kamu', 'tetap', 'tercurah'],
  ['pada', 'praktikum', 'dan', 'proses'],
  ['belajar.'],
];

export const STEPS = [
  ['Masuk ke workspace', 'Buka satu ruang kerja untuk menyimpan bahan, percakapan, draft, dan revisi dalam satu alur.'],
  ['Masukkan semua bahan', 'Tambahkan modul, screenshot, PDF, DOCX, tabel, data, atau tautan yang benar-benar kamu miliki.'],
  ['Lengkapi identitas', 'Isi data akademik dan identitas laporan agar draft mengikuti format yang dibutuhkan.'],
  ['Tinjau dan revisi', 'Periksa draft, minta perubahan pada bagian tertentu, lalu lengkapi bahan yang masih kurang.'],
  ['Kerjakan Quiz', 'Jawab quiz singkat untuk memastikan isi laporan sudah kamu pahami sebelum export.'],
  ['Export saat siap', 'Unduh draft ke Word dan lakukan pengecekan akhir sebelum dokumen dikumpulkan.'],
];
const HOW_TO_IMAGES = STEPS.map((_, index) => `/landing/how-to/Slide ${index + 1}.png`);

// Tiap bahan disebut apa adanya beserta bagian laporan yang memakainya. Tidak
// memakai nama berkas contoh agar tidak terbaca sebagai tangkapan layar produk.
const SOURCES = [
  ['Modul & paper', 'PDF, DOCX', FileText, 'Jadi pegangan teori, urutan kerja, dan batas pembahasan yang diminta.', ['Landasan teori', 'Langkah kerja']],
  ['Bukti praktikum', 'PNG, JPG, WEBP', FileImage, 'Membuat pembahasan menempel pada hasil praktik yang benar-benar terjadi.', ['Hasil praktik', 'Pembahasan']],
  ['Data pengujian', 'CSV, XLSX', FileSpreadsheet, 'Memberi angka dan tabel yang bisa dirujuk saat menulis analisis.', ['Tabel hasil', 'Analisis data']],
  ['Referensi daring', 'Tautan', Link2, 'Melengkapi istilah dan dokumentasi tanpa menggeser bahan utamamu.', ['Definisi istilah', 'Daftar pustaka']],
];

const FEATURES = [
  ['Upload berbagai sumber', 'Masukkan PDF, DOCX, screenshot, gambar, spreadsheet, teks, dan tautan dalam satu workspace.'],
  ['Mode AI sesuai kebutuhan', 'Gunakan Basic untuk tugas harian, Thinking untuk analisis, dan XtraThink untuk pembahasan yang lebih kompleks.'],
  ['Lengkapi identitas akademik', 'Isi profil akademik dan data laporan agar dokumen mengikuti kebutuhanmu. Data ini dipakai hanya saat pembuatan dokumen.'],
  ['Personalisasi penulisan', 'Atur nama panggilan, gaya bahasa, sudut pandang, struktur awal, dan instruksi tambahan sebagai acuan AI.'],
];
const FEATURE_IMAGES = [
  '/landing/fitur/Fitur 1.png',
  '/landing/fitur/Fitur 2.png',
  '/landing/fitur/Fitur 3.png',
  '/landing/fitur/Fitur 4.png',
];
const FEATURE_ROWS = Array.from({ length: Math.ceil(FEATURES.length / 2) }, (_, index) => FEATURES.slice(index * 2, index * 2 + 2));

const FAQS = [
  ['Apa itu Laprakin?', 'Laprakin adalah workspace AI untuk menyusun dan merapikan dokumen akademik berdasarkan bahan yang kamu berikan.'],
  ['Apakah Laprakin membuat bukti praktikum?', 'Tidak. Laprakin tidak membuat screenshot, data, atau hasil praktikum palsu.'],
  ['File apa saja yang bisa digunakan?', 'Kamu dapat memasukkan PDF, DOCX, gambar, screenshot, tabel, spreadsheet, dan tautan sumber.'],
  ['Apa perbedaan Basic, Thinking, dan XtraThink?', 'Ketiganya memiliki kedalaman penalaran yang berbeda. Akses menyesuaikan credit dan paket akun.'],
  ['Apakah hasilnya langsung siap dikumpulkan?', 'Tidak otomatis. Draft tetap perlu diperiksa dan disesuaikan dengan hasil praktikum serta arahan dosen.'],
  ['Apakah file saya privat?', 'File pengguna bersifat privat secara default dan hanya dapat diakses melalui akun terkait.'],
];

function LogoLockup({ footer = false }) {
  return <div className={`fg-logo-lockup ${footer ? 'is-footer' : ''}`}>
    <img src={footer ? '/landing/footer-logo-mark.svg' : '/landing/logo-mark.png'} alt="" />
    <b>laprakin</b>
    <small>BETA</small>
  </div>;
}

function GradientButton({ children, onClick, className = '' }) {
  return <button type="button" onClick={onClick} className={`fg-gradient-button ${className}`} data-node-id="92:222" data-cursor="START"><span data-node-id="92:223">{children}</span></button>;
}

function SectionTitle({ eyebrow, title, children, className = '' }) {
  return <header className={`fg-section-title ${className}`} data-aos="fade-up">
    <span>{eyebrow}</span>
    <h2>{title}</h2>
    {children}
  </header>;
}

function MediaPlaceholder({ label }) {
  return <div className="fg-media-placeholder" role="img" aria-label={`${label} belum tersedia`}>
    <span>{label}</span>
  </div>;
}

function StepCard({ index, active }) {
  const [title, text] = STEPS[index];
  return <article className={`fg-step-card ${active ? 'is-active' : ''}`} data-step-card={index} aria-hidden={!active}>
    <div className="fg-step-media">
      <img src={HOW_TO_IMAGES[index]} alt={`Cara pakai Laprakin: ${title}`} />
    </div>
    <div className="fg-step-copy">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  </article>;
}

export default function LandingView({
  navigate, media, pageRef, statementRef, howViewportRef, howTrackRef,
  stepDragging, step, onMouseDown, onTouchStart, onStepChange,
  openFaq, setOpenFaq, goTo,
}) {
  return <div ref={pageRef} className="fg-page">
    <header className="fg-navbar">
      <button type="button" className="fg-brand-button" data-cursor="TOP" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><LogoLockup /></button>
      <nav aria-label="Navigasi landing page">
        <button type="button" data-cursor="GO" onClick={() => goTo('cara-pakai')}>Cara pakai</button>
        <button type="button" data-cursor="GO" onClick={() => goTo('fitur')}>Fitur</button>
        <button type="button" data-cursor="GO" onClick={() => goTo('faq')}>FAQ</button>
      </nav>
      <div className="fg-navbar-actions">
        <button type="button" className="fg-workspace-link" data-cursor="OPEN" onClick={() => navigate('/auth')}>Workspace</button>
        <button type="button" className="fg-login-button" data-cursor="OPEN" onClick={() => navigate('/auth')}>Log in</button>
      </div>
    </header>

    <main>
      <section className="fg-hero">
        <div className="fg-hero-hill" data-node-id="110:228" aria-hidden="true"><img src="/landing/hills-110-228.png" alt="" /></div>
        <div className="fg-hero-content">
          <div className="fg-hero-copy">
            <h1>Fokus praktikum.<br />Urusan laporan, <span>laprakin.</span></h1>
            <p>Satukan bahan, terima dokumen jadi, dan revisi laporan dalam satu workspace yang memahami alur tugas akademikmu.</p>
          </div>
          <GradientButton onClick={() => navigate('/auth')}>Coba sekarang</GradientButton>
          <div className="fg-video-frame fg-hero-video" data-cursor="PLAY">
            {media.tutorialVideoUrl
               ? <video src={media.tutorialVideoUrl} muted autoPlay loop playsInline aria-label="Video tutorial Laprakin" />
              : <MediaPlaceholder label="Product video" />}
          </div>
        </div>
      </section>

      <section ref={statementRef} className="fg-statement fg-container">
        <p aria-label={STATEMENT_COPY}>
          {STATEMENT_LINES.map((line, lineIndex) => <span key={lineIndex} className="fg-statement-line">
            {line.map((word) => {
              const index = STATEMENT_WORDS.indexOf(word);
              return <span key={`${word}-${lineIndex}`} aria-hidden="true" className={`fg-statement-word ${index === 0 ? 'is-accent' : ''}`}>{word}</span>;
            })}
          </span>)}
        </p>
      </section>

      <section id="cara-pakai" className="fg-how fg-section">
        <SectionTitle eyebrow="How to use" title="Cara Pakai">
          <p>Enam langkah sederhana dari mengunggah bahan sampai mengunduh draft.</p>
        </SectionTitle>
        <div
          ref={howViewportRef}
          className={`fg-how-viewport ${stepDragging ? 'is-dragging' : ''}`}
           role="region"
          aria-label="Geser langkah penggunaan Laprakin"
          data-cursor="DRAG"
          data-step-index={step}
          data-drag-offset="0"
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
        >
          <div ref={howTrackRef} className="fg-how-track">
            {STEPS.map((_, index) => <StepCard key={index} index={index} active={index === step} />)}
          </div>
          <div className="fg-step-controls">
            <button type="button" onClick={() => onStepChange(-1)} aria-label="Langkah sebelumnya"><ArrowLeft size={19} /></button>
            <span>{step + 1} / {STEPS.length}</span>
            <button type="button" onClick={() => onStepChange(1)} aria-label="Langkah berikutnya"><ArrowRight size={19} /></button>
          </div>
        </div>
      </section>

      <section className="fg-sources fg-section fg-container">
        <SectionTitle eyebrow="Your sources" title="Bahanmu bukan sekadar lampiran">
          <p>Setiap modul, data, dan bukti tetap punya jejak ke bagian laporan yang memakainya.</p>
        </SectionTitle>
        <div className="fg-source-grid">
          {SOURCES.map(([title, type, Icon, text, sections], index) => <article key={title} data-aos="fade-up" data-aos-delay={(index % 2) * 90}>
            <span className="fg-source-icon" aria-hidden="true"><Icon size={18} /></span>
            <div className="fg-source-copy">
              <h3>{title}</h3>
              <small>{type}</small>
              <p>{text}</p>
            </div>
            <div className="fg-source-sections">
              <span>Dipakai di bagian</span>
              <ul>{sections.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </article>)}
        </div>
      </section>

      <section className="fg-compare fg-section fg-container">
        <SectionTitle eyebrow="See the difference" title="Lihat perbedaannya dalam satu video">
          <p>Alur dan bahan yang sama, diproses dengan AI umum dan Laprakin. Nilai hasilnya langsung dari proses yang terlihat.</p>
        </SectionTitle>
        <div className="fg-video-frame fg-compare-video" data-aos="zoom-in" data-cursor="PLAY">
          {media.compareVideoUrl
             ? <video src={media.compareVideoUrl} controls playsInline poster={media.compareVideoPosterUrl || ''} aria-label="Video perbandingan Laprakin" />
            : <MediaPlaceholder label="Comparison video" />}
          {!media.compareVideoUrl && <button type="button" className="fg-play-placeholder" aria-label="Video perbandingan belum tersedia"><Play size={24} fill="currentColor" /></button>}
        </div>
      </section>

      <section id="fitur" className="fg-features fg-section fg-container">
        <SectionTitle eyebrow="The features" title="Fitur Laprakin">
          <p>Empat kemampuan utama yang membantu dari bahan sampai dokumen siap ditinjau.</p>
        </SectionTitle>
        <div className="fg-features-stack">
          {FEATURE_ROWS.map((row, rowIndex) => <div className="fg-feature-row" key={row[0][0]}>
            {row.map(([title, text], columnIndex) => {
              const featureIndex = rowIndex * 2 + columnIndex;
              return <article key={title}>
              <div className="fg-feature-copy"><h3>{title}</h3><p>{text}</p></div>
              <img className="fg-feature-image" src={FEATURE_IMAGES[featureIndex]} alt={`Tampilan fitur Laprakin: ${title}`} />
            </article>;
            })}
          </div>)}
        </div>
      </section>

      <section id="faq" className="fg-faq fg-section fg-container">
        <SectionTitle eyebrow="FAQ" title="Pertanyaan yang sering muncul">
          <p>Hal penting yang perlu kamu tahu sebelum mulai menggunakan Laprakin.</p>
        </SectionTitle>
        <div className="fg-faq-list">
          {FAQS.map(([question, answer], index) => <article key={question} className={openFaq === index ? 'is-open' : ''} data-aos="fade-up" data-aos-delay={(index % 3) * 55}>
            <button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)} aria-expanded={openFaq === index}>
              <span>{question}</span><Plus size={20} />
            </button>
            <div className="fg-faq-answer"><p>{answer}</p></div>
          </article>)}
        </div>
      </section>

      <section className="fg-final-cta" data-node-id="92:344">
        <img className="fg-final-glossy-mark" src="/landing/logo-mark-glossy.png" alt="" data-node-id="92:350" data-aos="zoom-in" />
        <div className="fg-final-copy" data-node-id="92:345" data-aos="fade-up">
          <p>Gunakan waktumu untuk praktikum dan belajar, untuk laporan tinggal <strong>laprakin</strong> aja</p>
          <GradientButton onClick={() => navigate('/auth')}>Coba sekarang</GradientButton>
        </div>
      </section>

    </main>

    <footer className="fg-footer" data-node-id="109:227">
      <div className="fg-footer-card" data-node-id="92:334" />
      <div className="fg-footer-hills" data-node-id="110:228" aria-hidden="true">
        <img src="/landing/hills-110-228.png" alt="" />
      </div>
      <div className="fg-footer-content-layer">
        <div className="fg-footer-intro" data-aos="fade-right">
          <LogoLockup footer />
          <p>Workspace AI untuk menyusun laporan dari bahan yang benar-benar kamu punya.</p>
        </div>
        <nav className="fg-footer-links" aria-label="Navigasi footer" data-aos="fade-left">
          <div><b>Produk</b><button type="button" onClick={() => goTo('cara-pakai')}>Cara pakai</button><button type="button" onClick={() => goTo('fitur')}>Fitur</button><button type="button" onClick={() => navigate('/pricing')}>Harga</button></div>
          <div><b>Akses</b><button type="button" onClick={() => navigate('/auth')}>Workspace</button><button type="button" onClick={() => navigate('/auth')}>Masuk</button><button type="button" onClick={() => goTo('faq')}>FAQ</button></div>
          <div><b>Laprakin</b><button type="button" onClick={() => navigate('/privacy')}>Privasi</button><button type="button" onClick={() => navigate('/terms')}>Ketentuan</button><button type="button" onClick={() => navigate('/status')}>Status layanan</button><span>Versi beta</span></div>
        </nav>
      </div>
    </footer>
  </div>;
}
