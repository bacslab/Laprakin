import { useCallback } from 'react';
import { api } from '../../../api';
import { useLocation, useNavigate } from '../../../router';
import { useI18n } from '../../../i18n/context';
import AdminAccessPanel from '../AdminAccessPanel';
import { AdminListControls, AdminRouteState, useAdminRouteResource } from './shared';
import { adminListApiPath } from './list-query';
import { useAdminListQuery } from './use-admin-list-query';

export default function UsersRoute({ setNotice }) {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const selectedUserId = decodeURIComponent(location.pathname.split('/').filter(Boolean)[2] || '');
  const [query, setQuery] = useAdminListQuery('/admin/users', { limit: 25 });
  const load = useCallback(() => api(adminListApiPath('/admin/users', query, { userId: selectedUserId })), [query.q, query.cursor, query.limit, selectedUserId]);
  const resource = useAdminRouteResource(load, { events: ['credit'] });
  const selectUser = (id) => navigate(`${id ? `/admin/users/${encodeURIComponent(id)}` : '/admin/users'}${location.search}`);
  const extra = selectedUserId ? <button type="button" onClick={() => selectUser('')}>{t('admin.console.list.allUsers')}</button> : null;
  return <AdminRouteState resource={resource}>{(data) => <><AdminListControls query={query} setQuery={setQuery} pageInfo={data.pageInfo} extra={extra}/><AdminAccessPanel users={data.users} selectedUserId={selectedUserId} onSelectUser={selectUser} setNotice={setNotice} onRefresh={resource.reload}/></>}</AdminRouteState>;
}
