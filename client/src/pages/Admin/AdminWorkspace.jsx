import { UiProvider } from '../../state/ui-context';
import { useLocation } from '../../router';
import { loadPage } from '../../lib/load-page';
import '../../styles/admin.css';

const AdminAiWorkspace = loadPage(() => import('./ai/AdminAiWorkspace'));

export function AdminWorkspace({ AdminMfaGate, LegacyWorkspace, children, render }) {
  const { pathname } = useLocation();
  const content = pathname.startsWith('/admin/ai')
    ? <AdminAiWorkspace />
    : LegacyWorkspace ? <LegacyWorkspace /> : render ? render() : children || null;
  return <UiProvider>{AdminMfaGate ? <AdminMfaGate>{content}</AdminMfaGate> : content}</UiProvider>;
}

export default AdminWorkspace;
