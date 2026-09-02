import LegacyWorkspaceView from './LegacyWorkspaceView';
import { useLegacyWorkspaceController } from './useLegacyWorkspaceController';

export default function LegacyWorkspace() {
  const controller = useLegacyWorkspaceController();
  return <LegacyWorkspaceView {...controller} />;
}
