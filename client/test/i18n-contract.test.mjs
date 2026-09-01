import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [id, en, source] = await Promise.all([
  readFile(new URL('../src/i18n/id.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../src/i18n/en.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../src/i18n/index.js', import.meta.url), 'utf8'),
]);

function keys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return nested && typeof nested === 'object' ? keys(nested, path) : [path];
  });
}

test('locale files have identical keyed surfaces and Indonesian defaults', () => {
  assert.deepEqual(keys(id).sort(), keys(en).sort());
  for (const key of keys(id)) assert.ok(String(key.split('.').reduce((current, part) => current?.[part], id) || '').trim(), key);
});

test('translator falls back to Indonesian and interpolates values', () => {
  assert.match(source, /export function createTranslator/);
  assert.match(source, /language === 'en'/);
  assert.match(source, /readPath\(language === 'en' \? en : id, key\)/);
});
