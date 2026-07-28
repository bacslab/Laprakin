import assert from 'node:assert/strict';
import { render } from 'react-email';
import {
  DeployFailedEmail,
  DeploySucceededEmail,
  VerificationEmail,
  deployFailedText,
  deploySucceededText,
  verificationText,
} from '../server/src/emails/templates.js';
import { renderOpsEmailPayload } from '../ops/laprakin-email-renderer-entry.mjs';

const sample = {
  environment: 'production',
  revision: 'd139d6d',
  summary: 'Polish onboarding and document workflow',
  host: 'vm-laprakin-prod-au',
  deploymentUrl: 'https://laprakin.app',
  deployedAt: '2026-07-28T12:00:00.000Z',
};

const rendered = await Promise.all([
  render(DeploySucceededEmail(sample)),
  render(DeployFailedEmail({
    ...sample,
    errorSummary: 'Health check production belum memberikan status siap.',
  })),
  render(VerificationEmail({
    actionUrl: 'https://laprakin.app/auth?verify=preview-token',
  })),
]);

for (const html of rendered) {
  assert.match(html, /max-width:\s*600px/i);
  assert.match(html, /@media only screen and \(max-width:\s*620px\)/i);
  assert.doesNotMatch(html, /\\n/);
  assert.doesNotMatch(html, /href="(?:#|\/|javascript:)/i);
  assert.doesNotMatch(html, /example\.(?:com|test)|dummy/i);
}

const textBodies = [
  deploySucceededText(sample),
  deployFailedText({
    ...sample,
    errorSummary: 'Health check production belum memberikan status siap.',
  }),
  verificationText({
    actionUrl: 'https://laprakin.app/auth?verify=preview-token',
  }),
];

for (const text of textBodies) {
  assert.ok(text.includes('\n'));
  assert.doesNotMatch(text, /\\n/);
}

const opsPayload = await renderOpsEmailPayload({
  from: 'noreply@mail.laprakin.app',
  to: 'ops@laprakin.app',
  subject: 'Deploy berhasil',
  body: sample.summary,
  host: sample.host,
  environment: sample.environment,
  revision: sample.revision,
  summary: sample.summary,
  deploymentUrl: sample.deploymentUrl,
  occurredAt: sample.deployedAt,
});

assert.equal(opsPayload.subject, 'Deploy berhasil \u00b7 production');
assert.equal(opsPayload.from, 'Laprakin <noreply@mail.laprakin.app>');
assert.match(opsPayload.html, /production berhasil diperbarui/i);
assert.doesNotMatch(opsPayload.text, /\\n/);

console.info(`Email render check passed: ${rendered.length + 1} template dirender.`);
