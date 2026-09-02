import assert from 'node:assert/strict';
import test from 'node:test';

test('AI consent data classes are deduplicated and translated for people', async () => {
  const { localizeAiDataClasses } = await import('../src/lib/ai-consent-labels.js');
  const t = (key) => ({
    'workspace.composer.dataClasses.chat_content': 'isi percakapan',
    'workspace.composer.dataClasses.document_draft': 'draf dokumen',
  })[key] || key;

  assert.deepEqual(localizeAiDataClasses(['chat_content', 'chat_content', 'document_draft'], t), [
    'isi percakapan',
    'draf dokumen',
  ]);
  assert.deepEqual(localizeAiDataClasses(['future_data_class'], t), ['future data class']);
});
