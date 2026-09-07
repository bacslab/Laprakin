import { Component } from 'react';
import { AlertTriangle } from '../../icons';
import { Button } from '../../components/Button';
import { useI18n } from '../../i18n/context';

import OverviewRoute from './legacy/OverviewRoute';
import CreditsRoute from './legacy/CreditsRoute';
import PricingRoute from './legacy/PricingRoute';
import AlertsRoute from './legacy/AlertsRoute';
import IntegrationsRoute from './legacy/IntegrationsRoute';
import UpdatesRoute from './legacy/UpdatesRoute';
import BroadcastsRoute from './legacy/BroadcastsRoute';
import FeedbackRoute from './legacy/FeedbackRoute';
import UsersRoute from './legacy/UsersRoute';
import AppealsRoute from './legacy/AppealsRoute';
import RiskRoute from './legacy/RiskRoute';
import CmsRoute from './legacy/CmsRoute';
import AuditRoute from './legacy/AuditRoute';
import RetentionRoute from './legacy/RetentionRoute';

const LEGACY_ROUTES = Object.freeze({
  overview: OverviewRoute,
  credits: CreditsRoute,
  pricing: PricingRoute,
  alerts: AlertsRoute,
  integrations: IntegrationsRoute,
  updates: UpdatesRoute,
  broadcasts: BroadcastsRoute,
  feedback: FeedbackRoute,
  users: UsersRoute,
  appeals: AppealsRoute,
  risk: RiskRoute,
  cms: CmsRoute,
  audit: AuditRoute,
  retention: RetentionRoute,
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

export default function AdminLegacyRoutes({ tab, setNotice }) {
  const Route = LEGACY_ROUTES[tab] || LEGACY_ROUTES.overview;
  return <AdminLegacyRouteErrorBoundary routeKey={tab} renderError={(error, retry) => <RouteRenderError error={error} retry={retry}/> }>
    <Route setNotice={setNotice}/>
  </AdminLegacyRouteErrorBoundary>;
}
