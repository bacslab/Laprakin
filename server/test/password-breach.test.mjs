import assert from 'node:assert/strict';
import test from 'node:test';

import { checkPasswordBreach } from '../src/password-breach.js';

test('password breach check uses the k-anonymous prefix and detects suffixes', async () => {
  let requestedUrl = '';
  const response = await checkPasswordBreach('password', {
    fetchImpl: async (url) => {
      requestedUrl = url;
      return new Response('1E4C9B93F3F0682250B6CF8331B7EE68FD8:42\n', { status: 200 });
    },
  });

  assert.match(requestedUrl, /https:\/\/api\.pwnedpasswords\.com\/range\/[A-F0-9]{5}$/);
  assert.deepEqual(response, { breached: true, count: 42, checked: true });
});

test('password breach check fails open when the remote service is unavailable', async () => {
  const response = await checkPasswordBreach('password', {
    fetchImpl: async () => new Response('', { status: 503 }),
  });
  assert.deepEqual(response, { breached: false, count: 0, checked: false, reason: 'UNAVAILABLE' });
});
