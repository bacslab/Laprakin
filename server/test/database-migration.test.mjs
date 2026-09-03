import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { migrateDatabaseFile } from '../../scripts/lib/migrate-database.mjs';

test('database file migration copies the database and available SQLite sidecars without overwrite', () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'laprakin-migration-'));
  try {
    const source = path.join(sandbox, 'runtut.sqlite');
    const target = path.join(sandbox, 'laprakin.sqlite');
    fs.writeFileSync(source, 'database-fixture');
    fs.writeFileSync(`${source}-wal`, 'wal-fixture');

    const result = migrateDatabaseFile({ source, target });
    assert.deepEqual(result.copied.map((file) => path.basename(file)), ['laprakin.sqlite', 'laprakin.sqlite-wal']);
    assert.equal(fs.readFileSync(target, 'utf8'), 'database-fixture');
    assert.equal(fs.readFileSync(`${target}-wal`, 'utf8'), 'wal-fixture');
    assert.equal(fs.existsSync(`${target}-shm`), false);
    assert.throws(() => migrateDatabaseFile({ source, target }), (error) => error.code === 'MIGRATION_TARGET_EXISTS');
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test('database file migration fails closed when the legacy source is missing', () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'laprakin-migration-missing-'));
  try {
    assert.throws(
      () => migrateDatabaseFile({ source: path.join(sandbox, 'missing.sqlite'), target: path.join(sandbox, 'laprakin.sqlite') }),
      (error) => error.code === 'MIGRATION_SOURCE_MISSING',
    );
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});
