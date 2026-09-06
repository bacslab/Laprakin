import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, Gauge, Sparkles } from 'lucide-react';

const FILTER_OPTIONS = [
  ['provider', 'provider'],
  ['model', 'model'],
  ['route', 'route'],
  ['status', 'status'],
];

function number(value, locale) {
  return Number(value || 0).toLocaleString(locale);
}

export default function AdminMonitoringCharts({ data, filters, onFilterChange, t, language }) {
  const usage = data || {};
  const rows = usage.daily || [];
  const options = usage.options || {};
  const locale = language === 'en' ? 'en-US' : 'id-ID';
  const totals = usage.totals || {};
  const successRate = totals.calls ? Math.round((Number(totals.successful || 0) / Number(totals.calls)) * 100) : 0;
  const selectLabel = (key) => t(`admin.console.monitoring.${key}`);
  return <section className="admin-monitoring" aria-labelledby="admin-monitoring-title">
    <div className="admin-panel-head admin-monitoring-head">
      <div><h2 id="admin-monitoring-title">{t('admin.console.monitoring.title')}</h2><small>{t('admin.console.monitoring.description')}</small></div>
      <span className="admin-monitoring-status"><Activity size={13} /> {t('admin.console.monitoring.period', { days: usage.days || filters.days })}</span>
    </div>
    <div className="admin-monitoring-filters" role="group" aria-label={t('admin.console.monitoring.filters')}>
      <label>{t('admin.console.monitoring.periodLabel')}<select value={filters.days} onChange={(event) => onFilterChange('days', event.target.value)}><option value="1">{t('admin.console.monitoring.day')}</option><option value="7">{t('admin.console.monitoring.days7')}</option><option value="30">{t('admin.console.monitoring.days30')}</option><option value="90">{t('admin.console.monitoring.days90')}</option></select></label>
      {FILTER_OPTIONS.map(([key, optionKey]) => <label key={key}>{selectLabel(optionKey)}<select value={filters[key]} onChange={(event) => onFilterChange(key, event.target.value)}><option value="">{t('admin.console.monitoring.all')}</option>{(options[`${key}s`] || (key === 'status' ? options.statuses : []) || []).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>)}
    </div>
    <div className="admin-monitoring-summary" aria-label={t('admin.console.monitoring.summary')}>
      <span><Sparkles size={14} /><b>{number(totals.calls, locale)}</b><small>{t('admin.console.monitoring.calls')}</small></span>
      <span><Gauge size={14} /><b>{successRate}%</b><small>{t('admin.console.monitoring.successRate')}</small></span>
      <span><Activity size={14} /><b>{number(totals.average_latency_ms, locale)} ms</b><small>{t('admin.console.monitoring.avgLatency')}</small></span>
      <span><AlertTriangle size={14} /><b>{number(totals.failed, locale)}</b><small>{t('admin.console.monitoring.errors')}</small></span>
    </div>
    <div className="admin-monitoring-chart-grid">
      <section className="admin-monitoring-chart-panel"><div className="admin-panel-head"><h3>{t('admin.console.monitoring.traffic')}</h3><small>{t('admin.console.monitoring.callsAndErrors')}</small></div><div className="admin-chart" role="img" aria-label={t('admin.console.monitoring.trafficChart')}>
        {rows.length ? <ResponsiveContainer width="100%" height={238}><AreaChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="admin-success-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#b7f34a" stopOpacity={0.35}/><stop offset="95%" stopColor="#b7f34a" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="var(--admin-line)"/><XAxis dataKey="day" tickFormatter={(value) => String(value).slice(5)} stroke="var(--admin-muted)" fontSize={10}/><YAxis allowDecimals={false} stroke="var(--admin-muted)" fontSize={10}/><Tooltip contentStyle={{ border: '1px solid var(--admin-line)', borderRadius: 8, background: 'var(--admin-card)', color: 'var(--admin-text)' }}/><Legend/><Area type="monotone" dataKey="successful" name={t('admin.console.monitoring.successful')} stroke="#b7f34a" fill="url(#admin-success-fill)" strokeWidth={2}/><Area type="monotone" dataKey="errors" name={t('admin.console.monitoring.errors')} stroke="#ff8b6a" fill="transparent" strokeWidth={2}/></AreaChart></ResponsiveContainer> : <p className="admin-chart-empty">{t('admin.console.monitoring.noData')}</p>}
      </div></section>
      <section className="admin-monitoring-chart-panel"><div className="admin-panel-head"><h3>{t('admin.console.monitoring.performance')}</h3><small>{t('admin.console.monitoring.latencyAndTokens')}</small></div><div className="admin-chart" role="img" aria-label={t('admin.console.monitoring.performanceChart')}>
        {rows.length ? <ResponsiveContainer width="100%" height={238}><LineChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--admin-line)"/><XAxis dataKey="day" tickFormatter={(value) => String(value).slice(5)} stroke="var(--admin-muted)" fontSize={10}/><YAxis yAxisId="latency" stroke="var(--admin-muted)" fontSize={10}/><YAxis yAxisId="tokens" orientation="right" stroke="var(--admin-muted)" fontSize={10}/><Tooltip contentStyle={{ border: '1px solid var(--admin-line)', borderRadius: 8, background: 'var(--admin-card)', color: 'var(--admin-text)' }}/><Legend/><Line yAxisId="latency" type="monotone" dataKey="average_latency_ms" name={t('admin.console.monitoring.latencyMs')} stroke="#8db8ff" strokeWidth={2} dot={false}/><Line yAxisId="tokens" type="monotone" dataKey="total_tokens" name={t('admin.console.monitoring.tokens')} stroke="#e3a7ff" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer> : <p className="admin-chart-empty">{t('admin.console.monitoring.noData')}</p>}
      </div></section>
    </div>
  </section>;
}
