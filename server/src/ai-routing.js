export const AI_ROUTE_IDS = Object.freeze([
  'chat.basic',
  'chat.thinking',
  'chat.xtrathink',
  'document.generate',
  'document.revise',
  'document.review',
  'document.quiz',
  'document.workplan',
  'document.title',
  'vision.evidence',
  'support.chat',
]);

const ROUTE_SET = new Set(AI_ROUTE_IDS);

export class AiRoutingError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AiRoutingError';
    this.code = code;
  }
}

export function routeIdForRequest({ purpose = 'chat', mode = 'basic', requiresVision = false } = {}) {
  const normalizedPurpose = String(purpose || '').toLowerCase();
  const normalizedMode = String(mode || '').toLowerCase();
  if (requiresVision || /(?:^|[_\s-])(?:vision|evidence_image|image)(?:$|[_\s-])/.test(`${normalizedPurpose} ${normalizedMode}`)) return 'vision.evidence';
  if (/support/.test(normalizedPurpose)) return 'support.chat';
  if (/title/.test(normalizedPurpose)) return 'document.title';
  if (/workplan|work_plan/.test(normalizedPurpose)) return 'document.workplan';
  if (/quiz/.test(normalizedPurpose)) return 'document.quiz';
  if (/review|repair/.test(normalizedPurpose)) return 'document.review';
  if (/revis/.test(normalizedPurpose)) return 'document.revise';
  if (/document/.test(normalizedPurpose)) return 'document.generate';
  if (/xtrathink|xtra_think/.test(normalizedMode)) return 'chat.xtrathink';
  if (/thinking|think/.test(normalizedMode)) return 'chat.thinking';
  return 'chat.basic';
}

function verified(value) {
  return value === true || ['verified', 'provider', 'canary'].includes(String(value || '').toLowerCase());
}

function modelKey(providerId, modelId) {
  return `${String(providerId || '')}\u0000${String(modelId || '')}`;
}

function assertTarget({ providerId, modelId, providers, models, route, fallback = false }) {
  const provider = providers.get(providerId);
  if (!provider || provider.enabled === false || ['disabled', 'archived'].includes(String(provider.state || '').toLowerCase())) {
    throw new AiRoutingError('Assigned provider is unavailable.', 'AI_ROUTE_PROVIDER_UNAVAILABLE');
  }
  const model = models.get(modelKey(providerId, modelId));
  if (!model || model.enabled === false || String(model.state || '').toLowerCase() === 'archived') {
    throw new AiRoutingError('Assigned model is unavailable.', 'AI_ROUTE_MODEL_UNAVAILABLE');
  }
  if (!fallback && route.requiresVision) {
    if (model.capabilities?.vision !== true || !verified(model.capabilityEvidence?.vision)) {
      throw new AiRoutingError('Vision route requires verified vision evidence.', 'AI_ROUTE_VISION_UNVERIFIED');
    }
  }
  if (!fallback && route.requiresStructuredOutput) {
    const nativeStructured = model.capabilities?.structuredOutput === true
      && verified(model.capabilityEvidence?.structuredOutput);
    if (!nativeStructured && route.parserFallbackTested !== true) {
      throw new AiRoutingError('Structured route requires verified schema support or parser fallback evidence.', 'AI_ROUTE_STRUCTURED_UNVERIFIED');
    }
  }
  return { provider, model };
}

export function validateRouteAssignments({ providers = [], models = [], routes = [], production = false } = {}) {
  const providerMap = new Map(providers.map((provider) => [String(provider.providerId), provider]));
  const modelMap = new Map(models.map((model) => [modelKey(model.providerId, model.modelId), model]));
  const routeIds = new Set();
  const normalized = routes.map((route) => {
    const routeId = String(route.routeId || '');
    if (!ROUTE_SET.has(routeId)) throw new AiRoutingError('AI route ID is unknown.', 'AI_ROUTE_UNKNOWN');
    if (routeIds.has(routeId)) throw new AiRoutingError('AI route is assigned more than once.', 'AI_ROUTE_DUPLICATE');
    routeIds.add(routeId);
    if (route.enabled !== false) {
      assertTarget({ providerId: route.primaryProviderId, modelId: route.primaryModelId, providers: providerMap, models: modelMap, route });
      const seen = new Set([modelKey(route.primaryProviderId, route.primaryModelId)]);
      for (const fallback of route.fallbacks || []) {
        const key = modelKey(fallback.providerId, fallback.modelId);
        if (seen.has(key)) throw new AiRoutingError('Fallback cannot duplicate primary or another fallback.', 'AI_ROUTE_FALLBACK_DUPLICATE');
        seen.add(key);
        assertTarget({ providerId: fallback.providerId, modelId: fallback.modelId, providers: providerMap, models: modelMap, route, fallback: true });
      }
    }
    return {
      ...route,
      routeId,
      enabled: route.enabled !== false,
      fallbacks: (route.fallbacks || []).map((fallback) => ({ providerId: String(fallback.providerId), modelId: String(fallback.modelId) })),
      plans: [...new Set((route.plans || []).map(String))],
    };
  });
  if (production) {
    const missing = AI_ROUTE_IDS.filter((routeId) => !routeIds.has(routeId)
      || normalized.find((route) => route.routeId === routeId)?.enabled === false);
    if (missing.length) throw new AiRoutingError('Production-required AI routes are missing.', 'AI_ROUTE_REQUIRED_MISSING');
  }
  return normalized;
}
