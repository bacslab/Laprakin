import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { Document, Packer, Paragraph } from 'docx';
import mammoth from 'mammoth';
import {
  defaultLaprakTemplatePath,
  inspectTemplateDocxBuffer,
  mergeReportWithTemplate,
} from '../server/src/docx-template.js';

const templateBuffer = fs.readFileSync(defaultLaprakTemplatePath);
const originalHash = crypto.createHash('sha256').update(templateBuffer).digest('hex');
const templateZip = new AdmZip(templateBuffer);
const templateXml = templateZip.readAsText('word/document.xml');
const evidence = inspectTemplateDocxBuffer(templateBuffer);
assert.equal(evidence.coverBoundary, 18);
assert.equal(evidence.hasCoverImage, true);
assert.ok(evidence.bodyHeadings.includes('1. Penamaan Interface'));

const reportBuffer = await Packer.toBuffer(new Document({
  sections: [{
    children: [
      new Paragraph('Langkah Latihan Soal Praktikum'),
      new Paragraph('1. Konfigurasi Layanan'),
      new Paragraph('Konfigurasi dilakukan berdasarkan bahan praktikum yang terverifikasi.'),
    ],
  }],
}));

const outputBuffer = mergeReportWithTemplate({
  reportBuffer,
  templateBuffer,
  slots: {
    courseName: 'Keamanan Jaringan',
    moduleTitle: 'Modul 5 - Pengujian',
    lecturerName: 'Dosen Penguji',
    lecturerNip: '1234567890',
    fullName: 'Mahasiswa Uji',
    studentId: '240000001',
    className: 'TI 2C',
    studyProgram: 'D3 TEKNIK INFORMATIKA',
    department: 'JURUSAN KOMPUTER DAN BISNIS',
    academicYear: '2026/2027',
  },
});

assert.equal(crypto.createHash('sha256').update(fs.readFileSync(defaultLaprakTemplatePath)).digest('hex'), originalHash);
const outputZip = new AdmZip(outputBuffer);
const outputXml = outputZip.readAsText('word/document.xml');
const outputRels = outputZip.readAsText('word/_rels/document.xml.rels');
const sourceAnchor = templateXml.match(/<wp:anchor\b[\s\S]*?<\/wp:anchor>/)?.[0];
const outputAnchor = outputXml.match(/<wp:anchor\b[\s\S]*?<\/wp:anchor>/)?.[0];
const centeredSourceAnchor = sourceAnchor?.replace(
  /<wp:positionH\b[^>]*>[\s\S]*?<\/wp:positionH>/,
  '<wp:positionH relativeFrom="page"><wp:align>center</wp:align></wp:positionH>',
);
const sourceSection = templateXml.match(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/)?.[0];
const outputSection = outputXml.match(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/)?.[0];
assert.match(outputXml, /KEAMANAN JARINGAN/);
assert.match(outputXml, /Modul 5 - Pengujian/);
assert.match(outputXml, /Mahasiswa Uji/);
assert.match(outputXml, /r:embed="rId6"/);
assert.match(outputRels, /Id="rId6"[^>]+Target="media\/image1.png"/);
assert.ok(outputZip.getEntry('word/media/image1.png'));
assert.equal((outputXml.match(/<wp:anchor\b/g) || []).length, 1);
assert.equal(outputAnchor, centeredSourceAnchor, 'Ukuran dan posisi vertikal logo harus tetap, dengan posisi horizontal di tengah halaman.');
assert.equal(outputSection, sourceSection, 'Ukuran halaman, margin, header, dan footer harus tetap persis.');
for (const entryName of [
  'word/media/image1.png',
  'word/header1.xml',
  'word/footer1.xml',
  'word/styles.xml',
  'word/settings.xml',
  'word/theme/theme1.xml',
]) {
  assert.deepEqual(
    outputZip.readFile(entryName),
    templateZip.readFile(entryName),
    `${entryName} tidak boleh berubah.`,
  );
}

const outputPath = path.resolve('.tmp/template-audit/template-contract.docx');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, outputBuffer);
const text = (await mammoth.extractRawText({ buffer: outputBuffer })).value;
assert.match(text, /Konfigurasi dilakukan berdasarkan bahan praktikum/);
assert.doesNotMatch(text, /Identitas Praktikum/i);
assert.doesNotMatch(text, /Hilmi Mubarok/);

console.log(`Template DOCX contract passed: cover source preserved, dynamic slots patched, body identity removed. Output: ${outputPath}`);
