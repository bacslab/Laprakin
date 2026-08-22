import crypto from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message, code = 'REQUEST_ERROR', details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const now = () => new Date().toISOString();

export function addDays(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString();
}

export function hmac(value, secret) {
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex');
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function maskEmail(email = '') {
  const [local, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}

export function sanitizeFilename(value = 'file') {
  return String(value)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100) || 'file';
}

export function opaqueStorageName(value = '') {
  const extension = String(value).toLowerCase().match(/\.[a-z0-9]{1,10}$/)?.[0] || '';
  return `${crypto.randomUUID()}${extension}`;
}

export function isFuture(value) {
  return Boolean(value) && new Date(value).getTime() > Date.now();
}

export function isExpired(value) {
  return Boolean(value) && new Date(value).getTime() <= Date.now();
}

export function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function detectBufferType(buffer) {
  if (!buffer || buffer.length < 4) return 'unknown';
  const head = buffer.subarray(0, 16);
  if (head.subarray(0, 4).toString('ascii') === '%PDF') return 'application/pdf';
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'image/png';
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (head.subarray(4, 8).toString('ascii') === 'ftyp') return 'video/mp4';
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'video/webm';
  if (head.subarray(0, 4).toString('ascii') === 'OggS') return 'video/ogg';
  if (head.subarray(0, 2).toString('ascii') === 'PK') return 'application/zip';
  return 'unknown';
}
