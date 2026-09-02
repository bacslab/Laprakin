import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from './router';
import { Archive, CalendarClock, ImagePlus, LoaderCircle, Plus, Save, UploadCloud, X } from 'lucide-react';
import { api } from './api';
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

function statusLabel(update) {
  if (update.status === 'archived') return 'Archived';
  if (update.status === 'draft') return 'Draft';
  if (update.publishedAt && new Date(update.publishedAt) > new Date()) return 'Terjadwal';
  return 'Published';
}

export function FeatureUpdatesAdmin({ setNotice }) {
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
        body: { ...EMPTY_UPDATE, title: 'Update fitur baru' },
      });
      await load(data.update.id);
      setNotice('Draft update dibuat.');
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };

  const save = async (event) => {
    event.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    try {
      const data = await api(`/admin/feature-updates/${selectedId}`, { method: 'PUT', body: payloadFromForm(form) });
      await load(data.update.id);
      setNotice(data.update.status === 'published' ? 'Update siap ditampilkan kepada user.' : 'Draft update tersimpan.');
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
      setNotice('Gambar update berhasil diunggah.');
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };

  const archive = async () => {
    if (!archivePending) { setArchivePending(true); return; }
    setBusy(true);
    try {
      await api(`/admin/feature-updates/${selectedId}`, { method: 'DELETE' });
      setArchivePending(false);
      await load();
      setNotice('Update dipindahkan ke arsip.');
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };

  return <section className="admin-content feature-cms">
    <div className="feature-cms-toolbar">
      <div><h2>Update produk</h2><p>Kelola draft, jadwal tayang, dan isi popup workspace.</p></div>
      <button className="feature-primary" type="button" onClick={createUpdate} disabled={busy}><Plus size={15} />Update baru</button>
    </div>
    <div className="feature-cms-layout">
      <aside className="feature-update-list" aria-label="Daftar update fitur">
        <div className="feature-list-heading"><b>Konten</b><small>{updates.length} update</small></div>
        {updates.length ? updates.map((update) => <button type="button" key={update.id} className={selectedId === update.id ? 'active' : ''} onClick={() => { setSelectedId(update.id); setArchivePending(false); }}>
          <span className={`feature-status status-${update.status}`}>{statusLabel(update)}</span>
          <b>{update.title}</b>
          <small>{update.versionLabel || 'Tanpa label versi'} · dilihat {update.seenCount || 0}</small>
        </button>) : <div className="feature-list-empty"><b>Belum ada update</b><p>Buat draft untuk mulai menulis catatan rilis.</p></div>}
      </aside>
      <div className="feature-cms-editor">
        {selected ? <form onSubmit={save}>
          <header><div><h3>{form.title || 'Update fitur'}</h3><span className={`feature-status status-${form.status}`}>{statusLabel(form)}</span></div><div className="feature-editor-actions"><button type="button" className={archivePending ? 'confirm' : ''} onClick={archive} disabled={busy}><Archive size={14} />{archivePending ? 'Konfirmasi arsip' : 'Arsipkan'}</button><button className="feature-primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}Simpan</button></div></header>
          <div className="feature-editor-grid">
            <div className="feature-fields">
               <label><span>Judul</span><input aria-label="Judul update" required minLength="3" maxLength="100" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
               <label><span>Ringkasan</span><textarea aria-label="Ringkasan update" maxLength="240" rows="3" value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="Satu kalimat tentang manfaat update ini." /></label>
               <label><span>Penjelasan</span><textarea aria-label="Penjelasan update" maxLength="3000" rows="6" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Jelaskan perubahan dengan bahasa yang singkat dan konkret." /></label>
               <label><span>Highlight <small>satu poin per baris, maksimal 6</small></span><textarea aria-label="Highlight update" maxLength="900" rows="5" value={form.highlightsText} onChange={(event) => setForm({ ...form, highlightsText: event.target.value })} placeholder={'Workspace lebih cepat\nExport lebih stabil'} /></label>
               <div className="feature-field-pair"><label><span>Label versi</span><input aria-label="Label versi" maxLength="40" value={form.versionLabel} onChange={(event) => setForm({ ...form, versionLabel: event.target.value })} placeholder="v1.8 · Juli 2026" /></label><label><span>Prioritas</span><select aria-label="Prioritas update" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="normal">Normal</option><option value="important">Penting</option></select></label></div>
               <div className="feature-field-pair"><label><span>Audience</span><select aria-label="Audience update" value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}><option value="all">Semua user</option><option value="free">Free plan</option><option value="paid">User berbayar</option></select></label><label><span>Status</span><select aria-label="Status update" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label></div>
               <div className="feature-field-pair"><label><span><CalendarClock size={13} /> Jadwal tayang</span><input aria-label="Jadwal tayang" type="datetime-local" value={form.publishedAt} onChange={(event) => setForm({ ...form, publishedAt: event.target.value })} /></label><label><span>Kedaluwarsa <small>opsional</small></span><input aria-label="Waktu kedaluwarsa" type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></label></div>
               <div className="feature-field-pair"><label><span>Label CTA</span><input aria-label="Label CTA" maxLength="40" value={form.ctaLabel} onChange={(event) => setForm({ ...form, ctaLabel: event.target.value })} placeholder="Coba sekarang" /></label><label><span>Tujuan internal</span><input aria-label="Tujuan internal CTA" maxLength="420" value={form.ctaPath} onChange={(event) => setForm({ ...form, ctaPath: event.target.value })} placeholder="/app atau /pricing" /></label></div>
            </div>
            <aside className="feature-preview-column">
              <div className="feature-image-uploader">
                <div>{form.imageUrl ? <img src={form.imageUrl} alt="Preview update" /> : <><ImagePlus size={20} /><b>Visual update</b><small>PNG, JPG, atau WEBP · maksimal 5 MB</small></>}</div>
                 <label className="feature-upload-button"><UploadCloud size={15} />{form.imageUrl ? 'Ganti gambar' : 'Upload gambar'}<input aria-label="Upload gambar update" type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadImage} disabled={busy} /></label>
              </div>
              <FeatureUpdatePreview update={{ ...payloadFromForm(form), id: selected.id }} />
            </aside>
          </div>
        </form> : <div className="feature-editor-empty"><h3>Buat update pertama</h3><p>Draft, jadwal, gambar, dan target audience dikelola dari sini.</p><button className="feature-primary" type="button" onClick={createUpdate}><Plus size={15} />Buat draft</button></div>}
      </div>
    </div>
  </section>;
}

function FeatureUpdatePreview({ update }) {
  return <article className="feature-mini-preview">
    <span>{update.versionLabel || 'WHAT\'S NEW'}</span>
    <h4>{update.title || 'Judul update fitur'}</h4>
    <p>{update.summary || 'Ringkasan singkat akan terlihat di sini.'}</p>
    {(update.highlights || []).slice(0, 3).map((item) => <small key={item}>{item}</small>)}
  </article>;
}

export function ProductUpdatePopup({ update, onReceipt, onClose }) {
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
      <button ref={!update.ctaLabel || !update.ctaPath ? initialFocusRef : undefined} className="product-update-close" type="button" aria-label="Tutup update fitur" onClick={() => onClose('dismissed')}><X size={17} /></button>
      {update.imageUrl && <div className="product-update-visual"><img src={update.imageUrl} alt={update.imageName || ''} /></div>}
      <div className="product-update-copy">
        <div className="product-update-kicker"><span>Yang baru</span>{update.versionLabel && <small>{update.versionLabel}</small>}</div>
        <h2 id="product-update-title">{update.title}</h2>
        {update.summary && <p className="product-update-summary">{update.summary}</p>}
        {update.body && <p className="product-update-body">{update.body}</p>}
        {update.highlights?.length > 0 && <ul>{update.highlights.map((item) => <li key={item}><span>{item}</span></li>)}</ul>}
        <div className="product-update-actions"><button type="button" className="product-update-later" onClick={() => onClose('dismissed')}>Nanti</button>{update.ctaLabel && update.ctaPath && <button ref={initialFocusRef} type="button" className="product-update-cta" onClick={open}>{update.ctaLabel}</button>}</div>
      </div>
    </section>
  </div>;
}
