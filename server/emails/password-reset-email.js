import { PasswordResetEmail } from '../src/emails/templates.js';

/** @param {Parameters<typeof PasswordResetEmail>[0]} props */
export default function PasswordResetPreview(props) {
  return PasswordResetEmail(props);
}

PasswordResetPreview.PreviewProps = {
  actionUrl: 'https://laprakin.app/auth?reset=preview-token',
};
