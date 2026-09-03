import fs from 'node:fs';
import path from 'node:path';

function migrationError(message, code) {
  return Object.assign(new Error(message), { code });
}

export function migrateDatabaseFile({ source, target }) {
  const sourcePath = path.resolve(String(source || ''));
  const targetPath = path.resolve(String(target || ''));
  if (!fs.existsSync(sourcePath)) {
    throw migrationError(`Legacy database does not exist: ${sourcePath}`, 'MIGRATION_SOURCE_MISSING');
  }

  const copies = [[sourcePath, targetPath]];
  for (const suffix of ['-wal', '-shm']) {
    if (fs.existsSync(`${sourcePath}${suffix}`)) copies.push([`${sourcePath}${suffix}`, `${targetPath}${suffix}`]);
  }
  if (copies.some(([, destination]) => fs.existsSync(destination))) {
    throw migrationError(`Migration target already exists: ${targetPath}`, 'MIGRATION_TARGET_EXISTS');
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const copied = [];
  try {
    for (const [origin, destination] of copies) {
      fs.copyFileSync(origin, destination, fs.constants.COPYFILE_EXCL);
      copied.push(destination);
    }
  } catch (error) {
    for (const destination of copied) fs.rmSync(destination, { force: true });
    if (error?.code === 'EEXIST') throw migrationError(`Migration target already exists: ${targetPath}`, 'MIGRATION_TARGET_EXISTS');
    throw error;
  }
  return { source: sourcePath, target: targetPath, copied };
}
