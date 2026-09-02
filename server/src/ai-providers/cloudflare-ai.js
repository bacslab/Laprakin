import { createOpenAiCompatibleAdapter } from './openai-compatible.js';

function configuredModelRecord(modelId) {
  return {
    providerId: 'cloudflare',
    modelId,
    source: 'configured',
    enabled: true,
    state: 'unverified',
    capabilities: { vision: null, reasoning: null, structuredOutput: null, tools: null },
    capabilityEvidence: { vision: 'unverified', reasoning: 'unverified', structuredOutput: 'unverified', tools: 'unverified' },
    contextWindow: 0,
    maxOutputTokens: 0,
    health: 'unknown',
  };
}

export function createCloudflareAiAdapter({ accountId, getToken, configuredModel, ...options } = {}) {
  const modelId = String(configuredModel || '').trim();
  const adapter = createOpenAiCompatibleAdapter({
    ...options,
    id: 'cloudflare',
    displayName: 'Cloudflare Workers AI',
    baseUrl: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(String(accountId || ''))}/ai/v1`,
    getToken,
  });
  return Object.freeze({
    ...adapter,
    async discoverModels() { return modelId ? [configuredModelRecord(modelId)] : []; },
    async testConnection({ signal, timeoutMs } = {}) {
      if (!modelId) return { ok: false, providerId: 'cloudflare', code: 'AI_MODEL_NOT_CONFIGURED' };
      return adapter.runCanary({ model: modelId, signal, timeoutMs });
    },
  });
}
