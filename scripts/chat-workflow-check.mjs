import assert from 'node:assert/strict';
import {
  analyzeChatRequest,
  assessChatReadiness,
  assessDocumentGenerationReadiness,
  defaultChatSourceStatus,
  generateChatTitle,
  guardKnownContextReply,
  inferChatContext,
  isPlausibleAcademicContext,
  LAPRAK_REPORT_PROFILE,
  reportParameterIssues,
  reportSectionIssues,
  vaguePromptReply,
} from '../server/src/report-quality.js';

const completeUser = {
  full_name: 'Asep Saputra',
  nim: '2300001',
  class_name: 'TI-2A',
  department_key: 'jkb',
  study_program_key: 'ti',
};

const emptySession = { configuration_json: JSON.stringify({}) };
const vagueWorkflow = assessChatReadiness({
  session: emptySession,
  user: completeUser,
  messages: [{ role: 'user', content: 'Asep' }],
  attachments: [],
});
assert.equal(vagueWorkflow.stage, 'intake');
assert.equal(vagueWorkflow.canCreateDocument, false);
assert.equal(vagueWorkflow.canGenerateDraft, false);
assert.match(vaguePromptReply('Asep', vagueWorkflow), /belum punya konteks/i);

const directBrief = 'Buatkan saya laprak untuk mata kuliah Jaringan Komputer, dengan materi Static Routing.';
const structuredBrief = analyzeChatRequest({
  session: emptySession,
  messages: [{ role: 'user', content: directBrief }],
  attachments: [],
});
assert.equal(structuredBrief.documentType, 'lab_report');
assert.equal(structuredBrief.courseName, 'Jaringan Komputer');
assert.equal(structuredBrief.practiceTopic, 'Static Routing');
assert.equal(structuredBrief.missingCriticalContext, '');
assert.equal(structuredBrief.hasGenerationIntent, true);
assert.equal(generateChatTitle(structuredBrief), 'Laprak Jaringan Komputer - Static Routing');
assert.deepEqual(defaultChatSourceStatus(), {
  module: 'UNKNOWN',
  instruction: 'UNKNOWN',
  practiceEvidence: 'UNKNOWN',
  template: 'UNKNOWN',
  supportingDocument: 'UNKNOWN',
});
const sourceStructuredBrief = analyzeChatRequest({
  session: emptySession,
  messages: [{ role: 'user', content: directBrief }],
  attachments: [{ kind: 'module' }, { kind: 'practice_evidence' }],
});
assert.equal(sourceStructuredBrief.sourceStatus.module, 'UPLOADED');
assert.equal(sourceStructuredBrief.sourceStatus.practiceEvidence, 'UPLOADED');
const inferredBrief = inferChatContext({
  messages: [{ role: 'user', content: directBrief }],
  configuration: {},
});
assert.equal(inferredBrief.configuration.courseName, 'Jaringan Komputer');
assert.equal(inferredBrief.configuration.moduleTitle, 'Static Routing');
assert.equal(isPlausibleAcademicContext('Jaringan Komputer'), true);
assert.equal(isPlausibleAcademicContext('Jarkom'), true);
assert.equal(isPlausibleAcademicContext('mana?'), false);
assert.equal(isPlausibleAcademicContext('halo?'), false);
assert.equal(isPlausibleAcademicContext('kok belum'), false);
const conversationalBrief = inferChatContext({
  messages: [{
    role: 'user',
    content: 'Oke, jadi gini. Buatkan laprak mata kuliah Jaringan Komputer untuk materi DHCP berdasarkan bahan praktik yang tersedia.',
  }],
  configuration: {},
});
assert.equal(conversationalBrief.configuration.courseName, 'Jaringan Komputer');
assert.equal(conversationalBrief.configuration.moduleTitle, 'DHCP');
const directBriefWorkflow = assessChatReadiness({
  session: emptySession,
  user: completeUser,
  messages: [{ role: 'user', content: directBrief }],
  attachments: [],
});
assert.equal(directBriefWorkflow.stage, 'ready');
assert.equal(directBriefWorkflow.canCreateDocument, true);
assert.equal(directBriefWorkflow.canGenerateDraft, true);
assert.equal(directBriefWorkflow.known.courseName, 'Jaringan Komputer');
assert.equal(directBriefWorkflow.known.moduleTitle, 'Static Routing');
assert.match(directBriefWorkflow.nextQuestion, /konteks sudah cukup/i);
assert.doesNotMatch(directBriefWorkflow.nextQuestion, /mata kuliah apa|materi atau topik praktikumnya apa/i);
const shorthandBrief = assessChatReadiness({
  session: emptySession,
  user: completeUser,
  messages: [{ role: 'user', content: 'Buatkan saya laprak matkul A, dengan materi A.' }],
  attachments: [],
});
assert.equal(shorthandBrief.known.courseName, 'A');
assert.equal(shorthandBrief.known.moduleTitle, 'A');
assert.equal(shorthandBrief.stage, 'ready');
assert.doesNotMatch(shorthandBrief.nextQuestion, /mata kuliah apa|materi atau topik praktikumnya apa/i);
assert.equal(
  guardKnownContextReply('Oke. Mata kuliahnya apa dan materinya apa?', shorthandBrief),
  shorthandBrief.nextQuestion,
);

const taskMessage = 'Saya mengerjakan praktikum static routing pada mata kuliah Jaringan Komputer. Dosen meminta urutan konfigurasi router, command yang dipakai, dan analisis hasil ping antarjaringan berdasarkan modul.';
const collectingWorkflow = assessChatReadiness({
  session: emptySession,
  user: completeUser,
  messages: [{ role: 'user', content: taskMessage }],
  attachments: [{ kind: 'module' }],
});
assert.equal(collectingWorkflow.canCreateDocument, true);
assert.equal(collectingWorkflow.canGenerateDraft, true);
assert.equal(collectingWorkflow.stage, 'ready');

const readyWorkflow = assessChatReadiness({
  session: emptySession,
  user: completeUser,
  messages: [{ role: 'user', content: taskMessage }],
  attachments: [{ kind: 'module' }, { kind: 'evidence' }],
});
assert.equal(readyWorkflow.stage, 'ready');
assert.equal(readyWorkflow.canGenerateDraft, true);

const noFileWorkflow = assessChatReadiness({
  session: emptySession,
  user: completeUser,
  messages: [
    { role: 'user', content: directBrief },
    { role: 'assistant', content: directBriefWorkflow.nextQuestion },
    { role: 'user', content: 'tidak ada' },
    { role: 'assistant', content: 'Ceritakan langkah yang dilakukan dan hasil yang terlihat. Screenshot atau file bersifat opsional; kalau memang tidak ada, cukup bilang tidak ada.' },
    { role: 'user', content: 'tidak ada' },
  ],
  attachments: [],
});
assert.equal(noFileWorkflow.stage, 'ready');
assert.equal(noFileWorkflow.canGenerateDraft, true);
assert.equal(noFileWorkflow.sourceMode, 'unavailable');
assert.equal(noFileWorkflow.evidenceMode, 'unavailable');

const concreteSections = [
  {
    type: 'implementation',
    title: '1. Analisis Implementasi',
    content: 'Konfigurasi static routing dilakukan pada Router A dengan menambahkan rute menuju jaringan 192.168.20.0/24 melalui next-hop 10.10.10.2. Alamat tersebut dipilih karena antarmuka 10.10.10.2 terhubung langsung dengan Router A dan menjadi jalur menuju jaringan tujuan. Setelah perintah disimpan, tabel routing diperiksa untuk memastikan entri tujuan, subnet mask, dan gateway muncul sesuai topologi pada modul. Pemeriksaan ini dilakukan sebelum pengujian konektivitas agar kesalahan rute dapat dipisahkan dari masalah konfigurasi host.',
  },
  {
    type: 'implementation',
    title: '1.1 Konfigurasi Jalur Balik',
    content: 'Router B kemudian dikonfigurasi dengan rute balik menuju jaringan 192.168.10.0/24 melalui next-hop 10.10.10.1. Jalur balik diperlukan karena paket balasan dari host tujuan harus memiliki rute menuju jaringan asal. Entri pada tabel routing Router B menunjukkan jaringan 192.168.10.0/24 menggunakan gateway 10.10.10.1. Setelah kedua arah tersedia, alamat IP host dan default gateway dicocokkan kembali dengan tabel pengalamatan pada modul sebelum perintah ping dijalankan.',
  },
  {
    type: 'output',
    title: '2. Analisis Output',
    content: 'Pengujian ping dari host jaringan 192.168.10.0/24 menuju host 192.168.20.0/24 menghasilkan balasan pada bukti yang diunggah. Paket diteruskan Router A melalui next-hop 10.10.10.2, diterima jaringan tujuan, lalu balasannya kembali melalui rute 192.168.10.0/24 pada Router B. Hasil tersebut menunjukkan bahwa rute maju dan rute balik telah tersedia. Tidak adanya pesan timeout pada output yang didokumentasikan juga menunjukkan default gateway host dan hubungan antarmuka antarrouter sesuai dengan topologi praktikum.',
  },
];
assert.deepEqual(reportSectionIssues(concreteSections), []);
assert.ok(reportSectionIssues([{ title: 'Kesimpulan', content: 'Secara keseluruhan, praktikum berjalan baik.' }]).length > 0);
assert.equal(reportParameterIssues(concreteSections, [{ label: 'IP router', value: '192.168.78.1/27', isRequired: true }]).length, 1);

const documentReadiness = assessDocumentGenerationReadiness({
  document: {
    title: 'Praktikum Static Routing Dua Jaringan',
    course_name: 'Jaringan Komputer',
    module_title: 'Static Routing',
    recipe_json: JSON.stringify({ instructions: taskMessage }),
  },
  user: completeUser,
  files: [{ category: 'module' }, { category: 'evidence' }],
  mappings: [{ file_id: 'evidence-1' }],
  sections: concreteSections,
});
assert.equal(documentReadiness.canGenerate, true);
assert.equal(documentReadiness.canExport, true);
const noFileDocumentReadiness = assessDocumentGenerationReadiness({
  document: {
    title: 'Praktikum Static Routing Dua Jaringan',
    course_name: 'Jaringan Komputer',
    module_title: 'Static Routing',
    recipe_json: JSON.stringify({
      instructions: directBrief,
      sourceMode: 'unavailable',
      evidenceMode: 'unavailable',
    }),
  },
  user: completeUser,
  files: [],
  mappings: [],
  sections: concreteSections,
});
assert.equal(noFileDocumentReadiness.canGenerate, true);
assert.equal(noFileDocumentReadiness.canExport, true);
const camelCaseIdentity = assessDocumentGenerationReadiness({
  document: {
    title: 'Praktikum Static Routing Dua Jaringan',
    course_name: 'Jaringan Komputer',
    module_title: 'Static Routing',
    recipe_json: JSON.stringify({ instructions: taskMessage }),
  },
  user: { fullName: 'Asep Saputra', nim: '2300001', className: 'TI-2A', departmentKey: 'jkb', studyProgramKey: 'ti' },
  files: [{ category: 'module' }, { category: 'evidence' }],
  mappings: [{ file_id: 'evidence-1' }],
  sections: concreteSections,
});
assert.equal(camelCaseIdentity.canExport, true);
assert.equal(LAPRAK_REPORT_PROFILE.textColor, '000000');
assert.equal(LAPRAK_REPORT_PROFILE.bodyFont, 'Times New Roman');

console.log('Chat workflow and report quality contract passed.');
