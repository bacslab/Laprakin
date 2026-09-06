import { Navigate, useLocation } from '../../../router';
import { resolveAdminAiRoute } from '../../../lib/admin-ai';
import { useAdminAiCopy } from './shared';
import ProvidersModule from './ProvidersModule';
import ProviderDetailModule from './ProviderDetailModule';
import ModelsModule from './ModelsModule';
import RoutingModule from './RoutingModule';
import HealthModule from './HealthModule';
import ChangesModule from './ChangesModule';

export default function AdminAiRoutes() {
  const t = useAdminAiCopy();
  const location = useLocation();
  if (location.pathname === '/admin/ai' || location.pathname === '/admin/ai/') return <Navigate to="/admin/ai/providers" replace />;
  const route = resolveAdminAiRoute(location.pathname);
  const module = route.module === 'provider' ? <ProviderDetailModule providerId={route.providerId} />
    : route.module === 'models' ? <ModelsModule />
      : route.module === 'routing' ? <RoutingModule />
        : route.module === 'health' ? <HealthModule />
          : route.module === 'changes' ? <ChangesModule preview canary activate rollback emergencyDisable />
            : <ProvidersModule />;
  return <div className="admin-ai-page">{module}</div>;
}
