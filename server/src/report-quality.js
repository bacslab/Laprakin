const GENERIC_CHAT_TITLES = /^(?:laprak baru|chat baru|untitled|asep)$/i;
const ACADEMIC_SIGNAL = /\b(?:praktikum|laprak|laporan|modul|mata kuliah|konfigurasi|implementasi|percobaan|pengujian|analisis|tugas|dashboard|program|database|jaringan|router|framework|mobile|hasil|output)\b/i;
const INSTRUCTION_SIGNAL = /\b(?:tujuan|instruksi|ketentuan|langkah|prosedur|konfigurasi|implementasi|diminta|buat|susun|analisis|uji|pengujian)\b/i;
const EVIDENCE_SIGNAL = /(?:\b(?:hasil|output|pengujian|ping|nilai|log|tabel)\b.{0,100}\b(?:menunjukkan|menghasilkan|berhasil|gagal|reply|timeout|terlihat|muncul|tercatat|sebesar)\b|\b(?:berhasil|gagal|reply|timeout|terlihat|muncul|tercatat)\b.{0,100}\b(?:hasil|output|pengujian|ping|nilai|log|tabel)\b)/i;

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
- Gunakan hierarki bernomor: 1. Analisis Implementasi, 1.1 langkah teknis, 2. Analisis Output, lalu Kesimpulan hanya bila diminta.
- Setiap langkah membahas tindakan yang benar-benar dilakukan, parameter atau command yang dipakai, alasan teknis, dan hasil yang terlihat.
- Letakkan bukti setelah narasi yang membahasnya. Caption wajib spesifik: "Gambar N. ...".
- Gunakan paragraf Bahasa Indonesia yang lugas dan dapat diaudit terhadap modul, chat, atau bukti user.
- Jangan menulis kalimat pengisi seperti "Bagian ini menjelaskan", "ditujukan untuk memaparkan", atau "analisis lebih lanjut diperlukan".
- Jangan membuat pendahuluan, kesimpulan, angka, hasil, command, atau referensi bila bahan user tidak membuktikannya.
- Hindari tiga paragraf dengan pola pembuka dan panjang yang sama. Gunakan istilah teknis dari bahan user secara konsisten.`;

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

export function assessChatReadiness({ session, user, messages = [], attachments = [] }) {
  const config = parseJson(session?.configuration_json, session?.configuration || {});
  const userMessages = messages.filter((message) => !message.role || message.role === 'user').map((message) => String(message.content || '').trim()).filter(Boolean);
  const combined = userMessages.join('\n');
  const tokenCount = words(combined).length;
  const kinds = new Set(attachments.map((attachment) => attachment.kind));
  const hasSourceFile = ['module', 'template', 'data'].some((kind) => kinds.has(kind));
  const hasEvidenceFile = kinds.has('evidence');
  const hasTask = Boolean(
    meaningfulTitle(config.moduleTitle)
    || (hasSourceFile && tokenCount >= 2)
    || (tokenCount >= 7 && ACADEMIC_SIGNAL.test(combined)),
  );
  const hasContext = Boolean(
    meaningfulTitle(config.courseName)
    || meaningfulTitle(config.moduleTitle)
    || hasSourceFile
    || (tokenCount >= 12 && /\b(?:mata kuliah|modul|praktikum|tugas)\b/i.test(combined)),
  );
  const hasInstructions = Boolean(
    hasSourceFile
    || (tokenCount >= 18 && INSTRUCTION_SIGNAL.test(combined)),
  );
  const hasEvidence = Boolean(
    hasEvidenceFile
    || (tokenCount >= 24 && EVIDENCE_SIGNAL.test(combined)),
  );
  const identityReady = Boolean(user?.full_name || user?.fullName) && Boolean(user?.nim) && Boolean(user?.class_name || user?.className);

  const items = [
    { key: 'task', label: 'Tujuan tugas jelas', ready: hasTask, detail: hasTask ? 'Topik dan pekerjaan utama sudah terbaca.' : 'Jelaskan praktikum atau tugas yang sedang dikerjakan.' },
    { key: 'source', label: 'Acuan tersedia', ready: hasContext && hasInstructions, detail: hasContext && hasInstructions ? 'Mata kuliah, modul, atau instruksi sudah cukup sebagai acuan.' : 'Sebutkan mata kuliah/modul dan kirim instruksi atau bahan.' },
    { key: 'evidence', label: 'Bukti praktik tersedia', ready: hasEvidence, detail: hasEvidence ? 'Hasil, screenshot, data, atau output sudah tersedia.' : 'Tambahkan hasil, screenshot, data, atau output praktik.' },
    { key: 'identity', label: 'Identitas cover', ready: identityReady, detail: identityReady ? 'Nama, NIM, dan kelas tersedia.' : 'Lengkapi nama, NIM, dan kelas sebelum export.' },
  ];
  const canCreateDocument = hasTask && hasContext && hasInstructions;
  const canGenerateDraft = canCreateDocument && hasEvidence;
  const missing = items.filter((item) => !item.ready);
  const stage = !hasTask ? 'intake' : !canCreateDocument ? 'collecting' : !canGenerateDraft ? 'evidence' : 'ready';
  const nextQuestion = !hasTask
    ? 'Praktikum atau tugas apa yang sedang kamu kerjakan, dan hasil akhirnya diminta seperti apa?'
    : !(hasContext && hasInstructions)
      ? 'Kirim modul/instruksi dosen, atau ceritakan mata kuliah, tujuan, dan langkah yang diminta.'
      : !hasEvidence
        ? 'Hasil apa yang kamu dapat? Tambahkan screenshot, data, log, atau catatan praktiknya.'
        : !identityReady
          ? 'Draft sudah bisa disiapkan. Lengkapi identitas cover sebelum export.'
          : 'Bahan inti sudah cukup. Periksa ringkasan lalu buat dokumen kerja saat kamu siap.';

  return {
    stage,
    score: Math.round((items.filter((item) => item.ready).length / items.length) * 100),
    canCreateDocument,
    canGenerateDraft,
    items,
    missing: missing.map((item) => ({ key: item.key, label: item.label, detail: item.detail })),
    nextQuestion,
  };
}

export function vaguePromptReply(content, workflow) {
  const clean = String(content || '').trim();
  const tokenCount = words(clean).length;
  if (tokenCount > 4 || ACADEMIC_SIGNAL.test(clean)) return '';
  return `Aku belum punya konteks yang cukup untuk memproses “${clean.slice(0, 60)}” sebagai laporan. ${workflow.nextQuestion}`;
}

export function reportSectionIssues(sections = []) {
  const issues = [];
  for (const [index, section] of sections.entries()) {
    const content = String(section.content || '').trim();
    if (content.length < 140) issues.push(`Bagian ${index + 1} terlalu pendek untuk menjelaskan praktik secara konkret.`);
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
  const sourceReady = files.some((file) => ['module', 'template', 'data'].includes(file.category))
    || words(recipe.instructions || '').length >= 18;
  const evidenceFiles = files.filter((file) => file.category === 'evidence');
  const visualEvidenceFiles = evidenceFiles.filter((file) => String(file.mime_type || file.mimeType || '').startsWith('image/'));
  const evidenceReady = evidenceFiles.length > 0;
  const mappingReady = visualEvidenceFiles.length === 0 || mappings.length >= visualEvidenceFiles.length;
  const identityReady = Boolean(
    (user?.full_name || user?.fullName)
    && user?.nim
    && (user?.class_name || user?.className)
    && (user?.study_program_key || user?.studyProgramKey),
  );
  const sectionIssues = [...reportSectionIssues(sections), ...reportParameterIssues(sections, parameters)];
  const checks = [
    { key: 'title', label: 'Judul tugas spesifik', ready: titleReady },
    { key: 'context', label: 'Mata kuliah atau modul jelas', ready: contextReady },
    { key: 'source', label: 'Modul atau instruksi tersedia', ready: sourceReady },
    { key: 'evidence', label: 'Bukti hasil praktik tersedia', ready: evidenceReady },
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
