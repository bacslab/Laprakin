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
