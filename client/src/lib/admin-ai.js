export const ADMIN_AI_PATHS = Object.freeze({
  providers: '/admin/ai/providers',
  models: '/admin/ai/models',
  routing: '/admin/ai/routing',
  health: '/admin/ai/health',
  changes: '/admin/ai/changes',
});

const CAPABILITY_KEYS = Object.freeze({
  viewProviders: 'ai.providers.view',
  manageProviders: 'ai.providers.manage',
  rotateCredentials: 'ai.credentials.rotate',
  manageModels: 'ai.models.manage',
  manageRouting: 'ai.routing.manage',
  viewHealth: 'ai.health.view',
});

export function resolveAdminAiRoute(pathname) {
  const path = String(pathname || '').replace(/\/+$/, '') || '/';
  const providerPrefix = `${ADMIN_AI_PATHS.providers}/`;
  if (path.startsWith(providerPrefix)) {
    return { module: 'provider', providerId: decodeURIComponent(path.slice(providerPrefix.length).split('/')[0] || '') };
  }
  const module = Object.entries(ADMIN_AI_PATHS).find(([, route]) => route === path)?.[0];
  return { module: module || 'providers', providerId: '' };
}

export function buildAdminAiQuery(filters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `?${suffix}` : '';
}

export function adminAiAffordances(capabilities = []) {
  const granted = new Set(capabilities);
  return Object.fromEntries(Object.entries(CAPABILITY_KEYS).map(([key, capability]) => [key, granted.has(capability)]));
}

export function createAdminAiClient(request) {
  if (typeof request !== 'function') throw new TypeError('Admin AI client requires a request function.');
  const mutation = (path, method, body) => request(path, { method, body });
  return Object.freeze({
    capabilities: () => request('/admin/capabilities'),
    providers: (filters) => request(`/admin/ai/providers${buildAdminAiQuery(filters)}`),
    provider: (providerId, revisionId = '') => request(`/admin/ai/providers/${encodeURIComponent(providerId)}${buildAdminAiQuery({ revisionId })}`),
    createProvider: (body) => mutation('/admin/ai/providers', 'POST', body),
    updateProvider: (providerId, body) => mutation(`/admin/ai/providers/${encodeURIComponent(providerId)}`, 'PUT', body),
    disableProvider: (providerId, body) => mutation(`/admin/ai/providers/${encodeURIComponent(providerId)}`, 'DELETE', body),
    rotateCredential: (providerId, body) => mutation(`/admin/ai/providers/${encodeURIComponent(providerId)}/credential`, 'POST', body),
    deleteCredential: (providerId, body) => mutation(`/admin/ai/providers/${encodeURIComponent(providerId)}/credential`, 'DELETE', body),
    models: (filters) => request(`/admin/ai/models${buildAdminAiQuery(filters)}`),
    createModel: (body) => mutation('/admin/ai/models', 'POST', body),
    updateModel: (providerId, modelId, body) => mutation(`/admin/ai/models/${encodeURIComponent(providerId)}/${encodeURIComponent(modelId)}`, 'PUT', body),
    testModel: (providerId, modelId, body) => mutation(`/admin/ai/models/${encodeURIComponent(providerId)}/${encodeURIComponent(modelId)}/test`, 'POST', body),
    discoverModels: (body) => mutation('/admin/ai/models/discover', 'POST', body),
    routing: (revisionId = '') => request(`/admin/ai/routing${buildAdminAiQuery({ revisionId })}`),
    updateRouting: (body) => mutation('/admin/ai/routing', 'PUT', body),
    health: (days = 7) => request(`/admin/ai/health${buildAdminAiQuery({ days })}`),
    usage: (filters) => request(`/admin/ai/usage${buildAdminAiQuery(filters)}`),
    testRevision: (revisionId) => mutation('/admin/ai/health/test', 'POST', { revisionId }),
    canary: (revisionId) => mutation('/admin/ai/health/canary', 'POST', { revisionId }),
    openCircuit: (body) => mutation('/admin/ai/health/circuit/open', 'POST', body),
    clearCircuit: (body) => mutation('/admin/ai/health/circuit/clear', 'POST', body),
    updateMaintenance: (body) => mutation('/admin/ai/health/maintenance', 'POST', body),
    changes: (filters) => request(`/admin/ai/changes${buildAdminAiQuery(filters)}`),
    change: (revisionId) => request(`/admin/ai/changes/${encodeURIComponent(revisionId)}`),
    preview: (revisionId) => request(`/admin/ai/changes/${encodeURIComponent(revisionId)}/preview`),
    activate: (revisionId, body) => mutation(`/admin/ai/changes/${encodeURIComponent(revisionId)}/activate`, 'POST', body),
    rollback: (body) => mutation('/admin/ai/changes/rollback', 'POST', body),
    emergencyDisable: (body) => mutation('/admin/ai/changes/emergency-disable', 'POST', body),
  });
}

export function legacyAdminPath(tab = 'overview') {
  return tab === 'overview' ? '/admin' : `/admin/${encodeURIComponent(tab)}`;
}

export function legacyAdminTab(pathname) {
  if (String(pathname || '').startsWith('/admin/ai')) return 'overview';
  return String(pathname || '').split('/').filter(Boolean)[1] || 'overview';
}
