const DRAFT_PREFIX = 'laprakin-chat-request:';

export function composeRequestSignal({ signal, timeoutMs = 60000 } = {}) {
  const controller = new AbortController();
  const abortFromCaller = () => {
    if (!controller.signal.aborted) controller.abort(signal?.reason || new DOMException('Request canceled', 'AbortError'));
  };
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timer = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? setTimeout(() => {
      if (!controller.signal.aborted) controller.abort(new DOMException('Request timed out', 'TimeoutError'));
    }, timeoutMs)
    : null;
  return {
    signal: controller.signal,
    cleanup() {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', abortFromCaller);
    },
  };
}

export function classifyRequestFailure(error) {
  if (error?.name === 'TimeoutError' || error?.code === 'REQUEST_TIMEOUT') return 'REQUEST_TIMEOUT';
  if (error?.name === 'AbortError' || error?.code === 'REQUEST_CANCELED') return 'REQUEST_CANCELED';
  if (error?.code === 'CHAT_STREAM_INCOMPLETE' || error?.code === 'STREAM_INTERRUPTED') return 'STREAM_INTERRUPTED';
  return 'REQUEST_FAILED';
}

export async function parseOriginalResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function loadCanonicalMutation(requestId, {
  fetchImpl = fetch,
  apiBase = '/api',
  headers = {},
  signal,
} = {}) {
  const response = await fetchImpl(`${apiBase}/mutations/${encodeURIComponent(requestId)}`, {
    method: 'GET',
    credentials: 'include',
    headers,
    signal,
  });
  const payload = await parseOriginalResponse(response);
  if (!response.ok && response.status !== 202 && response.status !== 409) {
    const error = new Error(payload?.error?.message || 'Status permintaan tidak dapat dibaca.');
    error.code = payload?.error?.code || 'CANONICAL_LOOKUP_FAILED';
    error.payload = payload;
    throw error;
  }
  return payload;
}

function draftKey(sessionId) {
  return `${DRAFT_PREFIX}${sessionId}`;
}

export function rememberDraftRequest(draft, storage = sessionStorage) {
  storage.setItem(draftKey(draft.sessionId), JSON.stringify(draft));
  return draft;
}

export function loadDraftRequest(draft, storage = sessionStorage) {
  let saved;
  try {
    saved = JSON.parse(storage.getItem(draftKey(draft.sessionId)) || 'null');
  } catch {
    return null;
  }
  if (!saved || saved.content !== draft.content || saved.aiMode !== draft.aiMode) return null;
  return saved;
}

export function clearDraftRequest(sessionId, requestId, storage = sessionStorage) {
  const key = draftKey(sessionId);
  let saved;
  try { saved = JSON.parse(storage.getItem(key) || 'null'); } catch { saved = null; }
  if (!saved || saved.requestId === requestId) storage.removeItem(key);
}
