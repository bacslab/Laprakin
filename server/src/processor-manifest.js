const PROCESSOR_MANIFEST_VERSION = '2026-09-02.v1';
const PROCESSOR_POLICY_VERSION = 'external-ai.2026-09-02';
const EXTERNAL_AI_DATA_CLASSES = Object.freeze(['chat_content', 'uploaded_source_text', 'document_draft', 'academic_profile_context']);

function naraRouterProvider(config) {
  return {
    id: 'nararouter',
    displayName: 'NaraRouter',
    adapterType: 'openai-compatible',
    configured: Boolean(config.naraRouterApiKey),
    dataClasses: [...EXTERNAL_AI_DATA_CLASSES],
    purpose: 'Menjawab chat dan membantu menyusun dokumen akademik.',
  };
}

function cloudflareProvider(config) {
  return {
    id: 'cloudflare',
    displayName: 'Cloudflare Workers AI',
    adapterType: 'openai-compatible',
    configured: Boolean(config.cloudflareAiEnabled && config.cloudflareAccountId && config.cloudflareAiToken),
    dataClasses: [...EXTERNAL_AI_DATA_CLASSES],
    purpose: 'Menyediakan kapasitas AI cadangan untuk permintaan teks.',
  };
}

function activeProviders(activeRevision) {
  return (activeRevision?.providers || []).filter((provider) => provider.enabled !== false).map((provider) => ({
    id: String(provider.providerId),
    displayName: String(provider.displayName || provider.providerId),
    adapterType: String(provider.adapterType || ''),
    configured: Boolean(provider.secretReference),
    dataClasses: [...EXTERNAL_AI_DATA_CLASSES],
    purpose: 'Menjawab chat dan membantu menyusun dokumen akademik.',
  })).filter((provider) => provider.configured);
}

export function buildProcessorManifest(config = {}, { activeRevision = null } = {}) {
  const providers = activeRevision
    ? activeProviders(activeRevision)
    : [naraRouterProvider(config), cloudflareProvider(config)].filter((provider) => provider.configured);
  return {
    manifestVersion: PROCESSOR_MANIFEST_VERSION,
    policyVersion: PROCESSOR_POLICY_VERSION,
    configurationRevisionId: activeRevision?.id || null,
    providers,
    trainingUse: 'not_declared_by_runtime',
    retention: 'refer_to_current_privacy_policy',
  };
}

export { EXTERNAL_AI_DATA_CLASSES, PROCESSOR_MANIFEST_VERSION, PROCESSOR_POLICY_VERSION };
