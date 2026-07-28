import assert from 'node:assert/strict';
import test from 'node:test';
import { isCodeOnlyChatRequest } from '../src/services.js';

test('permintaan solusi code tetap dijawab di chat', () => {
  assert.equal(isCodeOnlyChatRequest('Tolong kerjain dalam bentuk code aja!'), true);
  assert.equal(isCodeOnlyChatRequest('Bikinin kode SQL untuk trigger ini'), true);
  assert.equal(isCodeOnlyChatRequest('Tulis code Python-nya'), true);
  assert.equal(isCodeOnlyChatRequest('Code aja, tidak perlu dokumen'), true);
});

test('pembahasan konsep code tidak otomatis menjadi permintaan code-only', () => {
  assert.equal(isCodeOnlyChatRequest('Jelaskan fungsi source code pada modul ini'), false);
  assert.equal(isCodeOnlyChatRequest('Buat laporan praktikum pemrograman'), false);
});
