import { useCallback, useState } from 'react';
import { Activity, FlaskConical, Gauge, Play, ShieldCheck } from 'lucide-react';
import { AdminResource, EmptyState, PageIntro, StatusPill, useAdminAi, useAdminAiCopy, useAdminResource } from './shared';

export default function HealthModule() {
  const { client, affordances } = useAdminAi();
  const t = useAdminAiCopy();
  const [days, setDays] = useState(7);
  const [revisionId, setRevisionId] = useState('');
  const [busy, setBusy] = useState('');
  const [actionResult, setActionResult] = useState(null);
  const [actionError, setActionError] = useState('');
  const load = useCallback(() => client.health(days), [client, days]);
  const resource = useAdminResource(load);
  const run = async (kind) => {
    setBusy(kind); setActionError(''); setActionResult(null);
    try {
      const result = kind === 'test' ? await client.testRevision(revisionId.trim()) : await client.canary(revisionId.trim());
      setActionResult({ kind, result }); await resource.retry();
    } catch (error) { setActionError(error.message); }
    finally { setBusy(''); }
  };
  return <>
    <PageIntro title={t('health.title')} description={t('health.description')} resource={resource} actions={<label className="admin-ai-days">{t('health.range')}<select aria-label={t('health.range')} value={days} onChange={(event) => setDays(Number(event.target.value))}><option value="1">{t('health.day')}</option><option value="7">{t('health.days7')}</option><option value="30">{t('health.days30')}</option><option value="90">{t('health.days90')}</option></select></label>} />
    <AdminResource resource={resource} label={t('health.loadLabel')}>{(data) => <>
      <div className="admin-ai-health-grid"><article><ShieldCheck size={17} /><span>{t('health.runtimeSource')}</span><b>{data.runtime?.source || 'unavailable'}</b><small>{data.runtime?.revisionId || t('health.noActive')}</small></article><article><Activity size={17} /><span>{t('health.textReadiness')}</span><b>{data.readiness?.textReady ? t('health.ready') : t('models.unavailable')}</b><StatusPill value={data.readiness?.textReady ? 'healthy' : 'unavailable'} /></article><article><FlaskConical size={17} /><span>{t('health.visionReadiness')}</span><b>{data.readiness?.visionReady ? t('health.ready') : t('models.unavailable')}</b><StatusPill value={data.readiness?.visionReady ? 'healthy' : 'unavailable'} /></article><article><Gauge size={17} /><span>{t('health.providerModel')}</span><b>{data.runtime?.providers?.length || 0} / {data.runtime?.models?.length || 0}</b><small>{data.runtime?.available ? t('health.runtimeReady') : data.runtime?.degradedReason || t('health.runtimeUnavailable')}</small></article></div>
      <section className="admin-ai-panel"><div className="admin-ai-panel-heading"><div><p>{t('health.telemetry')}</p><h2>{t('health.traffic')}</h2></div><span>{t('health.period', { days: data.days })}</span></div>{data.telemetry?.length ? <div className="admin-ai-table-wrap"><table className="admin-ai-table"><thead><tr><th>{t('health.route')}</th><th>{t('health.providerModel')}</th><th>{t('providers.status')}</th><th>{t('health.calls')}</th><th>{t('health.latency')}</th><th>{t('health.tokens')}</th><th>{t('health.fallbackQueue')}</th></tr></thead><tbody>{data.telemetry.map((row, index) => <tr key={`${row.configuration_revision}:${row.route_id}:${row.provider}:${row.model}:${row.status}:${index}`}><td><b>{row.route_id || t('common.unknown')}</b><small>{row.mode || 'default'}</small></td><td>{row.provider || t('common.notAvailable')}<small>{row.model || t('common.notAvailable')}</small></td><td><StatusPill value={row.status || row.circuit_state} /></td><td>{Number(row.calls || 0).toLocaleString()}</td><td>{Number(row.average_latency_ms || 0).toLocaleString()} ms</td><td>{Number(row.total_tokens || 0).toLocaleString()}</td><td>{Number(row.fallbacks || 0)} / {Number(row.maximum_queue_depth || 0)}</td></tr>)}</tbody></table></div> : <EmptyState title={t('health.noTelemetry')} description={t('health.noTelemetryDescription')} />}</section>
    </>}</AdminResource>
    {(affordances.manageProviders || affordances.viewHealth) && <section className="admin-ai-action-panel"><div><p>{t('health.validation')}</p><h2>{t('health.testTitle')}</h2><span>{t('health.synthetic')}</span></div><label>{t('common.revision')}<input aria-label={t('common.revision')} value={revisionId} onChange={(event) => setRevisionId(event.target.value)} placeholder="ai-config-…" /></label><div className="admin-ai-action-buttons">{affordances.viewHealth && <button type="button" onClick={() => run('canary')} disabled={!revisionId.trim() || Boolean(busy)}><FlaskConical size={14} /> {busy === 'canary' ? t('health.running') : t('health.runCanary')}</button>}{affordances.manageProviders && <button className="admin-ai-primary-action" type="button" onClick={() => run('test')} disabled={!revisionId.trim() || Boolean(busy)}><Play size={14} /> {busy === 'test' ? t('health.testing') : t('health.testRevision')}</button>}</div>{actionError && <div className="admin-ai-inline-error" role="alert">{actionError}</div>}{actionResult && <div className="admin-ai-success" role="status"><ShieldCheck size={15} /><span>{actionResult.kind === 'test' ? t('health.tested', { id: actionResult.result.revision?.id }) : t('health.canaryDone', { count: actionResult.result.results?.length || 0 })}</span></div>}</section>}
  </>;
}
