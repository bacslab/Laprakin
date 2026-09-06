import { useEffect, useRef, useState } from 'react';
import { gsap, ScrollTrigger } from 'gsap/all';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { api } from './api';
import LandingView, { STEPS } from './pages/Landing/LandingView';

gsap.registerPlugin(ScrollTrigger);


export default function LandingPage({ navigate, theme = 'dark' }) {
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
      duration: 0.62,
      smoothWheel: true,
      wheelMultiplier: 1.08,
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
    if (lenisRef.current) lenisRef.current.scrollTo(target, { offset: -72, duration: 0.68 });
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

  return <LandingView
    theme={theme}
    navigate={navigate}
    media={media}
    pageRef={pageRef}
    statementRef={statementRef}
    howViewportRef={howViewportRef}
    howTrackRef={howTrackRef}
    stepDragging={stepDragging}
    step={step}
    onMouseDown={startStepMouseDrag}
    onTouchStart={startStepTouchDrag}
    onStepChange={animateStepChange}
    openFaq={openFaq}
    setOpenFaq={setOpenFaq}
    goTo={goTo}
  />;
}
