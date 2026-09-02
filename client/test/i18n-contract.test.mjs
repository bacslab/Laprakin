import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [id, en, source, landingSource, statusSource, pricingSource] = await Promise.all([
  readFile(new URL('../src/i18n/id.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../src/i18n/en.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../src/i18n/index.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Landing/LandingView.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Status/StatusPage.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Pricing/PublicPricingPage.jsx', import.meta.url), 'utf8'),
]);
const runtimeSource = await readFile(new URL('../src/i18n/I18nRuntime.jsx', import.meta.url), 'utf8');

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

test('landing page consumes keyed locale copy', () => {
  assert.match(landingSource, /useI18n/);
  assert.match(landingSource, /t\('landing\.heroDescription'\)/);
  assert.match(landingSource, /t\('landing\.faqTitle'\)/);
  assert.doesNotMatch(landingSource, /Fokus praktikum\./);
  assert.doesNotMatch(landingSource, /Bahanmu bukan sekadar lampiran/);
  assert.doesNotMatch(landingSource, /Pertanyaan yang sering muncul/);
});

test('status page keeps dynamic health labels in locale keys', () => {
  assert.match(statusSource, /status\.checks\.database/);
  assert.match(statusSource, /status\.values\.\$\{normalized\}/);
  assert.doesNotMatch(statusSource, /Operational|Berjalan normal|Provider AI/);
});

test('public pricing flow consumes keyed locale copy', () => {
  assert.match(pricingSource, /useI18n/);
  assert.match(pricingSource, /t\('pricing\.plansTitle'\)/);
  assert.match(pricingSource, /t\('pricing\.status\.created'\)/);
  assert.match(pricingSource, /localizedFallbackFeatures\('pricing\.features\.free'/);
  assert.doesNotMatch(pricingSource, /Pilih plan yang pas buat kamu|Bayar dengan QRIS|Ringkasan pesanan/);
});

test('legacy DOM translation stays behind the i18n runtime boundary', async () => {
  const mainSource = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.match(runtimeSource, /translateUiText/);
  assert.match(mainSource, /I18nRuntime/);
  assert.doesNotMatch(mainSource, /function I18nRuntime/);
  assert.doesNotMatch(mainSource, /translateUiText/);
});
