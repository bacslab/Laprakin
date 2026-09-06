import { useCallback, useState } from 'react';
import { Activity, ArrowUpRight, FileText, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { api } from '../../../api';
import { formatBytes } from '../../../lib/formatters';
import { useI18n } from '../../../i18n/context';
import AdminMonitoringCharts from './AdminMonitoringCharts';
import { AdminRouteState, useAdminRouteResource } from './shared';

const INITIAL_FILTERS = { days: '30', provider: '', model: '', route: '', status: '' };

export default function OverviewRoute() {
  const { t, language } = useI18n();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
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

  return <AdminRouteState resource={resource}>{(overview) => {
    const totals = overview.monitoring?.totals || {};
    const successRate = totals.calls ? Math.round((Number(totals.successful || 0) / Number(totals.calls)) * 100) : 0;
    const metrics = [
      { label: t('admin.console.metrics.activeUsers'), value: overview.stats?.users || 0, icon: Users, tone: 'violet' },
      { label: t('admin.console.metrics.activeDocuments'), value: overview.stats?.documents || 0, icon: FileText, tone: 'blue' },
      { label: t('admin.console.metrics.aiCalls'), value: totals.calls || overview.stats?.aiCalls24h || 0, icon: Sparkles, tone: 'lime' },
      { label: t('admin.console.metrics.storage'), value: formatBytes(overview.storageBytes || 0), icon: Activity, tone: 'orange' },
    ];
    return <section className="admin-monitoring-dashboard">
      <header className="admin-monitoring-hero">
        <div className="admin-monitoring-hero-copy">
          <span className="admin-monitoring-eyebrow"><span className="admin-live-dot" /> {t('admin.console.adminConsole')}</span>
          <h2>{t('admin.console.monitoring.title')}</h2>
          <p>{t('admin.console.monitoring.description')}</p>
        </div>
        <div className="admin-monitoring-hero-meta"><span><ShieldCheck size={16} /> {t('admin.console.privacyTitle')}</span><small>{t('admin.console.privacyDescription')}</small></div>
      </header>
      <div className="admin-monitoring-kpis" aria-label={t('admin.console.monitoring.summary')}>
        {metrics.map(({ label, value, icon: Icon, tone }) => <article className={`admin-monitoring-kpi is-${tone}`} key={label}><div className="admin-monitoring-kpi-top"><span>{label}</span><Icon size={18} /></div><strong>{value}</strong><small><ArrowUpRight size={13} /> {t('admin.console.monitoring.period', { days: filters.days })}</small></article>)}
      </div>
      {overview.monitoring ? <AdminMonitoringCharts data={overview.monitoring} filters={filters} onFilterChange={changeFilter} t={t} language={language} /> : <section className="admin-monitoring-empty"><ShieldCheck size={22} /><h3>{t('admin.console.monitoring.unavailableTitle')}</h3><p>{t('admin.console.monitoring.unavailableDescription')}</p></section>}
      <section className="admin-monitoring-bottom-grid">
        <section className="admin-monitoring-table admin-monitoring-jobs"><div className="admin-monitoring-section-head"><div><span>{t('admin.console.monitoring.traffic')}</span><h3>{t('admin.console.recentJobs')}</h3></div><small>{t('admin.console.noDocumentContent')}</small></div><div className="admin-monitoring-job-list">{overview.jobs?.length ? overview.jobs.map((job) => <article key={job.id}><div className="admin-monitoring-job-status"><span className={`status-dot status-${job.status}`} /><div><b>{job.job_type}</b><small>{job.message || t('admin.console.processing')}</small></div></div><time>{job.status}</time></article>) : <p className="admin-monitoring-muted">{t('admin.console.noJobs')}</p>}</div></section>
        <section className="admin-monitoring-table admin-monitoring-health"><div className="admin-monitoring-section-head"><div><span>{t('admin.console.monitoring.performance')}</span><h3>{t('admin.console.monitoring.successRate')}</h3></div><strong className="admin-monitoring-health-score">{successRate}%</strong></div><div className="admin-monitoring-health-track"><span style={{ width: `${successRate}%` }} /></div><div className="admin-monitoring-health-foot"><span>{Number(totals.successful || 0).toLocaleString(language === 'en' ? 'en-US' : 'id-ID')} {t('admin.console.monitoring.successful')}</span><span>{Number(totals.failed || 0).toLocaleString(language === 'en' ? 'en-US' : 'id-ID')} {t('admin.console.monitoring.errors')}</span></div></section>
      </section>
    </section>;
  }}</AdminRouteState>;
}
