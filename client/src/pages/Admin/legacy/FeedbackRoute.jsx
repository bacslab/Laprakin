import { useCallback, useState } from 'react';
import { api } from '../../../api';
import { useI18n } from '../../../i18n/context';
import { AdminFeedbackPanel } from '../AdminLegacyContentPanels';
import { AdminListControls, AdminRouteState, useAdminRouteResource } from './shared';
import { adminListApiPath } from './list-query';
import { useAdminListQuery } from './use-admin-list-query';

export default function FeedbackRoute({ setNotice }) {
  const { t } = useI18n();
  const [reply, setReply] = useState({});
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useAdminListQuery('/admin/feedback', { status: 'all', category: '', limit: 25 });
  const load = useCallback(() => api(adminListApiPath('/admin/feedback', query)), [query.q, query.status, query.category, query.cursor, query.limit]);
  const resource = useAdminRouteResource(load);
  const updateFeedback = async (id, status) => {
    try { await api(`/admin/feedback/${id}/status`, { method: 'PUT', body: { status, adminNote: '' } }); await resource.reload(); }
    catch (error) { setNotice(error.message); }
  };
  const sendReply = async (id) => {
    const body = (reply[id] || '').trim();
    if (!body) return;
    setBusy(true);
    try {
      await api(`/admin/feedback/${id}/reply`, { method: 'POST', body: { body } });
      setReply((current) => ({ ...current, [id]: '' }));
      await resource.reload();
      setNotice(t('admin.console.notices.replySent'));
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const statuses = ['all', 'open', 'reviewing', 'resolved', 'closed'].map((value) => ({ value, label: value === 'all' ? t('admin.console.list.all') : t(`admin.console.feedback.${value}`) }));
  return <AdminRouteState resource={resource}>{(data) => <><AdminListControls query={query} setQuery={setQuery} pageInfo={data.pageInfo} statuses={statuses}/><AdminFeedbackPanel feedback={data.items} reply={reply} setReply={setReply} sendReply={sendReply} updateFeedback={updateFeedback} busy={busy}/></>}</AdminRouteState>;
}
