export function inferPendingAttachmentKind(file) {
  const name = String(file?.name || '').toLocaleLowerCase('id-ID');
  const extension = name.split('.').pop() || '';
  if (file?.type?.startsWith('image/') || /\b(ss|screenshot|capture|hasil|bukti|dokumentasi|foto)\b/.test(name)) return 'practice_evidence';
  if (/\b(template|format|contoh[\s_-]*(laporan|laprak))\b/.test(name)) return 'template';
  if (/\b(instruksi|ketentuan|rubrik|tugas)\b/.test(name)) return 'instruction';
  if (/\b(modul|materi|panduan|praktikum)\b/.test(name) || extension === 'pdf') return 'module';
  if (['docx', 'txt', 'md', 'csv', 'xlsx'].includes(extension)) return 'supporting_document';
  return 'unknown';
}
