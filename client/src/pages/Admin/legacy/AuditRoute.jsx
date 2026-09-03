import { useCallback } from 'react';
import { api } from '../../../api';
import { formatDate } from '../../../lib/formatters';
import { useI18n } from '../../../i18n/context';
import { AdminListControls, AdminRouteState, useAdminRouteResource } from './shared';
import { adminListApiPath } from './list-query';
import { useAdminListQuery } from './use-admin-list-query';

export default function AuditRoute() {
  const { t } = useI18n();
  const [query, setQuery] = useAdminListQuery('/admin/audit', { limit: 25 });
  const load = useCallback(() => api(adminListApiPath('/admin/audit', query)), [query.q, query.cursor, query.limit]);
  const resource = useAdminRouteResource(load);
  return <AdminRouteState resource={resource}>{(data) => <><AdminListControls query={query} setQuery={setQuery} pageInfo={data.pageInfo}/><section className="admin-content"><div className="admin-panel admin-wide"><div className="admin-panel-head"><h2>{t('admin.console.audit.title')}</h2><small>{t('admin.console.audit.description')}</small></div><div className="admin-list">{data.events.map((event) => <article key={event.id}><div><b>{event.action}</b><small>{event.actorRef} · {event.targetType} · {formatDate(event.createdAt)}</small></div></article>)}</div></div></section></>}</AdminRouteState>;
}
