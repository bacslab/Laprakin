export const AI_TEST_EVIDENCE_TTL_MS = 10 * 60 * 1000;

export class AiConfigurationValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AiConfigurationValidationError';
    this.code = code;
  }
}

function routeView(route) {
  return {
    enabled: route.enabled !== false,
    primaryProviderId: String(route.primaryProviderId || ''),
    primaryModelId: String(route.primaryModelId || ''),
    fallbacks: (route.fallbacks || []).map((item) => ({ providerId: String(item.providerId), modelId: String(item.modelId) })),
    timeoutMs: Number(route.timeoutMs || 0),
    retryCount: Number(route.retryCount || 0),
    outputTokenLimit: Number(route.outputTokenLimit || 0),
    reasoningEffort: String(route.reasoningEffort || ''),
    plans: [...(route.plans || [])].map(String).sort(),
  };
}

export function routeDiff(fromRevision, toRevision) {
  const before = new Map((fromRevision?.routes || []).map((route) => [route.routeId, routeView(route)]));
  const after = new Map((toRevision?.routes || []).map((route) => [route.routeId, routeView(route)]));
  const added = [...after.keys()].filter((id) => !before.has(id)).sort();
  const removed = [...before.keys()].filter((id) => !after.has(id)).sort();
  const changed = [...after.keys()].filter((id) => before.has(id)
    && JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id))).sort();
  return { added, removed, changed };
}

function providerMaterial(provider) {
  return {
    providerId: String(provider.providerId || ''),
    adapterType: String(provider.adapterType || ''),
    baseUrl: String(provider.baseUrl || ''),
    enabled: provider.enabled !== false,
    credentialFingerprint: String(provider.credentialFingerprint || ''),
  };
}

export function isProductionProviderReplacement(fromRevision, toRevision) {
  if (!fromRevision) return false;
  const before = [...(fromRevision.providers || [])].map(providerMaterial).sort((a, b) => a.providerId.localeCompare(b.providerId));
  const after = [...(toRevision?.providers || [])].map(providerMaterial).sort((a, b) => a.providerId.localeCompare(b.providerId));
  return JSON.stringify(before) !== JSON.stringify(after);
}

export function syntheticCanaryCase(route) {
  const routeId = String(route?.routeId || 'unknown');
  return Object.freeze({
    id: `synthetic:${routeId}`,
    owner: 'laprakin',
    dataClassification: 'synthetic_non_user',
    prompt: `LAPRAKIN_SYNTHETIC_CANARY:${routeId}: Reply with a short valid test response.`,
    requiresVision: Boolean(route?.requiresVision),
    requiresStructuredOutput: Boolean(route?.requiresStructuredOutput),
  });
}

export function assertFreshTestEvidence(revision, { now = () => new Date().toISOString(), ttlMs = AI_TEST_EVIDENCE_TTL_MS } = {}) {
  const evidence = revision?.testEvidence;
  if (revision?.state !== 'tested' || !evidence || evidence.passed !== true || evidence.syntheticOnly !== true
    || evidence.revisionId !== revision.id || evidence.actorUserId !== revision.testedByUserId) {
    throw new AiConfigurationValidationError('Configuration revision does not have valid test evidence.', 'AI_CONFIGURATION_TEST_EVIDENCE_INVALID');
  }
  const issuedAt = Date.parse(evidence.issuedAt);
  const expiresAt = Date.parse(evidence.expiresAt);
  const current = Date.parse(now());
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || !Number.isFinite(current)
    || expiresAt - issuedAt !== ttlMs || current > expiresAt) {
    throw new AiConfigurationValidationError('Configuration test evidence has expired.', 'AI_CONFIGURATION_TEST_EVIDENCE_EXPIRED');
  }
  return evidence;
}

export function deepFreezeCopy(value) {
  if (value == null) return value;
  const copy = structuredClone(value);
  const freeze = (item) => {
    if (!item || typeof item !== 'object' || Object.isFrozen(item)) return item;
    for (const child of Object.values(item)) freeze(child);
    return Object.freeze(item);
  };
  return freeze(copy);
}
