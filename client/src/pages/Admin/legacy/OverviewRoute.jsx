import { useCallback } from 'react';
import { Activity, AlertTriangle, BellRing, Database, FileText, MessageCircle, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { api } from '../../../api';
import { formatBytes } from '../../../lib/formatters';
import { useI18n } from '../../../i18n/context';
import { AdminRouteState, useAdminRouteResource } from './shared';

export default function OverviewRoute() {
  const { t, language } = useI18n();
  const load = useCallback(() => api('/admin/overview'), []);
  const resource = useAdminRouteResource(load, { events: ['alert', 'alert-updated'] });
  return <AdminRouteState resource={resource}>{(overview) => <section className="admin-content">
    <div className="admin-privacy-note"><ShieldCheck size={17}/><div><b>{t('admin.console.privacyTitle')}</b><span>{t('admin.console.privacyDescription')}</span></div></div>
    <div className="admin-metric-grid">{[
      [t('admin.console.metrics.activeUsers'), overview.stats.users, Users],
      [t('admin.console.metrics.activeDocuments'), overview.stats.documents, FileText],
      [t('admin.console.metrics.runningJobs'), overview.stats.queuedJobs, Activity],
      [t('admin.console.metrics.aiCalls'), overview.stats.aiCalls24h, Sparkles],
      [t('admin.console.metrics.aiTokens'), Number(overview.stats.aiTokens24h || 0).toLocaleString(language === 'en' ? 'en-US' : 'id-ID'), Activity],
      [t('admin.console.metrics.aiErrors'), overview.stats.aiErrors24h, AlertTriangle],
      [t('admin.console.metrics.openAlerts'), overview.stats.openAdminAlerts || 0, BellRing],
      [t('admin.console.metrics.openFeedback'), overview.stats.openFeedback, MessageCircle],
      [t('admin.console.metrics.openRisk'), overview.stats.openRiskEvents, AlertTriangle],
      [t('admin.console.metrics.storage'), formatBytes(overview.storageBytes), Database],
    ].map(([label, value, Icon]) => <article key={label}><Icon size={16}/><span>{label}</span><b>{value}</b></article>)}</div>
    <div className="admin-grid">
      <section className="admin-panel"><div className="admin-panel-head"><h2>{t('admin.console.activity')}</h2><small>{t('admin.console.aggregateEvents')}</small></div><div className="activity-bars">{overview.dailyActivity?.length ? overview.dailyActivity.map((day) => <div key={day.day}><i style={{ height: `${Math.max(8, Math.min(100, day.count * 12))}%` }}/><span>{day.day.slice(5)}</span><b>{day.count}</b></div>) : <p>{t('admin.console.noActivity')}</p>}</div></section>
      <section className="admin-panel"><div className="admin-panel-head"><h2>{t('admin.console.recentJobs')}</h2><small>{t('admin.console.noDocumentContent')}</small></div><div className="admin-list">{overview.jobs?.length ? overview.jobs.map((job) => <article key={job.id}><div><b>{job.job_type}</b><small>{job.message || t('admin.console.processing')}</small></div><span className={`status-${job.status}`}>{job.status}</span></article>) : <p>{t('admin.console.noJobs')}</p>}</div></section>
    </div>
  </section>}</AdminRouteState>;
}
