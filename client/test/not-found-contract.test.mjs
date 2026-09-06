import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [component, main, styles] = await Promise.all([
  readFile(new URL('../src/components/NotFoundPage.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
]);

test('unknown routes render the themed recovery page instead of redirecting home', () => {
  assert.match(main, /<Route path="\*" element={<NotFoundPage \/>} \/>/);
  assert.match(main, /KNOWN_APP_PATHS/);
  assert.match(main, /'\/app\/support'/);
  assert.match(main, /'\/app\/feedback'/);
  assert.match(main, /'\/app\/profile'/);
  assert.match(component, /Muat ulang/);
  assert.match(component, /Kembali ke beranda/);
  assert.match(styles, /\.not-found-page\.theme-dark/);
});
