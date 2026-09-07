import { useCallback, useState } from 'react';
import { KeyRound, Plus, ServerCog } from 'lucide-react';
import CustomSelect from '../../../components/CustomSelect';
import { Link, useLocation, useNavigate } from '../../../router';
import { ADMIN_AI_PATHS } from '../../../lib/admin-ai';
import { AdminAiPagination, AdminResource, EmptyState, PageIntro, StatusPill, useAdminAi, useAdminAiCopy, useAdminResource } from './shared';

const INITIAL_PROVIDER = { providerId: '', displayName: '', adapterType: 'openai-compatible', baseUrl: '', enabled: true, priority: 100, requestTimeoutMs: 45000, rpmLimit: 8, concurrencyLimit: 2, retryCount: 2, circuitFailureThreshold: 4, circuitCooldownMs: 30000 };

export default function ProvidersModule() {
  const { client, affordances } = useAdminAi();
  const t = useAdminAiCopy();
  const location = useLocation();
  const navigate = useNavigate();
  const url = new URLSearchParams(location.search);
  const [filters, setFilters] = useState({ state: url.get('state') || '', cursor: url.get('cursor') || '', limit: 25 });
  const [applied, setApplied] = useState(filters);
  const [showCreate, setShowCreate] = useState(false);
  const [provider, setProvider] = useState(INITIAL_PROVIDER);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const load = useCallback(() => client.providers(applied), [applied, client]);
  const resource = useAdminResource(load);
  const applyFilters = (event) => {
    event.preventDefault();
    const next = { ...filters, cursor: '' };
    const query = new URLSearchParams(Object.entries(next).filter(([, value]) => value !== '' && value !== null).map(([key, value]) => [key, String(value)]));
    setApplied(next);
    navigate(`${ADMIN_AI_PATHS.providers}?${query}`);
  };
  const nextPage = () => {
    const next = { ...applied, cursor: resource.data?.nextCursor || '' };
    setFilters(next); setApplied(next);
    const query = new URLSearchParams(Object.entries(next).filter(([, value]) => value !== '').map(([key, value]) => [key, String(value)]));
    navigate(`${ADMIN_AI_PATHS.providers}?${query}`);
  };
  const previousPage = () => {
    const current = Number.parseInt(applied.cursor || '0', 10) || 0;
    const next = { ...applied, cursor: String(Math.max(0, current - Number(applied.limit || 25))) };
    setFilters(next); setApplied(next);
    const query = new URLSearchParams(Object.entries(next).filter(([, value]) => value !== '').map(([key, value]) => [key, String(value)]));
    navigate(`${ADMIN_AI_PATHS.providers}?${query}`);
  };
  const createProvider = async (event) => {
    event.preventDefault();
    setSaving(true); setFormError('');
    try {
      const createdProviderId = provider.providerId;
      const result = await client.createProvider({ reason: reason.trim(), provider: { ...provider, priority: Number(provider.priority), requestTimeoutMs: Number(provider.requestTimeoutMs), rpmLimit: Number(provider.rpmLimit), concurrencyLimit: Number(provider.concurrencyLimit), retryCount: Number(provider.retryCount), circuitFailureThreshold: Number(provider.circuitFailureThreshold), circuitCooldownMs: Number(provider.circuitCooldownMs) } });
      setProvider(INITIAL_PROVIDER); setReason(''); setShowCreate(false);
      navigate(`${ADMIN_AI_PATHS.providers}/${encodeURIComponent(createdProviderId)}?revisionId=${encodeURIComponent(result.revision.id)}`);
    } catch (error) { setFormError(error.message); }
    finally { setSaving(false); }
  };
  return <>
    <PageIntro title={t('providers.title')} description={t('providers.description')} resource={resource} actions={affordances.manageProviders && <button className="admin-ai-primary-action" type="button" onClick={() => setShowCreate((value) => !value)}><Plus size={15} /> {t('providers.add')}</button>} />
    {showCreate && <form className="admin-ai-editor" onSubmit={createProvider}>
      <div className="admin-ai-editor-heading"><div><p>{t('common.draft')}</p><h2>{t('providers.addTitle')}</h2></div><StatusPill value="draft" /></div>
      <div className="admin-ai-form-grid">
        <label>{t('providers.providerId')}<input aria-label={t('providers.providerId')} value={provider.providerId} onChange={(event) => setProvider((value) => ({ ...value, providerId: event.target.value }))} pattern="[a-z0-9][a-z0-9._-]{0,63}" required /></label>
        <label>{t('providers.displayName')}<input aria-label={t('providers.displayName')} value={provider.displayName} onChange={(event) => setProvider((value) => ({ ...value, displayName: event.target.value }))} required /></label>
        <label className="is-wide">{t('providers.baseUrl')}<input aria-label={t('providers.baseUrl')} type="url" value={provider.baseUrl} onChange={(event) => setProvider((value) => ({ ...value, baseUrl: event.target.value }))} placeholder="https://api.provider.example/v1" required /></label>
        <label>{t('providers.priority')}<input aria-label={t('providers.priority')} type="number" min="0" max="10000" value={provider.priority} onChange={(event) => setProvider((value) => ({ ...value, priority: event.target.value }))} /></label>
        <label>{t('providers.timeout')}<input aria-label={t('providers.timeout')} type="number" min="1000" max="120000" value={provider.requestTimeoutMs} onChange={(event) => setProvider((value) => ({ ...value, requestTimeoutMs: event.target.value }))} /></label>
        <label>{t('providers.rpm')}<input aria-label={t('providers.rpm')} type="number" min="1" value={provider.rpmLimit} onChange={(event) => setProvider((value) => ({ ...value, rpmLimit: event.target.value }))} /></label>
        <label>{t('providers.concurrency')}<input aria-label={t('providers.concurrency')} type="number" min="1" value={provider.concurrencyLimit} onChange={(event) => setProvider((value) => ({ ...value, concurrencyLimit: event.target.value }))} /></label>
      </div>
      <label>{t('common.reason')}<textarea aria-label={t('common.reason')} value={reason} onChange={(event) => setReason(event.target.value)} minLength="8" maxLength="500" required /></label>
      {formError && <div className="admin-ai-inline-error" role="alert">{formError}</div>}
      <div className="admin-ai-form-actions"><button type="button" onClick={() => setShowCreate(false)}>{t('common.cancel')}</button><button className="admin-ai-primary-action" type="submit" disabled={saving || reason.trim().length < 8}>{saving ? t('common.saving') : t('providers.saveDraft')}</button></div>
    </form>}
    <form className="admin-ai-filterbar" onSubmit={applyFilters}>
      <label><span>{t('providers.status')}</span><CustomSelect ariaLabel={t('providers.status')} value={filters.state} onChange={(state) => setFilters((value) => ({ ...value, state }))} options={[{ value: '', label: t('common.all') }, { value: 'active', label: t('providers.active') }, { value: 'draft', label: t('common.status.draft') }, { value: 'disabled', label: t('providers.disabled') }]} /></label>
      <button type="submit">{t('common.apply')}</button>
    </form>
    <AdminResource resource={resource} label={t('providers.loadLabel')}>{(data) => data.providers?.length ? <div className="admin-ai-card-list">{data.providers.map((item) => <Link className="admin-ai-card" to={`${ADMIN_AI_PATHS.providers}/${encodeURIComponent(item.providerId)}${data.revisionId ? `?revisionId=${encodeURIComponent(data.revisionId)}` : ''}`} key={item.providerId}><div className="admin-ai-card-icon"><ServerCog size={17} /></div><div className="admin-ai-card-copy"><div><b>{item.displayName}</b><code>{item.providerId}</code></div><span>{item.baseUrl}</span><small><KeyRound size={12} /> {item.credential?.configured ? t('providers.credentialConfigured', { lastFour: item.credential.lastFour || '' }) : t('providers.credentialMissing')}</small><small>{t('providers.operationalSummary', { models: item.modelCount || 0, routes: item.routesUsing?.length || 0 })}</small></div><div className="admin-ai-card-aside"><StatusPill value={item.state || (item.enabled ? 'active' : 'disabled')} /><span>{t('providers.priorityValue', { priority: item.priority })}</span><span>{item.lastSuccessfulCall ? t('providers.lastSuccessAt', { time: new Date(item.lastSuccessfulCall).toLocaleString() }) : t('providers.noSuccess')}</span></div></Link>)}</div> : <EmptyState title={t('providers.emptyTitle')} description={t('providers.emptyDescription')} />}</AdminResource>
    <AdminAiPagination cursor={applied.cursor} nextCursor={resource.data?.nextCursor} onNext={nextPage} onPrevious={previousPage} limit={Number(applied.limit || 25)} />
  </>;
}
