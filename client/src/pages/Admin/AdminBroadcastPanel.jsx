import { useCallback, useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { api } from '../../api';
import { formatDate } from '../../lib/formatters';
import { Button } from '../../components/Button';
import { CustomSelect } from '../../components/CustomSelect';

export default function AdminBroadcastPanel({ users, setNotice }) {
  const [form, setForm] = useState({ audience: 'all', userIds: [], subject: '', heading: '', body: '', ctaLabel: '', ctaUrl: '', imageUrl: '', accentColor: '#b7ff24', backgroundColor: '#f5f5f2', textColor: '#171715' });
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const loadHistory = useCallback(() => api('/admin/broadcasts').then((data) => setHistory(data.broadcasts || [])).catch((error) => setNotice(error.message)), [setNotice]);
  useEffect(() => { loadHistory(); }, [loadHistory]);
  const toggleRecipient = (id) => setForm((value) => ({ ...value, userIds: value.userIds.includes(id) ? value.userIds.filter((item) => item !== id) : [...value.userIds, id] }));
  const uploadImage = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    setBusy(true);
    try {
      const body = new FormData(); body.append('file', file);
      const result = await api('/admin/broadcasts/image', { method: 'POST', body, form: true });
      setForm((value) => ({ ...value, imageUrl: result.imageUrl }));
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const sendBroadcast = async () => {
    setBusy(true);
    try {
      const result = await api('/admin/broadcasts', { method: 'POST', body: form });
      setNotice(`${result.deliveredCount} dari ${result.recipientCount} email berhasil diproses.`);
      setForm((value) => ({ ...value, subject: '', heading: '', body: '', ctaLabel: '', ctaUrl: '', imageUrl: '' }));
      await loadHistory();
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const invalid = form.subject.trim().length < 3 || form.heading.trim().length < 2 || form.body.trim().length < 10 || (form.audience === 'selected' && !form.userIds.length);
  return <section className="admin-content"><div className="admin-grid admin-broadcast-grid"><section className="admin-panel admin-broadcast-form"><div className="admin-panel-head"><h2>Email user</h2><small>Promosi, update, atau maintenance</small></div><label htmlFor="admin-broadcast-audience">Target<CustomSelect id="admin-broadcast-audience" ariaLabel="Target email" value={form.audience} onChange={(audience) => setForm((value) => ({ ...value, audience }))} options={[{value:'all',label:'Semua user terverifikasi'},{value:'paid',label:'Semua user paid'},{value:'selected',label:'User terpilih'}]}/></label>{form.audience === 'selected' && <div className="admin-recipient-list">{users.map((item) => <label key={item.id}><input aria-label={`Pilih penerima ${item.email}`} type="checkbox" checked={form.userIds.includes(item.id)} onChange={() => toggleRecipient(item.id)}/><span>{item.email}</span></label>)}</div>}<label>Subjek<input aria-label="Subjek email" maxLength="140" value={form.subject} onChange={(event) => setForm((value) => ({ ...value, subject: event.target.value }))}/></label><label>Judul email<input aria-label="Judul email" maxLength="140" value={form.heading} onChange={(event) => setForm((value) => ({ ...value, heading: event.target.value }))}/></label><label>Isi<textarea aria-label="Isi email" maxLength="6000" value={form.body} onChange={(event) => setForm((value) => ({ ...value, body: event.target.value }))}/></label><div className="admin-form-row"><label>Label tombol<input aria-label="Label tombol email" maxLength="50" value={form.ctaLabel} onChange={(event) => setForm((value) => ({ ...value, ctaLabel: event.target.value }))}/></label><label>URL tombol<input aria-label="URL tombol email" type="url" value={form.ctaUrl} onChange={(event) => setForm((value) => ({ ...value, ctaUrl: event.target.value }))}/></label></div><label>Gambar<input aria-label="Gambar email" type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadImage}/></label><div className="admin-color-row"><label>Aksen<input aria-label="Warna aksen email" type="color" value={form.accentColor} onChange={(event) => setForm((value) => ({ ...value, accentColor: event.target.value }))}/></label><label>Latar<input aria-label="Warna latar email" type="color" value={form.backgroundColor} onChange={(event) => setForm((value) => ({ ...value, backgroundColor: event.target.value }))}/></label><label>Teks<input aria-label="Warna teks email" type="color" value={form.textColor} onChange={(event) => setForm((value) => ({ ...value, textColor: event.target.value }))}/></label></div><Button onClick={sendBroadcast} disabled={busy || invalid}><Send size={14}/>Kirim email</Button></section><div><section className="admin-email-preview" style={{background:form.backgroundColor,color:form.textColor}}>{form.imageUrl && <img src={form.imageUrl} alt="Preview email"/>}<h2>{form.heading || 'Judul email'}</h2><p>{form.body || 'Isi email akan tampil di sini.'}</p>{form.ctaLabel && <span style={{background:form.accentColor,color:form.textColor}}>{form.ctaLabel}</span>}</section><section className="admin-panel"><div className="admin-panel-head"><h2>Riwayat</h2><small>{history.length} email</small></div><div className="admin-list">{history.slice(0,20).map((item) => <article key={item.id}><div><b>{item.subject}</b><small>{item.audience} · {formatDate(item.createdAt)}</small></div><span>{item.deliveredCount}/{item.recipientCount}</span></article>)}</div></section></div></div></section>;
}
