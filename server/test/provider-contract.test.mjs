import assert from 'node:assert/strict';
import test from 'node:test';

test('processor manifest exposes configured provider identity without a Gemini alias', async () => {
  const { buildProcessorManifest } = await import('../src/processor-manifest.js');
  const manifest = buildProcessorManifest({
    naraRouterApiKey: 'configured-in-test',
    naraRouterBaseUrl: 'https://openrouter.ai/api/v1',
  });
  assert.equal(manifest.providers.length, 1);
  assert.equal(manifest.providers[0].id, 'nararouter');
  assert.equal(manifest.providers[0].displayName, 'NaraRouter');
  assert.equal(Object.hasOwn(manifest, 'gemini'), false);
});
