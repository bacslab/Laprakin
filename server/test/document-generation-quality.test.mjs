import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';

import { displaySectionTitle, prepareEvidenceImageForAi } from '../src/services.js';

test('displaySectionTitle mempertahankan nomor bertingkat tanpa menggandakannya', () => {
  assert.equal(displaySectionTitle('1.1 Konfigurasi Dasar', 0), '1.1 Konfigurasi Dasar');
  assert.equal(displaySectionTitle('2. Verifikasi Hasil', 1), '2. Verifikasi Hasil');
  assert.equal(displaySectionTitle('Kesimpulan', 2), '3. Kesimpulan');
});

test('prepareEvidenceImageForAi mengecilkan gambar besar menjadi JPEG yang mudah dibaca model', async () => {
  const source = await sharp({
    create: { width: 2400, height: 1800, channels: 4, background: { r: 250, g: 250, b: 250, alpha: 1 } },
  }).png().toBuffer();

  const prepared = await prepareEvidenceImageForAi(source, 'image/png');
  const metadata = await sharp(prepared.binary).metadata();

  assert.equal(prepared.mimeType, 'image/jpeg');
  assert.equal(metadata.format, 'jpeg');
  assert.ok(metadata.width <= 1600);
  assert.ok(metadata.height <= 1600);
  assert.ok(prepared.binary.length < source.length);
});
