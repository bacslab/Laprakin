import { VerificationEmail } from '../src/emails/templates.js';

/** @param {Parameters<typeof VerificationEmail>[0]} props */
export default function VerificationPreview(props) {
  return VerificationEmail(props);
}

VerificationPreview.PreviewProps = {
  actionUrl: 'https://laprakin.app/auth?verify=preview-token',
};
