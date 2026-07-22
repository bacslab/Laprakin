import assert from 'node:assert/strict';
import {
  assessChatReadiness,
  assessDocumentGenerationReadiness,
  LAPRAK_REPORT_PROFILE,
  reportParameterIssues,
  reportSectionIssues,
  vaguePromptReply,
} from '../server/src/report-quality.js';

const completeUser = {
  full_name: 'Asep Saputra',
  nim: '2300001',
  class_name: 'TI-2A',
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

const taskMessage = 'Saya mengerjakan praktikum static routing pada mata kuliah Jaringan Komputer. Dosen meminta urutan konfigurasi router, command yang dipakai, dan analisis hasil ping antarjaringan berdasarkan modul.';
const collectingWorkflow = assessChatReadiness({
  session: emptySession,
  user: completeUser,
  messages: [{ role: 'user', content: taskMessage }],
  attachments: [{ kind: 'module' }],
});
assert.equal(collectingWorkflow.canCreateDocument, true);
assert.equal(collectingWorkflow.canGenerateDraft, false);
assert.equal(collectingWorkflow.stage, 'evidence');

const readyWorkflow = assessChatReadiness({
  session: emptySession,
  user: completeUser,
  messages: [{ role: 'user', content: taskMessage }],
  attachments: [{ kind: 'module' }, { kind: 'evidence' }],
});
assert.equal(readyWorkflow.stage, 'ready');
assert.equal(readyWorkflow.canGenerateDraft, true);

const concreteSections = [
  {
    title: '1. Analisis Implementasi',
    content: 'Konfigurasi static routing dilakukan pada Router A dengan menambahkan rute menuju jaringan 192.168.20.0/24 melalui next-hop 10.10.10.2. Setelah perintah disimpan, tabel routing diperiksa untuk memastikan entri tujuan dan gateway muncul sesuai topologi pada modul.',
  },
  {
    title: '2. Analisis Output',
    content: 'Pengujian ping dari host jaringan 192.168.10.0/24 menuju host 192.168.20.0/24 menghasilkan balasan pada bukti yang diunggah. Hasil tersebut menunjukkan Router A meneruskan paket melalui next-hop yang dikonfigurasi dan jalur balik telah tersedia pada router tujuan.',
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
const camelCaseIdentity = assessDocumentGenerationReadiness({
  document: {
    title: 'Praktikum Static Routing Dua Jaringan',
    course_name: 'Jaringan Komputer',
    module_title: 'Static Routing',
    recipe_json: JSON.stringify({ instructions: taskMessage }),
  },
  user: { fullName: 'Asep Saputra', nim: '2300001', className: 'TI-2A', studyProgramKey: 'ti' },
  files: [{ category: 'module' }, { category: 'evidence' }],
  mappings: [{ file_id: 'evidence-1' }],
  sections: concreteSections,
});
assert.equal(camelCaseIdentity.canExport, true);
assert.equal(LAPRAK_REPORT_PROFILE.textColor, '000000');
assert.equal(LAPRAK_REPORT_PROFILE.bodyFont, 'Times New Roman');

console.log('Chat workflow and report quality contract passed.');
