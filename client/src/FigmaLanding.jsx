import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, FileImage, FileSpreadsheet, FileText, Link2, Play, Plus } from 'lucide-react';
import { gsap, ScrollTrigger } from 'gsap/all';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { api } from './api';
import './figma-landing.css';

gsap.registerPlugin(ScrollTrigger);

const STATEMENT_COPY = 'Laprakin membantu merapikan proses penulisan, supaya energi kamu tetap tercurah pada praktikum dan proses belajar.';
const STATEMENT_WORDS = STATEMENT_COPY.split(' ');

const STEPS = [
  ['Masuk ke workspace', 'Buka satu ruang kerja untuk menyimpan bahan, percakapan, draft, dan revisi dalam satu alur.'],
  ['Masukkan semua bahan', 'Tambahkan modul, screenshot, PDF, DOCX, tabel, data, atau tautan yang benar-benar kamu miliki.'],
  ['Pilih cara berpikir', 'Gunakan Basic untuk kebutuhan harian, Thinking untuk analisis, atau XtraThink untuk tugas kompleks.'],
  ['Tinjau dan revisi', 'Periksa isi, minta perubahan pada bagian tertentu, lalu lengkapi bukti yang masih kurang.'],
  ['Export saat siap', 'Unduh draft ke Word dan lakukan pengecekan akhir sebelum dokumen dikumpulkan.'],
];

const SOURCES = [
  ['Modul & paper', 'PDF / DOCX', FileText, 'Menjadi pegangan teori, urutan kerja, dan batas pembahasan yang memang diminta.', 'modul-praktikum.pdf', ['Landasan teori', 'Langkah kerja']],
  ['Bukti praktikum', 'PNG / JPG / WEBP', FileImage, 'Menjaga pembahasan tetap menempel pada hasil praktik dan kondisi yang benar-benar terjadi.', 'bukti-output.png', ['Hasil praktik', 'Pembahasan']],
  ['Data pengujian', 'CSV / XLSX', FileSpreadsheet, 'Memberi angka, tabel, dan hasil pengukuran yang dapat dirujuk saat analisis.', 'hasil-pengujian.csv', ['Tabel hasil', 'Analisis data']],
  ['Referensi daring', 'URL / DOCS', Link2, 'Melengkapi istilah atau dokumentasi tanpa memutus hubungan dengan bahan utama.', 'docs-referensi.url', ['Definisi istilah', 'Daftar pustaka']],
];

const SOURCE_THREAD_PATHS = [
  'M 4 91 C 76 91, 68 239, 176 239',
  'M 4 169 C 76 169, 68 239, 176 239',
  'M 4 247 C 76 247, 68 239, 176 239',
  'M 4 325 C 76 325, 68 239, 176 239',
];

const FEATURES = [
  ['Bahan tetap terhubung', 'Setiap modul, screenshot, tautan, dan data tetap berada di konteks tugas yang sama.'],
  ['Mode sesuai kebutuhan', 'Pilih tingkat penalaran yang sepadan dengan kompleksitas tugas tanpa membuat alurnya rumit.'],
  ['Revisi tanpa mengulang', 'Perbaiki satu bagian, tambahkan bukti, atau ubah struktur tanpa memulai lagi dari awal.'],
  ['Lebih dari laporan', 'Gunakan alur yang sama untuk proposal, makalah, paper, jurnal, dan dokumen akademik lain.'],
];

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
    <img src={footer ? '/figma-landing/footer-logo-mark.svg' : '/figma-landing/logo-mark.png'} alt="" />
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

function LandingCursor() {
  const dotRef = useRef(null);
  const orbitRef = useRef(null);
  const labelRef = useRef(null);

  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const dot = dotRef.current;
    const orbit = orbitRef.current;
    const label = labelRef.current;
    const page = orbit?.closest('.fg-page');
    const ring = orbit?.querySelector('.fg-cursor-ring');
    if (!finePointer.matches || reducedMotion.matches || !dot || !orbit || !label || !page || !ring) return undefined;

    gsap.set([dot, orbit], { xPercent: -50, yPercent: -50 });
    const moveOrbitX = gsap.quickTo(orbit, 'x', { duration: 0.24, ease: 'power3.out' });
    const moveOrbitY = gsap.quickTo(orbit, 'y', { duration: 0.24, ease: 'power3.out' });
    let previousX = window.innerWidth / 2;
    let previousY = window.innerHeight / 2;

    const show = () => { dot.classList.add('is-visible'); orbit.classList.add('is-visible'); };
    const hide = () => { dot.classList.remove('is-visible'); orbit.classList.remove('is-visible', 'is-interactive', 'has-label', 'is-pressed'); };
    const move = (event) => {
      const deltaX = event.clientX - previousX;
      const deltaY = event.clientY - previousY;
      const speed = Math.min(0.42, Math.hypot(deltaX, deltaY) / 70);
      const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
      const target = event.target.closest('[data-cursor], button, a');
      const cursorLabel = target?.dataset?.cursor || '';

      gsap.set(dot, { x: event.clientX, y: event.clientY });
      moveOrbitX(event.clientX);
      moveOrbitY(event.clientY);
      gsap.to(ring, {
        rotation: Number.isFinite(angle) ? angle : 0,
        scaleX: 1 + speed,
        scaleY: 1 - (speed * 0.22),
        duration: 0.18,
        ease: 'power2.out',
        overwrite: true,
      });
      orbit.classList.toggle('is-interactive', Boolean(target));
      orbit.classList.toggle('has-label', Boolean(cursorLabel));
      label.textContent = cursorLabel;
      previousX = event.clientX;
      previousY = event.clientY;
      show();
    };
    const press = () => orbit.classList.add('is-pressed');
    const release = () => orbit.classList.remove('is-pressed');

    page.addEventListener('pointerenter', show);
    page.addEventListener('pointermove', move);
    page.addEventListener('pointerleave', hide);
    page.addEventListener('pointerdown', press);
    page.addEventListener('pointerup', release);
    page.addEventListener('pointercancel', release);
    return () => {
      page.removeEventListener('pointerenter', show);
      page.removeEventListener('pointermove', move);
      page.removeEventListener('pointerleave', hide);
      page.removeEventListener('pointerdown', press);
      page.removeEventListener('pointerup', release);
      page.removeEventListener('pointercancel', release);
      moveOrbitX.tween?.kill();
      moveOrbitY.tween?.kill();
      gsap.killTweensOf(ring);
    };
  }, []);

  return <>
    <span ref={dotRef} className="fg-cursor-dot" aria-hidden="true" />
    <span ref={orbitRef} className="fg-cursor-orbit" aria-hidden="true">
      <span className="fg-cursor-ring" />
      <span ref={labelRef} className="fg-cursor-label" />
    </span>
  </>;
}

function StepCard({ index, active }) {
  const [title, text] = STEPS[index];
  return <article className={`fg-step-card ${active ? 'is-active' : ''}`} data-step-card={index} aria-hidden={!active}>
    <strong className="fg-step-number">{String(index + 1).padStart(2, '0')}</strong>
    <MediaPlaceholder label="Product preview" />
    <div className="fg-step-copy">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  </article>;
}

export default function FigmaLanding({ navigate }) {
  const [content, setContent] = useState({ media: {}, copy: {} });
  const [step, setStep] = useState(0);
  const [stepDragging, setStepDragging] = useState(false);
  const [sourceFocus, setSourceFocus] = useState(0);
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
    <LandingCursor />
    <header className="fg-navbar">
      <button type="button" className="fg-brand-button" data-cursor="TOP" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><LogoLockup /></button>
      <nav aria-label="Navigasi landing page">
        <button type="button" data-cursor="GO" onClick={() => goTo('cara-pakai')}>Cara pakai</button>
        <button type="button" data-cursor="GO" onClick={() => goTo('fitur')}>Fitur</button>
        <button type="button" data-cursor="OPEN" onClick={() => navigate('/pricing')}>Harga</button>
        <button type="button" data-cursor="GO" onClick={() => goTo('faq')}>FAQ</button>
      </nav>
      <div className="fg-navbar-actions">
        <button type="button" className="fg-workspace-link" data-cursor="OPEN" onClick={() => navigate('/auth')}>Workspace</button>
        <button type="button" className="fg-login-button" data-cursor="OPEN" onClick={() => navigate('/auth')}>Log in</button>
      </div>
    </header>

    <main>
      <section className="fg-hero">
        <div className="fg-hero-hill" data-node-id="110:228" aria-hidden="true"><img src="/figma-landing/hills-110-228.png" alt="" /></div>
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
        <SectionTitle eyebrow="How to use" title="Dari bahan ke draft">
          <p>Lima langkah sederhana tanpa memisahkan bahan, percakapan, dan hasil kerja.</p>
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
        <div className="fg-source-workbench" data-aos="fade-up">
          <header className="fg-source-workbench-head">
            <div><span><i /> SOURCE DESK</span><p>Pilih satu berkas untuk melihat bagaimana konteksnya dibawa ke laporan.</p></div>
            <strong>{String(sourceFocus + 1).padStart(2, '0')} / {String(SOURCES.length).padStart(2, '0')}</strong>
          </header>
          <div className="fg-source-stage">
            <div className="fg-source-stack" aria-label="Pilih sumber untuk melihat perannya">
              <span className="fg-source-stack-label">Bahan masuk</span>
              {SOURCES.map(([title, type, Icon, , filename], index) => <button
                type="button"
                key={title}
                className={sourceFocus === index ? 'is-active' : ''}
                style={{
                  '--source-y': `${56 + (index * 78)}px`,
                  '--source-shift': `${index * 9}px`,
                  '--source-tilt': `${(index - 1.5) * 0.45}deg`,
                }}
                onMouseEnter={() => setSourceFocus(index)}
                onFocus={() => setSourceFocus(index)}
                onClick={() => setSourceFocus(index)}
                aria-pressed={sourceFocus === index}
                data-cursor="TRACE"
              >
                <span className="fg-source-sheet">
                  <span className="fg-source-sheet-top"><span>0{index + 1}</span><small>{type}</small></span>
                  <span className="fg-source-sheet-preview" aria-hidden="true"><i /><i /><i /><i /></span>
                  <span className="fg-source-sheet-file"><Icon size={15} /><b>{filename}</b></span>
                </span>
                <span className="fg-source-tab"><b>{title}</b><small>{type}</small></span>
              </button>)}
            </div>
            <div className="fg-source-thread" aria-hidden="true">
              <svg viewBox="0 0 180 416" preserveAspectRatio="none">
                <path className="fg-source-thread-base" d={SOURCE_THREAD_PATHS[sourceFocus]} />
                <path key={sourceFocus} className="fg-source-thread-live" d={SOURCE_THREAD_PATHS[sourceFocus]} />
                <circle cx="176" cy="239" r="4" />
              </svg>
              <span>context tetap tertaut</span>
            </div>
            <aside className="fg-source-report" aria-live="polite">
              <span className="fg-source-report-holes" aria-hidden="true"><i /><i /><i /><i /><i /></span>
              <header><span>LEMBAR KERJA</span><small>REF. 0{sourceFocus + 1}</small></header>
              <div className="fg-source-report-copy" key={sourceFocus}>
                <small>Sumber aktif</small>
                <h3>{SOURCES[sourceFocus][0]}</h3>
                <p>{SOURCES[sourceFocus][3]}</p>
              </div>
              <div className="fg-source-report-map">
                <span>Diikat ke bagian</span>
                <ul>{SOURCES[sourceFocus][5].map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <footer><span><i /> Tertaut</span><small>{SOURCES[sourceFocus][4]}</small></footer>
            </aside>
          </div>
          <footer className="fg-source-workbench-foot"><span>NO FABRICATED EVIDENCE</span><p>Laprakin menyusun dari bahanmu—bukan mengarang hasil praktik yang tidak ada.</p></footer>
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
        <SectionTitle eyebrow="The features" title="Satu workspace, alur yang utuh">
          <p>Fitur yang membantu pekerjaan akademik tanpa mengambil alih proses belajarmu.</p>
        </SectionTitle>
        <div className="fg-features-grid">
          {FEATURES.map(([title, text], index) => <article key={title} data-aos="fade-up" data-aos-delay={(index % 2) * 90}>
            <div className="fg-feature-copy"><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></div>
            <MediaPlaceholder label="Feature preview" />
          </article>)}
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
        <img className="fg-final-glossy-mark" src="/figma-landing/logo-mark-glossy.png" alt="" data-node-id="92:350" data-aos="zoom-in" />
        <div className="fg-final-copy" data-node-id="92:345" data-aos="fade-up">
          <p>Gunakan waktumu untuk praktikum dan belajar, untuk laporan tinggal <strong>laprakin</strong> aja</p>
          <GradientButton onClick={() => navigate('/auth')}>Coba sekarang</GradientButton>
        </div>
      </section>

    </main>

    <footer className="fg-footer" data-node-id="109:227">
      <div className="fg-footer-landscape" data-node-id="110:228" aria-hidden="true"><img src="/figma-landing/hills-110-228.png" alt="" /></div>
      <div className="fg-footer-card" data-node-id="92:334" />
      <div className="fg-footer-content-layer">
        <div className="fg-footer-intro" data-aos="fade-right">
          <LogoLockup footer />
          <p>Workspace AI untuk menyusun laporan dari bahan yang benar-benar kamu punya.</p>
        </div>
        <nav className="fg-footer-links" aria-label="Navigasi footer" data-aos="fade-left">
          <div><b>Produk</b><button type="button" onClick={() => goTo('cara-pakai')}>Cara pakai</button><button type="button" onClick={() => goTo('fitur')}>Fitur</button><button type="button" onClick={() => navigate('/pricing')}>Harga</button></div>
          <div><b>Akses</b><button type="button" onClick={() => navigate('/auth')}>Workspace</button><button type="button" onClick={() => navigate('/auth')}>Masuk</button><button type="button" onClick={() => goTo('faq')}>FAQ</button></div>
          <div><b>Laprakin</b><span>Privat secara default</span><span>Untuk tugas akademik</span><span>Versi beta</span></div>
        </nav>
        <div className="fg-footer-meta" data-aos="fade-up"><span>© 2026 Laprakin</span><span>Belajar tetap utama. Laporan tinggal dirapikan.</span></div>
      </div>
    </footer>
  </div>;
}
