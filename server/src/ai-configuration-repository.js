import { nanoid } from 'nanoid';
import { db } from './db.js';
import { ensureAiConfigurationSchema } from './ai-configuration-schema.js';
import { validateRouteAssignments } from './ai-routing.js';
import { now as currentTimestamp } from './utils.js';

export class AiConfigurationRepositoryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AiConfigurationRepositoryError';
    this.code = code;
  }
}

function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function integer(value, fallback, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function providerRecord(revisionId, provider, actorUserId, timestamp) {
  const providerId = String(provider.providerId || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(providerId)) {
    throw new AiConfigurationRepositoryError('Provider ID is invalid.', 'AI_CONFIGURATION_PROVIDER_INVALID');
  }
  const state = String(provider.state || (provider.enabled === false ? 'disabled' : 'draft')).trim().toLowerCase();
  if (!['draft', 'tested', 'active', 'degraded', 'disabled', 'archived'].includes(state)) {
    throw new AiConfigurationRepositoryError('Provider state is invalid.', 'AI_CONFIGURATION_PROVIDER_STATE_INVALID');
  }
  return {
    id: nanoid(), revisionId, providerId,
    displayName: String(provider.displayName || providerId).trim().slice(0, 120),
    adapterType: String(provider.adapterType || '').trim().slice(0, 80),
    baseUrl: String(provider.baseUrl || '').trim().replace(/\/$/, ''),
    enabled: provider.enabled !== false && !['disabled', 'archived'].includes(state),
    state,
    priority: integer(provider.priority, 100, 0, 10_000),
    requestTimeoutMs: integer(provider.requestTimeoutMs, 45_000, 1_000, 120_000),
    rpmLimit: integer(provider.rpmLimit, 8, 1, 100_000),
    concurrencyLimit: integer(provider.concurrencyLimit, 2, 1, 1_000),
    retryCount: integer(provider.retryCount, 2, 0, 10),
    circuitFailureThreshold: integer(provider.circuitFailureThreshold, 4, 1, 100),
    circuitCooldownMs: integer(provider.circuitCooldownMs, 30_000, 1_000, 3_600_000),
    secretReference: String(provider.secretReference || ''),
    secretVersion: String(provider.secretVersion || ''),
    credentialFingerprint: String(provider.credentialFingerprint || '').slice(0, 128),
    credentialLastFour: String(provider.credentialLastFour || '').slice(-4),
    actorUserId: actorUserId || null,
    timestamp,
  };
}

function exposeProvider(row, revisionState = '') {
  const effectiveState = row.enabled
    ? ({ draft: 'draft', tested: 'tested', active: 'active', superseded: 'tested' }[revisionState] || row.state)
    : row.state;
  return {
    providerId: row.provider_id,
    displayName: row.display_name,
    adapterType: row.adapter_type,
    baseUrl: row.base_url,
    enabled: Boolean(row.enabled),
    state: effectiveState,
    priority: Number(row.priority),
    requestTimeoutMs: Number(row.request_timeout_ms),
    rpmLimit: Number(row.rpm_limit),
    concurrencyLimit: Number(row.concurrency_limit),
    retryCount: Number(row.retry_count),
    circuitFailureThreshold: Number(row.circuit_failure_threshold),
    circuitCooldownMs: Number(row.circuit_cooldown_ms),
    secretReference: row.secret_reference,
    secretVersion: row.secret_version,
    credentialFingerprint: row.credential_fingerprint,
    credentialLastFour: row.credential_last_four,
  };
}

function exposeModel(row) {
  return {
    providerId: row.provider_id,
    modelId: row.model_id,
    source: row.source,
    enabled: Boolean(row.enabled),
    state: row.state,
    capabilities: parseJson(row.capabilities_json, {}),
    capabilityEvidence: parseJson(row.capability_evidence_json, {}),
    contextWindow: Number(row.context_window),
    maxOutputTokens: Number(row.max_output_tokens),
    health: row.health,
    lastAvailableAt: row.last_available_at || null,
    costMetadata: parseJson(row.cost_metadata_json, {}),
  };
}

function exposeRoute(row) {
  return {
    routeId: row.route_id,
    enabled: Boolean(row.enabled),
    primaryProviderId: row.primary_provider_id,
    primaryModelId: row.primary_model_id,
    fallbacks: parseJson(row.fallbacks_json, []),
    timeoutMs: Number(row.timeout_ms),
    retryCount: Number(row.retry_count),
    outputTokenLimit: Number(row.output_token_limit),
    reasoningEffort: row.reasoning_effort,
    requiresStructuredOutput: Boolean(row.requires_structured_output),
    requiresVision: Boolean(row.requires_vision),
    parserFallbackTested: Boolean(row.parser_fallback_tested),
    costClass: row.cost_class,
    plans: parseJson(row.plans_json, []),
  };
}

export function createAiConfigurationRepository({ store = db, now = currentTimestamp } = {}) {
  ensureAiConfigurationSchema(store);

  function getRevision(revisionId) {
    const row = store.prepare('SELECT * FROM ai_configuration_revisions WHERE id = ?').get(String(revisionId || ''));
    if (!row) return null;
    return {
      id: row.id,
      revisionNumber: Number(row.revision_number),
      parentRevisionId: row.parent_revision_id || null,
      state: row.state,
      reason: row.reason,
      createdByUserId: row.created_by_user_id || null,
      createdAt: row.created_at,
      testedByUserId: row.tested_by_user_id || null,
      testedAt: row.tested_at || null,
      testEvidence: parseJson(row.test_evidence_json, null),
      activatedByUserId: row.activated_by_user_id || null,
      activatedAt: row.activated_at || null,
      activationReason: row.activation_reason || '',
      supersededAt: row.superseded_at || null,
      providers: store.prepare(`SELECT * FROM ai_provider_revisions WHERE configuration_revision_id = ? ORDER BY priority, provider_id`).all(row.id).map((provider) => exposeProvider(provider, row.state)),
      models: store.prepare(`SELECT * FROM ai_model_catalog WHERE configuration_revision_id = ? ORDER BY provider_id, model_id`).all(row.id).map(exposeModel),
      routes: store.prepare(`SELECT * FROM ai_route_assignments WHERE configuration_revision_id = ? ORDER BY route_id`).all(row.id).map(exposeRoute),
    };
  }

  function createDraft({ providers = [], models = [], routes = [], actorUserId = null, reason = '', parentRevisionId = null, production = false } = {}) {
    const timestamp = now();
    const revisionId = `aicfg_${nanoid()}`;
    const providerRecords = providers.map((provider) => providerRecord(revisionId, provider, actorUserId, timestamp));
    const providerView = providerRecords.map((provider) => ({ providerId: provider.providerId, enabled: provider.enabled, state: provider.state }));
    const normalizedRoutes = validateRouteAssignments({ providers: providerView, models, routes, production });
    let transactionOpen = false;
    try {
      store.exec('BEGIN IMMEDIATE');
      transactionOpen = true;
      const revisionNumber = Number(store.prepare('SELECT COALESCE(MAX(revision_number), 0) + 1 AS value FROM ai_configuration_revisions').get().value);
      store.prepare(`
        INSERT INTO ai_configuration_revisions (
          id, revision_number, parent_revision_id, state, reason, created_by_user_id, created_at
        ) VALUES (?, ?, ?, 'draft', ?, ?, ?)
      `).run(revisionId, revisionNumber, parentRevisionId || null, String(reason || '').trim().slice(0, 500), actorUserId || null, timestamp);
      const insertProvider = store.prepare(`
        INSERT INTO ai_provider_revisions (
          id, configuration_revision_id, provider_id, display_name, adapter_type, base_url,
          enabled, state, priority, request_timeout_ms, rpm_limit, concurrency_limit,
          retry_count, circuit_failure_threshold, circuit_cooldown_ms, secret_reference,
          secret_version, credential_fingerprint, credential_last_four, created_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const provider of providerRecords) insertProvider.run(
        provider.id, provider.revisionId, provider.providerId, provider.displayName, provider.adapterType, provider.baseUrl,
        Number(provider.enabled), provider.state, provider.priority, provider.requestTimeoutMs, provider.rpmLimit, provider.concurrencyLimit,
        provider.retryCount, provider.circuitFailureThreshold, provider.circuitCooldownMs, provider.secretReference,
        provider.secretVersion, provider.credentialFingerprint, provider.credentialLastFour, provider.actorUserId, provider.timestamp,
      );
      const insertModel = store.prepare(`
        INSERT INTO ai_model_catalog (
          id, configuration_revision_id, provider_id, model_id, source, enabled, state,
          capabilities_json, capability_evidence_json, context_window, max_output_tokens,
          health, last_available_at, cost_metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const model of models) insertModel.run(
        nanoid(), revisionId, String(model.providerId), String(model.modelId), String(model.source || 'manual'), Number(model.enabled !== false),
        String(model.state || (model.enabled === false ? 'disabled' : 'enabled')), JSON.stringify(model.capabilities || {}),
        JSON.stringify(model.capabilityEvidence || {}), integer(model.contextWindow, 0), integer(model.maxOutputTokens, 0),
        String(model.health || 'unknown'), model.lastAvailableAt || null, JSON.stringify(model.costMetadata || {}), timestamp,
      );
      const insertRoute = store.prepare(`
        INSERT INTO ai_route_assignments (
          id, configuration_revision_id, route_id, enabled, primary_provider_id, primary_model_id,
          fallbacks_json, timeout_ms, retry_count, output_token_limit, reasoning_effort,
          requires_structured_output, requires_vision, parser_fallback_tested, cost_class,
          plans_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const route of normalizedRoutes) insertRoute.run(
        nanoid(), revisionId, route.routeId, Number(route.enabled), String(route.primaryProviderId || ''), String(route.primaryModelId || ''),
        JSON.stringify(route.fallbacks), integer(route.timeoutMs, 30_000, 1_000, 120_000), integer(route.retryCount, 1, 0, 10),
        integer(route.outputTokenLimit, 2_000, 1, 65_536), String(route.reasoningEffort || 'low'), Number(Boolean(route.requiresStructuredOutput)),
        Number(Boolean(route.requiresVision)), Number(Boolean(route.parserFallbackTested)), String(route.costClass || 'standard'), JSON.stringify(route.plans), timestamp,
      );
      store.exec('COMMIT');
      transactionOpen = false;
      return getRevision(revisionId);
    } catch (error) {
      if (transactionOpen) store.exec('ROLLBACK');
      throw error;
    }
  }

  function markTested({ revisionId, actorUserId = null, evidence = {} }) {
    const result = store.prepare(`
      UPDATE ai_configuration_revisions
      SET state = 'tested', tested_by_user_id = ?, tested_at = ?, test_evidence_json = ?
      WHERE id = ? AND state = 'draft'
    `).run(actorUserId || null, now(), JSON.stringify(evidence || {}), String(revisionId || ''));
    if (!result.changes) throw new AiConfigurationRepositoryError('Only a draft revision can be marked tested.', 'AI_CONFIGURATION_NOT_DRAFT');
    return getRevision(revisionId);
  }

  function getPointers() {
    const row = store.prepare('SELECT * FROM ai_configuration_pointers WHERE singleton_id = 1').get();
    return row ? {
      activeRevisionId: row.active_revision_id || null,
      lastKnownGoodRevisionId: row.last_known_good_revision_id || null,
      updatedAt: row.updated_at,
    } : { activeRevisionId: null, lastKnownGoodRevisionId: null, updatedAt: null };
  }

  function activate({ revisionId, actorUserId = null, reason = '' }) {
    let transactionOpen = false;
    try {
      store.exec('BEGIN IMMEDIATE');
      transactionOpen = true;
      const target = store.prepare('SELECT id, state FROM ai_configuration_revisions WHERE id = ?').get(String(revisionId || ''));
      if (!target || target.state !== 'tested') {
        throw new AiConfigurationRepositoryError('Configuration revision must be tested before activation.', 'AI_CONFIGURATION_NOT_TESTED');
      }
      const timestamp = now();
      const pointer = store.prepare('SELECT active_revision_id FROM ai_configuration_pointers WHERE singleton_id = 1').get();
      const previousActiveId = pointer?.active_revision_id || null;
      if (previousActiveId && previousActiveId !== target.id) {
        store.prepare("UPDATE ai_configuration_revisions SET state = 'superseded', superseded_at = ? WHERE id = ? AND state = 'active'")
          .run(timestamp, previousActiveId);
      }
      store.prepare(`
        UPDATE ai_configuration_revisions
        SET state = 'active', activated_by_user_id = ?, activated_at = ?, activation_reason = ?, superseded_at = NULL
        WHERE id = ?
      `).run(actorUserId || null, timestamp, String(reason || '').trim().slice(0, 500), target.id);
      store.prepare(`
        INSERT INTO ai_configuration_pointers (singleton_id, active_revision_id, last_known_good_revision_id, updated_at)
        VALUES (1, ?, ?, ?)
        ON CONFLICT(singleton_id) DO UPDATE SET
          active_revision_id = excluded.active_revision_id,
          last_known_good_revision_id = excluded.last_known_good_revision_id,
          updated_at = excluded.updated_at
      `).run(target.id, previousActiveId && previousActiveId !== target.id ? previousActiveId : null, timestamp);
      store.exec('COMMIT');
      transactionOpen = false;
      return getRevision(target.id);
    } catch (error) {
      if (transactionOpen) store.exec('ROLLBACK');
      throw error;
    }
  }

  function getActiveRevision() {
    const activeRevisionId = getPointers().activeRevisionId;
    return activeRevisionId ? getRevision(activeRevisionId) : null;
  }

  function listRevisions({ state = '', beforeRevisionNumber = Number.MAX_SAFE_INTEGER, limit = 25 } = {}) {
    const normalizedState = String(state || '').trim().toLowerCase();
    const boundedLimit = integer(limit, 25, 1, 100);
    const before = integer(beforeRevisionNumber, Number.MAX_SAFE_INTEGER, 1);
    const rows = store.prepare(`
      SELECT id, revision_number
      FROM ai_configuration_revisions
      WHERE revision_number < ? AND (? = '' OR state = ?)
      ORDER BY revision_number DESC
      LIMIT ?
    `).all(before, normalizedState, normalizedState, boundedLimit + 1);
    const hasMore = rows.length > boundedLimit;
    const page = rows.slice(0, boundedLimit);
    return {
      revisions: page.map((row) => getRevision(row.id)),
      nextCursor: hasMore ? String(page.at(-1)?.revision_number || '') : null,
    };
  }

  function credentialUsage({ providerId, reference, version }) {
    const pointers = getPointers();
    const protectedRevisionIds = [pointers.activeRevisionId, pointers.lastKnownGoodRevisionId].filter(Boolean);
    const rows = store.prepare(`
      SELECT provider.configuration_revision_id, provider.enabled, revision.state
      FROM ai_provider_revisions provider
      JOIN ai_configuration_revisions revision ON revision.id = provider.configuration_revision_id
      WHERE provider.provider_id = ? AND provider.secret_reference = ? AND provider.secret_version = ?
        AND (
          revision.state = 'tested'
          OR provider.configuration_revision_id = ?
          OR provider.configuration_revision_id = ?
        )
    `).all(
      String(providerId || ''), String(reference || ''), String(version || ''),
      protectedRevisionIds[0] || '', protectedRevisionIds[1] || '',
    );
    return rows.map((row) => ({
      revisionId: row.configuration_revision_id,
      enabled: Boolean(row.enabled),
      state: row.state,
    }));
  }

  function rollback({ targetRevisionId = null, actorUserId = null, reason = '' } = {}) {
    let transactionOpen = false;
    try {
      store.exec('BEGIN IMMEDIATE');
      transactionOpen = true;
      const pointer = store.prepare('SELECT active_revision_id, last_known_good_revision_id FROM ai_configuration_pointers WHERE singleton_id = 1').get();
      const activeRevisionId = pointer?.active_revision_id || null;
      const rollbackId = String(targetRevisionId || pointer?.last_known_good_revision_id || '');
      if (!activeRevisionId || !rollbackId || rollbackId === activeRevisionId || (targetRevisionId && rollbackId !== pointer?.last_known_good_revision_id)) {
        throw new AiConfigurationRepositoryError('Last-known-good configuration is unavailable.', 'AI_CONFIGURATION_ROLLBACK_UNAVAILABLE');
      }
      const target = store.prepare("SELECT id, state FROM ai_configuration_revisions WHERE id = ? AND state IN ('tested', 'superseded')").get(rollbackId);
      if (!target) throw new AiConfigurationRepositoryError('Last-known-good configuration is unavailable.', 'AI_CONFIGURATION_ROLLBACK_UNAVAILABLE');
      const timestamp = now();
      store.prepare("UPDATE ai_configuration_revisions SET state = 'superseded', superseded_at = ? WHERE id = ? AND state = 'active'")
        .run(timestamp, activeRevisionId);
      store.prepare(`
        UPDATE ai_configuration_revisions
        SET state = 'active', activated_by_user_id = ?, activated_at = ?, activation_reason = ?, superseded_at = NULL
        WHERE id = ?
      `).run(actorUserId || null, timestamp, String(reason || '').trim().slice(0, 500), rollbackId);
      store.prepare(`
        UPDATE ai_configuration_pointers
        SET active_revision_id = ?, last_known_good_revision_id = ?, updated_at = ?
        WHERE singleton_id = 1
      `).run(rollbackId, rollbackId, timestamp);
      store.exec('COMMIT');
      transactionOpen = false;
      return getRevision(rollbackId);
    } catch (error) {
      if (transactionOpen) store.exec('ROLLBACK');
      throw error;
    }
  }

  return { createDraft, markTested, activate, rollback, getRevision, getActiveRevision, getPointers, listRevisions, credentialUsage };
}
