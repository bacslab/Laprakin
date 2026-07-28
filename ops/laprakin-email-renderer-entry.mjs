import { pathToFileURL } from 'node:url';
import { render } from 'react-email';
import {
  DeployFailedEmail,
  DeploySucceededEmail,
  OpsAlertEmail,
  deployFailedText,
  deploySucceededText,
  opsAlertText,
} from '../server/src/emails/templates.js';
import {
  normalizePlainText,
  safeAbsoluteUrl,
  sanitizeOperationalSummary,
  shortRevision,
} from '../server/src/emails/text.js';

/** @param {unknown} value */
function friendlyMailFrom(value) {
  const sender = String(value || '').trim();
  if (/^[^<>]+<[^<>]+>$/.test(sender)) return sender;
  if (/^[^\s@]+@[^\s@]+$/.test(sender)) return `Laprakin <${sender}>`;
  return sender;
}

/**
 * @typedef {{
 *   from: string,
 *   to: string,
 *   subject: string,
 *   body: string,
 *   host: string,
 *   environment?: string,
 *   revision?: string,
 *   summary?: string,
 *   deploymentUrl?: string,
 *   logsUrl?: string,
 *   occurredAt?: string
 * }} OpsEmailInput
 */

/** @param {OpsEmailInput} input */
export async function renderOpsEmailPayload(input) {
  const originalSubject = normalizePlainText(input.subject);
  const environment = normalizePlainText(input.environment) || 'production';
  const common = {
    environment,
    revision: normalizePlainText(input.revision),
    summary: normalizePlainText(input.summary),
    host: normalizePlainText(input.host),
    deployedAt: input.occurredAt || new Date().toISOString(),
  };

  let subject;
  let text;
  let reactTemplate;

  if (/^deploy berhasil$/i.test(originalSubject)) {
    subject = `Deploy berhasil \u00b7 ${environment}`;
    const props = {
      ...common,
      deploymentUrl: safeAbsoluteUrl(input.deploymentUrl),
    };
    text = deploySucceededText(props);
    reactTemplate = DeploySucceededEmail(props);
  } else if (/^deploy gagal$/i.test(originalSubject)) {
    subject = `Deploy gagal \u00b7 ${environment}`;
    const props = {
      ...common,
      errorSummary: sanitizeOperationalSummary(input.body, 'Deployment tidak dapat diselesaikan.'),
      logsUrl: safeAbsoluteUrl(input.logsUrl),
    };
    text = deployFailedText(props);
    reactTemplate = DeployFailedEmail(props);
  } else {
    subject = `[Laprakin ops] ${originalSubject || 'Notifikasi operasional'}`;
    const props = {
      subject: originalSubject || 'Notifikasi operasional',
      body: sanitizeOperationalSummary(input.body),
      host: common.host,
      occurredAt: common.deployedAt,
    };
    text = opsAlertText(props);
    reactTemplate = OpsAlertEmail(props);
  }

  return {
    from: friendlyMailFrom(input.from),
    to: [input.to],
    subject,
    text,
    html: await render(reactTemplate),
  };
}

async function main() {
  const payload = await renderOpsEmailPayload({
    from: process.env.MAIL_FROM || '',
    to: process.env.ADMIN_EMAIL || '',
    subject: process.env.SUBJECT || '',
    body: process.env.BODY || '',
    host: process.env.HOSTNAME_VALUE || '',
    environment: process.env.DEPLOY_ENVIRONMENT || 'production',
    revision: process.env.DEPLOY_REVISION || '',
    summary: process.env.DEPLOY_SUMMARY || '',
    deploymentUrl: process.env.DEPLOYMENT_URL || '',
    logsUrl: process.env.DEPLOY_LOGS_URL || '',
    occurredAt: process.env.OCCURRED_AT || new Date().toISOString(),
  });
  process.stdout.write(JSON.stringify(payload));
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    const code = String(error?.code || 'EMAIL_RENDER_FAILED').replace(/[^A-Z0-9_-]/gi, '').slice(0, 80);
    const message = sanitizeOperationalSummary(error?.message, 'Renderer email tidak dapat dijalankan.').slice(0, 180);
    process.stderr.write(`notify: renderer gagal (${code || 'EMAIL_RENDER_FAILED'}): ${message}\n`);
    process.exitCode = 1;
  });
}

export const OPS_EMAIL_SAMPLE = {
  environment: 'production',
  revision: shortRevision('d139d6d'),
  summary: 'Polish onboarding and document workflow',
  host: 'vm-laprakin-prod-au',
};
