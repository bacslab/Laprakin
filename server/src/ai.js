import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { config } from './config.js';
import { audit, db } from './db.js';
import { moderationMessage, moderateText } from './content-safety.js';
import { HttpError, now } from './utils.js';
import { responseEvents } from './chat-stream.js';

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const SAFETY_FINISH_REASONS = new Set(['content_filter', 'safety', 'blocked']);
const MAX_OUTPUT_TOKEN_CEILING = 32768;
const registryPath = path.join(config.dataDir, 'ai-model-registry.json');

let modelRegistry = [];
let registryLoadedAt = 0;
let discoveryPromise = null;
const circuitState = new Map();
const providerQueue = [];
let queueSequence = 0;
let activeRequests = 0;
let lastDispatchAt = 0;
let queueTimer = null;

export class AiProviderError extends Error {
  constructor(message, { code = 'AI_PROVIDER_ERROR', status = 502, retryable = false } = {}) {
    super(message);
    this.name = 'AiProviderError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function isDocumentPurpose(purpose = '') {
  const normalized = String(purpose || '').toLowerCase();
  return normalized === 'document' || normalized.startsWith('document_');
}

function isVisionRequest({ purpose, mode, requiresVision, contents }) {
  if (requiresVision || /visual|screenshot|evidence_image|image/i.test(`${purpose} ${mode}`)) return true;
  return JSON.stringify(contents || []).includes('inlineData') || JSON.stringify(contents || []).includes('image_url');
}

function modelName(model) {
  return String(model?.id || model?.name || '').replace(/^models\//, '').trim();
}

function booleanCapability(model, names) {
  const values = [
    ...names.map((name) => model?.[name]),
    ...names.map((name) => model?.capabilities?.[name]),
  ];
  return values.find((value) => typeof value === 'boolean') ?? null;
}

function normalizeModel(model) {
  const id = modelName(model);
  const lower = id.toLowerCase();
  const vision = booleanCapability(model, ['supportsVision', 'supports_vision', 'vision', 'multimodal']);
  const reasoning = booleanCapability(model, ['supportsReasoning', 'supports_reasoning', 'reasoning', 'thinking']);
  const structured = booleanCapability(model, ['supportsStructuredOutput', 'supports_structured_output', 'structuredOutput', 'jsonMode']);
  const tools = booleanCapability(model, ['supportsTools', 'supports_tools', 'tools', 'functionCalling']);
  return {
    model: id,
    provider: 'nararouter',
    contextLimit: Number(model?.context_length || model?.contextLength || model?.inputTokenLimit || 0) || 128000,
    supportsVision: vision ?? /vision|vl|multimodal|stepfun|step-3/i.test(lower),
    supportsReasoning: reasoning ?? /reason|thinking|mistral|stepfun|step-3/i.test(lower),
    supportsStructuredOutput: structured ?? Boolean(model?.supported_generation_methods?.includes?.('json_schema')),
    supportsTools: tools ?? Boolean(model?.supported_generation_methods?.includes?.('tools')),
  };
}

function readCachedRegistry() {
  try {
    const cached = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    if (Array.isArray(cached?.models)) {
      modelRegistry = cached.models.map(normalizeModel).filter((model) => model.model);
      registryLoadedAt = Number(cached.updatedAt || 0);
    }
  } catch { /* Cache is optional and may not exist on a new install. */ }
}

readCachedRegistry();

function cacheRegistry(models) {
  modelRegistry = models.map(normalizeModel).filter((model) => model.model);
  registryLoadedAt = Date.now();
  try {
    fs.mkdirSync(config.dataDir, { recursive: true });
    fs.writeFileSync(registryPath, JSON.stringify({ updatedAt: registryLoadedAt, models: modelRegistry }, null, 2));
  } catch (error) {
    console.warn('[ai] capability cache unavailable:', error?.message || error);
  }
}

function timeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5000, Math.min(120000, Number(timeoutMs) || config.aiRequestTimeoutMs)));
  return { controller, timer };
}

async function fetchModels() {
  if (!config.naraRouterApiKey) throw new AiProviderError('NaraRouter belum dikonfigurasi.', { code: 'AI_NOT_CONFIGURED', status: 503 });
  const { controller, timer } = timeoutSignal(config.aiRequestTimeoutMs);
  try {
    const response = await fetch(`${config.naraRouterBaseUrl}/models`, {
      headers: { accept: 'application/json', authorization: `Bearer ${config.naraRouterApiKey}` },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw providerError(response.status, payload);
    const models = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
    if (!models.length) throw new AiProviderError('NaraRouter tidak mengembalikan daftar model.', { code: 'NARAROUTER_MODELS_EMPTY', status: 502, retryable: true });
    cacheRegistry(models);
    return modelRegistry;
  } catch (error) {
    if (error instanceof AiProviderError) throw error;
    throw new AiProviderError(error?.name === 'AbortError' ? 'Pencarian model NaraRouter melewati batas waktu.' : 'NaraRouter tidak dapat dihubungi.', {
      code: error?.name === 'AbortError' ? 'AI_TIMEOUT' : 'AI_NETWORK_ERROR', status: error?.name === 'AbortError' ? 504 : 502, retryable: true,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function initializeAiModelRegistry() {
  if (discoveryPromise) return discoveryPromise;
  discoveryPromise = fetchModels().catch((error) => {
    if (!modelRegistry.length) console.warn('[ai] model discovery failed; no cached registry:', error?.code || error?.message || error);
    return modelRegistry;
  }).finally(() => { discoveryPromise = null; });
  return discoveryPromise;
}

export function getAiReadiness() {
  const textModels = modelRegistry.filter((model) => !model.supportsVision || model.supportsReasoning || /text|mistral|qwen|llama/i.test(model.model));
  const visionModels = modelRegistry.filter((model) => model.supportsVision);
  const documentModels = modelRegistry.filter((model) => !model.supportsVision || model.supportsReasoning || model.supportsStructuredOutput);
  return {
    provider: 'nararouter',
    configured: Boolean(config.naraRouterApiKey),
    registryCached: modelRegistry.length > 0,
    registryUpdatedAt: registryLoadedAt ? new Date(registryLoadedAt).toISOString() : null,
    textReady: textModels.length > 0,
    documentReady: documentModels.length > 0,
    visionReady: visionModels.length > 0,
    models: modelRegistry,
  };
}

export function isAiConfigured() {
  return Boolean(config.naraRouterApiKey && getAiReadiness().textReady && getAiReadiness().documentReady);
}

function preferredModel(route, models) {
  const override = route === 'document' ? config.aiModelDocument : route === 'vision' ? config.aiModelVision : route === 'reviewer' ? config.aiModelReviewer : config.aiModelChat;
  if (override && override !== 'auto' && models.some((model) => model.model === override)) return override;
  const patterns = {
    vision: [/stepfun.*3[._ -]?7.*flash/i, /stepfun.*flash/i, /step[-_ ]?3.*flash/i, /vision|vl|multimodal/i],
    document: [/mistral.*medium.*3[._ -]?5/i, /mistral.*medium/i, /mistral/i],
    reviewer: [/mistral.*large/i, /large/i, /reason/i],
    chat: [/mistral.*medium.*3[._ -]?5/i, /mistral.*medium/i, /mistral/i],
  }[route];
  return patterns.map((pattern) => models.find((model) => pattern.test(model.model))).find(Boolean)?.model || '';
}

export function modelEligibleForRoute(model, { visual = false, requiresStructuredOutput = false, route = 'chat' } = {}) {
  // JSON tetap bisa dijaga melalui instruksi skema ketika provider belum
  // mengiklankan dukungan response_format. Dukungan visual tidak bisa dipalsukan.
  void requiresStructuredOutput;
  void route;
  return !visual || model?.supportsVision === true;
}

export function selectAiRoute({ purpose = 'chat', mode = 'basic', requiresVision = false, requiresStructuredOutput = false, contents = [] } = {}) {
  const visual = isVisionRequest({ purpose, mode, requiresVision, contents });
  const route = visual ? 'vision' : /review|repair|difficult|hard/i.test(`${purpose} ${mode}`) ? 'reviewer' : isDocumentPurpose(purpose) || /workplan|quiz/i.test(purpose) ? 'document' : 'chat';
  const eligible = modelRegistry.filter((model) => modelEligibleForRoute(model, { visual, requiresStructuredOutput, route }));
  const selected = preferredModel(route, eligible) || eligible[0]?.model || '';
  const fallbackOrder = route === 'document'
    ? [/mistral.*large/i, /mistral/i, /text|qwen|llama/i]
    : route === 'vision'
      ? [/stepfun/i, /vision|vl|multimodal/i]
      : [/mistral.*medium/i, /mistral/i, /text|qwen|llama/i];
  const fallbackModels = eligible
    .filter((model) => model.model !== selected)
    .sort((left, right) => {
      const leftRank = fallbackOrder.findIndex((pattern) => pattern.test(left.model));
      const rightRank = fallbackOrder.findIndex((pattern) => pattern.test(right.model));
      return (leftRank < 0 ? 99 : leftRank) - (rightRank < 0 ? 99 : rightRank);
    })
    .map((model) => model.model);
  const reasoningEffort = /xtrathink|hard|difficult|repair/i.test(`${purpose} ${mode}`) ? 'high' : /thinking|document|evidence|workplan|quiz/i.test(`${purpose} ${mode}`) ? 'medium' : 'low';
  return { provider: 'nararouter', route, model: selected, candidates: [selected, ...fallbackModels].filter(Boolean), reasoningEffort, requiresVision: visual };
}

export function aiModelFor(mode = 'basic', purpose = 'chat') {
  return selectAiRoute({ purpose, mode }).model || (isDocumentPurpose(purpose) ? config.aiModelDocument : config.aiModelChat);
}

export function aiThinkingConfigFor({ model, mode = 'basic', purpose = 'chat' }) {
  const effort = /xtrathink|hard|difficult|repair/i.test(`${purpose} ${mode}`) ? 'high' : /thinking|document|evidence|workplan|quiz/i.test(`${purpose} ${mode}`) ? 'medium' : 'low';
  return { model: model || '', reasoning_effort: effort };
}

function reserveUsage({ userId, purpose, mode, model, contextType = '', contextId = '' }) {
  const id = nanoid();
  let transactionOpen = false;
  try {
    db.exec('BEGIN IMMEDIATE');
    transactionOpen = true;
    const dailySince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    if (Number(db.prepare('SELECT COUNT(*) AS count FROM ai_usage_events WHERE created_at >= ?').get(dailySince)?.count || 0) >= config.aiMaxRequestsPerDay) {
      throw new HttpError(429, 'Kapasitas AI harian sedang penuh. Coba lagi nanti.', 'AI_DAILY_LIMIT');
    }
    if (userId) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      if (Number(db.prepare('SELECT COUNT(*) AS count FROM ai_usage_events WHERE user_id = ? AND created_at >= ?').get(userId, since)?.count || 0) >= config.aiMaxRequestsPerHour) {
        throw new HttpError(429, 'Batas pemakaian AI per jam tercapai. Coba lagi setelah jeda singkat.', 'AI_USER_RATE_LIMIT');
      }
    }
    db.prepare(`
      INSERT INTO ai_usage_events (id, user_id, purpose, mode, provider, model, status, input_tokens, output_tokens, reasoning_tokens, total_tokens, latency_ms, error_code, fallback_count, fallback_reason, created_at, context_type, context_id)
      VALUES (?, ?, ?, ?, 'nararouter', ?, 'pending', 0, 0, 0, 0, 0, '', 0, '', ?, ?, ?)
    `).run(id, userId || null, String(purpose || 'chat').slice(0, 32), String(mode || 'basic').slice(0, 24), String(model || 'unresolved').slice(0, 100), now(), String(contextType || '').slice(0, 32), String(contextId || '').slice(0, 120));
    db.exec('COMMIT');
    transactionOpen = false;
    return id;
  } catch (error) {
    if (transactionOpen) db.exec('ROLLBACK');
    throw error;
  }
}

function finishUsage(id, { status, usage, latencyMs, errorCode = '', provider = 'nararouter', model = '', fallbackCount = 0, fallbackReason = '' }) {
  const promptTokens = Number(usage?.prompt_tokens ?? usage?.promptTokenCount ?? 0);
  const outputTokens = Number(usage?.completion_tokens ?? usage?.candidatesTokenCount ?? 0);
  const reasoningTokens = Number(usage?.completion_tokens_details?.reasoning_tokens ?? usage?.reasoning_tokens ?? 0);
  const totalTokens = Number(usage?.total_tokens ?? usage?.totalTokenCount ?? promptTokens + outputTokens);
  db.prepare(`UPDATE ai_usage_events SET provider = ?, model = ?, status = ?, input_tokens = ?, output_tokens = ?, reasoning_tokens = ?, total_tokens = ?, latency_ms = ?, error_code = ?, fallback_count = ?, fallback_reason = ? WHERE id = ?`)
    .run(provider, String(model || '').slice(0, 100), status, promptTokens, outputTokens, reasoningTokens, totalTokens, Math.max(0, Math.round(latencyMs || 0)), String(errorCode || '').slice(0, 80), fallbackCount, String(fallbackReason || '').slice(0, 160), id);
}

function providerError(status, payload) {
  const providerCode = String(payload?.error?.code || payload?.error?.type || payload?.error?.status || `HTTP_${status}`).slice(0, 80);
  const retryable = RETRYABLE_STATUS.has(status);
  return new AiProviderError(status === 429 ? 'Kapasitas AI sedang penuh. Coba lagi sebentar.' : status === 401 ? 'NARAROUTER_API_KEY ditolak oleh NaraRouter.' : 'Provider AI belum dapat menyelesaikan permintaan ini.', {
    code: `NARAROUTER_${providerCode.toUpperCase()}`, status: status === 429 ? 429 : status >= 500 ? 502 : status, retryable,
  });
}

function sleep(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

function queueDelayMs() {
  return Math.max(0, Math.ceil((60000 / config.naraRouterMaxRpm) - (Date.now() - lastDispatchAt)));
}

function pumpQueue() {
  if (queueTimer) return;
  const dispatch = () => {
    queueTimer = null;
    while (activeRequests < config.naraRouterMaxConcurrency && providerQueue.length && queueDelayMs() <= 0) {
      const job = providerQueue.shift();
      activeRequests += 1;
      lastDispatchAt = Date.now();
      if (job.lease) {
        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          activeRequests -= 1;
          pumpQueue();
        };
        Promise.resolve().then(() => job.resolve(release)).catch(job.reject);
      } else {
        Promise.resolve().then(job.run).then(job.resolve, job.reject).finally(() => {
          activeRequests -= 1;
          pumpQueue();
        });
      }
    }
    if (providerQueue.length && (activeRequests >= config.naraRouterMaxConcurrency || queueDelayMs() > 0)) {
      queueTimer = setTimeout(dispatch, Math.max(25, queueDelayMs()));
    }
  };
  dispatch();
}

function runInProviderQueue(run, priority = 0) {
  return new Promise((resolve, reject) => {
    providerQueue.push({ run, resolve, reject, priority, sequence: queueSequence += 1 });
    providerQueue.sort((left, right) => (right.priority - left.priority) || (left.sequence - right.sequence));
    pumpQueue();
  });
}

function circuitOpen(model) {
  const state = circuitState.get(model);
  if (!state) return false;
  if (state.openUntil && state.openUntil > Date.now()) return true;
  if (state.openUntil) state.openUntil = 0;
  return false;
}

function recordCircuitFailure(model) {
  const state = circuitState.get(model) || { failures: 0, openUntil: 0 };
  state.failures += 1;
  if (state.failures >= config.aiCircuitFailureThreshold) state.openUntil = Date.now() + config.aiCircuitCooldownMs;
  circuitState.set(model, state);
}

function recordCircuitSuccess(model) { circuitState.set(model, { failures: 0, openUntil: 0 }); }

function toOpenAiMessages(contents = [], systemInstruction = '') {
  const messages = systemInstruction ? [{ role: 'system', content: systemInstruction }] : [];
  for (const item of contents || []) {
    const role = item?.role === 'model' ? 'assistant' : item?.role === 'system' ? 'system' : 'user';
    const parts = Array.isArray(item?.parts) ? item.parts : [{ text: String(item?.content || '') }];
    const content = parts.map((part) => {
      if (typeof part?.text === 'string') return { type: 'text', text: part.text };
      const imageData = part?.inlineData?.data ? `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}` : part?.image_url;
      return imageData ? { type: 'image_url', image_url: { url: typeof imageData === 'string' && imageData.startsWith('data:') ? imageData : imageData?.url || imageData } } : null;
    }).filter(Boolean);
    if (content.length) messages.push({ role, content: content.length === 1 && content[0].type === 'text' ? content[0].text : content });
  }
  return messages;
}

function compactContents(contents, systemInstruction, contextLimit) {
  const seen = new Set();
  const compacted = [];
  for (const item of contents || []) {
    const parts = (item.parts || []).map((part) => {
      if (typeof part?.text !== 'string') return part;
      const key = part.text.replace(/\s+/g, ' ').trim();
      if (seen.has(key)) return null;
      seen.add(key);
      return { ...part, text: part.text };
    }).filter(Boolean);
    if (parts.length) compacted.push({ ...item, parts });
  }
  const messages = toOpenAiMessages(compacted, systemInstruction);
  const estimatedChars = JSON.stringify(messages).length;
  const ceiling = Math.min(Math.floor(contextLimit * 4 * 0.85), config.aiOperationalContextTokens * 4);
  if (estimatedChars <= ceiling) return compacted;
  let remaining = ceiling;
  return compacted.map((item) => ({
    ...item,
    parts: (item.parts || []).map((part) => {
      if (typeof part?.text !== 'string') return part;
      const text = part.text.slice(0, Math.max(1000, remaining));
      remaining -= text.length;
      return { ...part, text };
    }).filter(Boolean),
  })).filter((item) => item.parts?.length);
}

function schemaValid(value, schema) {
  if (!schema) return true;
  const type = String(schema.type || '').toLowerCase();
  if (type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if ((schema.required || []).some((key) => !Object.hasOwn(value, key))) return false;
    return Object.entries(schema.properties || {}).every(([key, child]) => !Object.hasOwn(value, key) || schemaValid(value[key], child));
  }
  if (type === 'array') return Array.isArray(value) && (!schema.minItems || value.length >= schema.minItems) && (!schema.maxItems || value.length <= schema.maxItems) && value.every((item) => schemaValid(item, schema.items));
  if (type === 'string') return typeof value === 'string' && (!schema.minLength || value.length >= schema.minLength);
  if (type === 'integer' || type === 'number') return typeof value === 'number';
  return true;
}

function responseText(payload) { return String(payload?.choices?.[0]?.message?.content || '').trim(); }
function finishReason(payload) { return String(payload?.choices?.[0]?.finish_reason || '').trim(); }
function isTruncated(payload, maxOutputTokens) { return finishReason(payload) === 'length' || Number(payload?.usage?.completion_tokens || 0) >= Number(maxOutputTokens || 0); }

function assertOutputAllowed(text) {
  const decision = moderateText(text, 'output');
  if (decision.action === 'allow') return;
  const error = new HttpError(422, moderationMessage('OUTPUT_POLICY_BLOCKED', 'output'), 'CONTENT_POLICY_BLOCKED');
  error.policyCode = decision.code;
  throw error;
}

async function collectProviderStream(options, onDelta) {
  let text = '';
  let usage = {};
  let finishReason = '';
  for await (const event of streamOpenAiCompatible(options)) {
    if (event?.type === 'error') {
      throw new AiProviderError('Provider AI tidak dapat melanjutkan respons streaming.', {
        code: event.code || 'AI_STREAM_ERROR',
        status: 502,
        retryable: false,
      });
    }
    if (event?.type === 'delta') {
      text += String(event.text || '');
      onDelta?.(String(event.text || ''), text);
    }
    if (event?.type === 'done') {
      usage = event.usage || usage;
      finishReason = event.finishReason || finishReason;
    }
  }
  return { text, usage, finishReason };
}

function acquireProviderSlot(priority = 0) {
  return new Promise((resolve, reject) => {
    providerQueue.push({ lease: true, resolve, reject, priority, sequence: queueSequence += 1 });
    providerQueue.sort((left, right) => (right.priority - left.priority) || (left.sequence - right.sequence));
    pumpQueue();
  });
}

async function requestOpenAiCompatible({ provider, model, messages, maxOutputTokens, responseJsonSchema, supportsStructuredOutput, reasoningEffort, timeoutMs, priority = 0 }) {
  const isCloudflare = provider === 'cloudflare';
  const baseUrl = isCloudflare ? `https://api.cloudflare.com/client/v4/accounts/${config.cloudflareAccountId}/ai/v1` : config.naraRouterBaseUrl;
  const token = isCloudflare ? config.cloudflareAiToken : config.naraRouterApiKey;
  const body = { model, messages, max_tokens: maxOutputTokens, reasoning_effort: reasoningEffort };
  if (responseJsonSchema && supportsStructuredOutput) body.response_format = { type: 'json_schema', json_schema: { name: 'laprakin_response', strict: true, schema: responseJsonSchema } };
  let lastError;
  for (let attempt = 0; attempt < config.aiMaxRetries; attempt += 1) {
    try {
      const result = await runInProviderQueue(async () => {
        const { controller, timer } = timeoutSignal(timeoutMs);
        try {
          const response = await fetch(`${baseUrl}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal: controller.signal });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw providerError(response.status, payload);
          return payload;
        } finally { clearTimeout(timer); }
      }, priority);
      return result;
    } catch (error) {
      lastError = error?.name === 'AbortError' ? new AiProviderError('Provider AI melewati batas waktu.', { code: 'AI_TIMEOUT', status: 504, retryable: true }) : error instanceof AiProviderError ? error : new AiProviderError('Provider AI tidak dapat dihubungi.', { code: 'AI_NETWORK_ERROR', status: 502, retryable: true });
      if (!lastError.retryable || attempt === config.aiMaxRetries - 1) throw lastError;
      await sleep(350 * (2 ** attempt) + Math.floor(Math.random() * 180));
    }
  }
  throw lastError;
}

function streamEndpoint(provider) {
  return provider === 'cloudflare'
    ? `https://api.cloudflare.com/client/v4/accounts/${config.cloudflareAccountId}/ai/v1/chat/completions`
    : `${config.naraRouterBaseUrl}/chat/completions`;
}

function streamToken(provider) {
  return provider === 'cloudflare' ? config.cloudflareAiToken : config.naraRouterApiKey;
}

function streamDelta(payload) {
  return String(payload?.choices?.[0]?.delta?.content ?? payload?.choices?.[0]?.message?.content ?? '');
}

function streamProviderError(payload, status) {
  const providerCode = String(payload?.error?.code || payload?.error?.type || payload?.error?.status || `HTTP_${status}`).slice(0, 80);
  return new AiProviderError('Provider AI tidak dapat melanjutkan respons streaming.', {
    code: status ? `NARAROUTER_${providerCode.toUpperCase()}` : providerCode.toUpperCase(),
    status: status === 429 ? 429 : status >= 500 ? 502 : status || 502,
    retryable: status ? RETRYABLE_STATUS.has(status) : false,
  });
}

function combinedAbortSignal(controller, signal) {
  if (!signal) return controller.signal;
  if (signal.aborted) controller.abort(signal.reason);
  else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  return controller.signal;
}

/**
 * Relay one OpenAI-compatible provider stream. The returned iterator contains
 * the raw generated text so structured chat responses can be parsed only once,
 * after the final provider event arrives.
 */
export async function* streamOpenAiCompatible({
  provider = 'nararouter',
  model,
  messages,
  maxOutputTokens,
  responseJsonSchema,
  supportsStructuredOutput = false,
  reasoningEffort,
  timeoutMs = config.aiRequestTimeoutMs,
  priority = 0,
  signal,
  fetchImpl = fetch,
}) {
  const body = { model, messages, max_tokens: maxOutputTokens, reasoning_effort: reasoningEffort, stream: true };
  if (responseJsonSchema && supportsStructuredOutput) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: 'laprakin_response', strict: true, schema: responseJsonSchema },
    };
  }
  let lastError;
  for (let attempt = 0; attempt < config.aiMaxRetries; attempt += 1) {
    let release;
    let emitted = false;
    try {
      release = await acquireProviderSlot(priority);
      const timeout = timeoutSignal(timeoutMs);
      try {
        const response = await fetchImpl(streamEndpoint(provider), {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${streamToken(provider)}` },
          body: JSON.stringify(body),
          signal: combinedAbortSignal(timeout.controller, signal),
        });
        const contentType = response.headers.get('content-type') || '';
        const payload = contentType.includes('text/event-stream')
          ? null
          : await response.json().catch(() => ({}));
        if (!response.ok) throw streamProviderError(payload, response.status);
        if (!contentType.includes('text/event-stream')) {
          const text = streamDelta(payload);
          if (!text) throw new AiProviderError('Provider AI tidak mengembalikan teks.', { code: 'AI_EMPTY_RESPONSE', status: 502, retryable: true });
          emitted = true;
          yield { type: 'delta', text };
          yield { type: 'done', message: text, usage: payload?.usage || {}, finishReason: String(payload?.choices?.[0]?.finish_reason || '') };
          return;
        }

        let message = '';
        let usage = {};
        let finishReason = '';
        for await (const event of responseEvents(response)) {
          if (event?.type === 'error') throw streamProviderError(event, 502);
          if (event?.usage) usage = event.usage;
          if (event?.choices?.[0]?.finish_reason) finishReason = String(event.choices[0].finish_reason);
          const text = streamDelta(event);
          if (!text) continue;
          emitted = true;
          message += text;
          yield { type: 'delta', text };
        }
        if (!message) throw new AiProviderError('Provider AI tidak mengembalikan teks.', { code: 'AI_EMPTY_RESPONSE', status: 502, retryable: true });
        const doneEvent = { type: 'done', message, usage };
        if (finishReason) doneEvent.finishReason = finishReason;
        yield doneEvent;
        return;
      } finally {
        clearTimeout(timeout.timer);
        release?.();
      }
    } catch (error) {
      release?.();
      lastError = error?.name === 'AbortError'
        ? new AiProviderError('Provider AI melewati batas waktu.', { code: 'AI_TIMEOUT', status: 504, retryable: true })
        : error instanceof AiProviderError
          ? error
          : new AiProviderError('Provider AI tidak dapat dihubungi.', { code: 'AI_NETWORK_ERROR', status: 502, retryable: true });
      if (!lastError.retryable || emitted || attempt === config.aiMaxRetries - 1) {
        yield { type: 'error', code: lastError.code };
        return;
      }
      await sleep(350 * (2 ** attempt) + Math.floor(Math.random() * 180));
    }
  }
  yield { type: 'error', code: lastError?.code || 'AI_PROVIDER_ERROR' };
}

export async function generateAiContent({ userId = null, contextType = '', contextId = '', purpose = 'chat', mode = 'basic', contents, systemInstruction = '', maxOutputTokens = 1200, responseMimeType = 'text/plain', responseJsonSchema, requiresVision = false, requestTimeoutMs = config.aiRequestTimeoutMs, onDelta = null, signal = null }) {
  if (!config.naraRouterApiKey) throw new HttpError(503, 'Provider AI belum dikonfigurasi.', 'AI_NOT_CONFIGURED');
  if (!modelRegistry.length) await initializeAiModelRegistry();
  const route = selectAiRoute({ purpose, mode, requiresVision, contents, requiresStructuredOutput: Boolean(responseJsonSchema) });
  const visual = route.requiresVision;
  const candidates = route.candidates.length ? route.candidates : [config.cloudflareAiModel];
  const usageEventId = reserveUsage({ userId, purpose, mode, model: route.model, contextType, contextId });
  const startedAt = Date.now();
  let fallbackCount = 0;
  let fallbackReason = '';
  let lastError;
  const structured = Boolean(responseJsonSchema) || responseMimeType === 'application/json';
  try {
    for (const model of candidates) {
      if (circuitOpen(model)) { fallbackCount += 1; fallbackReason = 'model_circuit_open'; continue; }
      const capability = modelRegistry.find((item) => item.model === model);
      if (visual && !capability?.supportsVision) { fallbackCount += 1; fallbackReason = 'vision_capability_required'; continue; }
      const compacted = compactContents(contents, systemInstruction, capability?.contextLimit || 128000);
      const schemaInstruction = structured && !capability?.supportsStructuredOutput
        ? '\nReturn JSON only. Follow this schema exactly:\n' + JSON.stringify(responseJsonSchema || {})
        : '';
      try {
        const providerOptions = { provider: 'nararouter', model, messages: toOpenAiMessages(compacted, `${systemInstruction}${schemaInstruction}`), maxOutputTokens, responseJsonSchema, supportsStructuredOutput: capability?.supportsStructuredOutput, reasoningEffort: route.reasoningEffort, timeoutMs: requestTimeoutMs, priority: isDocumentPurpose(purpose) ? 10 : 0, signal };
        const payload = onDelta
          ? await collectProviderStream(providerOptions, onDelta)
          : await requestOpenAiCompatible(providerOptions);
        const text = payload.text ?? responseText(payload);
        const safety = SAFETY_FINISH_REASONS.has(finishReason(payload).toLowerCase());
        if (safety) throw new AiProviderError('Permintaan tidak dapat diproses karena kebijakan keamanan AI.', { code: 'AI_SAFETY_BLOCKED', status: 422 });
        if (!text) throw new AiProviderError('Provider AI tidak mengembalikan teks.', { code: 'AI_EMPTY_RESPONSE', status: 502, retryable: true });
        assertOutputAllowed(text);
        if (structured) {
          let parsed;
          const extractedText = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]?.trim()
            || text.match(/\{[\s\S]*\}/)?.[0]?.trim()
            || text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
          try { parsed = JSON.parse(extractedText); } catch { parsed = null; }
          if (!parsed || !schemaValid(parsed, responseJsonSchema)) throw new AiProviderError('Provider AI mengembalikan JSON yang tidak valid.', { code: 'AI_SCHEMA_INVALID', status: 502, retryable: true });
        }
        recordCircuitSuccess(model);
        finishUsage(usageEventId, { status: 'success', usage: payload.usage, latencyMs: Date.now() - startedAt, model, fallbackCount, fallbackReason });
        return { text, provider: 'nararouter', model, usage: payload.usage || {}, finishReason: finishReason(payload), latencyMs: Date.now() - startedAt, fallbackCount };
      } catch (error) {
        lastError = error;
        recordCircuitFailure(model);
        fallbackCount += 1;
        fallbackReason = error?.code || 'provider_failure';
        if (error?.code === 'AI_SAFETY_BLOCKED' || error?.code === 'CONTENT_POLICY_BLOCKED') throw error;
      }
    }
    if (!visual && config.cloudflareAiEnabled && config.cloudflareAccountId && config.cloudflareAiToken) {
      const providerOptions = { provider: 'cloudflare', model: config.cloudflareAiModel, messages: toOpenAiMessages(contents, systemInstruction), maxOutputTokens, responseJsonSchema, supportsStructuredOutput: false, reasoningEffort: route.reasoningEffort, timeoutMs: requestTimeoutMs, signal };
      const payload = onDelta
        ? await collectProviderStream(providerOptions, onDelta)
        : await requestOpenAiCompatible(providerOptions);
      const text = payload.text ?? responseText(payload);
      if (!text) throw new AiProviderError('Emergency provider tidak mengembalikan teks.', { code: 'AI_EMPTY_RESPONSE', status: 502 });
      assertOutputAllowed(text);
      finishUsage(usageEventId, { status: 'success', usage: payload.usage, latencyMs: Date.now() - startedAt, provider: 'cloudflare', model: config.cloudflareAiModel, fallbackCount, fallbackReason: 'nararouter_exhausted' });
      return { text, provider: 'cloudflare', model: config.cloudflareAiModel, usage: payload.usage || {}, finishReason: finishReason(payload), latencyMs: Date.now() - startedAt, fallbackCount };
    }
    throw lastError || new AiProviderError(visual ? 'Kapasitas AI visual sedang tidak tersedia.' : 'Kapasitas AI sedang tidak tersedia.', { code: visual ? 'AI_VISION_UNAVAILABLE' : 'AI_CAPACITY_UNAVAILABLE', status: 503, retryable: true });
  } catch (error) {
    if (error?.code === 'CONTENT_POLICY_BLOCKED' && error.policyCode) {
      try {
        audit(userId, 'content_policy.blocked', contextType || 'ai', contextId || null, { direction: 'output', code: error.policyCode, purpose });
      } catch { /* safety logging must not replace the policy response */ }
    }
    finishUsage(usageEventId, { status: 'error', latencyMs: Date.now() - startedAt, errorCode: error?.code || 'AI_PROVIDER_ERROR', fallbackCount, fallbackReason });
    throw error;
  }
}
