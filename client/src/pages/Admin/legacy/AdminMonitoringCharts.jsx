import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, Gauge, SlidersHorizontal, Sparkles } from 'lucide-react';

const FILTER_OPTIONS = [
  ['provider', 'provider'],
  ['model', 'model'],
  ['route', 'route'],
  ['status', 'status'],
];

function number(value, locale) {
  return Number(value || 0).toLocaleString(locale);
}

function shortDate(value) {
  const date = String(value || '');
  return date.length > 10 ? date.slice(5, 10) : date;
}

export default function AdminMonitoringCharts({ data, filters, onFilterChange, t, language }) {
  const usage = data || {};
  const rows = usage.daily || [];
  const options = usage.options || {};
  const locale = language === 'en' ? 'en-US' : 'id-ID';
  const totals = usage.totals || {};
  const breakdown = usage.breakdown || [];
  const successRate = totals.calls ? Math.round((Number(totals.successful || 0) / Number(totals.calls)) * 100) : 0;
  const selectLabel = (key) => t(`admin.console.monitoring.${key}`);
  const topModels = breakdown.slice(0, 6);

  return <section className="admin-monitoring-analytics" aria-labelledby="admin-monitoring-analytics-title">
    <div className="admin-monitoring-toolbar">
      <div><span className="admin-monitoring-section-kicker"><Sparkles size={14} /> {t('admin.console.monitoring.summary')}</span><h3 id="admin-monitoring-analytics-title">Traffic dan keandalan</h3><p>{t('admin.console.monitoring.period', { days: usage.days || filters.days })}</p></div>
      <div className="admin-monitoring-toolbar-summary"><span><b>{number(totals.calls, locale)}</b><small>{t('admin.console.monitoring.calls')}</small></span><span><b>{successRate}%</b><small>{t('admin.console.monitoring.successRate')}</small></span><span><b>{number(totals.average_latency_ms, locale)} ms</b><small>{t('admin.console.monitoring.avgLatency')}</small></span><span><b>{number(totals.failed, locale)}</b><small>{t('admin.console.monitoring.errors')}</small></span></div>
    </div>
    <form className="admin-monitoring-filters" onSubmit={(event) => event.preventDefault()} aria-label={t('admin.console.monitoring.filters')}>
      <div className="admin-monitoring-filters-title"><SlidersHorizontal size={16} /><span>Filter telemetry</span></div>
      <label>{t('admin.console.monitoring.periodLabel')}<select value={filters.days} onChange={(event) => onFilterChange('days', event.target.value)}><option value="1">{t('admin.console.monitoring.day')}</option><option value="7">{t('admin.console.monitoring.days7')}</option><option value="30">{t('admin.console.monitoring.days30')}</option><option value="90">{t('admin.console.monitoring.days90')}</option></select></label>
      {FILTER_OPTIONS.map(([key, optionKey]) => <label key={key}>{selectLabel(optionKey)}<select value={filters[key]} onChange={(event) => onFilterChange(key, event.target.value)}><option value="">{t('admin.console.monitoring.all')}</option>{(options[`${key}s`] || (key === 'status' ? options.statuses : []) || []).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>)}
    </form>
    <div className="admin-monitoring-chart-grid">
      <section className="admin-monitoring-chart-panel"><header><div><span>{t('admin.console.monitoring.traffic')}</span><h4>Success dan error</h4></div><Activity size={17} /></header><div className="admin-chart" role="img" aria-label={t('admin.console.monitoring.trafficChart')}>{rows.length ? <ResponsiveContainer width="100%" height={286}><AreaChart data={rows} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}><defs><linearGradient id="admin-success-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--admin-chart-positive)" stopOpacity={0.3}/><stop offset="95%" stopColor="var(--admin-chart-positive)" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="4 4" stroke="var(--admin-line)"/><XAxis dataKey="day" tickFormatter={shortDate} stroke="var(--admin-muted)" fontSize={11}/><YAxis allowDecimals={false} stroke="var(--admin-muted)" fontSize={11}/><Tooltip contentStyle={{ border: '1px solid var(--admin-line)', borderRadius: 10, background: 'var(--admin-card)', color: 'var(--admin-text)' }}/><Legend/><Area type="monotone" dataKey="successful" name={t('admin.console.monitoring.successful')} stroke="var(--admin-chart-positive)" fill="url(#admin-success-fill)" strokeWidth={2.5}/><Area type="monotone" dataKey="errors" name={t('admin.console.monitoring.errors')} stroke="var(--admin-chart-negative)" fill="transparent" strokeWidth={2.5}/></AreaChart></ResponsiveContainer> : <div className="admin-chart-empty"><Activity size={22} /><b>{t('admin.console.monitoring.noData')}</b><span>Metadata muncul setelah route menerima traffic.</span></div>}</div></section>
      <section className="admin-monitoring-chart-panel"><header><div><span>{t('admin.console.monitoring.performance')}</span><h4>Latency dan token</h4></div><Gauge size={17} /></header><div className="admin-chart" role="img" aria-label={t('admin.console.monitoring.performanceChart')}>{rows.length ? <ResponsiveContainer width="100%" height={286}><LineChart data={rows} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}><CartesianGrid strokeDasharray="4 4" stroke="var(--admin-line)"/><XAxis dataKey="day" tickFormatter={shortDate} stroke="var(--admin-muted)" fontSize={11}/><YAxis yAxisId="latency" stroke="var(--admin-muted)" fontSize={11}/><YAxis yAxisId="tokens" orientation="right" stroke="var(--admin-muted)" fontSize={11}/><Tooltip contentStyle={{ border: '1px solid var(--admin-line)', borderRadius: 10, background: 'var(--admin-card)', color: 'var(--admin-text)' }}/><Legend/><Line yAxisId="latency" type="monotone" dataKey="average_latency_ms" name={t('admin.console.monitoring.latencyMs')} stroke="var(--admin-chart-blue)" strokeWidth={2.5} dot={false}/><Line yAxisId="tokens" type="monotone" dataKey="total_tokens" name={t('admin.console.monitoring.tokens')} stroke="var(--admin-chart-violet)" strokeWidth={2.5} dot={false}/></LineChart></ResponsiveContainer> : <div className="admin-chart-empty"><Gauge size={22} /><b>{t('admin.console.monitoring.noData')}</b><span>Latency dan token akan muncul di sini.</span></div>}</div></section>
    </div>
    <section className="admin-monitoring-table admin-monitoring-breakdown"><div className="admin-monitoring-section-head"><div><span>MODEL RUNTIME</span><h3>Distribusi traffic</h3></div><small>{breakdown.length} kombinasi provider/model</small></div>{topModels.length ? <div className="admin-monitoring-table-scroll"><table><thead><tr><th>Provider / model</th><th>Status</th><th>Call</th><th>Latency</th><th>Token</th></tr></thead><tbody>{topModels.map((row, index) => <tr key={`${row.provider}-${row.model}-${row.route_id}-${row.status}-${index}`}><td><b>{row.model || 'Unknown model'}</b><small>{row.provider || 'Unknown provider'} · {row.route_id || 'default'}</small></td><td><span className={`admin-monitoring-status-pill is-${row.status}`}>{row.status}</span></td><td>{number(row.calls, locale)}</td><td>{number(row.average_latency_ms, locale)} ms</td><td>{number(row.total_tokens, locale)}</td></tr>)}</tbody></table></div> : <p className="admin-monitoring-muted">Belum ada breakdown telemetry.</p>}</section>
  </section>;
}
