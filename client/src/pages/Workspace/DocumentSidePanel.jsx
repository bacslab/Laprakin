import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, CircleAlert, LoaderCircle, MessageCircle, X } from 'lucide-react';
import { renderAsync as renderDocx } from 'docx-preview';
import { CustomSelect } from '../../components/CustomSelect';
import { IconButton } from '../../components/IconButton';
import { formatDate } from '../../lib/formatters';
import { WorkPlanRail } from './WorkspaceWorkflow';

function RenderedDocxPreview({ documentId, revision = 0 }) {
  const hostRef = useRef(null);
  const renderRef = useRef(null);
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const render = async () => {
      setStatus('loading');
      try {
        const response = await fetch(`/api/documents/${documentId}/preview.docx?v=${revision}`, {
          credentials: 'same-origin',
          signal: controller.signal,
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error?.message || error.message || 'Preview dokumen belum dapat dimuat.');
        }
        const blob = await response.blob();
        if (!active || !renderRef.current) return;
        renderRef.current.replaceChildren();
        await renderDocx(blob, renderRef.current, undefined, {
          className: 'laprakin-docx',
          inWrapper: true,
          breakPages: true,
          ignoreWidth: false,
          ignoreHeight: false,
          experimental: true,
        });
        if (active) setStatus('ready');
      } catch (error) {
        if (error.name !== 'AbortError' && active) setStatus(error.message || 'Preview gagal dimuat.');
      }
    };
    render();
    return () => { active = false; controller.abort(); };
  }, [documentId, revision]);
  useEffect(() => {
    if (!hostRef.current || !renderRef.current) return undefined;
    const resize = () => {
      const available = Math.max(280, hostRef.current.clientWidth - 8);
      renderRef.current.style.zoom = String(Math.min(1, available / 816));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, [status]);
  return <section className="docx-preview-host" ref={hostRef}>
    {status === 'loading' && <div className="docx-preview-state"><LoaderCircle className="spin" size={17} />Memuat dokumen Word asli...</div>}
    {status !== 'loading' && status !== 'ready' && <div className="docx-preview-state error"><CircleAlert size={17} />{status}</div>}
    <div className={`docx-render-root ${status === 'ready' ? 'is-ready' : 'is-loading'}`} ref={renderRef} />
  </section>;
}

export default function DocumentSidePanel({ documentState, activeJob, workflow, busy, user, onClose, onAction, onDownload, onRestoreVersion, onStartQuiz, onSubmitQuiz }) {
  const [selectedVersion, setSelectedVersion] = useState('');
  if (!documentState) return <div className="document-side-shell"><header><div><b>Dokumen</b><small>Memuat hasil laprak</small></div><IconButton label="Tutup dokumen" onClick={onClose}><X size={17} /></IconButton></header><div className="document-side-loading"><LoaderCircle className="spin" size={18} />Memuat dokumen kerja...</div></div>;
  const exported = documentState.exports?.find((item) => item.status === 'ready' && item.content_signature === documentState.quizAccess?.contentSignature);
  const latestJob = activeJob || documentState.jobs?.[0] || null;
  const isGenerated = documentState.status === 'generated';
  const canDownload = Boolean(documentState.quizAccess?.canDownload ?? documentState.quizAccess?.passed);
  const versionOptions = [
    { value: '', label: `Versi saat ini${documentState.revision_count ? ` · Revisi ${documentState.revision_count}` : ''}` },
    ...(documentState.versions || []).map((version, index) => ({ value: version.id, label: `${version.label || `Versi ${index + 1}`} · ${formatDate(version.created_at)}` })),
  ];
  const chooseVersion = async (versionId) => {
    setSelectedVersion(versionId);
    if (!versionId) return;
    const restored = await onRestoreVersion?.(versionId);
    if (restored) setSelectedVersion('');
  };
  return <div className="document-side-shell">
    <header className="document-side-head">
      <div><small>Dokumen laprak</small><b>{documentState.title}</b></div>
      <div className="document-side-actions">
        {isGenerated && <button type="button" disabled={busy} onClick={() => (canDownload ? onDownload() : onStartQuiz())}><ArrowDownToLine size={15} />Unduh</button>}
        <IconButton label="Tutup dokumen" onClick={onClose}><X size={17} /></IconButton>
      </div>
    </header>
    <div className="document-side-scroll">
      <div className="document-version-rail">
        <span><small>Versi dokumen</small><b>{versionOptions.find((option) => option.value === selectedVersion)?.label || versionOptions[0].label}</b></span>
        <CustomSelect className="document-version-select" value={selectedVersion} onChange={chooseVersion} ariaLabel="Pilih versi dokumen" options={versionOptions} />
      </div>
      {!isGenerated && <div className="document-recovery"><p>Laprakin sedang menyiapkan dokumen ini secara otomatis. Kamu boleh menutup panel atau berpindah chat; proses akan tetap berjalan.</p><WorkPlanRail workflow={workflow} job={latestJob} documentState={documentState} /></div>}
      {isGenerated && <>
        <RenderedDocxPreview documentId={documentState.id} revision={documentState.revision_count || 0} />
        <div className="revision-chat-note"><MessageCircle size={16} /><div><b>Sudah lengkap atau perlu revisi?</b><p>Tulis perubahan di chat utama. Bagian lain akan tetap dipertahankan.</p></div></div>
      </>}
    </div>
  </div>;
}
