import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronRight, LoaderCircle, Sparkles } from 'lucide-react';
import { Button } from '../../components/Button';

export function WorkflowPanel({ workflow, busy, onCreate }) {
  if (!workflow) return null;
  if (workflow.state === 'CLARIFICATION_REQUIRED') return null;
  if (workflow.state === 'ANALYZING_INPUT') return null;
  if (workflow.state !== 'READY_TO_GENERATE') return null;
  return <section className="work-plan-ready" aria-label="Alur kerja Laprak">
    <WorkPlanRail workflow={workflow} />
    {!busy && <div className="work-plan-start"><span>{workflow.practiceTopic ? `${workflow.courseName} · ${workflow.practiceTopic}` : workflow.courseName}</span><Button onClick={onCreate}><Sparkles size={15} />Mulai susun</Button></div>}
  </section>;
}

export function ThinkingRail() {
  return <section className="work-plan-rail work-plan-pending" aria-live="polite"><div className="work-plan-toggle"><b>Sedang berpikir</b><LoaderCircle className="spin" size={14}/></div></section>;
}

export function WorkPlanRail({ workflow, job = null, documentState = null, plan: planOverride = null, completed = false, startedAt: startedAtOverride = '', finishedAt: finishedAtOverride = '' }) {
  const plan = planOverride || workflow?.workPlan || {};
  const steps = Array.isArray(plan.steps) && plan.steps.length ? plan.steps : (documentState || job ? [
    { id: 'read', title: 'Membaca seluruh bahan', detail: 'Mengambil struktur, instruksi, data, dan bukti yang tersedia.' },
    { id: 'structure', title: 'Mempelajari susunan dokumen', detail: 'Mengikuti urutan bagian dan gaya dari template yang dipakai.' },
    { id: 'write', title: 'Menyusun isi laprak', detail: 'Menghubungkan langkah, bukti, hasil, dan pembahasan.' },
    { id: 'layout', title: 'Menata dokumen Word', detail: 'Memeriksa judul, paragraf, gambar, caption, dan pergantian halaman.' },
    { id: 'finish', title: 'Menyiapkan hasil akhir', detail: 'Menyimpan dokumen agar siap dibuka dan diperiksa.' },
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
    ? `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}dtk`
    : `${durationSeconds}dtk`;
  return <section className={`work-plan-rail ${expanded ? 'is-expanded' : 'is-collapsed'}`} aria-live="polite">
    <button type="button" className="work-plan-toggle" onClick={() => setExpanded((value) => !value)}><b>{generated ? `Berpikir selama ${durationLabel}` : 'Sedang berpikir'}</b>{expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button>
    {expanded && <ol>{visibleSteps.map((step, index) => {
      const done = index < completedCount;
      const current = index === completedCount && completedCount < steps.length;
      return <li key={step.id || `${step.title}-${index}`} className={`${done ? 'done' : ''} ${current ? 'current' : ''} ${current && failed ? 'failed' : ''}`}>
        <span>{done ? <Check size={12} /> : current && !failed ? <LoaderCircle className="spin" size={12} /> : index + 1}</span>
        <div><b>{step.title}</b><small>{current && job?.message ? job.message : step.detail}</small></div>
      </li>;
    })}</ol>}
    {expanded && failed && <p className="work-plan-error">Dokumen tetap tersimpan dan sedang disiapkan kembali.</p>}
  </section>;
}
