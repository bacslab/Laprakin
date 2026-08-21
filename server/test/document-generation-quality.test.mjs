import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';

import { displaySectionTitle, distributeEvidenceMappings, prepareEvidenceImageForAi } from '../src/services.js';

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

test('distributeEvidenceMappings menempatkan bukti pada bagian yang membahas fakta sama', () => {
  const sections = [
    'Konfigurasi Identitas Perangkat',
    'Verifikasi Konfigurasi IP Address',
    'Konfigurasi DHCP Server',
    'Konfigurasi Network Pool DHCP',
    'Konfigurasi Rute Statis Default',
    'Konfigurasi Rute Statis ke Jaringan Spesifik',
    'Verifikasi Tabel Rute',
    'Verifikasi Lease DHCP Aktif',
    'Verifikasi Konektivitas Jaringan',
    'Uji Konektivitas Jaringan dengan Ping ke DNS dan Domain',
  ].map((title, index) => ({ id: `section-${index + 1}`, title, section_type: 'implementation' }));
  const mappings = [
    ['Konfigurasi identitas router', 'Identitas Router-B'],
    ['Konfigurasi interface dan alamat IP', 'Daftar alamat IP'],
    ['Konfigurasi DHCP Server', 'Setup server DHCP'],
    ['Konfigurasi network scope DHCP', 'Daftar jaringan DHCP'],
    ['Konfigurasi default static route', 'Rute default 0.0.0.0/0'],
    ['Konfigurasi rute statis', 'Rute statis jaringan spesifik'],
    ['Verifikasi tabel routing', 'Tabel rute aktif'],
    ['Pemantauan DHCP lease', 'Lease DHCP aktif'],
    ['Uji konektivitas jaringan', 'Ping ke beberapa alamat IP'],
    ['Verifikasi konektivitas melalui ping', 'Ping ke DNS dan domain'],
  ].map(([step_title, caption], index) => ({ step_title, caption, section_type: 'implementation', display_order: index + 1 }));

  const distribution = distributeEvidenceMappings(sections, mappings);

  assert.equal(distribution.get('section-1')[0]?.caption, 'Identitas Router-B');
  assert.equal(distribution.get('section-4')[0]?.caption, 'Daftar jaringan DHCP');
  assert.equal(distribution.get('section-7')[0]?.caption, 'Tabel rute aktif');
  assert.equal(distribution.get('section-9')[0]?.caption, 'Ping ke beberapa alamat IP');
  assert.equal(distribution.get('section-10')[0]?.caption, 'Ping ke DNS dan domain');
});
