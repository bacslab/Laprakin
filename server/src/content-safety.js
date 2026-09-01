const DEFAULT_DOCUMENT_TEXT_LIMIT = 80_000;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const SOURCE_BOUNDARY_MARKERS = /UNTRUSTED_SOURCE_(?:START|END)/gi;

const CREDENTIAL_EXFILTRATION = /\b(?:expose|reveal|dump|steal|exfiltrate|extract|leak|disclose|give|send|list|show)\b[\s\S]{0,100}\b(?:another|other|someone(?:'s|s)?|third[- ]party)\b[\s\S]{0,100}\b(?:password|credential|token|secret|api[ _-]?key|private[ _-]?key)s?\b/i;
const MALWARE_DEPLOYMENT = /\b(?:deploy|install|execute|launch|spread|persist|create|write|run)\b[\s\S]{0,90}\b(?:ransomware|malware|keylogger|trojan|botnet|reverse[ -]?shell|credential[ -]?stealer|wiper|spyware|rootkit|destructive[ -]?payload)\b/i;
const DISALLOWED_SEXUAL_CONTENT = /\b(?:child|minor|underage|teen(?:ager)?|kid|schoolgirl|schoolboy)\b[\s\S]{0,100}\b(?:explicit|sexual|sex|porn|nude|naked|intercourse|abuse|exploitation)\b|\b(?:explicit|sexual|sex|porn|nude|naked|intercourse|abuse|exploitation)\b[\s\S]{0,100}\b(?:child|minor|underage|teen(?:ager)?|kid|schoolgirl|schoolboy)\b/i;

function normalizedLimit(value, fallback = DEFAULT_DOCUMENT_TEXT_LIMIT) {
  const limit = Number(value);
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : fallback;
}

export function sanitizeUntrustedDocumentText(text, options = {}) {
  const maxLength = normalizedLimit(options.maxLength);
  return String(text ?? '')
    .replace(/\r\n?|\u2028|\u2029/g, ' ')
    .replace(CONTROL_CHARACTERS, '')
    .replace(SOURCE_BOUNDARY_MARKERS, '')
    .replace(/[`${}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
    .trim();
}

export function wrapUntrustedDocumentText(text, label = 'sumber') {
  const safeLabel = sanitizeUntrustedDocumentText(label, { maxLength: 120 }) || 'sumber';
  const safeText = sanitizeUntrustedDocumentText(text, { maxLength: DEFAULT_DOCUMENT_TEXT_LIMIT });
  return [
    'UNTRUSTED_SOURCE_START',
    `label: ${safeLabel}`,
    safeText || '(sumber tidak memiliki teks yang dapat dibaca)',
    'UNTRUSTED_SOURCE_END',
  ].join('\n');
}

export function moderateText(text, direction = 'input', options = {}) {
  const value = String(text ?? '');
  if (CREDENTIAL_EXFILTRATION.test(value)) {
    return { action: 'block', code: 'CREDENTIAL_EXFILTRATION' };
  }
  if (MALWARE_DEPLOYMENT.test(value)) {
    return { action: 'block', code: 'MALWARE_DEPLOYMENT' };
  }
  if (DISALLOWED_SEXUAL_CONTENT.test(value)) {
    return { action: 'block', code: 'DISALLOWED_SEXUAL_CONTENT' };
  }
  if (options.classifierTimedOut === true) {
    return { action: 'review', code: 'CLASSIFIER_TIMEOUT' };
  }
  return { action: 'allow', code: 'ALLOWED' };
}

export function moderationMessage(code, direction = 'input') {
  const messages = {
    CREDENTIAL_EXFILTRATION: 'Permintaan ini mengarah pada pengungkapan kredensial atau data rahasia, jadi tidak dapat diproses.',
    MALWARE_DEPLOYMENT: 'Permintaan ini mengarah pada penyebaran perangkat lunak berbahaya, jadi tidak dapat diproses.',
    DISALLOWED_SEXUAL_CONTENT: 'Konten ini tidak dapat diproses karena melanggar kebijakan keselamatan.',
    CLASSIFIER_TIMEOUT: 'Konten sedang ditinjau. Coba kirim kembali dengan permintaan akademik yang lebih spesifik.',
    OUTPUT_POLICY_BLOCKED: 'Jawaban AI tidak dapat ditampilkan karena melewati pemeriksaan keselamatan.',
  };
  if (messages[code]) return messages[code];
  return direction === 'output'
    ? messages.OUTPUT_POLICY_BLOCKED
    : 'Konten ini tidak dapat diproses karena melewati pemeriksaan keselamatan.';
}

export { DEFAULT_DOCUMENT_TEXT_LIMIT };
