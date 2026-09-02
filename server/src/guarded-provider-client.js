import http from 'node:http';
import https from 'node:https';
import { AiEgressPolicyError, resolveAndValidateHost, validateProviderUrl } from './ai-egress-policy.js';

class GuardedProviderError extends Error {
  constructor(message, code, status = 502) {
    super(message);
    this.name = 'GuardedProviderError';
    this.code = code;
    this.status = status;
  }
}

function pinnedLookup(address, family) {
  return (_hostname, options, callback) => {
    if (options?.all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  };
}

function nodeTransport({ url, method, headers, body, address, family, serverName, connectTimeoutMs, signal }) {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).request(url, {
      method,
      headers,
      lookup: pinnedLookup(address, family),
      ...(url.protocol === 'https:' ? { servername: serverName } : {}),
      signal,
    }, (response) => resolve({ status: response.statusCode || 0, headers: response.headers, body: response }));
    let connectionTimer = null;
    request.on('socket', (socket) => {
      connectionTimer = setTimeout(() => request.destroy(new GuardedProviderError('Provider connection timed out.', 'AI_EGRESS_CONNECT_TIMEOUT', 504)), connectTimeoutMs);
      const event = url.protocol === 'https:' ? 'secureConnect' : 'connect';
      socket.once(event, () => clearTimeout(connectionTimer));
    });
    request.once('error', (error) => {
      if (connectionTimer) clearTimeout(connectionTimer);
      reject(error);
    });
    if (body?.length) request.write(body);
    request.end();
  });
}

function responseError(status) {
  if (status === 401 || status === 403) return new GuardedProviderError('Provider authentication failed.', 'AI_EGRESS_AUTH_FAILED', 502);
  if (status === 429) return new GuardedProviderError('Provider rate limit was reached.', 'AI_EGRESS_RATE_LIMITED', 429);
  if (status >= 500) return new GuardedProviderError('Provider is unavailable.', 'AI_EGRESS_UPSTREAM_UNAVAILABLE', 502);
  return new GuardedProviderError('Provider rejected the request.', 'AI_EGRESS_REQUEST_REJECTED', 502);
}

async function collectBody(body, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of body || []) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) {
      body?.destroy?.();
      throw new GuardedProviderError('Provider response exceeded the safe size limit.', 'AI_EGRESS_RESPONSE_TOO_LARGE', 502);
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function requestBodyBytes(body, maxRequestBytes) {
  const bytes = body == null ? Buffer.alloc(0) : Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  if (bytes.length > maxRequestBytes) {
    throw new GuardedProviderError('Provider request exceeded the safe size limit.', 'AI_EGRESS_REQUEST_TOO_LARGE', 413);
  }
  return bytes;
}

function safeResponseHeaders(headers) {
  return { 'content-type': String(headers?.['content-type'] || headers?.get?.('content-type') || '') };
}

function validateResponse(response) {
  if (response.status >= 300 && response.status < 400) {
    response.body?.destroy?.();
    throw new GuardedProviderError('Provider redirect was blocked.', 'AI_EGRESS_REDIRECT_BLOCKED', 502);
  }
  if (response.status < 200 || response.status >= 300) {
    response.body?.destroy?.();
    throw responseError(response.status);
  }
}

function operationScope({ timeoutMs, signal }) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener?.('abort', abortFromCaller, { once: true });
  let rejectTimeout;
  const timeout = new Promise((_, reject) => { rejectTimeout = reject; });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
    rejectTimeout(new GuardedProviderError('Provider request timed out.', 'AI_EGRESS_TIMEOUT', 504));
  }, Math.max(10, Number(timeoutMs) || 15_000));
  const cleanup = () => {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', abortFromCaller);
  };
  return { controller, timeout, cleanup, didTimeOut: () => timedOut };
}

function normalizeNetworkError(error, scope) {
  if (error instanceof GuardedProviderError || error instanceof AiEgressPolicyError) return error;
  if (scope.didTimeOut()) return new GuardedProviderError('Provider request timed out.', 'AI_EGRESS_TIMEOUT', 504);
  if (scope.controller.signal.aborted || error?.name === 'AbortError') {
    return new GuardedProviderError('Provider request was cancelled.', 'AI_EGRESS_CANCELLED', 499);
  }
  return new GuardedProviderError('Provider network request failed.', 'AI_EGRESS_NETWORK_FAILED', 502);
}

async function openProviderResponse({
  url, method, headers, requestBody, connectTimeoutMs, policy, lookup, transport, scope,
}) {
  try {
    const resolution = await resolveAndValidateHost(url.hostname, { ...policy, ...(lookup ? { lookup } : {}) });
    const selected = resolution.addresses[0];
    return await transport({
      url,
      method: String(method || 'GET').toUpperCase(),
      headers: { ...headers },
      body: requestBody,
      address: selected.address,
      family: selected.family,
      serverName: resolution.hostname,
      connectTimeoutMs: Math.max(100, Number(connectTimeoutMs) || 5_000),
      signal: scope.controller.signal,
    });
  } catch (error) {
    throw normalizeNetworkError(error, scope);
  }
}

export async function guardedProviderRequest({
  url: inputUrl,
  method = 'GET',
  headers = {},
  body = null,
  timeoutMs = 15_000,
  connectTimeoutMs = 5_000,
  maxBytes = 2 * 1024 * 1024,
  maxRequestBytes = 4 * 1024 * 1024,
  policy = {},
  lookup,
  transport = nodeTransport,
  signal,
} = {}) {
  const url = validateProviderUrl(inputUrl, policy);
  const requestBody = requestBodyBytes(body, maxRequestBytes);
  const scope = operationScope({ timeoutMs, signal });
  try {
    const operation = (async () => {
      const response = await openProviderResponse({ url, method, headers, requestBody, connectTimeoutMs, policy, lookup, transport, scope });
      validateResponse(response);
      const bytes = await collectBody(response.body, Math.max(1, Number(maxBytes) || 1));
      return {
        status: response.status,
        ok: true,
        headers: safeResponseHeaders(response.headers),
        bytes,
        text: async () => bytes.toString('utf8'),
        json: async () => {
          try { return JSON.parse(bytes.toString('utf8')); } catch {
            throw new GuardedProviderError('Provider returned invalid JSON.', 'AI_EGRESS_INVALID_JSON', 502);
          }
        },
      };
    })();
    return await Promise.race([operation, scope.timeout]);
  } finally {
    scope.cleanup();
  }
}

export async function guardedProviderStream({
  url: inputUrl,
  method = 'GET',
  headers = {},
  body = null,
  timeoutMs = 15_000,
  connectTimeoutMs = 5_000,
  maxBytes = 2 * 1024 * 1024,
  maxRequestBytes = 4 * 1024 * 1024,
  policy = {},
  lookup,
  transport = nodeTransport,
  signal,
} = {}) {
  const url = validateProviderUrl(inputUrl, policy);
  const requestBody = requestBodyBytes(body, maxRequestBytes);
  const scope = operationScope({ timeoutMs, signal });
  try {
    const response = await Promise.race([
      openProviderResponse({ url, method, headers, requestBody, connectTimeoutMs, policy, lookup, transport, scope }),
      scope.timeout,
    ]);
    validateResponse(response);
    const limit = Math.max(1, Number(maxBytes) || 1);
    const source = response.body;
    return {
      status: response.status,
      ok: true,
      headers: safeResponseHeaders(response.headers),
      body: (async function* boundedBody() {
        let size = 0;
        try {
          for await (const chunk of source || []) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += buffer.length;
            if (size > limit) {
              source?.destroy?.();
              throw new GuardedProviderError('Provider response exceeded the safe size limit.', 'AI_EGRESS_RESPONSE_TOO_LARGE', 502);
            }
            yield buffer;
          }
        } catch (error) {
          throw normalizeNetworkError(error, scope);
        } finally {
          scope.cleanup();
        }
      })(),
    };
  } catch (error) {
    scope.cleanup();
    throw normalizeNetworkError(error, scope);
  }
}

export { GuardedProviderError };
