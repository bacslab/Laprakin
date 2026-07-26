// Tahun ajaran cover sebelumnya dipatok '2025/2026', sehingga setiap dokumen
// menua diam-diam begitu tahun berganti. Kalender akademik Indonesia dimulai
// sekitar Juli, jadi Januari-Juni masih milik tahun ajaran sebelumnya.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'laprakin-ay-'));
process.env.LAPRAKIN_DATA_DIR = dataDir;
process.env.LAPRAKIN_UPLOAD_DIR = path.join(dataDir, 'uploads');
process.env.LAPRAKIN_PUBLIC_MEDIA_DIR = path.join(dataDir, 'public-media');

const { currentAcademicYear } = await import('../src/services.js');

process.on('exit', () => {
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* dibersihkan OS */ }
});

test('Juli ke atas membuka tahun ajaran baru', () => {
  assert.equal(currentAcademicYear(new Date('2026-07-01T00:00:00Z')), '2026/2027');
  assert.equal(currentAcademicYear(new Date('2026-08-15T00:00:00Z')), '2026/2027');
  assert.equal(currentAcademicYear(new Date('2026-12-31T00:00:00Z')), '2026/2027');
});

test('Januari sampai Juni masih tahun ajaran sebelumnya', () => {
  assert.equal(currentAcademicYear(new Date('2026-01-15T00:00:00Z')), '2025/2026');
  assert.equal(currentAcademicYear(new Date('2026-06-30T00:00:00Z')), '2025/2026');
});

test('selalu berbentuk YYYY/YYYY+1', () => {
  for (const iso of ['2024-03-01T00:00:00Z', '2027-09-09T00:00:00Z', '2030-06-01T00:00:00Z']) {
    const value = currentAcademicYear(new Date(iso));
    assert.match(value, /^\d{4}\/\d{4}$/);
    const [start, end] = value.split('/').map(Number);
    assert.equal(end, start + 1);
  }
});
