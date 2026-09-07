import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/pages/Admin/LegacyAdminWorkspace.jsx', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/pages/Admin/AdminLegacyRoutes.jsx', import.meta.url), 'utf8').catch(() => '');
const shared = await readFile(new URL('../src/pages/Admin/legacy/shared.jsx', import.meta.url), 'utf8').catch(() => '');

test('legacy Admin loads only the active route instead of one global resource batch', () => {
  assert.match(source, /<AdminLegacyRoutes tab=\{tab\}/);
  assert.doesNotMatch(source, /const \[nextOverview, nextFeedback, nextAudit, nextCms, nextAiUsage, nextUsers, nextAlerts\]/);
  assert.doesNotMatch(source, /api\('\/admin\/overview'\), api\('\/admin\/feedback'\), api\('\/admin\/audit'\)/);
  assert.doesNotMatch(source, /if \(!overview \|\| !landing\) return/);
});

test('active Admin route exposes local loading, failure, freshness, and retry state', () => {
  assert.match(shared, /LoaderCircle/);
  assert.match(shared, /role="alert"/);
  assert.match(shared, /lastUpdated/);
  assert.match(shared, /onClick=\{resource\.reload\}/);
});

test('every legacy Admin section resolves through a static route boundary', () => {
  assert.match(source, /<AdminLegacyRoutes/);
  assert.doesNotMatch(source, /tab === 'overview'/);
  assert.match(routes, /import OverviewRoute from '\.\/legacy\/OverviewRoute'/);
  assert.match(routes, /import CmsRoute from '\.\/legacy\/CmsRoute'/);
  assert.match(routes, /class AdminLegacyRouteErrorBoundary/);
  for (const key of ['overview', 'credits', 'pricing', 'alerts', 'integrations', 'updates', 'broadcasts', 'feedback', 'users', 'appeals', 'risk', 'cms', 'audit', 'retention']) {
    assert.match(routes, new RegExp(`\\b${key}:`), `Missing static route: ${key}`);
  }
  assert.doesNotMatch(routes, /lazy\(|import\(/);
});
