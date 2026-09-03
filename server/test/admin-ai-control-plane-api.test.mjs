import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

async function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function client(base, device) {
  const cookies = new Map();
  let csrf = '';
  return {
    async request(endpoint, { omitCsrf = false, expectedStatus = 200, ...options } = {}) {
      const response = await fetch(`${base}/api${endpoint}`, {
        ...options,
        headers: {
          'content-type': 'application/json',
          'x-laprakin-device': device,
          ...(cookies.size ? { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') } : {}),
          ...(!omitCsrf && csrf ? { 'x-laprakin-csrf': csrf } : {}),
          ...(options.headers || {}),
        },
      });
      for (const setCookie of response.headers.getSetCookie?.() || [response.headers.get('set-cookie')].filter(Boolean)) {
        const [nameValue] = setCookie.split(';');
        const separator = nameValue.indexOf('=');
        if (separator > 0) cookies.set(nameValue.slice(0, separator), nameValue.slice(separator + 1));
      }
      const payload = await response.json();
      if (payload.csrfToken) csrf = payload.csrfToken;
      assert.equal(response.status, expectedStatus, payload.error?.message || endpoint);
      return payload;
    },
    async registerAndVerify(email) {
      const registered = await this.request('/auth/register', {
        method: 'POST', expectedStatus: 201,
        body: JSON.stringify({ email, password: 'KataSandi-Uji-2026' }),
      });
      return this.request('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ token: registered.developmentVerificationToken }),
      });
    },
  };
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill();
  await new Promise((resolve) => child.once('exit', resolve));
}

test('admin AI APIs enforce capabilities, MFA, revision lifecycle, confirmations, pagination, and secret-free responses', { timeout: 180_000 }, async () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-admin-ai-'));
  const providerPort = await availablePort();
  const apiPort = await availablePort();
  const providerCalls = [];
  const credential = 'private-admin-api-credential-2026';
  const provider = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    providerCalls.push({ url: request.url, authorization: request.headers.authorization || '', body: Buffer.concat(chunks).toString('utf8') });
    response.setHeader('content-type', 'application/json');
    if (request.url === '/v1/models') {
      response.end(JSON.stringify({ data: [{ id: 'test-model', supportsVision: false, supportsReasoning: true, supportsStructuredOutput: true, context_length: 64_000, max_output_tokens: 4_000 }] }));
      return;
    }
    if (request.url === '/v1/chat/completions') {
      const requestBody = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const content = requestBody.response_format ? '{"ok":true}' : 'OK';
      response.end(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }], usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } }));
      return;
    }
    response.statusCode = 404;
    response.end('{}');
  });
  await new Promise((resolve) => provider.listen(providerPort, '127.0.0.1', resolve));

  const base = `http://127.0.0.1:${apiPort}`;
  const unique = `${Date.now()}-${randomUUID()}`;
  const ownerEmail = `ai-owner-${unique}@example.test`;
  let serverOutput = '';
  const child = spawn(process.execPath, ['server/src/index.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'development', PORT: String(apiPort), APP_URL: 'http://localhost:5173', API_URL: base,
      ALLOWED_ORIGINS: 'http://localhost:5173', ADMIN_EMAIL: ownerEmail, ADMIN_MFA_REQUIRED: 'false',
      NARAROUTER_API_KEY: '', AI_REQUIRED: 'false', MANUAL_EMAIL_AUTH_ONLY: 'true', EMAIL_MODE: 'console',
      AI_CREDENTIAL_MASTER_KEY: '11'.repeat(32), AI_CREDENTIAL_KEY_VERSION: 'test-v1',
      AI_ALLOW_TEST_LOOPBACK: 'true', AI_PROVIDER_ALLOWED_HOSTS: '127.0.0.1',
      AI_PROVIDER_ALLOWED_PORTS: String(providerPort), AI_CUSTOM_PROVIDER_HOSTS: '',
      LAPRAKIN_DATA_DIR: path.join(sandbox, 'data'), LAPRAKIN_UPLOAD_DIR: path.join(sandbox, 'uploads'),
      LAPRAKIN_PUBLIC_MEDIA_DIR: path.join(sandbox, 'public-media'),
      JWT_SECRET: 'admin-ai-api-jwt-secret-2026', DEVICE_HMAC_SECRET: 'admin-ai-api-device-secret-2026',
      TOKEN_HMAC_SECRET: 'admin-ai-api-token-secret-2026',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  child.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

  let database;
  try {
    const deadline = Date.now() + 30_000;
    let serverReady = false;
    while (Date.now() < deadline) {
      try { if ((await fetch(`${base}/api/health`)).ok) { serverReady = true; break; } } catch { /* server is starting */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(serverReady, true, `API did not start.\n${serverOutput.slice(-4_000)}`);
    const owner = client(base, `ai-owner-${unique}`);
    const ownerRegistration = await owner.registerAndVerify(ownerEmail);
    assert.equal(ownerRegistration.user.role, 'admin');

    const emptyProviders = await owner.request('/admin/ai/providers');
    assert.deepEqual(emptyProviders.providers, []);

    const withoutMfa = await owner.request('/admin/ai/providers', {
      method: 'POST', expectedStatus: 428,
      body: JSON.stringify({
        reason: 'Add isolated test provider',
        provider: { providerId: 'managed', displayName: 'Managed Test', baseUrl: `http://127.0.0.1:${providerPort}/v1` },
      }),
    });
    assert.equal(withoutMfa.error.code, 'ADMIN_MFA_ENROLLMENT_REQUIRED');

    const enrollment = await owner.request('/admin/mfa/enroll', { method: 'POST', expectedStatus: 201, body: '{}' });
    const { totpCodeForTest } = await import('../src/mfa.js');
    await owner.request('/admin/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ code: totpCodeForTest(enrollment.secret, Math.floor(Date.now() / 30_000)) }),
    });
    await owner.request('/auth/me');
    const renewedMfa = await owner.request('/admin/mfa/status');
    assert.equal(renewedMfa.mfa.verified, true);

    const csrfDenied = await owner.request('/admin/ai/providers', {
      method: 'POST', omitCsrf: true, expectedStatus: 403,
      body: JSON.stringify({
        reason: 'Add isolated test provider',
        provider: { providerId: 'managed', displayName: 'Managed Test', baseUrl: `http://127.0.0.1:${providerPort}/v1` },
      }),
    });
    assert.equal(csrfDenied.error.code, 'CSRF_INVALID');

    const missingReason = await owner.request('/admin/ai/providers', {
      method: 'POST', expectedStatus: 400,
      body: JSON.stringify({
        reason: 'short',
        provider: { providerId: 'managed', displayName: 'Managed Test', baseUrl: `http://127.0.0.1:${providerPort}/v1` },
      }),
    });
    assert.equal(missingReason.error.code, 'VALIDATION_ERROR');

    const blockedHost = await owner.request('/admin/ai/providers', {
      method: 'POST', expectedStatus: 400,
      body: JSON.stringify({
        reason: 'Reject a provider outside the deployment allowlist',
        provider: { providerId: 'blocked', displayName: 'Blocked Host', baseUrl: `https://unlisted.example.test:${providerPort}/v1` },
      }),
    });
    assert.equal(blockedHost.error.code, 'AI_EGRESS_HOST_NOT_ALLOWED');
    assert.equal(String(blockedHost.error.message).includes('unlisted.example.test'), false);

    const created = await owner.request('/admin/ai/providers', {
      method: 'POST', expectedStatus: 201,
      body: JSON.stringify({
        reason: 'Add isolated test provider',
        provider: { providerId: 'managed', displayName: 'Managed Test', baseUrl: `http://127.0.0.1:${providerPort}/v1` },
      }),
    });
    assert.equal(created.revision.providers[0].credential.configured, false);
    let currentRevisionId = created.revision.id;

    const wrongConfirmation = await owner.request('/admin/ai/providers/managed/credential', {
      method: 'POST', expectedStatus: 400,
      body: JSON.stringify({ revisionId: currentRevisionId, credential, reason: 'Install initial provider credential', confirmation: 'yes' }),
    });
    assert.equal(wrongConfirmation.error.code, 'AI_CONFIGURATION_CONFIRMATION_REQUIRED');

    const rotated = await owner.request('/admin/ai/providers/managed/credential', {
      method: 'POST', expectedStatus: 201,
      body: JSON.stringify({ revisionId: currentRevisionId, credential, reason: 'Install initial provider credential', confirmation: 'ROTATE managed' }),
    });
    assert.equal(rotated.revision.providers[0].credential.configured, true);
    assert.equal(JSON.stringify(rotated).includes(credential), false);
    currentRevisionId = rotated.revision.id;

    const discovered = await owner.request('/admin/ai/models/discover', {
      method: 'POST', expectedStatus: 201,
      body: JSON.stringify({ revisionId: currentRevisionId, providerId: 'managed', reason: 'Discover the provider model catalog' }),
    });
    assert.equal(discovered.revision.models[0].modelId, 'test-model');
    currentRevisionId = discovered.revision.id;

    const selfAttestedEvidence = await owner.request('/admin/ai/models', {
      method: 'POST', expectedStatus: 400,
      body: JSON.stringify({
        revisionId: currentRevisionId,
        reason: 'Reject untested manual capability evidence',
        model: {
          providerId: 'managed', modelId: 'self-attested-model',
          capabilities: { vision: true }, capabilityEvidence: { vision: 'verified' },
        },
      }),
    });
    assert.equal(selfAttestedEvidence.error.code, 'VALIDATION_ERROR');

    const manual = await owner.request('/admin/ai/models', {
      method: 'POST', expectedStatus: 201,
      body: JSON.stringify({
        revisionId: currentRevisionId,
        reason: 'Add a manual fallback model',
        model: { providerId: 'managed', modelId: 'manual-model', capabilities: { vision: true, structuredOutput: true } },
      }),
    });
    assert.equal(manual.revision.models.find((model) => model.modelId === 'manual-model').capabilityEvidence.vision, 'unverified');
    currentRevisionId = manual.revision.id;

    const capabilityTested = await owner.request('/admin/ai/models/managed/manual-model/test', {
      method: 'POST', expectedStatus: 201,
      body: JSON.stringify({
        revisionId: currentRevisionId,
        reason: 'Verify critical capabilities with a synthetic canary',
        confirmation: 'TEST MODEL managed:manual-model',
      }),
    });
    const testedManualModel = capabilityTested.revision.models.find((model) => model.modelId === 'manual-model');
    assert.equal(testedManualModel.capabilityEvidence.vision, 'canary');
    assert.equal(testedManualModel.capabilityEvidence.structuredOutput, 'canary');
    currentRevisionId = capabilityTested.revision.id;
    const targetedCall = providerCalls.map((call) => ({ ...call, parsed: JSON.parse(call.body || '{}') }))
      .find((call) => call.parsed.model === 'manual-model');
    assert.match(targetedCall.body, /image_url/);
    assert.equal(targetedCall.parsed.response_format.type, 'json_schema');

    const disabledModel = await owner.request('/admin/ai/models/managed/manual-model', {
      method: 'PUT', expectedStatus: 201,
      body: JSON.stringify({
        revisionId: currentRevisionId,
        reason: 'Disable an unused manual model',
        confirmation: 'DISABLE MODEL managed:manual-model',
        model: { enabled: false, state: 'disabled' },
      }),
    });
    const disabledManualModel = disabledModel.revision.models.find((model) => model.modelId === 'manual-model');
    assert.equal(disabledManualModel.enabled, false);
    assert.equal(disabledManualModel.state, 'disabled');
    assert.equal(disabledModel.revision.parentRevisionId, currentRevisionId);
    currentRevisionId = disabledModel.revision.id;

    const modelPage = await owner.request(`/admin/ai/models?revisionId=${encodeURIComponent(currentRevisionId)}&limit=1`);
    assert.equal(modelPage.models.length, 1);
    assert.equal(modelPage.nextCursor, '1');

    const routed = await owner.request('/admin/ai/routing', {
      method: 'PUT', expectedStatus: 201,
      body: JSON.stringify({
        revisionId: currentRevisionId,
        reason: 'Assign the tested basic chat route',
        routes: [{
          routeId: 'chat.basic', primaryProviderId: 'managed', primaryModelId: 'test-model',
          fallbacks: [], reasoningEffort: 'low', requiresStructuredOutput: false, requiresVision: false,
        }],
      }),
    });
    currentRevisionId = routed.revision.id;

    const canary = await owner.request('/admin/ai/health/canary', {
      method: 'POST',
      body: JSON.stringify({ revisionId: currentRevisionId }),
    });
    assert.equal(canary.syntheticOnly, true);
    assert.equal(canary.results.providers[0].ok, true);

    const tested = await owner.request('/admin/ai/health/test', {
      method: 'POST',
      body: JSON.stringify({ revisionId: currentRevisionId }),
    });
    assert.equal(tested.revision.state, 'tested');
    const preview = await owner.request(`/admin/ai/changes/${encodeURIComponent(currentRevisionId)}/preview`);
    assert.equal(preview.preview.revisionId, currentRevisionId);

    const activationDenied = await owner.request(`/admin/ai/changes/${encodeURIComponent(currentRevisionId)}/activate`, {
      method: 'POST', expectedStatus: 400,
      body: JSON.stringify({ reason: 'Activate the tested provider revision', confirmation: 'ACTIVATE' }),
    });
    assert.equal(activationDenied.error.code, 'AI_CONFIGURATION_CONFIRMATION_REQUIRED');
    const activated = await owner.request(`/admin/ai/changes/${encodeURIComponent(currentRevisionId)}/activate`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Activate the tested provider revision', confirmation: `ACTIVATE ${currentRevisionId}` }),
    });
    assert.equal(activated.revision.state, 'active');
    assert.equal(JSON.stringify(activated).includes(credential), false);

    database = new DatabaseSync(path.join(sandbox, 'data', 'laprakin.sqlite'));
    const observedAt = new Date().toISOString();
    const insertUsage = database.prepare(`
      INSERT INTO ai_usage_events (
        id, purpose, mode, provider, model, status, input_tokens, output_tokens, total_tokens,
        latency_ms, first_token_latency_ms, error_code, fallback_count, created_at,
        configuration_revision, route_id, queue_depth, circuit_state
      ) VALUES (?, 'chat', 'basic', 'managed', 'test-model', ?, 2, 1, 3, ?, ?, ?, ?, ?, ?, 'chat.basic', ?, ?)
    `);
    insertUsage.run(randomUUID(), 'success', 100, 20, '', 0, observedAt, currentRevisionId, 1, 'closed');
    insertUsage.run(randomUUID(), 'success', 200, 40, '', 1, observedAt, currentRevisionId, 2, 'closed');
    insertUsage.run(randomUUID(), 'error', 400, 0, 'AI_EGRESS_RATE_LIMITED', 0, observedAt, currentRevisionId, 3, 'half_open');
    insertUsage.run(randomUUID(), 'error', 800, 0, 'AI_EGRESS_TIMEOUT', 1, observedAt, currentRevisionId, 5, 'open');

    const activeProviders = await owner.request('/admin/ai/providers');
    assert.equal(activeProviders.providers[0].credential.configured, true);
    assert.equal(Object.hasOwn(activeProviders.providers[0], 'secretReference'), false);
    assert.equal(activeProviders.providers[0].modelCount, 2);
    assert.deepEqual(activeProviders.providers[0].routesUsing, ['chat.basic']);
    assert.ok(activeProviders.providers[0].lastTestedAt);
    assert.equal(activeProviders.providers[0].lastSuccessfulCall, observedAt);
    assert.equal(activeProviders.providers[0].lastFailure.code, 'AI_EGRESS_TIMEOUT');
    const health = await owner.request('/admin/ai/health?days=7');
    assert.equal(health.runtime.revisionId, currentRevisionId);
    assert.equal(Object.hasOwn(health, 'prompt'), false);
    assert.equal(health.summary.calls, 4);
    assert.equal(health.summary.successRate, 0.5);
    assert.equal(health.summary.fallbackRate, 0.5);
    assert.equal(health.summary.latencyP50Ms, 200);
    assert.equal(health.summary.latencyP95Ms, 800);
    assert.equal(health.summary.firstTokenP50Ms, 20);
    assert.equal(health.summary.firstTokenP95Ms, 40);
    assert.equal(health.summary.rateLimitErrors, 1);
    assert.equal(health.summary.authErrors, 0);
    assert.equal(health.summary.timeoutErrors, 1);
    assert.equal(health.summary.maximumQueueDepth, 5);
    assert.equal(health.routeHealth.find((route) => route.routeId === 'chat.basic').circuitState, 'open');
    assert.equal(health.modelAvailability.find((model) => model.modelId === 'test-model').available, true);
    assert.equal(health.latestConfigurationChange.id, currentRevisionId);

    const wrongCircuitConfirmation = await owner.request('/admin/ai/health/circuit/open', {
      method: 'POST', expectedStatus: 400,
      body: JSON.stringify({
        revisionId: currentRevisionId, providerId: 'managed', modelId: 'test-model',
        reason: 'Open the route circuit during an incident', confirmation: 'OPEN',
      }),
    });
    assert.equal(wrongCircuitConfirmation.error.code, 'AI_CONFIGURATION_CONFIRMATION_REQUIRED');
    const openedCircuit = await owner.request('/admin/ai/health/circuit/open', {
      method: 'POST',
      body: JSON.stringify({
        revisionId: currentRevisionId, providerId: 'managed', modelId: 'test-model',
        reason: 'Open the route circuit during an incident', confirmation: 'OPEN CIRCUIT managed:test-model',
      }),
    });
    assert.equal(openedCircuit.circuit.state, 'open');
    const healthWithOpenCircuit = await owner.request('/admin/ai/health?days=7');
    assert.equal(healthWithOpenCircuit.circuits.find((item) => item.modelId === 'test-model').state, 'open');
    const callsBeforeCircuitClear = providerCalls.length;
    const clearedCircuit = await owner.request('/admin/ai/health/circuit/clear', {
      method: 'POST',
      body: JSON.stringify({
        revisionId: currentRevisionId, providerId: 'managed', modelId: 'test-model',
        reason: 'Clear the circuit after a synthetic provider test', confirmation: 'CLEAR CIRCUIT managed:test-model',
      }),
    });
    assert.equal(clearedCircuit.circuit.state, 'closed');
    assert.ok(providerCalls.length > callsBeforeCircuitClear);
    assert.match(providerCalls.at(-1).body, /LAPRAKIN_SYNTHETIC_CANARY/);

    const maintenance = await owner.request('/admin/ai/health/maintenance', {
      method: 'POST',
      body: JSON.stringify({
        enabled: true, message: 'AI sedang dalam pemeliharaan terjadwal.',
        reason: 'Pause AI during a provider maintenance window', confirmation: 'ENABLE AI MAINTENANCE',
      }),
    });
    assert.equal(maintenance.maintenance.enabled, true);
    const healthDuringMaintenance = await owner.request('/admin/ai/health?days=7');
    assert.equal(healthDuringMaintenance.maintenance.message, 'AI sedang dalam pemeliharaan terjadwal.');
    const clearedMaintenance = await owner.request('/admin/ai/health/maintenance', {
      method: 'POST',
      body: JSON.stringify({
        enabled: false, message: '', reason: 'Resume AI after provider maintenance', confirmation: 'CLEAR AI MAINTENANCE',
      }),
    });
    assert.equal(clearedMaintenance.maintenance.enabled, false);

    const history = await owner.request('/admin/ai/changes?limit=1');
    assert.equal(history.changes.length, 1);
    assert.ok(history.nextCursor, JSON.stringify(history));
    assert.equal(JSON.stringify(history).includes(credential), false);

    const disabledOnce = await owner.request('/admin/ai/changes/emergency-disable', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Stop provider traffic during incident', confirmation: 'DISABLE AI' }),
    });
    assert.equal(disabledOnce.revision.providers[0].enabled, false);
    const restored = await owner.request('/admin/ai/changes/rollback', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Restore last known good after review', confirmation: 'ROLLBACK AI' }),
    });
    assert.equal(restored.revision.id, currentRevisionId);

    const disabledTwice = await owner.request('/admin/ai/changes/emergency-disable', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Disable provider before credential retirement', confirmation: 'DISABLE AI' }),
    });
    const stillInUse = await owner.request('/admin/ai/providers/managed/credential', {
      method: 'DELETE', expectedStatus: 409,
      body: JSON.stringify({ revisionId: disabledTwice.revision.id, reason: 'Retire the disabled provider credential', confirmation: 'DELETE CREDENTIAL managed' }),
    });
    assert.equal(stillInUse.error.code, 'AI_CONFIGURATION_CREDENTIAL_IN_USE');
    const disabledThreeTimes = await owner.request('/admin/ai/changes/emergency-disable', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Advance disabled state past rollback window', confirmation: 'DISABLE AI' }),
    });
    const deleted = await owner.request('/admin/ai/providers/managed/credential', {
      method: 'DELETE',
      body: JSON.stringify({ revisionId: disabledThreeTimes.revision.id, reason: 'Retire the disabled provider credential', confirmation: 'DELETE CREDENTIAL managed' }),
    });
    assert.equal(deleted.deleted, true);

    assert.ok(providerCalls.length >= 4);
    assert.ok(providerCalls.every((call) => call.authorization === `Bearer ${credential}`));
    assert.equal(providerCalls.some((call) => call.body.includes(credential)), false);
    assert.equal(providerCalls.filter((call) => call.url === '/v1/chat/completions').every((call) => call.body.includes('Reply with OK.')), true);

    const secretRow = database.prepare("SELECT ciphertext, deleted_at FROM ai_provider_secrets WHERE provider_id = 'managed' ORDER BY secret_version DESC LIMIT 1").get();
    assert.equal(secretRow.ciphertext, '');
    assert.ok(secretRow.deleted_at);
    assert.equal(JSON.stringify(database.prepare('SELECT * FROM audit_logs').all()).includes(credential), false);

    const support = client(base, `ai-support-${unique}`);
    const supportRegistration = await support.registerAndVerify(`ai-support-${unique}@example.test`);
    database.prepare("UPDATE users SET role = 'support_admin' WHERE id = ?").run(supportRegistration.user.id);
    const denied = await support.request('/admin/ai/providers', { expectedStatus: 403 });
    assert.equal(denied.error.code, 'ADMIN_CAPABILITY_REQUIRED');
    const maintenanceDenied = await support.request('/admin/ai/health/maintenance', {
      method: 'POST', expectedStatus: 403,
      body: JSON.stringify({
        enabled: true, message: 'Blocked change', reason: 'Attempt unauthorized maintenance change', confirmation: 'ENABLE AI MAINTENANCE',
      }),
    });
    assert.equal(maintenanceDenied.error.code, 'ADMIN_CAPABILITY_REQUIRED');
    const operationalAudits = database.prepare("SELECT action FROM audit_logs WHERE action LIKE 'admin.ai_%' ORDER BY created_at").all().map((row) => row.action);
    assert.ok(operationalAudits.includes('admin.ai_circuit_opened'));
    assert.ok(operationalAudits.includes('admin.ai_circuit_cleared'));
    assert.ok(operationalAudits.includes('admin.ai_maintenance_changed'));
  } finally {
    database?.close();
    await stop(child);
    await new Promise((resolve) => provider.close(resolve));
    await rm(sandbox, { recursive: true, force: true });
  }
});
