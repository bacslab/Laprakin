import crypto from 'node:crypto';
import { deepFreezeCopy } from './ai-configuration-validation.js';
import { routeIdForRequest } from './ai-routing.js';
import { buildProcessorManifest } from './processor-manifest.js';

function environmentProviderRecords(environment) {
  const providers = [];
  if (environment?.naraRouterApiKey) {
    providers.push({
      providerId: 'nararouter', displayName: 'NaraRouter', adapterType: 'openai-compatible',
      baseUrl: String(environment.naraRouterBaseUrl || ''), enabled: true, state: 'active', source: 'environment',
    });
  }
  if (environment?.cloudflareAiEnabled && environment?.cloudflareAccountId && environment?.cloudflareAiToken) {
    providers.push({
      providerId: 'cloudflare', displayName: 'Cloudflare Workers AI', adapterType: 'openai-compatible',
      baseUrl: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(environment.cloudflareAccountId)}/ai/v1`,
      enabled: true, state: 'active', source: 'environment',
    });
  }
  return providers;
}

function environmentModel(model) {
  return {
    providerId: String(model?.provider || model?.providerId || 'nararouter'),
    modelId: String(model?.model || model?.modelId || ''),
    enabled: true,
    state: 'available',
    capabilities: {
      vision: model?.supportsVision === true,
      reasoning: model?.supportsReasoning === true,
      structuredOutput: model?.supportsStructuredOutput === true,
      tools: model?.supportsTools === true,
    },
    capabilityEvidence: model?.capabilityEvidence || {},
    contextWindow: Number(model?.contextLimit || model?.contextWindow || 128000),
    source: 'environment-discovery',
  };
}

function environmentRevisionId(environment, providers) {
  const material = {
    providers: providers.map((provider) => ({ providerId: provider.providerId, baseUrl: provider.baseUrl })),
    models: [environment?.aiModelChat, environment?.aiModelDocument, environment?.aiModelVision, environment?.aiModelReviewer, environment?.cloudflareAiModel],
  };
  return `environment:${crypto.createHash('sha256').update(JSON.stringify(material)).digest('hex').slice(0, 16)}`;
}

function revisionSnapshot(revision, source, capturedAt) {
  const enabledProviders = (revision.providers || []).filter((provider) => provider.enabled !== false);
  const enabledModels = (revision.models || []).filter((model) => model.enabled !== false && model.state !== 'archived');
  const enabledRoutes = (revision.routes || []).filter((route) => route.enabled !== false);
  const available = enabledProviders.length > 0 && enabledModels.length > 0 && enabledRoutes.length > 0;
  return deepFreezeCopy({
    source,
    revisionId: revision.id,
    capturedAt,
    available,
    degradedReason: available ? '' : 'AI_RUNTIME_ACTIVE_REVISION_DEGRADED',
    providers: enabledProviders,
    models: enabledModels,
    routes: enabledRoutes,
    processorManifest: buildProcessorManifest({}, { activeRevision: revision }),
  });
}

export function createAiRuntimeResolver({
  repository,
  environment = {},
  getEnvironmentModels = () => [],
  now = () => new Date().toISOString(),
} = {}) {
  if (!repository) throw new TypeError('AI runtime repository is required.');
  return Object.freeze({
    capture({ revisionId = '' } = {}) {
      const capturedAt = now();
      if (revisionId) {
        const requested = repository.getRevision(String(revisionId));
        if (!requested) return deepFreezeCopy({ source: 'unavailable', revisionId: String(revisionId), capturedAt, available: false, degradedReason: 'AI_RUNTIME_REVISION_NOT_FOUND', providers: [], models: [], routes: [], processorManifest: buildProcessorManifest({}) });
        return revisionSnapshot(requested, 'revision', capturedAt);
      }
      const active = repository.getActiveRevision();
      if (active) return revisionSnapshot(active, 'active', capturedAt);
      const providers = environmentProviderRecords(environment);
      if (providers.length) {
        const models = (getEnvironmentModels() || []).map(environmentModel).filter((model) => model.modelId);
        return deepFreezeCopy({
          source: 'environment',
          revisionId: environmentRevisionId(environment, providers),
          capturedAt,
          available: models.length > 0,
          degradedReason: models.length ? '' : 'AI_RUNTIME_MODEL_CATALOG_EMPTY',
          providers,
          models,
          routes: [],
          processorManifest: buildProcessorManifest(environment),
        });
      }
      return deepFreezeCopy({
        source: 'unavailable', revisionId: 'unavailable', capturedAt, available: false,
        degradedReason: 'AI_RUNTIME_NOT_CONFIGURED', providers: [], models: [], routes: [], processorManifest: buildProcessorManifest(environment),
      });
    },
  });
}

export function resolveRuntimeRoute(snapshot, request = {}) {
  const routeId = routeIdForRequest(request);
  const route = (snapshot?.routes || []).find((item) => item.routeId === routeId && item.enabled !== false);
  if (!route) return null;
  const disclosed = new Set((snapshot?.processorManifest?.providers || []).map((provider) => String(provider.id)));
  const allCandidates = [
    { providerId: String(route.primaryProviderId), modelId: String(route.primaryModelId) },
    ...(route.fallbacks || []).map((fallback) => ({ providerId: String(fallback.providerId), modelId: String(fallback.modelId) })),
  ];
  const candidates = allCandidates.filter((candidate) => disclosed.has(candidate.providerId));
  return {
    routeId,
    candidates,
    filteredUndisclosed: allCandidates.length - candidates.length,
    reasoningEffort: route.reasoningEffort || 'low',
    timeoutMs: Number(route.timeoutMs || 0),
    outputTokenLimit: Number(route.outputTokenLimit || 0),
    requiresVision: Boolean(route.requiresVision),
    requiresStructuredOutput: Boolean(route.requiresStructuredOutput),
  };
}
