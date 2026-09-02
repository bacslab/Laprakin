import { responseEvents } from '../chat-stream.js';
import { guardedProviderRequest, guardedProviderStream } from '../guarded-provider-client.js';

const RETRYABLE_CODES = new Set([
  'AI_EGRESS_TIMEOUT', 'AI_EGRESS_CONNECT_TIMEOUT', 'AI_EGRESS_NETWORK_FAILED',
  'AI_EGRESS_RATE_LIMITED', 'AI_EGRESS_UPSTREAM_UNAVAILABLE',
]);

export class AiProviderAdapterError extends Error {
  constructor(message, { code = 'AI_PROVIDER_ERROR', status = 502, retryable = false } = {}) {
    super(message);
    this.name = 'AiProviderAdapterError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function capability(model, names) {
  const values = [
    ...names.map((name) => model?.[name]),
    ...names.map((name) => model?.capabilities?.[name]),
  ];
  return values.find((value) => typeof value === 'boolean') ?? null;
}

export function normalizeDiscoveredModel(model, providerId) {
  const modelId = String(model?.id || model?.name || '').replace(/^models\//, '').trim();
  const supported = Array.isArray(model?.supported_generation_methods) ? model.supported_generation_methods : [];
  const values = {
    vision: capability(model, ['supportsVision', 'supports_vision', 'vision', 'multimodal']),
    reasoning: capability(model, ['supportsReasoning', 'supports_reasoning', 'reasoning', 'thinking']),
    structuredOutput: capability(model, ['supportsStructuredOutput', 'supports_structured_output', 'structuredOutput', 'jsonMode']),
    tools: capability(model, ['supportsTools', 'supports_tools', 'tools', 'functionCalling']),
  };
  if (values.structuredOutput == null && supported.includes('json_schema')) values.structuredOutput = true;
  if (values.tools == null && supported.includes('tools')) values.tools = true;
  return {
    providerId,
    modelId,
    source: 'discovered',
    enabled: true,
    state: 'available',
    capabilities: values,
    capabilityEvidence: Object.fromEntries(Object.entries(values).map(([name, value]) => [name, value == null ? 'unverified' : 'provider'])),
    contextWindow: Number(model?.context_length || model?.contextLength || model?.inputTokenLimit || 0) || 0,
    maxOutputTokens: Number(model?.max_output_tokens || model?.maxOutputTokens || model?.outputTokenLimit || 0) || 0,
    health: 'available',
  };
}

function completionBody({ model, messages = [], maxOutputTokens, responseJsonSchema, supportsStructuredOutput, reasoningEffort, stream = false }) {
  const body = { model, messages, max_tokens: maxOutputTokens, reasoning_effort: reasoningEffort };
  if (stream) body.stream = true;
  if (responseJsonSchema && supportsStructuredOutput) {
    body.response_format = { type: 'json_schema', json_schema: { name: 'laprakin_response', strict: true, schema: responseJsonSchema } };
  }
  return body;
}

function contentType(response) {
  return String(response?.headers?.['content-type'] || response?.headers?.get?.('content-type') || '');
}

function deltaText(payload) {
  return String(payload?.choices?.[0]?.delta?.content ?? payload?.choices?.[0]?.message?.content ?? '');
}

async function bodyJson(response) {
  if (typeof response?.json === 'function') return response.json();
  const chunks = [];
  for await (const chunk of response?.body || []) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {
    throw new AiProviderAdapterError('Provider returned an invalid response.', { code: 'AI_PROVIDER_INVALID_JSON', status: 502 });
  }
}

export function createOpenAiCompatibleAdapter({
  id,
  displayName = id,
  baseUrl,
  getToken,
  policy = {},
  request = guardedProviderRequest,
  streamRequest = guardedProviderStream,
  connectTimeoutMs = 5_000,
  requestTimeoutMs = 45_000,
  modelListTimeoutMs = 15_000,
  maxResponseBytes = 2 * 1024 * 1024,
} = {}) {
  const providerId = String(id || '').trim().toLowerCase();
  const root = String(baseUrl || '').replace(/\/$/, '');
  if (!providerId || !root || typeof getToken !== 'function') throw new TypeError('OpenAI-compatible adapter configuration is incomplete.');

  const normalizeError = (error) => {
    if (error instanceof AiProviderAdapterError) return error;
    const egressCode = String(error?.code || '');
    if (egressCode) {
      return new AiProviderAdapterError('Provider request could not be completed safely.', {
        code: egressCode,
        status: Number(error?.status || 502),
        retryable: RETRYABLE_CODES.has(egressCode),
      });
    }
    return new AiProviderAdapterError('Provider network request failed.', { code: 'AI_PROVIDER_NETWORK_FAILED', status: 502, retryable: true });
  };

  const authorization = async () => {
    const token = String(await getToken() || '');
    if (!token) throw new AiProviderAdapterError('Provider credentials are not configured.', { code: 'AI_PROVIDER_NOT_CONFIGURED', status: 503 });
    return `Bearer ${token}`;
  };

  const requestOptions = async ({ endpoint, method = 'GET', body, timeoutMs, signal }) => ({
    url: `${root}${endpoint}`,
    method,
    headers: {
      accept: 'application/json',
      ...(body == null ? {} : { 'content-type': 'application/json' }),
      authorization: await authorization(),
    },
    ...(body == null ? {} : { body: JSON.stringify(body) }),
    timeoutMs,
    connectTimeoutMs,
    maxBytes: maxResponseBytes,
    policy,
    signal,
  });

  const adapter = {
    id: providerId,
    displayName,
    normalizeError,
    async discoverModels({ signal } = {}) {
      try {
        const response = await request(await requestOptions({ endpoint: '/models', timeoutMs: modelListTimeoutMs, signal }));
        const payload = await bodyJson(response);
        const models = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
        return models.map((model) => normalizeDiscoveredModel(model, providerId)).filter((model) => model.modelId);
      } catch (error) { throw normalizeError(error); }
    },
    async testConnection(options = {}) {
      const models = await adapter.discoverModels(options);
      return { ok: models.length > 0, providerId, modelCount: models.length, models };
    },
    async complete(input = {}) {
      try {
        const body = completionBody(input);
        const response = await request(await requestOptions({ endpoint: '/chat/completions', method: 'POST', body, timeoutMs: input.timeoutMs || requestTimeoutMs, signal: input.signal }));
        return await bodyJson(response);
      } catch (error) { throw normalizeError(error); }
    },
    async runCanary({ model, signal, timeoutMs = requestTimeoutMs } = {}) {
      const payload = await adapter.complete({
        model, signal, timeoutMs, messages: [{ role: 'user', content: 'Reply with OK.' }], maxOutputTokens: 8,
      });
      return { ok: Boolean(deltaText(payload).trim()), providerId, modelId: model, usage: payload?.usage || {} };
    },
    async *stream(input = {}) {
      try {
        const body = completionBody({ ...input, stream: true });
        const response = await streamRequest(await requestOptions({ endpoint: '/chat/completions', method: 'POST', body, timeoutMs: input.timeoutMs || requestTimeoutMs, signal: input.signal }));
        if (!contentType(response).includes('text/event-stream')) {
          const payload = await bodyJson(response);
          const text = deltaText(payload);
          if (!text) throw new AiProviderAdapterError('Provider returned an empty response.', { code: 'AI_EMPTY_RESPONSE', retryable: true });
          yield { type: 'delta', text };
          yield { type: 'done', message: text, usage: payload?.usage || {}, finishReason: String(payload?.choices?.[0]?.finish_reason || '') };
          return;
        }
        let message = '';
        let usage = {};
        let finishReason = '';
        for await (const event of responseEvents(response)) {
          if (event?.type === 'error') throw new AiProviderAdapterError('Provider stream failed.', { code: String(event?.code || 'AI_STREAM_ERROR').slice(0, 80) });
          if (event?.usage) usage = event.usage;
          if (event?.choices?.[0]?.finish_reason) finishReason = String(event.choices[0].finish_reason);
          const text = deltaText(event);
          if (!text) continue;
          message += text;
          yield { type: 'delta', text };
        }
        if (!message) throw new AiProviderAdapterError('Provider returned an empty response.', { code: 'AI_EMPTY_RESPONSE', retryable: true });
        const done = { type: 'done', message, usage };
        if (finishReason) done.finishReason = finishReason;
        yield done;
      } catch (error) { throw normalizeError(error); }
    },
  };
  return Object.freeze(adapter);
}
