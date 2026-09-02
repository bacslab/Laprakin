import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMessageReaction,
  buildMessageReactionRequest,
  buildRevisionRequest,
  getEditableMessage,
  getRegenerationTarget,
} from '../src/lib/chat-message-actions.js';

test('message reaction request toggles, reverses, and never carries message content', () => {
  assert.deepEqual(buildMessageReactionRequest({ messageId: 'a1', currentReaction: '', nextReaction: 'like' }), {
    path: '/chat/messages/a1/reaction',
    method: 'PUT',
    body: { reaction: 'like' },
  });
  assert.deepEqual(buildMessageReactionRequest({ messageId: 'a1', currentReaction: 'like', nextReaction: 'like' }), {
    path: '/chat/messages/a1/reaction',
    method: 'DELETE',
  });
  assert.deepEqual(buildMessageReactionRequest({ messageId: 'a1', currentReaction: 'like', nextReaction: 'dislike' }), {
    path: '/chat/messages/a1/reaction',
    method: 'PUT',
    body: { reaction: 'dislike' },
  });
  assert.equal(JSON.stringify(buildMessageReactionRequest({ messageId: 'a1', nextReaction: 'like' })).includes('content'), false);
});

test('message reaction state supports optimistic update and exact rollback', () => {
  const messages = [{ id: 'a1', role: 'assistant', reaction: '' }, { id: 'u1', role: 'user' }];
  const optimistic = applyMessageReaction(messages, 'a1', 'like');
  assert.equal(optimistic[0].reaction, 'like');
  assert.notEqual(optimistic, messages);
  assert.deepEqual(applyMessageReaction(optimistic, 'a1', messages[0].reaction), messages);
  assert.throws(() => applyMessageReaction(messages, 'u1', 'like'), /assistant/);
});

test('buildRevisionRequest creates an edit request with trimmed content', () => {
  assert.deepEqual(
    buildRevisionRequest({
      sessionId: 's1',
      messageId: 'm2',
      mode: 'edit',
      content: '  Revisi  ',
    }),
    {
      path: '/chat/sessions/s1/messages/m2/revise',
      body: { mode: 'edit', content: 'Revisi' },
    },
  );
});

test('buildRevisionRequest creates a regenerate request without content', () => {
  assert.deepEqual(
    buildRevisionRequest({
      sessionId: 's1',
      messageId: 'm3',
      mode: 'regenerate',
    }),
    {
      path: '/chat/sessions/s1/messages/m3/revise',
      body: { mode: 'regenerate' },
    },
  );
});

test('getEditableMessage returns only an owned user message', () => {
  const messages = [
    { id: 'u1', role: 'user', content: 'Pertanyaan' },
    { id: 'a1', role: 'assistant', content: 'Jawaban' },
  ];
  assert.deepEqual(getEditableMessage(messages, 'u1'), messages[0]);
  assert.equal(getEditableMessage(messages, 'a1'), null);
  assert.equal(getEditableMessage(messages, 'missing'), null);
});

test('getRegenerationTarget selects the preceding user message', () => {
  const messages = [
    { id: 'u1', role: 'user', content: 'Pertanyaan' },
    { id: 'a1', role: 'assistant', content: 'Jawaban' },
  ];
  assert.deepEqual(getRegenerationTarget(messages, 'a1'), messages[0]);
  assert.equal(getRegenerationTarget(messages, 'u1'), null);
});
