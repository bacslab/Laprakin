import assert from 'node:assert/strict';
import test from 'node:test';

import { modelEligibleForRoute } from '../src/ai.js';

test('model visual tetap dapat dipakai ketika hasil JSON dijaga lewat instruksi', () => {
  const visualModel = { supportsVision: true, supportsStructuredOutput: false };
  assert.equal(modelEligibleForRoute(visualModel, {
    visual: true,
    requiresStructuredOutput: true,
    route: 'vision',
  }), true);
});

test('model teks tetap dapat mengikuti skema JSON melalui instruksi', () => {
  const textModel = { supportsVision: false, supportsStructuredOutput: false };
  assert.equal(modelEligibleForRoute(textModel, {
    visual: false,
    requiresStructuredOutput: true,
    route: 'document',
  }), true);
});
