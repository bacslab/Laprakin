import { nanoid } from 'nanoid';
import { db } from './db.js';
import { now, parseJson } from './utils.js';

const REACTIONS = new Set(['like', 'dislike']);
const REASONS = new Set(['', 'inaccurate', 'unclear', 'unhelpful', 'unsafe', 'other']);

export class MessageReactionError extends Error {
  constructor(message, code = 'MESSAGE_REACTION_INVALID', status = 400) {
    super(message);
    this.name = 'MessageReactionError';
    this.code = code;
    this.status = status;
  }
}

function exposeReaction(row) {
  if (!row) return null;
  return {
    messageId: row.message_id,
    sessionId: row.session_id,
    reaction: row.reaction,
    reasonCode: row.reason_code || '',
    requestId: row.request_id || '',
    providerId: row.provider_id || '',
    modelId: row.model_id || '',
    configurationRevision: row.configuration_revision || '',
    promptTemplateRevision: row.prompt_template_revision || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function canonicalAssistantMessage(store, ownerUserId, messageId) {
  const row = store.prepare(`
    SELECT message.id, message.session_id, message.request_id, message.meta_json,
      mutation.provider_id, mutation.model_id, mutation.configuration_revision,
      mutation.prompt_template_revision
    FROM chat_messages message
    LEFT JOIN mutation_requests mutation
      ON mutation.owner_user_id = message.owner_user_id
      AND mutation.operation = 'chat.message'
      AND mutation.request_id = message.request_id
    WHERE message.id = ? AND message.owner_user_id = ? AND message.role = 'assistant'
  `).get(messageId, ownerUserId);
  if (!row) throw new MessageReactionError('Pesan tidak ditemukan.', 'CHAT_MESSAGE_NOT_FOUND', 404);
  const meta = parseJson(row.meta_json, {});
  return {
    ...row,
    providerId: String(meta.provider || row.provider_id || ''),
    modelId: String(meta.model || row.model_id || ''),
    configurationRevision: String(meta.configurationRevision || row.configuration_revision || ''),
    promptTemplateRevision: String(meta.promptTemplateRevision || row.prompt_template_revision || ''),
  };
}

export function setMessageReaction({ ownerUserId, messageId, reaction, reasonCode = '', store = db }) {
  const normalizedReaction = String(reaction || '').trim();
  const normalizedReason = String(reasonCode || '').trim();
  if (!REACTIONS.has(normalizedReaction)) throw new MessageReactionError('Reaksi tidak valid.');
  if (!REASONS.has(normalizedReason)) throw new MessageReactionError('Alasan reaksi tidak valid.');
  const message = canonicalAssistantMessage(store, ownerUserId, messageId);
  const timestamp = now();
  store.prepare(`
    INSERT INTO message_reactions (
      id, owner_user_id, session_id, message_id, reaction, reason_code,
      request_id, provider_id, model_id, configuration_revision,
      prompt_template_revision, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_user_id, message_id) DO UPDATE SET
      reaction = excluded.reaction,
      reason_code = excluded.reason_code,
      updated_at = excluded.updated_at
  `).run(
    nanoid(), ownerUserId, message.session_id, message.id, normalizedReaction, normalizedReason,
    message.request_id || '', message.providerId, message.modelId, message.configurationRevision,
    message.promptTemplateRevision, timestamp, timestamp,
  );
  return exposeReaction(store.prepare('SELECT * FROM message_reactions WHERE owner_user_id = ? AND message_id = ?').get(ownerUserId, message.id));
}

export function removeMessageReaction({ ownerUserId, messageId, store = db }) {
  canonicalAssistantMessage(store, ownerUserId, messageId);
  store.prepare('DELETE FROM message_reactions WHERE owner_user_id = ? AND message_id = ?').run(ownerUserId, messageId);
  return null;
}

export function getMessageReactions({ ownerUserId, sessionId, store = db }) {
  return store.prepare(`
    SELECT * FROM message_reactions
    WHERE owner_user_id = ? AND session_id = ?
    ORDER BY updated_at ASC
  `).all(ownerUserId, sessionId).map(exposeReaction);
}

export function getMessageReactionAnalytics({ since, store = db }) {
  const rows = store.prepare(`
    SELECT reaction, reason_code, provider_id, model_id, COUNT(*) AS count
    FROM message_reactions
    WHERE updated_at >= ?
    GROUP BY reaction, reason_code, provider_id, model_id
    ORDER BY count DESC, reaction, reason_code, provider_id, model_id
  `).all(since);
  const counts = { like: 0, dislike: 0 };
  for (const row of rows) counts[row.reaction] = (counts[row.reaction] || 0) + Number(row.count || 0);
  return {
    total: counts.like + counts.dislike,
    counts,
    breakdown: rows.map((row) => ({
      reaction: row.reaction,
      reasonCode: row.reason_code || '',
      providerId: row.provider_id || '',
      modelId: row.model_id || '',
      count: Number(row.count || 0),
    })),
  };
}
