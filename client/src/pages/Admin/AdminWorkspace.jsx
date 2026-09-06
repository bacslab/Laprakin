import { UiProvider } from '../../state/ui-context';
import '../../styles/admin.css';

export function AdminWorkspace({ AdminMfaGate, LegacyWorkspace, children, render }) {
  const content = LegacyWorkspace ? <LegacyWorkspace /> : render ? render() : children || null;
  return <UiProvider>{AdminMfaGate ? <AdminMfaGate>{content}</AdminMfaGate> : content}</UiProvider>;
}

export default AdminWorkspace;
