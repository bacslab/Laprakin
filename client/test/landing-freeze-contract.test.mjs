import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const tokens = readFileSync('client/src/styles/tokens.css', 'utf8');
const landing = readFileSync('client/src/styles/landing.css', 'utf8');
const landingBase = readFileSync('client/src/landing.css', 'utf8');
const landingView = readFileSync('client/src/pages/Landing/LandingView.jsx', 'utf8');

test('landing owns accent tokens instead of reading the shared user accent', () => {
  assert.match(tokens, /--landing-accent:\s*#c2ff33/i);
  assert.match(tokens, /--landing-accent-secondary:\s*#45ffa2/i);
  assert.match(landing, /--fg-lime:\s*var\(--landing-accent\)/);
  assert.match(landing, /--fg-mint:\s*var\(--landing-accent-secondary\)/);
  assert.doesNotMatch(landing, /--fg-lime:\s*var\(--accent\)/);
});

test('both landing CTAs use the real variable font and matching inherited weight', () => {
  assert.match(landing, /\.fg-page \.fg-gradient-button\s*\{[^}]*font-family:\s*'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', system-ui, sans-serif;[^}]*font-weight:\s*700;/);
  assert.match(landing, /\.fg-page \.fg-gradient-button span\s*\{[^}]*font-family:\s*inherit;[^}]*font-weight:\s*inherit;/);
  assert.match(landingBase, /\.fg-page \.fg-gradient-button\{[^}]*width:246px;[^}]*height:58px;[^}]*font-size:24px;/);
});

test('landing feature cards use the restored product images and quiet section lines', () => {
  for (let index = 1; index <= 4; index += 1) assert.match(landingView, new RegExp(`/landing/fitur/Fitur ${index}\\.png`));
  assert.match(landingBase, /--fg-border: color-mix\(in srgb, #e7e0d8 36%, transparent\)/);
  assert.match(landingBase, /\.fg-page \.fg-section-title p \{ margin-top: 22px; text-align: center; \}/);
  assert.match(landingBase, /\.fg-feature-media img/);
});
