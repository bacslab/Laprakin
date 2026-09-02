import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [controller, view, settings] = await Promise.all([
  readFile(new URL('../src/pages/Workspace/useLegacyWorkspaceController.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Workspace/LegacyWorkspaceView.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Workspace/SettingsModal.jsx', import.meta.url), 'utf8'),
]);

test('settings consent changes update the composer consent gate immediately', () => {
  assert.match(controller, /aiConsentData, setAiConsentData, enableExternalAiConsent/);
  assert.match(view, /onAiConsentChange=\{setAiConsentData\}/);
  assert.match(settings, /onAiConsentChange\?\.\(data\)/);
});
