import { DeployFailedEmail } from '../src/emails/templates.js';

/** @param {Parameters<typeof DeployFailedEmail>[0]} props */
export default function DeployFailedPreview(props) {
  return DeployFailedEmail(props);
}

DeployFailedPreview.PreviewProps = {
  environment: 'production',
  revision: 'd139d6d',
  summary: 'Polish onboarding and document workflow',
  host: 'vm-laprakin-prod-au',
  deployedAt: '2026-07-28T12:00:00.000Z',
  errorSummary: 'Health check production belum memberikan status siap.',
};
