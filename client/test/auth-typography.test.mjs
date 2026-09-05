import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../src/styles/auth.css', import.meta.url), 'utf8');

test('Auth typography keeps the pre-redesign readable scale', () => {
  assert.match(css, /\.auth-page \.auth-card h1\s*\{[^}]*font-size:\s*1\.3rem/);
  assert.match(css, /\.auth-card-heading>p\s*\{[^}]*font-size:\s*\.68rem/);
  assert.match(css, /\.auth-form label\s*\{[^}]*font-size:\s*\.65rem/);
  assert.match(css, /\.auth-form input\s*\{[^}]*font-size:\s*\.72rem/);
  assert.match(css, /\.google-button\s*\{[^}]*font-size:\s*\.7rem/);
  assert.match(css, /\.auth-submit\s*\{[^}]*font-size:\s*\.7rem/);
  assert.match(css, /\.auth-text-button\s*\{[^}]*font-size:\s*\.64rem/);
});
