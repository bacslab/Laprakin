import { useCallback, useState } from 'react';
import { ArrowLeft, KeyRound, ShieldAlert } from 'lucide-react';
import { Link, useLocation } from '../../../router';
import { ADMIN_AI_PATHS } from '../../../lib/admin-ai';
import { useApp } from '../../../state/ui-context';
import { AdminResource, ConfirmationDialog, PageIntro, StatusPill, useAdminAi, useAdminAiCopy, useAdminResource } from './shared';

export default function ProviderDetailModule({ providerId }) {
  const { client, affordances } = useAdminAi();
  const t = useAdminAiCopy();
  const { setNotice } = useApp();
  const location = useLocation();
  const revisionIdFromUrl = new URLSearchParams(location.search).get('revisionId') || '';
  const load = useCallback(() => client.provider(providerId, revisionIdFromUrl), [client, providerId, revisionIdFromUrl]);
  const resource = useAdminResource(load);
  const [credential, setCredential] = useState('');
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [dialog, setDialog] = useState('');
  const rotate = async (event) => {
    event.preventDefault(); setBusy(true); setFormError('');
    try {
      await client.rotateCredential(providerId, { revisionId: resource.data.revisionId, credential, reason: reason.trim(), confirmation: confirmation.trim() });
      setCredential(''); setReason(''); setConfirmation(''); setNotice(t('provider.draftSaved')); await resource.retry();
    } catch (error) { setFormError(error.message); }
    finally { setBusy(false); }
  };
  const confirmAction = async ({ reason: actionReason, confirmation: actionConfirmation }) => {
    setBusy(true);
    try {
      if (dialog === 'disable') await client.disableProvider(providerId, { revisionId: resource.data.revisionId, reason: actionReason, confirmation: actionConfirmation });
      if (dialog === 'delete-credential') await client.deleteCredential(providerId, { revisionId: resource.data.revisionId, reason: actionReason, confirmation: actionConfirmation });
      setDialog(''); setNotice(t('provider.changeSaved')); await resource.retry();
    } finally { setBusy(false); }
  };
  return <>
    <Link className="admin-ai-back" to={ADMIN_AI_PATHS.providers}><ArrowLeft size={14} /> {t('provider.back')}</Link>
    <PageIntro title={resource.data?.provider?.displayName || providerId} description={t('provider.description')} resource={resource} />
    <AdminResource resource={resource} label={t('provider.loadLabel')}>{(data) => {
      const provider = data.provider;
      return <div className="admin-ai-detail-grid">
        <section className="admin-ai-panel"><div className="admin-ai-panel-heading"><div><p>{t('providers.title')}</p><h2>{provider.displayName}</h2></div><StatusPill value={provider.state} /></div><dl className="admin-ai-definition-list"><div><dt>{t('provider.endpoint')}</dt><dd>{provider.baseUrl}</dd></div><div><dt>{t('provider.adapter')}</dt><dd>{provider.adapterType}</dd></div><div><dt>{t('provider.modelCount')}</dt><dd>{Number(provider.modelCount || 0).toLocaleString()}</dd></div><div><dt>{t('provider.routesUsing')}</dt><dd>{provider.routesUsing?.length ? provider.routesUsing.join(', ') : t('common.notAvailable')}</dd></div><div><dt>{t('provider.lastTested')}</dt><dd>{provider.lastTestedAt ? new Date(provider.lastTestedAt).toLocaleString() : t('common.notAvailable')}</dd></div><div><dt>{t('provider.lastSuccess')}</dt><dd>{provider.lastSuccessfulCall ? new Date(provider.lastSuccessfulCall).toLocaleString() : t('common.notAvailable')}</dd></div><div><dt>{t('provider.lastFailure')}</dt><dd>{provider.lastFailure ? `${provider.lastFailure.code} · ${new Date(provider.lastFailure.at).toLocaleString()}` : t('common.notAvailable')}</dd></div><div><dt>{t('providers.priority')}</dt><dd>{provider.priority}</dd></div><div><dt>{t('providers.timeout')}</dt><dd>{provider.requestTimeoutMs} ms</dd></div><div><dt>{t('provider.rateLimit')}</dt><dd>{t('provider.rateValue', { rpm: provider.rpmLimit, concurrency: provider.concurrencyLimit })}</dd></div><div><dt>{t('provider.retryCircuit')}</dt><dd>{t('provider.retryValue', { retry: provider.retryCount, failures: provider.circuitFailureThreshold })}</dd></div></dl>{affordances.manageProviders && <button className="admin-ai-danger-link" type="button" onClick={() => setDialog('disable')}><ShieldAlert size={14} /> {t('provider.disable')}</button>}</section>
        <section className="admin-ai-panel"><div className="admin-ai-panel-heading"><div><p>{t('provider.vault')}</p><h2>{t('provider.credential')}</h2></div><KeyRound size={17} /></div><div className="admin-ai-secret-status"><b>{provider.credential?.configured ? t('provider.stored', { lastFour: provider.credential.lastFour || '' }) : t('provider.notStored')}</b><span>{provider.credential?.configured ? t('provider.version', { version: provider.credential.version }) : t('provider.entryHint')}</span></div>{affordances.rotateCredentials && <form className="admin-ai-secret-form" onSubmit={rotate}><label>{t('provider.newCredential')}<input aria-label={t('provider.newCredential')} type="password" autoComplete="new-password" value={credential} onChange={(event) => setCredential(event.target.value)} required /></label><label>{t('provider.rotationReason')}<textarea aria-label={t('provider.rotationReason')} value={reason} onChange={(event) => setReason(event.target.value)} minLength="8" maxLength="500" required /></label><label>{t('common.typeToContinue', { expected: `ROTATE ${providerId}` })}<input aria-label={t('common.typeToContinue', { expected: `ROTATE ${providerId}` })} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" required /></label>{formError && <div className="admin-ai-inline-error" role="alert">{formError}</div>}<button className="admin-ai-primary-action" type="submit" disabled={busy || !credential || reason.trim().length < 8 || confirmation.trim() !== `ROTATE ${providerId}`}>{busy ? t('common.saving') : t('provider.rotate')}</button>{provider.credential?.configured && <button className="admin-ai-danger-link" type="button" onClick={() => setDialog('delete-credential')}>{t('provider.delete')}</button>}</form>}</section>
      </div>;
    }}</AdminResource>
    <ConfirmationDialog open={dialog === 'disable'} title={t('provider.disableTitle')} description={t('provider.disableDescription')} expected={`DISABLE ${providerId}`} confirmLabel={t('provider.disable')} busy={busy} onCancel={() => setDialog('')} onConfirm={confirmAction} />
    <ConfirmationDialog open={dialog === 'delete-credential'} title={t('provider.deleteTitle')} description={t('provider.deleteDescription')} expected={`DELETE CREDENTIAL ${providerId}`} confirmLabel={t('provider.delete')} busy={busy} onCancel={() => setDialog('')} onConfirm={confirmAction} />
  </>;
}
