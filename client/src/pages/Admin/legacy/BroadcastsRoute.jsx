import { useCallback } from 'react';
import { api } from '../../../api';
import { useI18n } from '../../../i18n/context';
import AdminBroadcastPanel from '../AdminBroadcastPanel';
import { AdminListControls, AdminRouteState, useAdminRouteResource } from './shared';
import { adminListApiPath } from './list-query';
import { useAdminListQuery } from './use-admin-list-query';

export default function BroadcastsRoute({ setNotice }) {
  const { t } = useI18n();
  const [query, setQuery] = useAdminListQuery('/admin/broadcasts', { recipient: '', limit: 25 });
  const load = useCallback(async () => {
    const [userData, broadcastData] = await Promise.all([api(adminListApiPath('/admin/users', { q: query.recipient, limit: 100 })), api(adminListApiPath('/admin/broadcasts', query))]);
    return { users: userData.users || [], history: broadcastData.broadcasts || [], pageInfo: broadcastData.pageInfo };
  }, [query.q, query.recipient, query.cursor, query.limit]);
  const resource = useAdminRouteResource(load, { events: ['credit'] });
  const recipientFilter = <label>{t('admin.console.list.recipientSearch')}<input aria-label={t('admin.console.list.recipientSearch')} type="search" value={query.recipient} onChange={(event) => setQuery({ recipient: event.target.value }, { replace: true })}/></label>;
  return <AdminRouteState resource={resource}>{({ users, history, pageInfo }) => <><AdminListControls query={query} setQuery={setQuery} pageInfo={pageInfo} extra={recipientFilter}/><AdminBroadcastPanel users={users} initialHistory={history} reloadRoute={resource.reload} setNotice={setNotice}/></>}</AdminRouteState>;
}
