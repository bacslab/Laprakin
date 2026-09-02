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
} = {}) {
  const url = validateProviderUrl(inputUrl, policy);
  const requestBody = body == null ? Buffer.alloc(0) : Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  if (requestBody.length > maxRequestBytes) {
    throw new GuardedProviderError('Provider request exceeded the safe size limit.', 'AI_EGRESS_REQUEST_TOO_LARGE', 413);
  }
  const resolution = await resolveAndValidateHost(url.hostname, { ...policy, ...(lookup ? { lookup } : {}) });
  const selected = resolution.addresses[0];
  const controller = new AbortController();
  let timer;
  try {
    const operation = (async () => {
      let response;
      try {
        response = await transport({
          url,
          method: String(method || 'GET').toUpperCase(),
          headers: { ...headers },
          body: requestBody,
          address: selected.address,
          family: selected.family,
          serverName: resolution.hostname,
          connectTimeoutMs: Math.max(100, Number(connectTimeoutMs) || 5_000),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof GuardedProviderError || error instanceof AiEgressPolicyError) throw error;
        if (controller.signal.aborted || error?.name === 'AbortError') {
          throw new GuardedProviderError('Provider request timed out.', 'AI_EGRESS_TIMEOUT', 504);
        }
        throw new GuardedProviderError('Provider network request failed.', 'AI_EGRESS_NETWORK_FAILED', 502);
      }
      if (response.status >= 300 && response.status < 400) {
        response.body?.destroy?.();
        throw new GuardedProviderError('Provider redirect was blocked.', 'AI_EGRESS_REDIRECT_BLOCKED', 502);
      }
      if (response.status < 200 || response.status >= 300) {
        response.body?.destroy?.();
        throw responseError(response.status);
      }
      const bytes = await collectBody(response.body, Math.max(1, Number(maxBytes) || 1));
      const safeHeaders = { 'content-type': String(response.headers?.['content-type'] || response.headers?.get?.('content-type') || '') };
      return {
        status: response.status,
        ok: true,
        headers: safeHeaders,
        bytes,
        text: async () => bytes.toString('utf8'),
        json: async () => {
          try { return JSON.parse(bytes.toString('utf8')); } catch {
            throw new GuardedProviderError('Provider returned invalid JSON.', 'AI_EGRESS_INVALID_JSON', 502);
          }
        },
      };
    })();
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new GuardedProviderError('Provider request timed out.', 'AI_EGRESS_TIMEOUT', 504));
      }, Math.max(10, Number(timeoutMs) || 15_000));
    });
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export { GuardedProviderError };
