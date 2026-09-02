import { useEffect, useRef, useState } from 'react';
import { ArrowRight, HelpCircle, LoaderCircle, MessageCircle, MessageSquareText, Send, X } from 'lucide-react';
import { api } from '../api';
import { BrandMark } from './BrandMark';
import { IconButton } from './IconButton';
import { Modal } from './Dialog';
import Toggle from './Toggle';
import { formatDate } from '../lib/formatters';
import { useApp } from '../state/ui-context';
import { useI18n } from '../i18n/context';

export function HelpModal({ onClose }) {
  const { t } = useI18n();
  const { setNotice } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const quickTopics = [0, 1, 2, 3].map((index) => t(`workspace.overlays.help.topics.${index}`));
  useEffect(() => { api('/support/thread').then((data) => setMessages(data.messages || [])).catch((err) => setNotice(err.message)); }, []);
  const send = async (event) => { event.preventDefault(); if (!input.trim()) return; setBusy(true); try { const data = await api('/support/message', { method: 'POST', body: { content: input.trim() } }); setMessages(data.messages || []); setInput(''); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  return <Modal title={t('workspace.overlays.help.title')} onClose={onClose} className="support-modal support-modal-v2">
    <div className="support-intro"><span><HelpCircle size={20}/></span><div><h2>{t('workspace.overlays.help.introTitle')}</h2><p>{t('workspace.overlays.help.introDescription')}</p></div><small><i/>{t('workspace.overlays.help.supportActive')}</small></div>
    <div className="support-quick-topics">{quickTopics.map((topic) => <button type="button" key={topic} onClick={() => setInput(topic)}>{topic}<ArrowRight size={13}/></button>)}</div>
    <div className="modal-thread support-thread" aria-live="polite">{messages.length ? messages.map((item) => <article key={item.id} className={`support-message ${item.role}`}><span>{item.role === 'assistant' ? <BrandMark alt=""/> : 'K'}</span><div><small>{item.role === 'assistant' ? t('workspace.overlays.help.assistant') : t('workspace.overlays.help.you')}</small><p>{item.content}</p></div></article>) : <div className="support-empty"><MessageCircle size={20}/><div><b>{t('workspace.overlays.help.emptyTitle')}</b><p>{t('workspace.overlays.help.emptyDescription')}</p></div></div>}</div>
     <form className="support-composer" onSubmit={send}><textarea aria-label={t('workspace.overlays.help.messageLabel')} rows="2" value={input} onChange={(event) => setInput(event.target.value)} placeholder={t('workspace.overlays.help.placeholder')}/><div><small>{t('workspace.overlays.help.sensitiveHint')}</small><button type="submit" disabled={busy || !input.trim()}>{busy ? <LoaderCircle className="spin" size={15}/> : <Send size={15}/>} {t('workspace.overlays.help.send')}</button></div></form>
  </Modal>;
}

export function FeedbackModal({ onClose }) {
  const { t } = useI18n();
  const { setNotice } = useApp();
  const [items, setItems] = useState([]);
  const emptyForm = { category: 'idea', rating: null, body: '', contactAllowed: false, allowPublicQuote: false, publicAlias: '' };
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const categories = ['idea', 'bug', 'experience', 'other'].map((value) => ({ value, label: t(`workspace.overlays.feedback.categories.${value}`) }));
  useEffect(() => { api('/feedback').then((data) => setItems(data.items || [])).catch((err) => setNotice(err.message)); }, []);
  const submit = async (event) => { event.preventDefault(); if (busy || form.body.trim().length < 12 || (form.allowPublicQuote && !form.publicAlias.trim())) return; setBusy(true); try { const data = await api('/feedback', { method: 'POST', body: { ...form, body: form.body.trim(), publicAlias: form.publicAlias.trim() } }); setItems((old) => [data.item, ...old]); setForm(emptyForm); setNotice(t('workspace.overlays.feedback.sent')); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  return <Modal title={t('workspace.overlays.feedback.title')} onClose={onClose} className="feedback-modal feedback-modal-v2">
    <div className="feedback-layout">
      <form className="feedback-form" onSubmit={submit}>
        <header><span>{t('workspace.overlays.feedback.eyebrow')}</span><h2>{t('workspace.overlays.feedback.heading')}</h2><p>{t('workspace.overlays.feedback.description')}</p></header>
        <fieldset className="feedback-category"><legend>{t('workspace.overlays.feedback.categoryLegend')}</legend><div>{categories.map((item) => <button type="button" key={item.value} aria-pressed={form.category === item.value} className={form.category === item.value ? 'active' : ''} onClick={() => setForm({ ...form, category: item.value })}>{item.label}</button>)}</div></fieldset>
        <fieldset className="feedback-rating"><legend>{t('workspace.overlays.feedback.ratingLegend')} <small>{t('workspace.overlays.feedback.optional')}</small></legend><div>{[1,2,3,4,5].map((rating) => <button type="button" key={rating} aria-pressed={form.rating === rating} aria-label={t('workspace.overlays.feedback.ratingAria', { rating })} className={form.rating === rating ? 'active' : ''} onClick={() => setForm({ ...form, rating: form.rating === rating ? null : rating })}><b>{rating}</b><span>{rating === 1 ? t('workspace.overlays.feedback.bad') : rating === 5 ? t('workspace.overlays.feedback.good') : ''}</span></button>)}</div></fieldset>
         <label className="feedback-body"><span>{t('workspace.overlays.feedback.bodyLabel')}</span><textarea aria-label={t('workspace.overlays.feedback.bodyLabel')} minLength="12" maxLength="1200" required value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder={t('workspace.overlays.feedback.bodyPlaceholder')}/><small>{form.body.length} / 1200</small></label>
         <div className="feedback-consent"><Toggle checked={form.contactAllowed} onChange={(checked) => setForm({ ...form, contactAllowed: checked })} title={t('workspace.overlays.feedback.contactAllowed')} description={t('workspace.overlays.feedback.contactDescription')}/><Toggle checked={form.allowPublicQuote} onChange={(checked) => setForm({ ...form, allowPublicQuote: checked, publicAlias: checked ? form.publicAlias : '' })} title={t('workspace.overlays.feedback.publicQuote')} description={t('workspace.overlays.feedback.publicQuoteDescription')}/>{form.allowPublicQuote && <label><span>{t('workspace.overlays.feedback.publicAlias')} <small>{t('workspace.overlays.feedback.required')}</small></span><input aria-label={t('workspace.overlays.feedback.publicAlias')} required value={form.publicAlias} onChange={(event) => setForm({ ...form, publicAlias: event.target.value })} placeholder={t('workspace.overlays.feedback.publicAliasPlaceholder')}/></label>}</div>
        <button className="feedback-submit" type="submit" disabled={busy || form.body.trim().length < 12 || (form.allowPublicQuote && !form.publicAlias.trim())}>{busy ? <LoaderCircle className="spin" size={15}/> : <Send size={15}/>} {t('workspace.overlays.feedback.submit')}</button>
      </form>
      <aside className="feedback-history"><header><div><b>{t('workspace.overlays.feedback.history')}</b><small>{t('workspace.overlays.feedback.historyCount', { count: items.length })}</small></div><MessageSquareText size={17}/></header>{items.length ? <div>{items.map((item) => <article key={item.id}><div><span>{item.category} · {item.rating ? `${item.rating}/5` : t('workspace.overlays.feedback.noRating')}</span><small>{formatDate(item.updatedAt)}</small></div><p>{item.body}</p><em>{item.status}</em>{item.replies?.map((reply) => <div className="feedback-reply" key={reply.id}><b>{t('workspace.overlays.feedback.team')}</b><p>{reply.body}</p></div>)}</article>)}</div> : <div className="feedback-empty"><MessageSquareText size={18}/><b>{t('workspace.overlays.feedback.emptyTitle')}</b><p>{t('workspace.overlays.feedback.emptyDescription')}</p></div>}</aside>
    </div>
  </Modal>;
}

export function NotificationModal({ onClose }) { const { t } = useI18n(); const { setNotice } = useApp(); const [data, setData] = useState({ notifications: [], unread: 0 }); const ref = useRef(null); useEffect(() => { api('/notifications').then(setData).catch((err) => setNotice(err.message)); }, []); useEffect(() => { const closeOutside = (event) => { if (ref.current && !ref.current.contains(event.target)) onClose(); }; window.addEventListener('mousedown', closeOutside); return () => window.removeEventListener('mousedown', closeOutside); }, [onClose]); useEffect(() => { const timer = window.setTimeout(onClose, 5000); return () => window.clearTimeout(timer); }, [onClose]); const markRead = async () => { try { setData(await api('/notifications/read', { method: 'PUT', body: {} })); } catch (err) { setNotice(err.message); } }; return <aside ref={ref} className="notification-popover" role="dialog" aria-modal="true" aria-label={t('workspace.overlays.notifications.title')}><header><div><b>{t('workspace.overlays.notifications.title')}</b><small>{data.unread ? t('workspace.overlays.notifications.newCount', { count: data.unread }) : t('workspace.overlays.notifications.allRead')}</small></div><IconButton label={t('workspace.overlays.notifications.close')} onClick={onClose}><X size={16} /></IconButton></header>{data.unread ? <button className="notification-read" onClick={markRead}>{t('workspace.overlays.notifications.markAllRead')}</button> : null}<div className="notification-list">{data.notifications.length ? data.notifications.map((note) => <article key={note.id} className={note.is_read ? 'is-read' : ''}><span /> <div><b>{note.title}</b><p>{note.body}</p><small>{formatDate(note.created_at)}</small></div></article>) : <p className="muted-note">{t('workspace.overlays.notifications.empty')}</p>}</div></aside>; }
