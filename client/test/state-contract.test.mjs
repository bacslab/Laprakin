import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../src/', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('provider modules expose only their domain contract plus named actions', async () => {
  const [chat, document, ui] = await Promise.all([
    source('state/chat-context.jsx'),
    source('state/document-context.jsx'),
    source('state/ui-context.jsx'),
  ]);
  assert.match(chat, /export function ChatProvider/);
  assert.match(chat, /messages,\s*input,\s*busy,\s*send,\s*revise,\s*regenerate/);
  assert.match(document, /export function DocumentProvider/);
  assert.match(document, /documentState,\s*attachments,\s*activeJob,\s*upload,\s*removeAttachment/);
  assert.match(ui, /export function UiProvider/);
  assert.match(ui, /notice,\s*route,\s*theme,\s*openModal,\s*closeModal/);
});

test('workspace page boundary does not export raw monolith setters', async () => {
  const workspace = await source('pages/Workspace/Workspace.jsx');
  assert.doesNotMatch(workspace, /setMessages|setDocumentState|setNotice|setPrefs/);
  assert.match(workspace, /ChatProvider/);
  assert.match(workspace, /DocumentProvider/);
  assert.match(workspace, /UiProvider/);
});
