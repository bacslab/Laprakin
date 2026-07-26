// replaceParagraphLines dahulu memetakan lines[index] hanya ke segmen w:br yang
// kebetulan ada di template. Template dengan dua baris membuang baris ketiga dan
// keempat tanpa jejak, sehingga nama universitas dan TAHUN AKADEMIK tidak pernah
// muncul di cover.
import test from 'node:test';
import assert from 'node:assert/strict';

const { patchCoverElements } = await import('../src/docx-template.js');

const paragraph = (...lines) => `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r>${
  lines.map((line) => `<w:t>${line}</w:t>`).join('<w:br/>')
}</w:r></w:p>`;

const slots = {
  studyProgram: 'D4 Rekayasa Keamanan Siber',
  department: 'Komputer dan Bisnis',
  institutionName: 'Politeknik Negeri Cilacap',
  academicYear: '2026/2027',
};

const textOf = (xml) => [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi)].map((m) => m[1]);

test('empat baris tetap lengkap walau template hanya punya dua', () => {
  const [out] = patchCoverElements([paragraph('PROGRAM STUDI LAMA', 'JURUSAN LAMA')], slots);
  const lines = textOf(out);
  assert.equal(lines.length, 4, `harus empat baris, dapat ${lines.length}: ${lines.join(' | ')}`);
  assert.equal(lines[3], 'TAHUN AKADEMIK 2026/2027');
  assert.ok(lines[2].includes('POLITEKNIK NEGERI CILACAP'), 'universitas tidak boleh hilang');
});

test('tahun akademik selalu menjadi baris terakhir', () => {
  for (const template of [
    paragraph('PROGRAM STUDI X'),
    paragraph('PROGRAM STUDI X', 'JURUSAN Y'),
    paragraph('PROGRAM STUDI X', 'JURUSAN Y', 'UNIV Z'),
    paragraph('PROGRAM STUDI X', 'JURUSAN Y', 'UNIV Z', 'TAHUN AKADEMIK 2020/2021'),
  ]) {
    const [out] = patchCoverElements([template], slots);
    const lines = textOf(out).filter((line) => line.trim());
    assert.equal(lines.at(-1), 'TAHUN AKADEMIK 2026/2027');
  }
});

test('paragraf kosong setelah blok akademik dibuang', () => {
  const out = patchCoverElements([
    paragraph('PROGRAM STUDI X', 'JURUSAN Y'),
    '<w:p><w:r><w:t> </w:t></w:r></w:p>',
    '<w:p/>',
  ], slots);
  assert.equal(out.length, 1, 'hanya blok akademik yang tersisa di akhir cover');
});

test('paragraf berisi setelah blok akademik dipertahankan', () => {
  const out = patchCoverElements([
    paragraph('PROGRAM STUDI X', 'JURUSAN Y'),
    '<w:p><w:r><w:t>Catatan penting</w:t></w:r></w:p>',
  ], slots);
  assert.equal(out.length, 2);
});

test('jumlah break sesuai jumlah baris', () => {
  const [out] = patchCoverElements([paragraph('PROGRAM STUDI X')], slots);
  assert.equal((out.match(/<w:br\b[^>]*\/>/gi) || []).length, 3, 'empat baris butuh tiga break');
});
