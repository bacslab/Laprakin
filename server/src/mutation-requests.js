import crypto from 'node:crypto';
import { nanoid } from 'nanoid';
import { db } from './db.js';
import { now } from './utils.js';

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{12,120}$/;
const TERMINAL_STATES = new Set(['completed', 'terminal_failed', 'canceled']);

export class MutationRequestError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'MutationRequestError';
    this.code = code;
    this.status = status;
  }
}

export function normalizeRequestId(value) {
  const requestId = String(value || '').trim();
  if (!REQUEST_ID_PATTERN.test(requestId)) {
    throw new MutationRequestError('Request ID tidak valid.', 'REQUEST_ID_INVALID', 400);
  }
  return requestId;
}

function canonicalize(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map((item) => canonicalize(item ?? null));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().flatMap((key) => {
      const child = value[key];
      return child === undefined ? [] : [[key, canonicalize(child)]];
    }));
  }
  return String(value);
}

export function hashMutationInput(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function parseCanonicalResponse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new MutationRequestError('Hasil kanonis tersimpan tidak valid.', 'CANONICAL_RESPONSE_INVALID', 500, { cause: error });
  }
}

function exposeMutation(row) {
  if (!row) return null;
  return {
    id: row.id,
    requestId: row.request_id,
    operation: row.operation,
    state: row.state,
    resourceType: row.resource_type || '',
    resourceId: row.resource_id || '',
    configurationRevision: row.configuration_revision || '',
    providerId: row.provider_id || '',
    modelId: row.model_id || '',
    promptTemplateRevision: row.prompt_template_revision || '',
    statusCode: row.canonical_status == null ? null : Number(row.canonical_status),
    response: parseCanonicalResponse(row.canonical_response_json),
    errorCode: row.error_code || '',
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || null,
  };
}

function selectMutation(store, { ownerUserId, operation, requestId }) {
  return store.prepare(`
    SELECT * FROM mutation_requests
    WHERE owner_user_id = ? AND operation = ? AND request_id = ?
  `).get(ownerUserId, operation, requestId);
}

function immediateTransaction(store, work) {
  store.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    store.exec('COMMIT');
    return result;
  } catch (error) {
    try { store.exec('ROLLBACK'); } catch { /* preserve the original failure */ }
    throw error;
  }
}

export function beginMutation({ ownerUserId, operation, requestId: rawRequestId, input, resourceType = '', resourceId = '', store = db }) {
  const requestId = normalizeRequestId(rawRequestId);
  const requestHash = hashMutationInput(input);
  const timestamp = now();
  return immediateTransaction(store, () => {
    const existing = selectMutation(store, { ownerUserId, operation, requestId });
    if (existing) {
      if (existing.request_hash !== requestHash) {
        throw new MutationRequestError('Request ID sudah dipakai untuk input berbeda.', 'IDEMPOTENCY_KEY_REUSED', 409);
      }
      return {
        disposition: existing.state === 'completed' ? 'replay' : 'in_progress',
        mutation: exposeMutation(existing),
      };
    }
    const id = nanoid();
    store.prepare(`
      INSERT INTO mutation_requests (
        id, request_id, owner_user_id, operation, request_hash, state,
        resource_type, resource_id, started_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'processing', ?, ?, ?, ?)
    `).run(id, requestId, ownerUserId, operation, requestHash, resourceType, resourceId, timestamp, timestamp);
    return {
      disposition: 'started',
      mutation: exposeMutation(selectMutation(store, { ownerUserId, operation, requestId })),
    };
  });
}

export function completeMutation({
  ownerUserId,
  operation,
  requestId: rawRequestId,
  statusCode,
  response,
  resourceType = '',
  resourceId = '',
  configurationRevision = '',
  providerId = '',
  modelId = '',
  promptTemplateRevision = '',
  store = db,
}) {
  const requestId = normalizeRequestId(rawRequestId);
  const timestamp = now();
  return immediateTransaction(store, () => {
    const existing = selectMutation(store, { ownerUserId, operation, requestId });
    if (!existing) throw new MutationRequestError('Mutasi tidak ditemukan.', 'MUTATION_NOT_FOUND', 404);
    if (existing.state === 'completed') return exposeMutation(existing);
    if (TERMINAL_STATES.has(existing.state)) {
      throw new MutationRequestError('Mutasi sudah mencapai status akhir.', 'MUTATION_TERMINAL', 409);
    }
    store.prepare(`
      UPDATE mutation_requests SET
        state = 'completed', resource_type = ?, resource_id = ?,
        configuration_revision = ?, provider_id = ?, model_id = ?, prompt_template_revision = ?,
        canonical_status = ?, canonical_response_json = ?, error_code = '',
        updated_at = ?, completed_at = ?
      WHERE id = ?
    `).run(
      resourceType,
      resourceId,
      configurationRevision,
      providerId,
      modelId,
      promptTemplateRevision,
      Number(statusCode),
      JSON.stringify(response ?? null),
      timestamp,
      timestamp,
      existing.id,
    );
    return exposeMutation(selectMutation(store, { ownerUserId, operation, requestId }));
  });
}

export function failMutation({ ownerUserId, operation, requestId: rawRequestId, retryable = false, canceled = false, errorCode = '', store = db }) {
  const requestId = normalizeRequestId(rawRequestId);
  const timestamp = now();
  return immediateTransaction(store, () => {
    const existing = selectMutation(store, { ownerUserId, operation, requestId });
    if (!existing) throw new MutationRequestError('Mutasi tidak ditemukan.', 'MUTATION_NOT_FOUND', 404);
    if (existing.state === 'completed') return exposeMutation(existing);
    const state = canceled ? 'canceled' : retryable ? 'retryable_failed' : 'terminal_failed';
    store.prepare(`
      UPDATE mutation_requests SET state = ?, error_code = ?, updated_at = ?, completed_at = ?
      WHERE id = ?
    `).run(state, String(errorCode || '').slice(0, 80), timestamp, state === 'retryable_failed' ? null : timestamp, existing.id);
    return exposeMutation(selectMutation(store, { ownerUserId, operation, requestId }));
  });
}

export function getMutationSnapshot({ ownerUserId, operation, requestId: rawRequestId, store = db }) {
  const requestId = normalizeRequestId(rawRequestId);
  return exposeMutation(selectMutation(store, { ownerUserId, operation, requestId }));
}
