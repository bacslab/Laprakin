import assert from 'node:assert/strict';
import test from 'node:test';
import { render } from 'react-email';
import {
  AccountRestrictionEmail,
  AdminSecurityAlertEmail,
  AppealResultEmail,
  DeployFailedEmail,
  DeploySucceededEmail,
  OpsAlertEmail,
  PasswordResetEmail,
  VerificationEmail,
  accountRestrictionText,
  adminSecurityAlertText,
  appealResultText,
  deployFailedText,
  deploySucceededText,
  opsAlertText,
  passwordResetText,
  verificationText,
} from '../src/emails/templates.js';
import {
  capitalizeInitial,
  normalizePlainText,
  safeAbsoluteUrl,
  sanitizeOperationalSummary,
  shortRevision,
} from '../src/emails/text.js';
import { renderOpsEmailPayload } from '../../ops/laprakin-email-renderer-entry.mjs';

const deploySample = {
  environment: 'production',
  revision: 'd139d6d',
  summary: 'Polish onboarding and document workflow',
  host: 'vm-laprakin-prod-au',
  deploymentUrl: 'https://laprakin.app',
  deployedAt: '2026-07-28T12:00:00.000Z',
};

test('email text utilities normalize newlines and sanitize operational details', () => {
  assert.equal(normalizePlainText('Baris satu\\n\\nBaris dua'), 'Baris satu\n\nBaris dua');
  assert.equal(capitalizeInitial('production berhasil diperbarui'), 'Production berhasil diperbarui');
  assert.equal(shortRevision('d139d6dabcdef'), 'd139d6d');
  assert.equal(safeAbsoluteUrl('/relative'), '');
  assert.equal(safeAbsoluteUrl('javascript:alert(1)'), '');
  assert.equal(safeAbsoluteUrl('https://laprakin.app'), 'https://laprakin.app/');

  const sanitized = sanitizeOperationalSummary([
    'Deploy gagal',
    'API_KEY=re_sensitive_value',
    'Bearer secret-token-value',
    '    at deploy (file:///app/deploy.js:10:4)',
  ].join('\n'));
  assert.match(sanitized, /API_KEY=\[disembunyikan\]/i);
  assert.match(sanitized, /Bearer \[disembunyikan\]/);
  assert.doesNotMatch(sanitized, /re_sensitive_value|file:\/\/|deploy\.js/);
});

test('all transactional templates render responsive production HTML', async () => {
  const cases = [
    {
      component: DeploySucceededEmail(deploySample),
      text: deploySucceededText(deploySample),
    },
    {
      component: DeployFailedEmail({
        ...deploySample,
        errorSummary: 'Health check production gagal.',
      }),
      text: deployFailedText({
        ...deploySample,
        errorSummary: 'Health check production gagal.',
      }),
    },
    {
      component: VerificationEmail({ actionUrl: 'https://laprakin.app/auth?verify=token' }),
      text: verificationText({ actionUrl: 'https://laprakin.app/auth?verify=token' }),
    },
    {
      component: PasswordResetEmail({ actionUrl: 'https://laprakin.app/auth?reset=token' }),
      text: passwordResetText({ actionUrl: 'https://laprakin.app/auth?reset=token' }),
    },
    {
      component: AdminSecurityAlertEmail({
        summary: 'Aktivitas perlu ditinjau.',
        adminUrl: 'https://laprakin.app/admin',
      }),
      text: adminSecurityAlertText({
        summary: 'Aktivitas perlu ditinjau.',
        adminUrl: 'https://laprakin.app/admin',
      }),
    },
    {
      component: AccountRestrictionEmail({
        name: 'Hilmi',
        reason: 'Batas penggunaan terlampaui.',
        durationText: 'Berlaku selama 24 jam.',
        appealUrl: 'https://laprakin.app/auth',
      }),
      text: accountRestrictionText({
        name: 'Hilmi',
        reason: 'Batas penggunaan terlampaui.',
        durationText: 'Berlaku selama 24 jam.',
        appealUrl: 'https://laprakin.app/auth',
      }),
    },
    {
      component: AppealResultEmail({
        name: 'Hilmi',
        approved: true,
        reply: 'Akses akun telah dipulihkan.',
      }),
      text: appealResultText({
        name: 'Hilmi',
        approved: true,
        reply: 'Akses akun telah dipulihkan.',
      }),
    },
    {
      component: OpsAlertEmail({
        subject: 'Backup gagal',
        body: 'Backup harian belum selesai.',
        host: 'vm-laprakin-prod-au',
      }),
      text: opsAlertText({
        subject: 'Backup gagal',
        body: 'Backup harian belum selesai.',
        host: 'vm-laprakin-prod-au',
      }),
    },
  ];

  for (const email of cases) {
    const html = await render(email.component);
    assert.match(html, /max-width:\s*600px/i);
    assert.match(html, /@media only screen and \(max-width:\s*620px\)/i);
    assert.match(html, /https:\/\/laprakin\.app\/brand\/laprakin-email-logo\.png\?v=1/);
    assert.match(html, /Plus Jakarta Sans/);
    assert.match(html, /Email otomatis dari Laprakin/);
    assert.doesNotMatch(html, /\\n|gradient|glassmorphism|javascript:/i);
    assert.doesNotMatch(email.text, /\\n/);
  }
});

test('deploy renderer creates Resend payload without dummy links or exposed secrets', async () => {
  const success = await renderOpsEmailPayload({
    from: 'noreply@mail.laprakin.app',
    to: 'ops@laprakin.app',
    subject: 'Deploy berhasil',
    body: deploySample.summary,
    host: deploySample.host,
    environment: deploySample.environment,
    revision: deploySample.revision,
    summary: deploySample.summary,
    deploymentUrl: deploySample.deploymentUrl,
    occurredAt: deploySample.deployedAt,
  });
  assert.equal(success.subject, 'Deploy berhasil \u00b7 production');
  assert.equal(success.from, 'Laprakin <noreply@mail.laprakin.app>');
  assert.match(success.html, /Buka deployment/);
  assert.match(success.html, /Production berhasil diperbarui/);
  assert.doesNotMatch(success.text, /\\n/);

  const failed = await renderOpsEmailPayload({
    from: 'Laprakin <noreply@mail.laprakin.app>',
    to: 'ops@laprakin.app',
    subject: 'Deploy gagal',
    body: 'TOKEN=re_sensitive_value\n    at deploy (file:///app/deploy.js:10:4)',
    host: deploySample.host,
    environment: deploySample.environment,
    revision: deploySample.revision,
    summary: deploySample.summary,
    occurredAt: deploySample.deployedAt,
  });
  assert.equal(failed.subject, 'Deploy gagal \u00b7 production');
  assert.doesNotMatch(`${failed.text}\n${failed.html}`, /re_sensitive_value|file:\/\/|deploy\.js/);
  assert.doesNotMatch(failed.html, /Buka logs/);
});
