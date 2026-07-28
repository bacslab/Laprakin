import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { nanoid } from 'nanoid';
import { config } from './config.js';
import { now } from './utils.js';

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });

export const db = new DatabaseSync(path.join(config.dataDir, 'laprakin.sqlite'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT DEFAULT '',
  nickname TEXT DEFAULT '',
  nim TEXT DEFAULT '',
  class_name TEXT DEFAULT '',
  institution_name TEXT DEFAULT '',
  institution_logo_url TEXT DEFAULT '',
  faculty_name TEXT DEFAULT '',
  study_program_name TEXT DEFAULT '',
  lecturer_name TEXT DEFAULT '',
  lecturer_nip TEXT DEFAULT '',
  department_key TEXT DEFAULT '',
  study_program_key TEXT DEFAULT '',
  role TEXT DEFAULT 'student',
  email_verified_at TEXT,
  verification_token TEXT,
  referral_code TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  device_hash TEXT UNIQUE NOT NULL,
  risk_score INTEGER DEFAULT 0,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS user_devices (
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  ip_hash TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY(user_id, device_id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(device_id) REFERENCES devices(id)
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  course_name TEXT DEFAULT '',
  module_title TEXT DEFAULT '',
  lecturer_name TEXT DEFAULT '',
  academic_year TEXT DEFAULT '',
  document_profile TEXT DEFAULT 'langkah',
  recipe_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  module_text TEXT DEFAULT '',
  outline_json TEXT DEFAULT '[]',
  generated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY(owner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS document_files (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  original_name TEXT NOT NULL,
  storage_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  source_declaration TEXT DEFAULT 'own',
  is_extracted INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY(document_id) REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS evidence_mappings (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  step_number INTEGER,
  step_title TEXT DEFAULT '',
  section_type TEXT DEFAULT 'implementation',
  caption TEXT DEFAULT '',
  description TEXT DEFAULT '',
  display_order INTEGER DEFAULT 0,
  confidence REAL DEFAULT 0,
  status TEXT DEFAULT 'suggested',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(document_id, file_id),
  FOREIGN KEY(document_id) REFERENCES documents(id),
  FOREIGN KEY(file_id) REFERENCES document_files(id)
);

CREATE TABLE IF NOT EXISTS report_sections (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  section_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT DEFAULT 'system',
  review_status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(document_id) REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  label TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(document_id) REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT DEFAULT 'queued',
  progress INTEGER DEFAULT 0,
  message TEXT DEFAULT '',
  result_json TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  FOREIGN KEY(document_id) REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS review_checks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  check_key TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  note TEXT DEFAULT '',
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(document_id, check_key),
  FOREIGN KEY(document_id) REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS exports (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT DEFAULT 'ready',
  review_mode TEXT DEFAULT 'reviewed',
  created_at TEXT NOT NULL,
  expires_at TEXT,
  FOREIGN KEY(document_id) REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS wallet_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bucket TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  available_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_user_id TEXT NOT NULL,
  invitee_user_id TEXT UNIQUE NOT NULL,
  code TEXT NOT NULL,
  status TEXT DEFAULT 'registered',
  rejection_reason TEXT,
  reward_entry_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(referrer_user_id) REFERENCES users(id),
  FOREIGN KEY(invitee_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_key TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_reference TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS support_access (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(document_id) REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  text_body TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  provider_message_id TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS file_scans (
  id TEXT PRIMARY KEY,
  file_id TEXT UNIQUE NOT NULL,
  document_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'clean',
  findings_json TEXT NOT NULL DEFAULT '[]',
  scanned_at TEXT NOT NULL,
  FOREIGN KEY(file_id) REFERENCES document_files(id),
  FOREIGN KEY(document_id) REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_key TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount_idr INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  provider TEXT NOT NULL,
  provider_reference TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  checkout_url TEXT,
  expires_at TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_files_document ON document_files(document_id);
CREATE INDEX IF NOT EXISTS idx_mappings_document ON evidence_mappings(document_id, display_order);
CREATE INDEX IF NOT EXISTS idx_sections_document ON report_sections(document_id, position);
CREATE INDEX IF NOT EXISTS idx_versions_document ON document_versions(document_id, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_document ON jobs(document_id, created_at);
CREATE INDEX IF NOT EXISTS idx_review_document ON review_checks(document_id);
CREATE INDEX IF NOT EXISTS idx_wallet_user ON wallet_entries(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at, created_at);
CREATE INDEX IF NOT EXISTS idx_email_outbox_status ON email_outbox(status, created_at);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON payment_orders(user_id, created_at);
`);



// V4: parameter registry, template health, and recoverable document trash.
db.exec(`
CREATE TABLE IF NOT EXISTS document_parameters (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  label TEXT NOT NULL,
  parameter_key TEXT NOT NULL,
  value TEXT NOT NULL,
  unit TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  source_note TEXT DEFAULT '',
  include_in_draft INTEGER DEFAULT 1,
  is_required INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(document_id, parameter_key),
  FOREIGN KEY(document_id) REFERENCES documents(id),
  FOREIGN KEY(owner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS template_inspections (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  file_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  summary TEXT DEFAULT '',
  details_json TEXT NOT NULL DEFAULT '{}',
  warnings_json TEXT NOT NULL DEFAULT '[]',
  inspected_at TEXT NOT NULL,
  FOREIGN KEY(document_id) REFERENCES documents(id),
  FOREIGN KEY(file_id) REFERENCES document_files(id)
);

CREATE INDEX IF NOT EXISTS idx_document_parameters_document ON document_parameters(document_id, created_at);
CREATE INDEX IF NOT EXISTS idx_template_inspections_document ON template_inspections(document_id, inspected_at);
`);

function hasColumn(tableName, columnName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all().some((column) => column.name === columnName);
}

function ensureColumn(tableName, columnName, definition) {
  if (!hasColumn(tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

// Forward-safe migrations for projects created before V3.
ensureColumn('users', 'session_version', 'INTEGER DEFAULT 1');
ensureColumn('users', 'verification_expires_at', 'TEXT');
db.prepare(`
  UPDATE users
  SET verification_expires_at = ?
  WHERE verification_token IS NOT NULL
    AND email_verified_at IS NULL
    AND verification_expires_at IS NULL
`).run(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
ensureColumn('jobs', 'payload_json', "TEXT DEFAULT '{}'");
ensureColumn('jobs', 'attempt_count', 'INTEGER DEFAULT 0');
ensureColumn('jobs', 'max_attempts', 'INTEGER DEFAULT 2');
ensureColumn('jobs', 'locked_at', 'TEXT');
ensureColumn('jobs', 'locked_by', 'TEXT');
ensureColumn('jobs', 'cancel_requested_at', 'TEXT');
ensureColumn('jobs', 'canceled_at', 'TEXT');
ensureColumn('jobs', 'last_heartbeat_at', 'TEXT');
ensureColumn('jobs', 'heartbeat_at', 'TEXT');
ensureColumn('jobs', 'run_after', 'TEXT');
ensureColumn('document_files', 'detected_mime', 'TEXT');
ensureColumn('document_files', 'security_status', "TEXT DEFAULT 'pending'");
ensureColumn('document_files', 'sha256', 'TEXT');
ensureColumn('notifications', 'href', "TEXT DEFAULT ''");
ensureColumn('notifications', 'is_read', 'INTEGER DEFAULT 0');
ensureColumn('documents', 'deadline_at', 'TEXT');
ensureColumn('documents', 'priority', "TEXT DEFAULT 'normal'");
ensureColumn('documents', 'is_pinned', 'INTEGER DEFAULT 0');
ensureColumn('documents', 'review_seconds', 'INTEGER DEFAULT 0');
ensureColumn('documents', 'last_reviewed_at', 'TEXT');
ensureColumn('documents', 'revision_count', 'INTEGER DEFAULT 0');
ensureColumn('exports', 'content_signature', "TEXT DEFAULT ''");
ensureColumn('users', 'google_sub', 'TEXT');
ensureColumn('users', 'auth_provider', "TEXT DEFAULT 'password'");
ensureColumn('payment_orders', 'quantity', 'INTEGER NOT NULL DEFAULT 1');
// V21 QRIS dynamic checkout: immutable cart snapshot, idempotency key, and
// gateway metadata are stored server-side. No client-supplied total is used.
ensureColumn('payment_orders', 'items_json', "TEXT NOT NULL DEFAULT '[]'");
ensureColumn('payment_orders', 'checkout_key', "TEXT DEFAULT ''");
ensureColumn('payment_orders', 'payment_channel', "TEXT DEFAULT ''");
ensureColumn('payment_orders', 'snap_token', 'TEXT');
ensureColumn('payment_orders', 'midtrans_transaction_id', 'TEXT');
ensureColumn('payment_orders', 'midtrans_status', 'TEXT');
ensureColumn('payment_orders', 'payment_type', 'TEXT');
ensureColumn('payment_orders', 'last_webhook_at', 'TEXT');
ensureColumn('payment_orders', 'last_status_check_at', 'TEXT');
ensureColumn('payment_orders', 'fulfilled_at', 'TEXT');
ensureColumn('payment_orders', 'failure_reason', 'TEXT');


// V5: planning layer for deadlines, priorities, personal notes, and persistent task checklists.
db.exec(`
CREATE TABLE IF NOT EXISTS document_tasks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  task_type TEXT DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'todo',
  due_at TEXT,
  position INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(document_id) REFERENCES documents(id),
  FOREIGN KEY(owner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS document_notes (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(document_id, owner_user_id),
  FOREIGN KEY(document_id) REFERENCES documents(id),
  FOREIGN KEY(owner_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_document_tasks_document ON document_tasks(document_id, position, created_at);
CREATE INDEX IF NOT EXISTS idx_document_tasks_due ON document_tasks(owner_user_id, due_at, status);
`);

export function audit(actorUserId, action, targetType, targetId, metadata = {}) {
  db.prepare(`
    INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(nanoid(), actorUserId || null, action, targetType, targetId || null, JSON.stringify(metadata), now());
}

export function notify(userId, kind, title, body, actionUrl = null) {
  const id = nanoid();
  db.prepare(`
    INSERT INTO notifications (id, user_id, kind, title, body, action_url, href, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(id, userId, kind, title, body, actionUrl, actionUrl || '', now());
  return id;
}

export function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    nickname: row.nickname || '',
    nim: row.nim,
    className: row.class_name,
    institutionName: row.institution_name || '',
    institutionLogoUrl: row.institution_logo_url || '',
    facultyName: row.faculty_name || '',
    studyProgramName: row.study_program_name || '',
    lecturerName: row.lecturer_name || '',
    lecturerNip: row.lecturer_nip || '',
    departmentKey: row.department_key,
    studyProgramKey: row.study_program_key,
    role: row.role,
    referralCode: row.referral_code || '',
    authProvider: row.auth_provider || 'password',
    emailVerified: Boolean(row.email_verified_at),
    onboardingDismissed: Boolean(row.onboarding_dismissed),
    createdAt: row.created_at,
  };
}


// V7: chat-first workspace, Google OIDC state, and scoped support conversations.
db.exec(`
CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Laprak baru',
  department_key TEXT DEFAULT '',
  study_program_key TEXT DEFAULT '',
  structure_mode TEXT DEFAULT 'guided',
  document_id TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(owner_user_id) REFERENCES users(id),
  FOREIGN KEY(document_id) REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  meta_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES chat_sessions(id),
  FOREIGN KEY(owner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS support_threads (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(owner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  scope_status TEXT NOT NULL DEFAULT 'allowed',
  created_at TEXT NOT NULL,
  FOREIGN KEY(thread_id) REFERENCES support_threads(id),
  FOREIGN KEY(owner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS oauth_states (
  id TEXT PRIMARY KEY,
  state_hash TEXT UNIQUE NOT NULL,
  nonce TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  redirect_path TEXT DEFAULT '/app',
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_sessions_owner ON chat_sessions(owner_user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_threads_owner ON support_threads(owner_user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_support_messages_thread ON support_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states(expires_at, used_at);
`);


// V8: chat-first staging area. Files are attached to a conversation first, then copied into a real document only when the user chooses to create it.
db.exec(`
CREATE TABLE IF NOT EXISTS chat_attachments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'evidence',
  original_name TEXT NOT NULL,
  storage_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  detected_mime TEXT,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT,
  message_id TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY(session_id) REFERENCES chat_sessions(id),
  FOREIGN KEY(owner_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_session ON chat_attachments(session_id, created_at);
`);

ensureColumn('chat_sessions', 'configuration_json', "TEXT DEFAULT '{}'");
ensureColumn('chat_sessions', 'course_group', "TEXT DEFAULT 'Belum dikelompokkan'");
ensureColumn('chat_sessions', 'sort_position', 'INTEGER DEFAULT 0');
ensureColumn('chat_sessions', 'is_pinned', 'INTEGER DEFAULT 0');
db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_sessions_group_sort ON chat_sessions(owner_user_id, course_group, sort_position);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_sessions_pinned ON chat_sessions(owner_user_id, is_pinned, updated_at);`);


// V9: privacy-first feedback, risk events, and structured landing CMS.
db.exec(`
CREATE TABLE IF NOT EXISTS feedback_items (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  rating INTEGER,
  body TEXT NOT NULL,
  contact_allowed INTEGER NOT NULL DEFAULT 0,
  allow_public_quote INTEGER NOT NULL DEFAULT 0,
  public_alias TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  admin_note TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(owner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS feedback_replies (
  id TEXT PRIMARY KEY,
  feedback_id TEXT NOT NULL,
  admin_user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(feedback_id) REFERENCES feedback_items(id),
  FOREIGN KEY(admin_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS risk_events (
  id TEXT PRIMARY KEY,
  subject_user_id TEXT,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low',
  summary TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  fingerprint TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  reviewer_user_id TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(subject_user_id) REFERENCES users(id),
  FOREIGN KEY(reviewer_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS cms_entries (
  content_key TEXT PRIMARY KEY,
  content_json TEXT NOT NULL DEFAULT '{}',
  updated_by_user_id TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(updated_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS feature_updates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  version_label TEXT NOT NULL DEFAULT '',
  highlights_json TEXT NOT NULL DEFAULT '[]',
  image_url TEXT NOT NULL DEFAULT '',
  image_name TEXT NOT NULL DEFAULT '',
  cta_label TEXT NOT NULL DEFAULT '',
  cta_path TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT 'all',
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  expires_at TEXT,
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(created_by_user_id) REFERENCES users(id),
  FOREIGN KEY(updated_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS feature_update_receipts (
  update_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  seen_at TEXT,
  dismissed_at TEXT,
  opened_at TEXT,
  PRIMARY KEY(update_id, user_id),
  FOREIGN KEY(update_id) REFERENCES feature_updates(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feedback_owner ON feedback_items(owner_user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_items(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_feedback_replies_feedback ON feedback_replies(feedback_id, created_at);
CREATE INDEX IF NOT EXISTS idx_risk_events_status ON risk_events(status, created_at);
CREATE INDEX IF NOT EXISTS idx_risk_events_subject ON risk_events(subject_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feature_updates_delivery ON feature_updates(status, published_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_feature_update_receipts_user ON feature_update_receipts(user_id, seen_at);
`);

// V20.9: idempotent payment fulfillment ledger. A gateway webhook may be retried,
// so entitlement creation is protected by a unique order id and a durable event record.
db.exec(`
CREATE TABLE IF NOT EXISTS payment_fulfillments (
  order_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_key TEXT NOT NULL,
  fulfilled_at TEXT NOT NULL,
  FOREIGN KEY(order_id) REFERENCES payment_orders(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  order_id TEXT NOT NULL,
  transaction_status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  received_at TEXT NOT NULL,
  UNIQUE(provider, order_id, transaction_status, received_at)
);

CREATE INDEX IF NOT EXISTS idx_payment_fulfillments_user ON payment_fulfillments(user_id, fulfilled_at);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_order ON payment_webhook_events(order_id, received_at);
`);

// Forward-safe metadata additions for QRIS webhook idempotency.
ensureColumn('payment_webhook_events', 'source', "TEXT DEFAULT 'webhook'");
ensureColumn('payment_webhook_events', 'event_hash', "TEXT DEFAULT ''");
db.exec(`
CREATE INDEX IF NOT EXISTS idx_payment_orders_checkout_key ON payment_orders(user_id, checkout_key, status, expires_at);
-- Prevent parallel double-click checkout requests from creating more than one
-- active Midtrans order for the same server-calculated cart.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_active_checkout
  ON payment_orders(user_id, checkout_key)
  WHERE provider = 'midtrans' AND checkout_key != '' AND status IN ('created', 'pending');
CREATE INDEX IF NOT EXISTS idx_payment_orders_midtrans_tx ON payment_orders(midtrans_transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_webhook_events_hash
  ON payment_webhook_events(provider, event_hash)
  WHERE event_hash != '';
`);

// V21: AI observability and per-user cost controls. Prompts and model output are
// intentionally excluded; only operational metadata and provider token counts are stored.
db.exec(`
CREATE TABLE IF NOT EXISTS ai_usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  purpose TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'basic',
  provider TEXT NOT NULL DEFAULT 'gemini',
  model TEXT NOT NULL,
  status TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  error_code TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_window ON ai_usage_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_purpose_status ON ai_usage_events(purpose, status, created_at);
`);

// V22: durable job timeline shown to users while AI reads, validates, drafts,
// reviews, and exports a report. Events contain operational status only.
db.exec(`
CREATE TABLE IF NOT EXISTS job_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY(owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_job_events_job ON job_events(job_id, created_at);
CREATE INDEX IF NOT EXISTS idx_job_events_document ON job_events(document_id, created_at);
`);

// V23: report-grounded quiz access. The correct answers stay server-side and
// every passed attempt is bound to the exact generated report content.
db.exec(`
CREATE TABLE IF NOT EXISTS document_quizzes (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  content_signature TEXT NOT NULL,
  questions_json TEXT NOT NULL,
  question_count INTEGER NOT NULL DEFAULT 5,
  pass_score INTEGER NOT NULL DEFAULT 70,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(document_id, owner_user_id, content_signature),
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY(owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  content_signature TEXT NOT NULL,
  question_ids_json TEXT NOT NULL,
  answers_json TEXT NOT NULL DEFAULT '[]',
  score INTEGER,
  passed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(quiz_id) REFERENCES document_quizzes(id) ON DELETE CASCADE,
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY(owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_quizzes_signature
  ON document_quizzes(document_id, owner_user_id, content_signature);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_document
  ON quiz_attempts(document_id, owner_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_passed
  ON quiz_attempts(document_id, owner_user_id, content_signature, passed);
`);

// V24: durable chat workflow and idempotent structured actions.
ensureColumn('users', 'onboarding_dismissed', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'nickname', "TEXT NOT NULL DEFAULT ''");
ensureColumn('users', 'institution_name', "TEXT NOT NULL DEFAULT ''");
ensureColumn('users', 'institution_logo_url', "TEXT NOT NULL DEFAULT ''");
ensureColumn('users', 'faculty_name', "TEXT NOT NULL DEFAULT ''");
ensureColumn('users', 'study_program_name', "TEXT NOT NULL DEFAULT ''");
ensureColumn('users', 'lecturer_name', "TEXT NOT NULL DEFAULT ''");
ensureColumn('users', 'lecturer_nip', "TEXT NOT NULL DEFAULT ''");
ensureColumn('chat_sessions', 'workflow_state', "TEXT NOT NULL DEFAULT 'NEW_CHAT'");
ensureColumn('chat_sessions', 'clarification_count', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('chat_sessions', 'source_recommendation_shown', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('chat_sessions', 'first_message_analyzed', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('chat_sessions', 'generated_title', "TEXT NOT NULL DEFAULT ''");
ensureColumn('chat_sessions', 'document_type', "TEXT NOT NULL DEFAULT 'lab_report'");
ensureColumn('chat_sessions', 'course_name', "TEXT NOT NULL DEFAULT ''");
ensureColumn('chat_sessions', 'practice_topic', "TEXT NOT NULL DEFAULT ''");
ensureColumn('chat_sessions', 'source_status_json', "TEXT NOT NULL DEFAULT '{}'");
ensureColumn('chat_sessions', 'context_summary', "TEXT NOT NULL DEFAULT ''");
ensureColumn('chat_sessions', 'missing_critical_context', "TEXT NOT NULL DEFAULT ''");
ensureColumn('chat_attachments', 'processing_status', "TEXT NOT NULL DEFAULT 'ready'");

db.exec(`
CREATE TABLE IF NOT EXISTS chat_session_actions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE(session_id, owner_user_id, idempotency_key),
  FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY(owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_session_actions_session
  ON chat_session_actions(session_id, owner_user_id, created_at);
`);

// V25: server-issued device identity and durable one-device registration guard.
db.exec(`
CREATE TABLE IF NOT EXISTS registration_guards (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  device_cookie_hash TEXT NOT NULL UNIQUE,
  client_device_hash TEXT UNIQUE,
  browser_hash TEXT NOT NULL,
  network_hash TEXT NOT NULL,
  network_browser_hash TEXT NOT NULL,
  email_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  verified_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_registration_guards_user
  ON registration_guards(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_registration_guards_browser
  ON registration_guards(browser_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_registration_guards_network
  ON registration_guards(network_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_registration_guards_network_browser
  ON registration_guards(network_browser_hash, created_at);
`);

// V26: one credit reservation and one AI-generated work plan per Laprak chat.
ensureColumn('chat_sessions', 'processing_credit_bucket', "TEXT NOT NULL DEFAULT ''");
ensureColumn('chat_sessions', 'processing_credit_reserved_at', 'TEXT');
ensureColumn('chat_sessions', 'processing_credit_refunded_at', 'TEXT');
ensureColumn('chat_sessions', 'work_plan_json', "TEXT NOT NULL DEFAULT '{}'");
ensureColumn('chat_sessions', 'work_plan_generated_at', 'TEXT');

// V27: bind uploaded files to the user message that submitted them and keep grounded visual notes.
ensureColumn('chat_attachments', 'message_id', 'TEXT');
ensureColumn('evidence_mappings', 'description', "TEXT NOT NULL DEFAULT ''");
db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_attachments_message ON chat_attachments(session_id, message_id, created_at);`);

// V28: project groups are virtual, but their pinned state belongs to the account.
db.exec(`
CREATE TABLE IF NOT EXISTS project_pins (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  project_key TEXT NOT NULL,
  project_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(owner_user_id, project_key),
  FOREIGN KEY(owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_pins_owner
  ON project_pins(owner_user_id, updated_at DESC);
`);

// V29: auditable admin credit distribution and privacy-safe operational alerts.
db.exec(`
CREATE TABLE IF NOT EXISTS admin_credit_grants (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  audience TEXT NOT NULL,
  target_user_id TEXT,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY(admin_user_id) REFERENCES users(id),
  FOREIGN KEY(target_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS admin_alerts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL,
  user_id TEXT,
  document_id TEXT,
  job_id TEXT,
  summary TEXT NOT NULL,
  error_code TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by_user_id TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE SET NULL,
  FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE SET NULL,
  FOREIGN KEY(resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_credit_grants_created
  ON admin_credit_grants(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_status
  ON admin_alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_user
  ON admin_alerts(user_id, created_at DESC);
`);

// V30: reversible account restrictions, user appeals, admin broadcasts, and
// server-authoritative pricing. Device/network targets stay pseudonymous.
ensureColumn('email_outbox', 'html_body', "TEXT NOT NULL DEFAULT ''");
db.exec(`
CREATE TABLE IF NOT EXISTS access_restrictions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  target_type TEXT NOT NULL,
  target_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_by_user_id TEXT,
  revoked_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by_user_id) REFERENCES users(id),
  FOREIGN KEY(revoked_by_user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_access_restrictions_active_target
  ON access_restrictions(target_type, target_value)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_access_restrictions_user
  ON access_restrictions(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_restrictions_expiry
  ON access_restrictions(status, expires_at);

CREATE TABLE IF NOT EXISTS account_appeals (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email_hash TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  admin_reply TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by_user_id TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(reviewed_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_account_appeals_status
  ON account_appeals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_appeals_user
  ON account_appeals(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_broadcasts (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  audience TEXT NOT NULL,
  target_user_ids_json TEXT NOT NULL DEFAULT '[]',
  subject TEXT NOT NULL,
  text_body TEXT NOT NULL,
  html_body TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  recipient_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY(admin_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_broadcasts_created
  ON admin_broadcasts(created_at DESC);

CREATE TABLE IF NOT EXISTS pricing_overrides (
  sku TEXT PRIMARY KEY,
  unit_price_idr INTEGER NOT NULL,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  discount_expires_at TEXT,
  updated_by_user_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(updated_by_user_id) REFERENCES users(id)
);
`);
ensureColumn('ai_usage_events', 'context_type', "TEXT NOT NULL DEFAULT ''");
ensureColumn('ai_usage_events', 'context_id', "TEXT NOT NULL DEFAULT ''");
ensureColumn('user_devices', 'profile_hash', "TEXT NOT NULL DEFAULT ''");
ensureColumn('pricing_overrides', 'credits', 'INTEGER');
ensureColumn('pricing_overrides', 'duration_days', 'INTEGER');
ensureColumn('pricing_overrides', 'revisions_per_report', 'INTEGER');
ensureColumn('pricing_overrides', 'storage_mb', 'INTEGER');
ensureColumn('pricing_overrides', 'features_json', 'TEXT');
db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_usage_context ON ai_usage_events(context_type, context_id, created_at);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_user_devices_profile ON user_devices(profile_hash, user_id);`);
