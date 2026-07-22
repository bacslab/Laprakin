const API_BASE = import.meta.env.VITE_API_URL || '/api';
const DEVICE_KEY = 'laprakin-device-id';
const CSRF_KEY = 'laprakin-csrf-token';

function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export const deviceId = getOrCreateDeviceId();

export function setCsrfToken(token) {
  if (token) sessionStorage.setItem(CSRF_KEY, token);
}

export function clearCsrfToken() {
  sessionStorage.removeItem(CSRF_KEY);
}

export function getCsrfToken() {
  return sessionStorage.getItem(CSRF_KEY) || '';
}

export async function api(path, options = {}) {
  const {
    method = 'GET',
    body,
    form = false,
    includeCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()),
  } = options;

  const headers = { 'x-laprakin-device': deviceId };
  if (!form) headers['content-type'] = 'application/json';
  if (includeCsrf && getCsrfToken()) headers['x-laprakin-csrf'] = getCsrfToken();

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body ? (form ? body : JSON.stringify(body)) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const error = new Error(payload?.error?.message || payload || 'Permintaan gagal.');
    error.code = payload?.error?.code;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function download(path, fileName) {
  const headers = { 'x-laprakin-device': deviceId };
  if (getCsrfToken()) headers['x-laprakin-csrf'] = getCsrfToken();
  const response = await fetch(`${API_BASE}${path.replace('/api', '')}`, {
    credentials: 'include',
    headers,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message || 'File tidak dapat diunduh.');
  }

  const blob = await response.blob();
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = fileName || 'laporan.docx';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
}

export function eventUrl(path) {
  return `${API_BASE}${path}`;
}
