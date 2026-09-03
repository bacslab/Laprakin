import { useCallback } from 'react';
import { api } from '../../../api';
import { useI18n } from '../../../i18n/context';
import { AdminRiskPanel } from '../AdminLegacyContentPanels';
import { AdminRouteState, useAdminRouteResource } from './shared';

export default function RiskRoute({ setNotice }) {
  const { t } = useI18n();
  const load = useCallback(async () => (await api('/admin/overview')).events || [], []);
  const resource = useAdminRouteResource(load, { events: ['alert', 'alert-updated'] });
  const reviewRisk = async (id, status) => {
    try {
      await api(`/admin/risk-events/${id}`, { method: 'PUT', body: { status } });
      await resource.reload();
      setNotice(t('admin.console.notices.riskUpdated'));
    } catch (error) { setNotice(error.message); }
  };
  return <AdminRouteState resource={resource}>{(events) => <AdminRiskPanel events={events} reviewRisk={reviewRisk}/>}</AdminRouteState>;
}
