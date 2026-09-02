import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-mutations-'));
process.env.LAPRAKIN_DATA_DIR = path.join(sandbox, 'data');
process.env.LAPRAKIN_UPLOAD_DIR = path.join(sandbox, 'uploads');
process.env.LAPRAKIN_PUBLIC_MEDIA_DIR = path.join(sandbox, 'public-media');

const { db } = await import('../src/db.js');
const {
  beginMutation,
  completeMutation,
  failMutation,
  getMutationSnapshot,
  hashMutationInput,
} = await import('../src/mutation-requests.js');

const ownerUserId = `mutation-user-${randomUUID()}`;
const timestamp = new Date().toISOString();
db.prepare(`
  INSERT INTO users (id, email, password_hash, created_at, updated_at)
  VALUES (?, ?, 'test-only-hash', ?, ?)
`).run(ownerUserId, `${ownerUserId}@example.test`, timestamp, timestamp);

after(async () => {
  db.close();
  await rm(sandbox, { recursive: true, force: true });
});

test('equivalent mutation input has one stable privacy-safe hash', () => {
  assert.equal(
    hashMutationInput({ content: 'A', nested: { mode: 'basic', value: 1 } }),
    hashMutationInput({ nested: { value: 1, mode: 'basic' }, content: 'A' }),
  );
  assert.notEqual(hashMutationInput({ content: 'A' }), hashMutationInput({ content: 'B' }));
});

test('one owner, operation, and request ID acquires one canonical mutation', () => {
  const requestId = `req-${randomUUID()}`;
  const first = beginMutation({ ownerUserId, operation: 'chat.message', requestId, input: { content: 'A' } });
  const replay = beginMutation({ ownerUserId, operation: 'chat.message', requestId, input: { content: 'A' } });
  assert.equal(first.disposition, 'started');
  assert.equal(first.mutation.state, 'processing');
  assert.equal(replay.disposition, 'in_progress');
  assert.equal(replay.mutation.id, first.mutation.id);
});

test('completed mutation replays its canonical status and response', () => {
  const requestId = `req-${randomUUID()}`;
  beginMutation({ ownerUserId, operation: 'chat.message', requestId, input: { content: 'A' } });
  completeMutation({
    ownerUserId,
    operation: 'chat.message',
    requestId,
    statusCode: 200,
    response: { session: { id: 's1' }, messages: [] },
    resourceType: 'chat_session',
    resourceId: 's1',
  });
  const replay = beginMutation({ ownerUserId, operation: 'chat.message', requestId, input: { content: 'A' } });
  assert.equal(replay.disposition, 'replay');
  assert.equal(replay.mutation.statusCode, 200);
  assert.deepEqual(replay.mutation.response, { session: { id: 's1' }, messages: [] });
  assert.equal(replay.mutation.resourceId, 's1');
});

test('request ID reuse with different input is rejected', () => {
  const requestId = `req-${randomUUID()}`;
  beginMutation({ ownerUserId, operation: 'chat.message', requestId, input: { content: 'A' } });
  assert.throws(
    () => beginMutation({ ownerUserId, operation: 'chat.message', requestId, input: { content: 'B' } }),
    (error) => error.code === 'IDEMPOTENCY_KEY_REUSED' && error.status === 409,
  );
});

test('failed mutations expose a typed snapshot without raw input', () => {
  const requestId = `req-${randomUUID()}`;
  beginMutation({ ownerUserId, operation: 'chat.message', requestId, input: { content: 'private prompt' } });
  failMutation({ ownerUserId, operation: 'chat.message', requestId, retryable: true, errorCode: 'AI_TIMEOUT' });
  const snapshot = getMutationSnapshot({ ownerUserId, operation: 'chat.message', requestId });
  assert.equal(snapshot.state, 'retryable_failed');
  assert.equal(snapshot.errorCode, 'AI_TIMEOUT');
  assert.equal(JSON.stringify(snapshot).includes('private prompt'), false);
});
