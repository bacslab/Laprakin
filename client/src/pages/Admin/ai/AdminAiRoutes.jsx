import { Suspense } from 'react';
import { Navigate, useLocation } from '../../../router';
import { loadPage } from '../../../lib/load-page';
import { resolveAdminAiRoute } from '../../../lib/admin-ai';
import { useAdminAiCopy } from './shared';

const ProvidersModule = loadPage(() => import('./ProvidersModule'));
const ProviderDetailModule = loadPage(() => import('./ProviderDetailModule'));
const ModelsModule = loadPage(() => import('./ModelsModule'));
const RoutingModule = loadPage(() => import('./RoutingModule'));
const HealthModule = loadPage(() => import('./HealthModule'));
const ChangesModule = loadPage(() => import('./ChangesModule'));

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
  return <Suspense fallback={<div className="admin-ai-resource-state" role="status">{t('common.loadingModule')}</div>}><div className="admin-ai-page">{module}</div></Suspense>;
}
