import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { privateBlobName } from '../src/azure-blob.js';
import { opaqueStorageName } from '../src/utils.js';

test('storage names are opaque and preserve only a safe extension', () => {
  const originalName = 'NIM-123456 - Bukti Rahasia.PDF';
  const localName = opaqueStorageName(originalName);
  const blobName = privateBlobName({
    ownerUserId: 'student@example.test',
    resourceId: 'document-sensitive-title',
    originalName,
  });

  assert.match(localName, /^[0-9a-f-]{36}\.pdf$/);
  assert.doesNotMatch(localName, /NIM|123456|Bukti|Rahasia/i);
  assert.match(blobName, /^users\/[a-f0-9]{32}\/[a-f0-9]{32}\/[0-9a-f-]{36}\.pdf$/);
  assert.doesNotMatch(blobName, /student|document|NIM|123456|Bukti|Rahasia/i);
});

test('Azure adapter enforces private access and never returns a permanent blob URL', async () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const source = await readFile(path.join(root, 'server/src/azure-blob.js'), 'utf8');
  assert.match(source, /createIfNotExists\(\)/);
  assert.match(source, /setAccessPolicy\(undefined, currentPolicy\.signedIdentifiers\)/);
  assert.doesNotMatch(source, /return\s+blockBlobClient\.url/);
});
