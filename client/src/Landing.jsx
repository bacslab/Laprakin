import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, FileImage, FileSpreadsheet, FileText, Link2, Play, Plus } from 'lucide-react';
import { gsap, ScrollTrigger } from 'gsap/all';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { api } from './api';
import './landing.css';

gsap.registerPlugin(ScrollTrigger);

const STATEMENT_COPY = 'Laprakin membantu merapikan proses penulisan, supaya energi kamu tetap tercurah pada praktikum dan proses belajar.';
const STATEMENT_WORDS = STATEMENT_COPY.split(' ');

const STEPS = [
  ['Masuk ke workspace', 'Buka satu ruang kerja untuk menyimpan bahan, percakapan, draft, dan revisi dalam satu alur.'],
  ['Masukkan semua bahan', 'Tambahkan modul, screenshot, PDF, DOCX, tabel, data, atau tautan yang benar-benar kamu miliki.'],
  ['Lengkapi identitas', 'Isi data akademik dan identitas laporan agar draft mengikuti format yang dibutuhkan.'],
  ['Tinjau dan revisi', 'Periksa draft, minta perubahan pada bagian tertentu, lalu lengkapi bahan yang masih kurang.'],
  ['Kerjakan Quiz', 'Jawab quiz singkat untuk memastikan isi laporan sudah kamu pahami sebelum export.'],
  ['Export saat siap', 'Unduh draft ke Word dan lakukan pengecekan akhir sebelum dokumen dikumpulkan.'],
];

// Tiap bahan disebut apa adanya beserta bagian laporan yang memakainya. Tidak
// memakai nama berkas contoh agar tidak terbaca sebagai tangkapan layar produk.
const SOURCES = [
  ['Modul & paper', 'PDF, DOCX', FileText, 'Jadi pegangan teori, urutan kerja, dan batas pembahasan yang diminta.', ['Landasan teori', 'Langkah kerja']],
  ['Bukti praktikum', 'PNG, JPG, WEBP', FileImage, 'Membuat pembahasan menempel pada hasil praktik yang benar-benar terjadi.', ['Hasil praktik', 'Pembahasan']],
  ['Data pengujian', 'CSV, XLSX', FileSpreadsheet, 'Memberi angka dan tabel yang bisa dirujuk saat menulis analisis.', ['Tabel hasil', 'Analisis data']],
  ['Referensi daring', 'Tautan', Link2, 'Melengkapi istilah dan dokumentasi tanpa menggeser bahan utamamu.', ['Definisi istilah', 'Daftar pustaka']],
];

const FEATURES = [
  ['Semua bahan dalam satu tugas', 'Upload modul, screenshot, tabel, dan tautan sekali. Laprakin memakainya sebagai konteks saat menyusun draft.'],
  ['AI sesuai tingkat kesulitan', 'Gunakan Basic untuk tugas harian, Thinking untuk analisis, dan XtraThink untuk pembahasan yang lebih kompleks.'],
  ['Revisi bagian tertentu', 'Minta perbaikan pada bab atau paragraf yang dipilih tanpa membuat ulang seluruh dokumen.'],
  ['Berbagai dokumen akademik', 'Susun laprak, proposal, makalah, paper, jurnal, dan dokumen akademik lain dari workspace yang sama.'],
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
    <MediaPlaceholder label="Product preview" />
    <div className="fg-step-copy">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  </article>;
}

export default function LandingPage({ navigate }) {
  const [content, setContent] = useState({ media: {}, copy: {} });
  const [step, setStep] = useState(0);
  const [stepDragging, setStepDragging] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const pageRef = useRef(null);
  const stepDragRef = useRef(null);
  const stepDragOffsetRef = useRef(0);
  const stepWheelRef = useRef({ total: 0, timer: null, baseProgress: 0 });
  const carouselProgressRef = useRef({ value: 0 });
  const carouselTweenRef = useRef(null);
  const statementRef = useRef(null);
  const howViewportRef = useRef(null);
  const howTrackRef = useRef(null);
  const lenisRef = useRef(null);

  const normalizeStep = (value) => ((Math.round(value) % STEPS.length) + STEPS.length) % STEPS.length;
  const getCarouselGap = () => window.innerWidth <= 700
    ? Math.max(330, window.innerWidth * 0.92)
    : Math.min(680, window.innerWidth * 0.48);
  const getCircularDistance = (index, progress) => {
    const wrappedProgress = ((progress % STEPS.length) + STEPS.length) % STEPS.length;
    let distance = index - wrappedProgress;
    if (distance > STEPS.length / 2) distance -= STEPS.length;
    if (distance < -STEPS.length / 2) distance += STEPS.length;
    return distance;
  };
  const renderCarousel = (progress) => {
    const track = howTrackRef.current;
    if (!track) return;
    const gap = getCarouselGap();
    const mobile = window.innerWidth <= 700;
    track.querySelectorAll('[data-step-card]').forEach((card) => {
      const distance = getCircularDistance(Number(card.dataset.stepCard), progress);
      const absoluteDistance = Math.abs(distance);
      const active = absoluteDistance < 0.45;
      gsap.set(card, {
        xPercent: -50,
        x: distance * gap,
        y: absoluteDistance * (mobile ? 52 : 84),
        scale: Math.max(mobile ? 0.82 : 0.76, 1 - (absoluteDistance * (mobile ? 0.13 : 0.15))),
        rotateY: distance * -4,
        opacity: absoluteDistance > 2.15 ? 0 : Math.max(0.08, 1 - (absoluteDistance * 0.48)),
        zIndex: 20 - Math.round(absoluteDistance * 4),
        pointerEvents: active ? 'auto' : 'none',
        force3D: true,
      });
      card.classList.toggle('is-active', active);
      card.setAttribute('aria-hidden', String(!active));
    });
  };

  useEffect(() => {
    api('/public/landing', { includeCsrf: false }).then(setContent).catch(() => {});
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const lenis = new Lenis({
      duration: 1.05,
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.05,
    });
    const updateLenis = (time) => lenis.raf(time * 1000);

    lenisRef.current = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(updateLenis);
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    return () => {
      gsap.ticker.remove(updateLenis);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  useEffect(() => {
    const section = statementRef.current;
    if (!section || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const context = gsap.context(() => {
      const words = gsap.utils.toArray('.fg-statement-word');
      gsap.set(words, { opacity: 0, y: 30, scale: 0.96, filter: 'blur(14px)' });
      gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: () => `+=${Math.max(window.innerHeight * 1.65, 1300)}`,
          pin: true,
          pinSpacing: true,
          scrub: 0.45,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      }).to(words, {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        stagger: 0.14,
        duration: 1,
        ease: 'none',
      });
    }, section);

    return () => context.revert();
  }, []);

  useEffect(() => {
    renderCarousel(carouselProgressRef.current.value);
    const handleResize = () => {
      renderCarousel(carouselProgressRef.current.value);
      ScrollTrigger.refresh();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const root = pageRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const context = gsap.context(() => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('.fg-navbar > *', { opacity: 0, y: -16, duration: 0.65, stagger: 0.08, clearProps: 'transform,opacity' })
        .from('.fg-hero-copy > *', { opacity: 0, y: 28, duration: 0.82, stagger: 0.11, clearProps: 'transform,opacity' }, '-=0.38')
        .from('.fg-hero-content > .fg-gradient-button', { opacity: 0, y: 22, scale: 0.94, duration: 0.72, clearProps: 'transform,opacity' }, '-=0.46')
        .from('.fg-hero-video', { opacity: 0, y: 72, scale: 0.97, duration: 0.92, clearProps: 'transform,opacity' }, '-=0.44');

      gsap.utils.toArray('[data-aos]').forEach((element) => {
        const type = element.dataset.aos || 'fade-up';
        const delay = Number(element.dataset.aosDelay || 0) / 1000;
        const from = type === 'zoom-in'
          ? { opacity: 0, y: 20, scale: 0.94 }
          : type === 'fade-left'
            ? { opacity: 0, x: 42 }
            : type === 'fade-right'
              ? { opacity: 0, x: -42 }
              : { opacity: 0, y: 38 };
        gsap.fromTo(element, from, {
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          duration: 0.82,
          delay,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: element,
            start: 'top 88%',
            toggleActions: 'play none none reverse',
          },
        });
      });

    }, root);

    return () => context.revert();
  }, []);

  const media = content.media || {};
  const goTo = (id) => {
    const target = document.getElementById(id);
    if (!target) return;
    if (lenisRef.current) lenisRef.current.scrollTo(target, { offset: -72, duration: 1.1 });
    else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const updateStepOffset = (offset) => {
    stepDragOffsetRef.current = Math.round(offset);
    if (howViewportRef.current) howViewportRef.current.dataset.dragOffset = String(stepDragOffsetRef.current);
  };
  const animateCarouselTo = (targetProgress, velocity = 0) => {
    const proxy = carouselProgressRef.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    carouselTweenRef.current?.kill();
    setStep(normalizeStep(targetProgress));
    updateStepOffset(0);

    if (reducedMotion) {
      proxy.value = targetProgress;
      renderCarousel(proxy.value);
      return;
    }

    carouselTweenRef.current = gsap.to(proxy, {
      value: targetProgress,
      duration: Math.min(0.94, 0.68 + (Math.abs(targetProgress - proxy.value) * 0.08)),
      ease: Math.abs(velocity) > 0.8 ? 'expo.out' : 'power4.out',
      overwrite: true,
      onUpdate: () => renderCarousel(proxy.value),
      onComplete: () => {
        proxy.value = targetProgress;
        renderCarousel(proxy.value);
        carouselTweenRef.current = null;
      },
    });
  };
  const animateStepChange = (direction) => {
    animateCarouselTo(Math.round(carouselProgressRef.current.value) + direction);
  };
  const startStepDrag = (clientX) => {
    carouselTweenRef.current?.kill();
    stepDragRef.current = {
      startX: clientX,
      startProgress: carouselProgressRef.current.value,
      offset: 0,
      lastX: clientX,
      lastTime: performance.now(),
      velocity: 0,
    };
    setStepDragging(true);
    updateStepOffset(0);
  };
  const moveStepDrag = (clientX) => {
    if (!stepDragRef.current) return;
    const now = performance.now();
    const gap = getCarouselGap();
    const offset = Math.max(-gap * 1.3, Math.min(gap * 1.3, clientX - stepDragRef.current.startX));
    const elapsed = Math.max(1, now - stepDragRef.current.lastTime);
    stepDragRef.current.velocity = (clientX - stepDragRef.current.lastX) / elapsed;
    stepDragRef.current.lastX = clientX;
    stepDragRef.current.lastTime = now;
    stepDragRef.current.offset = offset;
    carouselProgressRef.current.value = stepDragRef.current.startProgress - (offset / gap);
    renderCarousel(carouselProgressRef.current.value);
    updateStepOffset(offset);
  };
  const finishStepDrag = (clientX) => {
    if (!stepDragRef.current) return;
    const drag = stepDragRef.current;
    const offset = drag.offset || (clientX - drag.startX);
    const threshold = getCarouselGap() * 0.11;
    const projectedProgress = carouselProgressRef.current.value - (drag.velocity * 0.2);
    const targetProgress = Math.abs(offset) >= threshold
      ? Math.round(drag.startProgress) + (offset < 0 ? 1 : -1)
      : Math.round(projectedProgress);
    stepDragRef.current = null;
    setStepDragging(false);
    animateCarouselTo(targetProgress, drag.velocity);
  };
  const cancelStepDrag = () => {
    const targetProgress = Math.round(stepDragRef.current?.startProgress ?? carouselProgressRef.current.value);
    stepDragRef.current = null;
    setStepDragging(false);
    animateCarouselTo(targetProgress);
  };
  const startStepMouseDrag = (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;
    event.preventDefault();
    startStepDrag(event.clientX);
    const handleMove = (moveEvent) => moveStepDrag(moveEvent.clientX);
    const handleUp = (upEvent) => {
      finishStepDrag(upEvent.clientX);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };
  const startStepTouchDrag = (event) => {
    if (event.target.closest('button')) return;
    const touch = event.touches[0];
    if (!touch) return;
    startStepDrag(touch.clientX);
    const handleMove = (moveEvent) => {
      const nextTouch = moveEvent.touches[0];
      if (!nextTouch) return;
      moveStepDrag(nextTouch.clientX);
      if (Math.abs(stepDragRef.current?.offset || 0) > 8) moveEvent.preventDefault();
    };
    const handleEnd = (endEvent) => {
      finishStepDrag(endEvent.changedTouches[0]?.clientX || stepDragRef.current?.startX || 0);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleCancel);
    };
    const handleCancel = () => {
      cancelStepDrag();
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleCancel);
    };
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleCancel);
  };
  const handleStepWheel = (event) => {
    const horizontalDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.05
      ? event.deltaX
      : (event.shiftKey ? event.deltaY : 0);
    if (Math.abs(horizontalDelta) < 1) return;

    event.preventDefault();
    event.stopPropagation();
    carouselTweenRef.current?.kill();
    if (stepWheelRef.current.total === 0) stepWheelRef.current.baseProgress = carouselProgressRef.current.value;
    stepWheelRef.current.total += horizontalDelta;
    carouselProgressRef.current.value = stepWheelRef.current.baseProgress + (stepWheelRef.current.total / getCarouselGap());
    renderCarousel(carouselProgressRef.current.value);
    updateStepOffset(-stepWheelRef.current.total);

    if (stepWheelRef.current.timer) window.clearTimeout(stepWheelRef.current.timer);
    stepWheelRef.current.timer = window.setTimeout(() => {
      const total = stepWheelRef.current.total;
      const baseProgress = stepWheelRef.current.baseProgress;
      stepWheelRef.current.total = 0;
      stepWheelRef.current.timer = null;
      const targetProgress = Math.abs(total) >= 36
        ? Math.round(baseProgress) + (total > 0 ? 1 : -1)
        : Math.round(baseProgress);
      animateCarouselTo(targetProgress, total / 90);
    }, 110);
  };

  useEffect(() => {
    const viewport = howViewportRef.current;
    if (!viewport) return undefined;
    viewport.addEventListener('wheel', handleStepWheel, { passive: false });

    return () => {
      viewport.removeEventListener('wheel', handleStepWheel);
      if (stepWheelRef.current.timer) window.clearTimeout(stepWheelRef.current.timer);
    };
  }, []);

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
            <p>Satukan bahan, susun draft, dan revisi laporan dalam satu workspace yang memahami alur tugas akademikmu.</p>
          </div>
          <GradientButton onClick={() => navigate('/auth')}>Coba sekarang</GradientButton>
          <div className="fg-video-frame fg-hero-video" data-cursor="PLAY">
            {media.tutorialVideoUrl
              ? <video src={media.tutorialVideoUrl} muted autoPlay loop playsInline />
              : <MediaPlaceholder label="Product video" />}
          </div>
        </div>
      </section>

      <section ref={statementRef} className="fg-statement fg-container">
        <p aria-label={STATEMENT_COPY}>
          {STATEMENT_WORDS.map((word, index) => <span key={`${word}-${index}`} aria-hidden="true" className={`fg-statement-word ${index === 0 ? 'is-accent' : ''}`}>{word}</span>)}
        </p>
      </section>

      <section id="cara-pakai" className="fg-how fg-section">
        <SectionTitle eyebrow="How to use" title="Cara Pakai">
          <p>Enam langkah sederhana dari mengunggah bahan sampai mengunduh draft.</p>
        </SectionTitle>
        <div
          ref={howViewportRef}
          className={`fg-how-viewport ${stepDragging ? 'is-dragging' : ''}`}
          role="group"
          aria-label="Geser langkah penggunaan Laprakin"
          data-cursor="DRAG"
          data-step-index={step}
          data-drag-offset="0"
          tabIndex="0"
          onMouseDown={startStepMouseDrag}
          onTouchStart={startStepTouchDrag}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') animateStepChange(-1);
            if (event.key === 'ArrowRight') animateStepChange(1);
          }}
        >
          <div ref={howTrackRef} className="fg-how-track">
            {STEPS.map((_, index) => <StepCard key={index} index={index} active={index === step} />)}
          </div>
          <div className="fg-step-controls">
            <button type="button" onClick={() => animateStepChange(-1)} aria-label="Langkah sebelumnya"><ArrowLeft size={19} /></button>
            <span>{step + 1} / {STEPS.length}</span>
            <button type="button" onClick={() => animateStepChange(1)} aria-label="Langkah berikutnya"><ArrowRight size={19} /></button>
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
            ? <video src={media.compareVideoUrl} controls playsInline poster={media.compareVideoPosterUrl || ''} />
            : <MediaPlaceholder label="Comparison video" />}
          {!media.compareVideoUrl && <button type="button" className="fg-play-placeholder" aria-label="Video perbandingan belum tersedia"><Play size={24} fill="currentColor" /></button>}
        </div>
        <p className="fg-compare-note" data-aos="fade-up">Video akan menampilkan prompt, bahan, proses, dan output secara berdampingan—tanpa klaim yang dibuat-buat.</p>
      </section>

      <section id="fitur" className="fg-features fg-section fg-container">
        <SectionTitle eyebrow="The features" title="Fitur Laprakin">
          <p>Empat kemampuan utama yang membantu dari bahan sampai dokumen siap ditinjau.</p>
        </SectionTitle>
        <div className="fg-features-stack">
          {FEATURE_ROWS.map((row, rowIndex) => <div className="fg-feature-row" key={row[0][0]}>
            {row.map(([title, text], index) => <article key={title}>
              <div className="fg-feature-copy"><span>0{(rowIndex * 2) + index + 1}</span><h3>{title}</h3><p>{text}</p></div>
              <MediaPlaceholder label="Feature preview" />
            </article>)}
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
          <div><b>Laprakin</b><button type="button" onClick={() => navigate('/privacy')}>Privasi</button><button type="button" onClick={() => navigate('/terms')}>Ketentuan</button><span>Versi beta</span></div>
        </nav>
      </div>
    </footer>
  </div>;
}
