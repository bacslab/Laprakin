const SECRET_ASSIGNMENT = /\b(api[_-]?key|authorization|bearer|cookie|credential|jwt|password|secret|session|smtp[_-]?pass|token)\b\s*[:=]\s*\S+/gi;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const STACK_LINE = /^\s*(?:at\s+\S+|file:\/\/|\/[\w./-]+\.(?:js|mjs|cjs|ts|tsx):\d+)/i;

/** @param {unknown} value */
export function normalizePlainText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\\r\\n|\\n|\\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** @param {unknown} value */
export function capitalizeInitial(value) {
  const text = normalizePlainText(value);
  return text ? `${text.charAt(0).toLocaleUpperCase('id-ID')}${text.slice(1)}` : '';
}

/** @param {unknown} value @param {number} [length] */
export function shortRevision(value, length = 7) {
  const revision = String(value ?? '').trim();
  return revision ? revision.slice(0, Math.max(1, length)) : '';
}

/** @param {unknown} value */
export function safeAbsoluteUrl(value) {
  try {
    const url = new URL(String(value ?? '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

/** @param {unknown} value @param {string} [fallback] */
export function sanitizeOperationalSummary(value, fallback = 'Kejadian operasional perlu ditinjau.') {
  const sanitized = normalizePlainText(value)
    .split('\n')
    .filter((line) => !STACK_LINE.test(line))
    .join('\n')
    .replace(SECRET_ASSIGNMENT, '$1=[disembunyikan]')
    .replace(BEARER_TOKEN, 'Bearer [disembunyikan]')
    .replace(/\b(?:re|AIza)[A-Za-z0-9_-]{16,}\b/g, '[credential disembunyikan]')
    .slice(0, 800)
    .trim();
  return sanitized || fallback;
}

/** @param {string | number | Date | null | undefined} value */
export function formatEmailDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

/** @param {unknown[]} parts */
export function joinPlainText(parts) {
  return parts
    .map((part) => normalizePlainText(part))
    .filter(Boolean)
    .join('\n\n');
}
