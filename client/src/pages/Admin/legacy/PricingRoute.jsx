import { useCallback } from 'react';
import { api } from '../../../api';
import AdminPricingPanel from '../AdminPricingPanel';
import { AdminRouteState, useAdminRouteResource } from './shared';

export default function PricingRoute({ setNotice }) {
  const load = useCallback(() => api('/admin/pricing'), []);
  const resource = useAdminRouteResource(load);
  return <AdminRouteState resource={resource}>{(pricing) => <AdminPricingPanel setNotice={setNotice} initialPricing={pricing} reloadPricing={resource.reload}/>}</AdminRouteState>;
}
