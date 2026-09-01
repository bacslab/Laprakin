import assert from 'node:assert/strict';
import test from 'node:test';

import { readStructuredTextField } from '../src/chat-stream.js';

test('readStructuredTextField decodes a progressively received JSON message', () => {
  assert.equal(readStructuredTextField('{"action":"RESPOND","message":"La', 'message'), 'La');
  assert.equal(readStructuredTextField('{"message":"Baris 1\\nBaris 2"}', 'message'), 'Baris 1\nBaris 2');
  assert.equal(readStructuredTextField('{"message":"Kata \\"aman\\""}', 'message'), 'Kata "aman"');
});

