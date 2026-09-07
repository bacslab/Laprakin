import { useEffect, useState } from 'react';
import { api } from '../../api';
import { formatDate } from '../../lib/formatters';
import { useI18n } from '../../i18n/context';
import AdminUserSearch from './AdminUserSearch';
import { filterAdminRowsByUser } from './user-search';

export default function AdminAppealsPanel({ initialAppeals, setNotice, onRefresh }) {
  const { t } = useI18n();
  const [appeals, setAppeals] = useState([]);
  const [replies, setReplies] = useState({});
  const [busy, setBusy] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  useEffect(() => { setAppeals(initialAppeals || []); }, [initialAppeals]);
  const visibleAppeals = filterAdminRowsByUser(appeals, userSearch);
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
  return <section className="admin-content admin-appeals-page"><div className="admin-panel admin-wide"><div className="admin-panel-head"><h2>{t('admin.console.appeals.title')}</h2><small>{t('admin.console.appeals.description')}</small></div><AdminUserSearch value={userSearch} onChange={setUserSearch} label={t('admin.console.list.search')} placeholder={t('admin.console.list.searchPlaceholder')} /><div className="admin-list admin-appeal-list">{visibleAppeals.length ? visibleAppeals.map((appeal) => <article key={appeal.id}><div className="admin-appeal-copy"><div><b>{appeal.userRef || t('admin.console.appeals.inactive')}</b><small>{t('admin.console.appeals.protectedEmail')} · {formatDate(appeal.createdAt)}</small></div><p>{appeal.message}</p>{appeal.status === 'open' ? <textarea aria-label={t('admin.console.appeals.replyAria', { user: appeal.userRef || t('admin.console.access.user') })} value={replies[appeal.id] || ''} onChange={(event) => setReplies((value) => ({ ...value, [appeal.id]: event.target.value }))} placeholder={t('admin.console.appeals.replyPlaceholder')}/> : <small className="admin-reply">{appeal.adminReply}</small>}</div><div className="admin-actions"><span className={`status-${appeal.status === 'approved' ? 'completed' : appeal.status === 'open' ? 'queued' : 'failed'}`}>{appeal.status}</span>{appeal.status === 'open' && <><button disabled={busy} onClick={() => review(appeal, 'approved')}>{t('admin.console.appeals.approve')}</button><button disabled={busy} onClick={() => review(appeal, 'rejected')}>{t('admin.console.appeals.reject')}</button></>}</div></article>) : <p className="empty-admin">{userSearch ? t('admin.console.list.noResults') : t('admin.console.appeals.empty')}</p>}</div></div></section>;
}
