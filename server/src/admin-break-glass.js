import { nanoid } from 'nanoid';

export const BREAK_GLASS_SCOPES = Object.freeze(['pii', 'content']);
export const BREAK_GLASS_MAX_MINUTES = 10;

export class BreakGlassError extends Error {
  constructor(message, code, status = 403) {
    super(message);
    this.name = 'BreakGlassError';
    this.code = code;
    this.status = status;
  }
}

function publicGrant(row) {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    targetUserId: row.target_user_id,
    targetResourceId: row.target_resource_id || null,
    scope: row.scope,
    reasonCode: row.reason_code,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at || null,
    createdAt: row.created_at,
  };
}

export function createBreakGlassGrant({
  store,
  actorUserId,
  targetUserId,
  targetResourceId = null,
  scope,
  reasonCode,
  reasonNote,
  durationMinutes,
  nowMs = Date.now(),
}) {
  const duration = Number(durationMinutes);
  if (!Number.isInteger(duration) || duration < 1 || duration > BREAK_GLASS_MAX_MINUTES) {
    throw new BreakGlassError(`Break-glass access must last between 1 and ${BREAK_GLASS_MAX_MINUTES} minutes.`, 'BREAK_GLASS_DURATION_INVALID', 400);
  }
  if (!BREAK_GLASS_SCOPES.includes(scope)) {
    throw new BreakGlassError('Unknown break-glass scope.', 'BREAK_GLASS_SCOPE_INVALID', 400);
  }
  const note = String(reasonNote || '').trim();
  if (note.length < 12) {
    throw new BreakGlassError('A specific reason note of at least 12 characters is required.', 'BREAK_GLASS_REASON_REQUIRED', 400);
  }
  const createdAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + duration * 60_000).toISOString();
  const id = nanoid(24);
  store.prepare(`
    INSERT INTO admin_break_glass_grants (
      id, actor_user_id, target_user_id, target_resource_id, scope,
      reason_code, reason_note, expires_at, revoked_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
  `).run(id, String(actorUserId), String(targetUserId), targetResourceId ? String(targetResourceId) : null, scope, String(reasonCode), note, expiresAt, createdAt);
  return publicGrant(store.prepare('SELECT * FROM admin_break_glass_grants WHERE id = ?').get(id));
}

export function findActiveBreakGlassGrant({ store, grantId, actorUserId, scope, nowMs = Date.now() }) {
  const row = store.prepare(`
    SELECT * FROM admin_break_glass_grants
    WHERE id = ? AND actor_user_id = ? AND scope = ?
  `).get(String(grantId), String(actorUserId), String(scope));
  if (!row) throw new BreakGlassError('Break-glass grant was not found for this operator and scope.', 'BREAK_GLASS_GRANT_NOT_FOUND', 404);
  if (row.revoked_at) throw new BreakGlassError('Break-glass grant has been revoked.', 'BREAK_GLASS_GRANT_REVOKED');
  if (Date.parse(row.expires_at) <= nowMs) throw new BreakGlassError('Break-glass grant has expired.', 'BREAK_GLASS_GRANT_EXPIRED');
  return publicGrant(row);
}

export function revokeBreakGlassGrant({ store, grantId, actorUserId, nowMs = Date.now() }) {
  const result = store.prepare(`
    UPDATE admin_break_glass_grants SET revoked_at = ?
    WHERE id = ? AND actor_user_id = ? AND revoked_at IS NULL AND expires_at > ?
  `).run(new Date(nowMs).toISOString(), String(grantId), String(actorUserId), new Date(nowMs).toISOString());
  return Boolean(result.changes);
}
