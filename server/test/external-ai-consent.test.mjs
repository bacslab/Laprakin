import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-ai-consent-'));
process.env.LAPRAKIN_DATA_DIR = path.join(sandbox, 'data');
process.env.LAPRAKIN_UPLOAD_DIR = path.join(sandbox, 'uploads');
process.env.LAPRAKIN_PUBLIC_MEDIA_DIR = path.join(sandbox, 'public-media');

const { db } = await import('../src/db.js');
const { buildProcessorManifest } = await import('../src/processor-manifest.js');
const {
  getExternalAiConsent,
  recordExternalAiConsent,
  requireExternalAiConsent,
  revokeExternalAiConsent,
} = await import('../src/external-ai-consent.js');

const userId = `consent-user-${randomUUID()}`;
const timestamp = new Date().toISOString();
db.prepare(`INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, 'test', ?, ?)`)
  .run(userId, `${userId}@example.test`, timestamp, timestamp);
const manifest = buildProcessorManifest({ naraRouterApiKey: 'test-key' });

after(async () => {
  db.close();
  await rm(sandbox, { recursive: true, force: true });
});

test('external AI is denied until the current processor manifest is explicitly accepted', () => {
  assert.throws(
    () => requireExternalAiConsent({ userId, manifest }),
    (error) => error.code === 'AI_CONSENT_REQUIRED' && error.status === 412,
  );
});

test('consent records the exact providers, data classes, versions, source, and timestamp', () => {
  const consent = recordExternalAiConsent({ userId, manifest, sourceSurface: 'workspace_settings' });
  assert.equal(consent.active, true);
  assert.equal(consent.manifestVersion, manifest.manifestVersion);
  assert.equal(consent.policyVersion, manifest.policyVersion);
  assert.deepEqual(consent.providerIds, ['nararouter']);
  assert.deepEqual(consent.dataClasses, [...manifest.providers[0].dataClasses].sort());
  assert.equal(consent.sourceSurface, 'workspace_settings');
  assert.match(consent.grantedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(JSON.stringify(consent).includes('test-key'), false);
  assert.equal(requireExternalAiConsent({ userId, manifest }).active, true);
});

test('a material processor-manifest change invalidates old consent and revocation is explicit', () => {
  const changed = { ...manifest, manifestVersion: `${manifest.manifestVersion}.changed` };
  assert.equal(getExternalAiConsent({ userId, manifest: changed }).active, false);
  assert.throws(
    () => requireExternalAiConsent({ userId, manifest: changed }),
    (error) => error.code === 'AI_CONSENT_REQUIRED',
  );
  const revoked = revokeExternalAiConsent({ userId });
  assert.equal(revoked.active, false);
  assert.ok(revoked.revokedAt);
  assert.equal(getExternalAiConsent({ userId, manifest }).active, false);
});

test('active revision identity and route-only changes preserve consent while a processor change invalidates it', () => {
  const activeOne = {
    id: 'revision-one',
    providers: [{
      providerId: 'nararouter', displayName: 'NaraRouter', adapterType: 'openai-compatible', enabled: true, secretReference: 'secret-one',
    }],
  };
  const activeRouteOnly = { ...activeOne, id: 'revision-route-only' };
  const activeProcessorChange = {
    id: 'revision-provider-change',
    providers: [{
      providerId: 'cloudflare', displayName: 'Cloudflare Workers AI', adapterType: 'openai-compatible', enabled: true, secretReference: 'secret-two',
    }],
  };
  const firstManifest = buildProcessorManifest({}, { activeRevision: activeOne });
  const routeOnlyManifest = buildProcessorManifest({}, { activeRevision: activeRouteOnly });
  const changedManifest = buildProcessorManifest({}, { activeRevision: activeProcessorChange });
  assert.notEqual(firstManifest.configurationRevisionId, routeOnlyManifest.configurationRevisionId);
  recordExternalAiConsent({ userId, manifest: firstManifest, sourceSurface: 'processor_settings' });
  assert.equal(getExternalAiConsent({ userId, manifest: routeOnlyManifest }).active, true);
  assert.equal(getExternalAiConsent({ userId, manifest: changedManifest }).active, false);
});
