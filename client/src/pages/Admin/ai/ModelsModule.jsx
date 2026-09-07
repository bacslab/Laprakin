import { useCallback, useState } from 'react';
import { Eye, FlaskConical, Plus, Power } from '../../../icons';
import CustomSelect from '../../../components/CustomSelect';
import { useLocation, useNavigate } from '../../../router';
import { ADMIN_AI_PATHS } from '../../../lib/admin-ai';
import { AdminAiPagination, AdminResource, ConfirmationDialog, EmptyState, PageIntro, StatusPill, useAdminAi, useAdminAiCopy, useAdminResource } from './shared';

const INITIAL_MODEL = { providerId: '', modelId: '', enabled: true, state: 'available', capabilities: { vision: false, reasoning: false, structuredOutput: false, tools: false }, contextWindow: 0, maxOutputTokens: 0, costMetadata: { currency: 'USD' } };

export default function ModelsModule() {
  const { client, affordances } = useAdminAi();
  const t = useAdminAiCopy();
  const location = useLocation();
  const navigate = useNavigate();
  const url = new URLSearchParams(location.search);
  const [filters, setFilters] = useState({ state: url.get('state') || '', revisionId: url.get('revisionId') || '', cursor: url.get('cursor') || '' });
  const [applied, setApplied] = useState(filters);
  const [model, setModel] = useState(INITIAL_MODEL);
  const [reason, setReason] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [dialog, setDialog] = useState(null);
  const [discoveryProviderId, setDiscoveryProviderId] = useState('');
  const load = useCallback(() => client.models(applied), [applied, client]);
  const resource = useAdminResource(load);
  const updateLocation = (next) => {
    const query = new URLSearchParams(Object.entries(next).filter(([, value]) => value !== '').map(([key, value]) => [key, value]));
    navigate(`${ADMIN_AI_PATHS.models}${query.size ? `?${query}` : ''}`);
  };
  const followRevision = (result) => {
    const next = { ...applied, revisionId: result.revision.id, cursor: '' };
    setFilters(next); setApplied(next); updateLocation(next);
  };
  const applyFilters = (event) => { event.preventDefault(); const next = { ...filters, cursor: '' }; setApplied(next); updateLocation(next); };
  const previousPage = () => { const current = Number.parseInt(applied.cursor || '0', 10) || 0; const next = { ...applied, cursor: String(Math.max(0, current - 25)) }; setFilters(next); setApplied(next); updateLocation(next); };
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const result = await client.createModel({ revisionId: resource.data.revisionId, reason: reason.trim(), model: { ...model, contextWindow: Number(model.contextWindow), maxOutputTokens: Number(model.maxOutputTokens) } });
      setModel(INITIAL_MODEL); setReason(''); setShowCreate(false); followRevision(result);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  const discover = async () => {
    setBusy(true); setMessage('');
    try { const result = await client.discoverModels({ revisionId: resource.data.revisionId, providerId: discoveryProviderId.trim(), reason: reason.trim() }); setMessage(t('models.discoverySaved')); followRevision(result); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  const confirmModelAction = async ({ reason: actionReason, confirmation }) => {
    setBusy(true);
    try {
      const { item, kind } = dialog;
      const result = kind === 'test'
        ? await client.testModel(item.providerId, item.modelId, { revisionId: resource.data.revisionId, reason: actionReason, confirmation })
        : await client.updateModel(item.providerId, item.modelId, {
          revisionId: resource.data.revisionId,
          reason: actionReason,
          confirmation,
          model: item.enabled === false ? { enabled: true, state: 'available' } : { enabled: false, state: 'disabled' },
        });
      setDialog(null); setMessage(kind === 'test' ? t('models.testSaved') : t('models.stateSaved')); followRevision(result);
    } finally { setBusy(false); }
  };
  const actionExpected = dialog?.kind === 'test'
    ? `TEST MODEL ${dialog.item.providerId}:${dialog.item.modelId}`
    : dialog?.item?.enabled === false
      ? `ENABLE MODEL ${dialog.item.providerId}:${dialog.item.modelId}`
      : `DISABLE MODEL ${dialog?.item?.providerId}:${dialog?.item?.modelId}`;
  return <>
    <PageIntro title={t('models.title')} description={t('models.description')} resource={resource} actions={affordances.manageModels && <button className="admin-ai-primary-action" type="button" onClick={() => setShowCreate((value) => !value)}><Plus size={15} /> {t('models.add')}</button>} />
    {showCreate && <form className="admin-ai-editor" onSubmit={save}><div className="admin-ai-editor-heading"><div><p>{t('models.registry')}</p><h2>{t('models.addTitle')}</h2></div><StatusPill value="draft" /></div><div className="admin-ai-form-grid"><label>{t('providers.providerId')}<input aria-label={t('providers.providerId')} value={model.providerId} onChange={(event) => setModel((value) => ({ ...value, providerId: event.target.value }))} required /></label><label>{t('models.modelId')}<input aria-label={t('models.modelId')} value={model.modelId} onChange={(event) => setModel((value) => ({ ...value, modelId: event.target.value }))} required /></label><label>{t('models.context')}<input aria-label={t('models.context')} type="number" min="0" value={model.contextWindow} onChange={(event) => setModel((value) => ({ ...value, contextWindow: event.target.value }))} /></label><label>{t('models.output')}<input aria-label={t('models.output')} type="number" min="0" value={model.maxOutputTokens} onChange={(event) => setModel((value) => ({ ...value, maxOutputTokens: event.target.value }))} /></label></div><fieldset className="admin-ai-check-grid"><legend>{t('models.claimed')}</legend>{Object.keys(model.capabilities).map((key) => <label key={key}><input aria-label={t(`models.capabilities.${key}`)} type="checkbox" checked={model.capabilities[key]} onChange={(event) => setModel((value) => ({ ...value, capabilities: { ...value.capabilities, [key]: event.target.checked } }))} /> {t(`models.capabilities.${key}`)}</label>)}</fieldset><p className="admin-ai-form-hint">{t('models.claimedWarning')}</p><label>{t('common.reason')}<textarea aria-label={t('common.reason')} value={reason} onChange={(event) => setReason(event.target.value)} minLength="8" maxLength="500" required /></label>{message && <div className="admin-ai-inline-error" role="alert">{message}</div>}<div className="admin-ai-form-actions"><button type="button" onClick={() => setShowCreate(false)}>{t('common.cancel')}</button><button className="admin-ai-primary-action" type="submit" disabled={busy || reason.trim().length < 8}>{t('providers.saveDraft')}</button></div></form>}
    <form className="admin-ai-filterbar is-compact" onSubmit={applyFilters}><label><span>{t('providers.status')}</span><CustomSelect ariaLabel={t('providers.status')} value={filters.state} onChange={(state) => setFilters((value) => ({ ...value, state }))} options={[{ value: '', label: t('common.all') }, { value: 'available', label: t('models.available') }, { value: 'unavailable', label: t('models.unavailable') }, { value: 'disabled', label: t('providers.disabled') }, { value: 'archived', label: t('models.archived') }]} /></label><button type="submit">{t('common.apply')}</button></form>
    {affordances.manageModels && <div className="admin-ai-discovery"><div><b>{t('models.discovery')}</b><span>{t('models.discoveryDescription')}</span></div><label>{t('models.provider')}<input aria-label={t('models.provider')} value={discoveryProviderId} onChange={(event) => setDiscoveryProviderId(event.target.value)} placeholder={t('providers.providerId')} /></label><label>{t('models.discoveryReason')}<input aria-label={t('models.discoveryReason')} value={reason} onChange={(event) => setReason(event.target.value)} minLength="8" /></label><button type="button" onClick={discover} disabled={busy || !discoveryProviderId.trim() || reason.trim().length < 8}>{t('models.runDiscovery')}</button></div>}
    {message && !showCreate && <div className="admin-ai-success" role="status">{message}</div>}
    <AdminResource resource={resource} label={t('models.loadLabel')}>{(data) => data.models?.length ? <div className="admin-ai-table-wrap"><table className="admin-ai-table"><thead><tr><th>{t('models.add')}</th><th>{t('models.provider')}</th><th>{t('providers.status')}</th><th>{t('models.capability')}</th><th>{t('models.contextOutput')}</th><th>{t('models.health')}</th>{affordances.manageModels && <th>{t('models.actions')}</th>}</tr></thead><tbody>{data.models.map((item) => <tr key={`${item.providerId}:${item.modelId}`}><td><b>{item.modelId}</b><small>{item.source || t('models.registry')}</small></td><td><code>{item.providerId}</code></td><td><StatusPill value={item.state} /></td><td><div className="admin-ai-capabilities">{Object.entries(item.capabilities || {}).filter(([, enabled]) => enabled).map(([key]) => <span key={key} title={t('models.evidenceTitle', { evidence: t(`models.evidence.${item.capabilityEvidence?.[key] || 'unverified'}`) })}>{key === 'vision' && <Eye size={12} />}{t(`models.capabilities.${key}`)} · {t(`models.evidence.${item.capabilityEvidence?.[key] || 'unverified'}`)}</span>)}{!Object.values(item.capabilities || {}).some(Boolean) && <small>{t('models.textOnly')}</small>}</div></td><td>{Number(item.contextWindow || 0).toLocaleString()} / {Number(item.maxOutputTokens || 0).toLocaleString()}</td><td><StatusPill value={item.health || 'unknown'} /></td>{affordances.manageModels && <td><div className="admin-ai-row-actions"><button type="button" aria-label={t('models.testCapability')} onClick={() => setDialog({ kind: 'test', item })}><FlaskConical size={13} /> {t('models.testCapability')}</button><button type="button" aria-label={item.enabled === false ? t('models.enable') : t('models.disable')} onClick={() => setDialog({ kind: 'state', item })}><Power size={13} /> {item.enabled === false ? t('models.enable') : t('models.disable')}</button></div></td>}</tr>)}</tbody></table></div> : <EmptyState title={t('models.emptyTitle')} description={t('models.emptyDescription')} />}</AdminResource>
    <AdminAiPagination cursor={applied.cursor} nextCursor={resource.data?.nextCursor} onNext={() => { const next = { ...applied, cursor: resource.data.nextCursor }; setFilters(next); setApplied(next); updateLocation(next); }} onPrevious={previousPage} />
    <ConfirmationDialog open={Boolean(dialog)} title={dialog?.kind === 'test' ? t('models.testTitle') : dialog?.item?.enabled === false ? t('models.enableTitle') : t('models.disableTitle')} description={dialog?.kind === 'test' ? t('models.testDescription') : dialog?.item?.enabled === false ? t('models.enableDescription') : t('models.disableDescription')} expected={actionExpected} confirmLabel={dialog?.kind === 'test' ? t('models.testCapability') : dialog?.item?.enabled === false ? t('models.enable') : t('models.disable')} busy={busy} onCancel={() => setDialog(null)} onConfirm={confirmModelAction} />
  </>;
}
