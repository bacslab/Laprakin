import assert from 'node:assert/strict';
import test from 'node:test';
import { collapseMessageRevisions, getMessageRevisionGroup } from '../src/lib/chat-message-actions.js';

test('collapses a revised message to the newest branch and keeps its version count', () => {
  const messages = [
    { id: 'u1', role: 'user', content: 'Konteks awal' },
    { id: 'a1', role: 'assistant', content: 'Jawaban awal' },
    { id: 'u2', role: 'user', content: 'Pertanyaan lama' },
    { id: 'a2', role: 'assistant', content: 'Jawaban lama' },
    {
      id: 'u2-r1',
      role: 'user',
      content: 'Pertanyaan diperbaiki',
      meta: { revision: { sourceMessageId: 'u2', mode: 'edit', revisionNumber: 1 } },
    },
    {
      id: 'a2-r1',
      role: 'assistant',
      content: 'Jawaban terbaru',
      meta: { revision: { sourceMessageId: 'u2', mode: 'edit', revisionNumber: 1 } },
    },
  ];

  const visible = collapseMessageRevisions(messages);

  assert.deepEqual(visible.map((message) => message.id), ['u1', 'a1', 'u2-r1', 'a2-r1']);
  assert.deepEqual(visible.find((message) => message.id === 'u2-r1')?.revisionInfo, {
    current: 2,
    total: 2,
  });
});

test('collapses multiple revisions in one chain and hides stale answers', () => {
  const messages = [
    { id: 'u1', role: 'user', content: 'Versi nol' },
    { id: 'a1', role: 'assistant', content: 'Jawaban nol' },
    { id: 'u1-r1', role: 'user', content: 'Versi satu', meta: { revision: { sourceMessageId: 'u1', revisionNumber: 1 } } },
    { id: 'a1-r1', role: 'assistant', content: 'Jawaban satu' },
    { id: 'u1-r2', role: 'user', content: 'Versi dua', meta: { revision: { sourceMessageId: 'u1-r1', revisionNumber: 2 } } },
    { id: 'a1-r2', role: 'assistant', content: 'Jawaban dua' },
  ];

  const visible = collapseMessageRevisions(messages);

  assert.deepEqual(visible.map((message) => message.id), ['u1-r2', 'a1-r2']);
  assert.deepEqual(visible[0].revisionInfo, { current: 3, total: 3 });
});

test('builds a selectable revision group with the answer paired to each version', () => {
  const messages = [
    { id: 'u1', role: 'user', content: 'Versi nol', created_at: '2026-01-01T00:00:00.000Z' },
    { id: 'a1', role: 'assistant', content: 'Jawaban nol' },
    { id: 'u1-r1', role: 'user', content: 'Versi satu', created_at: '2026-01-02T00:00:00.000Z', meta: { revision: { sourceMessageId: 'u1', revisionNumber: 1 } } },
    { id: 'a1-r1', role: 'assistant', content: 'Jawaban satu', meta: { revision: { sourceMessageId: 'u1', revisionNumber: 1 } } },
    { id: 'u1-r2', role: 'user', content: 'Versi dua', created_at: '2026-01-03T00:00:00.000Z', meta: { revision: { sourceMessageId: 'u1-r1', revisionNumber: 2 } } },
    { id: 'a1-r2', role: 'assistant', content: 'Jawaban dua', meta: { revision: { sourceMessageId: 'u1-r1', revisionNumber: 2 } } },
  ];

  const group = getMessageRevisionGroup(messages, 'u1-r2');

  assert.equal(group.currentIndex, 2);
  assert.equal(group.total, 3);
  assert.deepEqual(group.versions.map(({ user, assistant }) => [user.id, assistant?.id]), [
    ['u1', 'a1'],
    ['u1-r1', 'a1-r1'],
    ['u1-r2', 'a1-r2'],
  ]);
});
