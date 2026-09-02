const PROCESSOR_MANIFEST_VERSION = '2026-09-02.v1';
const PROCESSOR_POLICY_VERSION = 'external-ai.2026-09-02';

function naraRouterProvider(config) {
  return {
    id: 'nararouter',
    displayName: 'NaraRouter',
    adapterType: 'openai-compatible',
    configured: Boolean(config.naraRouterApiKey),
    dataClasses: ['chat_content', 'uploaded_source_text', 'document_draft', 'academic_profile_context'],
    purpose: 'Menjawab chat dan membantu menyusun dokumen akademik.',
  };
}

export function buildProcessorManifest(config = {}) {
  const providers = [naraRouterProvider(config)].filter((provider) => provider.configured);
  return {
    manifestVersion: PROCESSOR_MANIFEST_VERSION,
    policyVersion: PROCESSOR_POLICY_VERSION,
    providers,
    trainingUse: 'not_declared_by_runtime',
    retention: 'refer_to_current_privacy_policy',
  };
}

export { PROCESSOR_MANIFEST_VERSION, PROCESSOR_POLICY_VERSION };
