import { useCallback, useState } from 'react';
import { api } from '../../../api';
import { useI18n } from '../../../i18n/context';
import { AdminIntegrationsPanel } from '../AdminLegacyContentPanels';
import { AdminRouteState, useAdminRouteResource } from './shared';

export default function IntegrationsRoute({ setNotice }) {
  const { t } = useI18n();
  const [integrationStatus, setIntegrationStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api('/admin/ai/usage?days=30'), []);
  const resource = useAdminRouteResource(load);
  const checkIntegrations = async () => {
    setBusy(true);
    try {
      const result = await api('/admin/integrations/check', { method: 'POST', body: {} });
      setIntegrationStatus(result);
      setNotice(t('admin.console.notices.integrationsReady'));
    } catch (error) {
      if (error.payload?.providers || error.payload?.integrations) setIntegrationStatus(error.payload);
      setNotice(t('admin.console.notices.integrationIssues'));
    } finally { setBusy(false); }
  };
  return <AdminRouteState resource={resource}>{(aiUsage) => <AdminIntegrationsPanel aiUsage={aiUsage} integrationStatus={integrationStatus} checkIntegrations={checkIntegrations} busy={busy}/>}</AdminRouteState>;
}
