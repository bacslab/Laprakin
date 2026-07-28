// Gerbang kualitas laporan. Modul ini menentukan apakah sebuah draft boleh
// lolos ke user, jadi regresi di sini berarti draft buruk ikut terkirim.
// report-quality.js tidak punya import sama sekali, sehingga dapat diuji murni
// tanpa database, server, maupun kunci AI.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AI_SLOP_PATTERNS,
  analyzeChatRequest,
  generateChatTitle,
  inferDocumentType,
  isPlausibleAcademicContext,
  reportParameterIssues,
  reportSectionIssues,
} from '../src/report-quality.js';

const paragraph = (seed) => `${seed} `.repeat(24).trim();

function validSections() {
  return [
    { type: 'introduction', title: 'Pendahuluan Praktikum Routing', content: paragraph('Praktikum ini menyiapkan topologi tiga router pada emulator dan mencatat konfigurasi yang dipakai.') },
    { type: 'implementation', title: 'Implementasi Konfigurasi Router', content: paragraph('Konfigurasi dilakukan dengan menetapkan alamat IP pada setiap antarmuka lalu mendaftarkan rute statis.') },
    { type: 'output', title: 'Analisis Hasil Pengujian', content: paragraph('Pengujian ping antar host menghasilkan balasan dengan waktu tempuh rata-rata di bawah sepuluh milidetik.') },
  ];
}

test('inferDocumentType mengenali jenis dokumen dan menghormati urutan prioritas', () => {
  assert.equal(inferDocumentType('tolong buat proposal kegiatan'), 'proposal');
  assert.equal(inferDocumentType('makalah tentang basis data'), 'paper');
  assert.equal(inferDocumentType('artikel ilmiah singkat'), 'journal');
  assert.equal(inferDocumentType('draft skripsi bab satu'), 'final_project');
  assert.equal(inferDocumentType('laporan praktikum jaringan'), 'lab_report');
  assert.equal(inferDocumentType(''), 'unknown');

  // "proposal" diperiksa sebelum "praktikum", jadi kalimat yang memuat keduanya
  // harus tetap dibaca sebagai proposal.
  assert.equal(inferDocumentType('proposal praktikum jaringan'), 'proposal');
});

test('generateChatTitle hanya memakai konteks akademik yang spesifik', () => {
  assert.equal(
    generateChatTitle({ documentType: 'lab_report', courseName: 'Jaringan Komputer', practiceTopic: 'Routing Statis' }),
    'Laprak Jaringan Komputer - Routing Statis',
  );
  assert.equal(generateChatTitle({ documentType: 'paper', courseName: 'Basis Data', practiceTopic: '' }), 'Makalah Basis Data');

  // Nilai generik ditolak sehingga judul tidak berubah menjadi "Laprak laprak".
  assert.equal(generateChatTitle({ courseName: 'laprak', practiceTopic: 'praktikum' }), '');
  assert.equal(generateChatTitle({}), '');
});

test('analyzeChatRequest meminta hanya konteks laprak yang belum disebutkan', () => {
  const base = { configuration_json: '{}' };
  assert.equal(analyzeChatRequest({ session: base, messages: [{ role: 'user', content: 'Tolong buatkan laprak.' }] }).missingCriticalContext, 'course_and_topic');
  assert.equal(analyzeChatRequest({ session: base, messages: [{ role: 'user', content: 'Buat laprak mata kuliah Jaringan Komputer.' }] }).missingCriticalContext, 'practice_topic');
  assert.equal(analyzeChatRequest({ session: { configuration_json: '{"moduleTitle":"Routing Statis"}' }, messages: [{ role: 'user', content: 'Tolong susunkan laprak.' }] }).missingCriticalContext, 'course_name');
  assert.equal(analyzeChatRequest({ session: { configuration_json: '{"courseName":"Jaringan Komputer","moduleTitle":"Routing Statis"}' }, messages: [] }).missingCriticalContext, '');
});

test('isPlausibleAcademicContext menolak sapaan dan pertanyaan sebagai konteks', () => {
  assert.equal(isPlausibleAcademicContext('Jaringan Komputer'), true);
  assert.equal(isPlausibleAcademicContext('Pemrograman Mobile Lanjut'), true);

  for (const noise of ['halo', 'oke', 'tolong', 'gimana', 'apa itu laprak', 'kenapa error', '', '   ', 'laporan']) {
    assert.equal(isPlausibleAcademicContext(noise), false, `seharusnya ditolak: ${JSON.stringify(noise)}`);
  }
});

test('reportSectionIssues meloloskan draft yang sudah lengkap', () => {
  assert.deepEqual(reportSectionIssues(validSections()), []);
});

test('reportSectionIssues menuntut struktur minimum', () => {
  const issues = reportSectionIssues([{ type: 'introduction', title: 'Pendahuluan', content: 'terlalu pendek' }]);
  assert.ok(issues.some((issue) => issue.includes('tiga bagian substantif')));
  assert.ok(issues.some((issue) => issue.includes('bagian implementasi')));
  assert.ok(issues.some((issue) => issue.includes('analisis output')));
});

test('reportSectionIssues menolak draft lengkap secara struktur tetapi terlalu singkat', () => {
  const sections = validSections().map((section) => ({ ...section, content: section.content.slice(0, 500) }));
  assert.ok(reportSectionIssues(sections).some((issue) => issue.includes('terlalu singkat')));
});

test('reportSectionIssues menangkap marker data yang belum diisi', () => {
  const sections = validSections();
  sections[1].content = `${sections[1].content} Nilai throughput [PERLU DIISI USER].`;
  const issues = reportSectionIssues(sections);
  assert.ok(issues.some((issue) => issue.includes('belum diisi')));
});

test('reportSectionIssues menolak identitas praktikan di body dokumen', () => {
  // Guardrail dokumen: identitas hanya boleh ada di cover, tidak diulang di isi.
  const sections = validSections();
  sections[0].content = `Nama: Budi Santoso\nNIM: 2101234\n${sections[0].content}`;
  const issues = reportSectionIssues(sections);
  assert.ok(issues.some((issue) => issue.includes('identitas')));
});

test('reportSectionIssues menandai kalimat generik khas AI', () => {
  const sections = validSections();
  sections[2].content = `Pada era digital, pengujian jaringan memegang peranan penting. ${sections[2].content}`;
  const issues = reportSectionIssues(sections);
  assert.ok(issues.some((issue) => issue.includes('generik')));
});

test('setiap pola AI slop benar-benar cocok dengan contoh kalimatnya', () => {
  // Menjaga agar pola tidak rusak diam-diam saat daftar disunting.
  const samples = [
    'Bagian ini menjelaskan langkah percobaan.',
    'Pada era digital semua serba cepat.',
    'Secara keseluruhan hasilnya baik.',
    'Dapat disimpulkan bahwa metode berhasil.',
    'Analisis lebih lanjut diperlukan untuk memastikan.',
    'Teknologi memegang peranan penting di industri.',
    'Studi ini memberikan wawasan yang mendalam.',
    'Metode ini tidak hanya cepat tetapi juga akurat.',
    'Hasil tidak dapat dijabarkan lengkap karena keterbatasan data yang belum tersedia.',
    'Analisis dibatasi karena tidak adanya data pengukuran.',
  ];
  assert.equal(samples.length, AI_SLOP_PATTERNS.length);
  for (const [index, pattern] of AI_SLOP_PATTERNS.entries()) {
    assert.ok(pattern.test(samples[index]), `pola ${index + 1} tidak cocok dengan contohnya`);
  }
});

test('reportParameterIssues hanya menagih parameter wajib yang benar-benar hilang', () => {
  const sections = [{ content: 'Router dikonfigurasi dengan alamat 192.168.10.1 pada antarmuka utama.' }];

  assert.deepEqual(
    reportParameterIssues(sections, [{ label: 'IP Router', value: '192.168.10.1', isRequired: true }]),
    [],
  );

  const missing = reportParameterIssues(sections, [{ label: 'Gateway', value: '10.20.30.40', isRequired: true }]);
  assert.equal(missing.length, 1);
  assert.ok(missing[0].includes('Gateway'));

  // Parameter opsional diabaikan meskipun tidak muncul di draft.
  assert.deepEqual(
    reportParameterIssues(sections, [{ label: 'Catatan', value: 'tidak-ada-di-draft', isRequired: false }]),
    [],
  );

  // Mendukung penamaan snake_case dari baris database.
  const snake = reportParameterIssues(sections, [{ label: 'Gateway', value: '10.20.30.40', is_required: true }]);
  assert.equal(snake.length, 1);
});
