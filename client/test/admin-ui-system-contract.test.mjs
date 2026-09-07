import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [overview, charts, shared, broadcasts, providers, models, changes, health, routing, styles] = await Promise.all([
  read('../src/pages/Admin/legacy/OverviewRoute.jsx'),
  read('../src/pages/Admin/legacy/AdminMonitoringCharts.jsx'),
  read('../src/pages/Admin/legacy/shared.jsx'),
  read('../src/pages/Admin/legacy/BroadcastsRoute.jsx'),
  read('../src/pages/Admin/ai/ProvidersModule.jsx'),
  read('../src/pages/Admin/ai/ModelsModule.jsx'),
  read('../src/pages/Admin/ai/ChangesModule.jsx'),
  read('../src/pages/Admin/ai/HealthModule.jsx'),
  read('../src/pages/Admin/ai/RoutingModule.jsx'),
  read('../src/styles/admin-overhaul.css'),
]);
const credits = await read('../src/pages/Admin/legacy/CreditsRoute.jsx');

test('monitoring stays focused and uses flat, restrained surfaces', () => {
  assert.doesNotMatch(overview, /Privacy-first monitoring|privacyDescription/i);
  assert.doesNotMatch(charts, /color-mix\(/i);
  assert.doesNotMatch(styles, /box-shadow\s*:/i);
  assert.match(styles, /scrollbar-width\s*:\s*thin/);
  assert.match(styles, /::-webkit-scrollbar\s*\{[^}]*width:\s*6px/s);
});

test('Admin Console dropdowns use the custom select contract', () => {
  for (const source of [shared, broadcasts, providers, models, changes, health, routing, charts]) {
    assert.doesNotMatch(source, /<select\b/);
  }
  for (const source of [shared, providers, models, changes, health, routing, charts]) {
    assert.match(source, /CustomSelect/);
  }
});

test('inline page search is removed in favor of global admin search', () => {
  for (const source of [shared, broadcasts, providers, models]) {
    assert.doesNotMatch(source, /type=["']search["']|searchPlaceholder|recipientSearch/i);
  }
  assert.match(styles, /admin-global-search-trigger/);
});

test('legacy Admin surfaces inherit the Monitoring scale tokens', () => {
  assert.match(styles, /--admin-ui-font-size/);
  assert.match(styles, /--admin-ui-content-max/);
  assert.match(styles, /\.admin-content[^\{]*\{[^}]*font-size:\s*var\(--admin-ui-font-size\)/s);
});

test('Kredit user keeps the Monitoring component scale and page spacing', () => {
  assert.match(credits, /admin-credits-page/);
  assert.match(styles, /\.admin-credits-page[^\{]*\{[^}]*padding-top:\s*22px/s);
  assert.match(styles, /\.admin-credit-panel input[^\{]*\{[^}]*min-height:\s*44px/s);
  assert.match(styles, /\.admin-credits-page \.admin-credit-panel\s*>\s*label[^\{]*\{[^}]*font-size:\s*\.8rem/s);
  assert.match(styles, /\.admin-credits-page \.admin-user-list\s*>\s*article[^\{]*\{[^}]*padding:\s*16px\s+0/s);
});
