import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-chat-mutation-'));
process.env.LAPRAKIN_DATA_DIR = path.join(sandbox, 'data');
process.env.LAPRAKIN_UPLOAD_DIR = path.join(sandbox, 'uploads');
process.env.LAPRAKIN_PUBLIC_MEDIA_DIR = path.join(sandbox, 'public-media');

const { db } = await import('../src/db.js');
const { runCanonicalChatMutation } = await import('../src/chat-message-mutation.js');

const ownerUserId = `chat-mutation-user-${randomUUID()}`;
const timestamp = new Date().toISOString();
db.prepare(`INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, 'test-hash', ?, ?)`)
  .run(ownerUserId, `${ownerUserId}@example.test`, timestamp, timestamp);

after(async () => {
  db.close();
  await rm(sandbox, { recursive: true, force: true });
});

test('two concurrent calls with one key execute the mutation body once and share its canonical result', async () => {
  const requestId = `req-${randomUUID()}`;
  let executions = 0;
  const execute = async () => {
    executions += 1;
    await new Promise((resolve) => setTimeout(resolve, 60));
    return { statusCode: 200, response: { session: { id: 's1' }, messages: [{ id: 'm1' }] } };
  };
  const input = { sessionId: 's1', content: 'Satu aksi', aiMode: 'basic' };
  const [first, second] = await Promise.all([
    runCanonicalChatMutation({ ownerUserId, requestId, input, execute }),
    runCanonicalChatMutation({ ownerUserId, requestId, input, execute }),
  ]);
  assert.equal(executions, 1);
  assert.deepEqual(first, second);
  assert.equal(first.response.session.id, 's1');
});
