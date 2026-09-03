import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { useI18n } from '../../../i18n/context';

const AdminAiContext = createContext(null);

export function AdminAiProvider({ value, children }) {
  return <AdminAiContext.Provider value={value}>{children}</AdminAiContext.Provider>;
}

export function useAdminAi() {
  const value = useContext(AdminAiContext);
  if (!value) throw new Error('Admin AI context is unavailable.');
  return value;
}

export function useAdminAiCopy() {
  const { t } = useI18n();
  return useCallback((key, values) => t(`admin.ai.${key}`, values), [t]);
}

export function useAdminResource(loader) {
  const [state, setState] = useState({ data: null, loading: true, error: '', lastUpdated: null });
  const mounted = useRef(true);
  const retry = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await loader();
      if (mounted.current) setState({ data, loading: false, error: '', lastUpdated: new Date() });
    } catch (error) {
      if (mounted.current) setState((current) => ({ ...current, loading: false, error: error.message || 'Request failed.' }));
    }
  }, [loader]);
  useEffect(() => {
    mounted.current = true;
    retry();
    return () => { mounted.current = false; };
  }, [retry]);
  return { ...state, retry };
}

export function AdminResource({ resource, children, empty, label = 'data' }) {
  const t = useAdminAiCopy();
  if (resource.loading && !resource.data) return <div className="admin-ai-resource-state" role="status"><LoaderCircle className="spin" size={18} /><span>{t('common.loading', { label })}</span></div>;
  if (resource.error && !resource.data) return <div className="admin-ai-resource-state is-error" role="alert"><AlertCircle size={18} /><b>{t('common.loadFailed')}</b><span>{resource.error}</span><button type="button" onClick={resource.retry}><RefreshCw size={14} /> {t('common.retry')}</button></div>;
  if (!resource.data) return empty || null;
  return <>{resource.error && <div className="admin-ai-inline-error" role="alert"><AlertCircle size={14} /><span>{resource.error}</span><button type="button" onClick={resource.retry}>{t('common.retry')}</button></div>}{children(resource.data)}</>;
}

export function ResourceMeta({ resource }) {
  const t = useAdminAiCopy();
  return <div className="admin-ai-resource-meta" role="status" aria-live="polite">
    <Clock3 size={13} />
    <span>{resource.lastUpdated ? t('common.updatedAt', { time: resource.lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }) : t('common.neverUpdated')}</span>
    <button type="button" onClick={resource.retry} disabled={resource.loading} aria-label={t('common.reload')}><RefreshCw className={resource.loading ? 'spin' : ''} size={13} /></button>
  </div>;
}

export function StatusPill({ value = 'unknown' }) {
  const normalized = String(value || 'unknown').toLowerCase();
  return <span className={`admin-ai-status is-${normalized.replace(/[^a-z0-9-]/g, '-')}`}>{value || 'unknown'}</span>;
}

export function EmptyState({ title, description }) {
  return <div className="admin-ai-empty"><CheckCircle2 size={20} /><b>{title}</b><span>{description}</span></div>;
}

export function PageIntro({ eyebrow = 'AI control plane', title, description, actions, resource }) {
  return <header className="admin-ai-page-intro"><div><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div><div className="admin-ai-page-actions">{resource && <ResourceMeta resource={resource} />}{actions}</div></header>;
}

export function ConfirmationDialog({ open, title, description, expected, confirmLabel, busy, extra = null, onCancel, onConfirm }) {
  const t = useAdminAiCopy();
  const titleId = useId();
  const descriptionId = useId();
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    setReason('');
    setConfirmation('');
    setError('');
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);
  if (!open) return null;
  const submit = async (event) => {
    event.preventDefault();
    if (reason.trim().length < 8 || confirmation.trim() !== expected) return;
    setError('');
    try { await onConfirm({ reason: reason.trim(), confirmation: confirmation.trim() }); }
    catch (nextError) { setError(nextError.message || t('common.actionFailed')); }
  };
  return <div className="admin-ai-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}>
    <section className="admin-ai-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <button className="admin-ai-dialog-close" type="button" onClick={onCancel} disabled={busy} aria-label={t('common.closeDialog')}><X size={17} /></button>
      <div><p>{t('common.confirmation')}</p><h2 id={titleId}>{title}</h2><span id={descriptionId}>{description}</span></div>
      <form onSubmit={submit}>
        {extra}
        <label>{t('common.reason')}<textarea ref={inputRef} aria-label={t('common.reason')} value={reason} onChange={(event) => setReason(event.target.value)} minLength="8" maxLength="500" required /></label>
        <label>{t('common.typeToContinue', { expected })}<input aria-label={t('common.typeToContinue', { expected })} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" required /></label>
        {error && <div className="admin-ai-inline-error" role="alert"><AlertCircle size={14} />{error}</div>}
        <div className="admin-ai-dialog-actions"><button type="button" onClick={onCancel} disabled={busy}>{t('common.cancel')}</button><button className="is-danger" type="submit" disabled={busy || reason.trim().length < 8 || confirmation.trim() !== expected}>{busy ? t('common.processing') : confirmLabel}</button></div>
      </form>
    </section>
  </div>;
}
