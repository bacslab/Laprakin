import assert from 'node:assert/strict';
import test from 'node:test';

import { startE2eProvider } from '../../scripts/lib/e2e-provider.mjs';

test('local E2E provider exposes discovery and a deterministic sanitized outage', async () => {
  const provider = await startE2eProvider();
  try {
    const models = await fetch(`${provider.baseUrl}/models`, {
      headers: { authorization: 'Bearer synthetic-e2e-key' },
    });
    assert.equal(models.status, 200);
    assert.deepEqual(await models.json(), {
      data: [{
        id: 'laprakin-e2e-model',
        context_length: 128000,
        supportsVision: true,
        supportsReasoning: true,
        supportsStructuredOutput: true,
      }],
    });

    const completion = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer synthetic-e2e-key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: 'laprakin-e2e-model', messages: [{ role: 'user', content: 'private fixture' }] }),
    });
    assert.equal(completion.status, 503);
    assert.deepEqual(await completion.json(), { error: { code: 'E2E_PROVIDER_OUTAGE', message: 'Synthetic provider unavailable.' } });
    assert.equal(provider.requests.some((request) => JSON.stringify(request).includes('synthetic-e2e-key')), false);
    assert.equal(provider.requests.some((request) => JSON.stringify(request).includes('private fixture')), false);
  } finally {
    await provider.close();
  }
});
