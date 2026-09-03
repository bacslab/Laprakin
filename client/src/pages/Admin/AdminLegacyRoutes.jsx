import { Component, lazy, Suspense } from 'react';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { Button } from '../../components/Button';
import { useI18n } from '../../i18n/context';

const LEGACY_ROUTES = Object.freeze({
  overview: lazy(() => import('./legacy/OverviewRoute')),
  credits: lazy(() => import('./legacy/CreditsRoute')),
  pricing: lazy(() => import('./legacy/PricingRoute')),
  alerts: lazy(() => import('./legacy/AlertsRoute')),
  integrations: lazy(() => import('./legacy/IntegrationsRoute')),
  updates: lazy(() => import('./legacy/UpdatesRoute')),
  broadcasts: lazy(() => import('./legacy/BroadcastsRoute')),
  feedback: lazy(() => import('./legacy/FeedbackRoute')),
  users: lazy(() => import('./legacy/UsersRoute')),
  appeals: lazy(() => import('./legacy/AppealsRoute')),
  risk: lazy(() => import('./legacy/RiskRoute')),
  cms: lazy(() => import('./legacy/CmsRoute')),
  audit: lazy(() => import('./legacy/AuditRoute')),
  retention: lazy(() => import('./legacy/RetentionRoute')),
});

export class AdminLegacyRouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) { return { error }; }

  componentDidUpdate(previousProps) {
    if (previousProps.routeKey !== this.props.routeKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return this.props.renderError(this.state.error, () => this.setState({ error: null }));
  }
}

function RouteRenderError({ error, retry }) {
  const { t } = useI18n();
  return <div className="admin-loading-state" role="alert"><AlertTriangle size={20}/><b>{t('admin.console.renderFailed')}</b><span>{error.message || String(error)}</span><Button variant="secondary" onClick={retry}>{t('admin.console.retry')}</Button></div>;
}

function RouteFallback() {
  const { t } = useI18n();
  return <div className="admin-loading-state" role="status" aria-live="polite"><LoaderCircle className="spin" size={20}/><b>{t('admin.console.loadingTitle')}</b></div>;
}

export default function AdminLegacyRoutes({ tab, setNotice }) {
  const Route = LEGACY_ROUTES[tab] || LEGACY_ROUTES.overview;
  return <AdminLegacyRouteErrorBoundary routeKey={tab} renderError={(error, retry) => <RouteRenderError error={error} retry={retry}/> }>
    <Suspense fallback={<RouteFallback/>}><Route setNotice={setNotice}/></Suspense>
  </AdminLegacyRouteErrorBoundary>;
}
