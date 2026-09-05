import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [components, surface, view, composer, styles, id, en, settings] = await Promise.all([
  readFile(new URL('../src/pages/Workspace/ChatComponents.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Workspace/ChatSurface.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Workspace/LegacyWorkspaceView.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Workspace/Composer.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/i18n/id.json', import.meta.url), 'utf8'),
  readFile(new URL('../src/i18n/en.json', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Workspace/SettingsModal.jsx', import.meta.url), 'utf8'),
]);

test('user message editing stays inline and supports copying the sent message', () => {
  assert.match(components, /export function InlineUserMessageEditor/);
  assert.match(components, /messageActions\.copyMessage/);
  assert.match(components, /messageActions\.copyMessageNotice/);
  assert.match(surface, /InlineUserMessageEditor/);
  assert.match(surface, /onEditSubmit/);
  assert.doesNotMatch(surface, /<Composer[\s\S]*editingMessage=\{editingMessage\}/);
  assert.match(view, /onEditSubmit=\{/);
});

test('main composer exposes the requested non-technical disclaimer', () => {
  assert.match(composer, /workspace\.composer\.disclaimer/);
  assert.match(id, /Laprakin dapat membuat kesalahan, periksa kembali hasil yang dibuat/);
  assert.match(en, /Laprakin can make mistakes, so please review the generated result/);
});

test('workspace copy does not expose provider names in the consent gate', () => {
  assert.doesNotMatch(composer, /aiConsentTitle', \{ providers/);
  assert.doesNotMatch(settings, /aiConsentDescription', \{ providers/);
  assert.match(id, /Izinkan Laprakin memproses bahanmu/);
  assert.match(id, /Data yang digunakan:/);
});

test('sidebar menu labels stay on one line and animate gently on hover', () => {
  assert.match(styles, /\.workspace \.session-menu(?:-folder)? > button[\s\S]*white-space:\s*nowrap/);
  assert.match(styles, /workspace-sidebar-marquee/);
  assert.match(styles, /\.workspace button\s*\{[^}]*font-family:\s*inherit/);
});

test('folder dialog accent follows the selected workspace accent', () => {
  assert.match(styles, /--app-accent/);
  assert.match(styles, /\.app-dialog-confirm[^}]*var\(--app-accent/);
});
