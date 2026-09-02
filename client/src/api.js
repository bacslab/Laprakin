import { parseSseEvents } from './lib/read-sse-stream';
import { composeRequestSignal, loadCanonicalMutation, parseOriginalResponse } from './lib/request-lifecycle';

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
const clientProfile = [
  window.screen?.width,
  window.screen?.height,
  window.screen?.colorDepth,
  window.devicePixelRatio,
  Intl.DateTimeFormat().resolvedOptions().timeZone,
  navigator.platform,
  navigator.hardwareConcurrency,
  navigator.maxTouchPoints,
].map((value) => String(value ?? '')).join('|');

export function setCsrfToken(token) {
  if (token) sessionStorage.setItem(CSRF_KEY, token);
}

export function clearCsrfToken() {
  sessionStorage.removeItem(CSRF_KEY);
}

export function getCsrfToken() {
  return sessionStorage.getItem(CSRF_KEY) || '';
}

export function friendlyClientErrorMessage(error) {
  const msg = String(error?.message || error || '').trim();
  if (!msg || /failed to fetch|networkerror|load failed|net::err_/i.test(msg)) {
    return 'Koneksi internet bermasalah atau layanan sedang tidak dapat dijangkau. Silakan periksa koneksi kamu dan coba lagi.';
  }
  return msg;
}

export async function api(path, options = {}) {
  const {
    method = 'GET',
    body,
    form = false,
    headers: extraHeaders = {},
    requestId = body?.requestId,
    includeCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()),
  } = options;

  const headers = { 'x-laprakin-device': deviceId, 'x-laprakin-client-profile': clientProfile, ...extraHeaders };
  if (!form) headers['content-type'] = 'application/json';
  if (includeCsrf && getCsrfToken()) headers['x-laprakin-csrf'] = getCsrfToken();
  if (requestId) headers['idempotency-key'] = requestId;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: body ? (form ? body : JSON.stringify(body)) : undefined,
    });
  } catch (netErr) {
    throw new Error(friendlyClientErrorMessage(netErr));
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const rawMessage = payload?.error?.message || payload || 'Permintaan belum dapat diproses.';
    const error = new Error(friendlyClientErrorMessage(rawMessage));
    error.code = payload?.error?.code;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function apiStream(path, options = {}) {
  const { onDelta, ...requestOptions } = options;
  const {
    method = 'GET',
    body,
    form = false,
    headers: extraHeaders = {},
    requestId = body?.requestId,
    timeoutMs = 60000,
    signal,
    includeCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()),
  } = requestOptions;
  const headers = { 'x-laprakin-device': deviceId, 'x-laprakin-client-profile': clientProfile, accept: 'text/event-stream', ...extraHeaders };
  if (!form) headers['content-type'] = 'application/json';
  if (includeCsrf && getCsrfToken()) headers['x-laprakin-csrf'] = getCsrfToken();
  if (requestId) headers['idempotency-key'] = requestId;
  const composed = composeRequestSignal({ signal, timeoutMs });
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: body ? (form ? body : JSON.stringify(body)) : undefined,
      signal: composed.signal,
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
      const payload = await parseOriginalResponse(response);
      if (!response.ok) {
        const error = new Error(friendlyClientErrorMessage(payload?.error?.message || payload || 'Permintaan belum dapat diproses.'));
        error.code = payload?.error?.code;
        error.payload = payload;
        throw error;
      }
      return payload;
    }
    let payload = null;
    let sawUsefulEvent = false;
    for await (const event of parseSseEvents(response.body)) {
      if (event.type === 'delta') { sawUsefulEvent = true; onDelta?.(event.text); }
      if (event.type === 'error') {
        const error = new Error('Respons chat belum dapat diproses.');
        error.code = event.code;
        throw error;
      }
      if (event.type === 'done') payload = event.message || null;
    }
    if (payload) return payload;
    if (requestId) {
      const snapshot = await loadCanonicalMutation(requestId, {
        apiBase: API_BASE,
        headers: { 'x-laprakin-device': deviceId, 'x-laprakin-client-profile': clientProfile },
        signal: composed.signal,
      });
      if (snapshot?.state === 'completed') return snapshot.response;
    }
    const error = new Error(sawUsefulEvent ? 'Respons chat terputus sebelum selesai.' : 'Respons chat belum dapat diproses.');
    error.code = 'STREAM_INTERRUPTED';
    throw error;
  } catch (netErr) {
    if (netErr?.code) throw netErr;
    const error = new Error(friendlyClientErrorMessage(netErr));
    error.name = netErr?.name || error.name;
    throw error;
  } finally {
    composed.cleanup();
  }
}

export async function download(path, fileName) {
  const headers = { 'x-laprakin-device': deviceId, 'x-laprakin-client-profile': clientProfile };
  if (getCsrfToken()) headers['x-laprakin-csrf'] = getCsrfToken();
  let response;
  try {
    response = await fetch(`${API_BASE}${path.replace('/api', '')}`, {
      credentials: 'include',
      headers,
    });
  } catch (netErr) {
    throw new Error(friendlyClientErrorMessage(netErr));
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(friendlyClientErrorMessage(payload?.error?.message || 'File tidak dapat diunduh.'));
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

