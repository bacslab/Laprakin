import { useState } from 'react';
import { ArrowLeft, ArrowRight, X } from '../../icons';
import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';
import { useI18n } from '../../i18n/context';

export default function WorkspaceTutorial({ onClose }) {
  const { t } = useI18n();
  const steps = [
    { title: t('workspace.tutorial.steps.0.title'), description: t('workspace.tutorial.steps.0.description'), video: '/tutorial/alur-1.webm' },
    { title: t('workspace.tutorial.steps.1.title'), description: t('workspace.tutorial.steps.1.description'), video: '/tutorial/alur-2.webm' },
    { title: t('workspace.tutorial.steps.2.title'), description: t('workspace.tutorial.steps.2.description'), video: '/tutorial/alur-3.webm' },
    { title: t('workspace.tutorial.steps.3.title'), description: t('workspace.tutorial.steps.3.description'), video: '/tutorial/alur-4.webm' },
  ];
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  const progressLabel = t('workspace.tutorial.progressLabel', { current: stepIndex + 1, total: steps.length });
  return <div className="tutorial-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="workspace-tutorial" role="dialog" aria-modal="true" aria-labelledby="workspace-tutorial-title">
      <header><div><small>{t('workspace.tutorial.stepProgress', { current: stepIndex + 1, total: steps.length })}</small><h2 id="workspace-tutorial-title">{step.title}</h2><p>{step.description}</p></div><IconButton label={t('workspace.tutorial.close')} onClick={onClose}><X size={17} /></IconButton></header>
      <div className="tutorial-progress" aria-label={progressLabel}>{steps.map((item, index) => <span key={item.title} className={index <= stepIndex ? 'active' : ''} />)}</div>
      <div className="tutorial-video">
        <video key={step.video} src={step.video} autoPlay muted loop playsInline controls preload="metadata" aria-label={t('workspace.tutorial.videoLabel', { title: step.title })} />
      </div>
      <footer>
        <button type="button" className="tutorial-previous" onClick={() => setStepIndex((value) => Math.max(0, value - 1))} disabled={stepIndex === 0}><ArrowLeft size={15} />{t('workspace.tutorial.previous')}</button>
        <Button type="button" onClick={() => { if (isLastStep) onClose(); else setStepIndex((value) => value + 1); }}>{isLastStep ? t('workspace.tutorial.startChat') : t('workspace.tutorial.next')}{!isLastStep && <ArrowRight size={15} />}</Button>
      </footer>
    </section>
  </div>;
}
