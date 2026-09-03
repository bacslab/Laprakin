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
      response.end(JSON.stringify({ choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }], usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } }));
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
        model: { providerId: 'managed', modelId: 'manual-model', capabilities: {} },
      }),
    });
    assert.equal(manual.revision.models.find((model) => model.modelId === 'manual-model').capabilityEvidence.vision, 'unverified');
    currentRevisionId = manual.revision.id;
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

    const activeProviders = await owner.request('/admin/ai/providers');
    assert.equal(activeProviders.providers[0].credential.configured, true);
    assert.equal(Object.hasOwn(activeProviders.providers[0], 'secretReference'), false);
    const health = await owner.request('/admin/ai/health?days=7');
    assert.equal(health.runtime.revisionId, currentRevisionId);
    assert.equal(Object.hasOwn(health, 'prompt'), false);
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

    database = new DatabaseSync(path.join(sandbox, 'data', 'laprakin.sqlite'));
    const secretRow = database.prepare("SELECT ciphertext, deleted_at FROM ai_provider_secrets WHERE provider_id = 'managed' ORDER BY secret_version DESC LIMIT 1").get();
    assert.equal(secretRow.ciphertext, '');
    assert.ok(secretRow.deleted_at);
    assert.equal(JSON.stringify(database.prepare('SELECT * FROM audit_logs').all()).includes(credential), false);

    const support = client(base, `ai-support-${unique}`);
    const supportRegistration = await support.registerAndVerify(`ai-support-${unique}@example.test`);
    database.prepare("UPDATE users SET role = 'support_admin' WHERE id = ?").run(supportRegistration.user.id);
    const denied = await support.request('/admin/ai/providers', { expectedStatus: 403 });
    assert.equal(denied.error.code, 'ADMIN_CAPABILITY_REQUIRED');
  } finally {
    database?.close();
    await stop(child);
    await new Promise((resolve) => provider.close(resolve));
    await rm(sandbox, { recursive: true, force: true });
  }
});
