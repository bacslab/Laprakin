import { useCallback } from 'react';
import { api } from '../../../api';
import { useI18n } from '../../../i18n/context';
import { FeatureUpdatesAdmin } from '../../../FeatureUpdates';
import { AdminListControls, AdminRouteState, useAdminRouteResource } from './shared';
import { adminListApiPath } from './list-query';
import { useAdminListQuery } from './use-admin-list-query';

export default function UpdatesRoute({ setNotice }) {
  const { t } = useI18n();
  const [query, setQuery] = useAdminListQuery('/admin/updates', { status: 'all', limit: 25 });
  const load = useCallback(() => api(adminListApiPath('/admin/feature-updates', query)), [query.q, query.status, query.cursor, query.limit]);
  const resource = useAdminRouteResource(load);
  const statuses = ['all', 'draft', 'published', 'archived'].map((value) => ({ value, label: value === 'all' ? t('admin.console.list.all') : value }));
  return <AdminRouteState resource={resource}>{(data) => <><AdminListControls query={query} setQuery={setQuery} pageInfo={data.pageInfo} statuses={statuses}/><FeatureUpdatesAdmin initialUpdates={data.updates} reloadUpdates={resource.reload} setNotice={setNotice}/></>}</AdminRouteState>;
}
