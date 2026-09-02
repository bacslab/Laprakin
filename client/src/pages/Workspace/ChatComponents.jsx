import { Fragment, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, CodeXml, Copy, FileText, LoaderCircle, Pencil, RefreshCw, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { Button } from '../../components/Button';
import { useI18n } from '../../i18n/context';
import { useApp } from '../../state/ui-context';

export function InlineMessageText({ text }) {
  return String(text || '').split(/(`[^`\n]+`)/g).map((part, index) => (
    part.startsWith('`') && part.endsWith('`')
      ? <code className="message-inline-code" key={`${part}-${index}`}>{part.slice(1, -1)}</code>
      : <Fragment key={`${part}-${index}`}>{part}</Fragment>
  ));
}

export function MessageContent({ content }) {
  const blocks = String(content || '').split(/(```[\s\S]*?```)/g).filter(Boolean);
  return <div className="message-content">{blocks.map((block, blockIndex) => {
    if (block.startsWith('```') && block.endsWith('```')) {
      const raw = block.slice(3, -3).replace(/^\n/, '');
      const firstBreak = raw.indexOf('\n');
      const possibleLanguage = firstBreak >= 0 ? raw.slice(0, firstBreak).trim() : '';
      const hasLanguage = /^[a-z0-9_+#.-]{1,24}$/i.test(possibleLanguage);
      const language = hasLanguage ? possibleLanguage : 'code';
      const code = (hasLanguage ? raw.slice(firstBreak + 1) : raw).replace(/\n$/, '');
      return <div className="message-code-block" key={`code-${blockIndex}`}>
        <div><CodeXml size={13}/><span>{language}</span></div>
        <pre><code>{code}</code></pre>
      </div>;
    }
    return block.split(/\n{2,}/).filter((paragraph) => paragraph.trim()).map((paragraph, paragraphIndex) => (
      <p key={`text-${blockIndex}-${paragraphIndex}`}><InlineMessageText text={paragraph.trim()} /></p>
    ));
  })}</div>;
}

export function AssistantMessageActions({ message, onRegenerate, busy = false }) {
  const { t, language } = useI18n();
  const { setNotice } = useApp();
  const [reaction, setReaction] = useState('');
  const [copied, setCopied] = useState(false);
  const text = String(message.content || '');
  const timestamp = new Date(message.created_at || message.createdAt || Date.now()).toLocaleTimeString(language === 'en' ? 'en-US' : 'id-ID', { hour: '2-digit', minute: '2-digit' });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setNotice(t('workspace.messageActions.copyNotice'));
      window.setTimeout(() => setCopied(false), 1400);
    } catch { setNotice(t('workspace.messageActions.copyFailed')); }
  };
  const rate = (value) => {
    setReaction((current) => current === value ? '' : value);
    setNotice(value === 'up' ? t('workspace.messageActions.positiveSaved') : t('workspace.messageActions.improvementSaved'));
  };
  return <footer className="message-actions" aria-label={t('workspace.messageActions.label')}>
    <button type="button" onClick={copy} aria-label={t('workspace.messageActions.copy')} title={t('workspace.messageActions.copy')}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>
    <button type="button" className={reaction === 'up' ? 'selected' : ''} onClick={() => rate('up')} aria-label={t('workspace.messageActions.helpful')} title={t('workspace.messageActions.helpfulTitle')}><ThumbsUp size={14} /></button>
    <button type="button" className={reaction === 'down' ? 'selected' : ''} onClick={() => rate('down')} aria-label={t('workspace.messageActions.needsImprovement')} title={t('workspace.messageActions.needsImprovementTitle')}><ThumbsDown size={14} /></button>
    {onRegenerate && <button type="button" onClick={onRegenerate} disabled={busy} aria-label={t('workspace.messageActions.regenerate')} title={t('workspace.messageActions.regenerate')}><RefreshCw size={14} /></button>}
    <time dateTime={message.created_at || message.createdAt}>{timestamp}</time>
  </footer>;
}

export function UserMessageActions({ message, onEdit, busy = false }) {
  const { t } = useI18n();
  return <footer className="message-actions message-actions-user" aria-label={t('workspace.messageActions.userLabel')}>
    <button type="button" onClick={() => onEdit?.(message)} disabled={busy} aria-label={t('workspace.messageActions.edit')} title={t('workspace.messageActions.edit')}><Pencil size={14} />{t('workspace.messageActions.edit')}</button>
  </footer>;
}

export function ChatBriefPanel({ config, updateConfig, workflow, busy, onSubmit }) {
  const { t } = useI18n();
  const missing = workflow?.missingCriticalContext || '';
  const courseName = config.configuration.courseName || workflow?.courseName || '';
  const moduleTitle = config.configuration.moduleTitle || workflow?.practiceTopic || '';
  const needsCourse = ['course_name', 'course_and_topic'].includes(missing) || !courseName;
  const needsModule = ['practice_topic', 'course_and_topic', 'document_type_and_topic'].includes(missing) || !moduleTitle;
  const ready = (!needsCourse || courseName.trim()) && (!needsModule || moduleTitle.trim());
  const firstInputRef = useRef(null);
  useEffect(() => { firstInputRef.current?.focus(); }, [missing]);
  return <form className="chat-brief-panel" onSubmit={(event) => {
    event.preventDefault();
    if (!ready) return;
    onSubmit?.({
      courseName: courseName.trim(),
      practiceTopic: moduleTitle.trim(),
    });
  }}>
    <div><small>{t('workspace.brief.eyebrow')}</small><b>{needsCourse && needsModule ? t('workspace.brief.courseAndMaterial') : needsCourse ? t('workspace.brief.course') : t('workspace.brief.material')}</b></div>
     {needsCourse && <label>{t('workspace.brief.courseLabel')}<input ref={firstInputRef} aria-label={t('workspace.brief.courseAria')} value={courseName} onChange={(event) => updateConfig({ configuration: { courseName: event.target.value } })} placeholder={t('workspace.brief.coursePlaceholder')} /></label>}
     {needsModule && <label>{t('workspace.brief.materialLabel')}<input ref={!needsCourse ? firstInputRef : undefined} aria-label={t('workspace.brief.materialAria')} value={moduleTitle} onChange={(event) => updateConfig({ configuration: { moduleTitle: event.target.value } })} placeholder={t('workspace.brief.materialPlaceholder')} /></label>}
    <Button type="submit" disabled={busy || !ready}>{busy ? <LoaderCircle className="spin" size={14} /> : <ArrowRight size={14} />}{t('workspace.brief.continue')}</Button>
  </form>;
}

export function InlineContext({ config, updateConfig, onClose }) {
  const { t } = useI18n();
  return <form className="inline-context" onSubmit={(event) => { event.preventDefault(); onClose(); }}><div className="context-title"><div><b>{t('workspace.context.title')}</b><p>{t('workspace.context.description')}</p></div><button type="button" onClick={onClose} aria-label={t('workspace.context.close')}><X size={14} /></button></div><div className="context-fields"><label>{t('workspace.context.course')}<input aria-label={t('workspace.context.course')} value={config.configuration.courseName} onChange={(event) => updateConfig({ configuration: { courseName: event.target.value } })} placeholder={t('workspace.context.coursePlaceholder')} /></label><label>{t('workspace.context.material')} <small>{t('workspace.context.optional')}</small><input aria-label={t('workspace.context.material')} value={config.configuration.moduleTitle} onChange={(event) => updateConfig({ configuration: { moduleTitle: event.target.value } })} placeholder={t('workspace.context.materialPlaceholder')} /></label><Button type="submit" variant="secondary">{t('workspace.context.save')}</Button></div></form>;
}

export function DocumentQuiz({ access, busy, onStart, onSubmit }) {
  const { t } = useI18n();
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [result, setResult] = useState(null);
  const begin = async () => {
    const next = await onStart();
    if (!next) return;
    setAttempt(next);
    setAnswers({});
    setQuestionIndex(0);
    setResult(null);
  };
  const finish = async () => {
    const payload = attempt.questions.map((question) => ({ questionId: question.id, selectedIndex: answers[question.id] }));
    const next = await onSubmit(attempt.attemptId, payload);
    if (next) setResult(next);
  };
  if (access?.passed && !attempt) {
    return <section className="quiz-gate quiz-passed"><span><CheckCircle2 size={18} /></span><div><small>{t('workspace.quiz.finished')}</small><b>{t('workspace.quiz.downloadOpen')}</b><p>{t('workspace.quiz.score', { score: access.latestScore ?? 0 })}</p></div></section>;
  }
  if (!attempt) {
    return <section className="quiz-gate">
      <div><small>{t('workspace.quiz.preQuiz')}</small><h3>{access?.attemptCount ? t('workspace.quiz.lastScore', { score: access.latestScore ?? 0 }) : t('workspace.quiz.questionCount', { count: 5 })}</h3>{access?.attemptCount ? <p>{t('workspace.quiz.minimum', { score: access.passScore })}</p> : null}</div>
      <Button onClick={begin} disabled={busy}><Sparkles size={14} />{access?.attemptCount ? t('workspace.quiz.tryAgain') : t('workspace.quiz.start')}</Button>
    </section>;
  }
  if (result) {
    return <section className={`quiz-result ${result.passed ? 'passed' : 'failed'}`}>
      <div className="quiz-result-score"><span>{result.score}</span><small>/ 100</small></div>
      <div><small>{result.passed ? t('workspace.quiz.passed') : t('workspace.quiz.notPassed')}</small><h3>{result.passed ? t('workspace.quiz.downloadOpen') : t('workspace.quiz.minimum', { score: result.passScore })}</h3></div>
      {!result.passed && <Button onClick={begin} disabled={busy}><RefreshCw size={14} />{t('workspace.quiz.newQuestions')}</Button>}
    </section>;
  }
  const question = attempt.questions[questionIndex];
  const selected = answers[question.id];
  const isLast = questionIndex === attempt.questions.length - 1;
  return <section className="quiz-player">
    <header><span>{t('workspace.quiz.question')}</span><b>{questionIndex + 1} / {attempt.questions.length}</b><div><i style={{ width: `${((questionIndex + 1) / attempt.questions.length) * 100}%` }} /></div></header>
    <article className="quiz-question-card"><small>{question.sectionTitle}</small><h3>{question.question}</h3></article>
    {/* Tanpa kelas warna per-opsi: empat warna keras yang berbeda membuat
    pilihan terlihat seperti kuis permainan dan tidak mengikuti tema. */}
    <div className="quiz-options">{question.options.map((option, index) => <button type="button" key={`${question.id}-${index}`} className={`quiz-option ${selected === index ? 'selected' : ''}`} onClick={() => setAnswers((value) => ({ ...value, [question.id]: index }))}><span>{String.fromCharCode(65 + index)}</span><b>{option}</b></button>)}</div>
    <footer><button type="button" disabled={questionIndex === 0} onClick={() => setQuestionIndex((value) => value - 1)}>{t('workspace.quiz.previous')}</button><Button disabled={selected === undefined || busy} onClick={() => isLast ? finish() : setQuestionIndex((value) => value + 1)}>{isLast ? t('workspace.quiz.finished') : t('workspace.quiz.next')}<ArrowRight size={14} /></Button></footer>
  </section>;
}

export function DocumentCard({ documentState, activeJob, version = null, onOpen }) {
  const { t } = useI18n();
  if (!documentState) return <div className="document-card loading-doc"><LoaderCircle className="spin" size={15} />{t('workspace.documentCard.loading')}</div>;
  const isGenerated = documentState.status === 'generated';
  const latestJob = activeJob || documentState.jobs?.[0] || null;
  const liveJob = ['queued', 'running', 'retry_queued'].includes(latestJob?.status);
  return <article className={`document-card document-slim-card ${isGenerated ? 'document-is-ready' : 'document-is-processing'}`}>
    <span className="document-card-icon"><FileText size={20} /></span>
    <div className="document-card-copy"><b>{documentState.title}</b><small>{isGenerated ? t('workspace.documentCard.wordVersion', { version: Number(version || Number(documentState.revision_count || 0) + 1) }) : liveJob ? latestJob.message || t('workspace.documentCard.preparing') : t('workspace.documentCard.nextStage')}</small></div>
    <button type="button" className="document-open-button" onClick={onOpen}>{isGenerated ? t('workspace.documentCard.open') : t('workspace.documentCard.viewProcess')}</button>
  </article>;
}
