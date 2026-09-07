import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

let searchHelpers = null;
try {
  searchHelpers = await import('../src/pages/Admin/user-search.js');
} catch {
  // The RED phase intentionally tolerates the helper not existing yet.
}

test('user search matches pseudonymous references case-insensitively and preserves the active selection', () => {
  assert.equal(typeof searchHelpers?.filterAdminUsers, 'function');
  const users = [
    { id: 'one', userRef: 'U-Alpha123' },
    { id: 'two', userRef: 'U-Beta456' },
    { id: 'three', userRef: 'U-Gamma789' },
  ];
  assert.deepEqual(searchHelpers.filterAdminUsers(users, 'beta').map((user) => user.id), ['two']);
  assert.deepEqual(searchHelpers.filterAdminUsers(users, 'beta', 'one').map((user) => user.id), ['one', 'two']);
  assert.deepEqual(searchHelpers.filterAdminUsers(users, '  ').map((user) => user.id), ['one', 'two', 'three']);
});

test('feedback and appeal user searches only keep rows matching the displayed user reference', () => {
  assert.equal(typeof searchHelpers?.filterAdminRowsByUser, 'function');
  const rows = [{ userRef: 'U-Alpha123' }, { userRef: 'U-Beta456' }, { userRef: '' }];
  assert.deepEqual(searchHelpers.filterAdminRowsByUser(rows, 'ALPHA'), [rows[0]]);
  assert.deepEqual(searchHelpers.filterAdminRowsByUser(rows, ''), rows);
});

test('all requested Admin surfaces expose a user-search control', async () => {
  const paths = [
    '../src/pages/Admin/AdminBroadcastPanel.jsx',
    '../src/pages/Admin/AdminAccessPanel.jsx',
    '../src/pages/Admin/legacy/CreditsRoute.jsx',
    '../src/pages/Admin/AdminLegacyContentPanels.jsx',
    '../src/pages/Admin/AdminAppealsPanel.jsx',
  ];
  const sources = await Promise.all(paths.map((path) => readFile(new URL(path, import.meta.url), 'utf8')));
  for (const source of sources) assert.match(source, /filterAdmin(?:Users|RowsByUser)|admin-user-search/);
});

