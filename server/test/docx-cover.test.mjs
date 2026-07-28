// Penggantian logo cover hanya menukar berkas media dan tidak menyentuh
// perataan, sehingga logo mewarisi perataan template asal dan tampak bergeser.
import test from 'node:test';
import assert from 'node:assert/strict';

const { centerImageParagraphs } = await import('../src/docx-template.js');

const drawing = '<w:r><w:drawing><wp:inline/></w:drawing></w:r>';

test('paragraf bergambar tanpa pPr mendapat perataan tengah', () => {
  const [out] = centerImageParagraphs([`<w:p>${drawing}</w:p>`]);
  assert.match(out, /<w:pPr><w:jc w:val="center"\/><\/w:pPr>/);
  assert.ok(out.includes(drawing), 'isi paragraf harus dipertahankan');
});

test('perataan lain diganti menjadi tengah', () => {
  const [out] = centerImageParagraphs([`<w:p><w:pPr><w:jc w:val="left"/></w:pPr>${drawing}</w:p>`]);
  assert.match(out, /<w:jc w:val="center"\/>/);
  assert.doesNotMatch(out, /w:val="left"/);
});

test('jc disisipkan sebelum rPr sesuai urutan skema', () => {
  const [out] = centerImageParagraphs([`<w:p><w:pPr><w:spacing w:after="0"/><w:rPr><w:b/></w:rPr></w:pPr>${drawing}</w:p>`]);
  assert.ok(out.indexOf('<w:jc') < out.indexOf('<w:rPr'), 'jc harus mendahului rPr');
  assert.match(out, /<w:spacing w:after="0"\/>/, 'properti lain tidak boleh hilang');
});

test('paragraf teks biasa tidak disentuh', () => {
  const paragraph = '<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:t>Disusun oleh</w:t></w:r></w:p>';
  assert.deepEqual(centerImageParagraphs([paragraph]), [paragraph]);
});

test('gambar bergaya w:pict ikut ditengahkan', () => {
  const [out] = centerImageParagraphs(['<w:p><w:r><w:pict><v:shape/></w:pict></w:r></w:p>']);
  assert.match(out, /<w:jc w:val="center"\/>/);
});

test('gambar anchor memakai posisi tengah halaman, bukan offset tetap', () => {
  const anchor = '<w:drawing><wp:anchor><wp:positionH relativeFrom="page"><wp:posOffset>2484120</wp:posOffset></wp:positionH></wp:anchor></w:drawing>';
  const [out] = centerImageParagraphs([`<w:p>${anchor}</w:p>`]);
  assert.match(out, /<wp:positionH relativeFrom="page"><wp:align>center<\/wp:align><\/wp:positionH>/);
  assert.doesNotMatch(out, /<wp:posOffset>/);
});
