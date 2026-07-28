import { DeploySucceededEmail } from '../src/emails/templates.js';

/** @param {Parameters<typeof DeploySucceededEmail>[0]} props */
export default function DeploySucceededPreview(props) {
  return DeploySucceededEmail(props);
}

DeploySucceededPreview.PreviewProps = {
  environment: 'production',
  revision: 'd139d6d',
  summary: 'Polish onboarding and document workflow',
  host: 'vm-laprakin-prod-au',
  deploymentUrl: 'https://laprakin.app',
  deployedAt: '2026-07-28T12:00:00.000Z',
};
