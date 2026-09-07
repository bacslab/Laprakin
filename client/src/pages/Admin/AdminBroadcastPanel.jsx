import { useCallback, useEffect, useState } from 'react';
import { Send } from '../../icons';
import { api } from '../../api';
import { formatDate } from '../../lib/formatters';
import { Button } from '../../components/Button';
import { CustomSelect } from '../../components/CustomSelect';
import { useI18n } from '../../i18n/context';
import AdminUserSearch from './AdminUserSearch';
import { filterAdminUsers } from './user-search';

export default function AdminBroadcastPanel({ users, initialHistory, reloadRoute = null, setNotice }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ audience: 'all', userIds: [], subject: '', heading: '', body: '', ctaLabel: '', ctaUrl: '', imageUrl: '', accentColor: '#b7ff24', backgroundColor: '#f5f5f2', textColor: '#171715' });
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const loadHistory = useCallback(() => (reloadRoute ? reloadRoute() : api('/admin/broadcasts')).then((data) => setHistory(data?.history || data?.broadcasts || [])).catch((error) => setNotice(error.message)), [reloadRoute, setNotice]);
  useEffect(() => { setHistory(initialHistory || []); }, [initialHistory]);
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
      setNotice(t('admin.console.broadcasts.delivered', { delivered: result.deliveredCount, recipients: result.recipientCount }));
      setForm((value) => ({ ...value, subject: '', heading: '', body: '', ctaLabel: '', ctaUrl: '', imageUrl: '' }));
      await loadHistory();
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const invalid = form.subject.trim().length < 3 || form.heading.trim().length < 2 || form.body.trim().length < 10 || (form.audience === 'selected' && !form.userIds.length);
  const visibleUsers = filterAdminUsers(users, recipientSearch);
  const audienceLabel = (audience) => ({ all: t('admin.console.broadcasts.all'), paid: t('admin.console.broadcasts.paid'), selected: t('admin.console.broadcasts.selected') }[audience] || audience);
  return <section className="admin-content admin-broadcast-page"><div className="admin-grid admin-broadcast-grid"><section className="admin-panel admin-broadcast-form"><div className="admin-panel-head"><h2>{t('admin.console.broadcasts.title')}</h2><small>{t('admin.console.broadcasts.description')}</small></div><label htmlFor="admin-broadcast-audience">{t('admin.console.broadcasts.target')}<CustomSelect id="admin-broadcast-audience" ariaLabel={t('admin.console.broadcasts.targetAria')} value={form.audience} onChange={(audience) => setForm((value) => ({ ...value, audience }))} options={[{value:'all',label:t('admin.console.broadcasts.all')},{value:'paid',label:t('admin.console.broadcasts.paid')},{value:'selected',label:t('admin.console.broadcasts.selected')}]}/></label>{form.audience === 'selected' && <><AdminUserSearch value={recipientSearch} onChange={setRecipientSearch} label={t('admin.console.list.recipientSearch')} placeholder={t('admin.console.list.recipientSearch')} /><div className="admin-recipient-list">{visibleUsers.map((item) => <label key={item.id}><input aria-label={t('admin.console.broadcasts.selectRecipientAria', { email: item.userRef })} type="checkbox" checked={form.userIds.includes(item.id)} onChange={() => toggleRecipient(item.id)}/><span>{item.userRef}</span></label>)}{!visibleUsers.length && <p className="admin-user-search-empty">{t('admin.console.list.noResults')}</p>}</div></>}<label>{t('admin.console.broadcasts.subject')}<input aria-label={t('admin.console.broadcasts.subjectAria')} maxLength="140" value={form.subject} onChange={(event) => setForm((value) => ({ ...value, subject: event.target.value }))}/></label><label>{t('admin.console.broadcasts.heading')}<input aria-label={t('admin.console.broadcasts.headingAria')} maxLength="140" value={form.heading} onChange={(event) => setForm((value) => ({ ...value, heading: event.target.value }))}/></label><label>{t('admin.console.broadcasts.body')}<textarea aria-label={t('admin.console.broadcasts.bodyAria')} maxLength="6000" value={form.body} onChange={(event) => setForm((value) => ({ ...value, body: event.target.value }))}/></label><div className="admin-form-row"><label>{t('admin.console.broadcasts.ctaLabel')}<input aria-label={t('admin.console.broadcasts.ctaLabelAria')} maxLength="50" value={form.ctaLabel} onChange={(event) => setForm((value) => ({ ...value, ctaLabel: event.target.value }))}/></label><label>{t('admin.console.broadcasts.ctaUrl')}<input aria-label={t('admin.console.broadcasts.ctaUrlAria')} type="url" value={form.ctaUrl} onChange={(event) => setForm((value) => ({ ...value, ctaUrl: event.target.value }))}/></label></div><label>{t('admin.console.broadcasts.image')}<input aria-label={t('admin.console.broadcasts.imageAria')} type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadImage}/></label><div className="admin-color-row"><label>{t('admin.console.broadcasts.accent')}<input aria-label={t('admin.console.broadcasts.accentAria')} type="color" value={form.accentColor} onChange={(event) => setForm((value) => ({ ...value, accentColor: event.target.value }))}/></label><label>{t('admin.console.broadcasts.background')}<input aria-label={t('admin.console.broadcasts.backgroundAria')} type="color" value={form.backgroundColor} onChange={(event) => setForm((value) => ({ ...value, backgroundColor: event.target.value }))}/></label><label>{t('admin.console.broadcasts.text')}<input aria-label={t('admin.console.broadcasts.textAria')} type="color" value={form.textColor} onChange={(event) => setForm((value) => ({ ...value, textColor: event.target.value }))}/></label></div><Button onClick={sendBroadcast} disabled={busy || invalid}><Send size={14}/>{t('admin.console.broadcasts.send')}</Button></section><div><section className="admin-email-preview" style={{background:form.backgroundColor,color:form.textColor}}>{form.imageUrl && <img src={form.imageUrl} alt={t('admin.console.broadcasts.previewAlt')}/>}<h2>{form.heading || t('admin.console.broadcasts.previewHeading')}</h2><p>{form.body || t('admin.console.broadcasts.previewBody')}</p>{form.ctaLabel && <span style={{background:form.accentColor,color:form.textColor}}>{form.ctaLabel}</span>}</section><section className="admin-panel"><div className="admin-panel-head"><h2>{t('admin.console.broadcasts.history')}</h2><small>{t('admin.console.broadcasts.emailCount', { count: history.length })}</small></div><div className="admin-list">{history.map((item) => <article key={item.id}><div><b>{item.subject}</b><small>{audienceLabel(item.audience)} · {formatDate(item.createdAt)}</small></div><span>{item.deliveredCount}/{item.recipientCount}</span></article>)}</div></section></div></div></section>;
}
