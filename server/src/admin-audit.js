import crypto from 'node:crypto';
import { nanoid } from 'nanoid';
import { db } from './db.js';
import { now } from './utils.js';

const REDACTED = '[REDACTED]';
const SENSITIVE = /authorization|cookie|password|token|secret|api[_-]?key|content|document|prompt|body|raw|source|attachment|ip/i;

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, SENSITIVE.test(key) ? REDACTED : redact(child)]));
}

export function buildAuditRow({ actorUserId = null, action, target = null, payloadDiff = {}, ipAddress = '', createdAt = new Date().toISOString() }) {
  return {
    id: nanoid(),
    actor_user_id: actorUserId,
    action: String(action || 'unknown').slice(0, 120),
    target: target == null ? null : String(target).slice(0, 160),
    payload_diff: redact(payloadDiff),
    ip_hash: ipAddress ? crypto.createHash('sha256').update(String(ipAddress)).digest('hex') : null,
    created_at: createdAt,
  };
}

export function recordAdminAudit({ actorUserId, action, target, payloadDiff = {}, ipAddress = '', store = db }) {
  const row = buildAuditRow({ actorUserId, action, target, payloadDiff, ipAddress });
  store.prepare(`
    INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata_json, created_at)
    VALUES (?, ?, ?, 'admin', ?, ?, ?)
  `).run(row.id, row.actor_user_id, row.action, row.target, JSON.stringify({ payload_diff: row.payload_diff, ip_hash: row.ip_hash }), row.created_at);
  return row;
}

export function listAdminAudit({ actorUserId = null, action = '', limit = 100, cursor = null, store = db } = {}) {
  const filters = ["(target_type = 'admin' OR action LIKE 'admin.%' OR action LIKE 'retention.%')"];
  const params = [];
  if (actorUserId) { filters.push('actor_user_id = ?'); params.push(actorUserId); }
  if (action) { filters.push('action = ?'); params.push(action); }
  if (cursor) { filters.push('created_at < ?'); params.push(cursor); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = store.prepare(`SELECT id, actor_user_id, action, target_id, metadata_json, created_at FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ?`).all(...params, Math.max(1, Math.min(Number(limit) || 100, 200)));
  return rows.map((row) => ({ ...row, metadata: JSON.parse(row.metadata_json || '{}') }));
}

export { redact as redactAuditPayload, REDACTED };
