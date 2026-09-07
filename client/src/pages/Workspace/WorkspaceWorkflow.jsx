import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronRight, LoaderCircle, Sparkles } from '../../icons';
import { Button } from '../../components/Button';
import { useI18n } from '../../i18n/context';

export function WorkflowPanel({ workflow, busy, onCreate }) {
  const { t } = useI18n();
  if (!workflow) return null;
  if (workflow.state === 'CLARIFICATION_REQUIRED') return null;
  if (workflow.state === 'ANALYZING_INPUT') return null;
  if (workflow.state !== 'READY_TO_GENERATE') return null;
  return <section className="work-plan-ready" aria-label={t('workspace.workflow.readyLabel')}>
    <WorkPlanRail workflow={workflow} />
    {!busy && <div className="work-plan-start"><span>{workflow.practiceTopic ? `${workflow.courseName} · ${workflow.practiceTopic}` : workflow.courseName}</span><Button onClick={onCreate}><Sparkles size={15} />{t('workspace.workflow.start')}</Button></div>}
  </section>;
}

export function ThinkingRail() {
  const { t } = useI18n();
  return <section className="work-plan-rail work-plan-pending" aria-live="polite"><div className="work-plan-toggle"><b>{t('workspace.workflow.thinking')}</b><LoaderCircle className="spin" size={14}/></div></section>;
}

export function WorkPlanRail({ workflow, job = null, documentState = null, plan: planOverride = null, completed = false, startedAt: startedAtOverride = '', finishedAt: finishedAtOverride = '' }) {
  const { t } = useI18n();
  const plan = planOverride || workflow?.workPlan || {};
  const steps = Array.isArray(plan.steps) && plan.steps.length ? plan.steps : (documentState || job ? [
    { id: 'read', title: t('workspace.workflow.defaultSteps.0.title'), detail: t('workspace.workflow.defaultSteps.0.detail') },
    { id: 'structure', title: t('workspace.workflow.defaultSteps.1.title'), detail: t('workspace.workflow.defaultSteps.1.detail') },
    { id: 'write', title: t('workspace.workflow.defaultSteps.2.title'), detail: t('workspace.workflow.defaultSteps.2.detail') },
    { id: 'layout', title: t('workspace.workflow.defaultSteps.3.title'), detail: t('workspace.workflow.defaultSteps.3.detail') },
    { id: 'finish', title: t('workspace.workflow.defaultSteps.4.title'), detail: t('workspace.workflow.defaultSteps.4.detail') },
  ] : []);
  const jobLive = ['queued', 'running', 'retry_queued'].includes(job?.status);
  const generated = completed || !jobLive && (documentState?.status === 'generated' || job?.status === 'completed' && job?.type === 'generate');
  const [expanded, setExpanded] = useState(!generated);
  useEffect(() => { if (generated) setExpanded(false); }, [generated]);
  if (!steps.length) return null;
  const failed = ['failed', 'canceled'].includes(job?.status) && generated;
  const progress = Math.max(0, Math.min(100, Number(job?.progress || 0)));
  const foundationCount = Math.min(2, steps.length);
  let completedCount = 1;
  if (generated) completedCount = steps.length;
  else if (job?.type === 'analyze') completedCount = job.status === 'completed' ? foundationCount : Math.min(1, steps.length - 1);
  else if (job?.type === 'generate') {
    const remaining = Math.max(1, steps.length - foundationCount);
    completedCount = Math.min(steps.length - 1, foundationCount + Math.floor((progress / 100) * remaining));
  } else if (documentState?.status === 'analyzed') completedCount = foundationCount;
  const visibleCount = completedCount >= steps.length ? steps.length : Math.min(steps.length, completedCount + 1);
  const visibleSteps = steps.slice(0, visibleCount);
  const startedAt = new Date(startedAtOverride || job?.startedAt || job?.createdAt || plan.generatedAt || Date.now()).getTime();
  const finishedAt = new Date(finishedAtOverride || job?.finishedAt || job?.updatedAt || (generated ? documentState?.updated_at : Date.now()) || Date.now()).getTime();
  const durationSeconds = Math.max(1, Math.round((finishedAt - startedAt) / 1000));
  const durationLabel = durationSeconds >= 60
    ? t('workspace.workflow.durationMinutes', { minutes: Math.floor(durationSeconds / 60), seconds: durationSeconds % 60 })
    : t('workspace.workflow.durationSeconds', { seconds: durationSeconds });
  return <section className={`work-plan-rail ${expanded ? 'is-expanded' : 'is-collapsed'}`} aria-live="polite">
    <button type="button" className="work-plan-toggle" onClick={() => setExpanded((value) => !value)}><b>{generated ? t('workspace.workflow.thinkingDuration', { duration: durationLabel }) : t('workspace.workflow.thinking')}</b>{expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button>
    {expanded && <ol>{visibleSteps.map((step, index) => {
      const done = index < completedCount;
      const current = index === completedCount && completedCount < steps.length;
      return <li key={step.id || `${step.title}-${index}`} className={`${done ? 'done' : ''} ${current ? 'current' : ''} ${current && failed ? 'failed' : ''}`}>
        <span>{done ? <Check size={12} /> : current && !failed ? <LoaderCircle className="spin" size={12} /> : index + 1}</span>
        <div><b>{step.title}</b><small>{current && job?.message ? job.message : step.detail}</small></div>
      </li>;
    })}</ol>}
    {expanded && failed && <p className="work-plan-error">{t('workspace.workflow.failed')}</p>}
  </section>;
}
