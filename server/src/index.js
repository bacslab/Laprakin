import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import mime from 'mime-types';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { config, validateProductionConfig } from './config.js';
import { audit, db, toUser } from './db.js';
import { verifyProductionIntegrations } from './integrations.js';
import { assessChatReadiness, assessDocumentGenerationReadiness } from './report-quality.js';
import { asyncHandler, HttpError, now, parseJson, sanitizeFilename, sha256, detectBufferType } from './utils.js';
import {
  activateSandboxSubscription,
  analyzeDocument,
  authenticateUser,
  claimWelcomeCredits,
  clearSession,
  consumeCredit,
  createUser,
  createVersion,
  dataExportForUser,
  exportDocumentDocx,
  getReviewState,
  getWallet,
  listVersions,
  observeDevice,
  publicUser,
  refundCredit,
  requireAuth,
  requireCsrf,
  restoreVersion,
  setSession,
  updateReviewCheck,
  generateDocument,
  ensureEvidenceMappings,
  ensureReviewChecks,
  activeSubscription,
  notifyUser,
  listNotifications,
  markNotificationsRead,
  documentReadiness,
  documentActivity,
  cleanupExpiredResources,
  verifyEmailToken,
  resendVerificationEmail,
  requestPasswordReset,
  resetPassword,
  changePassword,
  invalidateAllSessions,
  scanDocumentFiles,
  listDocumentParameters,
  createDocumentParameter,
  updateDocumentParameter,
  deleteDocumentParameter,
  parameterIntegrity,
  listDeletedDocuments,
  restoreDeletedDocument,
  answerScopedSupportMessage,
  answerWorkspaceChat,
  createGoogleAuthorizationState,
  finishGoogleAuthorization,
  grantCredit,
  billingSummaryForUser,
} from './services.js';
import {
  PRICING,
  buildOrderQuote,
  checkoutRequestSchema,
  createQrisCheckout,
  getPaymentOrderForUser,
  pricingPayload,
  processMidtransWebhook,
  publicPaymentConfig,
  refreshPaymentOrderForUser,
  simulateLocalCheckout,
} from './payments.js';

validateProductionConfig();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxyHops || false);

const departments = [
  { key: 'jkb', label: 'Jurusan Komputer dan Bisnis' },
  { key: 'jem', label: 'Jurusan Rekayasa Elektro dan Mekatronika' },
  { key: 'jmip', label: 'Jurusan Rekayasa Mesin dan Industri Pertanian' },
  { key: 'other', label: 'Jurusan lainnya' },
];

const programs = [
  { key: 'ti', department: 'jkb', label: 'D3 Teknik Informatika' },
  { key: 'rks', department: 'jkb', label: 'D4 Rekayasa Keamanan Siber' },
  { key: 'trpl', department: 'jkb', label: 'D4 Teknologi Rekayasa Perangkat Lunak' },
  { key: 'trm', department: 'jkb', label: 'D4 Teknologi Rekayasa Multimedia' },
  { key: 'alks', department: 'jkb', label: 'D4 Akuntansi Lembaga Keuangan Syariah' },
  { key: 'te', department: 'jem', label: 'D3 Teknik Elektronika' },
  { key: 'tl', department: 'jem', label: 'D3 Teknik Listrik' },
  { key: 'mekatronika', department: 'jem', label: 'D4 Teknologi Rekayasa Mekatronika' },
  { key: 'tm', department: 'jmip', label: 'D3 Teknik Mesin' },
  { key: 'tppl', department: 'jmip', label: 'D4 Teknik Pengendalian Pencemaran Lingkungan' },
  { key: 'ppa', department: 'jmip', label: 'D4 Pengembangan Produk Agroindustri' },
  { key: 'ter', department: 'jmip', label: 'D4 Teknologi Rekayasa Energi Terbarukan' },
  { key: 'rki', department: 'jmip', label: 'D4 Rekayasa Kimia Industri' },
  { key: 'other', department: 'other', label: 'Prodi lainnya' },
];

const acceptedExtensions = new Set([
  '.pdf', '.docx', '.txt', '.md', '.csv', '.xlsx', '.png', '.jpg', '.jpeg', '.webp',
]);
const acceptedCategories = new Set(['module', 'template', 'evidence', 'data']);
const acceptedDeclarations = new Set(['own', 'template_allowed', 'format_only']);
const acceptedSectionTypes = new Set(['implementation', 'output', 'conclusion', 'appendix']);

const registerSchema = z.object({
  email: z.string().email('Masukkan email yang valid.'),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter.').max(200),
  referralCode: z.string().trim().max(64).optional().default(''),
});

const loginSchema = z.object({
  email: z.string().email('Masukkan email yang valid.'),
  password: z.string().min(1, 'Kata sandi wajib diisi.').max(200),
});


const passwordResetRequestSchema = z.object({
  email: z.string().email('Masukkan email yang valid.'),
});

const passwordResetSchema = z.object({
  token: z.string().min(20, 'Link reset tidak valid.'),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter.').max(200),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Kata sandi saat ini wajib diisi.').max(200),
  newPassword: z.string().min(8, 'Kata sandi baru minimal 8 karakter.').max(200),
});

const profileSchema = z.object({
  fullName: z.string().trim().max(100).optional().default(''),
  nim: z.string().trim().max(40).optional().default(''),
  className: z.string().trim().max(40).optional().default(''),
  departmentKey: z.string().trim().max(24).optional().default(''),
  studyProgramKey: z.string().trim().max(48).optional().default(''),
});

const documentSchema = z.object({
  title: z.string().trim().min(1, 'Judul laporan wajib diisi.').max(150),
  courseName: z.string().trim().max(150).optional().default(''),
  moduleTitle: z.string().trim().max(150).optional().default(''),
  lecturerName: z.string().trim().max(150).optional().default(''),
  academicYear: z.string().trim().max(30).optional().default(''),
  documentProfile: z.enum(['langkah', 'pengujian', 'proyek']).optional().default('langkah'),
  deadlineAt: z.string().trim().max(40).optional().default(''),
  priority: z.enum(['low', 'normal', 'high']).optional().default('normal'),
  recipe: z.object({
    tone: z.enum(['semi-formal', 'formal']).optional().default('semi-formal'),
    perspective: z.enum(['saya', 'kita', 'impersonal']).optional().default('saya'),
    includeConclusion: z.boolean().optional().default(false),
    useTimesNewRoman: z.boolean().optional().default(true),
    blackText: z.boolean().optional().default(true),
    allowExternalAi: z.boolean().optional().default(false),
    instructions: z.string().trim().max(3000).optional().default(''),
  }).optional().default({}),
});

const updateSectionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().max(16000),
  reviewStatus: z.enum(['pending', 'reviewed', 'needs_attention']).optional().default('reviewed'),
});

const updateMappingSchema = z.object({
  stepNumber: z.number().int().min(1).max(100).nullable().optional(),
  stepTitle: z.string().trim().max(180).optional(),
  sectionType: z.enum(['implementation', 'output', 'conclusion', 'appendix']).optional(),
  caption: z.string().trim().max(500).optional(),
  status: z.enum(['suggested', 'confirmed', 'ignored']).optional(),
  displayOrder: z.number().int().min(1).max(200).optional(),
});

const parameterSchema = z.object({
  label: z.string().trim().min(1, 'Nama parameter wajib diisi.').max(100),
  parameterKey: z.string().trim().max(48).optional(),
  value: z.string().trim().min(1, 'Nilai parameter wajib diisi.').max(400),
  unit: z.string().trim().max(40).optional().default(''),
  category: z.enum(['general', 'network', 'measurement', 'command', 'identity', 'other']).optional().default('general'),
  sourceNote: z.string().trim().max(300).optional().default(''),
  includeInDraft: z.boolean().optional().default(true),
  isRequired: z.boolean().optional().default(false),
});


const taskSchema = z.object({
  title: z.string().trim().min(1, 'Isi checklist wajib diisi.').max(180),
  dueAt: z.string().trim().max(40).optional().default(''),
});

const taskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  status: z.enum(['todo', 'done']).optional(),
  dueAt: z.string().trim().max(40).optional(),
  position: z.number().int().min(0).max(200).optional(),
});

const noteSchema = z.object({
  body: z.string().max(5000).optional().default(''),
});

const chatConfigSchema = z.object({
  courseName: z.string().trim().max(150).optional().default(''),
  moduleTitle: z.string().trim().max(150).optional().default(''),
  documentProfile: z.enum(['langkah', 'pengujian', 'proyek']).optional().default('langkah'),
  customStructure: z.string().trim().max(1600).optional().default(''),
  instructions: z.string().trim().max(2200).optional().default(''),
  tone: z.enum(['semi-formal', 'formal']).optional().default('semi-formal'),
  perspective: z.enum(['saya', 'kita', 'impersonal']).optional().default('saya'),
  allowExternalAi: z.boolean().optional().default(false),
});
const chatSessionSchema = z.object({
  title: z.string().trim().min(1).max(120).optional().default('Laprak baru'),
  departmentKey: z.string().trim().max(24).optional().default(''),
  studyProgramKey: z.string().trim().max(48).optional().default(''),
  structureMode: z.enum(['guided', 'custom']).optional().default('guided'),
  courseGroup: z.string().trim().max(100).optional().default(''),
  configuration: chatConfigSchema.optional().default({}),
});
const chatConfigUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  departmentKey: z.string().trim().max(24).optional(),
  studyProgramKey: z.string().trim().max(48).optional(),
  structureMode: z.enum(['guided', 'custom']).optional(),
  courseGroup: z.string().trim().max(100).optional(),
  sortPosition: z.number().int().min(0).max(10000).optional(),
  configuration: chatConfigSchema.optional(),
});
const chatMessageSchema = z.object({
  content: z.string().trim().min(1).max(1800),
  aiMode: z.enum(['basic', 'thinking', 'xtrathink']).optional().default('basic'),
  allowExternalAi: z.boolean().optional().default(false),
});
const chatReorderSchema = z.object({
  items: z.array(z.object({ id: z.string().min(4).max(80), courseGroup: z.string().trim().max(100).optional().default(''), sortPosition: z.number().int().min(0).max(10000) })).min(1).max(80),
});
const chatAttachmentSchema = z.object({
  kind: z.enum(['module', 'evidence', 'template', 'data']).optional().default('evidence'),
});
const supportMessageSchema = z.object({
  content: z.string().trim().min(1).max(900),
});

// Checkout schema and all QRIS-only Midtrans logic live in payments.js. The
// server only accepts SKU + quantity and computes the final order here.


const feedbackSchema = z.object({
  category: z.enum(['bug', 'idea', 'experience', 'other']).optional().default('idea'),
  rating: z.number().int().min(1).max(5).nullable().optional().default(null),
  body: z.string().trim().min(12, 'Ceritakan sedikit lebih detail agar kami bisa menindaklanjuti.').max(1600),
  contactAllowed: z.boolean().optional().default(false),
  allowPublicQuote: z.boolean().optional().default(false),
  publicAlias: z.string().trim().max(48).optional().default(''),
});

const feedbackStatusSchema = z.object({
  status: z.enum(['open', 'reviewing', 'resolved', 'closed']),
  adminNote: z.string().trim().max(800).optional().default(''),
});

const feedbackReplySchema = z.object({
  body: z.string().trim().min(2).max(1000),
});

const riskStatusSchema = z.object({
  status: z.enum(['open', 'reviewed', 'dismissed']),
});

const landingMediaUrlSchema = z.string().trim().max(420).optional().default('');
const internalPathSchema = z.string().trim().max(420).refine(
  (value) => !value || (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')),
  'Gunakan path internal yang valid.',
);
const featureImagePathSchema = z.string().trim().max(420).refine(
  (value) => !value || /^\/api\/public\/update-media\/[a-zA-Z0-9._-]+$/.test(value),
  'Gambar wajib berasal dari upload CMS update.',
);
const featureUpdateSchema = z.object({
  title: z.string().trim().min(3, 'Judul minimal 3 karakter.').max(100),
  summary: z.string().trim().max(240).optional().default(''),
  body: z.string().trim().max(3000).optional().default(''),
  versionLabel: z.string().trim().max(40).optional().default(''),
  highlights: z.array(z.string().trim().min(1).max(140)).max(6).optional().default([]),
  imageUrl: featureImagePathSchema.optional().default(''),
  imageName: z.string().trim().max(120).optional().default(''),
  ctaLabel: z.string().trim().max(40).optional().default(''),
  ctaPath: internalPathSchema.optional().default(''),
  audience: z.enum(['all', 'free', 'paid']).optional().default('all'),
  priority: z.enum(['normal', 'important']).optional().default('normal'),
  status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
  publishedAt: z.string().trim().max(40).optional().default(''),
  expiresAt: z.string().trim().max(40).optional().default(''),
});
const featureUpdateReceiptSchema = z.object({
  action: z.enum(['seen', 'dismissed', 'opened']),
});
const landingCmsSchema = z.object({
  announcement: z.object({
    enabled: z.boolean().optional().default(false),
    text: z.string().trim().max(180).optional().default(''),
    ctaLabel: z.string().trim().max(32).optional().default(''),
    ctaPath: z.enum(['/auth', '/app']).optional().default('/auth'),
  }).optional().default({}),
  copy: z.object({
    heroTitle: z.string().trim().max(60).optional().default('Laprakin'),
    heroSubtitle: z.string().trim().max(280).optional().default('Masukkan tugas, link, modul, atau bukti praktik. Semua siap dilanjutkan di workspace setelah masuk.'),
    servicesTitle: z.string().trim().max(120).optional().default('Layanan yang kamu pakai.'),
    servicesSubtitle: z.string().trim().max(280).optional().default('Satu ruang untuk bahan praktikum, draft, revisi, dan file Word yang bisa kamu cek sendiri.'),
    compareTitle: z.string().trim().max(120).optional().default('Bandingkan hasilnya, bukan sekadar tampilannya.'),
    compareSubtitle: z.string().trim().max(280).optional().default('Dua dokumen PDF ditampilkan berdampingan agar alur, kelengkapan, dan kerapian hasilnya mudah dibandingkan.'),
    tutorialTitle: z.string().trim().max(120).optional().default('Lihat alurnya dalam satu video.'),
    tutorialSubtitle: z.string().trim().max(280).optional().default('Video diputar otomatis saat bagian ini terlihat di layar.'),
    footerText: z.string().trim().max(280).optional().default('Ruang kerja untuk merapikan dokumentasi praktikum tanpa mengambil alih tanggung jawab akademikmu.'),
  }).optional().default({}),
  media: z.object({
    heroImageUrl: landingMediaUrlSchema,
    // Legacy comparison fields are retained so existing saved content remains valid.
    compareMediaUrl: landingMediaUrlSchema,
    compareMediaType: z.enum(['image', 'pdf']).optional().default('image'),
    compareCaption: z.string().trim().max(140).optional().default(''),
    // The Basic pair retains legacy keys. Thinking and XtraThink are independently editable.
    compareAiPdfUrl: landingMediaUrlSchema,
    compareLaprakinPdfUrl: landingMediaUrlSchema,
    compareBasicAiPdfUrl: landingMediaUrlSchema,
    compareBasicLaprakinPdfUrl: landingMediaUrlSchema,
    compareThinkingAiPdfUrl: landingMediaUrlSchema,
    compareThinkingLaprakinPdfUrl: landingMediaUrlSchema,
    compareXtraThinkAiPdfUrl: landingMediaUrlSchema,
    compareXtraThinkLaprakinPdfUrl: landingMediaUrlSchema,
    compareAiLabel: z.string().trim().max(72).optional().default('AI chat gratisan'),
    compareLaprakinLabel: z.string().trim().max(72).optional().default('Laprakin · Basic'),
    compareVideoUrl: landingMediaUrlSchema,
    compareVideoPosterUrl: landingMediaUrlSchema,
    // Tutorial is a single muted, looping video.
    tutorialVideoUrl: landingMediaUrlSchema,
    tutorialVideoPosterUrl: landingMediaUrlSchema,
    tutorialSlides: z.array(z.object({
      id: z.string().trim().max(80).optional(),
      title: z.string().trim().min(2).max(72),
      text: z.string().trim().min(2).max(220),
      imageUrl: landingMediaUrlSchema,
      alt: z.string().trim().max(120).optional().default(''),
    })).max(6).optional().default([]),
  }).optional().default({}),
  testimonials: z.array(z.object({
    id: z.string().trim().max(80).optional(),
    quote: z.string().trim().min(12).max(420),
    name: z.string().trim().min(1).max(48),
    label: z.string().trim().max(90).optional().default('Pengguna beta'),
    published: z.boolean().optional().default(false),
  })).max(8).optional().default([]),
});

const pinSchema = z.object({
  pinned: z.boolean().optional().default(true),
});

const reviewSessionSchema = z.object({
  durationSeconds: z.number().int().min(10).max(7200),
});

function normalizeDateTime(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}


const LANDING_CMS_KEY = 'landing';
const DEFAULT_LANDING_CONTENT = {
  announcement: { enabled: false, text: '', ctaLabel: '', ctaPath: '/auth' },
  copy: {
    heroTitle: 'Laprakin',
    heroSubtitle: 'Masukkan tugas, link, modul, atau bukti praktik. Semua siap dilanjutkan di workspace setelah masuk.',
    servicesTitle: 'Layanan yang kamu pakai.',
    servicesSubtitle: 'Satu ruang untuk bahan praktikum, draft, revisi, dan file Word yang bisa kamu cek sendiri.',
    compareTitle: 'Bandingkan hasilnya, bukan sekadar tampilannya.',
    compareSubtitle: 'Dua dokumen PDF ditampilkan berdampingan agar alur, kelengkapan, dan kerapian hasilnya mudah dibandingkan.',
    tutorialTitle: 'Lihat alurnya dalam satu video.',
    tutorialSubtitle: 'Video diputar otomatis saat bagian ini terlihat di layar.',
    footerText: 'Ruang kerja untuk merapikan dokumentasi praktikum tanpa mengambil alih tanggung jawab akademikmu.',
  },
  media: {
    heroImageUrl: '',
    compareMediaUrl: '',
    compareMediaType: 'image',
    compareCaption: '',
    compareAiPdfUrl: '',
    compareLaprakinPdfUrl: '',
    compareBasicAiPdfUrl: '',
    compareBasicLaprakinPdfUrl: '',
    compareThinkingAiPdfUrl: '',
    compareThinkingLaprakinPdfUrl: '',
    compareXtraThinkAiPdfUrl: '',
    compareXtraThinkLaprakinPdfUrl: '',
    compareAiLabel: 'AI chat gratisan',
    compareLaprakinLabel: 'Laprakin · Basic',
    compareVideoUrl: '',
    compareVideoPosterUrl: '',
    tutorialVideoUrl: '',
    tutorialVideoPosterUrl: '',
    tutorialSlides: [],
  },
  testimonials: [],
};

function anonymousUserRef(userId = '') {
  return `U-${sha256(`${config.tokenSecret}:${userId}`).slice(0, 8).toUpperCase()}`;
}

function normalizeLandingContent(raw = {}) {
  const parsed = landingCmsSchema.parse({
    announcement: { ...DEFAULT_LANDING_CONTENT.announcement, ...(raw.announcement || {}) },
    copy: { ...DEFAULT_LANDING_CONTENT.copy, ...(raw.copy || {}) },
    media: { ...DEFAULT_LANDING_CONTENT.media, ...(raw.media || {}), tutorialSlides: Array.isArray(raw.media?.tutorialSlides) ? raw.media.tutorialSlides : [] },
    testimonials: Array.isArray(raw.testimonials) ? raw.testimonials : [],
  });
  return {
    announcement: parsed.announcement,
    copy: parsed.copy,
    media: {
      ...parsed.media,
      tutorialSlides: parsed.media.tutorialSlides.map((item, index) => ({ id: item.id || `slide-${index + 1}`, title: item.title, text: item.text, imageUrl: item.imageUrl || '', alt: item.alt || item.title })),
    },
    testimonials: parsed.testimonials.map((item) => ({
      id: item.id || nanoid(10),
      quote: item.quote,
      name: item.name,
      label: item.label || 'Pengguna beta',
      published: Boolean(item.published),
    })),
  };
}

function getLandingContent() {
  const row = db.prepare('SELECT content_json, updated_at FROM cms_entries WHERE content_key = ?').get(LANDING_CMS_KEY);
  const content = normalizeLandingContent(parseJson(row?.content_json, DEFAULT_LANDING_CONTENT));
  return { ...content, updatedAt: row?.updated_at || null };
}

function saveLandingContent(content, adminUserId) {
  const normalized = normalizeLandingContent(content);
  db.prepare(`
    INSERT INTO cms_entries (content_key, content_json, updated_by_user_id, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(content_key) DO UPDATE SET
      content_json = excluded.content_json,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = excluded.updated_at
  `).run(LANDING_CMS_KEY, JSON.stringify(normalized), adminUserId, now());
  return getLandingContent();
}

function exposeFeatureUpdate(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    summary: row.summary || '',
    body: row.body || '',
    versionLabel: row.version_label || '',
    highlights: parseJson(row.highlights_json, []),
    imageUrl: row.image_url || '',
    imageName: row.image_name || '',
    ctaLabel: row.cta_label || '',
    ctaPath: row.cta_path || '',
    audience: row.audience,
    priority: row.priority,
    status: row.status,
    publishedAt: row.published_at || '',
    expiresAt: row.expires_at || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function userMatchesFeatureAudience(userId, audience) {
  if (audience === 'all') return true;
  const subscription = activeSubscription(userId);
  const hasPaidCredit = Boolean(db.prepare("SELECT 1 FROM wallet_entries WHERE user_id = ? AND bucket = 'paid' AND amount > 0 LIMIT 1").get(userId));
  const isPaid = Boolean(subscription || hasPaidCredit);
  return audience === 'paid' ? isPaid : !isPaid;
}

function normalizedFeatureUpdate(input) {
  const publishedAt = input.status === 'published' ? (normalizeDateTime(input.publishedAt) || now()) : null;
  const expiresAt = normalizeDateTime(input.expiresAt);
  if (input.expiresAt && !expiresAt) throw new HttpError(400, 'Waktu kedaluwarsa tidak valid.', 'FEATURE_UPDATE_EXPIRY_INVALID');
  if (input.publishedAt && input.status === 'published' && !normalizeDateTime(input.publishedAt)) throw new HttpError(400, 'Waktu publikasi tidak valid.', 'FEATURE_UPDATE_PUBLISH_INVALID');
  if (expiresAt && publishedAt && new Date(expiresAt) <= new Date(publishedAt)) throw new HttpError(400, 'Waktu kedaluwarsa harus setelah waktu publikasi.', 'FEATURE_UPDATE_DATE_ORDER');
  return { ...input, publishedAt, expiresAt };
}

function addRiskEvent({ subjectUserId = null, category, severity = 'low', summary, metadata = {} }) {
  const day = now().slice(0, 10);
  const fingerprint = sha256(`${subjectUserId || 'anonymous'}:${category}:${day}`);
  const existing = db.prepare('SELECT id FROM risk_events WHERE fingerprint = ?').get(fingerprint);
  if (existing) return existing.id;
  const id = nanoid();
  db.prepare(`INSERT INTO risk_events (id, subject_user_id, category, severity, summary, metadata_json, fingerprint, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`)
    .run(id, subjectUserId, category, severity, summary, JSON.stringify(metadata), fingerprint, now());
  return id;
}

function evaluateSharedDeviceRisk(deviceId, userId) {
  const result = db.prepare('SELECT COUNT(DISTINCT user_id) AS account_count FROM user_devices WHERE device_id = ?').get(deviceId);
  const accountCount = Number(result?.account_count || 0);
  if (accountCount >= 3) {
    addRiskEvent({
      subjectUserId: userId,
      category: 'shared_device_pattern',
      severity: accountCount >= 5 ? 'medium' : 'low',
      summary: 'Pola perangkat bersama perlu ditinjau.',
      metadata: { accountCount },
    });
  }
}

function evaluateUploadBurstRisk(userId) {
  const result = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(size_bytes), 0) AS bytes
    FROM chat_attachments
    WHERE owner_user_id = ? AND deleted_at IS NULL AND datetime(created_at) >= datetime('now', '-10 minutes')
  `).get(userId);
  const files = Number(result?.count || 0);
  const bytes = Number(result?.bytes || 0);
  if (files >= 20 || bytes >= 150 * 1024 * 1024) {
    addRiskEvent({
      subjectUserId: userId,
      category: 'upload_burst',
      severity: files >= 35 ? 'medium' : 'low',
      summary: 'Volume unggahan singkat perlu ditinjau.',
      metadata: { files, totalMb: Math.round(bytes / 1024 / 1024) },
    });
  }
}

function evaluateGenerationBurstRisk(userId) {
  const result = db.prepare(`
    SELECT COUNT(*) AS count FROM jobs
    WHERE owner_user_id = ? AND job_type = 'generate' AND datetime(created_at) >= datetime('now', '-60 minutes')
  `).get(userId);
  const count = Number(result?.count || 0);
  if (count >= 8) {
    addRiskEvent({
      subjectUserId: userId,
      category: 'generation_burst',
      severity: count >= 15 ? 'medium' : 'low',
      summary: 'Frekuensi pembuatan draft perlu ditinjau.',
      metadata: { jobsLastHour: count },
    });
  }
}

function evaluateSupportScopeRisk(userId) {
  const result = db.prepare(`
    SELECT COUNT(*) AS count FROM support_messages
    WHERE owner_user_id = ? AND role = 'user' AND scope_status = 'out_of_scope' AND datetime(created_at) >= datetime('now', '-24 hours')
  `).get(userId);
  const count = Number(result?.count || 0);
  if (count >= 6) {
    addRiskEvent({
      subjectUserId: userId,
      category: 'support_scope_burst',
      severity: 'low',
      summary: 'Penggunaan CS di luar ruang lingkup berulang perlu ditinjau.',
      metadata: { attemptsLast24Hours: count },
    });
  }
}

function feedbackForOwner(row) {
  return {
    id: row.id,
    category: row.category,
    rating: row.rating,
    body: row.body,
    contactAllowed: Boolean(row.contact_allowed),
    allowPublicQuote: Boolean(row.allow_public_quote),
    publicAlias: row.public_alias || '',
    status: row.status,
    adminNote: row.admin_note || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function feedbackReplies(feedbackId, ownerUserId = null) {
  const where = ownerUserId ? 'WHERE feedback_id = ? AND feedback.owner_user_id = ?' : 'WHERE feedback_id = ?';
  const params = ownerUserId ? [feedbackId, ownerUserId] : [feedbackId];
  return db.prepare(`
    SELECT reply.id, reply.body, reply.created_at
    FROM feedback_replies reply
    JOIN feedback_items feedback ON feedback.id = reply.feedback_id
    ${where}
    ORDER BY reply.created_at ASC
  `).all(...params).map((row) => ({ id: row.id, body: row.body, createdAt: row.created_at }));
}

function seedDocumentTasks(documentId, ownerUserId, deadlineAt = null) {
  const count = db.prepare('SELECT COUNT(*) AS count FROM document_tasks WHERE document_id = ?').get(documentId).count;
  if (count) return;
  const defaults = [
    ['Masukkan modul atau instruksi praktikum', 'material'],
    ['Tambahkan bukti praktik yang relevan', 'material'],
    ['Cek parameter penting sebelum generate', 'review'],
    ['Selesaikan Cek Sebelum Export', 'review'],
    ['Unduh DOCX dan cek sekali lagi', 'finish'],
  ];
  const timestamp = now();
  const statement = db.prepare(`
    INSERT INTO document_tasks (id, document_id, owner_user_id, title, task_type, status, due_at, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'todo', ?, ?, ?, ?)
  `);
  defaults.forEach(([title, taskType], index) => statement.run(nanoid(), documentId, ownerUserId, title, taskType, deadlineAt || null, index + 1, timestamp, timestamp));
}

function taskSummary(documentId, ownerUserId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done
    FROM document_tasks WHERE document_id = ? AND owner_user_id = ?
  `).get(documentId, ownerUserId);
  return { total: Number(row?.total || 0), done: Number(row?.done || 0) };
}

function storageSummaryForUser(userId) {
  const used = db.prepare(`
    SELECT COALESCE(SUM(size_bytes), 0) AS used FROM (
      SELECT sha256, MAX(size_bytes) AS size_bytes FROM (
        SELECT COALESCE(NULLIF(sha256, ''), id) AS sha256, size_bytes
        FROM document_files WHERE owner_user_id = ? AND deleted_at IS NULL
        UNION ALL
        SELECT COALESCE(NULLIF(sha256, ''), id) AS sha256, size_bytes
        FROM chat_attachments WHERE owner_user_id = ? AND deleted_at IS NULL
      ) GROUP BY sha256
    )
  `).get(userId, userId).used || 0;
  const subscription = activeSubscription(userId);
  const hasPaidCredit = Boolean(db.prepare(`
    SELECT 1 FROM wallet_entries WHERE user_id = ? AND bucket = 'paid' AND amount > 0 LIMIT 1
  `).get(userId));
  const tier = subscription?.plan_key === 'pro' ? 'pro' : subscription ? 'subscription' : hasPaidCredit ? 'paid' : 'free';
  const limitBytes = tier === 'pro' ? 5 * 1024 * 1024 * 1024 : tier === 'subscription' ? 1024 * 1024 * 1024 : tier === 'paid' ? 500 * 1024 * 1024 : 100 * 1024 * 1024;
  return {
    usedBytes: Number(used),
    limitBytes,
    tier,
    retentionHint: tier === 'pro' ? 'Selama Pro aktif + masa tenggang.' : tier === 'subscription' ? 'Selama subscription aktif + masa tenggang.' : tier === 'paid' ? '180 hari sejak aktivitas berbayar terakhir.' : '30 hari setelah laporan selesai.',
  };
}

function revisionEntitlementForUser(userId) {
  const subscription = activeSubscription(userId);
  if (subscription?.plan_key === 'pro') return { plan: 'pro', maxRevisions: PRICING.revisions.pro };
  if (subscription) return { plan: 'monthly', maxRevisions: PRICING.revisions.monthly };
  const hasPaidCredit = Boolean(db.prepare(`SELECT 1 FROM wallet_entries WHERE user_id = ? AND bucket = 'paid' AND amount > 0 LIMIT 1`).get(userId));
  return hasPaidCredit ? { plan: 'single', maxRevisions: PRICING.revisions.single } : { plan: 'free', maxRevisions: PRICING.revisions.free };
}

/**
 * Authoritative AI mode access. The client may render locks, but the server is
 * the source of truth before accepting a Thinking/XtraThink message.
 * - Basic: every authenticated user.
 * - Thinking: active Pro/Max subscription OR a verified paid Laprakin credit purchase.
 * - XtraThink: active Max subscription only.
 */
function aiModeAccessForUser(userId) {
  const subscription = activeSubscription(userId);
  const planKey = subscription?.plan_key || null;
  const hasPurchasedCredit = Boolean(db.prepare(`
    SELECT 1 FROM wallet_entries WHERE user_id = ? AND bucket = 'paid' AND amount > 0 LIMIT 1
  `).get(userId));
  const hasPro = planKey === 'monthly' || planKey === 'pro';
  const hasMax = planKey === 'pro';
  return {
    basic: { available: true, requirement: 'free', label: 'Basic' },
    thinking: { available: Boolean(hasPro || hasPurchasedCredit), requirement: 'paid_credit_or_pro', label: 'Thinking' },
    xtrathink: { available: Boolean(hasMax), requirement: 'max_subscription', label: 'XtraThink' },
    activePlan: hasMax ? 'max' : hasPro ? 'pro' : hasPurchasedCredit ? 'credit' : 'free',
  };
}

function securityHeaders(req, res, next) {
  const origin = req.get('origin');
  if (origin && !config.allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: { message: 'Origin request tidak diizinkan.', code: 'ORIGIN_DENIED' } });
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'");
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Laprakin-Device, X-Laprakin-CSRF');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    return res.status(204).end();
  }

  return next();
}

app.use(securityHeaders);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((req, _res, next) => {
  req.requestId = nanoid(10);
  next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Terlalu banyak percobaan. Coba lagi beberapa menit.', code: 'RATE_LIMITED' } },
});


const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: config.supportMaxMessagesPerHour,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Bantuan AI sedang dibatasi sebentar. Coba lagi nanti.', code: 'SUPPORT_RATE_LIMIT' } },
});

const aiChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: config.aiMaxRequestsPerHour * 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Terlalu banyak permintaan AI dari jaringan ini. Coba lagi nanti.', code: 'AI_NETWORK_RATE_LIMIT' } },
});

const integrationCheckLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Pengecekan integrasi dibatasi. Coba lagi nanti.', code: 'INTEGRATION_CHECK_RATE_LIMIT' } },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Batas upload sementara tercapai. Coba lagi nanti.', code: 'UPLOAD_RATE_LIMITED' } },
});

function requireDocumentOwner(req, _res, next) {
  const document = db.prepare(`
    SELECT * FROM documents
    WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL
  `).get(req.params.id, req.user.id);
  if (!document) return next(new HttpError(404, 'Dokumen tidak ditemukan.', 'DOCUMENT_NOT_FOUND'));
  req.document = document;
  return next();
}

function exposeDocument(row) {
  const files = db.prepare(`
    SELECT id, category, original_name, mime_type, detected_mime, size_bytes, source_declaration, security_status, sha256, is_extracted, created_at
    FROM document_files WHERE document_id = ? AND deleted_at IS NULL ORDER BY created_at
  `).all(row.id);
  const mappings = db.prepare(`
    SELECT mapping.*, file.original_name, file.mime_type, file.source_declaration
    FROM evidence_mappings mapping
    JOIN document_files file ON file.id = mapping.file_id
    WHERE mapping.document_id = ? AND file.deleted_at IS NULL
    ORDER BY mapping.display_order
  `).all(row.id);
  const sections = db.prepare('SELECT * FROM report_sections WHERE document_id = ? ORDER BY position').all(row.id);
  const exports = db.prepare(`
    SELECT id, file_name, status, review_mode, created_at, expires_at
    FROM exports WHERE document_id = ? ORDER BY created_at DESC
  `).all(row.id);
  const parameters = db.prepare(`
    SELECT id, label, parameter_key, value, unit, category, source_note, include_in_draft, is_required, created_at, updated_at
    FROM document_parameters WHERE document_id = ? AND owner_user_id = ? ORDER BY created_at ASC
  `).all(row.id, row.owner_user_id).map((item) => ({ ...item, includeInDraft: Boolean(item.include_in_draft), isRequired: Boolean(item.is_required) }));
  const templateInspections = db.prepare(`
    SELECT file_id, status, summary, details_json, warnings_json, inspected_at
    FROM template_inspections WHERE document_id = ? ORDER BY inspected_at DESC
  `).all(row.id).map((item) => ({ ...item, details: parseJson(item.details_json, {}), warnings: parseJson(item.warnings_json, []) }));
  const tasks = db.prepare(`
    SELECT id, title, task_type, status, due_at, position, created_at, updated_at
    FROM document_tasks WHERE document_id = ? AND owner_user_id = ? ORDER BY status ASC, position ASC, created_at ASC
  `).all(row.id, row.owner_user_id);
  const note = db.prepare(`
    SELECT id, body, updated_at, created_at FROM document_notes WHERE document_id = ? AND owner_user_id = ?
  `).get(row.id, row.owner_user_id) || null;
  const jobs = db.prepare(`
    SELECT * FROM jobs WHERE document_id = ? AND owner_user_id = ? ORDER BY created_at DESC LIMIT 8
  `).all(row.id, row.owner_user_id).map(publicJob);

  return {
    ...row,
    recipe: parseJson(row.recipe_json, {}),
    outline: parseJson(row.outline_json, []),
    files,
    mappings,
    sections,
    exports,
    parameters,
    templateInspections,
    tasks,
    taskSummary: taskSummary(row.id, row.owner_user_id),
    note,
    isPinned: Boolean(row.is_pinned),
    reviewSeconds: Number(row.review_seconds || 0),
    lastReviewedAt: row.last_reviewed_at || null,
    readiness: documentReadiness(row.id, row.owner_user_id),
    jobs,
  };
}

const documentStreams = new Map();
let workerBusy = false;

function jobPayload(job) {
  return parseJson(job.payload_json, {});
}

function jobTimeline(jobId) {
  return db.prepare(`
    SELECT id, status, progress, message, created_at AS createdAt
    FROM job_events WHERE job_id = ? ORDER BY created_at ASC
  `).all(jobId);
}

function recordJobEvent(jobId) {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!job) return;
  const latest = db.prepare('SELECT status, progress, message FROM job_events WHERE job_id = ? ORDER BY created_at DESC LIMIT 1').get(jobId);
  if (latest && latest.status === job.status && Number(latest.progress) === Number(job.progress) && latest.message === job.message) return;
  db.prepare(`
    INSERT INTO job_events (id, job_id, document_id, owner_user_id, status, progress, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nanoid(), job.id, job.document_id, job.owner_user_id, job.status, Number(job.progress || 0), String(job.message || '').slice(0, 180), now());
}

function publicJob(job) {
  return {
    id: job.id,
    documentId: job.document_id,
    type: job.job_type,
    status: job.status,
    progress: job.progress,
    message: job.message,
    result: parseJson(job.result_json, {}),
    errorMessage: job.error_message || '',
    attemptCount: job.attempt_count || 0,
    maxAttempts: job.max_attempts || 1,
    cancelRequested: Boolean(job.cancel_requested_at),
    createdAt: job.created_at,
    startedAt: job.started_at,
    finishedAt: job.finished_at,
    timeline: jobTimeline(job.id),
  };
}

function publishDocumentEvent(documentId, type, payload) {
  const listeners = documentStreams.get(documentId);
  if (!listeners?.size) return;
  const message = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const response of listeners) {
    try { response.write(message); } catch { listeners.delete(response); }
  }
}

function publishJob(jobId) {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (job) publishDocumentEvent(job.document_id, 'job', publicJob(job));
}

function ensureNoActiveJob(documentId, jobType) {
  const active = db.prepare(`
    SELECT id FROM jobs
    WHERE document_id = ? AND job_type = ? AND status IN ('queued', 'running')
    LIMIT 1
  `).get(documentId, jobType);
  if (active) throw new HttpError(409, 'Proses sejenis masih berjalan untuk dokumen ini.', 'JOB_ALREADY_RUNNING');
}

function enqueueJob({ documentId, userId, jobType, payload = {}, maxAttempts = config.jobMaxAttempts }) {
  const jobId = nanoid();
  db.prepare(`
    INSERT INTO jobs (
      id, document_id, owner_user_id, job_type, status, progress, message,
      payload_json, attempt_count, max_attempts, created_at
    ) VALUES (?, ?, ?, ?, 'queued', 0, 'Masuk antrean', ?, 0, ?, ?)
  `).run(jobId, documentId, userId, jobType, JSON.stringify(payload), Math.max(1, maxAttempts), now());
  recordJobEvent(jobId);
  audit(userId, 'job.enqueued', 'document', documentId, { jobId, jobType });
  publishJob(jobId);
  queueMicrotask(drainJobQueue);
  return jobId;
}

async function runJob(job) {
  const claimed = db.prepare(`
    UPDATE jobs SET status = 'running', attempt_count = attempt_count + 1,
      started_at = COALESCE(started_at, ?), heartbeat_at = ?, message = 'Memulai proses'
    WHERE id = ? AND status = 'queued'
  `).run(now(), now(), job.id);
  if (!claimed.changes) return;
  recordJobEvent(job.id);
  publishJob(job.id);

  const update = (progress, message) => {
    const live = db.prepare('SELECT cancel_requested_at, status FROM jobs WHERE id = ?').get(job.id);
    if (live?.cancel_requested_at || live?.status === 'canceled') {
      const canceled = new Error('Proses dibatalkan pengguna.');
      canceled.code = 'JOB_CANCELED';
      throw canceled;
    }
    db.prepare(`
      UPDATE jobs SET progress = ?, message = ?, heartbeat_at = ? WHERE id = ?
    `).run(Math.max(0, Math.min(99, Number(progress) || 0)), String(message || '').slice(0, 180), now(), job.id);
    recordJobEvent(job.id);
    publishJob(job.id);
  };

  const payload = jobPayload(job);
  try {
    let result;
    if (job.job_type === 'scan') {
      result = await scanDocumentFiles(job.document_id, job.owner_user_id, update);
    } else if (job.job_type === 'analyze') {
      result = await analyzeDocument(job.document_id, job.owner_user_id, update);
    } else if (job.job_type === 'generate') {
      result = await generateDocument(job.document_id, job.owner_user_id, update);
    } else if (job.job_type === 'export') {
      update(20, 'Menyiapkan dokumen Word');
      const exported = await exportDocumentDocx(job.document_id, job.owner_user_id, payload.reviewMode || 'reviewed');
      result = { exportId: exported.id, fileName: exported.file_name, reviewMode: exported.review_mode };
      update(92, 'Menyimpan file DOCX');
    } else {
      throw new Error(`Jenis job tidak didukung: ${job.job_type}`);
    }

    const live = db.prepare('SELECT cancel_requested_at, status FROM jobs WHERE id = ?').get(job.id);
    if (live?.cancel_requested_at || live?.status === 'canceled') {
      const canceled = new Error('Proses dibatalkan pengguna.');
      canceled.code = 'JOB_CANCELED';
      throw canceled;
    }
    db.prepare(`
      UPDATE jobs SET status = 'completed', progress = 100, message = 'Selesai', result_json = ?, finished_at = ?, heartbeat_at = ?
      WHERE id = ?
    `).run(JSON.stringify(result || {}), now(), now(), job.id);
    recordJobEvent(job.id);
    const jobCopy = {
      scan: { title: 'Pemeriksaan file selesai', body: 'Cek jika ada file yang perlu kamu redaksi sebelum dibagikan.' },
      analyze: { title: 'Analisis bahan selesai', body: 'Outline dan saran bukti sudah bisa kamu review.' },
      generate: { title: 'Draft laporan sudah siap', body: 'Lanjutkan pemeriksaan di halaman laporan.' },
      export: { title: 'File Word sudah siap', body: 'DOCX bisa diunduh dari halaman laporan.' },
    };
    notifyUser(job.owner_user_id, {
      kind: job.job_type,
      title: jobCopy[job.job_type]?.title || 'Proses selesai',
      body: jobCopy[job.job_type]?.body || 'Lanjutkan pemeriksaan di halaman laporan.',
      href: `/app/documents/${job.document_id}`,
    });
    audit(job.owner_user_id, 'job.completed', 'document', job.document_id, { jobId: job.id, jobType: job.job_type });
  } catch (error) {
    const current = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job.id);
    const canceled = error?.code === 'JOB_CANCELED' || Boolean(current?.cancel_requested_at) || current?.status === 'canceled';
    if (canceled) {
      if (job.job_type === 'generate' && payload.creditBucket) refundCredit(job.owner_user_id, payload.creditBucket, job.document_id);
      db.prepare(`
        UPDATE jobs SET status = 'canceled', message = 'Dibatalkan', error_message = ?, finished_at = ?, canceled_at = ?, heartbeat_at = ?
        WHERE id = ?
      `).run(error?.message || 'Dibatalkan pengguna.', now(), now(), now(), job.id);
      recordJobEvent(job.id);
      notifyUser(job.owner_user_id, {
        kind: 'system', title: 'Proses dibatalkan', body: 'Credit dikembalikan bila proses generate belum selesai.', href: `/app/documents/${job.document_id}`,
      });
      audit(job.owner_user_id, 'job.canceled', 'document', job.document_id, { jobId: job.id, jobType: job.job_type });
    } else {
      const canRetry = (current?.attempt_count || 1) < (current?.max_attempts || 1);
      if (canRetry) {
        const runAfter = new Date(Date.now() + 1500 * (current.attempt_count || 1)).toISOString();
        db.prepare(`
          UPDATE jobs SET status = 'queued', progress = 0, message = 'Akan dicoba lagi', error_message = ?, run_after = ?, heartbeat_at = ?
          WHERE id = ?
        `).run(error?.message || 'Terjadi kesalahan sementara.', runAfter, now(), job.id);
        recordJobEvent(job.id);
      } else {
        if (job.job_type === 'generate' && payload.creditBucket) {
          refundCredit(job.owner_user_id, payload.creditBucket, job.document_id);
        }
        db.prepare(`
          UPDATE jobs SET status = 'failed', message = 'Proses gagal', error_message = ?, finished_at = ?, heartbeat_at = ?
          WHERE id = ?
        `).run(error?.message || 'Terjadi kesalahan.', now(), now(), job.id);
        recordJobEvent(job.id);
        notifyUser(job.owner_user_id, {
          kind: 'error', title: 'Proses belum berhasil',
          body: job.job_type === 'generate' ? 'Tidak ada credit yang hangus karena kegagalan sistem. Kamu bisa mencoba kembali dari halaman laporan.' : 'Kamu bisa mencoba kembali dari halaman laporan.',
          href: `/app/documents/${job.document_id}`,
        });
        audit(job.owner_user_id, 'job.failed', 'document', job.document_id, { jobId: job.id, jobType: job.job_type });
      }
    }
  } finally {
    publishJob(job.id);
  }
}

async function drainJobQueue() {
  if (workerBusy) return;
  workerBusy = true;
  try {
    while (true) {
      const job = db.prepare(`
        SELECT * FROM jobs
        WHERE status = 'queued' AND (run_after IS NULL OR run_after <= ?)
        ORDER BY created_at ASC LIMIT 1
      `).get(now());
      if (!job) break;
      await runJob(job);
    }
  } finally {
    workerBusy = false;
  }
}

function recoverInterruptedJobs() {
  const result = db.prepare(`
    UPDATE jobs SET status = 'queued', message = 'Dilanjutkan setelah server aktif kembali', run_after = NULL
    WHERE status = 'running'
  `).run();
  if (result.changes) console.log(`[jobs] recovered ${result.changes} interrupted job(s)`);
}

function normalizeSourceDeclaration(value) {
  return acceptedDeclarations.has(value) ? value : 'own';
}

function isSignatureCompatible(extension, detectedType) {
  if (['.txt', '.md', '.csv'].includes(extension)) return true;
  if (extension === '.pdf') return detectedType === 'application/pdf';
  if (extension === '.png') return detectedType === 'image/png';
  if (['.jpg', '.jpeg'].includes(extension)) return detectedType === 'image/jpeg';
  if (extension === '.webp') return detectedType === 'image/webp';
  if (['.docx', '.xlsx'].includes(extension)) return detectedType === 'application/zip';
  return false;
}

function removeUploadedFiles(files = []) {
  for (const file of files) {
    try { fs.unlinkSync(file.path); } catch { /* best effort cleanup */ }
  }
}

const uploadStorage = multer.diskStorage({
  destination: (req, _file, callback) => {
    try {
      const directory = path.join(config.uploadDir, req.user.id, req.params.id, 'source');
      fs.mkdirSync(directory, { recursive: true });
      callback(null, directory);
    } catch (error) {
      callback(error);
    }
  },
  filename: (_req, file, callback) => {
    callback(null, `${nanoid()}-${sanitizeFilename(file.originalname)}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: config.maxUploadBytes, files: config.maxFilesPerUpload },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, acceptedExtensions.has(extension));
  },
});

app.get('/api/health', (_req, res) => {
  const queue = db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE status IN ('queued', 'running')").get().count;
  res.json({
    ok: true,
    mode: config.nodeEnv,
    aiConfigured: Boolean(config.geminiKey),
    googleLoginConfigured: Boolean(config.googleClientId && config.googleClientSecret),
    paymentsMode: config.paymentsMode,
    queueDepth: queue,
    time: now(),
  });
});

app.get('/api/health/ready', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    const missing = [];
    if (config.aiRequired && !config.geminiKey) missing.push('ai');
    if (config.googleOauthRequired && (!config.googleClientId || !config.googleClientSecret)) missing.push('google_oauth');
    if (missing.length) return res.status(503).json({ ok: false, database: 'ready', missing });
    return res.json({ ok: true, database: 'ready', worker: workerBusy ? 'busy' : 'idle', ai: config.geminiKey ? 'configured' : 'disabled', googleOauth: config.googleClientId && config.googleClientSecret ? 'configured' : 'disabled' });
  } catch {
    return res.status(503).json({ ok: false, database: 'unavailable' });
  }
});

app.get('/api/meta', (_req, res) => {
  res.json({
    departments,
    programs,
    features: {
      geminiConfigured: Boolean(config.geminiKey),
      manualPayments: config.paymentsMode === 'manual' && !config.isProd,
      uploadMaxMb: config.maxUploadBytes / 1024 / 1024,
      googleLoginEnabled: Boolean(config.googleClientId && config.googleClientSecret),
      supportAiEnabled: Boolean(config.supportAiEnabled && config.geminiKey),
    },
  });
});

app.get('/api/auth/google/start', (req, res, next) => {
  try {
    const redirectPath = String(req.query.next || '/app');
    const { state, url } = createGoogleAuthorizationState(redirectPath);
    res.cookie('laprakin_google_state', state, { httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: 10 * 60 * 1000, path: '/' });
    res.redirect(url);
  } catch (error) { next(error); }
});

app.get('/api/auth/google/callback', asyncHandler(async (req, res) => {
  res.clearCookie('laprakin_google_state', { httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/' });
  if (req.query.error) return res.redirect(`${config.appUrl}/auth?google=cancelled`);
  const state = String(req.query.state || '');
  const code = String(req.query.code || '');
  const cookieState = String(req.cookies?.laprakin_google_state || '');
  if (!code || !state || !cookieState || state !== cookieState) {
    throw new HttpError(400, 'Sesi masuk Google tidak valid. Coba lagi.', 'GOOGLE_STATE_INVALID');
  }
  const completed = await finishGoogleAuthorization({ state, code });
  const googleDeviceId = observeDevice(req, completed.user.id);
  evaluateSharedDeviceRisk(googleDeviceId, completed.user.id);
  setSession(res, completed.user);
  return res.redirect(`${config.appUrl}${completed.redirectPath.startsWith('/app') ? completed.redirectPath : '/app'}?welcome=google`);
}));

app.post('/api/auth/register', authLimiter, asyncHandler(async (req, res) => {
  const input = registerSchema.parse(req.body || {});
  const created = await createUser(input);
  const registeredDeviceId = observeDevice(req, created.user.id);
  evaluateSharedDeviceRisk(registeredDeviceId, created.user.id);
  const response = {
    user: created.user,
    message: 'Akun dibuat. Verifikasi email untuk mengaktifkan 2 credit gratis.',
  };
  if (!config.isProd) response.developmentVerificationToken = created.verificationToken;
  res.status(201).json(response);
}));

app.post('/api/auth/verify', authLimiter, asyncHandler(async (req, res) => {
  const token = String(req.body?.token || '');
  const user = verifyEmailToken(token);
  const verifiedDeviceId = observeDevice(req, user.id);
  evaluateSharedDeviceRisk(verifiedDeviceId, user.id);
  let welcomeGranted = false;
  try { claimWelcomeCredits(user.id, verifiedDeviceId); welcomeGranted = true; } catch { /* shared-device review can defer the promo without blocking verification */ }
  const csrfToken = setSession(res, user);
  res.json({ user, wallet: getWallet(user.id), csrfToken, welcomeGranted, message: welcomeGranted ? 'Email berhasil diverifikasi. 2 credit gratis aktif.' : 'Email berhasil diverifikasi.' });
}));

app.post('/api/auth/resend-verification', authLimiter, asyncHandler(async (req, res) => {
  const input = passwordResetRequestSchema.parse(req.body || {});
  const result = await resendVerificationEmail(input.email);
  const response = { message: 'Jika akun belum terverifikasi, email verifikasi telah dikirim.' };
  if (!config.isProd && result.verificationToken) response.developmentVerificationToken = result.verificationToken;
  res.json(response);
}));

app.post('/api/auth/request-password-reset', authLimiter, asyncHandler(async (req, res) => {
  const input = passwordResetRequestSchema.parse(req.body || {});
  const result = await requestPasswordReset(input.email);
  const response = { message: 'Jika email terdaftar, link reset telah dikirim.' };
  if (!config.isProd && result.resetToken) response.developmentResetToken = result.resetToken;
  res.json(response);
}));

app.post('/api/auth/reset-password', authLimiter, asyncHandler(async (req, res) => {
  const input = passwordResetSchema.parse(req.body || {});
  const user = await resetPassword(input.token, input.password);
  const csrfToken = setSession(res, user);
  res.json({ user, wallet: getWallet(user.id), csrfToken, message: 'Kata sandi berhasil diperbarui.' });
}));

app.post('/api/auth/login', authLimiter, asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body || {});
  const user = await authenticateUser(input);
  const verifiedDeviceId = observeDevice(req, user.id);
  evaluateSharedDeviceRisk(verifiedDeviceId, user.id);
  const csrfToken = setSession(res, user);
  audit(user.id, 'auth.login', 'user', user.id, {});
  res.json({ user, wallet: getWallet(user.id), csrfToken });
}));

app.post('/api/auth/logout', requireAuth, requireCsrf, (req, res) => {
  audit(req.user.id, 'auth.logout', 'user', req.user.id, {});
  clearSession(res);
  res.status(204).end();
});


app.post('/api/auth/logout-all', requireAuth, requireCsrf, (req, res) => {
  invalidateAllSessions(req.user.id);
  clearSession(res);
  res.status(204).end();
});

app.put('/api/auth/password', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const input = changePasswordSchema.parse(req.body || {});
  const user = await changePassword(req.user.id, input.currentPassword, input.newPassword);
  const csrfToken = setSession(res, user);
  res.json({ user, csrfToken, message: 'Kata sandi diperbarui. Sesi perangkat lain diakhiri.' });
}));

app.get('/api/auth/me', requireAuth, (req, res) => {
  // Renew persistent cookie on active use. Session remains revocable via versioning.
  const csrfToken = setSession(res, req.user);
  res.json({ user: req.user, wallet: getWallet(req.user.id), aiModes: aiModeAccessForUser(req.user.id), csrfToken });
});

app.get('/api/ai/modes', requireAuth, (req, res) => {
  res.json({ modes: aiModeAccessForUser(req.user.id) });
});

app.get('/api/notifications', requireAuth, (req, res) => {
  res.json(listNotifications(req.user.id));
});

app.put('/api/notifications/read', requireAuth, requireCsrf, (req, res) => {
  res.json(markNotificationsRead(req.user.id, req.body?.ids || []));
});

app.post('/api/wallet/claim-welcome', requireAuth, requireCsrf, (req, res) => {
  const deviceId = observeDevice(req, req.user.id);
  res.json(claimWelcomeCredits(req.user.id, deviceId));
});

app.get('/api/pricing', (_req, res) => {
  res.json(pricingPayload());
});

app.post('/api/pricing/quote', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const input = checkoutRequestSchema.parse(req.body || {});
  const quote = buildOrderQuote(input);
  const payment = publicPaymentConfig();
  res.json({
    ...quote,
    paymentReady: payment.enabled,
    paymentChannel: payment.channel,
    qrisOnly: true,
    note: payment.enabled
      ? 'Checkout hanya menampilkan QRIS Dinamis Midtrans.'
      : payment.mode === 'manual'
        ? 'Mode lokal dapat mensimulasikan checkout QRIS untuk pengujian.'
        : 'Pembayaran online belum diaktifkan.',
  });
}));

app.post('/api/purchases/sandbox-single', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const input = checkoutRequestSchema.parse({ items: [{ sku: 'credit', quantity: Number(req.body?.quantity || 1) }] });
  if (config.isProd || config.paymentsMode !== 'manual') {
    throw new HttpError(501, 'Payment provider belum dikonfigurasi untuk environment ini.', 'PAYMENT_NOT_CONFIGURED');
  }
  if (!req.user.emailVerified) throw new HttpError(400, 'Verifikasi email terlebih dahulu.', 'EMAIL_NOT_VERIFIED');
  grantCredit({
    userId: req.user.id,
    bucket: 'paid',
    amount: buildOrderQuote(input).items[0].quantity,
    reason: `Credit satuan sandbox ×${buildOrderQuote(input).items[0].quantity}`,
    referenceType: 'sandbox_purchase',
    referenceId: nanoid(),
    expiresInDays: 180,
  });
  const singleQuantity = buildOrderQuote(input).items[0].quantity;
  audit(req.user.id, 'pricing.single_sandbox_activated', 'wallet', req.user.id, { quantity: singleQuantity });
  res.status(201).json({ wallet: getWallet(req.user.id), quantity: singleQuantity });
}));

app.get('/api/storage/summary', requireAuth, (req, res) => {
  res.json(storageSummaryForUser(req.user.id));
});

app.get('/api/wallet', requireAuth, (req, res) => {
  res.json({ ...getWallet(req.user.id), subscription: activeSubscription(req.user.id) });
});

app.get('/api/billing', requireAuth, (req, res) => {
  res.json(billingSummaryForUser(req.user.id));
});

app.get('/api/payments/config', (_req, res) => {
  res.json(publicPaymentConfig());
});

app.post('/api/payments/checkout', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const input = checkoutRequestSchema.parse(req.body || {});
  if (!req.user.emailVerified) throw new HttpError(400, 'Verifikasi email sebelum melakukan pembayaran.', 'EMAIL_NOT_VERIFIED');

  if (!config.isProd && config.paymentsMode === 'manual') {
    return res.status(201).json(simulateLocalCheckout(req.user, input));
  }

  const payment = publicPaymentConfig();
  if (!payment.enabled) throw new HttpError(503, 'Gateway pembayaran belum dikonfigurasi.', 'PAYMENT_NOT_CONFIGURED');
  const checkout = await createQrisCheckout(req.user, input);
  res.status(201).json(checkout);
}));

app.get('/api/payments/orders/:orderId', requireAuth, (req, res) => {
  res.json({ order: getPaymentOrderForUser(String(req.params.orderId || ''), req.user.id) });
});

app.post('/api/payments/orders/:orderId/refresh', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const order = await refreshPaymentOrderForUser(String(req.params.orderId || ''), req.user.id);
  res.json({ order });
}));

app.post('/api/payments/midtrans/notification', asyncHandler(async (req, res) => {
  const order = await processMidtransWebhook(req.body || {});
  res.status(200).json({ received: true, orderId: order.id, status: order.status });
}));


app.get('/api/public/landing', (_req, res) => {
  const content = getLandingContent();
  res.json({
    announcement: content.announcement?.enabled ? content.announcement : null,
    copy: content.copy,
    media: content.media,
    testimonials: content.testimonials.filter((item) => item.published).map(({ id, quote, name, label }) => ({ id, quote, name, label })),
  });
});

app.get('/api/product-updates/pending', requireAuth, (req, res) => {
  const candidates = db.prepare(`
    SELECT feature_updates.*
    FROM feature_updates
    LEFT JOIN feature_update_receipts receipt
      ON receipt.update_id = feature_updates.id AND receipt.user_id = ?
    WHERE feature_updates.status = 'published'
      AND feature_updates.published_at IS NOT NULL
      AND datetime(feature_updates.published_at) <= datetime(?)
      AND (feature_updates.expires_at IS NULL OR datetime(feature_updates.expires_at) > datetime(?))
      AND receipt.seen_at IS NULL
    ORDER BY CASE feature_updates.priority WHEN 'important' THEN 0 ELSE 1 END, datetime(feature_updates.published_at) DESC
    LIMIT 10
  `).all(req.user.id, now(), now());
  const update = candidates.find((item) => userMatchesFeatureAudience(req.user.id, item.audience));
  res.json({ update: exposeFeatureUpdate(update) });
});

app.post('/api/product-updates/:id/receipt', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const input = featureUpdateReceiptSchema.parse(req.body || {});
  const update = db.prepare("SELECT id FROM feature_updates WHERE id = ? AND status = 'published'").get(req.params.id);
  if (!update) throw new HttpError(404, 'Update fitur tidak ditemukan.', 'FEATURE_UPDATE_NOT_FOUND');
  const timestamp = now();
  db.prepare(`
    INSERT INTO feature_update_receipts (update_id, user_id, seen_at, dismissed_at, opened_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(update_id, user_id) DO UPDATE SET
      seen_at = COALESCE(feature_update_receipts.seen_at, excluded.seen_at),
      dismissed_at = COALESCE(feature_update_receipts.dismissed_at, excluded.dismissed_at),
      opened_at = COALESCE(feature_update_receipts.opened_at, excluded.opened_at)
  `).run(
    update.id,
    req.user.id,
    timestamp,
    input.action === 'dismissed' ? timestamp : null,
    input.action === 'opened' ? timestamp : null,
  );
  audit(req.user.id, `feature_update.${input.action}`, 'feature_update', update.id, {});
  res.status(204).end();
}));

app.put('/api/profile', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const input = profileSchema.parse(req.body || {});
  const program = input.studyProgramKey ? programs.find((item) => item.key === input.studyProgramKey) : null;
  if (input.studyProgramKey && !program) throw new HttpError(400, 'Prodi tidak valid.', 'INVALID_STUDY_PROGRAM');
  if (program && input.departmentKey && program.department !== input.departmentKey) {
    throw new HttpError(400, 'Prodi tidak sesuai dengan jurusan.', 'PROGRAM_DEPARTMENT_MISMATCH');
  }

  db.prepare(`
    UPDATE users SET
      full_name = ?, nim = ?, class_name = ?, department_key = ?, study_program_key = ?, updated_at = ?
    WHERE id = ?
  `).run(
    input.fullName,
    input.nim,
    input.className,
    program?.department || input.departmentKey,
    program?.key || '',
    now(),
    req.user.id,
  );
  audit(req.user.id, 'profile.updated', 'user', req.user.id, {});
  res.json({ user: publicUser(req.user.id) });
}));

function exposeChatSession(row) {
  if (!row) return null;
  return {
    ...row,
    isPinned: Boolean(row.is_pinned),
    configuration: parseJson(row.configuration_json, {}),
  };
}

function listChatAttachments(sessionId, ownerUserId) {
  return db.prepare(`
    SELECT id, kind, original_name, mime_type, detected_mime, size_bytes, created_at
    FROM chat_attachments
    WHERE session_id = ? AND owner_user_id = ? AND deleted_at IS NULL
    ORDER BY created_at ASC
  `).all(sessionId, ownerUserId);
}

function chatWorkflow(session, user) {
  const messages = db.prepare(`
    SELECT role, content FROM chat_messages
    WHERE session_id = ? AND owner_user_id = ?
    ORDER BY created_at ASC
  `).all(session.id, user.id);
  return assessChatReadiness({
    session,
    user,
    messages,
    attachments: listChatAttachments(session.id, user.id),
  });
}

function inferAttachmentKind(filename = '') {
  const extension = path.extname(filename).toLowerCase();
  if (['.pdf', '.docx', '.txt', '.md'].includes(extension)) return 'module';
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) return 'evidence';
  return 'data';
}

function copyChatAttachmentToDocument(documentId, ownerUserId, attachment) {
  const existing = db.prepare(`
    SELECT id FROM document_files
    WHERE document_id = ? AND owner_user_id = ? AND category = ? AND sha256 = ? AND deleted_at IS NULL
    LIMIT 1
  `).get(documentId, ownerUserId, attachment.kind, attachment.sha256);
  if (existing) return existing.id;
  const targetDir = path.join(config.uploadDir, ownerUserId, documentId, 'source');
  fs.mkdirSync(targetDir, { recursive: true });
  const storageName = `${nanoid()}-${sanitizeFilename(attachment.original_name)}`;
  const storagePath = path.join(targetDir, storageName);
  fs.copyFileSync(attachment.storage_path, storagePath);
  const id = nanoid();
  db.prepare(`
    INSERT INTO document_files (
      id, document_id, owner_user_id, category, original_name, storage_name, storage_path,
      mime_type, size_bytes, source_declaration, detected_mime, security_status, sha256, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'own', ?, 'pending', ?, ?)
  `).run(
    id, documentId, ownerUserId, attachment.kind, attachment.original_name, storageName, storagePath,
    attachment.mime_type, attachment.size_bytes, attachment.detected_mime, attachment.sha256, now(),
  );
  return id;
}

const landingMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'video/mp4', 'video/webm', 'video/ogg']);
    if (!allowed.has(file.mimetype)) return callback(new HttpError(400, 'Media landing hanya mendukung PNG, JPG, WEBP, PDF, MP4, atau WEBM.', 'LANDING_MEDIA_TYPE'));
    return callback(null, true);
  },
});

const featureUpdateMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp']);
    if (!allowed.has(file.mimetype)) return callback(new HttpError(400, 'Gambar update hanya mendukung PNG, JPG, atau WEBP.', 'FEATURE_UPDATE_MEDIA_TYPE'));
    return callback(null, true);
  },
});

const chatUploadStorage = multer.diskStorage({
  destination: (req, _file, callback) => {
    try {
      const directory = path.join(config.uploadDir, req.user.id, 'chat', req.params.id, 'staged');
      fs.mkdirSync(directory, { recursive: true });
      callback(null, directory);
    } catch (error) {
      callback(error);
    }
  },
  filename: (_req, file, callback) => callback(null, `${nanoid()}-${sanitizeFilename(file.originalname)}`),
});

const chatUpload = multer({
  storage: chatUploadStorage,
  limits: { fileSize: config.maxUploadBytes, files: config.maxFilesPerUpload },
  fileFilter: (_req, file, callback) => callback(null, acceptedExtensions.has(path.extname(file.originalname).toLowerCase())),
});

app.get('/api/chat/sessions', requireAuth, (req, res) => {
  const sessions = db.prepare(`
    SELECT id, title, department_key, study_program_key, structure_mode, course_group, sort_position, is_pinned, configuration_json, document_id, created_at, updated_at
    FROM chat_sessions WHERE owner_user_id = ? AND archived_at IS NULL ORDER BY is_pinned DESC, course_group COLLATE NOCASE ASC, sort_position ASC, updated_at DESC LIMIT 60
  `).all(req.user.id).map(exposeChatSession);
  res.json({ sessions });
});

app.post('/api/chat/sessions', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const input = chatSessionSchema.parse(req.body || {});
  const departmentKey = input.departmentKey || req.user.department_key || '';
  const studyProgramKey = input.studyProgramKey || req.user.study_program_key || '';
  if (departmentKey && !departments.some((department) => department.key === departmentKey)) throw new HttpError(400, 'Jurusan tidak valid.', 'INVALID_DEPARTMENT');
  if (studyProgramKey && !programs.some((program) => program.key === studyProgramKey && (!departmentKey || program.department === departmentKey))) throw new HttpError(400, 'Prodi tidak valid.', 'INVALID_PROGRAM');
  const id = nanoid();
  const courseGroup = (input.courseGroup || input.configuration.courseName || 'Belum dikelompokkan').trim().slice(0, 100) || 'Belum dikelompokkan';
  const configuration = {
    courseName: input.configuration.courseName || '',
    moduleTitle: input.configuration.moduleTitle || '',
    documentProfile: input.configuration.documentProfile || 'langkah',
    customStructure: input.configuration.customStructure || '',
    instructions: input.configuration.instructions || '',
    tone: input.configuration.tone || 'semi-formal',
    perspective: input.configuration.perspective || 'saya',
    allowExternalAi: input.configuration.allowExternalAi === true,
  };
  const sortPosition = Number(db.prepare('SELECT COALESCE(MAX(sort_position), -1) AS value FROM chat_sessions WHERE owner_user_id = ? AND course_group = ?').get(req.user.id, courseGroup)?.value || -1) + 1;
  db.prepare(`INSERT INTO chat_sessions (id, owner_user_id, title, department_key, study_program_key, structure_mode, course_group, sort_position, configuration_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, req.user.id, input.title, departmentKey, studyProgramKey, input.structureMode, courseGroup, sortPosition, JSON.stringify(configuration), now(), now());
  const greeting = input.structureMode === 'custom'
    ? 'Ceritakan tugas atau kirim bahan yang kamu punya. Aku akan mengecek konteks yang sudah cukup, menunjukkan yang masih kurang, lalu menyusun draft setelah bukti praktik tersedia.'
    : 'Ceritakan tugas atau kirim modul yang kamu punya. Aku akan mengecek kebutuhan laprak, meminta bagian yang masih kurang, lalu membuka pembuatan draft setelah bahanmu cukup.';
  db.prepare(`INSERT INTO chat_messages (id, session_id, owner_user_id, role, content, meta_json, created_at) VALUES (?, ?, ?, 'assistant', ?, ?, ?)`)
    .run(nanoid(), id, req.user.id, greeting, JSON.stringify({ kind: 'welcome' }), now());
  const session = exposeChatSession(db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id));
  res.status(201).json({ session, messages: db.prepare('SELECT id, role, content, meta_json, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at').all(id).map((message) => ({ ...message, meta: parseJson(message.meta_json, {}) })), attachments: [], workflow: chatWorkflow(session, req.user) });
}));

app.get('/api/chat/sessions/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL').get(req.params.id, req.user.id);
  if (!row) throw new HttpError(404, 'Percakapan tidak ditemukan.', 'CHAT_NOT_FOUND');
  const messages = db.prepare('SELECT id, role, content, meta_json, created_at FROM chat_messages WHERE session_id = ? AND owner_user_id = ? ORDER BY created_at ASC').all(row.id, req.user.id).map((message) => ({ ...message, meta: parseJson(message.meta_json, {}) }));
  res.json({ session: exposeChatSession(row), messages, attachments: listChatAttachments(row.id, req.user.id), workflow: chatWorkflow(row, req.user) });
});

app.put('/api/chat/sessions/:id', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const input = chatConfigUpdateSchema.parse(req.body || {});
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL').get(req.params.id, req.user.id);
  if (!session) throw new HttpError(404, 'Percakapan tidak ditemukan.', 'CHAT_NOT_FOUND');
  const departmentKey = input.departmentKey ?? session.department_key;
  const studyProgramKey = input.studyProgramKey ?? session.study_program_key;
  if (departmentKey && !departments.some((department) => department.key === departmentKey)) throw new HttpError(400, 'Jurusan tidak valid.', 'INVALID_DEPARTMENT');
  if (studyProgramKey && !programs.some((program) => program.key === studyProgramKey && (!departmentKey || program.department === departmentKey))) throw new HttpError(400, 'Prodi tidak valid.', 'INVALID_PROGRAM');
  const configuration = { ...parseJson(session.configuration_json, {}), ...(input.configuration || {}) };
  const courseGroup = (input.courseGroup ?? configuration.courseName ?? session.course_group ?? 'Belum dikelompokkan').trim().slice(0, 100) || 'Belum dikelompokkan';
  db.prepare(`UPDATE chat_sessions SET title = ?, department_key = ?, study_program_key = ?, structure_mode = ?, course_group = ?, sort_position = ?, configuration_json = ?, updated_at = ? WHERE id = ?`).run(
    input.title ?? session.title,
    departmentKey,
    studyProgramKey,
    input.structureMode ?? session.structure_mode,
    courseGroup,
    input.sortPosition ?? session.sort_position ?? 0,
    JSON.stringify(configuration),
    now(),
    session.id,
  );
  const updated = exposeChatSession(db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(session.id));
  audit(req.user.id, 'chat.config_updated', 'chat_session', session.id, { structureMode: updated.structure_mode });
  res.json({ session: updated });
}));

app.post('/api/chat/sessions/reorder', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const input = chatReorderSchema.parse(req.body || {});
  const ids = input.items.map((item) => item.id);
  const owned = db.prepare(`SELECT id FROM chat_sessions WHERE owner_user_id = ? AND archived_at IS NULL AND id IN (${ids.map(() => '?').join(',')})`).all(req.user.id, ...ids);
  if (owned.length !== ids.length) throw new HttpError(404, 'Salah satu chat tidak ditemukan.', 'CHAT_NOT_FOUND');
  const update = db.prepare('UPDATE chat_sessions SET course_group = ?, sort_position = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?');
  db.exec('BEGIN');
  try { input.items.forEach((item) => update.run((item.courseGroup || 'Belum dikelompokkan').slice(0, 100), item.sortPosition, now(), item.id, req.user.id)); db.exec('COMMIT'); } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
  audit(req.user.id, 'chat.reordered', 'chat_session', 'bulk', { count: input.items.length });
  res.json({ ok: true });
}));

app.post('/api/chat/sessions/:id/pin', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const input = pinSchema.parse(req.body || {});
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL').get(req.params.id, req.user.id);
  if (!session) throw new HttpError(404, 'Percakapan tidak ditemukan.', 'CHAT_NOT_FOUND');
  db.prepare('UPDATE chat_sessions SET is_pinned = ?, updated_at = ? WHERE id = ?').run(input.pinned ? 1 : 0, now(), session.id);
  const updated = exposeChatSession(db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(session.id));
  audit(req.user.id, input.pinned ? 'chat.pinned' : 'chat.unpinned', 'chat_session', session.id, {});
  res.json({ session: updated });
}));

app.post('/api/chat/sessions/:id/archive', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL').get(req.params.id, req.user.id);
  if (!session) throw new HttpError(404, 'Percakapan tidak ditemukan.', 'CHAT_NOT_FOUND');
  db.prepare('UPDATE chat_sessions SET archived_at = ?, updated_at = ? WHERE id = ?').run(now(), now(), session.id);
  audit(req.user.id, 'chat.archived', 'chat_session', session.id, {});
  res.json({ ok: true });
}));

app.delete('/api/chat/sessions/:id', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ?').get(req.params.id, req.user.id);
  if (!session) throw new HttpError(404, 'Percakapan tidak ditemukan.', 'CHAT_NOT_FOUND');
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM chat_attachments WHERE session_id = ? AND owner_user_id = ?').run(session.id, req.user.id);
    db.prepare('DELETE FROM chat_messages WHERE session_id = ? AND owner_user_id = ?').run(session.id, req.user.id);
    db.prepare('DELETE FROM chat_sessions WHERE id = ? AND owner_user_id = ?').run(session.id, req.user.id);
    db.exec('COMMIT');
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
  audit(req.user.id, 'chat.deleted', 'chat_session', session.id, {});
  res.json({ ok: true });
}));

app.post('/api/chat/sessions/:id/attachments', requireAuth, requireCsrf, chatUpload.array('files', config.maxFilesPerUpload), asyncHandler(async (req, res) => {
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL').get(req.params.id, req.user.id);
  if (!session) { removeUploadedFiles(req.files); throw new HttpError(404, 'Percakapan tidak ditemukan.', 'CHAT_NOT_FOUND'); }
  const input = chatAttachmentSchema.parse(req.body || {});
  const records = [];
  try {
    for (const file of req.files || []) {
      const extension = path.extname(file.originalname).toLowerCase();
      const buffer = fs.readFileSync(file.path);
      const detected = detectBufferType(buffer);
      if (!isSignatureCompatible(extension, detected)) {
        fs.unlinkSync(file.path);
        throw new HttpError(400, `Format ${file.originalname} tidak sesuai dengan isi file.`, 'FILE_SIGNATURE_MISMATCH');
      }
      const id = nanoid();
      const kind = input.kind || inferAttachmentKind(file.originalname);
      db.prepare(`INSERT INTO chat_attachments (id, session_id, owner_user_id, kind, original_name, storage_name, storage_path, mime_type, detected_mime, size_bytes, sha256, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, session.id, req.user.id, kind, file.originalname, file.filename, file.path, file.mimetype || mime.lookup(extension) || 'application/octet-stream', detected, file.size, sha256(buffer), now(),
      );
      if (session.document_id) {
        copyChatAttachmentToDocument(session.document_id, req.user.id, {
          kind,
          original_name: file.originalname,
          storage_path: file.path,
          mime_type: file.mimetype || mime.lookup(extension) || 'application/octet-stream',
          detected_mime: detected,
          size_bytes: file.size,
          sha256: sha256(buffer),
        });
      }
      records.push({ id, kind, original_name: file.originalname, mime_type: file.mimetype, size_bytes: file.size, created_at: now() });
    }
    if (records.length) {
      db.prepare(`INSERT INTO chat_messages (id, session_id, owner_user_id, role, content, meta_json, created_at) VALUES (?, ?, ?, 'assistant', ?, ?, ?)`)
        .run(nanoid(), session.id, req.user.id, session.document_id
          ? `${records.length} bahan disimpan dan disinkronkan ke dokumen kerja.`
          : `${records.length} bahan disimpan di percakapan ini dan akan ikut saat dokumen kerja dibuat.`, JSON.stringify({ kind: 'attachments', attachments: records.map((item) => item.id) }), now());
      db.prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?').run(now(), session.id);
    }
  } catch (error) {
    if (!(error instanceof HttpError)) removeUploadedFiles(req.files);
    throw error;
  }
  if (records.length) evaluateUploadBurstRisk(req.user.id);
  res.status(201).json({ attachments: listChatAttachments(session.id, req.user.id) });
}));

app.delete('/api/chat/sessions/:id/attachments/:attachmentId', requireAuth, requireCsrf, (req, res) => {
  const attachment = db.prepare(`SELECT * FROM chat_attachments WHERE id = ? AND session_id = ? AND owner_user_id = ? AND deleted_at IS NULL`).get(req.params.attachmentId, req.params.id, req.user.id);
  if (!attachment) throw new HttpError(404, 'Lampiran tidak ditemukan.', 'ATTACHMENT_NOT_FOUND');
  const deletedAt = now();
  const session = db.prepare('SELECT document_id FROM chat_sessions WHERE id = ? AND owner_user_id = ?').get(req.params.id, req.user.id);
  db.prepare('UPDATE chat_attachments SET deleted_at = ? WHERE id = ?').run(deletedAt, attachment.id);
  if (session?.document_id) {
    db.prepare(`
      UPDATE document_files SET deleted_at = ?
      WHERE document_id = ? AND owner_user_id = ? AND category = ? AND sha256 = ? AND original_name = ? AND deleted_at IS NULL
    `).run(deletedAt, session.document_id, req.user.id, attachment.kind, attachment.sha256, attachment.original_name);
  }
  try { fs.unlinkSync(attachment.storage_path); } catch { /* best effort */ }
  res.json({ ok: true, attachments: listChatAttachments(req.params.id, req.user.id) });
});

app.get('/api/chat/attachments/:id/preview', requireAuth, (req, res) => {
  const attachment = db.prepare(`SELECT * FROM chat_attachments WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL`).get(req.params.id, req.user.id);
  if (!attachment) throw new HttpError(404, 'Lampiran tidak ditemukan.', 'ATTACHMENT_NOT_FOUND');
  if (!String(attachment.mime_type || '').startsWith('image/')) throw new HttpError(415, 'Preview hanya tersedia untuk gambar.', 'PREVIEW_UNSUPPORTED');
  res.type(attachment.mime_type);
  res.sendFile(path.resolve(attachment.storage_path));
});

app.post('/api/chat/sessions/:id/messages', requireAuth, requireCsrf, aiChatLimiter, asyncHandler(async (req, res) => {
  const input = chatMessageSchema.parse(req.body || {});
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL').get(req.params.id, req.user.id);
  if (!session) throw new HttpError(404, 'Percakapan tidak ditemukan.', 'CHAT_NOT_FOUND');
  if (!input.allowExternalAi) {
    throw new HttpError(412, 'Aktifkan provider AI eksternal di Settings > Data controls untuk memakai chat AI.', 'AI_CONSENT_REQUIRED');
  }
  const aiModes = aiModeAccessForUser(req.user.id);
  if (!aiModes[input.aiMode]?.available) {
    const message = input.aiMode === 'xtrathink'
      ? 'Mode XtraThink hanya tersedia untuk subscription Max aktif.'
      : 'Mode Thinking membutuhkan pembelian credit Laprakin atau subscription Pro/Max aktif.';
    throw new HttpError(403, message, 'AI_MODE_LOCKED');
  }
  const links = Array.from(input.content.matchAll(/https?:\/\/[^\s)]+/g)).map((match) => match[0]).slice(0, 8);
  const assistant = config.geminiKey
    ? await answerWorkspaceChat({ session, user: req.user, content: input.content, aiMode: input.aiMode })
    : { text: 'Provider AI belum aktif di environment lokal ini. Isi GEMINI_API_KEY untuk menguji respons AI nyata.', model: 'local-unconfigured' };
  const timestamp = now();
  db.exec('BEGIN');
  try {
    db.prepare(`INSERT INTO chat_messages (id, session_id, owner_user_id, role, content, meta_json, created_at) VALUES (?, ?, ?, 'user', ?, ?, ?)`)
      .run(nanoid(), session.id, req.user.id, input.content, JSON.stringify({ links, aiMode: input.aiMode }), timestamp);
    db.prepare(`INSERT INTO chat_messages (id, session_id, owner_user_id, role, content, meta_json, created_at) VALUES (?, ?, ?, 'assistant', ?, ?, ?)`)
      .run(nanoid(), session.id, req.user.id, assistant.text, JSON.stringify({ aiMode: input.aiMode, provider: config.geminiKey ? 'gemini' : 'local', model: assistant.model, workflow: assistant.workflow || null }), timestamp);
    db.prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?').run(timestamp, session.id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  const workflow = chatWorkflow(session, req.user);
  if (workflow.stage !== 'intake' && (!session.title || /^laprak baru$/i.test(session.title.trim()))) {
    const cfg = parseJson(session.configuration_json, {});
    const candidate = [cfg.courseName, cfg.moduleTitle].filter(Boolean).join(' — ') || input.content.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
    const autoTitle = (candidate || 'Laprak baru').slice(0, 72);
    db.prepare(`UPDATE chat_sessions SET title = ?, course_group = CASE WHEN course_group = '' OR course_group = 'Belum dikelompokkan' THEN ? ELSE course_group END WHERE id = ?`).run(autoTitle, cfg.courseName || 'Belum dikelompokkan', session.id);
  }
  audit(req.user.id, 'ai.chat_completed', 'chat_session', session.id, { mode: input.aiMode, model: assistant.model, provider: config.geminiKey ? 'gemini' : 'local' });
  const messages = db.prepare('SELECT id, role, content, meta_json, created_at FROM chat_messages WHERE session_id = ? AND owner_user_id = ? ORDER BY created_at ASC').all(session.id, req.user.id).map((message) => ({ ...message, meta: parseJson(message.meta_json, {}) }));
  const refreshedSession = exposeChatSession(db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(session.id));
  res.json({ session: refreshedSession, messages, attachments: listChatAttachments(session.id, req.user.id), workflow: chatWorkflow(refreshedSession, req.user) });
}));

app.post('/api/chat/sessions/:id/document', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL').get(req.params.id, req.user.id);
  if (!session) throw new HttpError(404, 'Percakapan tidak ditemukan.', 'CHAT_NOT_FOUND');
  if (session.document_id) return res.json({ document: exposeDocument(db.prepare('SELECT * FROM documents WHERE id = ?').get(session.document_id)) });
  const workflow = chatWorkflow(session, req.user);
  if (!workflow.canCreateDocument) {
    throw new HttpError(422, `Konteks belum cukup untuk membuat dokumen. ${workflow.nextQuestion}`, 'CHAT_CONTEXT_INCOMPLETE');
  }
  const sessionConfiguration = parseJson(session.configuration_json, {});
  const messages = db.prepare(`SELECT content FROM chat_messages WHERE session_id = ? AND owner_user_id = ? AND role = 'user' ORDER BY created_at`).all(session.id, req.user.id);
  const title = session.title === 'Laprak baru' ? (sessionConfiguration.moduleTitle || sessionConfiguration.courseName || messages[0]?.content || 'Laprak baru').slice(0, 120) : session.title;
  const id = nanoid(); const timestamp = now();
  const recipe = { tone: sessionConfiguration.tone || 'semi-formal', perspective: sessionConfiguration.perspective || 'saya', includeConclusion: false, useTimesNewRoman: true, blackText: true, allowExternalAi: sessionConfiguration.allowExternalAi !== false, instructions: [sessionConfiguration.instructions || '', sessionConfiguration.customStructure ? `Struktur khusus: ${sessionConfiguration.customStructure}` : '', ...messages.map((message) => message.content)].filter(Boolean).join('\n').slice(0, 3000) };
  db.prepare(`INSERT INTO documents (id, owner_user_id, title, course_name, module_title, document_profile, recipe_json, priority, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'normal', 'draft', ?, ?)`)
    .run(id, req.user.id, title, sessionConfiguration.courseName || '', sessionConfiguration.moduleTitle || '', sessionConfiguration.documentProfile || (session.structure_mode === 'custom' ? 'proyek' : 'langkah'), JSON.stringify(recipe), timestamp, timestamp);
  const attachments = db.prepare(`SELECT * FROM chat_attachments WHERE session_id = ? AND owner_user_id = ? AND deleted_at IS NULL ORDER BY created_at`).all(session.id, req.user.id);
  for (const attachment of attachments) {
    copyChatAttachmentToDocument(id, req.user.id, attachment);
  }
  seedDocumentTasks(id, req.user.id, null);
  db.prepare('UPDATE chat_sessions SET document_id = ?, updated_at = ? WHERE id = ?').run(id, now(), session.id);
  db.prepare(`INSERT INTO chat_messages (id, session_id, owner_user_id, role, content, meta_json, created_at) VALUES (?, ?, ?, 'assistant', ?, ?, ?)`).run(nanoid(), session.id, req.user.id, `Laprak siap dibuat dari percakapan ini. ${attachments.length ? `${attachments.length} bahan sudah dibawa ke dokumen kerja.` : 'Kamu bisa menambah bahan dari ruang dokumen kapan saja.'}`, JSON.stringify({ documentId: id }), now());
  audit(req.user.id, 'chat.document_created', 'chat_session', session.id, { documentId: id, attachmentCount: attachments.length });
  res.status(201).json({ document: exposeDocument(db.prepare('SELECT * FROM documents WHERE id = ?').get(id)), workflow });
}));

app.get('/api/support/thread', requireAuth, (req, res) => {
  let thread = db.prepare('SELECT * FROM support_threads WHERE owner_user_id = ? ORDER BY updated_at DESC LIMIT 1').get(req.user.id);
  if (!thread) {
    thread = { id: nanoid(), owner_user_id: req.user.id, created_at: now(), updated_at: now() };
    db.prepare('INSERT INTO support_threads (id, owner_user_id, created_at, updated_at) VALUES (?, ?, ?, ?)').run(thread.id, req.user.id, thread.created_at, thread.updated_at);
  }
  const messages = db.prepare('SELECT id, role, content, scope_status, created_at FROM support_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT 80').all(thread.id);
  res.json({ thread, messages });
});

app.post('/api/support/message', requireAuth, requireCsrf, supportLimiter, asyncHandler(async (req, res) => {
  const input = supportMessageSchema.parse(req.body || {});
  let thread = db.prepare('SELECT * FROM support_threads WHERE owner_user_id = ? ORDER BY updated_at DESC LIMIT 1').get(req.user.id);
  if (!thread) {
    thread = { id: nanoid(), owner_user_id: req.user.id, created_at: now(), updated_at: now() };
    db.prepare('INSERT INTO support_threads (id, owner_user_id, created_at, updated_at) VALUES (?, ?, ?, ?)').run(thread.id, req.user.id, thread.created_at, thread.updated_at);
  }
  const decision = await answerScopedSupportMessage(input.content, req.user.id);
  db.prepare(`INSERT INTO support_messages (id, thread_id, owner_user_id, role, content, scope_status, created_at) VALUES (?, ?, ?, 'user', ?, ?, ?)`)
    .run(nanoid(), thread.id, req.user.id, input.content, decision.scopeStatus, now());
  db.prepare(`INSERT INTO support_messages (id, thread_id, owner_user_id, role, content, scope_status, created_at) VALUES (?, ?, ?, 'assistant', ?, ?, ?)`)
    .run(nanoid(), thread.id, req.user.id, decision.answer, decision.scopeStatus, now());
  db.prepare('UPDATE support_threads SET updated_at = ? WHERE id = ?').run(now(), thread.id);
  audit(req.user.id, 'support.message', 'support_thread', thread.id, { scopeStatus: decision.scopeStatus });
  if (decision.scopeStatus === 'out_of_scope') evaluateSupportScopeRisk(req.user.id);
  const messages = db.prepare('SELECT id, role, content, scope_status, created_at FROM support_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT 80').all(thread.id);
  res.json({ thread, messages, scopeStatus: decision.scopeStatus });
}));


app.get('/api/feedback', requireAuth, (req, res) => {
  const items = db.prepare(`SELECT * FROM feedback_items WHERE owner_user_id = ? ORDER BY updated_at DESC LIMIT 80`).all(req.user.id)
    .map((row) => ({ ...feedbackForOwner(row), replies: feedbackReplies(row.id, req.user.id) }));
  res.json({ items });
});

app.post('/api/feedback', requireAuth, requireCsrf, supportLimiter, asyncHandler(async (req, res) => {
  const input = feedbackSchema.parse(req.body || {});
  const id = nanoid();
  db.prepare(`INSERT INTO feedback_items (
    id, owner_user_id, category, rating, body, contact_allowed, allow_public_quote, public_alias, status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`)
    .run(id, req.user.id, input.category, input.rating, input.body, input.contactAllowed ? 1 : 0, input.allowPublicQuote ? 1 : 0, input.publicAlias, now(), now());
  audit(req.user.id, 'feedback.submitted', 'feedback', id, { category: input.category, rating: input.rating, allowPublicQuote: input.allowPublicQuote });
  res.status(201).json({ item: { ...feedbackForOwner(db.prepare('SELECT * FROM feedback_items WHERE id = ?').get(id)), replies: [] } });
}));

app.get('/api/dashboard', requireAuth, (req, res) => {
  const documentCounts = db.prepare(`
    SELECT status, COUNT(*) AS count FROM documents
    WHERE owner_user_id = ? AND deleted_at IS NULL GROUP BY status
  `).all(req.user.id);
  const recentDocuments = db.prepare(`
    SELECT id, title, course_name, status, updated_at, is_pinned, review_seconds, last_reviewed_at
    FROM documents WHERE owner_user_id = ? AND deleted_at IS NULL
    ORDER BY is_pinned DESC, updated_at DESC LIMIT 5
  `).all(req.user.id);
  const recentJobs = db.prepare(`
    SELECT id, document_id, job_type, status, progress, message, created_at
    FROM jobs WHERE owner_user_id = ? ORDER BY created_at DESC LIMIT 5
  `).all(req.user.id);
  const upcoming = db.prepare(`
    SELECT document.id, document.title, document.course_name, document.deadline_at, document.priority,
      SUM(CASE WHEN task.status = 'done' THEN 1 ELSE 0 END) AS tasks_done,
      COUNT(task.id) AS tasks_total
    FROM documents document
    LEFT JOIN document_tasks task ON task.document_id = document.id AND task.owner_user_id = document.owner_user_id
    WHERE document.owner_user_id = ? AND document.deleted_at IS NULL AND document.deadline_at IS NOT NULL AND document.deadline_at != ''
    GROUP BY document.id
    ORDER BY datetime(document.deadline_at) ASC LIMIT 5
  `).all(req.user.id);
  const openTasks = db.prepare(`
    SELECT task.id, task.title, task.due_at, task.document_id, document.title AS document_title
    FROM document_tasks task JOIN documents document ON document.id = task.document_id
    WHERE task.owner_user_id = ? AND task.status = 'todo' AND document.deleted_at IS NULL
    ORDER BY CASE WHEN task.due_at IS NULL OR task.due_at = '' THEN 1 ELSE 0 END, datetime(task.due_at) ASC, task.created_at ASC LIMIT 8
  `).all(req.user.id);
  const pinnedDocuments = db.prepare(`
    SELECT id, title, course_name, status, updated_at, deadline_at, priority
    FROM documents WHERE owner_user_id = ? AND deleted_at IS NULL AND is_pinned = 1
    ORDER BY updated_at DESC LIMIT 4
  `).all(req.user.id);
  const reviewReminders = db.prepare(`
    SELECT id, title, course_name, review_seconds, last_reviewed_at, updated_at
    FROM documents WHERE owner_user_id = ? AND deleted_at IS NULL AND status = 'generated'
    ORDER BY COALESCE(last_reviewed_at, updated_at) DESC LIMIT 4
  `).all(req.user.id);
  res.json({
    documents: Object.fromEntries(documentCounts.map((row) => [row.status, row.count])),
    recentDocuments,
    recentJobs,
    upcoming,
    openTasks,
    pinnedDocuments,
    reviewReminders,
    wallet: getWallet(req.user.id),
    subscription: activeSubscription(req.user.id),
  });
});

app.get('/api/documents', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM documents WHERE owner_user_id = ? AND deleted_at IS NULL ORDER BY is_pinned DESC, updated_at DESC
  `).all(req.user.id);
  res.json(rows.map(exposeDocument));
});

app.post('/api/documents', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const input = documentSchema.parse(req.body || {});
  const id = nanoid();
  const timestamp = now();
  db.prepare(`
    INSERT INTO documents (
      id, owner_user_id, title, course_name, module_title, lecturer_name, academic_year,
      document_profile, recipe_json, deadline_at, priority, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
  `).run(
    id,
    req.user.id,
    input.title,
    input.courseName,
    input.moduleTitle,
    input.lecturerName,
    input.academicYear,
    input.documentProfile,
    JSON.stringify(input.recipe),
    normalizeDateTime(input.deadlineAt),
    input.priority,
    timestamp,
    timestamp,
  );
  seedDocumentTasks(id, req.user.id, normalizeDateTime(input.deadlineAt));
  audit(req.user.id, 'document.created', 'document', id, { priority: input.priority, hasDeadline: Boolean(input.deadlineAt) });
  res.status(201).json(exposeDocument(db.prepare('SELECT * FROM documents WHERE id = ?').get(id)));
}));

app.get('/api/documents/trash', requireAuth, (req, res) => {
  res.json({ documents: listDeletedDocuments(req.user.id) });
});

app.get('/api/documents/:id', requireAuth, requireDocumentOwner, (req, res) => {
  res.json(exposeDocument(req.document));
});

app.post('/api/documents/:id/pin', requireAuth, requireCsrf, requireDocumentOwner, asyncHandler(async (req, res) => {
  const input = pinSchema.parse(req.body || {});
  db.prepare('UPDATE documents SET is_pinned = ?, updated_at = ? WHERE id = ?').run(input.pinned ? 1 : 0, now(), req.document.id);
  audit(req.user.id, input.pinned ? 'document.pinned' : 'document.unpinned', 'document', req.document.id, {});
  res.json(exposeDocument(db.prepare('SELECT * FROM documents WHERE id = ?').get(req.document.id)));
}));

app.post('/api/documents/:id/review-session', requireAuth, requireCsrf, requireDocumentOwner, asyncHandler(async (req, res) => {
  const input = reviewSessionSchema.parse(req.body || {});
  db.prepare('UPDATE documents SET review_seconds = COALESCE(review_seconds, 0) + ?, last_reviewed_at = ?, updated_at = ? WHERE id = ?').run(input.durationSeconds, now(), now(), req.document.id);
  audit(req.user.id, 'document.review_session_logged', 'document', req.document.id, { durationSeconds: input.durationSeconds });
  res.json(exposeDocument(db.prepare('SELECT * FROM documents WHERE id = ?').get(req.document.id)));
}));

app.put('/api/documents/:id', requireAuth, requireCsrf, requireDocumentOwner, asyncHandler(async (req, res) => {
  const input = documentSchema.parse(req.body || {});
  createVersion(req.document.id, req.user.id, 'Sebelum mengubah informasi laporan');
  db.prepare(`
    UPDATE documents SET
      title = ?, course_name = ?, module_title = ?, lecturer_name = ?, academic_year = ?,
      document_profile = ?, recipe_json = ?, deadline_at = ?, priority = ?, updated_at = ?
    WHERE id = ?
  `).run(
    input.title,
    input.courseName,
    input.moduleTitle,
    input.lecturerName,
    input.academicYear,
    input.documentProfile,
    JSON.stringify(input.recipe),
    normalizeDateTime(input.deadlineAt),
    input.priority,
    now(),
    req.document.id,
  );
  db.prepare(`UPDATE document_tasks SET due_at = ?, updated_at = ? WHERE document_id = ? AND owner_user_id = ? AND task_type != 'manual' AND status = 'todo'`).run(normalizeDateTime(input.deadlineAt), now(), req.document.id, req.user.id);
  audit(req.user.id, 'document.updated', 'document', req.document.id, {});
  res.json(exposeDocument(db.prepare('SELECT * FROM documents WHERE id = ?').get(req.document.id)));
}));

app.post('/api/documents/:id/duplicate', requireAuth, requireCsrf, requireDocumentOwner, (req, res) => {
  const source = req.document;
  const duplicateId = nanoid();
  const timestamp = now();
  db.prepare(`
    INSERT INTO documents (
      id, owner_user_id, title, course_name, module_title, lecturer_name, academic_year,
      document_profile, recipe_json, deadline_at, priority, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
  `).run(
    duplicateId,
    req.user.id,
    `${source.title} — salinan`,
    source.course_name,
    source.module_title,
    source.lecturer_name,
    source.academic_year,
    source.document_profile,
    source.recipe_json,
    null,
    source.priority || 'normal',
    timestamp,
    timestamp,
  );
  seedDocumentTasks(duplicateId, req.user.id, null);
  audit(req.user.id, 'document.duplicated', 'document', source.id, { duplicateId });
  res.status(201).json(exposeDocument(db.prepare('SELECT * FROM documents WHERE id = ?').get(duplicateId)));
});

app.delete('/api/documents/:id', requireAuth, requireCsrf, requireDocumentOwner, (req, res) => {
  db.prepare('UPDATE documents SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now(), now(), req.document.id);
  db.prepare('UPDATE document_files SET deleted_at = ? WHERE document_id = ? AND deleted_at IS NULL').run(now(), req.document.id);
  audit(req.user.id, 'document.deleted', 'document', req.document.id, {});
  res.status(204).end();
});

app.post('/api/documents/:id/restore', requireAuth, requireCsrf, (req, res) => {
  const document = restoreDeletedDocument(req.params.id, req.user.id);
  res.json(exposeDocument(document));
});

app.post(
  '/api/documents/:id/files',
  requireAuth,
  requireCsrf,
  requireDocumentOwner,
  uploadLimiter,
  upload.array('files', config.maxFilesPerUpload),
  (req, res, next) => {
    try {
      const existingCount = db.prepare(`
        SELECT COUNT(*) AS count FROM document_files WHERE document_id = ? AND deleted_at IS NULL
      `).get(req.document.id).count;
      const pending = req.files?.length || 0;
      if (existingCount + pending > config.maxFilesPerDocument) {
        removeUploadedFiles(req.files);
        throw new HttpError(400, `Maksimum ${config.maxFilesPerDocument} file per laporan.`, 'TOO_MANY_FILES');
      }

      const category = acceptedCategories.has(req.body.category) ? req.body.category : 'evidence';
      const declaration = normalizeSourceDeclaration(req.body.sourceDeclaration);
      const candidates = [];
      for (const file of req.files || []) {
        const extension = path.extname(file.originalname).toLowerCase();
        if (!acceptedExtensions.has(extension)) throw new HttpError(400, 'Tipe file tidak didukung.', 'UNSUPPORTED_FILE_TYPE');
        const bytes = fs.readFileSync(file.path);
        const detectedMime = detectBufferType(bytes);
        if (!isSignatureCompatible(extension, detectedMime)) {
          removeUploadedFiles(req.files);
          throw new HttpError(400, `Isi file ${sanitizeFilename(file.originalname)} tidak sesuai dengan ekstensi file.`, 'FILE_SIGNATURE_MISMATCH');
        }
        const digest = sha256(bytes);
        const duplicate = db.prepare(`
          SELECT id FROM document_files WHERE document_id = ? AND sha256 = ? AND deleted_at IS NULL
        `).get(req.document.id, digest);
        if (duplicate) {
          removeUploadedFiles(req.files);
          throw new HttpError(409, `File ${sanitizeFilename(file.originalname)} sudah pernah ditambahkan ke laporan ini.`, 'DUPLICATE_FILE');
        }
        candidates.push({ file, extension, detectedMime, digest });
      }

      const records = [];
      db.exec('BEGIN');
      try {
        for (const { file, detectedMime, digest } of candidates) {
          const id = nanoid();
          const mimeType = mime.lookup(file.originalname) || file.mimetype || 'application/octet-stream';
          db.prepare(`
            INSERT INTO document_files (
              id, document_id, owner_user_id, category, original_name, storage_name, storage_path,
              mime_type, detected_mime, sha256, security_status, size_bytes, source_declaration, is_extracted, created_at, deleted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'accepted', ?, ?, 0, ?, NULL)
          `).run(
            id,
            req.document.id,
            req.user.id,
            category,
            sanitizeFilename(file.originalname),
            file.filename,
            file.path,
            mimeType,
            detectedMime,
            digest,
            file.size,
            declaration,
            now(),
          );
          records.push({ id, originalName: file.originalname, category, sizeBytes: file.size, detectedMime, securityStatus: 'accepted' });
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        removeUploadedFiles(req.files);
        throw error;
      }
      audit(req.user.id, 'file.uploaded', 'document', req.document.id, { count: records.length, category, signatureChecked: true });
      const activeScan = db.prepare(`
        SELECT id FROM jobs WHERE document_id = ? AND job_type = 'scan' AND status IN ('queued', 'running') LIMIT 1
      `).get(req.document.id);
      const scanJobId = activeScan?.id || enqueueJob({ documentId: req.document.id, userId: req.user.id, jobType: 'scan' });
      res.status(201).json({ files: records, scanJobId });
    } catch (error) {
      next(error);
    }
  },
);

app.get('/api/files/:id/download', requireAuth, (req, res) => {
  const file = db.prepare(`
    SELECT * FROM document_files WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL
  `).get(req.params.id, req.user.id);
  if (!file) throw new HttpError(404, 'File tidak ditemukan.', 'FILE_NOT_FOUND');
  res.type(file.mime_type);
  res.download(file.storage_path, file.original_name);
});

app.delete('/api/files/:id', requireAuth, requireCsrf, (req, res) => {
  const file = db.prepare(`
    SELECT * FROM document_files WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL
  `).get(req.params.id, req.user.id);
  if (!file) throw new HttpError(404, 'File tidak ditemukan.', 'FILE_NOT_FOUND');
  db.prepare('UPDATE document_files SET deleted_at = ? WHERE id = ?').run(now(), file.id);
  db.prepare('DELETE FROM evidence_mappings WHERE file_id = ?').run(file.id);
  audit(req.user.id, 'file.deleted', 'file', file.id, { documentId: file.document_id });
  res.status(204).end();
});

app.post('/api/documents/:id/scan', requireAuth, requireCsrf, requireDocumentOwner, (req, res) => {
  ensureNoActiveJob(req.document.id, 'scan');
  const jobId = enqueueJob({ documentId: req.document.id, userId: req.user.id, jobType: 'scan' });
  res.status(202).json({ jobId });
});

app.post('/api/documents/:id/analyze', requireAuth, requireCsrf, requireDocumentOwner, (req, res) => {
  ensureNoActiveJob(req.document.id, 'analyze');
  const jobId = enqueueJob({ documentId: req.document.id, userId: req.user.id, jobType: 'analyze' });
  res.status(202).json({ jobId });
});

app.post('/api/documents/:id/generate', requireAuth, requireCsrf, requireDocumentOwner, (req, res) => {
  ensureNoActiveJob(req.document.id, 'generate');
  const files = db.prepare('SELECT * FROM document_files WHERE document_id = ? AND deleted_at IS NULL').all(req.document.id);
  const mappings = db.prepare('SELECT * FROM evidence_mappings WHERE document_id = ?').all(req.document.id);
  const readiness = assessDocumentGenerationReadiness({ document: req.document, user: req.user, files, mappings });
  if (!readiness.canGenerate) {
    throw new HttpError(422, `Draft belum bisa disusun. Lengkapi: ${readiness.missingForGenerate.map((item) => item.label).join(', ')}.`, 'DOCUMENT_INPUT_INCOMPLETE');
  }
  const recipe = parseJson(req.document.recipe_json, {});
  if (!recipe.allowExternalAi) throw new HttpError(412, 'Aktifkan pemrosesan AI eksternal sebelum menyusun draft.', 'AI_CONSENT_REQUIRED');
  if (!config.geminiKey) throw new HttpError(503, 'Provider AI belum tersedia. Draft tidak akan diganti dengan template kosong.', 'AI_PROVIDER_UNAVAILABLE');
  const entitlement = revisionEntitlementForUser(req.user.id);
  const isInitialDraft = !req.document.generated_at;
  const revisionCount = Number(req.document.revision_count || 0);
  if (!isInitialDraft && revisionCount >= entitlement.maxRevisions) {
    throw new HttpError(402, `Batas ${entitlement.maxRevisions} revisi untuk laprak ini sudah dipakai. Pilih paket yang sesuai untuk revisi lebih banyak.`, 'REVISION_LIMIT_REACHED');
  }
  const bucket = isInitialDraft ? consumeCredit(req.user.id, req.document.id) : null;
  const jobId = enqueueJob({
    documentId: req.document.id,
    userId: req.user.id,
    jobType: 'generate',
    payload: { creditBucket: bucket, isRevision: !isInitialDraft, revisionPlan: entitlement.plan },
  });
  evaluateGenerationBurstRisk(req.user.id);
  res.status(202).json({ jobId, bucket, isRevision: !isInitialDraft, revisionLimit: entitlement.maxRevisions, revisionsUsed: revisionCount });
});

app.get('/api/jobs/:id', requireAuth, (req, res) => {
  const job = db.prepare(`
    SELECT * FROM jobs WHERE id = ? AND owner_user_id = ?
  `).get(req.params.id, req.user.id);
  if (!job) throw new HttpError(404, 'Job tidak ditemukan.', 'JOB_NOT_FOUND');
  res.json(publicJob(job));
});

app.get('/api/documents/:id/jobs', requireAuth, requireDocumentOwner, (req, res) => {
  const jobs = db.prepare(`
    SELECT * FROM jobs WHERE document_id = ? AND owner_user_id = ? ORDER BY created_at DESC LIMIT 20
  `).all(req.document.id, req.user.id);
  res.json({ jobs: jobs.map(publicJob) });
});

app.post('/api/jobs/:id/retry', requireAuth, requireCsrf, (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND owner_user_id = ?').get(req.params.id, req.user.id);
  if (!job) throw new HttpError(404, 'Job tidak ditemukan.', 'JOB_NOT_FOUND');
  if (!['failed', 'canceled'].includes(job.status)) throw new HttpError(409, 'Hanya job gagal atau dibatalkan yang dapat dicoba ulang.', 'JOB_NOT_RETRYABLE');
  let payload = jobPayload(job);
  if (job.job_type === 'generate') {
    const document = db.prepare('SELECT generated_at FROM documents WHERE id = ? AND owner_user_id = ?').get(job.document_id, req.user.id);
    const bucket = document?.generated_at ? null : consumeCredit(req.user.id, job.document_id);
    payload = { ...payload, creditBucket: bucket, isRevision: Boolean(document?.generated_at) };
  }
  db.prepare(`
    UPDATE jobs SET status = 'queued', progress = 0, message = 'Masuk antrean ulang', error_message = NULL,
      finished_at = NULL, started_at = NULL, canceled_at = NULL, cancel_requested_at = NULL,
      run_after = NULL, max_attempts = ?, attempt_count = 0, payload_json = ?
    WHERE id = ?
  `).run(config.jobMaxAttempts, JSON.stringify(payload), job.id);
  recordJobEvent(job.id);
  audit(req.user.id, 'job.retried', 'document', job.document_id, { jobId: job.id, jobType: job.job_type });
  publishJob(job.id);
  queueMicrotask(drainJobQueue);
  res.status(202).json({ job: publicJob(db.prepare('SELECT * FROM jobs WHERE id = ?').get(job.id)) });
});

app.post('/api/jobs/:id/cancel', requireAuth, requireCsrf, (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND owner_user_id = ?').get(req.params.id, req.user.id);
  if (!job) throw new HttpError(404, 'Job tidak ditemukan.', 'JOB_NOT_FOUND');
  if (!['queued', 'running'].includes(job.status)) throw new HttpError(409, 'Job ini tidak dapat dibatalkan.', 'JOB_NOT_CANCELABLE');
  const payload = jobPayload(job);
  if (job.status === 'queued') {
    db.prepare(`UPDATE jobs SET status = 'canceled', message = 'Dibatalkan pengguna', canceled_at = ?, finished_at = ? WHERE id = ?`).run(now(), now(), job.id);
    if (job.job_type === 'generate' && payload.creditBucket) refundCredit(req.user.id, payload.creditBucket, job.document_id);
  } else {
    db.prepare(`UPDATE jobs SET cancel_requested_at = ?, message = 'Permintaan pembatalan diterima' WHERE id = ?`).run(now(), job.id);
  }
  recordJobEvent(job.id);
  audit(req.user.id, 'job.cancel_requested', 'document', job.document_id, { jobId: job.id, jobType: job.job_type, status: job.status });
  publishJob(job.id);
  res.json({ job: publicJob(db.prepare('SELECT * FROM jobs WHERE id = ?').get(job.id)) });
});

app.get('/api/documents/:id/events', requireAuth, requireDocumentOwner, (req, res) => {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const documentId = req.document.id;
  const listeners = documentStreams.get(documentId) || new Set();
  listeners.add(res);
  documentStreams.set(documentId, listeners);
  const currentJobs = db.prepare(`SELECT * FROM jobs WHERE document_id = ? AND owner_user_id = ? ORDER BY created_at DESC LIMIT 10`).all(documentId, req.user.id).map(publicJob);
  res.write(`event: snapshot\ndata: ${JSON.stringify({ jobs: currentJobs })}\n\n`);
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 15000);
  req.on('close', () => {
    clearInterval(heartbeat);
    listeners.delete(res);
    if (!listeners.size) documentStreams.delete(documentId);
  });
});

app.get('/api/documents/:id/parameters', requireAuth, requireDocumentOwner, (req, res) => {
  res.json(parameterIntegrity(req.document.id, req.user.id));
});

app.post('/api/documents/:id/parameters', requireAuth, requireCsrf, requireDocumentOwner, asyncHandler(async (req, res) => {
  const input = parameterSchema.parse(req.body || {});
  const parameter = createDocumentParameter(req.document.id, req.user.id, input);
  res.status(201).json({ parameter, integrity: parameterIntegrity(req.document.id, req.user.id) });
}));

app.put('/api/documents/:id/parameters/:parameterId', requireAuth, requireCsrf, requireDocumentOwner, asyncHandler(async (req, res) => {
  const input = parameterSchema.partial().parse(req.body || {});
  const parameter = updateDocumentParameter(req.document.id, req.params.parameterId, req.user.id, input);
  res.json({ parameter, integrity: parameterIntegrity(req.document.id, req.user.id) });
}));

app.delete('/api/documents/:id/parameters/:parameterId', requireAuth, requireCsrf, requireDocumentOwner, (req, res) => {
  deleteDocumentParameter(req.document.id, req.params.parameterId, req.user.id);
  res.status(204).end();
});

app.post('/api/documents/:id/tasks', requireAuth, requireCsrf, requireDocumentOwner, asyncHandler(async (req, res) => {
  const input = taskSchema.parse(req.body || {});
  const count = db.prepare('SELECT COUNT(*) AS count FROM document_tasks WHERE document_id = ?').get(req.document.id).count;
  const id = nanoid();
  db.prepare(`INSERT INTO document_tasks (id, document_id, owner_user_id, title, task_type, status, due_at, position, created_at, updated_at) VALUES (?, ?, ?, ?, 'manual', 'todo', ?, ?, ?, ?)`)
    .run(id, req.document.id, req.user.id, input.title, normalizeDateTime(input.dueAt) || req.document.deadline_at || null, Number(count) + 1, now(), now());
  audit(req.user.id, 'task.created', 'document', req.document.id, { taskId: id });
  res.status(201).json({ tasks: db.prepare(`SELECT * FROM document_tasks WHERE document_id = ? AND owner_user_id = ? ORDER BY status ASC, position ASC, created_at ASC`).all(req.document.id, req.user.id), summary: taskSummary(req.document.id, req.user.id) });
}));

app.put('/api/documents/:id/tasks/:taskId', requireAuth, requireCsrf, requireDocumentOwner, asyncHandler(async (req, res) => {
  const input = taskUpdateSchema.parse(req.body || {});
  const task = db.prepare(`SELECT * FROM document_tasks WHERE id = ? AND document_id = ? AND owner_user_id = ?`).get(req.params.taskId, req.document.id, req.user.id);
  if (!task) throw new HttpError(404, 'Checklist tidak ditemukan.', 'TASK_NOT_FOUND');
  db.prepare(`UPDATE document_tasks SET title = ?, status = ?, due_at = ?, position = ?, updated_at = ? WHERE id = ?`).run(
    input.title ?? task.title,
    input.status ?? task.status,
    input.dueAt === undefined ? task.due_at : normalizeDateTime(input.dueAt),
    input.position ?? task.position,
    now(), task.id,
  );
  audit(req.user.id, 'task.updated', 'document', req.document.id, { taskId: task.id, status: input.status || task.status });
  res.json({ tasks: db.prepare(`SELECT * FROM document_tasks WHERE document_id = ? AND owner_user_id = ? ORDER BY status ASC, position ASC, created_at ASC`).all(req.document.id, req.user.id), summary: taskSummary(req.document.id, req.user.id) });
}));

app.delete('/api/documents/:id/tasks/:taskId', requireAuth, requireCsrf, requireDocumentOwner, (req, res) => {
  const deleted = db.prepare(`DELETE FROM document_tasks WHERE id = ? AND document_id = ? AND owner_user_id = ?`).run(req.params.taskId, req.document.id, req.user.id);
  if (!deleted.changes) throw new HttpError(404, 'Checklist tidak ditemukan.', 'TASK_NOT_FOUND');
  audit(req.user.id, 'task.deleted', 'document', req.document.id, { taskId: req.params.taskId });
  res.status(204).end();
});

app.put('/api/documents/:id/note', requireAuth, requireCsrf, requireDocumentOwner, asyncHandler(async (req, res) => {
  const input = noteSchema.parse(req.body || {});
  const existing = db.prepare(`SELECT id FROM document_notes WHERE document_id = ? AND owner_user_id = ?`).get(req.document.id, req.user.id);
  if (existing) {
    db.prepare(`UPDATE document_notes SET body = ?, updated_at = ? WHERE id = ?`).run(input.body, now(), existing.id);
  } else {
    db.prepare(`INSERT INTO document_notes (id, document_id, owner_user_id, body, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(nanoid(), req.document.id, req.user.id, input.body, now(), now());
  }
  audit(req.user.id, 'document.note_updated', 'document', req.document.id, { length: input.body.length });
  res.json(db.prepare(`SELECT id, body, updated_at, created_at FROM document_notes WHERE document_id = ? AND owner_user_id = ?`).get(req.document.id, req.user.id));
}));

app.get('/api/documents/:id/mappings', requireAuth, requireDocumentOwner, (req, res) => {
  ensureEvidenceMappings(req.document.id);
  const mappings = db.prepare(`
    SELECT mapping.*, file.original_name, file.mime_type, file.source_declaration
    FROM evidence_mappings mapping
    JOIN document_files file ON file.id = mapping.file_id
    WHERE mapping.document_id = ? AND file.deleted_at IS NULL
    ORDER BY mapping.display_order
  `).all(req.document.id);
  res.json({ mappings, outline: parseJson(req.document.outline_json, []) });
});

app.put('/api/documents/:id/mappings/:mappingId', requireAuth, requireCsrf, requireDocumentOwner, asyncHandler(async (req, res) => {
  const input = updateMappingSchema.parse(req.body || {});
  const mapping = db.prepare(`
    SELECT * FROM evidence_mappings WHERE id = ? AND document_id = ?
  `).get(req.params.mappingId, req.document.id);
  if (!mapping) throw new HttpError(404, 'Pemetaan bukti tidak ditemukan.', 'MAPPING_NOT_FOUND');

  const sectionType = input.sectionType || mapping.section_type;
  if (!acceptedSectionTypes.has(sectionType)) {
    throw new HttpError(400, 'Section bukti tidak valid.', 'INVALID_SECTION_TYPE');
  }

  db.prepare(`
    UPDATE evidence_mappings SET
      step_number = ?, step_title = ?, section_type = ?, caption = ?, display_order = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).run(
    input.stepNumber === undefined ? mapping.step_number : input.stepNumber,
    input.stepTitle === undefined ? mapping.step_title : input.stepTitle,
    sectionType,
    input.caption === undefined ? mapping.caption : input.caption,
    input.displayOrder === undefined ? mapping.display_order : input.displayOrder,
    input.status === undefined ? mapping.status : input.status,
    now(),
    mapping.id,
  );
  ensureReviewChecks(req.document.id, req.user.id);
  audit(req.user.id, 'evidence.mapping_updated', 'document', req.document.id, { mappingId: mapping.id });
  res.json(db.prepare('SELECT * FROM evidence_mappings WHERE id = ?').get(mapping.id));
}));

app.put('/api/sections/:id', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const section = db.prepare(`
    SELECT section.*
    FROM report_sections section
    JOIN documents document ON document.id = section.document_id
    WHERE section.id = ? AND document.owner_user_id = ? AND document.deleted_at IS NULL
  `).get(req.params.id, req.user.id);
  if (!section) throw new HttpError(404, 'Bagian tidak ditemukan.', 'SECTION_NOT_FOUND');

  const input = updateSectionSchema.parse(req.body || {});
  createVersion(section.document_id, req.user.id, 'Sebelum mengubah section');
  db.prepare(`
    UPDATE report_sections SET title = ?, content = ?, review_status = ?, updated_at = ? WHERE id = ?
  `).run(input.title, input.content, input.reviewStatus, now(), section.id);
  ensureReviewChecks(section.document_id, req.user.id);
  audit(req.user.id, 'section.updated', 'section', section.id, { documentId: section.document_id });
  res.json(db.prepare('SELECT * FROM report_sections WHERE id = ?').get(section.id));
}));

app.get('/api/documents/:id/versions', requireAuth, requireDocumentOwner, (req, res) => {
  res.json({ versions: listVersions(req.document.id, req.user.id) });
});

app.post('/api/documents/:id/versions', requireAuth, requireCsrf, requireDocumentOwner, (req, res) => {
  const label = String(req.body?.label || 'Snapshot manual').slice(0, 120);
  const versionId = createVersion(req.document.id, req.user.id, label);
  res.status(201).json({ id: versionId, versions: listVersions(req.document.id, req.user.id) });
});

app.post('/api/documents/:id/versions/:versionId/restore', requireAuth, requireCsrf, requireDocumentOwner, (req, res) => {
  restoreVersion(req.document.id, req.params.versionId, req.user.id);
  res.json(exposeDocument(db.prepare('SELECT * FROM documents WHERE id = ?').get(req.document.id)));
});

app.get('/api/documents/:id/review', requireAuth, requireDocumentOwner, (req, res) => {
  res.json(getReviewState(req.document.id, req.user.id));
});

app.get('/api/documents/:id/readiness', requireAuth, requireDocumentOwner, (req, res) => {
  res.json(documentReadiness(req.document.id, req.user.id));
});

app.get('/api/documents/:id/activity', requireAuth, requireDocumentOwner, (req, res) => {
  res.json({ activity: documentActivity(req.document.id, req.user.id) });
});

app.put('/api/documents/:id/review/:checkKey', requireAuth, requireCsrf, requireDocumentOwner, (req, res) => {
  const status = req.body?.status;
  const note = req.body?.note || '';
  res.json(updateReviewCheck(req.document.id, req.user.id, req.params.checkKey, status, note));
});

app.post('/api/documents/:id/export', requireAuth, requireCsrf, requireDocumentOwner, asyncHandler(async (req, res) => {
  ensureNoActiveJob(req.document.id, 'export');
  const review = getReviewState(req.document.id, req.user.id);
  const files = db.prepare('SELECT * FROM document_files WHERE document_id = ? AND deleted_at IS NULL').all(req.document.id);
  const mappings = db.prepare('SELECT * FROM evidence_mappings WHERE document_id = ?').all(req.document.id);
  const sections = db.prepare('SELECT * FROM report_sections WHERE document_id = ? ORDER BY position').all(req.document.id);
  const parameters = listDocumentParameters(req.document.id, req.user.id);
  const readiness = assessDocumentGenerationReadiness({ document: req.document, user: req.user, files, mappings, sections, parameters });
  if (!readiness.canExport) {
    const missing = readiness.missingForExport.map((item) => item.label).concat(readiness.sectionIssues);
    throw new HttpError(422, `Dokumen belum siap diekspor. Perbaiki: ${missing.join(', ')}.`, 'DOCUMENT_QUALITY_INCOMPLETE');
  }
  const confirmedReviewed = Boolean(req.body?.confirmReviewed);
  if (!review.isComplete && !confirmedReviewed) {
    return res.status(409).json({
      error: {
        message: 'Baca ulang draft dan konfirmasi sebelum export.',
        code: 'REVIEW_INCOMPLETE',
        review,
      },
    });
  }
  const reviewMode = review.isComplete ? 'reviewed' : 'user_confirmed';
  const jobId = enqueueJob({
    documentId: req.document.id,
    userId: req.user.id,
    jobType: 'export',
    payload: { reviewMode },
    maxAttempts: 1,
  });
  if (!review.isComplete) audit(req.user.id, 'review.confirmed_for_export', 'document', req.document.id, {});
  res.status(202).json({ jobId, reviewMode });
}));

app.get('/api/exports/:id/download', requireAuth, (req, res) => {
  const output = db.prepare(`
    SELECT * FROM exports WHERE id = ? AND owner_user_id = ?
  `).get(req.params.id, req.user.id);
  if (!output) throw new HttpError(404, 'Export tidak ditemukan.', 'EXPORT_NOT_FOUND');
  if (output.expires_at && new Date(output.expires_at).getTime() <= Date.now()) {
    throw new HttpError(410, 'Masa simpan export sudah berakhir. Buat export baru dari dokumenmu.', 'EXPORT_EXPIRED');
  }
  res.download(output.storage_path, output.file_name);
});

app.get('/api/referral', requireAuth, (req, res) => {
  const user = db.prepare('SELECT referral_code FROM users WHERE id = ?').get(req.user.id);
  const referrals = db.prepare(`
    SELECT referral.*, invitee.email
    FROM referrals referral
    JOIN users invitee ON invitee.id = referral.invitee_user_id
    WHERE referral.referrer_user_id = ?
    ORDER BY referral.created_at DESC
  `).all(req.user.id).map((row) => ({
    ...row,
    email: row.email.replace(/(^.).*(@.*$)/, '$1***$2'),
  }));
  res.json({ code: user.referral_code, referrals });
});

app.post('/api/subscriptions/manual', requireAuth, requireCsrf, (req, res) => {
  const plan = req.body?.plan === 'pro' ? 'pro' : 'monthly';
  const subscription = activateSandboxSubscription(req.user.id, plan);
  res.status(201).json({ subscription, wallet: getWallet(req.user.id) });
});

app.post('/api/support-access', requireAuth, requireCsrf, (req, res) => {
  const documentId = String(req.body?.documentId || '');
  const reason = String(req.body?.reason || 'Butuh bantuan teknis').slice(0, 300);
  const document = db.prepare(`
    SELECT id FROM documents WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL
  `).get(documentId, req.user.id);
  if (!document) throw new HttpError(404, 'Dokumen tidak ditemukan.', 'DOCUMENT_NOT_FOUND');

  const id = nanoid();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO support_access (id, document_id, owner_user_id, reason, expires_at, revoked_at, created_at)
    VALUES (?, ?, ?, ?, ?, NULL, ?)
  `).run(id, documentId, req.user.id, reason, expiresAt, now());
  audit(req.user.id, 'support.access_granted', 'document', documentId, { expiresAt });
  res.status(201).json({ id, expiresAt });
});

app.get('/api/privacy/data-export', requireAuth, (req, res) => {
  const payload = JSON.stringify(dataExportForUser(req.user.id), null, 2);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="laprakin-data-export.json"');
  res.send(payload);
});

app.delete('/api/me', requireAuth, requireCsrf, (req, res) => {
  const confirmation = String(req.body?.confirmation || '').trim().toLowerCase();
  if (confirmation !== req.user.email) {
    throw new HttpError(400, 'Ketik email akunmu untuk mengonfirmasi penghapusan.', 'DELETE_CONFIRMATION_REQUIRED');
  }
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE users SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now(), now(), req.user.id);
    db.prepare('UPDATE documents SET deleted_at = ?, updated_at = ? WHERE owner_user_id = ?').run(now(), now(), req.user.id);
    db.prepare('UPDATE document_files SET deleted_at = ? WHERE owner_user_id = ? AND deleted_at IS NULL').run(now(), req.user.id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  audit(req.user.id, 'account.deleted', 'user', req.user.id, {});
  clearSession(res);
  res.status(204).end();
});

function requireAdmin(req, _res, next) {
  if (req.user.role !== 'admin') return next(new HttpError(403, 'Khusus admin.', 'ADMIN_ONLY'));
  return next();
}

app.get('/api/admin/overview', requireAuth, requireAdmin, (req, res) => {
  const stats = {
    users: Number(db.prepare('SELECT COUNT(*) AS count FROM users WHERE deleted_at IS NULL').get().count),
    documents: Number(db.prepare('SELECT COUNT(*) AS count FROM documents WHERE deleted_at IS NULL').get().count),
    queuedJobs: Number(db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE status IN ('queued', 'running')").get().count),
    failedJobs: Number(db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE status = 'failed'").get().count),
    openFeedback: Number(db.prepare("SELECT COUNT(*) AS count FROM feedback_items WHERE status IN ('open', 'reviewing')").get().count),
    openRiskEvents: Number(db.prepare("SELECT COUNT(*) AS count FROM risk_events WHERE status = 'open'").get().count),
    aiCalls24h: Number(db.prepare("SELECT COUNT(*) AS count FROM ai_usage_events WHERE datetime(created_at) >= datetime('now', '-24 hours')").get().count),
    aiTokens24h: Number(db.prepare("SELECT COALESCE(SUM(total_tokens), 0) AS count FROM ai_usage_events WHERE status = 'success' AND datetime(created_at) >= datetime('now', '-24 hours')").get().count),
    aiErrors24h: Number(db.prepare("SELECT COUNT(*) AS count FROM ai_usage_events WHERE status = 'error' AND datetime(created_at) >= datetime('now', '-24 hours')").get().count),
  };
  const storage = db.prepare(`
    SELECT
      (SELECT COALESCE(SUM(size_bytes), 0) FROM document_files WHERE deleted_at IS NULL) +
      (SELECT COALESCE(SUM(size_bytes), 0) FROM chat_attachments WHERE deleted_at IS NULL) AS bytes
  `).get();
  const dailyActivity = db.prepare(`
    SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count
    FROM audit_logs WHERE datetime(created_at) >= datetime('now', '-6 days')
    GROUP BY substr(created_at, 1, 10) ORDER BY day ASC
  `).all();
  const events = db.prepare(`
    SELECT id, subject_user_id, category, severity, summary, metadata_json, status, created_at, reviewed_at
    FROM risk_events ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'reviewed' THEN 1 ELSE 2 END, created_at DESC LIMIT 20
  `).all().map((row) => ({
    id: row.id,
    userRef: row.subject_user_id ? anonymousUserRef(row.subject_user_id) : 'Sistem',
    category: row.category,
    severity: row.severity,
    summary: row.summary,
    metadata: parseJson(row.metadata_json, {}),
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at || null,
  }));
  const jobs = db.prepare(`SELECT id, job_type, status, progress, message, created_at FROM jobs ORDER BY created_at DESC LIMIT 10`).all();
  res.json({ stats, storageBytes: Number(storage?.bytes || 0), dailyActivity, events, jobs });
});

app.get('/api/admin/ai/usage', requireAuth, requireAdmin, (req, res) => {
  const days = Math.max(1, Math.min(90, Number(req.query.days || 30) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const totals = db.prepare(`
    SELECT COUNT(*) AS calls,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successful,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS failed,
      COALESCE(SUM(input_tokens), 0) AS input_tokens,
      COALESCE(SUM(output_tokens), 0) AS output_tokens,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(ROUND(AVG(latency_ms)), 0) AS average_latency_ms
    FROM ai_usage_events WHERE created_at >= ?
  `).get(since);
  const breakdown = db.prepare(`
    SELECT purpose, mode, model, status, COUNT(*) AS calls,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(ROUND(AVG(latency_ms)), 0) AS average_latency_ms
    FROM ai_usage_events WHERE created_at >= ?
    GROUP BY purpose, mode, model, status
    ORDER BY calls DESC, purpose ASC
  `).all(since);
  const daily = db.prepare(`
    SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS calls,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors
    FROM ai_usage_events WHERE created_at >= ?
    GROUP BY substr(created_at, 1, 10) ORDER BY day ASC
  `).all(since);
  res.json({ days, since, totals, breakdown, daily });
});

app.post('/api/admin/integrations/check', requireAuth, requireCsrf, requireAdmin, integrationCheckLimiter, asyncHandler(async (req, res) => {
  const result = await verifyProductionIntegrations();
  audit(req.user.id, 'admin.integrations_checked', 'system', 'integrations', {
    ok: result.ok,
    gemini: result.gemini.ok,
    googleOidc: result.googleOidc.ok,
  });
  res.status(result.ok ? 200 : 503).json(result);
}));

app.get('/api/admin/feedback', requireAuth, requireAdmin, (req, res) => {
  const items = db.prepare(`
    SELECT * FROM feedback_items ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, updated_at DESC LIMIT 100
  `).all().map((row) => ({
    id: row.id,
    userRef: anonymousUserRef(row.owner_user_id),
    category: row.category,
    rating: row.rating,
    body: row.body,
    contactAllowed: Boolean(row.contact_allowed),
    allowPublicQuote: Boolean(row.allow_public_quote),
    publicAlias: row.public_alias || '',
    status: row.status,
    adminNote: row.admin_note || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    replies: feedbackReplies(row.id),
  }));
  res.json({ items });
});

app.put('/api/admin/feedback/:id/status', requireAuth, requireCsrf, requireAdmin, asyncHandler(async (req, res) => {
  const input = feedbackStatusSchema.parse(req.body || {});
  const feedback = db.prepare('SELECT * FROM feedback_items WHERE id = ?').get(req.params.id);
  if (!feedback) throw new HttpError(404, 'Feedback tidak ditemukan.', 'FEEDBACK_NOT_FOUND');
  db.prepare('UPDATE feedback_items SET status = ?, admin_note = ?, updated_at = ? WHERE id = ?').run(input.status, input.adminNote, now(), feedback.id);
  notifyUser(feedback.owner_user_id, {
    kind: 'feedback',
    title: 'Status feedback diperbarui',
    body: input.status === 'resolved' ? 'Masukanmu sudah ditandai selesai.' : 'Tim Laprakin sedang meninjau masukanmu.',
    href: '/app/feedback',
  });
  audit(req.user.id, 'admin.feedback_status_updated', 'feedback', feedback.id, { status: input.status });
  res.json({ item: feedbackForOwner(db.prepare('SELECT * FROM feedback_items WHERE id = ?').get(feedback.id)) });
}));

app.post('/api/admin/feedback/:id/reply', requireAuth, requireCsrf, requireAdmin, asyncHandler(async (req, res) => {
  const input = feedbackReplySchema.parse(req.body || {});
  const feedback = db.prepare('SELECT * FROM feedback_items WHERE id = ?').get(req.params.id);
  if (!feedback) throw new HttpError(404, 'Feedback tidak ditemukan.', 'FEEDBACK_NOT_FOUND');
  const replyId = nanoid();
  db.prepare('INSERT INTO feedback_replies (id, feedback_id, admin_user_id, body, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(replyId, feedback.id, req.user.id, input.body, now());
  db.prepare("UPDATE feedback_items SET status = CASE WHEN status = 'open' THEN 'reviewing' ELSE status END, updated_at = ? WHERE id = ?").run(now(), feedback.id);
  notifyUser(feedback.owner_user_id, { kind: 'feedback', title: 'Ada balasan untuk feedbackmu', body: 'Buka Feedback untuk membaca tanggapan dari tim Laprakin.', href: '/app/feedback' });
  audit(req.user.id, 'admin.feedback_replied', 'feedback', feedback.id, {});
  res.status(201).json({ reply: { id: replyId, body: input.body, createdAt: now() } });
}));

app.post('/api/admin/feedback/:id/promote-testimonial', requireAuth, requireCsrf, requireAdmin, asyncHandler(async (req, res) => {
  const feedback = db.prepare('SELECT * FROM feedback_items WHERE id = ?').get(req.params.id);
  if (!feedback) throw new HttpError(404, 'Feedback tidak ditemukan.', 'FEEDBACK_NOT_FOUND');
  if (!feedback.allow_public_quote) throw new HttpError(400, 'User belum memberi izin untuk mempublikasikan kutipan feedback.', 'TESTIMONIAL_CONSENT_REQUIRED');
  const content = getLandingContent();
  if (content.testimonials.length >= 8) throw new HttpError(400, 'Maksimal 8 testimoni pada landing.', 'TESTIMONIAL_LIMIT');
  content.testimonials.push({
    id: nanoid(10),
    quote: feedback.body.slice(0, 420),
    name: feedback.public_alias || 'Pengguna beta',
    label: 'Pengguna beta',
    published: false,
  });
  const saved = saveLandingContent(content, req.user.id);
  audit(req.user.id, 'admin.feedback_promoted_to_testimonial', 'feedback', feedback.id, {});
  res.json({ landing: saved });
}));

app.post('/api/admin/cms/landing-media', requireAuth, requireCsrf, requireAdmin, uploadLimiter, landingMediaUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Pilih file media terlebih dahulu.', 'LANDING_MEDIA_REQUIRED');
  const detectedMime = detectBufferType(req.file.buffer);
  if (detectedMime !== req.file.mimetype) throw new HttpError(400, 'Isi file media tidak cocok dengan format yang dipilih.', 'LANDING_MEDIA_SIGNATURE');
  const extension = {
    'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp',
    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/ogg': '.ogv',
  }[detectedMime];
  if (!extension) throw new HttpError(400, 'Format media tidak didukung.', 'LANDING_MEDIA_EXTENSION');
  fs.mkdirSync(config.landingMediaDir, { recursive: true });
  const filename = `landing-${Date.now()}-${nanoid(8)}${extension}`;
  fs.writeFileSync(path.join(config.landingMediaDir, filename), req.file.buffer, { flag: 'wx' });
  const type = detectedMime === 'application/pdf' ? 'pdf' : detectedMime.startsWith('video/') ? 'video' : 'image';
  const media = { url: `/api/public/landing-media/${filename}`, type, name: sanitizeFilename(req.file.originalname || filename), size: req.file.size };
  audit(req.user.id, 'admin.landing_media_uploaded', 'landing_media', filename, { mimeType: detectedMime, size: req.file.size });
  res.status(201).json({ media });
}));

app.get('/api/admin/cms/landing', requireAuth, requireAdmin, (_req, res) => {
  res.json({ landing: getLandingContent() });
});

app.put('/api/admin/cms/landing', requireAuth, requireCsrf, requireAdmin, asyncHandler(async (req, res) => {
  // Merge partial CMS updates to keep older production clients from erasing newer landing fields.
  const current = getLandingContent();
  const raw = req.body || {};
  const input = landingCmsSchema.parse({
    ...current,
    ...raw,
    announcement: { ...current.announcement, ...(raw.announcement || {}) },
    copy: { ...current.copy, ...(raw.copy || {}) },
    media: { ...current.media, ...(raw.media || {}), tutorialSlides: Array.isArray(raw.media?.tutorialSlides) ? raw.media.tutorialSlides : current.media?.tutorialSlides || [] },
    testimonials: Array.isArray(raw.testimonials) ? raw.testimonials : current.testimonials,
  });
  const landing = saveLandingContent(input, req.user.id);
  audit(req.user.id, 'admin.landing_cms_updated', 'cms', LANDING_CMS_KEY, { testimonialCount: landing.testimonials.length, announcementEnabled: landing.announcement.enabled, tutorialSlides: landing.media?.tutorialSlides?.length || 0, hasCompareMedia: Boolean(landing.media?.compareMediaUrl), hasHeroImage: Boolean(landing.media?.heroImageUrl) });
  res.json({ landing });
}));

app.get('/api/admin/feature-updates', requireAuth, requireAdmin, (_req, res) => {
  const updates = db.prepare(`
    SELECT feature_updates.*,
      (SELECT COUNT(*) FROM feature_update_receipts receipt WHERE receipt.update_id = feature_updates.id AND receipt.seen_at IS NOT NULL) AS seen_count,
      (SELECT COUNT(*) FROM feature_update_receipts receipt WHERE receipt.update_id = feature_updates.id AND receipt.opened_at IS NOT NULL) AS opened_count
    FROM feature_updates
    ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, datetime(updated_at) DESC
    LIMIT 100
  `).all().map((row) => ({ ...exposeFeatureUpdate(row), seenCount: Number(row.seen_count || 0), openedCount: Number(row.opened_count || 0) }));
  res.json({ updates });
});

app.post('/api/admin/feature-updates', requireAuth, requireCsrf, requireAdmin, asyncHandler(async (req, res) => {
  const input = normalizedFeatureUpdate(featureUpdateSchema.parse(req.body || {}));
  const id = nanoid();
  const timestamp = now();
  db.prepare(`
    INSERT INTO feature_updates (
      id, title, summary, body, version_label, highlights_json, image_url, image_name,
      cta_label, cta_path, audience, priority, status, published_at, expires_at,
      created_by_user_id, updated_by_user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.title, input.summary, input.body, input.versionLabel, JSON.stringify(input.highlights), input.imageUrl, input.imageName,
    input.ctaLabel, input.ctaPath, input.audience, input.priority, input.status, input.publishedAt, input.expiresAt,
    req.user.id, req.user.id, timestamp, timestamp,
  );
  audit(req.user.id, 'admin.feature_update_created', 'feature_update', id, { status: input.status, audience: input.audience });
  res.status(201).json({ update: exposeFeatureUpdate(db.prepare('SELECT * FROM feature_updates WHERE id = ?').get(id)) });
}));

app.put('/api/admin/feature-updates/:id', requireAuth, requireCsrf, requireAdmin, asyncHandler(async (req, res) => {
  const current = db.prepare('SELECT * FROM feature_updates WHERE id = ?').get(req.params.id);
  if (!current) throw new HttpError(404, 'Update fitur tidak ditemukan.', 'FEATURE_UPDATE_NOT_FOUND');
  const input = normalizedFeatureUpdate(featureUpdateSchema.parse(req.body || {}));
  db.prepare(`
    UPDATE feature_updates SET
      title = ?, summary = ?, body = ?, version_label = ?, highlights_json = ?, image_url = ?, image_name = ?,
      cta_label = ?, cta_path = ?, audience = ?, priority = ?, status = ?, published_at = ?, expires_at = ?,
      updated_by_user_id = ?, updated_at = ?
    WHERE id = ?
  `).run(
    input.title, input.summary, input.body, input.versionLabel, JSON.stringify(input.highlights), input.imageUrl, input.imageName,
    input.ctaLabel, input.ctaPath, input.audience, input.priority, input.status, input.publishedAt, input.expiresAt,
    req.user.id, now(), current.id,
  );
  audit(req.user.id, 'admin.feature_update_updated', 'feature_update', current.id, { status: input.status, audience: input.audience });
  res.json({ update: exposeFeatureUpdate(db.prepare('SELECT * FROM feature_updates WHERE id = ?').get(current.id)) });
}));

app.delete('/api/admin/feature-updates/:id', requireAuth, requireCsrf, requireAdmin, (req, res) => {
  const update = db.prepare('SELECT * FROM feature_updates WHERE id = ?').get(req.params.id);
  if (!update) throw new HttpError(404, 'Update fitur tidak ditemukan.', 'FEATURE_UPDATE_NOT_FOUND');
  db.prepare("UPDATE feature_updates SET status = 'archived', updated_by_user_id = ?, updated_at = ? WHERE id = ?").run(req.user.id, now(), update.id);
  audit(req.user.id, 'admin.feature_update_archived', 'feature_update', update.id, {});
  res.status(204).end();
});

app.post('/api/admin/feature-updates/:id/image', requireAuth, requireCsrf, requireAdmin, uploadLimiter, featureUpdateMediaUpload.single('file'), asyncHandler(async (req, res) => {
  const update = db.prepare('SELECT * FROM feature_updates WHERE id = ?').get(req.params.id);
  if (!update) throw new HttpError(404, 'Simpan draft update sebelum mengunggah gambar.', 'FEATURE_UPDATE_NOT_FOUND');
  if (!req.file) throw new HttpError(400, 'Pilih gambar terlebih dahulu.', 'FEATURE_UPDATE_IMAGE_REQUIRED');
  const detectedMime = detectBufferType(req.file.buffer);
  if (detectedMime !== req.file.mimetype || !['image/png', 'image/jpeg', 'image/webp'].includes(detectedMime)) {
    throw new HttpError(400, 'Isi file tidak cocok dengan format gambar yang dipilih.', 'FEATURE_UPDATE_IMAGE_SIGNATURE');
  }
  const extension = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }[detectedMime];
  fs.mkdirSync(config.featureUpdateMediaDir, { recursive: true });
  const filename = `update-${Date.now()}-${nanoid(10)}${extension}`;
  const storagePath = path.join(config.featureUpdateMediaDir, filename);
  fs.writeFileSync(storagePath, req.file.buffer, { flag: 'wx' });
  const imageUrl = `/api/public/update-media/${filename}`;
  const imageName = sanitizeFilename(req.file.originalname || filename);
  db.prepare('UPDATE feature_updates SET image_url = ?, image_name = ?, updated_by_user_id = ?, updated_at = ? WHERE id = ?')
    .run(imageUrl, imageName, req.user.id, now(), update.id);
  audit(req.user.id, 'admin.feature_update_image_uploaded', 'feature_update', update.id, { mimeType: detectedMime, size: req.file.size });
  res.status(201).json({ update: exposeFeatureUpdate(db.prepare('SELECT * FROM feature_updates WHERE id = ?').get(update.id)) });
}));

app.put('/api/admin/risk-events/:id', requireAuth, requireCsrf, requireAdmin, asyncHandler(async (req, res) => {
  const input = riskStatusSchema.parse(req.body || {});
  const event = db.prepare('SELECT * FROM risk_events WHERE id = ?').get(req.params.id);
  if (!event) throw new HttpError(404, 'Kejadian tidak ditemukan.', 'RISK_EVENT_NOT_FOUND');
  db.prepare('UPDATE risk_events SET status = ?, reviewer_user_id = ?, reviewed_at = ? WHERE id = ?').run(input.status, req.user.id, now(), event.id);
  audit(req.user.id, 'admin.risk_event_reviewed', 'risk_event', event.id, { status: input.status });
  res.json({ id: event.id, status: input.status });
}));

app.get('/api/admin/audit', requireAuth, requireAdmin, (req, res) => {
  const events = db.prepare(`SELECT id, actor_user_id, action, target_type, target_id, metadata_json, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 100`).all()
    .map((row) => ({
      id: row.id,
      actorRef: row.actor_user_id ? anonymousUserRef(row.actor_user_id) : 'Sistem',
      action: row.action,
      targetType: row.target_type,
      metadata: parseJson(row.metadata_json, {}),
      createdAt: row.created_at,
    }));
  res.json({ events });
});

app.post('/api/admin/retention/run', requireAuth, requireCsrf, requireAdmin, asyncHandler(async (req, res) => {
  const result = await cleanupExpiredResources();
  audit(req.user.id, 'retention.cleanup_run', 'system', 'retention', result);
  res.json(result);
}));


fs.mkdirSync(config.landingMediaDir, { recursive: true });
fs.mkdirSync(config.featureUpdateMediaDir, { recursive: true });
app.use('/api/public/landing-media', express.static(config.landingMediaDir, { index: false, maxAge: '1h', fallthrough: false }));
app.use('/api/public/update-media', express.static(config.featureUpdateMediaDir, {
  index: false,
  maxAge: '1h',
  fallthrough: false,
  setHeaders: (res) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));

app.use('/api', (req, res) => res.status(404).json({
  error: { message: 'Endpoint tidak ditemukan.', code: 'NOT_FOUND', requestId: req.requestId },
}));

if ((config.isProd || config.serveStatic) && fs.existsSync(config.staticClientDir)) {
  app.use(express.static(config.staticClientDir, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(path.join(config.staticClientDir, 'index.html')));
}

app.use((err, req, res, _next) => {
  const status = err.status || 500;
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: {
        message: err.issues[0]?.message || 'Input tidak valid.',
        code: 'VALIDATION_ERROR',
        requestId: req.requestId,
      },
    });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: {
        message: `Ukuran file maksimal ${config.maxUploadBytes / 1024 / 1024} MB.`,
        code: 'FILE_TOO_LARGE',
        requestId: req.requestId,
      },
    });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(413).json({
      error: {
        message: `Maksimum ${config.maxFilesPerUpload} file sekali upload.`,
        code: 'TOO_MANY_FILES',
        requestId: req.requestId,
      },
    });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: { message: 'Upload file tidak valid.', code: err.code, requestId: req.requestId },
    });
  }

  if (status >= 500) console.error(`[${req.requestId}]`, err);
  return res.status(status).json({
    error: {
      message: status >= 500 ? 'Terjadi kesalahan pada server.' : (err.message || 'Permintaan tidak dapat diproses.'),
      code: err.code || 'INTERNAL_ERROR',
      requestId: req.requestId,
    },
  });
});

recoverInterruptedJobs();
queueMicrotask(drainJobQueue);
setInterval(() => { drainJobQueue().catch((error) => console.error('[jobs]', error)); }, config.jobPollMs).unref();
setInterval(() => { cleanupExpiredResources().catch((error) => console.error('[retention]', error)); }, config.retentionSweepMinutes * 60 * 1000).unref();

const server = app.listen(config.port, () => {
  console.log(`Laprakin API berjalan pada http://localhost:${config.port}`);
});

function shutdown(signal) {
  console.log(`${signal} diterima. Menutup Laprakin API dengan aman...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 8000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
