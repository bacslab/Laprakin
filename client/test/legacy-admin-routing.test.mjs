import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/pages/Admin/LegacyAdminWorkspace.jsx', import.meta.url), 'utf8');

test('legacy Admin loads only the active route instead of one global resource batch', () => {
  assert.match(source, /const loadActiveRoute = useCallback/);
  assert.match(source, /switch \(tab\)/);
  assert.doesNotMatch(source, /const \[nextOverview, nextFeedback, nextAudit, nextCms, nextAiUsage, nextUsers, nextAlerts\]/);
  assert.doesNotMatch(source, /api\('\/admin\/overview'\), api\('\/admin\/feedback'\), api\('\/admin\/audit'\)/);
  assert.doesNotMatch(source, /if \(!overview \|\| !landing\) return/);
});

test('active Admin route exposes local loading, failure, freshness, and retry state', () => {
  assert.match(source, /LoaderCircle/);
  assert.match(source, /role="alert"/);
  assert.match(source, /routeResource\.lastUpdated/);
  assert.match(source, /onClick=\{loadActiveRoute\}/);
});
