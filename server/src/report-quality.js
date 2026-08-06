const GENERIC_CHAT_TITLES = /^(?:laprak baru|chat baru|untitled|asep)$/i;
const ACADEMIC_SIGNAL = /\b(?:praktikum|laprak|laporan|modul|mata kuliah|konfigurasi|implementasi|percobaan|pengujian|analisis|tugas|dashboard|program|database|jaringan|router|framework|mobile|hasil|output)\b/i;
const INSTRUCTION_SIGNAL = /\b(?:tujuan|instruksi|ketentuan|langkah|prosedur|konfigurasi|implementasi|diminta|analisis|uji|pengujian|format|struktur)\b/i;
const EVIDENCE_SIGNAL = /(?:\b(?:hasil|output|pengujian|ping|nilai|log|tabel)\b.{0,100}\b(?:menunjukkan|menghasilkan|berhasil|gagal|reply|timeout|terlihat|muncul|tercatat|sebesar)\b|\b(?:berhasil|gagal|reply|timeout|terlihat|muncul|tercatat)\b.{0,100}\b(?:hasil|output|pengujian|ping|nilai|log|tabel)\b)/i;
const SOURCE_UNAVAILABLE_SIGNAL = /\b(?:tidak|nggak|gak|ga|belum)\s+(?:punya|ada|memiliki)\s+(?:modul|dokumen|file|bahan|instruksi|panduan)\b|\b(?:modul|dokumen|file|bahan|instruksi|panduan)\s+(?:tidak|nggak|gak|ga|belum)\s+(?:ada|tersedia)\b/i;
const EVIDENCE_UNAVAILABLE_SIGNAL = /\b(?:tidak|nggak|gak|ga|belum)\s+(?:punya|ada|memiliki)\s+(?:hasil|output|screenshot|foto|bukti|log|data)\b|\b(?:hasil|output|screenshot|foto|bukti|log|data)\s+(?:tidak|nggak|gak|ga|belum)\s+(?:ada|tersedia)\b/i;
const SHORT_NEGATIVE_SIGNAL = /^(?:tidak|nggak|gak|ga)(?:\s+(?:ada|punya))?[.!]*$/i;
const COURSE_PATTERNS = [
  /\b(?:mata\s*kuliah|matkul|mk)\s*(?:[:=-]\s*|\s+)([^,.;\n]+?)(?=\s+(?:(?:untuk|dengan|dan)\s+)?(?:materi|modul|topik|judul|tentang)\b|[,.;\n]|$)/i,
  /\b(?:untuk|pada)\s+(?:mata\s*kuliah|matkul|mk)\s*(?:[:=-]\s*|\s+)([^,.;\n]+?)(?=\s+(?:(?:untuk|dengan|dan)\s+)?(?:materi|modul|topik|judul|tentang)\b|[,.;\n]|$)/i,
];
const MODULE_PATTERNS = [
  /\b(?:materi|modul|topik)\s*(?:[:=-]\s*|\s+)([^,.;\n]+?)(?=\s+berdasarkan\b|\s+(?:untuk|pada)\s+(?:mata\s*kuliah|matkul|mk)\b|\s+dan\s+(?:hasil|bahan|output|format|struktur|screenshot|data)\b|[,.;\n]|$)/i,
  /\b(?:praktikum|laprak|laporan\s+praktikum)\s+(?:tentang|mengenai)\s+([^,.;\n]+?)(?=\s+(?:untuk|pada|dengan|yang)\b|[,.;\n]|$)/i,
];
const GENERIC_CONTEXT_VALUES = /^(?:laprak|laporan|laporan praktikum|praktikum|tugas|materi|modul|topik|nama mata kuliah|topik praktikum|nama topik)$/i;
const GENERIC_REQUEST_SIGNAL = /^(?:tolong\s+)?(?:bantu|buat|buatkan|susun|kerjakan)(?:kan)?(?:\s+saya)?(?:\s+(?:tugas|laprak|laporan|draft))?[.!]*$/i;
const GENERATION_INTENT_SIGNAL = /\b(?:buatkan|buat|susun|kerjakan|hasilkan|generate)\b.{0,80}\b(?:laprak|laporan|draft|tugas)\b|\b(?:laprak|laporan|draft)\b.{0,80}\b(?:buatkan|buat|susun|kerjakan|hasilkan|generate)\b/i;
const CONVERSATIONAL_CONTEXT_SIGNAL = /^(?:(?:di\s+)?mana|mana(?:nya)?|halo|hai|hello|woi|hei|kok|kenapa|gimana|bagaimana|kapan|sudah|udah|belum|lanjut|gas|oke|ok|iya|ya|y|tidak|nggak|gak|ga|terserah|coba|tolong|bantu|buat(?:kan)?|kerjakan|jawab|respon|respons|cek)(?:\s+(?:nih|dong|sih|ya|lagi|sekarang|dulu|aja|saja|belum|sudah|udah|kok|kak|min|bang))*[?!.]*$/i;

export const CHAT_WORKFLOW_STATES = Object.freeze([
  'NEW_CHAT',
  'FIRST_USE_GUIDANCE',
  'ANALYZING_INPUT',
  'SOURCE_RECOMMENDED',
  'WAITING_SOURCE_DECISION',
  'CLARIFICATION_REQUIRED',
  'READY_TO_GENERATE',
  'GENERATING',
  'DOCUMENT_PREVIEW',
  'REVISION',
  'FINAL',
  'QUIZ_REQUIRED',
  'EXPORT_UNLOCKED',
]);

export const CHAT_SOURCE_STATES = Object.freeze(['UNKNOWN', 'AVAILABLE', 'UPLOADED', 'NOT_AVAILABLE', 'SKIPPED']);

export function defaultChatSourceStatus(value = {}) {
  const allowed = new Set(CHAT_SOURCE_STATES);
  const state = typeof value === 'string' ? parseJson(value, {}) : value || {};
  const read = (key) => allowed.has(state[key]) ? state[key] : 'UNKNOWN';
  return {
    module: read('module'),
    instruction: read('instruction'),
    practiceEvidence: read('practiceEvidence'),
    template: read('template'),
    supportingDocument: read('supportingDocument'),
  };
}

function attachmentSourceKey(kind = '') {
  const normalized = String(kind || '').toLowerCase();
  if (normalized === 'module') return 'module';
  if (normalized === 'instruction') return 'instruction';
  if (['practice_evidence', 'evidence'].includes(normalized)) return 'practiceEvidence';
  if (normalized === 'template') return 'template';
  if (['supporting_document', 'data'].includes(normalized)) return 'supportingDocument';
  return '';
}

export function inferDocumentType(content = '') {
  const clean = String(content || '');
  if (/\bproposal\b/i.test(clean)) return 'proposal';
  if (/\bmakalah\b/i.test(clean)) return 'paper';
  if (/\b(?:jurnal|artikel ilmiah)\b/i.test(clean)) return 'journal';
  if (/\b(?:tugas akhir|skripsi)\b/i.test(clean)) return 'final_project';
  if (/\b(?:laprak|laporan praktikum|praktikum)\b/i.test(clean)) return 'lab_report';
  return 'unknown';
}

export function generateChatTitle({ documentType = 'lab_report', courseName = '', practiceTopic = '' } = {}) {
  const course = normalizeContextValue(courseName);
  const topic = normalizeContextValue(practiceTopic);
  if (!course && !topic) return '';
  // Room chat dinamai dari materi yang pengguna isi. Jenis dokumen dan mata
  // kuliah sudah punya tempat sendiri sehingga judul tidak perlu mengulangnya.
  return (topic || course).replace(/\s+/g, ' ').trim().slice(0, 100);
}

export function analyzeChatRequest({ session = {}, messages = [], attachments = [] }) {
  const storedConfig = parseJson(session.configuration_json, session.configuration || {});
  const { configuration } = inferChatContext({ messages, configuration: storedConfig });
  const userMessages = messages
    .filter((message) => !message?.role || message.role === 'user')
    .map((message) => String(message?.content || message || '').trim())
    .filter(Boolean);
  const combined = userMessages.join('\n');
  const courseName = normalizeContextValue(configuration.courseName || session.course_name || '');
  const practiceTopic = normalizeContextValue(configuration.moduleTitle || session.practice_topic || '');
  const inferredDocumentType = inferDocumentType(combined);
  const documentType = inferredDocumentType === 'unknown' && attachments.length
    ? String(session.document_type || 'lab_report')
    : inferredDocumentType;
  const sourceStatus = defaultChatSourceStatus(session.source_status_json || session.sourceStatus);
  Object.keys(sourceStatus).forEach((key) => {
    if (sourceStatus[key] === 'UPLOADED') sourceStatus[key] = 'UNKNOWN';
  });

  attachments.forEach((attachment) => {
    const key = attachmentSourceKey(attachment.kind || attachment.category);
    if (key) sourceStatus[key] = 'UPLOADED';
  });

  if (SOURCE_UNAVAILABLE_SIGNAL.test(combined)) {
    if (sourceStatus.module === 'UNKNOWN') sourceStatus.module = 'NOT_AVAILABLE';
    if (sourceStatus.instruction === 'UNKNOWN') sourceStatus.instruction = 'NOT_AVAILABLE';
    if (sourceStatus.template === 'UNKNOWN') sourceStatus.template = 'NOT_AVAILABLE';
    if (sourceStatus.supportingDocument === 'UNKNOWN') sourceStatus.supportingDocument = 'NOT_AVAILABLE';
  }
  if (EVIDENCE_UNAVAILABLE_SIGNAL.test(combined) && sourceStatus.practiceEvidence === 'UNKNOWN') {
    sourceStatus.practiceEvidence = 'NOT_AVAILABLE';
  }

  const lastUserMessage = userMessages.at(-1) || '';
  const missingCriticalContext = !courseName && !practiceTopic
    ? 'course_and_topic'
    : !courseName
      ? 'course_name'
      : !practiceTopic
        ? 'practice_topic'
        : '';

  const knownParts = [
    courseName ? `mata kuliah ${courseName}` : '',
    practiceTopic ? `topik ${practiceTopic}` : '',
  ].filter(Boolean);

  return {
    documentType: documentType === 'unknown' ? 'lab_report' : documentType,
    detectedDocumentType: documentType,
    courseName,
    practiceTopic,
    configuration: {
      ...configuration,
      courseName,
      moduleTitle: practiceTopic,
    },
    sourceStatus,
    contextSummary: knownParts.length ? knownParts.join(', ') : 'Konteks utama belum disebutkan.',
    missingCriticalContext,
    contextStatus: missingCriticalContext ? 'needs_clarification' : 'sufficient',
    hasAttachments: attachments.length > 0,
    hasGenerationIntent: GENERATION_INTENT_SIGNAL.test(combined),
    isGenericRequest: GENERIC_REQUEST_SIGNAL.test(lastUserMessage),
  };
}

export const LAPRAK_REPORT_PROFILE = Object.freeze({
  page: 'A4 portrait',
  marginsCm: { top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 },
  bodyFont: 'Times New Roman',
  bodySizePt: 12,
  textColor: '000000',
  lineSpacing: 1.5,
  coverTitlePt: 21,
  sectionHeadingPt: 14,
  captionSizePt: 10.5,
});

export const LAPRAK_WRITING_RULES = `Profil penulisan Laprakin yang disarikan dari laporan praktikum Semester 4:
- Cover wajib memuat judul laporan, mata kuliah, modul/topik, nama, NPM/NIM, kelas, program studi, jurusan/fakultas, institusi, dan tahun akademik yang tersedia.
- Identitas hanya boleh muncul pada cover. Jangan membuat bagian "Identitas Praktikum" atau mengulang biodata mahasiswa di isi laporan.
- Gunakan hierarki bernomor: 1. Analisis Implementasi, 1.1 langkah teknis, 2. Analisis Output, lalu Kesimpulan hanya bila diminta.
- Pecah pembahasan menjadi sedikitnya tiga bagian substantif yang mengikuti urutan praktik, bukan tiga paragraf generik.
- Setiap langkah membahas tindakan yang benar-benar dilakukan, parameter atau command yang dipakai, alasan teknis, dan hasil yang terlihat.
- Analisis output wajib menyebut nilai, status, pesan, perubahan tampilan, atau artefak konkret yang memang terlihat pada bukti.
- Setiap bukti visual wajib memiliki caption spesifik "Gambar N. ..." dan penjelasan faktual setelah gambar yang menerangkan tampilan, arti teknis, serta kaitannya dengan langkah atau hasil.
- Gunakan paragraf Bahasa Indonesia yang lugas dan dapat diaudit terhadap modul, chat, atau bukti user.
- Jangan menulis kalimat pengisi seperti "Bagian ini menjelaskan", "ditujukan untuk memaparkan", atau "analisis lebih lanjut diperlukan".
- Jangan membuat pendahuluan, kesimpulan, angka, hasil, command, atau referensi bila bahan user tidak membuktikannya.
- Hindari tiga paragraf dengan pola pembuka dan panjang yang sama. Gunakan istilah teknis dari bahan user secara konsisten.
- Seluruh teks dokumen menggunakan warna hitam dan gaya akademik formal; jangan memakai heading biru atau dekorasi ala template AI.`;

export const AI_SLOP_PATTERNS = [
  /\bbagian ini (?:menjelaskan|ditujukan|bertujuan)\b/i,
  /\bpada era (?:digital|modern)\b/i,
  /\bsecara keseluruhan\b/i,
  /\bdapat disimpulkan bahwa\b/i,
  /\banalisis lebih lanjut diperlukan\b/i,
  /\bmemegang peranan penting\b/i,
  /\bmemberikan wawasan yang (?:mendalam|berharga)\b/i,
  /\btidak hanya .{0,80} tetapi juga\b/i,
  /\b(?:tidak dapat|tidak bisa) (?:dijabarkan|dijelaskan|dicantumkan).{0,120}\b(?:keterbatasan|tidak adanya|belum tersedia)\b/i,
  /\bkarena (?:keterbatasan data|tidak adanya (?:data|parameter|informasi|log|bukti))\b/i,
];

function parseJson(value, fallback = {}) {
  try { return JSON.parse(value || '') || fallback; } catch { return fallback; }
}

function words(value = '') {
  return String(value).toLowerCase().match(/[a-z0-9][a-z0-9._/-]*/gi) || [];
}

function meaningfulTitle(value = '') {
  const title = String(value || '').trim();
  return title.length >= 6 && !GENERIC_CHAT_TITLES.test(title);
}

function normalizeContextValue(value = '') {
  const normalized = String(value)
    .replace(/^[\s"'“”‘’()[\]{}:=-]+|[\s"'“”‘’()[\]{}:=-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
  return normalized && !GENERIC_CONTEXT_VALUES.test(normalized) ? normalized : '';
}

export function isPlausibleAcademicContext(value = '') {
  const normalized = normalizeContextValue(value);
  if (!normalized || CONVERSATIONAL_CONTEXT_SIGNAL.test(normalized)) return false;
  if (/^(?:apa|siapa|kenapa|mengapa|bagaimana|gimana|kapan|dimana|di mana)\b/i.test(normalized)) return false;
  return /[\p{L}\p{N}]/u.test(normalized);
}

function firstContextMatch(content, patterns) {
  for (const pattern of patterns) {
    const match = String(content || '').match(pattern);
    const value = normalizeContextValue(match?.[1]);
    if (value) return value;
  }
  return '';
}

export function inferChatContext({ messages = [], configuration = {} }) {
  const initial = typeof configuration === 'string' ? parseJson(configuration, {}) : { ...(configuration || {}) };
  const next = { ...initial };
  const extracted = {};

  for (const message of messages) {
    if (message?.role && message.role !== 'user') continue;
    const content = String(message?.content || message || '').trim();
    if (!content) continue;
    const courseName = firstContextMatch(content, COURSE_PATTERNS);
    const moduleTitle = firstContextMatch(content, MODULE_PATTERNS);
    if (courseName && !normalizeContextValue(next.courseName)) {
      next.courseName = courseName;
      extracted.courseName = courseName;
    }
    if (moduleTitle && !normalizeContextValue(next.moduleTitle)) {
      next.moduleTitle = moduleTitle;
      extracted.moduleTitle = moduleTitle;
    }
  }

  return { configuration: next, extracted };
}

export function assessChatReadiness({ session, user, messages = [], attachments = [] }) {
  const storedConfig = parseJson(session?.configuration_json, session?.configuration || {});
  const { configuration: config } = inferChatContext({ messages, configuration: storedConfig });
  const userMessages = messages.filter((message) => !message.role || message.role === 'user').map((message) => String(message.content || '').trim()).filter(Boolean);
  const combined = userMessages.join('\n');
  const tokenCount = words(combined).length;
  const kinds = new Set(attachments.map((attachment) => attachment.kind));
  const hasSourceFile = ['module', 'instruction', 'template', 'data', 'supporting_document'].some((kind) => kinds.has(kind));
  const hasEvidenceFile = kinds.has('evidence') || kinds.has('practice_evidence');
  const storedSourceStatus = defaultChatSourceStatus(session?.source_status_json || session?.sourceStatus);
  let sourceUnavailable = SOURCE_UNAVAILABLE_SIGNAL.test(combined);
  let evidenceUnavailable = EVIDENCE_UNAVAILABLE_SIGNAL.test(combined);
  if (['NOT_AVAILABLE', 'SKIPPED'].includes(storedSourceStatus.module) || ['NOT_AVAILABLE', 'SKIPPED'].includes(storedSourceStatus.instruction)) {
    sourceUnavailable = true;
  }
  if (['NOT_AVAILABLE', 'SKIPPED'].includes(storedSourceStatus.practiceEvidence)) {
    evidenceUnavailable = true;
  }
  messages.forEach((message, index) => {
    if ((message?.role || 'user') !== 'user' || !SHORT_NEGATIVE_SIGNAL.test(String(message?.content || message || '').trim())) return;
    const previousAssistant = [...messages.slice(0, index)].reverse().find((item) => item?.role === 'assistant');
    const question = String(previousAssistant?.content || '');
    if (/\b(?:modul|dokumen|file|bahan|instruksi|panduan)\b/i.test(question)) sourceUnavailable = true;
    if (/\b(?:hasil|output|screenshot|foto|bukti|log|data)\b/i.test(question)) evidenceUnavailable = true;
  });
  const hasTask = Boolean(
    meaningfulTitle(config.moduleTitle)
    || (String(config.courseName || '').trim() && ACADEMIC_SIGNAL.test(combined))
    || (hasSourceFile && tokenCount >= 2)
    || (tokenCount >= 7 && ACADEMIC_SIGNAL.test(combined)),
  );
  const hasContext = Boolean(
    String(config.courseName || '').trim()
    || String(config.moduleTitle || '').trim()
    || hasSourceFile
    || (tokenCount >= 12 && /\b(?:mata kuliah|modul|praktikum|tugas)\b/i.test(combined)),
  );
  const hasInstructions = Boolean(
    hasSourceFile
    || (tokenCount >= 10 && INSTRUCTION_SIGNAL.test(combined)),
  );
  const hasEvidence = Boolean(
    hasEvidenceFile
    || (tokenCount >= 24 && EVIDENCE_SIGNAL.test(combined)),
  );
  const identityReady = Boolean(user?.full_name || user?.fullName) && Boolean(user?.nim);
  const known = {
    courseName: String(config.courseName || '').trim(),
    moduleTitle: String(config.moduleTitle || '').trim(),
  };
  const knownBrief = [
    known.courseName ? `mata kuliah ${known.courseName}` : '',
    known.moduleTitle ? `materi ${known.moduleTitle}` : '',
  ].filter(Boolean).join(' dan ');

  const sourceResolved = hasInstructions || sourceUnavailable;
  const evidenceResolved = hasEvidence || evidenceUnavailable;
  const sourceMode = hasSourceFile ? 'uploaded' : hasInstructions ? 'described' : sourceUnavailable ? 'unavailable' : 'missing';
  const evidenceMode = hasEvidenceFile ? 'uploaded' : hasEvidence ? 'described' : evidenceUnavailable ? 'unavailable' : 'missing';
  const items = [
    { key: 'task', label: 'Tujuan tugas jelas', ready: hasTask, detail: hasTask ? 'Topik dan pekerjaan utama sudah terbaca.' : 'Jelaskan praktikum atau tugas yang sedang dikerjakan.' },
    { key: 'context', label: 'Brief tertangkap', ready: hasContext, detail: hasContext ? (knownBrief ? `${knownBrief} sudah dicatat.` : 'Konteks tugas sudah terbaca dari pesan atau bahan.') : 'Sebutkan mata kuliah dan materi atau topiknya.' },
    { key: 'source', label: 'Acuan tugas', ready: sourceResolved, detail: hasInstructions ? 'Modul atau langkah kerja sudah tersedia.' : sourceUnavailable ? 'Tidak ada file acuan; struktur standar Laprakin akan dipakai.' : 'Unggah acuan bila ada, atau beri tahu jika memang tidak tersedia.' },
    { key: 'evidence', label: 'Keterangan hasil', ready: evidenceResolved, detail: hasEvidence ? 'Hasil praktik tersedia dari file atau cerita user.' : evidenceUnavailable ? 'Tidak ada bukti; hasil yang diharapkan harus ditandai untuk diverifikasi.' : 'Ceritakan hasil yang terlihat, atau beri tahu jika memang tidak tersedia.' },
    { key: 'identity', label: 'Identitas cover', ready: identityReady, detail: identityReady ? 'Nama dan NPM/NIM tersedia.' : 'Lengkapi nama dan NPM/NIM sebelum export.' },
  ];
  const canCreateDocument = hasTask && hasContext;
  const canGenerateDraft = canCreateDocument;
  const missing = items.filter((item) => !item.ready);
  const blockingMissing = missing.filter((item) => ['task', 'context'].includes(item.key));
  const stage = !hasTask ? 'intake' : !canCreateDocument ? 'collecting' : 'ready';
  const nextQuestion = !hasTask
    ? 'Praktikum atau tugas apa yang sedang kamu kerjakan, dan hasil akhirnya diminta seperti apa?'
    : !hasContext
      ? known.courseName
        ? `Mata kuliah ${known.courseName} sudah tercatat. Materi atau topik praktikumnya apa?`
        : known.moduleTitle
          ? `Materi ${known.moduleTitle} sudah tercatat. Ini untuk mata kuliah apa?`
          : 'Sebutkan mata kuliah dan materi atau topik praktikumnya.'
      : !identityReady
        ? 'Konteks tugas sudah cukup untuk mulai dikerjakan. Identitas cover dapat dilengkapi sebelum export.'
        : sourceUnavailable || evidenceUnavailable
          ? 'Konteks sudah cukup untuk draft awal. Bagian tanpa bukti akan ditandai agar dapat diverifikasi.'
          : 'Konteks sudah cukup untuk langsung dikerjakan.';

  return {
    stage,
    score: Math.round((items.filter((item) => item.ready).length / items.length) * 100),
    canCreateDocument,
    canGenerateDraft,
    items,
    missing: blockingMissing.map((item) => ({ key: item.key, label: item.label, detail: item.detail })),
    nextQuestion,
    known,
    sourceMode,
    evidenceMode,
  };
}

export function vaguePromptReply(content, workflow) {
  const clean = String(content || '').trim();
  const tokenCount = words(clean).length;
  if (workflow?.stage !== 'intake' || (tokenCount > 4 && ACADEMIC_SIGNAL.test(clean))) return '';
  return `Aku belum punya konteks yang cukup untuk memproses “${clean.slice(0, 60)}” sebagai laporan. ${workflow.nextQuestion}`;
}

export function guardKnownContextReply(content, workflow) {
  const clean = String(content || '').trim();
  const known = workflow?.known || {};
  const asksKnownCourse = Boolean(known.courseName) && (
    /\b(?:mata\s*kuliah|matkul|mk)(?:nya)?\b[^?.!\n]{0,60}\b(?:apa|mana|sebutkan)\b/i.test(clean)
    || /\b(?:apa|mana)\b[^?.!\n]{0,45}\b(?:mata\s*kuliah|matkul|mk)(?:nya)?\b/i.test(clean)
  );
  const asksKnownModule = Boolean(known.moduleTitle) && (
    /\b(?:materi|modul|topik)(?:nya)?\b[^?.!\n]{0,60}\b(?:apa|mana|sebutkan)\b/i.test(clean)
    || /\b(?:apa|mana)\b[^?.!\n]{0,45}\b(?:materi|modul|topik)(?:nya)?\b/i.test(clean)
  );
  return asksKnownCourse || asksKnownModule ? workflow.nextQuestion : clean;
}

export function reportSectionIssues(sections = []) {
  const issues = [];
  const normalizedSections = sections.map((section) => ({
    ...section,
    type: String(section.type || section.section_type || '').toLowerCase(),
    title: String(section.title || '').trim(),
    content: String(section.content || '').trim(),
  }));
  if (normalizedSections.length < 3) issues.push('Draft harus memiliki sedikitnya tiga bagian substantif.');
  if (!normalizedSections.some((section) => section.type === 'implementation')) {
    issues.push('Draft belum memiliki bagian implementasi.');
  }
  if (!normalizedSections.some((section) => section.type === 'output')) {
    issues.push('Draft belum memiliki bagian analisis output.');
  }
  const totalCharacters = normalizedSections.reduce((sum, section) => sum + section.content.length, 0);
  if (totalCharacters < 5000) issues.push('Pembahasan keseluruhan masih terlalu singkat untuk laporan praktikum utuh.');
  for (const [index, section] of normalizedSections.entries()) {
    const { content } = section;
    if (section.title.length < 5) issues.push(`Judul bagian ${index + 1} belum spesifik.`);
    if (/\bidentitas\s+(?:praktikum|praktikan|mahasiswa)\b/i.test(section.title)
      || /\b(?:nama|npm|nim|kelas|program studi|jurusan\/fakultas)\s*:/i.test(content)) {
      issues.push(`Bagian ${index + 1} mengulang identitas yang seharusnya hanya ada pada cover.`);
    }
    if (content.length < 450) issues.push(`Bagian ${index + 1} terlalu pendek untuk menjelaskan praktik secara konkret.`);
    if (content.includes('[PERLU DIISI USER]')) issues.push(`Bagian ${index + 1} masih memiliki data yang belum diisi.`);
    const matched = AI_SLOP_PATTERNS.find((pattern) => pattern.test(content));
    if (matched) issues.push(`Bagian ${index + 1} masih memakai kalimat generik.`);
  }
  return [...new Set(issues)];
}

export function reportParameterIssues(sections = [], parameters = []) {
  const content = sections.map((section) => String(section.content || '')).join('\n').toLowerCase();
  return parameters
    .filter((parameter) => parameter.isRequired || parameter.is_required)
    .filter((parameter) => {
      const value = String(parameter.value || '').trim().toLowerCase();
      return value.length >= 2 && !content.includes(value);
    })
    .map((parameter) => `Parameter wajib “${parameter.label}: ${parameter.value}” belum muncul di draft.`);
}

export function assessDocumentGenerationReadiness({ document, user, files = [], mappings = [], sections = [], parameters = [] }) {
  const recipe = parseJson(document?.recipe_json, document?.recipe || {});
  const titleReady = meaningfulTitle(document?.title);
  const contextReady = meaningfulTitle(document?.course_name) || meaningfulTitle(document?.module_title);
  const sourceReady = files.some((file) => ['module', 'instruction', 'template', 'data', 'supporting_document'].includes(file.category))
    || words(recipe.instructions || '').length >= 18
    || recipe.sourceMode === 'unavailable';
  const evidenceFiles = files.filter((file) => ['evidence', 'practice_evidence'].includes(file.category));
  const visualEvidenceFiles = evidenceFiles.filter((file) => String(file.mime_type || file.mimeType || '').startsWith('image/'));
  const evidenceReady = evidenceFiles.length > 0
    || EVIDENCE_SIGNAL.test(String(recipe.instructions || ''))
    || recipe.evidenceMode === 'unavailable';
  const mappingReady = visualEvidenceFiles.length === 0 || mappings.length >= visualEvidenceFiles.length;
  const identityReady = Boolean(
    (user?.full_name || user?.fullName)
    && user?.nim
    && (user?.class_name || user?.className)
    && (user?.institution_name || user?.institutionName)
    && (user?.institution_logo_url || user?.institutionLogoUrl)
    && (user?.faculty_name || user?.facultyName || user?.department_key || user?.departmentKey)
    && (user?.study_program_name || user?.studyProgramName || user?.study_program_key || user?.studyProgramKey),
  );
  const sectionIssues = [...reportSectionIssues(sections), ...reportParameterIssues(sections, parameters)];
  const checks = [
    { key: 'title', label: 'Judul tugas spesifik', ready: titleReady },
    { key: 'context', label: 'Mata kuliah atau modul jelas', ready: contextReady },
    { key: 'source', label: 'Acuan tugas sudah ditentukan', ready: sourceReady },
    { key: 'evidence', label: 'Keterangan hasil sudah ditentukan', ready: evidenceReady },
    { key: 'mapping', label: 'Bukti sudah dipetakan', ready: mappingReady },
    { key: 'identity', label: 'Identitas cover lengkap', ready: identityReady },
  ];
  return {
    canGenerate: titleReady && contextReady && sourceReady && evidenceReady,
    canExport: titleReady && contextReady && sourceReady && evidenceReady && mappingReady && identityReady && sections.length >= 2 && sectionIssues.length === 0,
    checks,
    missingForGenerate: checks.filter((check) => ['title', 'context', 'source', 'evidence'].includes(check.key) && !check.ready),
    missingForExport: checks.filter((check) => !check.ready),
    sectionIssues,
  };
}

export function programLabel(key = '') {
  const labels = {
    ti: 'D3 TEKNIK INFORMATIKA',
    rks: 'D4 REKAYASA KEAMANAN SIBER',
    trpl: 'D4 TEKNOLOGI REKAYASA PERANGKAT LUNAK',
    trm: 'D4 TEKNOLOGI REKAYASA MULTIMEDIA',
    alks: 'D4 AKUNTANSI LEMBAGA KEUANGAN SYARIAH',
    te: 'D3 TEKNIK ELEKTRONIKA',
    tl: 'D3 TEKNIK LISTRIK',
    mekatronika: 'D4 TEKNOLOGI REKAYASA MEKATRONIKA',
    tm: 'D3 TEKNIK MESIN',
    tppl: 'D4 TEKNIK PENGENDALIAN PENCEMARAN LINGKUNGAN',
    ppa: 'D4 PENGEMBANGAN PRODUK AGROINDUSTRI',
    ter: 'D4 TEKNOLOGI REKAYASA ENERGI TERBARUKAN',
    rki: 'D4 REKAYASA KIMIA INDUSTRI',
  };
  return labels[String(key || '').toLowerCase()] || String(key || 'PROGRAM STUDI').toUpperCase();
}
