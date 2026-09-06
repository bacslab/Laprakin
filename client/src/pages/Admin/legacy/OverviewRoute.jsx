import { useCallback, useState } from 'react';
import { Activity, FileText, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { api } from '../../../api';
import { formatBytes } from '../../../lib/formatters';
import { useI18n } from '../../../i18n/context';
import AdminMonitoringCharts from './AdminMonitoringCharts';
import { AdminRouteState, useAdminRouteResource } from './shared';

export default function OverviewRoute() {
  const { t, language } = useI18n();
  const [filters, setFilters] = useState({ days: '30', provider: '', model: '', route: '', status: '' });
  const load = useCallback(async () => {
    const query = new URLSearchParams(filters);
    const [overview, monitoring] = await Promise.all([
      api('/admin/overview'),
      api(`/admin/ai/usage?${query.toString()}`).catch(() => null),
    ]);
    return { ...overview, monitoring };
  }, [filters]);
  const resource = useAdminRouteResource(load, { events: ['alert', 'alert-updated'] });
  const changeFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  return <AdminRouteState resource={resource}>{(overview) => <section className="admin-content">
    <div className="admin-privacy-note"><ShieldCheck size={17}/><div><b>{t('admin.console.privacyTitle')}</b><span>{t('admin.console.privacyDescription')}</span></div></div>
    <div className="admin-metric-grid admin-metric-grid-compact">{[
      [t('admin.console.metrics.activeUsers'), overview.stats.users, Users],
      [t('admin.console.metrics.activeDocuments'), overview.stats.documents, FileText],
      [t('admin.console.metrics.aiCalls'), overview.stats.aiCalls24h, Sparkles],
      [t('admin.console.metrics.storage'), formatBytes(overview.storageBytes), Activity],
    ].map(([label, value, Icon]) => <article key={label}><Icon size={16}/><span>{label}</span><b>{value}</b></article>)}</div>
    {overview.monitoring ? <AdminMonitoringCharts data={overview.monitoring} filters={filters} onFilterChange={changeFilter} t={t} language={language}/> : <section className="admin-panel admin-monitoring-fallback"><h2>{t('admin.console.monitoring.unavailableTitle')}</h2><p>{t('admin.console.monitoring.unavailableDescription')}</p></section>}
    <section className="admin-panel admin-recent-jobs"><div className="admin-panel-head"><h2>{t('admin.console.recentJobs')}</h2><small>{t('admin.console.noDocumentContent')}</small></div><div className="admin-list">{overview.jobs?.length ? overview.jobs.map((job) => <article key={job.id}><div><b>{job.job_type}</b><small>{job.message || t('admin.console.processing')}</small></div><span className={`status-${job.status}`}>{job.status}</span></article>) : <p>{t('admin.console.noJobs')}</p>}</div></section>
  </section>}</AdminRouteState>;
}
