import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { resolveReducedMotion } from '../src/lib/motion-policy.js';

const workspaceSource = await readFile(new URL('../src/pages/Workspace/LegacyWorkspaceView.jsx', import.meta.url), 'utf8');

test('reduced motion is enabled by either the user or operating system', () => {
  assert.equal(resolveReducedMotion(false, false), false);
  assert.equal(resolveReducedMotion(true, false), true);
  assert.equal(resolveReducedMotion(false, true), true);
  assert.equal(resolveReducedMotion(true, true), true);
});

test('workspace renders the resolved motion policy instead of the raw preference', () => {
  assert.match(workspaceSource, /useResolvedReducedMotion/);
  assert.match(workspaceSource, /data-motion=\{reducedMotion \? 'reduce' : 'full'\}/);
  assert.doesNotMatch(workspaceSource, /data-motion=\{prefs\.reducedMotion/);
});
