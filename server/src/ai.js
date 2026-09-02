import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { config } from './config.js';
import { requireExternalAiConsent } from './external-ai-consent.js';
import { audit, db } from './db.js';
import { moderationMessage, moderateText } from './content-safety.js';
import { HttpError, now } from './utils.js';
import { createAdapterRegistry } from './ai-providers/adapter-registry.js';
import { createOpenAiCompatibleAdapter } from './ai-providers/openai-compatible.js';
import { createCloudflareAiAdapter } from './ai-providers/cloudflare-ai.js';
import { createAiConfigurationRepository } from './ai-configuration-repository.js';
import { createAiRuntimeResolver, resolveRuntimeRoute } from './ai-runtime-configuration.js';
import { createAiSecretStore } from './ai-secret-store.js';
import { routeIdForRequest } from './ai-routing.js';

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

function runtimeEgressPolicy() {
  return {
    isProd: config.isProd,
    allowHttp: config.aiAllowTestLoopback,
    allowTestLoopback: config.aiAllowTestLoopback,
    allowedHosts: config.aiProviderAllowedHosts,
    customAllowedHosts: config.aiCustomProviderHosts,
    allowCustomHost: config.aiCustomProviderHosts.length > 0,
    allowedPorts: config.aiProviderAllowedPorts,
  };
}

function createRuntimeProviderAdapters() {
  const common = {
    policy: runtimeEgressPolicy(),
    connectTimeoutMs: config.aiConnectTimeoutMs,
    requestTimeoutMs: config.aiRequestTimeoutMs,
    modelListTimeoutMs: config.aiModelListTimeoutMs,
    maxResponseBytes: config.aiMaxProviderResponseBytes,
  };
  return createAdapterRegistry([
    createOpenAiCompatibleAdapter({
      ...common,
      id: 'nararouter',
      displayName: 'NaraRouter',
      baseUrl: config.naraRouterBaseUrl,
      getToken: () => config.naraRouterApiKey,
    }),
    createCloudflareAiAdapter({
      ...common,
      accountId: config.cloudflareAccountId,
      configuredModel: config.cloudflareAiModel,
      getToken: () => config.cloudflareAiToken,
    }),
  ]);
}

const runtimeProviderAdapters = createRuntimeProviderAdapters();

function isDocumentPurpose(purpose = '') {
  const normalized = String(purpose || '').toLowerCase();
  return normalized === 'document' || normalized.startsWith('document_');
}

function isVisionRequest({ purpose, mode, requiresVision, contents }) {
  if (requiresVision || /visual|screenshot|evidence_image|image/i.test(`${purpose} ${mode}`)) return true;
  return JSON.stringify(contents || []).includes('inlineData') || JSON.stringify(contents || []).includes('image_url');
}

function modelName(model) {
  return String(model?.model || model?.modelId || model?.id || model?.name || '').replace(/^models\//, '').trim();
}

function booleanCapability(model, names) {
  const values = [
    ...names.map((name) => model?.[name]),
    ...names.map((name) => model?.capabilities?.[name]),
  ];
  return values.find((value) => typeof value === 'boolean') ?? null;
}

function normalizeModel(model) {
  const id = String(model?.modelId || modelName(model));
  const vision = model?.capabilities?.vision ?? booleanCapability(model, ['supportsVision', 'supports_vision', 'vision', 'multimodal']);
  const reasoning = model?.capabilities?.reasoning ?? booleanCapability(model, ['supportsReasoning', 'supports_reasoning', 'reasoning', 'thinking']);
  const structured = model?.capabilities?.structuredOutput ?? booleanCapability(model, ['supportsStructuredOutput', 'supports_structured_output', 'structuredOutput', 'jsonMode']);
  const tools = model?.capabilities?.tools ?? booleanCapability(model, ['supportsTools', 'supports_tools', 'tools', 'functionCalling']);
  const evidence = model?.capabilityEvidence || {};
  return {
    model: id,
    provider: String(model?.providerId || model?.provider || 'nararouter'),
    contextLimit: Number(model?.contextLimit || model?.contextWindow || model?.context_length || model?.contextLength || model?.inputTokenLimit || 0) || 128000,
    supportsVision: vision === true,
    supportsReasoning: reasoning === true,
    supportsStructuredOutput: structured === true,
    supportsTools: tools === true,
    capabilityEvidence: {
      vision: evidence.vision || (vision == null ? 'unverified' : 'provider'),
      reasoning: evidence.reasoning || (reasoning == null ? 'unverified' : 'provider'),
      structuredOutput: evidence.structuredOutput || (structured == null ? 'unverified' : 'provider'),
      tools: evidence.tools || (tools == null ? 'unverified' : 'provider'),
    },
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

const runtimeConfigurationResolver = createAiRuntimeResolver({
  repository: createAiConfigurationRepository({ store: db }),
  environment: config,
  getEnvironmentModels: () => modelRegistry,
  now,
});

export function captureAiRuntimeConfiguration(options = {}) {
  return runtimeConfigurationResolver.capture(options);
}

let managedSecretStore = null;
function providerAdaptersForSnapshot(snapshot) {
  if (snapshot.source === 'environment') return runtimeProviderAdapters;
  if (!['active', 'revision'].includes(snapshot.source)) return createAdapterRegistry();
  if (!managedSecretStore) managedSecretStore = createAiSecretStore({ config, store: db });
  const common = {
    policy: runtimeEgressPolicy(),
    connectTimeoutMs: config.aiConnectTimeoutMs,
    requestTimeoutMs: config.aiRequestTimeoutMs,
    modelListTimeoutMs: config.aiModelListTimeoutMs,
    maxResponseBytes: config.aiMaxProviderResponseBytes,
  };
  return createAdapterRegistry(snapshot.providers.map((provider) => createOpenAiCompatibleAdapter({
    ...common,
    id: provider.providerId,
    displayName: provider.displayName,
    baseUrl: provider.baseUrl,
    getToken: () => managedSecretStore.get({
      providerId: provider.providerId,
      reference: provider.secretReference,
      version: provider.secretVersion,
    }),
  })));
}

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

async function fetchModels(adapters = runtimeProviderAdapters) {
  if (!config.naraRouterApiKey) throw new AiProviderError('NaraRouter belum dikonfigurasi.', { code: 'AI_NOT_CONFIGURED', status: 503 });
  try {
    const models = await adapters.get('nararouter').discoverModels();
    if (!models.length) throw new AiProviderError('NaraRouter tidak mengembalikan daftar model.', { code: 'NARAROUTER_MODELS_EMPTY', status: 502, retryable: true });
    cacheRegistry(models);
    return modelRegistry;
  } catch (error) {
    if (error instanceof AiProviderError) throw error;
    throw new AiProviderError(error?.code === 'AI_EGRESS_TIMEOUT' ? 'Pencarian model NaraRouter melewati batas waktu.' : 'NaraRouter tidak dapat dihubungi.', {
      code: error?.code || 'AI_NETWORK_ERROR', status: Number(error?.status || 502), retryable: error?.retryable !== false,
    });
  }
}

export async function initializeAiModelRegistry(adapters = runtimeProviderAdapters) {
  if (discoveryPromise) return discoveryPromise;
  discoveryPromise = fetchModels(adapters).catch((error) => {
    if (!modelRegistry.length) console.warn('[ai] model discovery failed; no cached registry:', error?.code || error?.message || error);
    return modelRegistry;
  }).finally(() => { discoveryPromise = null; });
  return discoveryPromise;
}

export function getAiReadiness(snapshot = captureAiRuntimeConfiguration()) {
  const models = snapshot.source === 'environment'
    ? modelRegistry
    : snapshot.models.map((model) => normalizeModel(model));
  const textModels = models.filter((model) => !model.supportsVision || model.supportsReasoning || /text|mistral|qwen|llama/i.test(model.model));
  const visionModels = models.filter((model) => model.supportsVision);
  const documentModels = models.filter((model) => !model.supportsVision || model.supportsReasoning || model.supportsStructuredOutput);
  return {
    provider: snapshot.providers[0]?.providerId || 'nararouter',
    source: snapshot.source,
    configurationRevision: snapshot.revisionId,
    configured: snapshot.source !== 'unavailable',
    registryCached: models.length > 0,
    registryUpdatedAt: registryLoadedAt ? new Date(registryLoadedAt).toISOString() : null,
    textReady: textModels.length > 0,
    documentReady: documentModels.length > 0,
    visionReady: visionModels.length > 0,
    models,
    degradedReason: snapshot.degradedReason,
  };
}

export function isAiConfigured(snapshot = captureAiRuntimeConfiguration()) {
  if (!snapshot.available) return false;
  if (snapshot.source !== 'environment') return true;
  const models = snapshot.models.map((model) => normalizeModel(model));
  const textReady = models.some((model) => !model.supportsVision || model.supportsReasoning);
  const documentReady = models.some((model) => !model.supportsVision || model.supportsReasoning || model.supportsStructuredOutput);
  return textReady && documentReady;
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

function reserveUsage({ userId, purpose, mode, provider, model, configurationRevision = '', routeId = '', contextType = '', contextId = '', requestId = '', queueDepth = 0, circuitStatus = 'closed' }) {
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
      INSERT INTO ai_usage_events (id, user_id, purpose, mode, provider, model, status, input_tokens, output_tokens, reasoning_tokens, total_tokens, latency_ms, error_code, fallback_count, fallback_reason, created_at, context_type, context_id, request_id, configuration_revision, route_id, queue_depth, circuit_state)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, 0, 0, 0, 0, '', 0, '', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, userId || null, String(purpose || 'chat').slice(0, 32), String(mode || 'basic').slice(0, 24),
      String(provider || '').slice(0, 64), String(model || 'unresolved').slice(0, 100), now(),
      String(contextType || '').slice(0, 32), String(contextId || '').slice(0, 120), String(requestId || '').slice(0, 120),
      String(configurationRevision || '').slice(0, 160), String(routeId || '').slice(0, 80), Math.max(0, Number(queueDepth || 0)),
      ['closed', 'open', 'half_open'].includes(circuitStatus) ? circuitStatus : 'closed',
    );
    db.exec('COMMIT');
    transactionOpen = false;
    return id;
  } catch (error) {
    if (transactionOpen) db.exec('ROLLBACK');
    throw error;
  }
}

function finishUsage(id, { status, usage, latencyMs, errorCode = '', provider = 'nararouter', model = '', fallbackCount = 0, fallbackReason = '', queueDepth = 0, circuitStatus = 'closed' }) {
  const promptTokens = Number(usage?.prompt_tokens ?? usage?.promptTokenCount ?? 0);
  const outputTokens = Number(usage?.completion_tokens ?? usage?.candidatesTokenCount ?? 0);
  const reasoningTokens = Number(usage?.completion_tokens_details?.reasoning_tokens ?? usage?.reasoning_tokens ?? 0);
  const totalTokens = Number(usage?.total_tokens ?? usage?.totalTokenCount ?? promptTokens + outputTokens);
  db.prepare(`UPDATE ai_usage_events SET provider = ?, model = ?, status = ?, input_tokens = ?, output_tokens = ?, reasoning_tokens = ?, total_tokens = ?, latency_ms = ?, error_code = ?, fallback_count = ?, fallback_reason = ?, queue_depth = ?, circuit_state = ? WHERE id = ?`)
    .run(provider, String(model || '').slice(0, 100), status, promptTokens, outputTokens, reasoningTokens, totalTokens, Math.max(0, Math.round(latencyMs || 0)), String(errorCode || '').slice(0, 80), fallbackCount, String(fallbackReason || '').slice(0, 160), Math.max(0, Number(queueDepth || 0)), ['closed', 'open', 'half_open'].includes(circuitStatus) ? circuitStatus : 'closed', id);
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

function asAiProviderError(error, message = 'Provider AI tidak dapat dihubungi.') {
  if (error instanceof AiProviderError) return error;
  return new AiProviderError(message, {
    code: String(error?.code || 'AI_NETWORK_ERROR').slice(0, 80),
    status: Number(error?.status || 502),
    retryable: error?.retryable !== false,
  });
}

function circuitStatus(model) {
  const state = circuitState.get(model);
  if (!state) return 'closed';
  if (state.openUntil > Date.now()) return 'open';
  return state.failures >= config.aiCircuitFailureThreshold ? 'half_open' : 'closed';
}

async function requestOpenAiCompatible({ provider, model, messages, maxOutputTokens, responseJsonSchema, supportsStructuredOutput, reasoningEffort, timeoutMs, priority = 0, signal, providerAdapters = runtimeProviderAdapters }) {
  let lastError;
  for (let attempt = 0; attempt < config.aiMaxRetries; attempt += 1) {
    try {
      const result = await runInProviderQueue(() => providerAdapters.get(provider).complete({
        model, messages, maxOutputTokens, responseJsonSchema, supportsStructuredOutput, reasoningEffort, timeoutMs, signal,
      }), priority);
      return result;
    } catch (error) {
      lastError = asAiProviderError(error);
      if (!lastError.retryable || attempt === config.aiMaxRetries - 1) throw lastError;
      await sleep(350 * (2 ** attempt) + Math.floor(Math.random() * 180));
    }
  }
  throw lastError;
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
  providerAdapters = runtimeProviderAdapters,
}) {
  let lastError;
  for (let attempt = 0; attempt < config.aiMaxRetries; attempt += 1) {
    let release;
    let emitted = false;
    try {
      release = await acquireProviderSlot(priority);
      try {
        for await (const event of providerAdapters.get(provider).stream({
          model, messages, maxOutputTokens, responseJsonSchema, supportsStructuredOutput, reasoningEffort, timeoutMs, signal,
        })) {
          if (event?.type === 'delta') emitted = true;
          yield event;
        }
        return;
      } finally {
        release?.();
      }
    } catch (error) {
      release?.();
      lastError = asAiProviderError(error, 'Provider AI tidak dapat melanjutkan respons streaming.');
      if (!lastError.retryable || emitted || attempt === config.aiMaxRetries - 1) {
        yield { type: 'error', code: lastError.code };
        return;
      }
      await sleep(350 * (2 ** attempt) + Math.floor(Math.random() * 180));
    }
  }
  yield { type: 'error', code: lastError?.code || 'AI_PROVIDER_ERROR' };
}

export async function generateAiContent({ userId = null, contextType = '', contextId = '', requestId = '', purpose = 'chat', mode = 'basic', contents, systemInstruction = '', maxOutputTokens = 1200, responseMimeType = 'text/plain', responseJsonSchema, requiresVision = false, requestTimeoutMs = config.aiRequestTimeoutMs, onDelta = null, signal = null, providerAdapters = null, runtimeSnapshot = null }) {
  let snapshot = runtimeSnapshot || captureAiRuntimeConfiguration();
  const adaptersForDiscovery = providerAdapters || runtimeProviderAdapters;
  if (snapshot.source === 'environment' && !snapshot.models.length) {
    await initializeAiModelRegistry(adaptersForDiscovery);
    snapshot = runtimeSnapshot || captureAiRuntimeConfiguration();
  }
  if (!snapshot.available) {
    throw new HttpError(503, 'Konfigurasi AI aktif tidak tersedia.', snapshot.degradedReason || 'AI_RUNTIME_UNAVAILABLE');
  }
  if (userId) requireExternalAiConsent({ userId, manifest: snapshot.processorManifest });
  const visualRequest = isVisionRequest({ purpose, mode, requiresVision, contents });
  const activeRoute = ['active', 'revision'].includes(snapshot.source)
    ? resolveRuntimeRoute(snapshot, { purpose, mode, requiresVision: visualRequest })
    : null;
  if (['active', 'revision'].includes(snapshot.source) && !activeRoute) {
    throw new HttpError(503, 'Rute AI aktif tidak tersedia untuk pekerjaan ini.', 'AI_ROUTE_UNAVAILABLE');
  }
  const legacyRoute = activeRoute ? null : selectAiRoute({ purpose, mode, requiresVision: visualRequest, contents, requiresStructuredOutput: Boolean(responseJsonSchema) });
  const routeId = activeRoute?.routeId || routeIdForRequest({ purpose, mode, requiresVision: legacyRoute?.requiresVision });
  const candidates = activeRoute
    ? activeRoute.candidates
    : [
      ...(legacyRoute.candidates || []).map((modelId) => ({ providerId: 'nararouter', modelId })),
      ...(!legacyRoute.requiresVision && config.cloudflareAiEnabled && config.cloudflareAccountId && config.cloudflareAiToken
        ? [{ providerId: 'cloudflare', modelId: config.cloudflareAiModel }]
        : []),
    ];
  if (!candidates.length) {
    throw new HttpError(503, 'Tidak ada rute AI yang telah diungkapkan dan tersedia.', activeRoute?.filteredUndisclosed ? 'AI_CONSENT_ROUTE_UNAVAILABLE' : 'AI_ROUTE_UNAVAILABLE');
  }
  const runtimeAdapters = providerAdapters || providerAdaptersForSnapshot(snapshot);
  const visual = visualRequest || Boolean(activeRoute?.requiresVision ?? legacyRoute.requiresVision);
  const routeReasoningEffort = activeRoute?.reasoningEffort || legacyRoute.reasoningEffort;
  const routeTimeoutMs = activeRoute?.timeoutMs || requestTimeoutMs;
  const effectiveOutputTokens = activeRoute?.outputTokenLimit
    ? Math.min(maxOutputTokens, activeRoute.outputTokenLimit)
    : maxOutputTokens;
  const primary = candidates[0];
  const primaryCircuitKey = `${primary.providerId}\u0000${primary.modelId}`;
  const usageEventId = reserveUsage({
    userId, purpose, mode, provider: primary.providerId, model: primary.modelId,
    configurationRevision: snapshot.revisionId, routeId, contextType, contextId, requestId,
    queueDepth: providerQueue.length, circuitStatus: circuitStatus(primaryCircuitKey),
  });
  const startedAt = Date.now();
  let fallbackCount = 0;
  let fallbackReason = '';
  let lastError;
  let lastProvider = primary.providerId;
  let lastModel = primary.modelId;
  const structured = Boolean(responseJsonSchema) || responseMimeType === 'application/json';
  try {
    for (const candidate of candidates) {
      const { providerId, modelId } = candidate;
      lastProvider = providerId;
      lastModel = modelId;
      const circuitKey = `${providerId}\u0000${modelId}`;
      if (circuitOpen(circuitKey)) { fallbackCount += 1; fallbackReason = 'model_circuit_open'; continue; }
      const rawCapability = snapshot.models.find((item) => String(item.providerId || item.provider) === providerId && String(item.modelId || item.model) === modelId);
      const capability = rawCapability ? normalizeModel(rawCapability) : null;
      if (visual && !capability?.supportsVision) { fallbackCount += 1; fallbackReason = 'vision_capability_required'; continue; }
      const compacted = compactContents(contents, systemInstruction, capability?.contextLimit || 128000);
      const schemaInstruction = structured && !capability?.supportsStructuredOutput
        ? '\nReturn JSON only. Follow this schema exactly:\n' + JSON.stringify(responseJsonSchema || {})
        : '';
      try {
        const providerOptions = { provider: providerId, model: modelId, messages: toOpenAiMessages(compacted, `${systemInstruction}${schemaInstruction}`), maxOutputTokens: effectiveOutputTokens, responseJsonSchema, supportsStructuredOutput: capability?.supportsStructuredOutput, reasoningEffort: routeReasoningEffort, timeoutMs: routeTimeoutMs, priority: isDocumentPurpose(purpose) ? 10 : 0, signal, providerAdapters: runtimeAdapters };
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
        recordCircuitSuccess(circuitKey);
        finishUsage(usageEventId, { status: 'success', usage: payload.usage, latencyMs: Date.now() - startedAt, provider: providerId, model: modelId, fallbackCount, fallbackReason, queueDepth: providerQueue.length, circuitStatus: circuitStatus(circuitKey) });
        return {
          text, provider: providerId, model: modelId, usage: payload.usage || {}, finishReason: finishReason(payload),
          latencyMs: Date.now() - startedAt, fallbackCount, configurationRevision: snapshot.revisionId,
          routeId, runtimeSource: snapshot.source,
        };
      } catch (error) {
        lastError = error;
        recordCircuitFailure(circuitKey);
        fallbackCount += 1;
        fallbackReason = error?.code || 'provider_failure';
        if (error?.code === 'AI_SAFETY_BLOCKED' || error?.code === 'CONTENT_POLICY_BLOCKED') throw error;
      }
    }
    if (activeRoute?.filteredUndisclosed) {
      throw new AiProviderError('Tidak ada fallback yang sesuai dengan persetujuan pemroses aktif.', { code: 'AI_CONSENT_ROUTE_UNAVAILABLE', status: 503 });
    }
    throw lastError || new AiProviderError(visual ? 'Kapasitas AI visual sedang tidak tersedia.' : 'Kapasitas AI sedang tidak tersedia.', { code: visual ? 'AI_VISION_UNAVAILABLE' : 'AI_CAPACITY_UNAVAILABLE', status: 503, retryable: true });
  } catch (error) {
    if (error?.code === 'CONTENT_POLICY_BLOCKED' && error.policyCode) {
      try {
        audit(userId, 'content_policy.blocked', contextType || 'ai', contextId || null, { direction: 'output', code: error.policyCode, purpose });
      } catch { /* safety logging must not replace the policy response */ }
    }
    const finalCircuitKey = `${lastProvider}\u0000${lastModel}`;
    finishUsage(usageEventId, { status: 'error', latencyMs: Date.now() - startedAt, errorCode: error?.code || 'AI_PROVIDER_ERROR', provider: lastProvider, model: lastModel, fallbackCount, fallbackReason, queueDepth: providerQueue.length, circuitStatus: circuitStatus(finalCircuitKey) });
    throw error;
  }
}
