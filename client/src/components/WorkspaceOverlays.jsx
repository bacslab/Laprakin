import { useEffect, useRef, useState } from 'react';
import { ArrowRight, HelpCircle, LoaderCircle, MessageCircle, MessageSquareText, Send, X } from 'lucide-react';
import { api } from '../api';
import { BrandMark } from './BrandMark';
import { IconButton } from './IconButton';
import { Modal } from './Dialog';
import Toggle from './Toggle';
import { formatDate } from '../lib/formatters';
import { useApp } from '../state/ui-context';

export function HelpModal({ onClose }) {
  const { setNotice } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const quickTopics = ['File gagal diunggah', 'Export DOCX', 'Billing dan credit', 'Privasi file'];
  useEffect(() => { api('/support/thread').then((data) => setMessages(data.messages || [])).catch((err) => setNotice(err.message)); }, []);
  const send = async (event) => { event.preventDefault(); if (!input.trim()) return; setBusy(true); try { const data = await api('/support/message', { method: 'POST', body: { content: input.trim() } }); setMessages(data.messages || []); setInput(''); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  return <Modal title="Bantuan" onClose={onClose} className="support-modal support-modal-v2">
    <div className="support-intro"><span><HelpCircle size={20}/></span><div><h2>Apa yang bisa kami bantu?</h2><p>Tanyakan soal akun, bahan, export, billing, atau kendala workspace.</p></div><small><i/>Support aktif</small></div>
    <div className="support-quick-topics">{quickTopics.map((topic) => <button type="button" key={topic} onClick={() => setInput(topic)}>{topic}<ArrowRight size={13}/></button>)}</div>
    <div className="modal-thread support-thread" aria-live="polite">{messages.length ? messages.map((item) => <article key={item.id} className={`support-message ${item.role}`}><span>{item.role === 'assistant' ? <BrandMark alt=""/> : 'K'}</span><div><small>{item.role === 'assistant' ? 'Tim Laprakin' : 'Kamu'}</small><p>{item.content}</p></div></article>) : <div className="support-empty"><MessageCircle size={20}/><div><b>Belum ada percakapan</b><p>Pilih topik di atas atau ceritakan kendalanya secara singkat.</p></div></div>}</div>
     <form className="support-composer" onSubmit={send}><textarea aria-label="Pesan bantuan" rows="2" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Tulis kendalamu..."/><div><small>Jangan kirim kata sandi atau data sensitif.</small><button type="submit" disabled={busy || !input.trim()}>{busy ? <LoaderCircle className="spin" size={15}/> : <Send size={15}/>}Kirim</button></div></form>
  </Modal>;
}

export function FeedbackModal({ onClose }) {
  const { setNotice } = useApp();
  const [items, setItems] = useState([]);
  const emptyForm = { category: 'idea', rating: null, body: '', contactAllowed: false, allowPublicQuote: false, publicAlias: '' };
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const categories = [{ value: 'idea', label: 'Ide fitur' }, { value: 'bug', label: 'Bug' }, { value: 'experience', label: 'Pengalaman' }, { value: 'other', label: 'Lainnya' }];
  useEffect(() => { api('/feedback').then((data) => setItems(data.items || [])).catch((err) => setNotice(err.message)); }, []);
  const submit = async (event) => { event.preventDefault(); if (busy || form.body.trim().length < 12 || (form.allowPublicQuote && !form.publicAlias.trim())) return; setBusy(true); try { const data = await api('/feedback', { method: 'POST', body: { ...form, body: form.body.trim(), publicAlias: form.publicAlias.trim() } }); setItems((old) => [data.item, ...old]); setForm(emptyForm); setNotice('Feedback terkirim.'); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  return <Modal title="Feedback" onClose={onClose} className="feedback-modal feedback-modal-v2">
    <div className="feedback-layout">
      <form className="feedback-form" onSubmit={submit}>
        <header><span>Masukan produk</span><h2>Ceritakan yang perlu kami perbaiki.</h2><p>Jelaskan kendala atau hasil yang kamu harapkan. Tim akan membaca riwayatnya di panel sebelah.</p></header>
        <fieldset className="feedback-category"><legend>Jenis masukan</legend><div>{categories.map((item) => <button type="button" key={item.value} aria-pressed={form.category === item.value} className={form.category === item.value ? 'active' : ''} onClick={() => setForm({ ...form, category: item.value })}>{item.label}</button>)}</div></fieldset>
        <fieldset className="feedback-rating"><legend>Nilai pengalaman <small>opsional</small></legend><div>{[1,2,3,4,5].map((rating) => <button type="button" key={rating} aria-pressed={form.rating === rating} aria-label={`Nilai ${rating} dari 5`} className={form.rating === rating ? 'active' : ''} onClick={() => setForm({ ...form, rating: form.rating === rating ? null : rating })}><b>{rating}</b><span>{rating === 1 ? 'Buruk' : rating === 5 ? 'Bagus' : ''}</span></button>)}</div></fieldset>
         <label className="feedback-body"><span>Masukan</span><textarea aria-label="Masukan" minLength="12" maxLength="1200" required value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Apa yang terjadi, dan seperti apa hasil yang kamu harapkan?"/><small>{form.body.length} / 1200</small></label>
         <div className="feedback-consent"><Toggle checked={form.contactAllowed} onChange={(checked) => setForm({ ...form, contactAllowed: checked })} title="Boleh dihubungi" description="Tim dapat membalas lewat akun ini."/><Toggle checked={form.allowPublicQuote} onChange={(checked) => setForm({ ...form, allowPublicQuote: checked, publicAlias: checked ? form.publicAlias : '' })} title="Boleh dijadikan testimoni" description="Tidak dipublikasikan tanpa alias dan persetujuanmu."/>{form.allowPublicQuote && <label><span>Alias publik <small>wajib</small></span><input aria-label="Alias publik" required value={form.publicAlias} onChange={(event) => setForm({ ...form, publicAlias: event.target.value })} placeholder="Contoh: Mahasiswa TI semester 4"/></label>}</div>
        <button className="feedback-submit" type="submit" disabled={busy || form.body.trim().length < 12 || (form.allowPublicQuote && !form.publicAlias.trim())}>{busy ? <LoaderCircle className="spin" size={15}/> : <Send size={15}/>}Kirim masukan</button>
      </form>
      <aside className="feedback-history"><header><div><b>Riwayat</b><small>{items.length} masukan</small></div><MessageSquareText size={17}/></header>{items.length ? <div>{items.map((item) => <article key={item.id}><div><span>{item.category} · {item.rating ? `${item.rating}/5` : 'tanpa rating'}</span><small>{formatDate(item.updatedAt)}</small></div><p>{item.body}</p><em>{item.status}</em>{item.replies?.map((reply) => <div className="feedback-reply" key={reply.id}><b>Tim Laprakin</b><p>{reply.body}</p></div>)}</article>)}</div> : <div className="feedback-empty"><MessageSquareText size={18}/><b>Belum ada feedback</b><p>Masukan yang dikirim akan tersimpan dan balasan tim muncul di sini.</p></div>}</aside>
    </div>
  </Modal>;
}

export function NotificationModal({ onClose }) { const { setNotice } = useApp(); const [data, setData] = useState({ notifications: [], unread: 0 }); const ref = useRef(null); useEffect(() => { api('/notifications').then(setData).catch((err) => setNotice(err.message)); }, []); useEffect(() => { const closeOutside = (event) => { if (ref.current && !ref.current.contains(event.target)) onClose(); }; window.addEventListener('mousedown', closeOutside); return () => window.removeEventListener('mousedown', closeOutside); }, [onClose]); useEffect(() => { const timer = window.setTimeout(onClose, 5000); return () => window.clearTimeout(timer); }, [onClose]); const markRead = async () => { try { setData(await api('/notifications/read', { method: 'PUT', body: {} })); } catch (err) { setNotice(err.message); } }; return <aside ref={ref} className="notification-popover" role="dialog" aria-modal="true" aria-label="Notifikasi"><header><div><b>Notifikasi</b><small>{data.unread ? `${data.unread} baru` : 'Semua sudah dibaca'}</small></div><IconButton label="Tutup" onClick={onClose}><X size={16} /></IconButton></header>{data.unread ? <button className="notification-read" onClick={markRead}>Tandai semua dibaca</button> : null}<div className="notification-list">{data.notifications.length ? data.notifications.map((note) => <article key={note.id} className={note.is_read ? 'is-read' : ''}><span /> <div><b>{note.title}</b><p>{note.body}</p><small>{formatDate(note.created_at)}</small></div></article>) : <p className="muted-note">Belum ada notifikasi.</p>}</div></aside>; }
