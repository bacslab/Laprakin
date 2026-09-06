import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const landingBridge = readFileSync('client/src/styles/landing.css', 'utf8');
const interactionStyles = existsSync('client/src/styles/interaction.css')
  ? readFileSync('client/src/styles/interaction.css', 'utf8')
  : '';
const main = readFileSync('client/src/main.jsx', 'utf8');
const landingView = readFileSync('client/src/pages/Landing/LandingView.jsx', 'utf8');

test('landing hero copy keeps its centered auto margins outside the reset layer', () => {
  assert.match(landingBridge, /\.fg-page \.fg-hero-copy p\s*\{[^}]*margin:\s*22px auto 0;[^}]*text-align:\s*center;/);
});

test('landing disables selection and native image dragging', () => {
  assert.match(interactionStyles, /\.fg-page\s*,\s*\.fg-page \*\s*\{[^}]*user-select:\s*none;/s);
  assert.match(interactionStyles, /\.fg-page img\s*,\s*\.fg-page video\s*\{[^}]*-webkit-user-drag:\s*none;[^}]*user-drag:\s*none;/s);
  assert.match(landingView, /<img[^>]*draggable=\{false\}/);
});

test('workspace leaves selection available only for chat content and composer text', () => {
  assert.match(interactionStyles, /\.workspace\s*,\s*\.workspace \*\s*\{[^}]*user-select:\s*none;/s);
  assert.match(interactionStyles, /\.workspace \.message-content(?:\s*,\s*\.workspace \.message-content \*)?\s*\{[^}]*user-select:\s*text;/s);
  assert.match(interactionStyles, /\.workspace \.composer textarea\s*,\s*\.workspace \.message-inline-editor textarea\s*\{[^}]*user-select:\s*text;/s);
  assert.match(main, /import ['"]\.\/styles\/interaction\.css['"];?/);
});
