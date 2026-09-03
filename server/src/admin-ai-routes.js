import { z } from 'zod';
import { createAiConfigurationRepository } from './ai-configuration-repository.js';
import { createAiConfigurationService } from './ai-configuration-service.js';
import { AiEgressPolicyError, validateProviderUrl } from './ai-egress-policy.js';
import { createOpenAiCompatibleAdapter } from './ai-providers/openai-compatible.js';
import { createAiSecretStore } from './ai-secret-store.js';
import { captureAiRuntimeConfiguration, getAiReadiness } from './ai.js';
import { capabilitiesForUser } from './admin-capabilities.js';
import { HttpError } from './utils.js';

const reason = z.string().trim().min(8).max(500);
const revisionId = z.string().trim().min(8).max(160);
const providerId = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/);

const providerInput = z.object({
  providerId,
  displayName: z.string().trim().min(1).max(120),
  adapterType: z.literal('openai-compatible').default('openai-compatible'),
  baseUrl: z.string().trim().url().max(500),
  enabled: z.boolean().default(true),
  priority: z.coerce.number().int().min(0).max(10_000).default(100),
  requestTimeoutMs: z.coerce.number().int().min(1_000).max(120_000).default(45_000),
  rpmLimit: z.coerce.number().int().min(1).max(100_000).default(8),
  concurrencyLimit: z.coerce.number().int().min(1).max(1_000).default(2),
  retryCount: z.coerce.number().int().min(0).max(10).default(2),
  circuitFailureThreshold: z.coerce.number().int().min(1).max(100).default(4),
  circuitCooldownMs: z.coerce.number().int().min(1_000).max(3_600_000).default(30_000),
}).strict();

const providerPatch = providerInput.omit({ providerId: true }).partial().strict();
const capabilityMap = z.object({
  vision: z.boolean().default(false),
  reasoning: z.boolean().default(false),
  structuredOutput: z.boolean().default(false),
  tools: z.boolean().default(false),
}).strict();
const evidenceMap = z.object({
  vision: z.enum(['unverified', 'provider', 'canary', 'verified']).default('unverified'),
  reasoning: z.enum(['unverified', 'provider', 'canary', 'verified']).default('unverified'),
  structuredOutput: z.enum(['unverified', 'provider', 'canary', 'verified']).default('unverified'),
  tools: z.enum(['unverified', 'provider', 'canary', 'verified']).default('unverified'),
}).strict();
const costMetadata = z.object({
  currency: z.string().trim().min(3).max(8).default('USD'),
  inputPerMillion: z.coerce.number().min(0).max(1_000_000).optional(),
  outputPerMillion: z.coerce.number().min(0).max(1_000_000).optional(),
  cachedInputPerMillion: z.coerce.number().min(0).max(1_000_000).optional(),
}).strict();
const modelInput = z.object({
  providerId,
  modelId: z.string().trim().min(1).max(180),
  enabled: z.boolean().default(true),
  state: z.enum(['available', 'unavailable', 'disabled', 'archived']).default('available'),
  capabilities: capabilityMap.default({}),
  capabilityEvidence: evidenceMap.default({}),
  contextWindow: z.coerce.number().int().min(0).max(10_000_000).default(0),
  maxOutputTokens: z.coerce.number().int().min(0).max(1_000_000).default(0),
  costMetadata: costMetadata.default({}),
}).strict();
const manualModelInput = modelInput.omit({ capabilityEvidence: true });

const fallbackInput = z.object({ providerId, modelId: z.string().trim().min(1).max(180) }).strict();
const routeInput = z.object({
  routeId: z.string().trim().min(1).max(80),
  enabled: z.boolean().default(true),
  primaryProviderId: providerId,
  primaryModelId: z.string().trim().min(1).max(180),
  fallbacks: z.array(fallbackInput).max(8).default([]),
  timeoutMs: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
  retryCount: z.coerce.number().int().min(0).max(10).default(1),
  outputTokenLimit: z.coerce.number().int().min(1).max(65_536).default(2_000),
  reasoningEffort: z.enum(['none', 'minimal', 'low', 'medium', 'high']).default('low'),
  requiresStructuredOutput: z.boolean().default(false),
  requiresVision: z.boolean().default(false),
  parserFallbackTested: z.boolean().default(false),
  costClass: z.string().trim().min(1).max(40).default('standard'),
  plans: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
}).strict();

function egressPolicy(config) {
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

function checkedProvider(provider, config, actor = null) {
  let url;
  try {
    url = validateProviderUrl(provider.baseUrl, egressPolicy(config));
  } catch (error) {
    if (error instanceof AiEgressPolicyError) {
      throw new HttpError(400, 'Provider URL tidak diizinkan oleh kebijakan deployment.', error.code);
    }
    throw error;
  }
  if (url.search) throw new HttpError(400, 'Provider URL query parameters are not allowed.', 'AI_EGRESS_QUERY_BLOCKED');
  const customHosts = new Set((config.aiCustomProviderHosts || []).map((host) => String(host).toLowerCase()));
  if (customHosts.has(url.hostname.toLowerCase()) && !['owner', 'admin'].includes(String(actor?.role || '').toLowerCase())) {
    throw new HttpError(403, 'Custom provider hosts require owner authority.', 'AI_EGRESS_CUSTOM_HOST_OWNER_REQUIRED');
  }
  return { ...provider, baseUrl: url.toString().replace(/\/$/, ''), state: provider.enabled === false ? 'disabled' : 'draft' };
}

function safeProvider(provider, { environmentCredentialConfigured = false } = {}) {
  const configured = Boolean(provider.secretReference && provider.secretVersion) || environmentCredentialConfigured;
  let baseUrl = '';
  try {
    const parsed = new URL(String(provider.baseUrl || ''));
    baseUrl = `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '');
  } catch { baseUrl = ''; }
  return {
    providerId: provider.providerId,
    displayName: provider.displayName,
    adapterType: provider.adapterType,
    baseUrl,
    enabled: provider.enabled !== false,
    state: provider.state,
    priority: Number(provider.priority || 0),
    requestTimeoutMs: Number(provider.requestTimeoutMs || 0),
    rpmLimit: Number(provider.rpmLimit || 0),
    concurrencyLimit: Number(provider.concurrencyLimit || 0),
    retryCount: Number(provider.retryCount || 0),
    circuitFailureThreshold: Number(provider.circuitFailureThreshold || 0),
    circuitCooldownMs: Number(provider.circuitCooldownMs || 0),
    credential: {
      configured,
      fingerprint: String(provider.credentialFingerprint || ''),
      lastFour: String(provider.credentialLastFour || ''),
      version: configured ? String(provider.secretVersion || 'environment') : '',
    },
  };
}

function safeModel(model) {
  const cost = model.costMetadata && typeof model.costMetadata === 'object' ? model.costMetadata : {};
  return {
    providerId: String(model.providerId || ''),
    modelId: String(model.modelId || ''),
    source: String(model.source || ''),
    enabled: model.enabled !== false,
    state: String(model.state || ''),
    capabilities: model.capabilities || {},
    capabilityEvidence: model.capabilityEvidence || {},
    contextWindow: Number(model.contextWindow || 0),
    maxOutputTokens: Number(model.maxOutputTokens || 0),
    health: String(model.health || ''),
    lastAvailableAt: model.lastAvailableAt || null,
    costMetadata: Object.fromEntries(Object.entries(cost)
      .filter(([key, value]) => !/(?:secret|token|password|credential|api.?key)/i.test(key)
        && ['string', 'number', 'boolean'].includes(typeof value))
      .slice(0, 20)),
  };
}

function safeRevision(revision) {
  if (!revision) return null;
  return {
    id: revision.id,
    revisionNumber: revision.revisionNumber,
    parentRevisionId: revision.parentRevisionId,
    state: revision.state,
    reason: revision.reason,
    createdByUserId: revision.createdByUserId,
    createdAt: revision.createdAt,
    testedByUserId: revision.testedByUserId,
    testedAt: revision.testedAt,
    testEvidence: revision.testEvidence,
    activatedByUserId: revision.activatedByUserId,
    activatedAt: revision.activatedAt,
    activationReason: revision.activationReason,
    supersededAt: revision.supersededAt,
    providers: (revision.providers || []).map((provider) => safeProvider(provider)),
    models: (revision.models || []).map(safeModel),
    routes: revision.routes || [],
  };
}

function sourceRevision(repository, requestedRevisionId = '') {
  if (requestedRevisionId) {
    const revision = repository.getRevision(requestedRevisionId);
    if (!revision) throw new HttpError(404, 'Revisi konfigurasi AI tidak ditemukan.', 'AI_CONFIGURATION_NOT_FOUND');
    return revision;
  }
  return repository.getActiveRevision();
}

function paginate(items, cursorValue, limitValue) {
  const offset = Math.max(0, Number.parseInt(String(cursorValue || '0'), 10) || 0);
  const limit = Math.max(1, Math.min(100, Number.parseInt(String(limitValue || '25'), 10) || 25));
  const page = items.slice(offset, offset + limit);
  return { items: page, nextCursor: offset + limit < items.length ? String(offset + limit) : null };
}

function exactConfirmation(actual, expected) {
  if (String(actual || '').trim() !== expected) {
    throw new HttpError(400, `Ketik “${expected}” untuk mengonfirmasi tindakan ini.`, 'AI_CONFIGURATION_CONFIRMATION_REQUIRED');
  }
}

function publicRuntimeSnapshot(snapshot, config) {
  return {
    source: snapshot.source,
    revisionId: snapshot.revisionId,
    capturedAt: snapshot.capturedAt,
    available: snapshot.available,
    degradedReason: snapshot.degradedReason,
    providers: snapshot.providers.map((provider) => safeProvider(provider, {
      environmentCredentialConfigured: provider.providerId === 'nararouter'
        ? Boolean(config.naraRouterApiKey)
        : provider.providerId === 'cloudflare' && Boolean(config.cloudflareAiToken),
    })),
    models: snapshot.models.map(safeModel),
    routes: snapshot.routes,
  };
}

export function registerAdminAiRoutes(app, {
  store,
  config,
  requireAuth,
  requireCsrf,
  requireCapability,
  requireRecentMfa,
  mutationLimiter,
  asyncHandler,
  audit,
} = {}) {
  const repository = createAiConfigurationRepository({ store });
  let secretStore = null;
  try { secretStore = createAiSecretStore({ config, store }); } catch { /* GET routes remain available in degraded mode. */ }
  const commonAdapterOptions = {
    policy: egressPolicy(config),
    connectTimeoutMs: config.aiConnectTimeoutMs,
    requestTimeoutMs: config.aiRequestTimeoutMs,
    modelListTimeoutMs: config.aiModelListTimeoutMs,
    maxResponseBytes: config.aiMaxProviderResponseBytes,
  };
  const service = createAiConfigurationService({
    repository,
    secretStore,
    production: config.isProd,
    recordAudit: audit,
    adapterForProvider: async (provider) => createOpenAiCompatibleAdapter({
      ...commonAdapterOptions,
      id: provider.providerId,
      displayName: provider.displayName,
      baseUrl: provider.baseUrl,
      getToken: () => {
        if (!secretStore) throw new HttpError(503, 'Penyimpanan credential AI belum siap.', 'AI_CONFIGURATION_SECRET_STORE_UNAVAILABLE');
        return secretStore.get({ providerId: provider.providerId, reference: provider.secretReference, version: provider.secretVersion });
      },
    }),
  });
  const auth = (req) => ({
    actorUserId: req.user.id,
    capabilities: capabilitiesForUser(req.user),
    recentMfa: true,
  });
  const secureMutation = (capability) => [requireAuth, requireCsrf, requireCapability(capability), mutationLimiter, requireRecentMfa];

  app.get('/api/admin/ai/providers', requireAuth, requireCapability('ai.providers.view'), (req, res) => {
    const query = z.object({ revisionId: z.string().trim().max(160).catch(''), state: z.string().trim().max(40).catch(''), q: z.string().trim().max(120).catch(''), cursor: z.string().trim().max(20).catch(''), limit: z.coerce.number().int().min(1).max(100).catch(25) }).parse(req.query);
    const selected = sourceRevision(repository, query.revisionId);
    const snapshot = selected ? null : captureAiRuntimeConfiguration();
    let providers = selected
      ? selected.providers.map((provider) => safeProvider(provider))
      : publicRuntimeSnapshot(snapshot, config).providers;
    if (query.state) providers = providers.filter((provider) => provider.state === query.state);
    if (query.q) providers = providers.filter((provider) => `${provider.providerId} ${provider.displayName}`.toLowerCase().includes(query.q.toLowerCase()));
    const page = paginate(providers, query.cursor, query.limit);
    res.json({ revisionId: selected?.id || snapshot.revisionId, source: selected ? selected.state : snapshot.source, providers: page.items, nextCursor: page.nextCursor });
  });

  app.get('/api/admin/ai/providers/:providerId', requireAuth, requireCapability('ai.providers.view'), (req, res) => {
    const selected = sourceRevision(repository, String(req.query.revisionId || ''));
    const snapshot = selected ? null : captureAiRuntimeConfiguration();
    const found = selected?.providers.find((item) => item.providerId === req.params.providerId)
      || snapshot?.providers.find((item) => item.providerId === req.params.providerId);
    if (!found) throw new HttpError(404, 'Provider AI tidak ditemukan.', 'AI_CONFIGURATION_PROVIDER_NOT_FOUND');
    const environmentCredentialConfigured = snapshot?.source === 'environment' && (found.providerId === 'nararouter'
      ? Boolean(config.naraRouterApiKey)
      : found.providerId === 'cloudflare' && Boolean(config.cloudflareAiToken));
    res.json({ revisionId: selected?.id || snapshot.revisionId, provider: safeProvider(found, { environmentCredentialConfigured }) });
  });

  app.post('/api/admin/ai/providers', ...secureMutation('ai.providers.manage'), (req, res) => {
    const input = z.object({ revisionId: z.string().trim().max(160).optional(), reason, provider: providerInput }).strict().parse(req.body || {});
    const source = sourceRevision(repository, input.revisionId || '');
    const provider = checkedProvider(input.provider, config, req.user);
    if (source?.providers.some((item) => item.providerId === provider.providerId)) throw new HttpError(409, 'Provider ID sudah ada pada revisi ini.', 'AI_CONFIGURATION_PROVIDER_EXISTS');
    const draft = service.createDraft({
      auth: auth(req), reason: input.reason, parentRevisionId: source?.id || null,
      providers: [...(source?.providers || []), provider], models: source?.models || [], routes: source?.routes || [],
    });
    res.status(201).json({ revision: safeRevision(draft) });
  });

  app.put('/api/admin/ai/providers/:providerId', ...secureMutation('ai.providers.manage'), (req, res) => {
    const input = z.object({ revisionId, reason, provider: providerPatch }).strict().parse(req.body || {});
    const source = sourceRevision(repository, input.revisionId);
    const existing = source.providers.find((item) => item.providerId === req.params.providerId);
    if (!existing) throw new HttpError(404, 'Provider AI tidak ditemukan.', 'AI_CONFIGURATION_PROVIDER_NOT_FOUND');
    const updated = checkedProvider({ ...existing, ...input.provider, providerId: existing.providerId }, config, req.user);
    const disabling = updated.enabled === false;
    const draft = service.createDraft({
      auth: auth(req), reason: input.reason, parentRevisionId: source.id,
      providers: source.providers.map((item) => item.providerId === existing.providerId ? updated : item),
      models: source.models.map((model) => disabling && model.providerId === existing.providerId ? { ...model, enabled: false, state: 'disabled', health: 'disabled' } : model),
      routes: source.routes.map((route) => route.primaryProviderId === existing.providerId
        ? { ...route, enabled: disabling ? false : route.enabled }
        : { ...route, fallbacks: route.fallbacks.filter((fallback) => !disabling || fallback.providerId !== existing.providerId) }),
    });
    res.status(201).json({ revision: safeRevision(draft) });
  });

  app.delete('/api/admin/ai/providers/:providerId', ...secureMutation('ai.providers.manage'), (req, res) => {
    const input = z.object({ revisionId, reason, confirmation: z.string().max(120) }).strict().parse(req.body || {});
    exactConfirmation(input.confirmation, `DISABLE ${req.params.providerId}`);
    const source = sourceRevision(repository, input.revisionId);
    const existing = source.providers.find((item) => item.providerId === req.params.providerId);
    if (!existing) throw new HttpError(404, 'Provider AI tidak ditemukan.', 'AI_CONFIGURATION_PROVIDER_NOT_FOUND');
    const draft = service.createDraft({
      auth: auth(req), reason: input.reason, parentRevisionId: source.id,
      providers: source.providers.map((item) => item.providerId === existing.providerId ? { ...item, enabled: false, state: 'disabled' } : item),
      models: source.models.map((model) => model.providerId === existing.providerId ? { ...model, enabled: false, state: 'disabled', health: 'disabled' } : model),
      routes: source.routes.map((route) => route.primaryProviderId === existing.providerId
        ? { ...route, enabled: false }
        : { ...route, fallbacks: route.fallbacks.filter((fallback) => fallback.providerId !== existing.providerId) }),
    });
    res.status(201).json({ revision: safeRevision(draft) });
  });

  app.post('/api/admin/ai/providers/:providerId/credential', ...secureMutation('ai.credentials.rotate'), asyncHandler(async (req, res) => {
    const input = z.object({ revisionId, credential: z.string().min(1).max(16_000), reason, confirmation: z.string().max(120) }).strict().parse(req.body || {});
    exactConfirmation(input.confirmation, `ROTATE ${req.params.providerId}`);
    const draft = await service.replaceCredential({ revisionId: input.revisionId, providerId: req.params.providerId, credential: input.credential, reason: input.reason, auth: auth(req) });
    res.status(201).json({ revision: safeRevision(draft) });
  }));

  app.delete('/api/admin/ai/providers/:providerId/credential', ...secureMutation('ai.credentials.rotate'), asyncHandler(async (req, res) => {
    const input = z.object({ revisionId, reason, confirmation: z.string().max(160) }).strict().parse(req.body || {});
    exactConfirmation(input.confirmation, `DELETE CREDENTIAL ${req.params.providerId}`);
    const result = await service.deleteCredential({ revisionId: input.revisionId, providerId: req.params.providerId, reason: input.reason, auth: auth(req) });
    res.json(result);
  }));

  app.get('/api/admin/ai/models', requireAuth, requireCapability('ai.providers.view'), (req, res) => {
    const query = z.object({ revisionId: z.string().trim().max(160).catch(''), providerId: z.string().trim().max(64).catch(''), state: z.string().trim().max(40).catch(''), q: z.string().trim().max(120).catch(''), cursor: z.string().trim().max(20).catch(''), limit: z.coerce.number().int().min(1).max(100).catch(25) }).parse(req.query);
    const selected = sourceRevision(repository, query.revisionId);
    const snapshot = selected ? null : captureAiRuntimeConfiguration();
    let models = (selected?.models || snapshot.models).map(safeModel);
    if (query.providerId) models = models.filter((model) => model.providerId === query.providerId);
    if (query.state) models = models.filter((model) => model.state === query.state);
    if (query.q) models = models.filter((model) => model.modelId.toLowerCase().includes(query.q.toLowerCase()));
    const page = paginate(models, query.cursor, query.limit);
    res.json({ revisionId: selected?.id || snapshot.revisionId, models: page.items, nextCursor: page.nextCursor });
  });

  app.post('/api/admin/ai/models', ...secureMutation('ai.models.manage'), (req, res) => {
    const input = z.object({ revisionId, reason, model: manualModelInput }).strict().parse(req.body || {});
    const source = sourceRevision(repository, input.revisionId);
    if (!source.providers.some((provider) => provider.providerId === input.model.providerId)) throw new HttpError(404, 'Provider AI tidak ditemukan.', 'AI_CONFIGURATION_PROVIDER_NOT_FOUND');
    if (source.models.some((model) => model.providerId === input.model.providerId && model.modelId === input.model.modelId)) throw new HttpError(409, 'Model sudah ada pada revisi ini.', 'AI_CONFIGURATION_MODEL_EXISTS');
    const draft = service.createModelDraft({ auth: auth(req), reason: input.reason, parentRevisionId: source.id, providers: source.providers, models: [...source.models, { ...input.model, capabilityEvidence: evidenceMap.parse({}), source: 'manual', health: input.model.state }], routes: source.routes });
    audit(req.user.id, 'admin.ai_model_added', 'ai_configuration_revision', draft.id, { providerId: input.model.providerId, modelId: input.model.modelId, reason: input.reason });
    res.status(201).json({ revision: safeRevision(draft) });
  });

  app.post('/api/admin/ai/models/discover', ...secureMutation('ai.models.manage'), asyncHandler(async (req, res) => {
    const input = z.object({ revisionId, providerId, reason }).strict().parse(req.body || {});
    const draft = await service.discoverDraftModels({ revisionId: input.revisionId, providerId: input.providerId, reason: input.reason, auth: auth(req) });
    res.status(201).json({ revision: safeRevision(draft) });
  }));

  app.get('/api/admin/ai/routing', requireAuth, requireCapability('ai.providers.view'), (req, res) => {
    const selected = sourceRevision(repository, String(req.query.revisionId || ''));
    const snapshot = selected ? null : captureAiRuntimeConfiguration();
    res.json({ revisionId: selected?.id || snapshot.revisionId, routes: selected?.routes || snapshot.routes });
  });

  app.put('/api/admin/ai/routing', ...secureMutation('ai.routing.manage'), (req, res) => {
    const input = z.object({ revisionId, reason, routes: z.array(routeInput).max(40) }).strict().parse(req.body || {});
    const source = sourceRevision(repository, input.revisionId);
    const draft = service.createRoutingDraft({ auth: auth(req), reason: input.reason, parentRevisionId: source.id, providers: source.providers, models: source.models, routes: input.routes });
    audit(req.user.id, 'admin.ai_routing_changed', 'ai_configuration_revision', draft.id, { reason: input.reason, routeIds: input.routes.map((route) => route.routeId) });
    res.status(201).json({ revision: safeRevision(draft) });
  });

  app.get('/api/admin/ai/health', requireAuth, requireCapability('ai.health.view'), (req, res) => {
    const days = z.coerce.number().int().min(1).max(90).catch(7).parse(req.query.days);
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const snapshot = captureAiRuntimeConfiguration();
    const telemetry = store.prepare(`
      SELECT provider, model, configuration_revision, route_id, mode, status, circuit_state,
        COUNT(*) AS calls, COALESCE(ROUND(AVG(latency_ms)), 0) AS average_latency_ms,
        COALESCE(SUM(total_tokens), 0) AS total_tokens, COALESCE(SUM(fallback_count), 0) AS fallbacks,
        COALESCE(MAX(queue_depth), 0) AS maximum_queue_depth
      FROM ai_usage_events WHERE created_at >= ?
      GROUP BY provider, model, configuration_revision, route_id, mode, status, circuit_state
      ORDER BY calls DESC LIMIT 200
    `).all(since);
    res.json({ days, since, runtime: publicRuntimeSnapshot(snapshot, config), readiness: getAiReadiness(snapshot), telemetry });
  });

  app.post('/api/admin/ai/health/test', ...secureMutation('ai.providers.manage'), asyncHandler(async (req, res) => {
    const input = z.object({ revisionId }).strict().parse(req.body || {});
    const tested = await service.testDraft({ revisionId: input.revisionId, auth: auth(req) });
    res.json({ revision: safeRevision(tested) });
  }));

  app.post('/api/admin/ai/health/canary', ...secureMutation('ai.health.view'), asyncHandler(async (req, res) => {
    const input = z.object({ revisionId }).strict().parse(req.body || {});
    const results = await service.runDraftCanaries({ revisionId: input.revisionId, auth: auth(req) });
    res.json({ revisionId: input.revisionId, syntheticOnly: true, results });
  }));

  app.get('/api/admin/ai/changes', requireAuth, requireCapability('ai.providers.view'), (req, res) => {
    const query = z.object({ state: z.enum(['draft', 'tested', 'active', 'superseded']).catch(''), cursor: z.coerce.number().int().positive().catch(Number.MAX_SAFE_INTEGER), limit: z.coerce.number().int().min(1).max(100).catch(25) }).parse(req.query);
    const page = repository.listRevisions({ state: query.state, beforeRevisionNumber: query.cursor, limit: query.limit });
    res.json({ changes: page.revisions.map(safeRevision), nextCursor: page.nextCursor, pointers: repository.getPointers() });
  });

  app.get('/api/admin/ai/changes/:revisionId', requireAuth, requireCapability('ai.providers.view'), (req, res) => {
    const selected = sourceRevision(repository, req.params.revisionId);
    res.json({ revision: safeRevision(selected), pointers: repository.getPointers() });
  });

  app.get('/api/admin/ai/changes/:revisionId/preview', requireAuth, requireCapability('ai.providers.view'), (req, res) => {
    res.json({ preview: service.previewActivation({ revisionId: req.params.revisionId, auth: auth(req) }) });
  });

  app.post('/api/admin/ai/changes/:revisionId/activate', ...secureMutation('ai.routing.manage'), asyncHandler(async (req, res) => {
    const input = z.object({ reason, confirmation: z.string().max(200), approval: z.object({ approverUserId: z.string().min(1).max(100) }).strict().optional() }).strict().parse(req.body || {});
    exactConfirmation(input.confirmation, `ACTIVATE ${req.params.revisionId}`);
    const activated = await service.activateRevision({ revisionId: req.params.revisionId, reason: input.reason, auth: auth(req), approval: input.approval || null });
    res.json({ revision: safeRevision(activated), pointers: repository.getPointers() });
  }));

  app.post('/api/admin/ai/changes/rollback', ...secureMutation('ai.routing.manage'), (req, res) => {
    const input = z.object({ targetRevisionId: z.string().trim().max(160).optional(), reason, confirmation: z.string().max(120) }).strict().parse(req.body || {});
    exactConfirmation(input.confirmation, 'ROLLBACK AI');
    const rolledBack = service.rollbackRevision({ targetRevisionId: input.targetRevisionId || null, reason: input.reason, auth: auth(req) });
    res.json({ revision: safeRevision(rolledBack), pointers: repository.getPointers() });
  });

  app.post('/api/admin/ai/changes/emergency-disable', ...secureMutation('ai.routing.manage'), (req, res) => {
    const input = z.object({ reason, confirmation: z.string().max(120) }).strict().parse(req.body || {});
    exactConfirmation(input.confirmation, 'DISABLE AI');
    const disabled = service.emergencyDisable({ reason: input.reason, auth: auth(req) });
    res.json({ revision: safeRevision(disabled), pointers: repository.getPointers() });
  });

  return { repository, service };
}
