import { useCallback } from 'react';
import { api } from '../../../api';
import AdminBroadcastPanel from '../AdminBroadcastPanel';
import { AdminListControls, AdminRouteState, useAdminRouteResource } from './shared';
import { adminListApiPath } from './list-query';
import { useAdminListQuery } from './use-admin-list-query';

export default function BroadcastsRoute({ setNotice }) {
  const [query, setQuery] = useAdminListQuery('/admin/broadcasts', { limit: 25 });
  const load = useCallback(async () => {
    const [userData, broadcastData] = await Promise.all([api(adminListApiPath('/admin/users', { limit: 100 })), api(adminListApiPath('/admin/broadcasts', query))]);
    return { users: userData.users || [], history: broadcastData.broadcasts || [], pageInfo: broadcastData.pageInfo };
  }, [query.cursor, query.limit]);
  const resource = useAdminRouteResource(load, { events: ['credit'] });
  return <AdminRouteState resource={resource}>{({ users, history, pageInfo }) => <><AdminListControls query={query} setQuery={setQuery} pageInfo={pageInfo}/><AdminBroadcastPanel users={users} initialHistory={history} reloadRoute={resource.reload} setNotice={setNotice}/></>}</AdminRouteState>;
}
