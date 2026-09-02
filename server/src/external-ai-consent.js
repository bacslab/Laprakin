import { nanoid } from 'nanoid';
import { db } from './db.js';
import { HttpError, now, parseJson } from './utils.js';

export function materialManifestScope(manifest) {
  const providers = Array.isArray(manifest?.providers) ? manifest.providers : [];
  return {
    manifestVersion: String(manifest?.manifestVersion || ''),
    policyVersion: String(manifest?.policyVersion || ''),
    providerIds: [...new Set(providers.map((provider) => String(provider.id || '')).filter(Boolean))].sort(),
    dataClasses: [...new Set(providers.flatMap((provider) => provider.dataClasses || []).map(String).filter(Boolean))].sort(),
  };
}

function exposeConsent(row, manifest) {
  const scope = materialManifestScope(manifest);
  if (!row) return { active: false, ...scope, sourceSurface: '', grantedAt: null, revokedAt: null };
  const providerIds = parseJson(row.provider_ids_json, []).map(String).sort();
  const dataClasses = parseJson(row.data_classes_json, []).map(String).sort();
  const current = !row.revoked_at
    && row.manifest_version === scope.manifestVersion
    && row.policy_version === scope.policyVersion
    && JSON.stringify(providerIds) === JSON.stringify(scope.providerIds)
    && JSON.stringify(dataClasses) === JSON.stringify(scope.dataClasses);
  return {
    active: current,
    manifestVersion: row.manifest_version,
    policyVersion: row.policy_version,
    providerIds,
    dataClasses,
    sourceSurface: row.source_surface,
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at || null,
  };
}

export function getExternalAiConsent({ userId, manifest, store = db }) {
  const row = store.prepare(`
    SELECT * FROM external_ai_consents
    WHERE user_id = ? ORDER BY granted_at DESC LIMIT 1
  `).get(userId);
  return exposeConsent(row, manifest);
}

export function recordExternalAiConsent({ userId, manifest, sourceSurface, store = db }) {
  const scope = materialManifestScope(manifest);
  if (!scope.providerIds.length) throw new HttpError(503, 'Pemroses AI eksternal belum tersedia.', 'AI_NOT_CONFIGURED');
  const timestamp = now();
  store.exec('BEGIN IMMEDIATE');
  try {
    store.prepare(`
      UPDATE external_ai_consents SET revoked_at = ?
      WHERE user_id = ? AND revoked_at IS NULL
    `).run(timestamp, userId);
    store.prepare(`
      INSERT INTO external_ai_consents (
        id, user_id, manifest_version, policy_version, provider_ids_json,
        data_classes_json, source_surface, granted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nanoid(),
      userId,
      scope.manifestVersion,
      scope.policyVersion,
      JSON.stringify(scope.providerIds),
      JSON.stringify(scope.dataClasses),
      String(sourceSurface || 'workspace').slice(0, 80),
      timestamp,
    );
    store.exec('COMMIT');
  } catch (error) {
    try { store.exec('ROLLBACK'); } catch { /* preserve original error */ }
    throw error;
  }
  return getExternalAiConsent({ userId, manifest, store });
}

export function revokeExternalAiConsent({ userId, manifest, store = db }) {
  const timestamp = now();
  store.prepare(`
    UPDATE external_ai_consents SET revoked_at = ?
    WHERE user_id = ? AND revoked_at IS NULL
  `).run(timestamp, userId);
  return getExternalAiConsent({ userId, manifest, store });
}

export function requireExternalAiConsent({ userId, manifest, store = db }) {
  const consent = getExternalAiConsent({ userId, manifest, store });
  if (!consent.active) {
    throw new HttpError(412, 'Setujui pemroses dan jenis data yang aktif sebelum memakai AI.', 'AI_CONSENT_REQUIRED');
  }
  return consent;
}
