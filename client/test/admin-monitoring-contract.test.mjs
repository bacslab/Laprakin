import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8').catch(() => '');
const [overview, packageJson] = await Promise.all([
  read('../src/pages/Admin/legacy/OverviewRoute.jsx'),
  read('../../client/package.json'),
]);

test('monitoring uses responsive area and line charts with operational filters', async () => {
  const charts = await read('../src/pages/Admin/legacy/AdminMonitoringCharts.jsx');
  assert.match(packageJson, /"recharts"/);
  assert.match(charts, /ResponsiveContainer/);
  assert.match(charts, /AreaChart/);
  assert.match(charts, /LineChart/);
  for (const label of ['period', 'provider', 'model', 'route', 'status']) assert.match(charts, new RegExp(label, 'i'));
  assert.match(charts, /role="img"/);
  assert.doesNotMatch(overview, /activity-bars/);
});

test('monitoring is a spacious standalone dashboard with operational detail', () => {
  assert.match(overview, /admin-monitoring-dashboard/);
  assert.match(overview, /admin-monitoring-hero/);
  assert.match(overview, /admin-monitoring-kpis/);
  assert.match(overview, /admin-monitoring-table/);
  assert.doesNotMatch(overview, /admin-content/);
});
