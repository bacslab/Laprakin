import { Navigate, useNavigate } from '../../router';
import LegacyLandingPage from '../../Landing';
import { useApp } from '../../state/ui-context';

export default function LandingPage() {
  const { user, loading } = useApp();
  const navigate = useNavigate();
  if (loading) return <div className="loading-screen" role="status"><span>Menyiapkan Laprakin...</span></div>;
  if (user?.emailVerified) return <Navigate to={user.role === 'admin' ? '/admin' : '/app'} replace />;
  return <LegacyLandingPage navigate={navigate} />;
}
