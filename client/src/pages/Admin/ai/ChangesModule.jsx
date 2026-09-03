import { useCallback, useState } from 'react';
import { AlertOctagon, CheckCircle2, FlaskConical, History, Play, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate } from '../../../router';
import { ADMIN_AI_PATHS } from '../../../lib/admin-ai';
import { useApp } from '../../../state/ui-context';
import { AdminResource, ConfirmationDialog, EmptyState, PageIntro, StatusPill, useAdminAi, useAdminAiCopy, useAdminResource } from './shared';

function DiffList({ diff }) {
  const t = useAdminAiCopy();
  if (!diff) return null;
  return <div className="admin-ai-diff"><div><span>{t('changes.added')}</span><b>{diff.added?.length || 0}</b><small>{diff.added?.join(', ') || '—'}</small></div><div><span>{t('changes.changed')}</span><b>{diff.changed?.length || 0}</b><small>{diff.changed?.join(', ') || '—'}</small></div><div><span>{t('changes.removed')}</span><b>{diff.removed?.length || 0}</b><small>{diff.removed?.join(', ') || '—'}</small></div></div>;
}

export default function ChangesModule() {
  const { client, affordances } = useAdminAi();
  const t = useAdminAiCopy();
  const { setNotice } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const url = new URLSearchParams(location.search);
  const [filters, setFilters] = useState({ state: url.get('state') || '', cursor: url.get('cursor') || '' });
  const [applied, setApplied] = useState(filters);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState('');
  const [approverId, setApproverId] = useState('');
  const load = useCallback(() => client.changes(applied), [applied, client]);
  const resource = useAdminResource(load);
  const applyFilters = (event) => { event.preventDefault(); const next = { ...filters, cursor: '' }; setApplied(next); const query = new URLSearchParams(Object.entries(next).filter(([, value]) => value).map(([key, value]) => [key, value])); navigate(`${ADMIN_AI_PATHS.changes}${query.size ? `?${query}` : ''}`); };
  const runDraftAction = async (kind) => {
    setBusy(kind); setError('');
    try {
      const result = kind === 'canary' ? await client.canary(selected.id) : await client.testRevision(selected.id);
      setNotice(kind === 'canary' ? t('changes.canaryDone', { number: selected.revisionNumber }) : t('changes.testedDone', { number: selected.revisionNumber }));
      if (result.revision) setSelected(result.revision);
      await resource.retry();
    } catch (nextError) { setError(nextError.message); }
    finally { setBusy(''); }
  };
  const loadPreview = async () => {
    setBusy('preview'); setError('');
    try { const result = await client.preview(selected.id); setPreview(result.preview); }
    catch (nextError) { setError(nextError.message); }
    finally { setBusy(''); }
  };
  const confirmAction = async ({ reason, confirmation }) => {
    setBusy(dialog); setError('');
    try {
      if (dialog === 'activate') await client.activate(selected.id, { reason, confirmation, ...(preview?.productionProviderReplacement && approverId.trim() ? { approval: { approverUserId: approverId.trim() } } : {}) });
      if (dialog === 'rollback') await client.rollback({ targetRevisionId: selected?.id || undefined, reason, confirmation });
      if (dialog === 'emergency') await client.emergencyDisable({ reason, confirmation });
      setDialog(''); setSelected(null); setPreview(null); setApproverId(''); setNotice(t('changes.productionUpdated')); await resource.retry();
    } catch (nextError) { setError(nextError.message); throw nextError; }
    finally { setBusy(''); }
  };
  const pointers = resource.data?.pointers || {};
  return <>
    <PageIntro title={t('changes.title')} description={t('changes.description')} resource={resource} actions={affordances.manageRouting && <button className="admin-ai-emergency" type="button" onClick={() => setDialog('emergency')}><AlertOctagon size={14} /> {t('changes.emergency')}</button>} />
    <div className="admin-ai-pointers"><div><span>{t('changes.active')}</span><code>{pointers.activeRevisionId || '—'}</code></div><div><span>{t('changes.lastKnownGood')}</span><code>{pointers.lastKnownGoodRevisionId || '—'}</code></div></div>
    <form className="admin-ai-filterbar is-compact" onSubmit={applyFilters}><label><span>{t('changes.status')}</span><select aria-label={t('changes.status')} value={filters.state} onChange={(event) => setFilters((value) => ({ ...value, state: event.target.value }))}><option value="">{t('common.all')}</option><option value="draft">Draft</option><option value="tested">{t('changes.tested')}</option><option value="active">{t('changes.active')}</option><option value="superseded">{t('changes.superseded')}</option></select></label><button type="submit"><Search size={14} /> {t('common.apply')}</button></form>
    <AdminResource resource={resource} label={t('changes.loadLabel')}>{(data) => data.changes?.length ? <div className="admin-ai-change-layout"><div className="admin-ai-change-list">{data.changes.map((change) => <button type="button" className={selected?.id === change.id ? 'active' : ''} onClick={() => { setSelected(change); setPreview(null); setError(''); }} key={change.id}><History size={15} /><div><b>{t('changes.revisionNumber', { number: change.revisionNumber })}</b><span>{change.reason}</span><small>{new Date(change.createdAt).toLocaleString()} · {change.id}</small></div><StatusPill value={change.state} /></button>)}</div>{selected && <aside className="admin-ai-change-detail"><div className="admin-ai-panel-heading"><div><p>{t('changes.revisionNumber', { number: selected.revisionNumber })}</p><h2>{t('changes.impact')}</h2></div><StatusPill value={selected.state} /></div><dl className="admin-ai-definition-list"><div><dt>{t('common.revision')}</dt><dd><code>{selected.id}</code></dd></div><div><dt>{t('changes.parent')}</dt><dd><code>{selected.parentRevisionId || '—'}</code></dd></div><div><dt>{t('changes.created')}</dt><dd>{new Date(selected.createdAt).toLocaleString()}</dd></div><div><dt>{t('changes.scope')}</dt><dd>{t('changes.scopeValue', { providers: selected.providers?.length || 0, models: selected.models?.length || 0, routes: selected.routes?.length || 0 })}</dd></div>{selected.testEvidence?.expiresAt && <div><dt>{t('changes.evidence')}</dt><dd>{t('changes.validUntil', { time: new Date(selected.testEvidence.expiresAt).toLocaleString() })}</dd></div>}</dl><DiffList diff={preview?.routeDiff || selected.testEvidence?.routeDiff} />{error && <div className="admin-ai-inline-error" role="alert">{error}</div>}<div className="admin-ai-change-actions">{selected.state === 'draft' && affordances.viewHealth && <button type="button" onClick={() => runDraftAction('canary')} disabled={Boolean(busy)}><FlaskConical size={14} /> {busy === 'canary' ? t('health.running') : t('changes.canary')}</button>}{selected.state === 'draft' && affordances.manageProviders && <button className="admin-ai-primary-action" type="button" onClick={() => runDraftAction('test')} disabled={Boolean(busy)}><Play size={14} /> {busy === 'test' ? t('changes.testing') : t('changes.test')}</button>}{selected.state === 'tested' && <button type="button" onClick={loadPreview} disabled={Boolean(busy)}><ShieldCheck size={14} /> {busy === 'preview' ? t('changes.loading') : t('changes.preview')}</button>}{selected.state === 'tested' && preview && affordances.manageRouting && <button className="admin-ai-primary-action" type="button" onClick={() => setDialog('activate')}><CheckCircle2 size={14} /> {t('changes.activate')}</button>}{selected.state === 'superseded' && affordances.manageRouting && <button type="button" onClick={() => setDialog('rollback')}><RotateCcw size={14} /> {t('changes.rollback')}</button>}</div>{preview && <div className="admin-ai-preview" role="status"><b>{t('changes.previewReady')}</b><span>{t('changes.evidenceUntil', { time: new Date(preview.evidenceExpiresAt).toLocaleString() })}</span>{preview.productionProviderReplacement && <strong>{t('changes.approvalRequired')}</strong>}</div>}</aside>}</div> : <EmptyState title={t('changes.emptyTitle')} description={t('changes.emptyDescription')} />}</AdminResource>
    {resource.data?.nextCursor && <div className="admin-ai-pagination"><button type="button" onClick={() => { const next = { ...applied, cursor: resource.data.nextCursor }; setFilters(next); setApplied(next); }}>{t('common.next')}</button></div>}
    <ConfirmationDialog open={dialog === 'activate'} title={t('changes.activateTitle', { number: selected?.revisionNumber })} description={t('changes.activateDescription')} expected={`ACTIVATE ${selected?.id || ''}`} confirmLabel={t('changes.activateConfirm')} busy={busy === 'activate'} onCancel={() => setDialog('')} onConfirm={confirmAction} extra={preview?.productionProviderReplacement ? <label>{t('changes.approver')}<input aria-label={t('changes.approver')} value={approverId} onChange={(event) => setApproverId(event.target.value)} required /></label> : null} />
    <ConfirmationDialog open={dialog === 'rollback'} title={t('changes.rollbackTitle', { number: selected?.revisionNumber })} description={t('changes.rollbackDescription')} expected="ROLLBACK AI" confirmLabel={t('changes.rollbackConfirm')} busy={busy === 'rollback'} onCancel={() => setDialog('')} onConfirm={confirmAction} />
    <ConfirmationDialog open={dialog === 'emergency'} title={t('changes.emergencyTitle')} description={t('changes.emergencyDescription')} expected="DISABLE AI" confirmLabel={t('changes.disableAi')} busy={busy === 'emergency'} onCancel={() => setDialog('')} onConfirm={confirmAction} />
  </>;
}
