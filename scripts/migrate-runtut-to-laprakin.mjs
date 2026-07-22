import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(scriptDir, '../server/data');
const source = path.join(dataDir, 'runtut.sqlite');
const target = path.join(dataDir, 'laprakin.sqlite');

if (!fs.existsSync(source)) {
  console.error('Database lama tidak ditemukan: server/data/runtut.sqlite');
  process.exit(1);
}
if (fs.existsSync(target)) {
  console.error('Database target sudah ada: server/data/laprakin.sqlite. Batalkan demi menghindari overwrite.');
  process.exit(1);
}

fs.mkdirSync(dataDir, { recursive: true });
fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
for (const suffix of ['-wal', '-shm']) {
  const sidecar = `${source}${suffix}`;
  if (fs.existsSync(sidecar)) fs.copyFileSync(sidecar, `${target}${suffix}`, fs.constants.COPYFILE_EXCL);
}
console.log('Migrasi file database selesai. Jalankan server Laprakin sekali agar migrasi schema V5 diterapkan.');
