import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrateDatabaseFile } from './lib/migrate-database.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(scriptDir, '../server/data');
const source = path.join(dataDir, 'runtut.sqlite');
const target = path.join(dataDir, 'laprakin.sqlite');

try {
  const result = migrateDatabaseFile({ source, target });
  console.log(`Migrasi file database selesai (${result.copied.length} file). Jalankan server Laprakin sekali agar migrasi schema terbaru diterapkan.`);
} catch (error) {
  if (error?.code === 'MIGRATION_SOURCE_MISSING') console.error('Database lama tidak ditemukan: server/data/runtut.sqlite');
  else if (error?.code === 'MIGRATION_TARGET_EXISTS') console.error('Database target sudah ada: server/data/laprakin.sqlite. Batalkan demi menghindari overwrite.');
  else console.error('Migrasi database gagal tanpa mengubah source.', error?.code || 'MIGRATION_FAILED');
  process.exitCode = 1;
}
