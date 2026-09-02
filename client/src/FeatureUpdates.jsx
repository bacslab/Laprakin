import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from './router';
import { Archive, CalendarClock, ImagePlus, LoaderCircle, Plus, Save, UploadCloud, X } from 'lucide-react';
import { api } from './api';
import { useI18n } from './i18n/context';
import './feature-updates.css';

const EMPTY_UPDATE = {
  title: '', summary: '', body: '', versionLabel: '', highlights: [], imageUrl: '', imageName: '',
  ctaLabel: '', ctaPath: '', audience: 'all', priority: 'normal', status: 'draft', publishedAt: '', expiresAt: '',
};

function localDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formUpdate(update = EMPTY_UPDATE) {
  return {
    ...EMPTY_UPDATE,
    ...update,
    highlightsText: (update.highlights || []).join('\n'),
    publishedAt: localDateTime(update.publishedAt),
    expiresAt: localDateTime(update.expiresAt),
  };
}

function payloadFromForm(form) {
  return {
    title: form.title,
    summary: form.summary,
    body: form.body,
    versionLabel: form.versionLabel,
    highlights: form.highlightsText.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 6),
    imageUrl: form.imageUrl,
    imageName: form.imageName,
    ctaLabel: form.ctaLabel,
    ctaPath: form.ctaPath,
    audience: form.audience,
    priority: form.priority,
    status: form.status,
    publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : '',
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : '',
  };
}

function statusLabel(update, t) {
  if (update.status === 'archived') return t('admin.console.updates.archivedStatus');
  if (update.status === 'draft') return t('admin.console.updates.draft');
  if (update.publishedAt && new Date(update.publishedAt) > new Date()) return t('admin.console.updates.scheduled');
  return t('admin.console.updates.published');
}

export function FeatureUpdatesAdmin({ setNotice }) {
  const { t } = useI18n();
  const [updates, setUpdates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(formUpdate());
  const [busy, setBusy] = useState(false);
  const [archivePending, setArchivePending] = useState(false);

  const selected = useMemo(() => updates.find((item) => item.id === selectedId) || null, [updates, selectedId]);

  const load = async (preferredId = '') => {
    const data = await api('/admin/feature-updates');
    const items = data.updates || [];
    setUpdates(items);
    const nextId = preferredId || selectedId || items[0]?.id || '';
    const next = items.find((item) => item.id === nextId) || items[0] || null;
    setSelectedId(next?.id || '');
    setForm(formUpdate(next || EMPTY_UPDATE));
  };

  useEffect(() => { load().catch((error) => setNotice(error.message)); }, []);
  useEffect(() => { if (selected) setForm(formUpdate(selected)); }, [selectedId]);

  const createUpdate = async () => {
    setBusy(true);
    try {
      const data = await api('/admin/feature-updates', {
        method: 'POST',
        body: { ...EMPTY_UPDATE, title: t('admin.console.updates.newTitle') },
      });
      await load(data.update.id);
      setNotice(t('admin.console.updates.draftCreated'));
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };

  const save = async (event) => {
    event.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    try {
      const data = await api(`/admin/feature-updates/${selectedId}`, { method: 'PUT', body: payloadFromForm(form) });
      await load(data.update.id);
      setNotice(data.update.status === 'published' ? t('admin.console.updates.publishedNotice') : t('admin.console.updates.draftSaved'));
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };

  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedId) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const data = await api(`/admin/feature-updates/${selectedId}/image`, { method: 'POST', body, form: true });
      await load(data.update.id);
      setNotice(t('admin.console.updates.imageUploaded'));
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };

  const archive = async () => {
    if (!archivePending) { setArchivePending(true); return; }
    setBusy(true);
    try {
      await api(`/admin/feature-updates/${selectedId}`, { method: 'DELETE' });
      setArchivePending(false);
      await load();
      setNotice(t('admin.console.updates.archived'));
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };

  return <section className="admin-content feature-cms">
    <div className="feature-cms-toolbar">
      <div><h2>{t('admin.console.updates.pageTitle')}</h2><p>{t('admin.console.updates.description')}</p></div>
      <button className="feature-primary" type="button" onClick={createUpdate} disabled={busy}><Plus size={15} />{t('admin.console.updates.create')}</button>
    </div>
    <div className="feature-cms-layout">
      <aside className="feature-update-list" aria-label={t('admin.console.updates.listLabel')}>
        <div className="feature-list-heading"><b>{t('admin.console.updates.content')}</b><small>{t('admin.console.updates.count', { count: updates.length })}</small></div>
        {updates.length ? updates.map((update) => <button type="button" key={update.id} className={selectedId === update.id ? 'active' : ''} onClick={() => { setSelectedId(update.id); setArchivePending(false); }}>
          <span className={`feature-status status-${update.status}`}>{statusLabel(update, t)}</span>
          <b>{update.title}</b>
          <small>{update.versionLabel || t('admin.console.updates.noVersion')} · {t('admin.console.updates.views', { count: update.seenCount || 0 })}</small>
        </button>) : <div className="feature-list-empty"><b>{t('admin.console.updates.emptyTitle')}</b><p>{t('admin.console.updates.emptyDescription')}</p></div>}
      </aside>
      <div className="feature-cms-editor">
        {selected ? <form onSubmit={save}>
          <header><div><h3>{form.title || t('admin.console.updates.editorTitle')}</h3><span className={`feature-status status-${form.status}`}>{statusLabel(form, t)}</span></div><div className="feature-editor-actions"><button type="button" className={archivePending ? 'confirm' : ''} onClick={archive} disabled={busy}><Archive size={14} />{archivePending ? t('admin.console.updates.confirmArchive') : t('admin.console.updates.archive')}</button><button className="feature-primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}{t('admin.console.updates.save')}</button></div></header>
          <div className="feature-editor-grid">
            <div className="feature-fields">
               <label><span>{t('admin.console.updates.fieldTitle')}</span><input aria-label={t('admin.console.updates.fieldTitleAria')} required minLength="3" maxLength="100" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
               <label><span>{t('admin.console.updates.summary')}</span><textarea aria-label={t('admin.console.updates.summaryAria')} maxLength="240" rows="3" value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder={t('admin.console.updates.summaryPlaceholder')} /></label>
               <label><span>{t('admin.console.updates.body')}</span><textarea aria-label={t('admin.console.updates.bodyAria')} maxLength="3000" rows="6" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder={t('admin.console.updates.bodyPlaceholder')} /></label>
               <label><span>{t('admin.console.updates.highlights')} <small>{t('admin.console.updates.highlightsHint')}</small></span><textarea aria-label={t('admin.console.updates.highlightsAria')} maxLength="900" rows="5" value={form.highlightsText} onChange={(event) => setForm({ ...form, highlightsText: event.target.value })} placeholder={t('admin.console.updates.highlightsPlaceholder')} /></label>
               <div className="feature-field-pair"><label><span>{t('admin.console.updates.versionLabel')}</span><input aria-label={t('admin.console.updates.versionAria')} maxLength="40" value={form.versionLabel} onChange={(event) => setForm({ ...form, versionLabel: event.target.value })} placeholder={t('admin.console.updates.versionPlaceholder')} /></label><label><span>{t('admin.console.updates.priority')}</span><select aria-label={t('admin.console.updates.priorityAria')} value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="normal">{t('admin.console.updates.normal')}</option><option value="important">{t('admin.console.updates.important')}</option></select></label></div>
               <div className="feature-field-pair"><label><span>{t('admin.console.updates.audience')}</span><select aria-label={t('admin.console.updates.audienceAria')} value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}><option value="all">{t('admin.console.updates.allAudience')}</option><option value="free">{t('admin.console.updates.freeAudience')}</option><option value="paid">{t('admin.console.updates.paidAudience')}</option></select></label><label><span>{t('admin.console.updates.status')}</span><select aria-label={t('admin.console.updates.statusAria')} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">{t('admin.console.updates.draft')}</option><option value="published">{t('admin.console.updates.published')}</option><option value="archived">{t('admin.console.updates.archivedStatus')}</option></select></label></div>
               <div className="feature-field-pair"><label><span><CalendarClock size={13} /> {t('admin.console.updates.schedule')}</span><input aria-label={t('admin.console.updates.scheduleAria')} type="datetime-local" value={form.publishedAt} onChange={(event) => setForm({ ...form, publishedAt: event.target.value })} /></label><label><span>{t('admin.console.updates.expires')} <small>{t('admin.console.updates.optional')}</small></span><input aria-label={t('admin.console.updates.expiresAria')} type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></label></div>
               <div className="feature-field-pair"><label><span>{t('admin.console.updates.ctaLabel')}</span><input aria-label={t('admin.console.updates.ctaLabelAria')} maxLength="40" value={form.ctaLabel} onChange={(event) => setForm({ ...form, ctaLabel: event.target.value })} placeholder={t('admin.console.updates.ctaPlaceholder')} /></label><label><span>{t('admin.console.updates.internalTarget')}</span><input aria-label={t('admin.console.updates.internalTargetAria')} maxLength="420" value={form.ctaPath} onChange={(event) => setForm({ ...form, ctaPath: event.target.value })} placeholder={t('admin.console.updates.internalTargetPlaceholder')} /></label></div>
            </div>
            <aside className="feature-preview-column">
              <div className="feature-image-uploader">
                <div>{form.imageUrl ? <img src={form.imageUrl} alt={t('admin.console.updates.imagePreviewAlt')} /> : <><ImagePlus size={20} /><b>{t('admin.console.updates.visual')}</b><small>{t('admin.console.updates.imageHint')}</small></>}</div>
                 <label className="feature-upload-button"><UploadCloud size={15} />{form.imageUrl ? t('admin.console.updates.replaceImage') : t('admin.console.updates.uploadImage')}<input aria-label={t('admin.console.updates.uploadImage')} type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadImage} disabled={busy} /></label>
              </div>
              <FeatureUpdatePreview update={{ ...payloadFromForm(form), id: selected.id }} />
            </aside>
          </div>
        </form> : <div className="feature-editor-empty"><h3>{t('admin.console.updates.emptyEditorTitle')}</h3><p>{t('admin.console.updates.emptyEditorDescription')}</p><button className="feature-primary" type="button" onClick={createUpdate}><Plus size={15} />{t('admin.console.updates.createDraft')}</button></div>}
      </div>
    </div>
  </section>;
}

function FeatureUpdatePreview({ update }) {
  const { t } = useI18n();
  return <article className="feature-mini-preview">
    <span>{update.versionLabel || t('admin.console.updates.whatsNew')}</span>
    <h4>{update.title || t('workspace.productUpdate.previewTitle')}</h4>
    <p>{update.summary || t('workspace.productUpdate.previewSummary')}</p>
    {(update.highlights || []).slice(0, 3).map((item) => <small key={item}>{item}</small>)}
  </article>;
}

export function ProductUpdatePopup({ update, onReceipt, onClose }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const initialFocusRef = useRef(null);
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose('dismissed'); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  useEffect(() => { initialFocusRef.current?.focus(); }, [update]);
  if (!update) return null;
  const open = async () => {
    await onReceipt('opened');
    onClose(null);
    if (update.ctaPath) navigate(update.ctaPath);
  };
  return <div className="product-update-backdrop" role="presentation">
    <section className={`product-update-popup ${update.priority === 'important' ? 'important' : ''}`} role="dialog" aria-modal="true" aria-labelledby="product-update-title">
      <button ref={!update.ctaLabel || !update.ctaPath ? initialFocusRef : undefined} className="product-update-close" type="button" aria-label={t('workspace.productUpdate.close')} onClick={() => onClose('dismissed')}><X size={17} /></button>
      {update.imageUrl && <div className="product-update-visual"><img src={update.imageUrl} alt={update.imageName || ''} /></div>}
      <div className="product-update-copy">
        <div className="product-update-kicker"><span>{t('workspace.productUpdate.kicker')}</span>{update.versionLabel && <small>{update.versionLabel}</small>}</div>
        <h2 id="product-update-title">{update.title}</h2>
        {update.summary && <p className="product-update-summary">{update.summary}</p>}
        {update.body && <p className="product-update-body">{update.body}</p>}
        {update.highlights?.length > 0 && <ul>{update.highlights.map((item) => <li key={item}><span>{item}</span></li>)}</ul>}
        <div className="product-update-actions"><button type="button" className="product-update-later" onClick={() => onClose('dismissed')}>{t('workspace.productUpdate.later')}</button>{update.ctaLabel && update.ctaPath && <button ref={initialFocusRef} type="button" className="product-update-cta" onClick={open}>{update.ctaLabel}</button>}</div>
      </div>
    </section>
  </div>;
}
