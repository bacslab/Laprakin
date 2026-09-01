import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('token stylesheet defines the existing light and dark theme contract', () => {
  const css = readFileSync('client/src/styles/tokens.css', 'utf8');

  assert.match(css, /--accent:/);
  assert.match(css, /--workspace-panel:/);
  assert.match(css, /--spacing-/);
  assert.match(css, /--radius-/);
  assert.match(css, /--shadow-/);
  assert.match(css, /\[data-theme="dark"\]/);
});

test('cascade layers keep compatibility overrides last', () => {
  const css = readFileSync('client/src/styles/layers.css', 'utf8');

  assert.match(css, /@layer\s+reset,\s*tokens,\s*base,\s*components,\s*sections,\s*utilities,\s*compatibility/);
});

test('landing stylesheet owns landing section selectors', () => {
  const css = readFileSync('client/src/styles/landing.css', 'utf8');

  assert.match(css, /@layer\s+sections/);
  assert.match(css, /\.fg-page/);
  assert.match(css, /\.fg-hero/);
  assert.match(css, /\.fg-footer/);
});
