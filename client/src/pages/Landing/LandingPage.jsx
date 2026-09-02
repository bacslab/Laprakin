import { Navigate, useNavigate } from '../../router';
import LegacyLandingPage from '../../Landing';
import { useApp } from '../../state/ui-context';
import { useI18n } from '../../i18n/context';

export default function LandingPage() {
  const { user, loading } = useApp();
  const { t } = useI18n();
  const navigate = useNavigate();
  if (loading) return <div className="loading-screen" role="status"><span>{t('common.loading')}</span></div>;
  if (user?.emailVerified) return <Navigate to={user.role === 'admin' ? '/admin' : '/app'} replace />;
  return <LegacyLandingPage navigate={navigate} />;
}
