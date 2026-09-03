import { useCallback } from 'react';
import { api } from '../../../api';
import { formatDate } from '../../../lib/formatters';
import { useI18n } from '../../../i18n/context';
import { AdminListControls, AdminRouteState, useAdminRouteResource } from './shared';
import { adminListApiPath } from './list-query';
import { useAdminListQuery } from './use-admin-list-query';

export default function AlertsRoute({ setNotice }) {
  const { t } = useI18n();
  const [query, setQuery] = useAdminListQuery('/admin/alerts', { status: 'all', limit: 25 });
  const load = useCallback(() => api(adminListApiPath('/admin/alerts', query)), [query.q, query.status, query.cursor, query.limit]);
  const resource = useAdminRouteResource(load, { events: ['alert', 'alert-updated'] });
  const update = async (id, status) => {
    try { await api(`/admin/alerts/${id}`, { method: 'PUT', body: { status } }); await resource.reload(); }
    catch (error) { setNotice(error.message); }
  };
  const statuses = ['all', 'open', 'resolved'].map((value) => ({ value, label: value === 'all' ? t('admin.console.list.all') : value }));
  return <AdminRouteState resource={resource}>{(data) => <><AdminListControls query={query} setQuery={setQuery} pageInfo={data.pageInfo} statuses={statuses}/><section className="admin-content"><div className="admin-panel admin-wide"><div className="admin-panel-head"><h2>{t('admin.console.alerts.title')}</h2><small>{t('admin.console.alerts.description')}</small></div><div className="admin-list admin-alert-list">{data.alerts.length ? data.alerts.map((alert) => <article key={alert.id} className={`admin-alert-${alert.severity}`}><div><b>{alert.summary}</b><small>{alert.userEmail || t('admin.console.alerts.system')} · {alert.kind}{alert.errorCode ? ` · ${alert.errorCode}` : ''} · {formatDate(alert.createdAt)}</small></div><div className="admin-actions"><span className={`status-${alert.status === 'resolved' ? 'completed' : 'failed'}`}>{alert.status}</span><button onClick={() => update(alert.id, alert.status === 'open' ? 'resolved' : 'open')}>{alert.status === 'open' ? t('admin.console.alerts.markResolved') : t('admin.console.alerts.reopen')}</button></div></article>) : <p className="empty-admin">{t('admin.console.alerts.empty')}</p>}</div></div></section></>}</AdminRouteState>;
}
