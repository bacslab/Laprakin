export function ensureAiConfigurationSchema(store) {
  store.exec(`
    CREATE TABLE IF NOT EXISTS ai_configuration_revisions (
      id TEXT PRIMARY KEY,
      revision_number INTEGER UNIQUE NOT NULL,
      parent_revision_id TEXT,
      state TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_by_user_id TEXT,
      created_at TEXT NOT NULL,
      tested_by_user_id TEXT,
      tested_at TEXT,
      test_evidence_json TEXT,
      activated_by_user_id TEXT,
      activated_at TEXT,
      activation_reason TEXT,
      superseded_at TEXT,
      FOREIGN KEY(parent_revision_id) REFERENCES ai_configuration_revisions(id)
    );

    CREATE TABLE IF NOT EXISTS ai_provider_revisions (
      id TEXT PRIMARY KEY,
      configuration_revision_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      adapter_type TEXT NOT NULL,
      base_url TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      state TEXT NOT NULL,
      priority INTEGER NOT NULL,
      request_timeout_ms INTEGER NOT NULL,
      rpm_limit INTEGER NOT NULL,
      concurrency_limit INTEGER NOT NULL,
      retry_count INTEGER NOT NULL,
      circuit_failure_threshold INTEGER NOT NULL,
      circuit_cooldown_ms INTEGER NOT NULL,
      secret_reference TEXT NOT NULL,
      secret_version TEXT NOT NULL,
      credential_fingerprint TEXT NOT NULL,
      credential_last_four TEXT NOT NULL,
      created_by_user_id TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(configuration_revision_id, provider_id),
      FOREIGN KEY(configuration_revision_id) REFERENCES ai_configuration_revisions(id)
    );

    CREATE TABLE IF NOT EXISTS ai_model_catalog (
      id TEXT PRIMARY KEY,
      configuration_revision_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      source TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      state TEXT NOT NULL,
      capabilities_json TEXT NOT NULL,
      capability_evidence_json TEXT NOT NULL,
      context_window INTEGER NOT NULL,
      max_output_tokens INTEGER NOT NULL,
      health TEXT NOT NULL,
      last_available_at TEXT,
      cost_metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(configuration_revision_id, provider_id, model_id),
      FOREIGN KEY(configuration_revision_id, provider_id)
        REFERENCES ai_provider_revisions(configuration_revision_id, provider_id)
    );

    CREATE TABLE IF NOT EXISTS ai_route_assignments (
      id TEXT PRIMARY KEY,
      configuration_revision_id TEXT NOT NULL,
      route_id TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      primary_provider_id TEXT NOT NULL,
      primary_model_id TEXT NOT NULL,
      fallbacks_json TEXT NOT NULL,
      timeout_ms INTEGER NOT NULL,
      retry_count INTEGER NOT NULL,
      output_token_limit INTEGER NOT NULL,
      reasoning_effort TEXT NOT NULL,
      requires_structured_output INTEGER NOT NULL,
      requires_vision INTEGER NOT NULL,
      parser_fallback_tested INTEGER NOT NULL,
      cost_class TEXT NOT NULL,
      plans_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(configuration_revision_id, route_id),
      FOREIGN KEY(configuration_revision_id) REFERENCES ai_configuration_revisions(id)
    );

    CREATE TABLE IF NOT EXISTS ai_configuration_pointers (
      singleton_id INTEGER PRIMARY KEY CHECK(singleton_id = 1),
      active_revision_id TEXT,
      last_known_good_revision_id TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(active_revision_id) REFERENCES ai_configuration_revisions(id),
      FOREIGN KEY(last_known_good_revision_id) REFERENCES ai_configuration_revisions(id)
    );

    CREATE TRIGGER IF NOT EXISTS immutable_ai_provider_revision_update
    BEFORE UPDATE ON ai_provider_revisions BEGIN
      SELECT RAISE(ABORT, 'ai provider revision is immutable');
    END;
    CREATE TRIGGER IF NOT EXISTS immutable_ai_provider_revision_delete
    BEFORE DELETE ON ai_provider_revisions BEGIN
      SELECT RAISE(ABORT, 'ai provider revision is immutable');
    END;
    CREATE TRIGGER IF NOT EXISTS immutable_ai_model_catalog_update
    BEFORE UPDATE ON ai_model_catalog BEGIN
      SELECT RAISE(ABORT, 'ai model catalog revision is immutable');
    END;
    CREATE TRIGGER IF NOT EXISTS immutable_ai_model_catalog_delete
    BEFORE DELETE ON ai_model_catalog BEGIN
      SELECT RAISE(ABORT, 'ai model catalog revision is immutable');
    END;
    CREATE TRIGGER IF NOT EXISTS immutable_ai_route_assignment_update
    BEFORE UPDATE ON ai_route_assignments BEGIN
      SELECT RAISE(ABORT, 'ai route assignment is immutable');
    END;
    CREATE TRIGGER IF NOT EXISTS immutable_ai_route_assignment_delete
    BEFORE DELETE ON ai_route_assignments BEGIN
      SELECT RAISE(ABORT, 'ai route assignment is immutable');
    END;
  `);
}
