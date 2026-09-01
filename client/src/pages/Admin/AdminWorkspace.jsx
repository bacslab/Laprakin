import { UiProvider } from '../../state/ui-context';

export function AdminWorkspace({ children, render }) {
  return <UiProvider>{render ? render() : children || null}</UiProvider>;
}

export default AdminWorkspace;
