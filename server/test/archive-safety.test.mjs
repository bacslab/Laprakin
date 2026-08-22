import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import AdmZip from 'adm-zip';

import {
  ARCHIVE_LIMITS,
  ArchiveSafetyError,
  openSafeZip,
  validateArchiveEntries,
} from '../src/archive-safety.js';
import { defaultLaprakTemplatePath } from '../src/docx-template.js';
import { extractText, PDFTOTEXT_OPTIONS } from '../src/services.js';

function entry(entryName, {
  size = 10,
  compressedSize = 10,
  flags = 0,
  isDirectory = false,
} = {}) {
  return { entryName, isDirectory, header: { size, compressedSize, flags } };
}

function rejectsArchive(action, reason) {
  assert.throws(action, (error) => error instanceof ArchiveSafetyError && error.code === 'ARCHIVE_UNSAFE' && error.reason === reason);
}

test('normal ZIP archive is accepted without extracting its entries during validation', () => {
  const zip = new AdmZip();
  zip.addFile('word/document.xml', Buffer.from('<w:document/>'));
  zip.addFile('word/media/image.png', Buffer.from('image'));
  assert.equal(openSafeZip(zip.toBuffer()).getEntries().length, 2);
});

test('normal DOCX and XLSX files still pass validation and text extraction', async () => {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'laprakin-archive-test-'));
  const xlsxPath = path.join(tempDirectory, 'normal.xlsx');
  const xlsx = new AdmZip();
  xlsx.addFile('xl/sharedStrings.xml', Buffer.from('<sst><si><t>Halo</t></si></sst>'));
  xlsx.addFile('xl/worksheets/sheet1.xml', Buffer.from('<worksheet><sheetData><row><c t="s"><v>0</v></c></row></sheetData></worksheet>'));
  await fs.writeFile(xlsxPath, xlsx.toBuffer());
  try {
    const docxText = await extractText({ original_name: 'template.docx', storage_path: defaultLaprakTemplatePath });
    const xlsxText = await extractText({ original_name: 'normal.xlsx', storage_path: xlsxPath });
    assert.ok(docxText.trim().length > 0);
    assert.match(xlsxText, /Halo/);
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
});

test('archive safety rejects traversal, absolute, and encrypted entries', () => {
  rejectsArchive(() => validateArchiveEntries([entry('../document.xml')]), 'path');
  rejectsArchive(() => validateArchiveEntries([entry('/document.xml')]), 'path');
  rejectsArchive(() => validateArchiveEntries([entry('C:/document.xml')]), 'path');
  rejectsArchive(() => validateArchiveEntries([entry('document.xml', { flags: 1 })]), 'encrypted');
});

test('archive safety enforces entry count, entry size, XML size, and total size limits', () => {
  rejectsArchive(() => validateArchiveEntries(Array.from({ length: ARCHIVE_LIMITS.maxEntries + 1 }, (_, index) => entry(`file-${index}.bin`))), 'entry_count');
  rejectsArchive(() => validateArchiveEntries([entry('word/media/large.png', { size: ARCHIVE_LIMITS.maxEntryUncompressedBytes + 1, compressedSize: ARCHIVE_LIMITS.maxEntryUncompressedBytes + 1 })]), 'entry_size');
  rejectsArchive(() => validateArchiveEntries([entry('word/document.xml', { size: ARCHIVE_LIMITS.maxXmlEntryUncompressedBytes + 1, compressedSize: ARCHIVE_LIMITS.maxXmlEntryUncompressedBytes + 1 })]), 'xml_size');
  rejectsArchive(() => validateArchiveEntries(Array.from({ length: 7 }, (_, index) => entry(`file-${index}.bin`, {
    size: ARCHIVE_LIMITS.maxEntryUncompressedBytes,
    compressedSize: ARCHIVE_LIMITS.maxEntryUncompressedBytes,
  }))), 'total_size');
});

test('archive safety rejects extreme compression ratios and invalid sizes', () => {
  rejectsArchive(() => validateArchiveEntries([entry('xl/sharedStrings.xml', { size: 101, compressedSize: 1 })]), 'compression_ratio');
  rejectsArchive(() => validateArchiveEntries([entry('xl/sharedStrings.xml', { size: 1, compressedSize: 0 })]), 'compression_ratio');
  rejectsArchive(() => validateArchiveEntries([entry('xl/sharedStrings.xml', { size: -1, compressedSize: 1 })]), 'invalid_size');
});

test('pdftotext has a bounded runtime and output buffer', () => {
  assert.equal(PDFTOTEXT_OPTIONS.timeout, 15_000);
  assert.equal(PDFTOTEXT_OPTIONS.killSignal, 'SIGKILL');
  assert.equal(PDFTOTEXT_OPTIONS.maxBuffer, 8 * 1024 * 1024);
});
