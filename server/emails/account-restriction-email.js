import { AccountRestrictionEmail } from '../src/emails/templates.js';

/** @param {Parameters<typeof AccountRestrictionEmail>[0]} props */
export default function AccountRestrictionPreview(props) {
  return AccountRestrictionEmail(props);
}

AccountRestrictionPreview.PreviewProps = {
  name: 'Hilmi',
  reason: 'Aktivitas akun melanggar batas penggunaan yang berlaku.',
  durationText: 'Pembatasan berlaku sampai 30 Juli 2026 pukul 18.00.',
  appealUrl: 'https://laprakin.app/auth',
};
