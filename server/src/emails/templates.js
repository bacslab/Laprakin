import React from 'react';
import {
  EmailDetailTable,
  EmailLayout,
  EmailParagraph,
} from './_components/email-layout.js';
import {
  formatEmailDate,
  joinPlainText,
  normalizePlainText,
  safeAbsoluteUrl,
  sanitizeOperationalSummary,
  shortRevision,
} from './text.js';

const h = React.createElement;

/**
 * @typedef {{
 *   environment: string,
 *   revision: string,
 *   summary: string,
 *   host: string,
 *   deploymentUrl?: string,
 *   deployedAt?: string
 * }} DeployEmailProps
 */

/** @param {DeployEmailProps} props */
export function DeploySucceededEmail({
  environment,
  revision,
  summary,
  host,
  deploymentUrl = '',
  deployedAt = '',
}) {
  const short = shortRevision(revision);
  const cleanEnvironment = normalizePlainText(environment) || 'Environment';
  return h(
    EmailLayout,
    {
      preview: `Revisi ${short || 'terbaru'} telah aktif di ${cleanEnvironment}.`,
      statusLabel: 'Deploy berhasil',
      statusTone: 'success',
      heading: `${cleanEnvironment} berhasil diperbarui`,
      supportingText: 'Revisi terbaru telah aktif dan siap digunakan.',
      cta: safeAbsoluteUrl(deploymentUrl)
        ? { label: 'Buka deployment', href: deploymentUrl }
        : null,
    },
    h(EmailDetailTable, {
      items: [
        { label: 'Environment', value: cleanEnvironment },
        { label: 'Revision', value: revision || '', mono: true },
        { label: 'Host', value: host || '', mono: true },
        { label: 'Perubahan', value: summary || '' },
        { label: 'Waktu', value: formatEmailDate(deployedAt) },
      ],
    }),
  );
}

/** @param {DeployEmailProps & {errorSummary: string, logsUrl?: string}} props */
export function DeployFailedEmail({
  environment,
  revision,
  summary,
  host,
  deployedAt = '',
  errorSummary,
  logsUrl = '',
}) {
  const cleanEnvironment = normalizePlainText(environment) || 'Environment';
  const cleanError = sanitizeOperationalSummary(errorSummary, 'Deployment tidak dapat diselesaikan.');
  return h(
    EmailLayout,
    {
      preview: `Deployment ${cleanEnvironment} gagal dan perlu ditinjau.`,
      statusLabel: 'Deploy gagal',
      statusTone: 'danger',
      heading: `${cleanEnvironment} gagal diperbarui`,
      supportingText: 'Deployment dihentikan sebelum perubahan dinyatakan siap digunakan.',
      cta: safeAbsoluteUrl(logsUrl) ? { label: 'Buka logs', href: logsUrl } : null,
    },
    h(EmailDetailTable, {
      items: [
        { label: 'Environment', value: cleanEnvironment },
        { label: 'Revision', value: revision || '', mono: true },
        { label: 'Host', value: host || '', mono: true },
        { label: 'Perubahan', value: summary || '' },
        { label: 'Waktu', value: formatEmailDate(deployedAt) },
      ],
    }),
    h(EmailParagraph, null, cleanError),
  );
}

/**
 * @typedef {{actionUrl: string}} VerificationEmailProps
 * @param {VerificationEmailProps} props
 */
export function VerificationEmail({ actionUrl }) {
  return h(
    EmailLayout,
    {
      preview: 'Verifikasi emailmu untuk mengaktifkan akun Laprakin.',
      statusLabel: 'Verifikasi email',
      heading: 'Verifikasi emailmu',
      supportingText: 'Aktifkan akun Laprakin dan klaim 2 credit gratis.',
      cta: { label: 'Verifikasi email', href: actionUrl },
    },
    h(EmailParagraph, null, 'Link verifikasi berlaku selama 24 jam dan hanya dapat digunakan oleh pemilik akun.'),
    h(EmailParagraph, null, 'Jika kamu tidak membuat akun Laprakin, abaikan email ini.'),
  );
}

/**
 * @typedef {{actionUrl: string}} PasswordResetEmailProps
 * @param {PasswordResetEmailProps} props
 */
export function PasswordResetEmail({ actionUrl }) {
  return h(
    EmailLayout,
    {
      preview: 'Gunakan link ini untuk mengatur ulang kata sandi Laprakin.',
      statusLabel: 'Keamanan akun',
      heading: 'Atur ulang kata sandi',
      supportingText: 'Permintaan reset kata sandi telah diterima.',
      cta: { label: 'Atur ulang kata sandi', href: actionUrl },
    },
    h(EmailParagraph, null, 'Link ini berlaku selama 30 menit.'),
    h(EmailParagraph, null, 'Jika kamu tidak meminta reset, abaikan email ini dan kata sandimu tidak akan berubah.'),
  );
}

/**
 * @typedef {{summary: string, adminUrl: string, critical?: boolean}} AdminSecurityAlertEmailProps
 * @param {AdminSecurityAlertEmailProps} props
 */
export function AdminSecurityAlertEmail({ summary, adminUrl, critical = false }) {
  return h(
    EmailLayout,
    {
      preview: critical ? 'Aktivitas kritis membutuhkan peninjauan admin.' : 'Aktivitas akun perlu ditinjau.',
      statusLabel: critical ? 'Tindakan diperlukan' : 'Perlu ditinjau',
      statusTone: critical ? 'danger' : 'warning',
      heading: critical ? 'Tindakan segera diperlukan' : 'Aktivitas perlu ditinjau',
      supportingText: 'Periksa metadata kejadian melalui Admin Console Laprakin.',
      cta: { label: 'Buka Admin Console', href: adminUrl },
    },
    h(EmailParagraph, null, sanitizeOperationalSummary(summary)),
  );
}

/**
 * @typedef {{name?: string, reason: string, durationText: string, appealUrl: string}} AccountRestrictionEmailProps
 * @param {AccountRestrictionEmailProps} props
 */
export function AccountRestrictionEmail({ name = '', reason, durationText, appealUrl }) {
  const recipientName = normalizePlainText(name) || 'pengguna Laprakin';
  return h(
    EmailLayout,
    {
      preview: 'Akses akun Laprakinmu sedang dibatasi.',
      statusLabel: 'Akses dibatasi',
      statusTone: 'danger',
      heading: 'Akses akunmu dibatasi',
      supportingText: `Halo ${recipientName}, pembatasan diterapkan pada akun Laprakinmu.`,
      cta: { label: 'Ajukan appeal', href: appealUrl },
    },
    h(EmailDetailTable, {
      items: [
        { label: 'Alasan', value: normalizePlainText(reason) },
        { label: 'Durasi', value: normalizePlainText(durationText) },
      ],
    }),
  );
}

/**
 * @typedef {{name?: string, approved: boolean, reply: string}} AppealResultEmailProps
 * @param {AppealResultEmailProps} props
 */
export function AppealResultEmail({ name = '', approved, reply }) {
  const recipientName = normalizePlainText(name) || 'pengguna Laprakin';
  return h(
    EmailLayout,
    {
      preview: approved ? 'Appeal akun Laprakinmu telah disetujui.' : 'Appeal akun Laprakinmu telah ditinjau.',
      statusLabel: approved ? 'Appeal disetujui' : 'Appeal ditinjau',
      statusTone: approved ? 'success' : 'neutral',
      heading: approved ? 'Appeal disetujui' : 'Hasil peninjauan appeal',
      supportingText: `Halo ${recipientName}, tim Laprakin telah menyelesaikan peninjauan.`,
    },
    h(EmailParagraph, null, normalizePlainText(reply)),
  );
}

/**
 * @typedef {{subject: string, body: string, host: string, occurredAt?: string}} OpsAlertEmailProps
 * @param {OpsAlertEmailProps} props
 */
export function OpsAlertEmail({ subject, body, host, occurredAt = '' }) {
  const failed = /gagal|failed|critical|kritis/i.test(subject);
  return h(
    EmailLayout,
    {
      preview: `${normalizePlainText(subject) || 'Notifikasi operasional'} dari Laprakin.`,
      statusLabel: failed ? 'Perlu ditinjau' : 'Informasi operasional',
      statusTone: failed ? 'danger' : 'neutral',
      heading: normalizePlainText(subject) || 'Notifikasi operasional',
      supportingText: 'Notifikasi otomatis dari sistem operasional Laprakin.',
    },
    h(EmailParagraph, null, sanitizeOperationalSummary(body)),
    h(EmailDetailTable, {
      items: [
        { label: 'Host', value: host || '', mono: true },
        { label: 'Waktu', value: formatEmailDate(occurredAt) },
      ],
    }),
  );
}

/** @param {DeployEmailProps} props */
export function deploySucceededText(props) {
  return joinPlainText([
    `${props.environment || 'Environment'} berhasil diperbarui`,
    'Revisi terbaru telah aktif dan siap digunakan.',
    [
      `Environment: ${props.environment || '-'}`,
      `Revision: ${props.revision || '-'}`,
      `Host: ${props.host || '-'}`,
      `Perubahan: ${props.summary || '-'}`,
      formatEmailDate(props.deployedAt) ? `Waktu: ${formatEmailDate(props.deployedAt)}` : '',
    ].filter(Boolean).join('\n'),
    safeAbsoluteUrl(props.deploymentUrl) ? `Buka deployment: ${safeAbsoluteUrl(props.deploymentUrl)}` : '',
    'Email otomatis dari Laprakin. Tidak perlu membalas email ini.',
  ]);
}

/** @param {DeployEmailProps & {errorSummary: string, logsUrl?: string}} props */
export function deployFailedText(props) {
  return joinPlainText([
    `${props.environment || 'Environment'} gagal diperbarui`,
    sanitizeOperationalSummary(props.errorSummary, 'Deployment tidak dapat diselesaikan.'),
    [
      `Environment: ${props.environment || '-'}`,
      `Revision: ${props.revision || '-'}`,
      `Host: ${props.host || '-'}`,
      `Perubahan: ${props.summary || '-'}`,
      formatEmailDate(props.deployedAt) ? `Waktu: ${formatEmailDate(props.deployedAt)}` : '',
    ].filter(Boolean).join('\n'),
    safeAbsoluteUrl(props.logsUrl) ? `Buka logs: ${safeAbsoluteUrl(props.logsUrl)}` : '',
    'Email otomatis dari Laprakin. Tidak perlu membalas email ini.',
  ]);
}

/** @param {VerificationEmailProps} props */
export function verificationText({ actionUrl }) {
  return joinPlainText([
    'Verifikasi emailmu',
    'Aktifkan akun Laprakin dan klaim 2 credit gratis.',
    `Verifikasi email: ${safeAbsoluteUrl(actionUrl)}`,
    'Link verifikasi berlaku selama 24 jam dan hanya dapat digunakan oleh pemilik akun.',
    'Jika kamu tidak membuat akun Laprakin, abaikan email ini.',
  ]);
}

/** @param {PasswordResetEmailProps} props */
export function passwordResetText({ actionUrl }) {
  return joinPlainText([
    'Atur ulang kata sandi',
    `Atur ulang kata sandi: ${safeAbsoluteUrl(actionUrl)}`,
    'Link ini berlaku selama 30 menit.',
    'Jika kamu tidak meminta reset, abaikan email ini dan kata sandimu tidak akan berubah.',
  ]);
}

/** @param {AdminSecurityAlertEmailProps} props */
export function adminSecurityAlertText({ summary, adminUrl }) {
  return joinPlainText([
    sanitizeOperationalSummary(summary),
    `Buka Admin Console: ${safeAbsoluteUrl(adminUrl)}`,
  ]);
}

/** @param {AccountRestrictionEmailProps} props */
export function accountRestrictionText({ name = '', reason, durationText, appealUrl }) {
  return joinPlainText([
    `Halo ${normalizePlainText(name) || 'pengguna Laprakin'},`,
    `Aksesmu dibatasi karena: ${normalizePlainText(reason)}`,
    normalizePlainText(durationText),
    `Ajukan appeal: ${safeAbsoluteUrl(appealUrl)}`,
  ]);
}

/** @param {AppealResultEmailProps} props */
export function appealResultText({ name = '', reply }) {
  return joinPlainText([
    `Halo ${normalizePlainText(name) || 'pengguna Laprakin'},`,
    normalizePlainText(reply),
  ]);
}

/** @param {OpsAlertEmailProps} props */
export function opsAlertText({ subject, body, host, occurredAt = '' }) {
  return joinPlainText([
    normalizePlainText(subject),
    sanitizeOperationalSummary(body),
    [
      `Host: ${host || '-'}`,
      formatEmailDate(occurredAt) ? `Waktu: ${formatEmailDate(occurredAt)}` : '',
    ].filter(Boolean).join('\n'),
  ]);
}
