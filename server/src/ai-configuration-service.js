import { buildProcessorManifest } from './processor-manifest.js';
import {
  AI_TEST_EVIDENCE_TTL_MS,
  AiConfigurationValidationError,
  assertFreshTestEvidence,
  deepFreezeCopy,
  isProductionProviderReplacement,
  routeDiff,
  syntheticCanaryCase,
} from './ai-configuration-validation.js';

export class AiConfigurationServiceError extends Error {
  constructor(message, code, status = 400) {
    super(message);
    this.name = 'AiConfigurationServiceError';
    this.code = code;
    this.status = status;
  }
}

function authorize(auth, capability, { requireMfa = false } = {}) {
  if (!auth?.actorUserId || !Array.isArray(auth.capabilities) || !auth.capabilities.includes(capability)) {
    throw new AiConfigurationServiceError('This AI configuration action is not authorized.', 'AI_CONFIGURATION_CAPABILITY_REQUIRED', 403);
  }
  if (requireMfa && auth.recentMfa !== true) {
    throw new AiConfigurationServiceError('Recent MFA verification is required.', 'AI_CONFIGURATION_MFA_REQUIRED', 403);
  }
  return String(auth.actorUserId);
}

function cloneInput(revision, overrides = {}) {
  return {
    providers: structuredClone(revision.providers || []),
    models: structuredClone(revision.models || []),
    routes: structuredClone(revision.routes || []),
    parentRevisionId: revision.id,
    ...overrides,
  };
}

function requireRevision(repository, revisionId, state = '') {
  const revision = repository.getRevision(revisionId);
  if (!revision) throw new AiConfigurationServiceError('AI configuration revision was not found.', 'AI_CONFIGURATION_NOT_FOUND', 404);
  if (state && revision.state !== state) {
    throw new AiConfigurationServiceError(`AI configuration revision must be ${state}.`, `AI_CONFIGURATION_NOT_${state.toUpperCase()}`);
  }
  return revision;
}

function safeResult(result) {
  return {
    ok: result?.ok === true,
    code: String(result?.code || '').slice(0, 80),
    modelCount: Math.max(0, Number(result?.modelCount || 0)),
  };
}

export function createAiConfigurationService({
  repository,
  secretStore = null,
  adapterForProvider = null,
  now = () => new Date().toISOString(),
  production = false,
  evidenceTtlMs = AI_TEST_EVIDENCE_TTL_MS,
  recordAudit = null,
  secondApproval = null,
} = {}) {
  if (!repository) throw new TypeError('AI configuration repository is required.');

  const record = (actorUserId, action, revisionId, metadata = {}) => {
    recordAudit?.(actorUserId, action, 'ai_configuration_revision', revisionId, metadata);
  };

  const adapterFor = async (provider, revision) => {
    if (typeof adapterForProvider !== 'function') {
      throw new AiConfigurationServiceError('Provider adapter is unavailable.', 'AI_CONFIGURATION_ADAPTER_UNAVAILABLE', 503);
    }
    return adapterForProvider(provider, revision);
  };

  function createDraft({ auth, reason, providers, models, routes, parentRevisionId = null }) {
    const actorUserId = authorize(auth, 'ai.providers.manage');
    const draft = repository.createDraft({ providers, models, routes, parentRevisionId, actorUserId, reason, production: false });
    record(actorUserId, 'admin.ai_configuration_draft_created', draft.id, { parentRevisionId: parentRevisionId || null, reason: String(reason || '').slice(0, 500) });
    return draft;
  }

  async function replaceCredential({ revisionId, providerId, credential, reason, auth }) {
    const actorUserId = authorize(auth, 'ai.credentials.rotate', { requireMfa: true });
    if (!secretStore?.put) throw new AiConfigurationServiceError('AI credential store is unavailable.', 'AI_CONFIGURATION_SECRET_STORE_UNAVAILABLE', 503);
    const source = requireRevision(repository, revisionId);
    const provider = source.providers.find((item) => item.providerId === providerId);
    if (!provider) throw new AiConfigurationServiceError('Provider was not found in the revision.', 'AI_CONFIGURATION_PROVIDER_NOT_FOUND', 404);
    const metadata = await secretStore.put({ providerId, value: credential, actorUserId });
    const providers = source.providers.map((item) => item.providerId !== providerId ? item : {
      ...item,
      secretReference: metadata.reference,
      secretVersion: String(metadata.secretVersion),
      credentialFingerprint: metadata.fingerprint,
      credentialLastFour: metadata.lastFour,
      state: 'draft',
    });
    const draft = repository.createDraft(cloneInput(source, { providers, actorUserId, reason, production: false }));
    record(actorUserId, 'admin.ai_credential_replaced', draft.id, {
      parentRevisionId: source.id, providerId, secretVersion: String(metadata.secretVersion), credentialFingerprint: metadata.fingerprint,
    });
    return draft;
  }

  async function discoverDraftModels({ revisionId, providerId, reason = 'Refresh provider model catalog', auth }) {
    const actorUserId = authorize(auth, 'ai.models.manage', { requireMfa: true });
    const source = requireRevision(repository, revisionId, 'draft');
    const provider = source.providers.find((item) => item.providerId === providerId);
    if (!provider) throw new AiConfigurationServiceError('Provider was not found in the revision.', 'AI_CONFIGURATION_PROVIDER_NOT_FOUND', 404);
    let discovered;
    try { discovered = await (await adapterFor(provider, source)).discoverModels(); } catch {
      throw new AiConfigurationServiceError('Provider model discovery failed.', 'AI_CONFIGURATION_DISCOVERY_FAILED', 502);
    }
    const retained = source.models.map((model) => model.providerId !== providerId || model.source === 'manual'
      ? model
      : { ...model, state: 'unavailable', health: 'unavailable' });
    const discoveredIds = new Set(discovered.map((model) => model.modelId));
    const models = [
      ...retained.filter((model) => model.providerId !== providerId || !discoveredIds.has(model.modelId)),
      ...discovered.map((model) => ({ ...model, providerId, source: model.source || 'discovered' })),
    ];
    const draft = repository.createDraft(cloneInput(source, { models, actorUserId, reason, production: false }));
    record(actorUserId, 'admin.ai_models_discovered', draft.id, { parentRevisionId: source.id, providerId, modelCount: discovered.length });
    return draft;
  }

  async function canaryEvidence(draft) {
    const providerResults = [];
    const adapterMap = new Map();
    for (const provider of draft.providers.filter((item) => item.enabled)) {
      const adapter = await adapterFor(provider, draft);
      adapterMap.set(provider.providerId, adapter);
      const result = safeResult(await adapter.testConnection({ syntheticOnly: true }));
      if (!result.ok) throw new Error(result.code || 'connection failed');
      providerResults.push({ providerId: provider.providerId, ...result });
    }
    const routeResults = [];
    const seen = new Set();
    for (const route of draft.routes.filter((item) => item.enabled)) {
      const targets = [{ providerId: route.primaryProviderId, modelId: route.primaryModelId }, ...(route.fallbacks || [])];
      for (const target of targets) {
        const key = `${target.providerId}\u0000${target.modelId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const adapter = adapterMap.get(target.providerId);
        if (!adapter) throw new Error('adapter unavailable');
        const result = safeResult(await adapter.runCanary({
          model: target.modelId,
          testCase: syntheticCanaryCase(route),
          requiresVision: route.requiresVision,
          requiresStructuredOutput: route.requiresStructuredOutput,
        }));
        if (!result.ok) throw new Error(result.code || 'canary failed');
        routeResults.push({ routeId: route.routeId, providerId: target.providerId, modelId: target.modelId, ok: true, code: result.code });
      }
    }
    return { providers: providerResults, routes: routeResults };
  }

  async function runDraftCanaries({ revisionId, auth }) {
    authorize(auth, 'ai.health.view', { requireMfa: true });
    const draft = requireRevision(repository, revisionId, 'draft');
    try { return await canaryEvidence(draft); } catch {
      throw new AiConfigurationServiceError('AI configuration test failed.', 'AI_CONFIGURATION_TEST_FAILED', 502);
    }
  }

  async function testDraft({ revisionId, auth }) {
    const actorUserId = authorize(auth, 'ai.providers.manage', { requireMfa: true });
    const draft = requireRevision(repository, revisionId, 'draft');
    let results;
    try { results = await canaryEvidence(draft); } catch {
      record(actorUserId, 'admin.ai_configuration_test_failed', draft.id, { syntheticOnly: true });
      throw new AiConfigurationServiceError('AI configuration test failed.', 'AI_CONFIGURATION_TEST_FAILED', 502);
    }
    const issuedAt = now();
    const active = repository.getActiveRevision();
    const evidence = {
      revisionId: draft.id,
      actorUserId,
      issuedAt,
      expiresAt: new Date(Date.parse(issuedAt) + evidenceTtlMs).toISOString(),
      passed: true,
      syntheticOnly: true,
      routeDiff: routeDiff(active, draft),
      results,
    };
    const tested = repository.markTested({ revisionId: draft.id, actorUserId, evidence });
    record(actorUserId, 'admin.ai_configuration_test_passed', draft.id, { expiresAt: evidence.expiresAt, routeDiff: evidence.routeDiff, syntheticOnly: true });
    return tested;
  }

  function previewActivation({ revisionId, auth }) {
    authorize(auth, 'ai.providers.view');
    const revision = requireRevision(repository, revisionId, 'tested');
    let evidence;
    try { evidence = assertFreshTestEvidence(revision, { now, ttlMs: evidenceTtlMs }); } catch (error) {
      if (error instanceof AiConfigurationValidationError) throw error;
      throw new AiConfigurationServiceError('AI configuration test evidence is invalid.', 'AI_CONFIGURATION_TEST_EVIDENCE_INVALID');
    }
    const active = repository.getActiveRevision();
    return {
      revisionId: revision.id,
      activeRevisionId: active?.id || null,
      routeDiff: routeDiff(active, revision),
      evidenceExpiresAt: evidence.expiresAt,
      productionProviderReplacement: isProductionProviderReplacement(active, revision),
    };
  }

  async function activateRevision({ revisionId, reason, auth, approval = null }) {
    const actorUserId = authorize(auth, 'ai.routing.manage', { requireMfa: true });
    const preview = previewActivation({ revisionId, auth });
    if (production && preview.productionProviderReplacement) {
      const approverUserId = String(approval?.approverUserId || '');
      if (!approverUserId || approverUserId === actorUserId || typeof secondApproval !== 'function') {
        throw new AiConfigurationServiceError('Independent approval is required for production provider replacement.', 'AI_CONFIGURATION_SECOND_APPROVAL_REQUIRED', 403);
      }
      const approved = await secondApproval({ revisionId, actorUserId, approverUserId, reason: String(reason || ''), routeDiff: preview.routeDiff });
      if (approved !== true) throw new AiConfigurationServiceError('Independent approval was not granted.', 'AI_CONFIGURATION_SECOND_APPROVAL_REQUIRED', 403);
    }
    const activated = repository.activate({ revisionId, actorUserId, reason });
    record(actorUserId, 'admin.ai_configuration_activated', activated.id, {
      reason: String(reason || '').slice(0, 500), previousRevisionId: preview.activeRevisionId, routeDiff: preview.routeDiff,
      approvalUserId: approval?.approverUserId || null,
    });
    return activated;
  }

  function rollbackRevision({ targetRevisionId = null, reason, auth }) {
    const actorUserId = authorize(auth, 'ai.routing.manage', { requireMfa: true });
    const before = repository.getPointers();
    const rolledBack = repository.rollback({ targetRevisionId, actorUserId, reason });
    record(actorUserId, 'admin.ai_configuration_rolled_back', rolledBack.id, {
      reason: String(reason || '').slice(0, 500), previousRevisionId: before.activeRevisionId,
    });
    return rolledBack;
  }

  function captureActiveConfiguration() {
    const revision = repository.getActiveRevision();
    return revision ? deepFreezeCopy({
      capturedAt: now(),
      revision,
      processorManifest: buildProcessorManifest({}, { activeRevision: revision }),
    }) : null;
  }

  return {
    createDraft,
    replaceCredential,
    discoverDraftModels,
    runDraftCanaries,
    testDraft,
    previewActivation,
    activateRevision,
    rollbackRevision,
    captureActiveConfiguration,
  };
}
