import { useCallback } from 'react';
import { api } from '../../../api';
import { useI18n } from '../../../i18n/context';
import AdminAppealsPanel from '../AdminAppealsPanel';
import { AdminListControls, AdminRouteState, useAdminRouteResource } from './shared';
import { adminListApiPath } from './list-query';
import { useAdminListQuery } from './use-admin-list-query';

export default function AppealsRoute({ setNotice }) {
  const { t } = useI18n();
  const [query, setQuery] = useAdminListQuery('/admin/appeals', { status: 'all', limit: 25 });
  const load = useCallback(() => api(adminListApiPath('/admin/appeals', query)), [query.q, query.status, query.cursor, query.limit]);
  const resource = useAdminRouteResource(load);
  const statuses = ['all', 'open', 'approved', 'rejected'].map((value) => ({ value, label: value === 'all' ? t('admin.console.list.all') : value }));
  return <AdminRouteState resource={resource}>{(data) => <><AdminListControls query={query} setQuery={setQuery} pageInfo={data.pageInfo} statuses={statuses}/><AdminAppealsPanel initialAppeals={data.appeals} setNotice={setNotice} onRefresh={resource.reload}/></>}</AdminRouteState>;
}
