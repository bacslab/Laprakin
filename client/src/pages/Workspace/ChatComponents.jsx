import { Fragment, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CodeXml, Copy, FileText, History, LoaderCircle, Pencil, RefreshCw, Share2, Sparkles, ThumbsDown, ThumbsUp, X } from '../../icons';
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

export function AssistantMessageActions({ message, onRegenerate, onReaction, busy = false }) {
  const { t, language } = useI18n();
  const { setNotice } = useApp();
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
  const share = async () => {
    try {
      if (typeof navigator.share === 'function') await navigator.share({ title: 'Laprakin', text });
      else await navigator.clipboard.writeText(text);
      setNotice(t('workspace.messageActions.shareNotice'));
    } catch (error) {
      if (error?.name !== 'AbortError') setNotice(t('workspace.messageActions.shareFailed'));
    }
  };
  const rate = (value) => onReaction?.(message.id, value);
  return <footer className="message-actions" aria-label={t('workspace.messageActions.label')}>
    <button type="button" onClick={copy} aria-label={t('workspace.messageActions.copy')} title={t('workspace.messageActions.copy')}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>
    <button type="button" onClick={share} aria-label={t('workspace.messageActions.share')} title={t('workspace.messageActions.share')}><Share2 size={14} /></button>
    <button type="button" className={message.reaction === 'like' ? 'selected' : ''} onClick={() => rate('like')} aria-label={t('workspace.messageActions.helpful')} title={t('workspace.messageActions.helpfulTitle')}><ThumbsUp size={14} /></button>
    <button type="button" className={message.reaction === 'dislike' ? 'selected' : ''} onClick={() => rate('dislike')} aria-label={t('workspace.messageActions.needsImprovement')} title={t('workspace.messageActions.needsImprovementTitle')}><ThumbsDown size={14} /></button>
    {onRegenerate && <button type="button" onClick={onRegenerate} disabled={busy} aria-label={t('workspace.messageActions.regenerate')} title={t('workspace.messageActions.regenerate')}><RefreshCw size={14} /></button>}
    <time dateTime={message.created_at || message.createdAt}>{timestamp}</time>
  </footer>;
}

export function InlineUserMessageEditor({ message, onSubmit, onCancel, busy = false }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(String(message.content || ''));
  const editorRef = useRef(null);
  useEffect(() => {
    setDraft(String(message.content || ''));
    const frame = window.requestAnimationFrame(() => editorRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [message.id, message.content]);
  const submit = (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;
    onSubmit?.(message.id, content);
  };
  return <form className="message-inline-editor" onSubmit={submit}>
    <textarea
      ref={editorRef}
      aria-label={t('workspace.messageActions.editInput')}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); onCancel?.(); }
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
      }}
      disabled={busy}
      rows="3"
    />
    <div className="message-inline-editor-actions">
      <button type="button" onClick={onCancel} disabled={busy}>{t('workspace.messageActions.cancelEdit')}</button>
      <button type="submit" className="message-inline-editor-save" disabled={busy || !draft.trim()}>{t('workspace.messageActions.saveEdit')}</button>
    </div>
  </form>;
}

export function UserMessageActions({ message, onEdit, onOpenVersionPicker, busy = false }) {
  const { t, language } = useI18n();
  const { setNotice } = useApp();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(message.content || ''));
      setCopied(true);
      setNotice(t('workspace.messageActions.copyMessageNotice'));
      window.setTimeout(() => setCopied(false), 1400);
    } catch { setNotice(t('workspace.messageActions.copyMessageFailed')); }
  };
  const share = async () => {
    const text = String(message.content || '');
    try {
      if (typeof navigator.share === 'function') await navigator.share({ title: 'Laprakin', text });
      else await navigator.clipboard.writeText(text);
      setNotice(t('workspace.messageActions.shareMessageNotice'));
    } catch (error) {
      if (error?.name !== 'AbortError') setNotice(t('workspace.messageActions.shareMessageFailed'));
    }
  };
  const timestamp = new Date(message.created_at || message.createdAt || Date.now()).toLocaleTimeString(language === 'en' ? 'en-US' : 'id-ID', { hour: '2-digit', minute: '2-digit' });
  return <footer className="message-actions message-actions-user" aria-label={t('workspace.messageActions.userLabel')}>
    {message.revisionInfo && onOpenVersionPicker && <button type="button" onClick={() => onOpenVersionPicker(message)} disabled={busy} aria-label={t('workspace.messageActions.versionHistory')} title={t('workspace.messageActions.versionHistory')}><History size={14} /></button>}
    <button type="button" onClick={copy} disabled={busy} aria-label={t('workspace.messageActions.copyMessage')} title={t('workspace.messageActions.copyMessage')}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>
    <button type="button" onClick={share} disabled={busy} aria-label={t('workspace.messageActions.shareMessage')} title={t('workspace.messageActions.shareMessage')}><Share2 size={14} /></button>
    <button type="button" onClick={() => onEdit?.(message)} disabled={busy} aria-label={t('workspace.messageActions.edit')} title={t('workspace.messageActions.edit')}><Pencil size={14} /></button>
    <time dateTime={message.created_at || message.createdAt}>{timestamp}</time>
  </footer>;
}

export function VersionPickerModal({ group, onClose }) {
  const { t, language } = useI18n();
  const [selectedIndex, setSelectedIndex] = useState(group?.currentIndex || 0);
  useEffect(() => {
    setSelectedIndex(group?.currentIndex || 0);
  }, [group?.currentIndex, group?.total]);
  useEffect(() => {
    if (!group) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [group, onClose]);
  if (!group?.versions?.length) return null;
  const selected = group.versions[selectedIndex] || group.versions[group.currentIndex] || group.versions[0];
  const isCurrent = selectedIndex === group.currentIndex;
  const formatTime = (value) => new Date(value || Date.now()).toLocaleTimeString(language === 'en' ? 'en-US' : 'id-ID', { hour: '2-digit', minute: '2-digit' });
  return <div className="version-picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
    <section className="version-picker" role="dialog" aria-modal="true" aria-labelledby="version-picker-title">
      <header className="version-picker-head">
        <div className="version-picker-nav">
          <button type="button" onClick={() => setSelectedIndex((value) => Math.max(0, value - 1))} disabled={selectedIndex === 0} aria-label={t('workspace.messageActions.previousVersion')}><ArrowLeft size={16} /></button>
          <span id="version-picker-title">{isCurrent ? t('workspace.messageActions.currentVersion') : t('workspace.messageActions.versionOf', { current: selectedIndex + 1, total: group.total })}</span>
          <button type="button" onClick={() => setSelectedIndex((value) => Math.min(group.total - 1, value + 1))} disabled={selectedIndex === group.total - 1} aria-label={t('workspace.messageActions.nextVersion')}><ArrowRight size={16} /></button>
        </div>
        <button type="button" className="version-picker-close" onClick={onClose} aria-label={t('workspace.messageActions.closeVersionPicker')}><X size={17} /></button>
      </header>
      <div className="version-picker-body">
        <article className="version-picker-message user"><MessageContent content={selected.user.content} /><time>{formatTime(selected.user.created_at || selected.user.createdAt)}</time></article>
        {selected.assistant && <article className="version-picker-message assistant"><MessageContent content={selected.assistant.content} /><time>{formatTime(selected.assistant.created_at || selected.assistant.createdAt)}</time></article>}
      </div>
      <footer className="version-picker-foot">
        <span>{t('workspace.messageActions.versionOf', { current: selectedIndex + 1, total: group.total })}</span>
        <button type="button" className="version-picker-return" onClick={onClose}>{isCurrent ? t('workspace.messageActions.closeVersionPicker') : t('workspace.messageActions.returnCurrentVersion')}</button>
      </footer>
    </section>
  </div>;
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
