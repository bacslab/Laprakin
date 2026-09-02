import assert from 'node:assert/strict';
import test from 'node:test';

import { modelEligibleForRoute } from '../src/ai.js';
import {
  AI_ROUTE_IDS,
  routeIdForRequest,
  validateRouteAssignments,
} from '../src/ai-routing.js';

function catalog({ vision = false, structuredOutput = true, structuredEvidence = 'verified' } = {}) {
  return {
    providers: [{ providerId: 'nararouter', enabled: true, state: 'tested' }],
    models: [{
      providerId: 'nararouter', modelId: 'model-1', enabled: true, state: 'enabled',
      capabilities: { text: true, vision, structuredOutput },
      capabilityEvidence: { vision: vision ? 'verified' : 'unverified', structuredOutput: structuredEvidence },
    }],
  };
}

function route(routeId, overrides = {}) {
  return {
    routeId,
    enabled: true,
    primaryProviderId: 'nararouter',
    primaryModelId: 'model-1',
    fallbacks: [],
    timeoutMs: 30_000,
    retryCount: 1,
    outputTokenLimit: 2_000,
    reasoningEffort: 'low',
    requiresStructuredOutput: false,
    requiresVision: false,
    costClass: 'standard',
    plans: ['free'],
    ...overrides,
  };
}

test('route vocabulary covers every product workload without exposing model IDs', () => {
  assert.deepEqual(AI_ROUTE_IDS, [
    'chat.basic', 'chat.thinking', 'chat.xtrathink', 'document.generate', 'document.revise',
    'document.review', 'document.quiz', 'document.workplan', 'document.title', 'vision.evidence', 'support.chat',
  ]);
  assert.equal(routeIdForRequest({ purpose: 'chat', mode: 'basic' }), 'chat.basic');
  assert.equal(routeIdForRequest({ purpose: 'chat', mode: 'thinking' }), 'chat.thinking');
  assert.equal(routeIdForRequest({ purpose: 'document_revision' }), 'document.revise');
  assert.equal(routeIdForRequest({ purpose: 'quiz' }), 'document.quiz');
  assert.equal(routeIdForRequest({ purpose: 'evidence', requiresVision: true }), 'vision.evidence');
  assert.equal(routeIdForRequest({ purpose: 'support' }), 'support.chat');
});

test('routing rejects disabled providers, archived models, and duplicate fallbacks', () => {
  const base = catalog();
  assert.throws(
    () => validateRouteAssignments({ ...base, providers: [{ ...base.providers[0], enabled: false }], routes: [route('chat.basic')] }),
    (error) => error.code === 'AI_ROUTE_PROVIDER_UNAVAILABLE',
  );
  assert.throws(
    () => validateRouteAssignments({ ...base, models: [{ ...base.models[0], state: 'archived' }], routes: [route('chat.basic')] }),
    (error) => error.code === 'AI_ROUTE_MODEL_UNAVAILABLE',
  );
  assert.throws(
    () => validateRouteAssignments({ ...base, routes: [route('chat.basic', { fallbacks: [{ providerId: 'nararouter', modelId: 'model-1' }] })] }),
    (error) => error.code === 'AI_ROUTE_FALLBACK_DUPLICATE',
  );
});

test('vision and structured routes require explicit verified evidence', () => {
  assert.throws(
    () => validateRouteAssignments({ ...catalog(), routes: [route('vision.evidence', { requiresVision: true })] }),
    (error) => error.code === 'AI_ROUTE_VISION_UNVERIFIED',
  );
  assert.doesNotThrow(() => validateRouteAssignments({ ...catalog({ vision: true }), routes: [route('vision.evidence', { requiresVision: true })] }));
  assert.throws(
    () => validateRouteAssignments({ ...catalog({ structuredOutput: false, structuredEvidence: 'unverified' }), routes: [route('document.generate', { requiresStructuredOutput: true })] }),
    (error) => error.code === 'AI_ROUTE_STRUCTURED_UNVERIFIED',
  );
  assert.doesNotThrow(() => validateRouteAssignments({
    ...catalog({ structuredOutput: false, structuredEvidence: 'unverified' }),
    routes: [route('document.generate', { requiresStructuredOutput: true, parserFallbackTested: true })],
  }));
});

test('production routing requires every route to be enabled and assigned', () => {
  const base = catalog({ vision: true });
  const routes = AI_ROUTE_IDS.map((routeId) => route(routeId, {
    requiresVision: routeId === 'vision.evidence',
    requiresStructuredOutput: routeId.startsWith('document.'),
  }));
  assert.equal(validateRouteAssignments({ ...base, routes, production: true }).length, AI_ROUTE_IDS.length);
  assert.throws(
    () => validateRouteAssignments({ ...base, routes: routes.slice(1), production: true }),
    (error) => error.code === 'AI_ROUTE_REQUIRED_MISSING',
  );
});

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
