import { Navigate, useNavigate } from '../../router';
import LegacyLandingPage from '../../Landing';
import { useResolvedTheme } from '../../lib/theme';
import { useApp } from '../../state/ui-context';
import { useI18n } from '../../i18n/context';

export default function LandingPage() {
  const { user, loading, prefs } = useApp();
  const { t } = useI18n();
  const navigate = useNavigate();
  const resolvedTheme = useResolvedTheme(prefs?.theme || 'system');
  if (loading) return <div className="loading-screen" role="status"><span>{t('common.loading')}</span></div>;
  if (user?.emailVerified) return <Navigate to={user.role === 'admin' ? '/admin' : '/app'} replace />;
  return <LegacyLandingPage navigate={navigate} theme={resolvedTheme} />;
}
