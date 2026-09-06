import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const viteConfig = readFileSync('client/vite.config.js', 'utf8');

test('production build leaves React dependency ordering to Vite', () => {
  assert.doesNotMatch(viteConfig, /manualChunks\s*\(/);
});
