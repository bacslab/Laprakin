import { ArrowLeft, ArrowRight, FileImage, FileSpreadsheet, FileText, Link2, Play, Plus } from 'lucide-react';
import { useI18n } from '../../i18n/context';

const STATEMENT_LINE_KEYS = [
  'landing.statementLine1',
  'landing.statementLine2',
  'landing.statementLine3',
  'landing.statementLine4',
  'landing.statementLine5',
  'landing.statementLine6',
];

export const STEPS = [
  ['landing.steps.enter.title', 'landing.steps.enter.description'],
  ['landing.steps.sources.title', 'landing.steps.sources.description'],
  ['landing.steps.identity.title', 'landing.steps.identity.description'],
  ['landing.steps.review.title', 'landing.steps.review.description'],
  ['landing.steps.quiz.title', 'landing.steps.quiz.description'],
  ['landing.steps.export.title', 'landing.steps.export.description'],
];
const HOW_TO_IMAGES = STEPS.map((_, index) => `/landing/how-to/Slide ${index + 1}.png`);

// Tiap bahan disebut apa adanya beserta bagian laporan yang memakainya. Tidak
// memakai nama berkas contoh agar tidak terbaca sebagai tangkapan layar produk.
const SOURCES = [
  ['landing.sources.module.title', 'landing.sources.module.type', FileText, 'landing.sources.module.description', ['landing.sources.module.sectionTheory', 'landing.sources.module.sectionSteps']],
  ['landing.sources.evidence.title', 'landing.sources.evidence.type', FileImage, 'landing.sources.evidence.description', ['landing.sources.evidence.sectionResult', 'landing.sources.evidence.sectionDiscussion']],
  ['landing.sources.data.title', 'landing.sources.data.type', FileSpreadsheet, 'landing.sources.data.description', ['landing.sources.data.sectionTable', 'landing.sources.data.sectionAnalysis']],
  ['landing.sources.web.title', 'landing.sources.web.type', Link2, 'landing.sources.web.description', ['landing.sources.web.sectionTerms', 'landing.sources.web.sectionReferences']],
];

const FEATURES = [
  ['landing.features.upload.title', 'landing.features.upload.description'],
  ['landing.features.aiMode.title', 'landing.features.aiMode.description'],
  ['landing.features.export.title', 'landing.features.export.description'],
  ['landing.features.personalize.title', 'landing.features.personalize.description'],
];
const FEATURE_ROWS = Array.from({ length: Math.ceil(FEATURES.length / 2) }, (_, index) => FEATURES.slice(index * 2, index * 2 + 2));

const FAQS = [
  ['landing.faq.what.question', 'landing.faq.what.answer'],
  ['landing.faq.evidence.question', 'landing.faq.evidence.answer'],
  ['landing.faq.files.question', 'landing.faq.files.answer'],
  ['landing.faq.modes.question', 'landing.faq.modes.answer'],
  ['landing.faq.ready.question', 'landing.faq.ready.answer'],
  ['landing.faq.privacy.question', 'landing.faq.privacy.answer'],
];

function LogoLockup({ footer = false, beta }) {
  return <div className={`fg-logo-lockup ${footer ? 'is-footer' : ''}`}>
    <img src={footer ? '/landing/footer-logo-mark.svg' : '/landing/logo-mark.png'} alt="" />
    <b>laprakin</b>
    <small>{beta}</small>
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

function MediaPlaceholder({ label, unavailable }) {
  return <div className="fg-media-placeholder" role="img" aria-label={`${label} ${unavailable}`}>
    <span>{label}</span>
  </div>;
}

function StepCard({ index, active, t }) {
  const [titleKey, textKey] = STEPS[index];
  const title = t(titleKey);
  return <article className={`fg-step-card ${active ? 'is-active' : ''}`} data-step-card={index} aria-hidden={!active}>
    <div className="fg-step-media">
      <img src={HOW_TO_IMAGES[index]} alt={t('landing.stepAlt', { title })} />
    </div>
    <div className="fg-step-copy">
      <h3>{title}</h3>
      <p>{t(textKey)}</p>
    </div>
  </article>;
}

export default function LandingView({
  navigate, media, pageRef, statementRef, howViewportRef, howTrackRef,
  stepDragging, step, onMouseDown, onTouchStart, onStepChange,
  openFaq, setOpenFaq, goTo,
}) {
  const { t } = useI18n();
  const statementCopy = t('landing.statement');
  const statementLines = STATEMENT_LINE_KEYS.map((key) => t(key));
  const statementWords = statementCopy.split(' ');

  return <div ref={pageRef} className="fg-page">
    <header className="fg-navbar">
      <button type="button" className="fg-brand-button" data-cursor="TOP" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><LogoLockup beta={t('landing.beta')} /></button>
      <nav aria-label={t('landing.navLabel')}>
        <button type="button" data-cursor="GO" onClick={() => goTo('cara-pakai')}>{t('landing.navHowTo')}</button>
        <button type="button" data-cursor="GO" onClick={() => goTo('fitur')}>{t('landing.navFeatures')}</button>
        <button type="button" data-cursor="GO" onClick={() => goTo('faq')}>{t('landing.navFaq')}</button>
      </nav>
      <div className="fg-navbar-actions">
        <button type="button" className="fg-workspace-link" data-cursor="OPEN" onClick={() => navigate('/auth')}>{t('landing.workspace')}</button>
        <button type="button" className="fg-login-button" data-cursor="OPEN" onClick={() => navigate('/auth')}>{t('landing.login')}</button>
      </div>
    </header>

    <main>
      <section className="fg-hero">
        <div className="fg-hero-hill" data-node-id="110:228" aria-hidden="true"><img src="/landing/hills-110-228.png" alt="" /></div>
        <div className="fg-hero-content">
          <div className="fg-hero-copy">
            <h1>{t('landing.heroTitleLead')}<br />{t('landing.heroTitleReport')} <span>{t('landing.heroTitleAccent')}</span></h1>
            <p>{t('landing.heroDescription')}</p>
          </div>
          <GradientButton onClick={() => navigate('/auth')}>{t('landing.tryNow')}</GradientButton>
          <div className="fg-video-frame fg-hero-video" data-cursor="PLAY">
            {media.tutorialVideoUrl
               ? <video src={media.tutorialVideoUrl} muted autoPlay loop playsInline aria-label={t('landing.tutorialVideo')} />
              : <MediaPlaceholder label={t('landing.tutorialPlaceholder')} unavailable={t('landing.mediaUnavailable')} />}
          </div>
        </div>
      </section>

      <section ref={statementRef} className="fg-statement fg-container">
        <p aria-label={statementCopy}>
          {statementLines.map((line, lineIndex) => <span key={lineIndex} className="fg-statement-line">
            {line.split(' ').map((word, wordIndex) => {
              const index = statementWords.indexOf(word);
              return <span key={`${word}-${lineIndex}`} aria-hidden="true" className={`fg-statement-word ${index === 0 && wordIndex === 0 ? 'is-accent' : ''}`}>{word}</span>;
            })}
          </span>)}
        </p>
      </section>

      <section id="cara-pakai" className="fg-how fg-section">
        <SectionTitle eyebrow={t('landing.howEyebrow')} title={t('landing.howTitle')}>
          <p>{t('landing.howDescription')}</p>
        </SectionTitle>
        <div
          ref={howViewportRef}
          className={`fg-how-viewport ${stepDragging ? 'is-dragging' : ''}`}
           role="region"
          aria-label={t('landing.howRegion')}
          data-cursor="DRAG"
          data-step-index={step}
          data-drag-offset="0"
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
        >
          <div ref={howTrackRef} className="fg-how-track">
            {STEPS.map((_, index) => <StepCard key={index} index={index} active={index === step} t={t} />)}
          </div>
          <div className="fg-step-controls">
            <button type="button" onClick={() => onStepChange(-1)} aria-label={t('landing.previousStep')}><ArrowLeft size={19} /></button>
            <span>{step + 1} / {STEPS.length}</span>
            <button type="button" onClick={() => onStepChange(1)} aria-label={t('landing.nextStep')}><ArrowRight size={19} /></button>
          </div>
        </div>
      </section>

      <section className="fg-sources fg-section fg-container">
        <SectionTitle eyebrow={t('landing.sourceEyebrow')} title={t('landing.sourceTitle')}>
          <p>{t('landing.sourceDescription')}</p>
        </SectionTitle>
        <div className="fg-source-grid">
          {SOURCES.map(([titleKey, typeKey, Icon, textKey, sectionKeys], index) => <article key={titleKey} data-aos="fade-up" data-aos-delay={(index % 2) * 90}>
            <span className="fg-source-icon" aria-hidden="true"><Icon size={18} /></span>
            <div className="fg-source-copy">
              <h3>{t(titleKey)}</h3>
              <small>{t(typeKey)}</small>
              <p>{t(textKey)}</p>
            </div>
            <div className="fg-source-sections">
              <span>{t('landing.sourceUsedAt')}</span>
              <ul>{sectionKeys.map((key) => <li key={key}>{t(key)}</li>)}</ul>
            </div>
          </article>)}
        </div>
      </section>

      <section className="fg-compare fg-section fg-container">
        <SectionTitle eyebrow={t('landing.compareEyebrow')} title={t('landing.compareTitle')}>
          <p>{t('landing.compareDescription')}</p>
        </SectionTitle>
        <div className="fg-video-frame fg-compare-video" data-aos="zoom-in" data-cursor="PLAY">
          {media.compareVideoUrl
             ? <video src={media.compareVideoUrl} controls playsInline poster={media.compareVideoPosterUrl || ''} aria-label={t('landing.compareVideo')} />
            : <MediaPlaceholder label={t('landing.comparePlaceholder')} unavailable={t('landing.mediaUnavailable')} />}
          {!media.compareVideoUrl && <button type="button" className="fg-play-placeholder" aria-label={t('landing.videoUnavailable')}><Play size={24} fill="currentColor" /></button>}
        </div>
      </section>

      <section id="fitur" className="fg-features fg-section fg-container">
        <SectionTitle eyebrow={t('landing.featuresEyebrow')} title={t('landing.featuresTitle')}>
          <p>{t('landing.featuresDescription')}</p>
        </SectionTitle>
        <div className="fg-features-stack">
          {FEATURE_ROWS.map((row) => <div className="fg-feature-row" key={row[0][0]}>
            {row.map(([titleKey, textKey]) => {
              const title = t(titleKey);
              return <article key={titleKey}>
              <div className="fg-feature-copy"><h3>{title}</h3><p>{t(textKey)}</p></div>
              <MediaPlaceholder label={t('landing.featurePlaceholder')} unavailable={t('landing.mediaUnavailable')} />
              </article>;
            })}
          </div>)}
        </div>
      </section>

      <section id="faq" className="fg-faq fg-section fg-container">
        <SectionTitle eyebrow={t('landing.faqEyebrow')} title={t('landing.faqTitle')}>
          <p>{t('landing.faqDescription')}</p>
        </SectionTitle>
        <div className="fg-faq-list">
          {FAQS.map(([questionKey, answerKey], index) => <article key={questionKey} className={openFaq === index ? 'is-open' : ''} data-aos="fade-up" data-aos-delay={(index % 3) * 55}>
            <button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)} aria-expanded={openFaq === index}>
              <span>{t(questionKey)}</span><Plus size={20} />
            </button>
            <div className="fg-faq-answer"><p>{t(answerKey)}</p></div>
          </article>)}
        </div>
      </section>

      <section className="fg-final-cta" data-node-id="92:344">
        <img className="fg-final-glossy-mark" src="/landing/logo-mark-glossy.png" alt="" data-node-id="92:350" data-aos="zoom-in" />
        <div className="fg-final-copy" data-node-id="92:345" data-aos="fade-up">
          <p>{t('landing.finalCta')} <strong>{t('landing.finalCtaBrand')}</strong> {t('landing.finalCtaAfter')}</p>
          <GradientButton onClick={() => navigate('/auth')}>{t('landing.tryNow')}</GradientButton>
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
          <LogoLockup footer beta={t('landing.beta')} />
          <p>{t('landing.footerDescription')}</p>
        </div>
        <nav className="fg-footer-links" aria-label={t('landing.footerNavLabel')} data-aos="fade-left">
          <div><b>{t('landing.footerProduct')}</b><button type="button" onClick={() => goTo('cara-pakai')}>{t('landing.navHowTo')}</button><button type="button" onClick={() => goTo('fitur')}>{t('landing.navFeatures')}</button><button type="button" onClick={() => navigate('/pricing')}>{t('landing.footerPricing')}</button></div>
          <div><b>{t('landing.footerAccess')}</b><button type="button" onClick={() => navigate('/auth')}>{t('landing.footerWorkspace')}</button><button type="button" onClick={() => navigate('/auth')}>{t('landing.footerLogin')}</button><button type="button" onClick={() => goTo('faq')}>{t('landing.navFaq')}</button></div>
          <div><b>{t('landing.footerBrand')}</b><button type="button" onClick={() => navigate('/privacy')}>{t('landing.footerPrivacy')}</button><button type="button" onClick={() => navigate('/terms')}>{t('landing.footerTerms')}</button><button type="button" onClick={() => navigate('/status')}>{t('landing.footerStatus')}</button><span>{t('landing.footerVersion')}</span></div>
        </nav>
      </div>
    </footer>
  </div>;
}
