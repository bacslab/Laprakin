function cleanId(value, label) {
  const id = String(value || '').trim();
  if (!id) throw new TypeError(label + ' wajib diisi.');
  return id;
}

function cleanReaction(value, { optional = false } = {}) {
  const reaction = String(value || '').trim();
  if (optional && !reaction) return '';
  if (!['like', 'dislike'].includes(reaction)) throw new TypeError('Reaksi pesan tidak valid.');
  return reaction;
}

export function buildMessageReactionRequest({ messageId, currentReaction = '', nextReaction }) {
  const message = cleanId(messageId, 'ID pesan');
  const current = cleanReaction(currentReaction, { optional: true });
  const next = cleanReaction(nextReaction);
  const path = '/chat/messages/' + encodeURIComponent(message) + '/reaction';
  if (current === next) return { path, method: 'DELETE' };
  return { path, method: 'PUT', body: { reaction: next } };
}

export function applyMessageReaction(messages, messageId, reaction) {
  const message = cleanId(messageId, 'ID pesan');
  const next = cleanReaction(reaction, { optional: true });
  const target = Array.isArray(messages) ? messages.find((item) => item?.id === message) : null;
  if (!target || target.role !== 'assistant') throw new TypeError('Reaksi hanya tersedia untuk pesan assistant.');
  return messages.map((item) => item.id === message ? { ...item, reaction: next } : item);
}

export function buildRevisionRequest({ sessionId, messageId, mode, content = '' }) {
  const session = cleanId(sessionId, 'ID sesi');
  const message = cleanId(messageId, 'ID pesan');
  if (mode !== 'edit' && mode !== 'regenerate') throw new TypeError('Mode revisi tidak valid.');
  const body = { mode };
  if (mode === 'edit') {
    const nextContent = String(content || '').trim();
    if (!nextContent) throw new TypeError('Isi pesan revisi wajib diisi.');
    body.content = nextContent;
  }
  return {
    path: '/chat/sessions/'
      + encodeURIComponent(session)
      + '/messages/'
      + encodeURIComponent(message)
      + '/revise',
    body,
  };
}

export function getEditableMessage(messages, messageId) {
  const id = String(messageId || '').trim();
  if (!id || !Array.isArray(messages)) return null;
  return messages.find((message) => message?.id === id && message.role === 'user') || null;
}

export function getRegenerationTarget(messages, assistantMessageId) {
  if (!Array.isArray(messages)) return null;
  const index = messages.findIndex((message) => message?.id === assistantMessageId);
  if (index < 1 || messages[index]?.role !== 'assistant') return null;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (messages[cursor]?.role === 'user') return messages[cursor];
  }
  return null;
}

function revisionDetails(message) {
  const revision = message?.meta?.revision;
  if (!revision || typeof revision !== 'object') return { sourceMessageId: '', revisionNumber: 0 };
  const revisionNumber = Number(revision.revisionNumber);
  return {
    sourceMessageId: String(revision.sourceMessageId || '').trim(),
    revisionNumber: Number.isFinite(revisionNumber) && revisionNumber > 0 ? revisionNumber : 0,
  };
}

function revisionSortValue(message, index) {
  const { revisionNumber } = revisionDetails(message);
  const timestamp = Date.parse(message?.created_at || message?.createdAt || '') || 0;
  return [revisionNumber, timestamp, index];
}

function compareRevisionVersions(left, right) {
  const leftValue = revisionSortValue(left.message, left.index);
  const rightValue = revisionSortValue(right.message, right.index);
  for (let index = 0; index < leftValue.length; index += 1) {
    if (leftValue[index] !== rightValue[index]) return leftValue[index] - rightValue[index];
  }
  return 0;
}

/**
 * Return only the active branch of a conversation.
 *
 * The API intentionally keeps each edited user message as a lightweight
 * version record while removing the old answer branch. The view should not
 * render that source record as a second bubble, otherwise an edit looks like
 * a duplicate message. This helper collapses each linear revision chain to
 * its newest user message and the answer immediately following it.
 */
export function collapseMessageRevisions(messages) {
  if (!Array.isArray(messages)) return [];

  const items = messages.filter(Boolean);
  const users = items.filter((message) => message.role === 'user' && message.id);
  const userById = new Map(users.map((message) => [message.id, message]));
  const groups = new Map();

  const rootFor = (message) => {
    let current = message;
    const seen = new Set([message.id]);
    while (true) {
      const { sourceMessageId } = revisionDetails(current);
      const parent = sourceMessageId ? userById.get(sourceMessageId) : null;
      if (!parent || seen.has(parent.id)) return current.id;
      seen.add(parent.id);
      current = parent;
    }
  };

  users.forEach((message, index) => {
    const rootId = rootFor(message);
    const versions = groups.get(rootId) || [];
    versions.push({ message, index });
    groups.set(rootId, versions);
  });

  const activeUserIds = new Set();
  const versionInfoById = new Map();
  groups.forEach((versions) => {
    versions.sort(compareRevisionVersions);
    const latest = versions.at(-1);
    activeUserIds.add(latest.message.id);
    if (versions.length > 1) {
      versionInfoById.set(latest.message.id, {
        current: versions.length,
        total: versions.length,
      });
    }
  });

  const visible = [];
  let previousUser = null;
  items.forEach((message) => {
    if (message.role === 'user') {
      previousUser = message;
      if (!activeUserIds.has(message.id)) return;
      const revisionInfo = versionInfoById.get(message.id);
      visible.push(revisionInfo ? { ...message, revisionInfo } : message);
      return;
    }
    if (message.role === 'assistant' && previousUser && !activeUserIds.has(previousUser.id)) return;
    visible.push(message);
  });
  return visible;
}
