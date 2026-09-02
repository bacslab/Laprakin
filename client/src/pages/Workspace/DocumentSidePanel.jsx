import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, CircleAlert, LoaderCircle, MessageCircle, X } from 'lucide-react';
import { renderAsync as renderDocx } from 'docx-preview';
import { CustomSelect } from '../../components/CustomSelect';
import { IconButton } from '../../components/IconButton';
import { formatDate } from '../../lib/formatters';
import { WorkPlanRail } from './WorkspaceWorkflow';
import { useI18n } from '../../i18n/context';

function RenderedDocxPreview({ documentId, revision = 0 }) {
  const { t } = useI18n();
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
          throw new Error(error.error?.message || error.message || t('workspace.document.previewLoadError'));
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
        if (error.name !== 'AbortError' && active) setStatus(error.message || t('workspace.document.previewError'));
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
    {status === 'loading' && <div className="docx-preview-state"><LoaderCircle className="spin" size={17} />{t('workspace.document.loadingWord')}</div>}
    {status !== 'loading' && status !== 'ready' && <div className="docx-preview-state error"><CircleAlert size={17} />{status}</div>}
    <div className={`docx-render-root ${status === 'ready' ? 'is-ready' : 'is-loading'}`} ref={renderRef} />
  </section>;
}

export default function DocumentSidePanel({ documentState, activeJob, workflow, busy, user, onClose, onAction, onDownload, onRestoreVersion, onStartQuiz, onSubmitQuiz }) {
  const { t } = useI18n();
  const [selectedVersion, setSelectedVersion] = useState('');
  if (!documentState) return <div className="document-side-shell"><header><div><b>{t('workspace.document.title')}</b><small>{t('workspace.document.loadingResult')}</small></div><IconButton label={t('workspace.document.close')} onClick={onClose}><X size={17} /></IconButton></header><div className="document-side-loading"><LoaderCircle className="spin" size={18} />{t('workspace.document.loadingWork')}</div></div>;
  const exported = documentState.exports?.find((item) => item.status === 'ready' && item.content_signature === documentState.quizAccess?.contentSignature);
  const latestJob = activeJob || documentState.jobs?.[0] || null;
  const isGenerated = documentState.status === 'generated';
  const canDownload = Boolean(documentState.quizAccess?.canDownload ?? documentState.quizAccess?.passed);
  const versionOptions = [
    { value: '', label: `${t('workspace.document.currentVersion')}${documentState.revision_count ? ` · ${t('workspace.document.revision', { count: documentState.revision_count })}` : ''}` },
    ...(documentState.versions || []).map((version, index) => ({ value: version.id, label: `${version.label || t('workspace.document.versionFallback', { index: index + 1 })} · ${formatDate(version.created_at)}` })),
  ];
  const chooseVersion = async (versionId) => {
    setSelectedVersion(versionId);
    if (!versionId) return;
    const restored = await onRestoreVersion?.(versionId);
    if (restored) setSelectedVersion('');
  };
  return <div className="document-side-shell">
    <header className="document-side-head">
      <div><small>{t('workspace.document.reportLabel')}</small><b>{documentState.title}</b></div>
      <div className="document-side-actions">
        {isGenerated && <button type="button" disabled={busy} onClick={() => (canDownload ? onDownload() : onStartQuiz())}><ArrowDownToLine size={15} />{t('workspace.document.download')}</button>}
        <IconButton label={t('workspace.document.close')} onClick={onClose}><X size={17} /></IconButton>
      </div>
    </header>
    <div className="document-side-scroll">
      <div className="document-version-rail">
        <span><small>{t('workspace.document.versionLabel')}</small><b>{versionOptions.find((option) => option.value === selectedVersion)?.label || versionOptions[0].label}</b></span>
        <CustomSelect className="document-version-select" value={selectedVersion} onChange={chooseVersion} ariaLabel={t('workspace.document.chooseVersion')} options={versionOptions} />
      </div>
      {!isGenerated && <div className="document-recovery"><p>{t('workspace.document.recovery')}</p><WorkPlanRail workflow={workflow} job={latestJob} documentState={documentState} /></div>}
      {isGenerated && <>
        <RenderedDocxPreview documentId={documentState.id} revision={documentState.revision_count || 0} />
        <div className="revision-chat-note"><MessageCircle size={16} /><div><b>{t('workspace.document.revisionQuestion')}</b><p>{t('workspace.document.revisionDescription')}</p></div></div>
      </>}
    </div>
  </div>;
}
