export class RevisionError extends Error {
  constructor(code) {
    super(code);
    this.name = 'RevisionError';
    this.code = code;
  }
}

function normalizedMode(mode) {
  const value = String(mode || '').trim().toLowerCase();
  if (value === 'edit' || value === 'regenerate') return value;
  throw new RevisionError('MODE_INVALID');
}

export function validateRevisionRequest(payload) {
  const mode = normalizedMode(payload?.mode);
  if (mode === 'regenerate') {
    return { mode, content: '' };
  }
  const content = String(payload?.content || '').trim();
  if (!content) throw new RevisionError('CONTENT_REQUIRED');
  return { mode, content };
}

export function buildRevisionPlan(messages, sourceMessageId, mode, content = '') {
  const safeMode = normalizedMode(mode);
  const sourceIndex = messages.findIndex((message) => message.id === sourceMessageId);
  if (sourceIndex < 0) throw new RevisionError('MESSAGE_NOT_FOUND');

  const source = messages[sourceIndex];
  if (source.role !== 'user') throw new RevisionError('USER_MESSAGE_REQUIRED');

  const userContent = safeMode === 'regenerate'
    ? String(source.content || '').trim()
    : String(content || '').trim();
  if (!userContent) throw new RevisionError('CONTENT_REQUIRED');

  const priorRevisionCount = Number(
    source?.meta?.revision?.revisionNumber
    || source?.meta?.revision?.latestRevisionNumber
    || source?.meta?.latestRevisionNumber
    || source?.latestRevisionNumber
    || source?.revision_number
    || 0,
  );

  return {
    source,
    retainedMessages: messages.slice(0, sourceIndex + 1),
    userContent,
    revisionNumber: priorRevisionCount + 1,
  };
}
