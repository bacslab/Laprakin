import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8').catch(() => '');

const [adminWorkspace, aiWorkspace, routes, providers, providerDetail, models, routing, health, changes, shared, legacy, main, idLocale, enLocale] = await Promise.all([
  read('../src/pages/Admin/AdminWorkspace.jsx'),
  read('../src/pages/Admin/ai/AdminAiWorkspace.jsx'),
  read('../src/pages/Admin/ai/AdminAiRoutes.jsx'),
  read('../src/pages/Admin/ai/ProvidersModule.jsx'),
  read('../src/pages/Admin/ai/ProviderDetailModule.jsx'),
  read('../src/pages/Admin/ai/ModelsModule.jsx'),
  read('../src/pages/Admin/ai/RoutingModule.jsx'),
  read('../src/pages/Admin/ai/HealthModule.jsx'),
  read('../src/pages/Admin/ai/ChangesModule.jsx'),
  read('../src/pages/Admin/ai/shared.jsx'),
  read('../src/pages/Admin/LegacyAdminWorkspace.jsx'),
  read('../src/main.jsx'),
  read('../src/i18n/id.json'),
  read('../src/i18n/en.json'),
]);

const adminAi = await import('../src/lib/admin-ai.js').catch(() => ({}));

test('admin AI routes resolve stable deep links without mounting the legacy workspace', () => {
  assert.equal(typeof adminAi.resolveAdminAiRoute, 'function');
  assert.deepEqual(adminAi.resolveAdminAiRoute('/admin/ai/providers'), { module: 'providers', providerId: '' });
  assert.deepEqual(adminAi.resolveAdminAiRoute('/admin/ai/providers/nararouter'), { module: 'provider', providerId: 'nararouter' });
  assert.deepEqual(adminAi.resolveAdminAiRoute('/admin/ai/models'), { module: 'models', providerId: '' });
  assert.deepEqual(adminAi.resolveAdminAiRoute('/admin/ai/routing'), { module: 'routing', providerId: '' });
  assert.deepEqual(adminAi.resolveAdminAiRoute('/admin/ai/health'), { module: 'health', providerId: '' });
  assert.deepEqual(adminAi.resolveAdminAiRoute('/admin/ai/changes'), { module: 'changes', providerId: '' });
  assert.match(adminWorkspace, /pathname\.startsWith\('\/admin\/ai'/);
  assert.match(adminWorkspace, /AdminAiWorkspace/);
  assert.match(adminWorkspace, /LegacyWorkspace/);
});

test('AI modules are split at the route boundary and own independent resource states', () => {
  for (const file of ['ProvidersModule', 'ProviderDetailModule', 'ModelsModule', 'RoutingModule', 'HealthModule', 'ChangesModule']) {
    assert.match(routes, new RegExp(`loadPage\\(\\(\\) => import\\('\\.\\/${file}'\\)\\)`));
  }
  assert.match(shared, /export function useAdminResource/);
  assert.match(shared, /lastUpdated/);
  assert.match(shared, /retry/);
  assert.match(shared, /role="alert"/);
  assert.match(shared, /role="status"/);
  assert.doesNotMatch(routes, /admin\/(?:cms|users|feedback|audit|overview)/);
});

test('admin AI client preserves filter and cursor state at the network boundary', async () => {
  assert.equal(typeof adminAi.createAdminAiClient, 'function');
  const calls = [];
  const client = adminAi.createAdminAiClient(async (...args) => {
    calls.push(args);
    return { ok: true };
  });

  await client.providers({ q: 'nara router', state: 'active', cursor: '25', limit: 25 });
  await client.models({ providerId: 'managed', state: 'available', cursor: '50' });
  await client.changes({ state: 'tested', cursor: '19' });

  assert.equal(calls[0][0], '/admin/ai/providers?q=nara+router&state=active&cursor=25&limit=25');
  assert.equal(calls[1][0], '/admin/ai/models?providerId=managed&state=available&cursor=50');
  assert.equal(calls[2][0], '/admin/ai/changes?state=tested&cursor=19');
});

test('capabilities drive mutation affordances rather than role labels', () => {
  assert.equal(typeof adminAi.adminAiAffordances, 'function');
  assert.deepEqual(adminAi.adminAiAffordances(['ai.providers.view', 'ai.credentials.rotate']), {
    viewProviders: true,
    manageProviders: false,
    rotateCredentials: true,
    manageModels: false,
    manageRouting: false,
    viewHealth: false,
  });
  assert.match(aiWorkspace, /capabilities/);
  assert.doesNotMatch(aiWorkspace, /role\s*===\s*['"]admin['"]/);
  assert.match(main, /PRIVILEGED_ADMIN_ROLES/);
});

test('provider credentials are password-only, cleared after success, and never persisted or revealed', () => {
  const credentialSource = `${providers}\n${providerDetail}`;
  assert.match(credentialSource, /type="password"/);
  assert.match(credentialSource, /autoComplete="new-password"/);
  assert.match(credentialSource, /setCredential\(['"]['"]\)/);
  assert.doesNotMatch(credentialSource, /type="text"[^>]+credential/i);
  assert.doesNotMatch(credentialSource, /(?:localStorage|sessionStorage)/);
  assert.doesNotMatch(credentialSource, /reveal|showCredential|showSecret/i);
});

test('creating a provider follows the immutable draft revision instead of reloading active state', () => {
  assert.match(providers, /const result = await client\.createProvider/);
  assert.match(providers, /result\.revision\.id/);
  assert.match(providers, /navigate\(`\$\{ADMIN_AI_PATHS\.providers\}\/\$\{encodeURIComponent\(createdProviderId\)\}/);
});

test('destructive and activation actions use explicit accessible confirmations', () => {
  assert.match(shared, /aria-modal="true"/);
  assert.match(shared, /role="dialog"/);
  assert.match(shared, /confirmation/);
  assert.match(shared, /reason/);
  assert.match(routes, /preview/);
  assert.match(routes, /canary/);
  assert.match(routes, /activate/);
  assert.match(routes, /rollback/);
  assert.match(routes, /emergencyDisable/);
});

test('legacy admin tabs use paths instead of volatile component state', () => {
  assert.match(legacy, /useLocation/);
  assert.match(legacy, /legacyAdminPath/);
  assert.match(legacy, /t\('admin\.console\.tabs\.ai'\)/);
  assert.doesNotMatch(legacy, /useState\(['"]overview['"]\)/);
});

test('every Admin AI module uses keyed Indonesian and English copy', () => {
  const moduleSources = [aiWorkspace, routes, providers, providerDetail, models, routing, health, changes, shared];
  for (const source of moduleSources) assert.match(source, /useI18n|useAdminAiCopy/);
  const id = JSON.parse(idLocale);
  const en = JSON.parse(enLocale);
  assert.equal(typeof id.admin?.ai?.providers?.title, 'string');
  assert.equal(typeof en.admin?.ai?.providers?.title, 'string');
  assert.equal(typeof id.admin?.ai?.common?.reason, 'string');
  assert.equal(typeof en.admin?.ai?.common?.reason, 'string');
});
