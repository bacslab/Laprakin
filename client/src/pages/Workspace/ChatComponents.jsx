import { Fragment, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, ChevronDown, CircleAlert, CodeXml, Copy, Eye, FileText, LoaderCircle, Pencil, RefreshCw, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { Button } from '../../components/Button';
import { useApp } from '../../state/ui-context';
import { departments, programs } from '../../data';

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
  const { setNotice } = useApp();
  const [reaction, setReaction] = useState('');
  const [copied, setCopied] = useState(false);
  const text = String(message.content || '');
  const timestamp = new Date(message.created_at || message.createdAt || Date.now()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setNotice('Jawaban AI disalin.');
      window.setTimeout(() => setCopied(false), 1400);
    } catch { setNotice('Jawaban AI belum dapat disalin.'); }
  };
  const rate = (value) => {
    setReaction((current) => current === value ? '' : value);
    setNotice(value === 'up' ? 'Masukan positif tersimpan.' : 'Masukan perbaikan tersimpan.');
  };
  return <footer className="message-actions" aria-label="Aksi jawaban AI">
    <button type="button" onClick={copy} aria-label="Salin jawaban" title="Salin jawaban">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
    <button type="button" className={reaction === 'up' ? 'selected' : ''} onClick={() => rate('up')} aria-label="Jawaban membantu" title="Membantu"><ThumbsUp size={14} /></button>
    <button type="button" className={reaction === 'down' ? 'selected' : ''} onClick={() => rate('down')} aria-label="Jawaban perlu diperbaiki" title="Perlu diperbaiki"><ThumbsDown size={14} /></button>
    {onRegenerate && <button type="button" onClick={onRegenerate} disabled={busy} aria-label="Buat ulang jawaban" title="Buat ulang jawaban"><RefreshCw size={14} /></button>}
    <time dateTime={message.created_at || message.createdAt}>{timestamp}</time>
  </footer>;
}

export function UserMessageActions({ message, onEdit, busy = false }) {
  return <footer className="message-actions message-actions-user" aria-label="Aksi pesanmu">
    <button type="button" onClick={() => onEdit?.(message)} disabled={busy} aria-label="Ubah pesan" title="Ubah pesan"><Pencil size={14} />Ubah pesan</button>
  </footer>;
}

export function ChatBriefPanel({ config, updateConfig, workflow, busy, onSubmit }) {
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
    <div><small>Lengkapi konteks</small><b>{needsCourse && needsModule ? 'Mata kuliah dan materi' : needsCourse ? 'Mata kuliah' : 'Materi praktikum'}</b></div>
     {needsCourse && <label>Mata kuliah<input ref={firstInputRef} aria-label="Mata kuliah" value={courseName} onChange={(event) => updateConfig({ configuration: { courseName: event.target.value } })} placeholder="Contoh: Administrasi Jaringan Komputer" /></label>}
     {needsModule && <label>Materi / modul<input ref={!needsCourse ? firstInputRef : undefined} aria-label="Materi atau modul" value={moduleTitle} onChange={(event) => updateConfig({ configuration: { moduleTitle: event.target.value } })} placeholder="Contoh: Dynamic Host Configuration Protocol" /></label>}
    <Button type="submit" disabled={busy || !ready}>{busy ? <LoaderCircle className="spin" size={14} /> : <ArrowRight size={14} />}Lanjutkan</Button>
  </form>;
}

export function InlineContext({ config, updateConfig, onClose }) {
  return <form className="inline-context" onSubmit={(event) => { event.preventDefault(); onClose(); }}><div className="context-title"><div><b>Konteks laprak</b><p>Isi seperlunya agar bahan lebih mudah dibaca.</p></div><button type="button" onClick={onClose} aria-label="Tutup form konteks"><X size={14} /></button></div><div className="context-fields"><label>Mata kuliah<input aria-label="Mata kuliah" value={config.configuration.courseName} onChange={(event) => updateConfig({ configuration: { courseName: event.target.value } })} placeholder="Jaringan Komputer" /></label><label>Judul materi <small>Opsional</small><input aria-label="Judul materi" value={config.configuration.moduleTitle} onChange={(event) => updateConfig({ configuration: { moduleTitle: event.target.value } })} placeholder="Routing Protocol" /></label><Button type="submit" variant="secondary">Simpan</Button></div></form>;
}

export function ReportPreview({ documentState, user, embedded = false }) {
  const [open, setOpen] = useState(true);
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => setLogoFailed(false), [user.institutionLogoUrl]);
  const studyProgram = programs.find((item) => item.key === user.studyProgramKey)?.label || 'Program studi';
  const department = departments.find((item) => item.key === user.departmentKey)?.label || 'Jurusan / fakultas';
  const mappingsBySection = (documentState.mappings || []).reduce((result, mapping, index) => {
    const candidates = (documentState.sections || []).filter((section) => section.section_type === mapping.section_type);
    const target = candidates.length ? candidates[Math.max(0, Number(mapping.step_number || mapping.display_order || index + 1) - 1) % candidates.length] : null;
    if (target) (result[target.id] ||= []).push(mapping);
    return result;
  }, {});
  return <section className={`report-preview ${open || embedded ? 'is-open' : ''} ${embedded ? 'is-embedded' : ''}`}>
    {!embedded && <button type="button" className="report-preview-toggle" onClick={() => setOpen((value) => !value)}><span><Eye size={15} /><b>Preview laporan</b><small>Versi yang akan dipakai untuk quiz dan export</small></span><ChevronDown size={16} /></button>}
    {(open || embedded) && <div className="report-paper-stack">
      <article className="report-paper report-cover">
        <p className="report-cover-kicker">LAPORAN PRAKTIKUM</p>
        <h2>{documentState.course_name || 'MATA KULIAH'}</h2>
        <h3>{documentState.module_title || documentState.title}</h3>
        {user.institutionLogoUrl && !logoFailed && <img className="report-cover-logo" src={user.institutionLogoUrl} alt={`Logo ${user.institutionName || 'institusi'}`} onError={() => setLogoFailed(true)} />}
        <div className="report-cover-lecturer"><small>Dosen Pengampu:</small><b>{documentState.lecturer_name || '-'}</b><span>NIP : -</span></div>
        <div className="report-cover-identity"><small>Disusun Oleh:</small><b>{user.fullName || 'Nama mahasiswa'} ({user.nim || 'NPM / NIM'})</b><span>{user.className || 'Kelas'}</span></div>
        <div className="report-cover-institution"><b>PROGRAM STUDI {studyProgram.toUpperCase()}</b><span>{department.toUpperCase()}</span><span>POLITEKNIK NEGERI CILACAP</span><span>TAHUN AKADEMIK {documentState.academic_year || '2025/2026'}</span></div>
      </article>
      <article className="report-paper report-body-preview">
        <h2>Langkah Latihan Soal Praktikum</h2>
        {(documentState.sections || []).map((section) => <section key={section.id}>
          <h3>{section.title}</h3>
          {String(section.content || '').split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={`${section.id}-${index}`}>{paragraph}</p>)}
          {(mappingsBySection[section.id] || []).map((mapping, index) => <figure key={mapping.id}>
            <img src={`/api/files/${mapping.file_id}/preview`} alt={mapping.caption || mapping.original_name || `Bukti ${index + 1}`} />
            <figcaption>{mapping.caption || `Gambar ${index + 1}. ${mapping.original_name || 'Bukti praktikum'}`}</figcaption>
          </figure>)}
        </section>)}
      </article>
    </div>}
  </section>;
}

export function DocumentQuiz({ access, busy, onStart, onSubmit }) {
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
    return <section className="quiz-gate quiz-passed"><span><CheckCircle2 size={18} /></span><div><small>Selesai</small><b>Download terbuka</b><p>Nilai {access.latestScore ?? 0}%</p></div></section>;
  }
  if (!attempt) {
    return <section className="quiz-gate">
      <div><small>Pre-quiz</small><h3>{access?.attemptCount ? `Nilai terakhir ${access.latestScore ?? 0}%` : '5 soal singkat'}</h3>{access?.attemptCount ? <p>Minimal {access.passScore}%</p> : null}</div>
      <Button onClick={begin} disabled={busy}><Sparkles size={14} />{access?.attemptCount ? 'Coba lagi' : 'Mulai quiz'}</Button>
    </section>;
  }
  if (result) {
    return <section className={`quiz-result ${result.passed ? 'passed' : 'failed'}`}>
      <div className="quiz-result-score"><span>{result.score}</span><small>/ 100</small></div>
      <div><small>{result.passed ? 'Lulus' : 'Belum lulus'}</small><h3>{result.passed ? 'Download terbuka' : `Minimal ${result.passScore}%`}</h3></div>
      {!result.passed && <Button onClick={begin} disabled={busy}><RefreshCw size={14} />Soal baru</Button>}
    </section>;
  }
  const question = attempt.questions[questionIndex];
  const selected = answers[question.id];
  const isLast = questionIndex === attempt.questions.length - 1;
  return <section className="quiz-player">
    <header><span>Soal</span><b>{questionIndex + 1} / {attempt.questions.length}</b><div><i style={{ width: `${((questionIndex + 1) / attempt.questions.length) * 100}%` }} /></div></header>
    <article className="quiz-question-card"><small>{question.sectionTitle}</small><h3>{question.question}</h3></article>
    {/* Tanpa kelas warna per-opsi: empat warna keras yang berbeda membuat
    pilihan terlihat seperti kuis permainan dan tidak mengikuti tema. */}
    <div className="quiz-options">{question.options.map((option, index) => <button type="button" key={`${question.id}-${index}`} className={`quiz-option ${selected === index ? 'selected' : ''}`} onClick={() => setAnswers((value) => ({ ...value, [question.id]: index }))}><span>{String.fromCharCode(65 + index)}</span><b>{option}</b></button>)}</div>
    <footer><button type="button" disabled={questionIndex === 0} onClick={() => setQuestionIndex((value) => value - 1)}>Sebelumnya</button><Button disabled={selected === undefined || busy} onClick={() => isLast ? finish() : setQuestionIndex((value) => value + 1)}>{isLast ? 'Selesai' : 'Lanjut'}<ArrowRight size={14} /></Button></footer>
  </section>;
}

export function DocumentCard({ documentState, activeJob, version = null, onOpen }) {
  if (!documentState) return <div className="document-card loading-doc"><LoaderCircle className="spin" size={15} />Memuat dokumen kerja...</div>;
  const isGenerated = documentState.status === 'generated';
  const latestJob = activeJob || documentState.jobs?.[0] || null;
  const liveJob = ['queued', 'running', 'retry_queued'].includes(latestJob?.status);
  return <article className={`document-card document-slim-card ${isGenerated ? 'document-is-ready' : 'document-is-processing'}`}>
    <span className="document-card-icon"><FileText size={20} /></span>
    <div className="document-card-copy"><b>{documentState.title}</b><small>{isGenerated ? `Dokumen Word · Versi ${Number(version || Number(documentState.revision_count || 0) + 1)}` : liveJob ? latestJob.message || 'Sedang menyiapkan dokumen' : 'Menyiapkan tahap berikutnya secara otomatis'}</small></div>
    <button type="button" className="document-open-button" onClick={onOpen}>{isGenerated ? 'Buka' : 'Lihat proses'}</button>
  </article>;
}
