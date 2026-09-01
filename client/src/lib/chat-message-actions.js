function cleanId(value, label) {
  const id = String(value || '').trim();
  if (!id) throw new TypeError(label + ' wajib diisi.');
  return id;
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
