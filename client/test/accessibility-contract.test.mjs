import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const componentSource = await readFile(new URL('../src/components/CustomSelect.jsx', import.meta.url), 'utf8');
const dialogSource = await readFile(new URL('../src/components/Dialog.jsx', import.meta.url), 'utf8');
const overlaySource = await readFile(new URL('../src/components/WorkspaceOverlays.jsx', import.meta.url), 'utf8');
const attachmentPreviewSource = await readFile(new URL('../src/pages/Workspace/AttachmentPreview.jsx', import.meta.url), 'utf8');
const mainSource = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
const focusReturnSource = await readFile(new URL('../src/hooks/useFocusReturn.js', import.meta.url), 'utf8').catch(() => '');
const focusTrapSource = await readFile(new URL('../src/hooks/useFocusTrap.js', import.meta.url), 'utf8').catch(() => '');

test('custom select exposes the complete keyboard and active-option contract', () => {
  assert.match(componentSource, /onKeyDown/);
  assert.match(componentSource, /ArrowDown/);
  assert.match(componentSource, /ArrowUp/);
  assert.match(componentSource, /Home/);
  assert.match(componentSource, /End/);
  assert.match(componentSource, /Escape/);
  assert.match(componentSource, /aria-activedescendant/);
  assert.match(componentSource, /role="option"/);
});

test('dialogs, notices, and focus helpers have accessible boundaries', () => {
  assert.match(mainSource, /role="status"/);
  assert.match(attachmentPreviewSource, /role="dialog" aria-modal="true"/);
  assert.match(overlaySource, /notification-popover[^>]+role="dialog"[^>]+aria-modal="true"/);
  assert.match(focusReturnSource, /export function useFocusReturn/);
  assert.match(focusTrapSource, /export function useFocusTrap/);
  assert.match(dialogSource, /useFocusReturn/);
  assert.match(dialogSource, /useFocusTrap/);
});
