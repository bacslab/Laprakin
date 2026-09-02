import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
function colors(name) {
  return [...css.matchAll(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'gi'))].map((match) => match[1]);
}
function luminance(hex) {
  const channels = [0, 2, 4].map((offset) => parseInt(hex.slice(offset + 1, offset + 3), 16) / 255)
    .map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}
function contrast(first, second) {
  const light = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (light + 0.05) / (dark + 0.05);
}

test('light and dark workspace text tokens meet WCAG AA for normal text', () => {
  const text = colors('--workspace-text');
  const backgrounds = colors('--workspace-bg');
  assert.equal(text.length, 2);
  assert.equal(backgrounds.length, 2);
  assert.ok(contrast(text[0], backgrounds[0]) >= 4.5);
  assert.ok(contrast(text[1], backgrounds[1]) >= 4.5);
});

test('workspace muted text keeps AA contrast against its matching canvas', () => {
  const muted = colors('--workspace-muted');
  const backgrounds = colors('--workspace-bg');
  assert.ok(contrast(muted[0], backgrounds[0]) >= 4.5);
  assert.ok(contrast(muted[1], backgrounds[1]) >= 4.5);
});
