import { useEffect, useState } from 'react';
import { api } from '../../api';
import { formatDate } from '../../lib/formatters';
import { useI18n } from '../../i18n/context';

export default function AdminAppealsPanel({ initialAppeals, setNotice, onRefresh }) {
  const { t } = useI18n();
  const [appeals, setAppeals] = useState([]);
  const [replies, setReplies] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { setAppeals(initialAppeals || []); }, [initialAppeals]);
  const review = async (appeal, status) => {
    const reply = (replies[appeal.id] || '').trim();
    if (reply.length < 4) return;
    setBusy(true);
    try {
      await api(`/admin/appeals/${appeal.id}`, {
        method: 'PUT',
        body: { status, reply, liftRestrictions: status === 'approved' },
      });
      await onRefresh();
      setNotice(t(status === 'approved' ? 'admin.console.appeals.approvedNotice' : 'admin.console.appeals.reviewedNotice'));
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  return <section className="admin-content"><div className="admin-panel admin-wide"><div className="admin-panel-head"><h2>{t('admin.console.appeals.title')}</h2><small>{t('admin.console.appeals.description')}</small></div><div className="admin-list admin-appeal-list">{appeals.length ? appeals.map((appeal) => <article key={appeal.id}><div className="admin-appeal-copy"><div><b>{appeal.userName || appeal.userEmail || t('admin.console.appeals.inactive')}</b><small>{appeal.userEmail || t('admin.console.appeals.protectedEmail')} · {formatDate(appeal.createdAt)}</small></div><p>{appeal.message}</p>{appeal.status === 'open' ? <textarea aria-label={t('admin.console.appeals.replyAria', { user: appeal.userEmail || t('admin.console.access.user') })} value={replies[appeal.id] || ''} onChange={(event) => setReplies((value) => ({ ...value, [appeal.id]: event.target.value }))} placeholder={t('admin.console.appeals.replyPlaceholder')}/> : <small className="admin-reply">{appeal.adminReply}</small>}</div><div className="admin-actions"><span className={`status-${appeal.status === 'approved' ? 'completed' : appeal.status === 'open' ? 'queued' : 'failed'}`}>{appeal.status}</span>{appeal.status === 'open' && <><button disabled={busy} onClick={() => review(appeal, 'approved')}>{t('admin.console.appeals.approve')}</button><button disabled={busy} onClick={() => review(appeal, 'rejected')}>{t('admin.console.appeals.reject')}</button></>}</div></article>) : <p className="empty-admin">{t('admin.console.appeals.empty')}</p>}</div></div></section>;
}
