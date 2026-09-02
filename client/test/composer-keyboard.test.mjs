import assert from 'node:assert/strict';
import test from 'node:test';

test('composer keyboard behavior follows the preference and never submits during composition', async () => {
  const { shouldSubmitComposerKey } = await import('../src/lib/composer-keyboard.js');
  const cases = [
    [{ key: 'Enter', enterToSend: true }, true],
    [{ key: 'Enter', shiftKey: true, enterToSend: true }, false],
    [{ key: 'Enter', enterToSend: false }, false],
    [{ key: 'Enter', ctrlKey: true, enterToSend: false }, true],
    [{ key: 'Enter', metaKey: true, enterToSend: false }, true],
    [{ key: 'Enter', ctrlKey: true, isComposing: true, enterToSend: false }, false],
    [{ key: 'a', ctrlKey: true, enterToSend: false }, false],
  ];
  for (const [input, expected] of cases) assert.equal(shouldSubmitComposerKey(input), expected, JSON.stringify(input));
});
