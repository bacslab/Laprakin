import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import mime from 'mime-types';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { config, validateProductionConfig } from './config.js';
import { openSafeZip, validateArchiveFile } from './archive-safety.js';
import { audit, db, toUser } from './db.js';
import {
  AccountRestrictionEmail,
  AdminSecurityAlertEmail,
  AppealResultEmail,
  accountRestrictionText,
  adminSecurityAlertText,
  appealResultText,
} from './emails/templates.js';
import { EMAIL_LOGO_URL } from './emails/_components/email-layout.js';
import { capitalizeInitial } from './emails/text.js';
import { verifyProductionIntegrations } from './integrations.js';
import { captureAiRuntimeConfiguration, getAiReadiness, initializeAiModelRegistry, isAiConfigured } from './ai.js';
import { getExternalAiConsent, recordExternalAiConsent, requireExternalAiConsent, revokeExternalAiConsent } from './external-ai-consent.js';
import { buildRevisionPlan, RevisionError, validateRevisionRequest } from './chat-revisions.js';
import { moderationMessage, moderateText } from './content-safety.js';
import { createLogger, reportException, statusSnapshot } from './observability.js';
import { createSseChannel } from './chat-stream.js';
import { CHAT_MESSAGE_OPERATION, runCanonicalChatMutation } from './chat-message-mutation.js';
import { getMutationSnapshot } from './mutation-requests.js';
import { getMessageReactionAnalytics, removeMessageReaction, setMessageReaction } from './message-reactions.js';
import { listAdminAudit, recordAdminAudit } from './admin-audit.js';
import { BreakGlassError, createBreakGlassGrant, findActiveBreakGlassGrant, revokeBreakGlassGrant } from './admin-break-glass.js';
import { adminListPage, parseAdminListQuery } from './admin-list-query.js';
import { buildAdminMonitoringWhere } from './admin-monitoring.js';
import { ADMIN_SEARCH_FEATURES, normalizeAdminSearchQuery, rankAdminSearchResults } from './admin-search.js';
import { registerAdminAiRoutes } from './admin-ai-routes.js';
import { capabilitiesForUser, hasCapability, isPrivilegedUser, requireCapability } from './admin-capabilities.js';
import { createTotpSecret, getAdminMfaStatus, verifyTotpCode, adminMfaRequired } from './mfa.js';
import { checkPasswordBreach } from './password-breach.js';
import {
  analyzeChatRequest,
  assessChatReadiness,
  assessDocumentGenerationReadiness,
  defaultChatSourceStatus,
  generateChatTitle,
  inferChatContext,
  isPlausibleAcademicContext,
} from './report-quality.js';
import { addDays, asyncHandler, hmac, HttpError, now, opaqueStorageName, parseJson, randomToken, sanitizeFilename, sha256, detectBufferType } from './utils.js';
import {
  activateSandboxSubscription,
  analyzeDocument,
  authenticateUser,
  claimWelcomeCredits,
  clearSession,
  consumeCredit,
  createChatWorkPlan,
  createUser,
  createVersion,
  dataExportForUser,
  buildDocumentDocxBuffer,
  exportDocumentDocx,
  getReviewState,
  getWallet,
  listVersions,
  observeDevice,
  publicUser,
  persistChatExchange,
  refundCredit,
  refundLaprakCredit,
  reserveLaprakCredit,
  requireAuth,
  requireCsrf,
  restoreVersion,
  setSession,
  updateReviewCheck,
  generateDocument,
  ensureEvidenceMappings,
  ensureReviewChecks,
  activeSubscription,
  assertAccessAllowed,
  notifyUser,
  queueTransactionalEmail,
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
  prepareDocumentEvidence,
  listDeletedDocuments,
  restoreDeletedDocument,
  answerScopedSupportMessage,
  answerWorkspaceChat,
  validateDocumentRevision,
  summarizeDocumentWorkResult,
  createGoogleAuthorizationState,
  finishGoogleAuthorization,
  grantCredit,
  billingSummaryForUser,
  createDocumentQuizAttempt,
  submitDocumentQuizAttempt,
  quizAccessForDocument,
  extractText,
  syncConfiguredAdminAccount,
} from './services.js';

const WORKSPACE_CHAT_PROMPT_REVISION = 'workspace-chat-v1';

const FRIENDLY_AI_RETRY_MESSAGE = 'Laprakin masih menyiapkan hasilmu. Bahan tetap tersimpan aman dan proses akan dilanjutkan otomatis.';
const FRIENDLY_AI_NOT_READY_MESSAGE = 'Laprakin sedang menyiapkan layanan. Coba kembali sebentar lagi.';
const TECHNICAL_AI_ERROR_PATTERN = /^(?:AI_|NARAROUTER_|CLOUDFLARE_)|(?:^|_)(?:AI|NARAROUTER|CLOUDFLARE)(?:_|$)|resource_exhausted|ai_provider_error|ai_schema_invalid|ai_output_truncated|ai_capacity_unavailable|ai_vision_unavailable/i;

function isTechnicalAiError(error) {
  if (error?.name === 'AiProviderError') return true;
  const code = String(error?.code || '');
  if (/^(?:AI_CONSENT_REQUIRED|AI_CONSENT_MANIFEST_CHANGED|AI_MODE_LOCKED|DEVICE_REGISTRATION_LIMIT|REGISTRATION_RISK_LIMIT|RATE_LIMIT_EXCEEDED)$/i.test(code)) return false;
  return TECHNICAL_AI_ERROR_PATTERN.test(code);
}

function friendlyErrorMessage(error, status) {
  if (isTechnicalAiError(error)) return status === 503 ? FRIENDLY_AI_NOT_READY_MESSAGE : FRIENDLY_AI_RETRY_MESSAGE;
  return status >= 500 ? 'Permintaan belum berhasil diproses. Silakan coba beberapa saat lagi.' : (error?.message || 'Permintaan belum dapat diproses.');
}

function friendlyErrorCode(error) {
  return isTechnicalAiError(error) ? 'REQUEST_NOT_COMPLETED' : (error?.code || 'INTERNAL_ERROR');
}

function actorClass(req) {
  if (req.user?.role === 'admin') return 'admin';
  return req.user ? 'user' : 'anonymous';
}

function enforceContentPolicy({ text, userId, sessionId, direction = 'input', targetType = 'chat_session' }) {
  const decision = moderateText(text, direction);
  if (decision.action === 'allow') return decision;
  audit(userId, 'content_policy.blocked', targetType, sessionId, { direction, code: decision.code });
  throw new HttpError(422, moderationMessage(decision.code, direction), 'CONTENT_POLICY_BLOCKED');
}
import {
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
import { PLAN_SKUS, planBenefits } from './pricing-config.js';

validateProductionConfig();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxyHops || false);
const logger = createLogger({ level: config.logLevel });

const securityCspDirectives = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"],
  formAction: ["'self'"],
  scriptSrc: ["'self'", 'https://*.midtrans.com', 'https://*.veritrans.co.id', 'https://*.mixpanel.com', 'https://*.google-analytics.com'],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:', 'blob:', 'https://*.cloudfront.net', 'https://*.midtrans.com', 'https://*.veritrans.co.id', 'https://*.mixpanel.com', 'https://*.google-analytics.com'],
  mediaSrc: ["'self'", 'blob:'],
  fontSrc: ["'self'", 'data:'],
  connectSrc: ["'self'", 'https://*.midtrans.com', 'https://*.veritrans.co.id', 'https://*.mixpanel.com', 'https://*.google-analytics.com'],
  frameSrc: ['https://*.midtrans.com', 'https://*.veritrans.co.id'],
};

app.use(helmet({
  contentSecurityPolicy: { directives: securityCspDirectives },
  frameguard: { action: 'deny' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: config.isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
}));
app.use(cors({
  origin(origin, callback) { callback(null, !origin || config.allowedOrigins.includes(origin)); },
  credentials: true,
  allowedHeaders: ['Content-Type', 'X-Laprakin-Device', 'X-Laprakin-Client-Profile', 'X-Laprakin-CSRF'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

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

const securePasswordSchema = z.string()
  .min(12, 'Kata sandi minimal 12 karakter.')
  .max(64, 'Kata sandi maksimal 64 karakter.')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Kata sandi terlalu panjang untuk diproses dengan aman.');

async function enforcePasswordSafety(password) {
  if (!config.passwordBreachCheck) return;
  const result = await checkPasswordBreach(password);
  if (result.breached) throw new HttpError(400, 'Kata sandi ini pernah muncul dalam kebocoran data. Pilih kata sandi yang berbeda.', 'PASSWORD_BREACHED');
  if (!result.checked) logger.warn({ errorCode: 'PASSWORD_BREACH_CHECK_UNAVAILABLE' }, 'password breach check unavailable');
}

const registerSchema = z.object({
  email: z.string().email('Masukkan email yang valid.'),
  password: securePasswordSchema,
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
  password: securePasswordSchema,
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Kata sandi saat ini wajib diisi.').max(200),
  newPassword: securePasswordSchema,
});

const profileSchema = z.object({
  fullName: z.string().trim().max(100).optional(),
  nickname: z.string().trim().max(20, 'Nama panggilan maksimal 20 karakter.')
    .refine((value) => !value || /^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u.test(value), 'Nama panggilan hanya boleh berisi huruf, spasi, apostrof, titik, atau tanda hubung.')
    .optional(),
  nim: z.string().trim().max(40).optional(),
  className: z.string().trim().max(40).optional(),
  institutionName: z.string().trim().max(120).optional(),
  institutionLogoUrl: z.string().trim().max(500).optional(),
  facultyName: z.string().trim().max(120).optional(),
  studyProgramName: z.string().trim().max(120).optional(),
  lecturerName: z.string().trim().max(150).optional(),
  lecturerNip: z.string().trim().max(60).optional(),
  departmentKey: z.string().trim().max(24).optional(),
  studyProgramKey: z.string().trim().max(48).optional(),
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
    tone: z.enum(['semi-formal', 'formal']).optional().default('formal'),
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
  tone: z.enum(['semi-formal', 'formal']).optional().default('formal'),
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
  requestId: z.string().trim().min(12).max(120).regex(/^[a-zA-Z0-9._:-]+$/),
  content: z.string().trim().min(1).max(1800),
  aiMode: z.enum(['basic', 'thinking', 'xtrathink']).optional().default('basic'),
  allowExternalAi: z.boolean().optional().default(false),
});
const messageReactionSchema = z.object({
  reaction: z.enum(['like', 'dislike']),
  reasonCode: z.enum(['', 'inaccurate', 'unclear', 'unhelpful', 'unsafe', 'other']).optional().default(''),
});
const externalAiConsentSchema = z.object({
  manifestVersion: z.string().trim().min(1).max(80),
  policyVersion: z.string().trim().min(1).max(80),
  sourceSurface: z.enum(['workspace_settings', 'composer_first_use', 'onboarding']),
});
const chatActionSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
  type: z.enum([
    'OPEN_SOURCE_UPLOAD',
    'CONTINUE_WITHOUT_SOURCE',
    'SUBMIT_CLARIFICATION',
    'DOCUMENT_READY',
  ]),
  payload: z.object({
    sourceType: z.enum(['all', 'module', 'instruction', 'practice_evidence', 'template', 'supporting_document']).optional(),
    availability: z.enum(['not_available', 'skipped']).optional(),
    documentType: z.enum(['lab_report', 'proposal', 'paper', 'journal', 'final_project']).optional(),
    courseName: z.string().trim().max(150).optional(),
    practiceTopic: z.string().trim().max(150).optional(),
    answer: z.string().trim().max(500).optional(),
    forceFromSources: z.boolean().optional(),
    aiMode: z.enum(['basic', 'thinking', 'xtrathink']).optional(),
  }).optional().default({}),
});
const chatReorderSchema = z.object({
  items: z.array(z.object({ id: z.string().min(4).max(80), courseGroup: z.string().trim().max(100).optional().default(''), sortPosition: z.number().int().min(0).max(10000) })).min(1).max(80),
});
const chatAttachmentSchema = z.object({
  kind: z.enum(['module', 'instruction', 'practice_evidence', 'template', 'supporting_document', 'unknown', 'evidence', 'data']).optional(),
  finalize: z.enum(['true', 'false']).optional().default('true').transform((value) => value === 'true'),
});
const chatAttachmentCategorySchema = z.object({
  kind: z.enum(['module', 'instruction', 'practice_evidence', 'template', 'supporting_document', 'unknown']),
});
const onboardingPreferenceSchema = z.object({ dismissed: z.boolean() });
const revisionSchema = z.object({
  instruction: z.string().trim().min(2, 'Jelaskan perubahan yang kamu inginkan.').max(1800),
  aiMode: z.enum(['basic', 'thinking', 'xtrathink']).optional().default('basic'),
});
const quizAttemptSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().min(4).max(80),
    selectedIndex: z.number().int().min(0).max(3),
  })).min(1).max(20),
});
const supportMessageSchema = z.object({
  content: z.string().trim().min(1).max(900),
});

function revisionHttpError(error) {
  if (!(error instanceof RevisionError)) return error;
  if (error.code === 'MESSAGE_NOT_FOUND') {
    return new HttpError(404, 'Pesan sumber tidak ditemukan.', 'CHAT_MESSAGE_NOT_FOUND');
  }
  if (error.code === 'USER_MESSAGE_REQUIRED') {
    return new HttpError(409, 'Hanya pesan pengguna yang bisa direvisi.', 'USER_MESSAGE_REQUIRED');
  }
  if (error.code === 'CONTENT_REQUIRED') {
    return new HttpError(422, 'Tulis perubahan yang kamu inginkan sebelum merevisi pesan ini.', 'CONTENT_REQUIRED');
  }
  if (error.code === 'MODE_INVALID') {
    return new HttpError(400, 'Mode revisi tidak valid.', 'MODE_INVALID');
  }
  return new HttpError(400, 'Permintaan revisi tidak valid.', error.code || 'REVISION_INVALID');
}

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

const adminCreditGrantSchema = z.object({
  audience: z.enum(['user', 'all', 'paid']),
  userId: z.string().trim().min(8).max(80).optional(),
  amount: z.number().int().min(1).max(100),
  reason: z.string().trim().min(4).max(160),
  idempotencyKey: z.string().trim().min(12).max(100).regex(/^[a-zA-Z0-9._:-]+$/),
}).superRefine((value, context) => {
  if (value.audience === 'user' && !value.userId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['userId'], message: 'Pilih user tujuan.' });
  }
});

const adminAlertStatusSchema = z.object({
  status: z.enum(['open', 'resolved']),
});

const accountAppealSchema = z.object({
  email: z.string().email('Masukkan email akun yang valid.').max(180),
  message: z.string().trim().min(20, 'Jelaskan permohonanmu minimal 20 karakter.').max(1200),
});

const adminRestrictionSchema = z.object({
  targetType: z.enum(['account', 'device', 'ip']),
  durationDays: z.number().int().min(1).max(3650).nullable().optional().default(null),
  reason: z.string().trim().min(8, 'Berikan alasan yang mudah dipahami user.').max(280),
});

const adminUserPlanSchema = z.object({
  planKey: z.enum(['free', 'monthly', 'pro']),
  durationDays: z.coerce.number().int().min(1).max(3650).optional().default(30),
});

const adminAppealReviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reply: z.string().trim().min(4).max(800),
  liftRestrictions: z.boolean().optional().default(false),
});

const adminBreakGlassSchema = z.object({
  reasonCode: z.enum(['support_case', 'security_incident', 'legal_request', 'data_subject_request', 'other']),
  reasonNote: z.string().trim().min(12, 'Jelaskan alasan akses minimal 12 karakter.').max(500),
  durationMinutes: z.coerce.number().int().min(1).max(10).default(5),
});

const adminBroadcastSchema = z.object({
  audience: z.enum(['all', 'paid', 'selected']),
  userIds: z.array(z.string().trim().min(8).max(80)).max(100).optional().default([]),
  subject: z.string().trim().min(3).max(140),
  heading: z.string().trim().min(2).max(140),
  body: z.string().trim().min(10).max(6000),
  ctaLabel: z.string().trim().max(50).optional().default(''),
  ctaUrl: z.string().url().max(500).optional().or(z.literal('')).default(''),
  imageUrl: z.string().trim().max(500).refine(
    (value) => !value || /^\/api\/public\/email-media\/[A-Za-z0-9._-]+$/.test(value),
    'Gambar email wajib berasal dari upload admin.',
  ).optional().default(''),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#b7ff24'),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#f5f5f2'),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#171715'),
}).superRefine((value, context) => {
  if (value.audience === 'selected' && !value.userIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['userIds'], message: 'Pilih minimal satu user.' });
  }
});

const adminPricingSchema = z.object({
  products: z.array(z.object({
    sku: z.enum(PLAN_SKUS),
    unitPriceIdr: z.number().int().min(0).max(10_000_000),
    discountPercent: z.number().int().min(0).max(90).optional().default(0),
    discountExpiresAt: z.string().trim().max(40).optional().default(''),
    credits: z.number().int().min(1).max(1000),
    durationDays: z.number().int().min(1).max(3650),
    revisionsPerReport: z.number().int().min(0).max(100),
    storageMb: z.number().int().min(1).max(102_400),
    features: z.array(z.string().trim().min(1).max(120)).max(10),
  })).length(4),
}).superRefine((value, context) => {
  const skus = new Set(value.products.map((product) => product.sku));
  for (const sku of PLAN_SKUS) {
    if (!skus.has(sku)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['products'], message: `Plan ${sku} wajib disertakan.` });
  }
  value.products.forEach((product, index) => {
    if (product.sku === 'free' && product.unitPriceIdr !== 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['products', index, 'unitPriceIdr'], message: 'Harga plan Free wajib Rp0.' });
    }
    if (product.sku !== 'free' && product.unitPriceIdr < 1000) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['products', index, 'unitPriceIdr'], message: 'Harga plan berbayar minimal Rp1.000.' });
    }
    if (product.sku === 'free' && (product.discountPercent !== 0 || product.discountExpiresAt)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['products', index], message: 'Plan Free tidak menggunakan diskon.' });
    }
  });
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
const projectPinSchema = z.object({
  projectName: z.string().trim().min(1).max(100),
  projectKey: z.string().trim().min(1).max(120),
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

function anonymousRoomRef(roomId = '') {
  return `R-${sha256(`${config.tokenSecret}:room:${roomId}`).slice(0, 8).toUpperCase()}`;
}

function redactEmailAddresses(value = '') {
  return String(value).replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[identitas disembunyikan]');
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
  createAdminAlert({
    kind: `risk_${String(category || 'activity').slice(0, 48)}`,
    severity: severity === 'high' || severity === 'critical' ? 'critical' : 'warning',
    userId: subjectUserId,
    summary: String(summary || 'Aktivitas akun perlu ditinjau.').slice(0, 240),
  });
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

const DEVICE_COOKIE_NAME = 'laprakin_device';
const DEVICE_COOKIE_MAX_AGE = 400 * 24 * 60 * 60 * 1000;

function safeTokenSignatureMatch(left, right) {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function signedDeviceToken(token) {
  return `${token}.${hmac(token, `${config.deviceSecret}:cookie`)}`;
}

function verifiedDeviceToken(value) {
  const [token, signature, extra] = String(value || '').split('.');
  if (extra || !/^[A-Za-z0-9_-]{32,128}$/.test(token || '')) return '';
  const expected = hmac(token, `${config.deviceSecret}:cookie`);
  return safeTokenSignatureMatch(signature || '', expected) ? token : '';
}

function deviceCookieMiddleware(req, res, next) {
  let token = verifiedDeviceToken(req.cookies?.[DEVICE_COOKIE_NAME]);
  if (!token) {
    token = randomToken(32);
    res.cookie(DEVICE_COOKIE_NAME, signedDeviceToken(token), {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProd,
      maxAge: DEVICE_COOKIE_MAX_AGE,
      path: '/',
      priority: 'high',
    });
  }
  req.laprakinDeviceToken = token;
  next();
}

function normalizedNetworkPrefix(input) {
  const value = String(input || 'unknown').trim().toLowerCase().replace(/^::ffff:/, '');
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) return value.split('.').slice(0, 3).join('.');
  if (value.includes(':')) return value.split(':').slice(0, 4).join(':');
  return value.slice(0, 120) || 'unknown';
}

function registrationIdentity(req, email) {
  const suppliedClientId = String(req.get('x-laprakin-device') || '').trim();
  const validClientId = /^[A-Za-z0-9._:-]{8,160}$/.test(suppliedClientId) ? suppliedClientId : '';
  const clientProfile = String(req.get('x-laprakin-client-profile') || '').trim().slice(0, 500);
  const browserMaterial = [
    String(req.get('user-agent') || '').trim().slice(0, 300),
    String(req.get('accept-language') || '').trim().slice(0, 120),
    String(req.get('sec-ch-ua-platform') || '').trim().slice(0, 80),
    String(req.get('sec-ch-ua') || '').trim().slice(0, 180),
    clientProfile,
  ].join('|');
  const networkPrefix = normalizedNetworkPrefix(req.ip);
  const browserHash = hmac(browserMaterial, `${config.deviceSecret}:browser`);
  const networkHash = hmac(networkPrefix, `${config.deviceSecret}:network`);
  return {
    deviceCookieHash: hmac(req.laprakinDeviceToken, `${config.deviceSecret}:registration-cookie`),
    clientDeviceHash: validClientId ? hmac(validClientId, `${config.deviceSecret}:registration-client`) : null,
    browserHash,
    networkHash,
    networkBrowserHash: hmac(`${networkHash}:${browserHash}`, `${config.deviceSecret}:network-browser`),
    emailHash: hmac(String(email || '').trim().toLowerCase(), `${config.deviceSecret}:registration-email`),
  };
}

function reserveRegistration(req, email) {
  const identity = registrationIdentity(req, email);
  const timestamp = now();
  db.prepare("DELETE FROM registration_guards WHERE user_id IS NULL AND status = 'reserved' AND created_at < ?")
    .run(new Date(Date.now() - 15 * 60 * 1000).toISOString());

  const existing = db.prepare(`
    SELECT id FROM registration_guards
    WHERE device_cookie_hash = ?
       OR (? IS NOT NULL AND client_device_hash = ?)
    LIMIT 1
  `).get(identity.deviceCookieHash, identity.clientDeviceHash, identity.clientDeviceHash);
  if (existing) {
    addRiskEvent({
      category: 'registration_device_reuse',
      severity: 'medium',
      summary: 'Perangkat mencoba membuat lebih dari satu akun.',
      metadata: { networkHash: identity.networkHash.slice(0, 16) },
    });
    throw new HttpError(409, 'Perangkat ini sudah pernah dipakai untuk membuat akun. Masuk ke akun tersebut atau pulihkan aksesnya.', 'DEVICE_REGISTRATION_LIMIT');
  }

  const recentNetworkCount = Number(db.prepare(`
    SELECT COUNT(*) AS count FROM registration_guards
    WHERE network_hash = ? AND created_at >= ?
  `).get(identity.networkHash, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())?.count || 0);
  const recentBrowserCount = Number(db.prepare(`
    SELECT COUNT(*) AS count FROM registration_guards
    WHERE browser_hash = ? AND created_at >= ?
  `).get(identity.browserHash, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())?.count || 0);
  if (recentBrowserCount >= 3 || recentNetworkCount >= 10) {
    addRiskEvent({
      category: 'registration_evasion_pattern',
      severity: 'medium',
      summary: 'Pola registrasi berulang terdeteksi dari perangkat atau jaringan yang sama.',
      metadata: { recentBrowserCount, recentNetworkCount },
    });
    throw new HttpError(429, 'Registrasi tambahan dari perangkat atau jaringan ini dibatasi. Gunakan akun yang sudah dibuat atau hubungi bantuan.', 'REGISTRATION_RISK_LIMIT');
  }

  const id = nanoid();
  try {
    db.prepare(`
      INSERT INTO registration_guards (
        id, user_id, device_cookie_hash, client_device_hash, browser_hash,
        network_hash, network_browser_hash, email_hash, status, created_at, updated_at
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 'reserved', ?, ?)
    `).run(
      id,
      identity.deviceCookieHash,
      identity.clientDeviceHash,
      identity.browserHash,
      identity.networkHash,
      identity.networkBrowserHash,
      identity.emailHash,
      timestamp,
      timestamp,
    );
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE constraint failed')) {
      throw new HttpError(409, 'Perangkat ini sudah pernah dipakai untuk membuat akun. Masuk ke akun tersebut atau pulihkan aksesnya.', 'DEVICE_REGISTRATION_LIMIT');
    }
    throw error;
  }
  return id;
}

function bindRegistrationGuard(guardId, userId, verified = false) {
  const timestamp = now();
  db.prepare("UPDATE registration_guards SET user_id = ?, status = ?, verified_at = ?, updated_at = ? WHERE id = ? AND user_id IS NULL")
    .run(userId, verified ? 'verified' : 'registered', verified ? timestamp : null, timestamp, guardId);
}

function releaseRegistrationGuard(guardId) {
  db.prepare("DELETE FROM registration_guards WHERE id = ? AND user_id IS NULL AND status = 'reserved'").run(guardId);
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
        FROM document_files WHERE owner_user_id = ? AND deleted_at IS NULL AND COALESCE(is_extracted, 0) = 0
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
  const benefitSku = tier === 'pro' ? 'pro' : tier === 'subscription' ? 'monthly' : tier === 'paid' ? 'credit' : 'free';
  const benefit = planBenefits(benefitSku);
  const limitBytes = benefit.storageMb * 1024 * 1024;
  const chatFiles = db.prepare(`
    SELECT id, original_name AS name, kind AS type, size_bytes, sha256, created_at
    FROM chat_attachments
    WHERE owner_user_id = ? AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 80
  `).all(userId).map((file) => ({
    id: file.id,
    kind: 'chat',
    name: file.name,
    sourceLabel: file.type === 'practice_evidence' ? 'Bukti chat' : file.type === 'template' ? 'Template chat' : 'Lampiran chat',
    sizeBytes: Number(file.size_bytes || 0),
    sha256: file.sha256 || '',
    createdAt: file.created_at,
  }));
  const documentFiles = db.prepare(`
    SELECT id, original_name AS name, category AS type, size_bytes, sha256, is_extracted, created_at
    FROM document_files
    WHERE owner_user_id = ? AND deleted_at IS NULL AND COALESCE(is_extracted, 0) = 0
    ORDER BY created_at DESC
    LIMIT 80
  `).all(userId).map((file) => ({
    id: file.id,
    kind: 'document',
    name: file.name,
    sourceLabel: file.type === 'evidence' ? 'Bukti dokumen' : file.type === 'template' ? 'Template dokumen' : 'File dokumen',
    sizeBytes: Number(file.size_bytes || 0),
    sha256: file.sha256 || '',
    createdAt: file.created_at,
  }));
  const seenFiles = new Set();
  const files = [...chatFiles, ...documentFiles]
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
    .filter((file) => {
      const key = file.sha256 || `${file.kind}:${file.id}`;
      if (seenFiles.has(key)) return false;
      seenFiles.add(key);
      return true;
    })
    .slice(0, 120)
    .map(({ sha256: _sha256, ...file }) => file);
  return {
    usedBytes: Number(used),
    limitBytes,
    tier,
    retentionHint: tier === 'pro' ? 'Selama Max aktif + masa tenggang.' : tier === 'subscription' ? 'Selama Pro aktif + masa tenggang.' : tier === 'paid' ? `${benefit.durationDays} hari sejak aktivitas berbayar terakhir.` : `${benefit.durationDays} hari sejak credit awal diaktifkan.`,
    files,
  };
}

function revisionEntitlementForUser(userId) {
  const subscription = activeSubscription(userId);
  if (subscription?.plan_key === 'pro') return { plan: 'pro', maxRevisions: planBenefits('pro').revisionsPerReport };
  if (subscription) return { plan: 'monthly', maxRevisions: planBenefits('monthly').revisionsPerReport };
  const hasPaidCredit = Boolean(db.prepare(`SELECT 1 FROM wallet_entries WHERE user_id = ? AND bucket = 'paid' AND amount > 0 LIMIT 1`).get(userId));
  return hasPaidCredit
    ? { plan: 'single', maxRevisions: planBenefits('credit').revisionsPerReport }
    : { plan: 'free', maxRevisions: planBenefits('free').revisionsPerReport };
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

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
}

app.use(securityHeaders);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(deviceCookieMiddleware);
app.use((req, res, next) => {
  req.requestId = nanoid(10);
  const startedAt = Date.now();
  res.on('finish', () => {
    const requestLogger = logger.child({
      requestId: req.requestId,
      method: req.method,
      route: req.route?.path || req.path || req.originalUrl,
    });
    requestLogger.info({
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      actorClass: actorClass(req),
    }, 'request completed');
  });
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
  message: { error: { message: 'Bantuan sedang sibuk. Coba lagi nanti.', code: 'SUPPORT_RATE_LIMIT' } },
});

const aiChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: config.aiMaxRequestsPerHour * 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Belum berhasil diproses. Coba lagi sebentar.', code: 'REQUEST_NOT_COMPLETED' } },
});

const integrationCheckLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Pengecekan integrasi dibatasi. Coba lagi nanti.', code: 'INTEGRATION_CHECK_RATE_LIMIT' } },
});

const adminMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Terlalu banyak tindakan admin. Coba lagi sebentar.', code: 'ADMIN_ACTION_RATE_LIMIT' } },
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
    SELECT id, file_name, status, review_mode, content_signature, created_at, expires_at
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
    quizAccess: quizAccessForDocument(row.id, row.owner_user_id),
    versions: listVersions(row.id, row.owner_user_id),
    jobs,
  };
}

const documentStreams = new Map();
const adminStreams = new Set();
let workerBusy = false;

function publishAdminEvent(type, payload) {
  if (!adminStreams.size) return;
  const message = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const response of adminStreams) {
    try { response.write(message); } catch { adminStreams.delete(response); }
  }
}

function createAdminAlert({
  kind,
  severity = 'warning',
  userId = null,
  documentId = null,
  jobId = null,
  summary,
  errorCode = '',
}) {
  const id = nanoid();
  db.prepare(`
    INSERT INTO admin_alerts (
      id, kind, severity, user_id, document_id, job_id, summary, error_code, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
  `).run(
    id,
    String(kind || 'system').slice(0, 60),
    ['info', 'warning', 'critical'].includes(severity) ? severity : 'warning',
    userId,
    documentId,
    jobId,
    String(summary || 'Kejadian operasional perlu ditinjau.').slice(0, 240),
    String(errorCode || '').slice(0, 80),
    now(),
  );
  publishAdminEvent('alert', { id, kind, severity, createdAt: now() });
  const shouldEmailAdmin = severity === 'critical'
    || String(kind || '').startsWith('risk_')
    || kind === 'account_appeal';
  if (shouldEmailAdmin && config.adminEmail) {
    const emailProps = {
      summary: String(summary || 'Aktivitas perlu ditinjau.').slice(0, 240),
      adminUrl: `${config.appUrl}/admin`,
      critical: severity === 'critical',
    };
    queueTransactionalEmail({
      recipient: config.adminEmail,
      subject: `[Laprakin] ${severity === 'critical' ? 'Tindakan segera diperlukan' : 'Aktivitas perlu ditinjau'}`,
      kind: 'admin_security_alert',
      text: adminSecurityAlertText(emailProps),
      react: AdminSecurityAlertEmail(emailProps),
    }).catch((error) => {
      logger.warn({ code: error?.code || 'EMAIL_FAILED' }, 'admin alert email failed');
    });
  }
  return id;
}

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
  const terminal = ['failed', 'canceled'].includes(job.status);
  const rawError = String(job.error_message || '');
  const isTechnical = TECHNICAL_AI_ERROR_PATTERN.test(rawError)
    || /(?:JSON|Unterminated string|Unexpected (?:end|token)|position \d+|sqlite|constraint|typeerror|referenceerror|syntaxerror|ENOENT|ENOSPC)/i.test(rawError);
  const safeError = isTechnical
    ? FRIENDLY_AI_RETRY_MESSAGE
    : (rawError || FRIENDLY_AI_RETRY_MESSAGE);
  return {
    id: job.id,
    documentId: job.document_id,
    type: job.job_type,
    status: job.status,
    progress: job.progress,
    message: job.message,
    result: parseJson(job.result_json, {}),
    errorMessage: terminal ? safeError : '',
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
  const runtimeSnapshot = captureAiRuntimeConfiguration();
  const durablePayload = {
    ...payload,
    aiConfigurationRevision: runtimeSnapshot.revisionId,
    aiConfigurationSource: runtimeSnapshot.source,
  };
  db.prepare(`
    INSERT INTO jobs (
      id, document_id, owner_user_id, job_type, status, progress, message,
      payload_json, attempt_count, max_attempts, created_at
    ) VALUES (?, ?, ?, ?, 'queued', 0, 'Masuk antrean', ?, 0, ?, ?)
  `).run(jobId, documentId, userId, jobType, JSON.stringify(durablePayload), Math.max(1, maxAttempts), now());
  recordJobEvent(jobId);
  audit(userId, 'job.enqueued', 'document', documentId, { jobId, jobType });
  publishJob(jobId);
  queueMicrotask(drainJobQueue);
  return jobId;
}

function activeDocumentPipelineJob(documentId, userId) {
  return db.prepare(`
    SELECT * FROM jobs
    WHERE document_id = ? AND owner_user_id = ?
      AND job_type IN ('analyze', 'generate')
      AND status IN ('queued', 'running')
    ORDER BY created_at DESC
    LIMIT 1
  `).get(documentId, userId) || null;
}

function queueDocumentGeneration({
  documentId,
  userId,
  aiMode = 'basic',
  forceLocalFallback = false,
  recoveryAttempt = 0,
} = {}) {
  const active = activeDocumentPipelineJob(documentId, userId);
  if (active) return active.id;

  const document = db.prepare(`
    SELECT * FROM documents
    WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL
  `).get(documentId, userId);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!document || !user) throw new HttpError(404, 'Dokumen tidak ditemukan.', 'DOCUMENT_NOT_FOUND');
  if (document.generated_at) return null;

  const files = db.prepare('SELECT * FROM document_files WHERE document_id = ? AND deleted_at IS NULL').all(documentId);
  const mappings = db.prepare('SELECT * FROM evidence_mappings WHERE document_id = ?').all(documentId);
  const readiness = assessDocumentGenerationReadiness({ document, user, files, mappings });
  if (!readiness.canGenerate) {
    throw new HttpError(422, 'Bahan laprak belum cukup untuk disusun.', 'DOCUMENT_INPUT_INCOMPLETE');
  }
  const recipe = parseJson(document.recipe_json, {});
  if (!recipe.allowExternalAi && !forceLocalFallback) {
    throw new HttpError(412, 'Izin pemrosesan bahan belum aktif.', 'AI_CONSENT_REQUIRED');
  }

  const entitlement = revisionEntitlementForUser(userId);
  let bucket = null;
  let creditSessionId = null;
  const creditSession = db.prepare(`
    SELECT id FROM chat_sessions
    WHERE document_id = ? AND owner_user_id = ? AND archived_at IS NULL
    LIMIT 1
  `).get(documentId, userId);
  if (creditSession) {
    creditSessionId = creditSession.id;
    bucket = reserveLaprakCredit(userId, creditSession.id);
  } else {
    bucket = consumeCredit(userId, documentId);
  }

  const jobId = enqueueJob({
    documentId,
    userId,
    jobType: 'generate',
    maxAttempts: forceLocalFallback ? 1 : config.jobMaxAttempts,
    payload: {
      creditBucket: bucket,
      creditSessionId,
      isRevision: false,
      revisionPlan: entitlement.plan,
      aiMode,
      pipelineAuto: true,
      forceLocalFallback,
      recoveryAttempt,
    },
  });
  db.prepare(`
    UPDATE chat_sessions SET workflow_state = 'GENERATING', updated_at = ?
    WHERE document_id = ? AND owner_user_id = ?
  `).run(now(), documentId, userId);
  return jobId;
}

function ensureDocumentPipeline({
  documentId,
  userId,
  aiMode = 'basic',
  forceLocalFallback = false,
  recoveryAttempt = 0,
} = {}) {
  const document = db.prepare(`
    SELECT id, status, generated_at FROM documents
    WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL
  `).get(documentId, userId);
  if (!document || document.generated_at || document.status === 'generated') return null;
  const active = activeDocumentPipelineJob(documentId, userId);
  if (active) return active.id;

  if (document.status !== 'analyzed') {
    const jobId = enqueueJob({
      documentId,
      userId,
      jobType: 'analyze',
      payload: { pipelineAuto: true, aiMode },
    });
    db.prepare(`
      UPDATE chat_sessions SET workflow_state = 'GENERATING', updated_at = ?
      WHERE document_id = ? AND owner_user_id = ?
    `).run(now(), documentId, userId);
    return jobId;
  }

  return queueDocumentGeneration({ documentId, userId, aiMode, forceLocalFallback, recoveryAttempt });
}

function resumePendingDocumentPipelines() {
  const sessions = db.prepare(`
    SELECT chat_sessions.id, chat_sessions.owner_user_id, chat_sessions.document_id,
      chat_sessions.configuration_json
    FROM chat_sessions
    JOIN documents ON documents.id = chat_sessions.document_id
    WHERE chat_sessions.archived_at IS NULL
      AND chat_sessions.workflow_state IN ('GENERATING', 'READY_TO_GENERATE')
      AND documents.deleted_at IS NULL
      AND documents.generated_at IS NULL
    ORDER BY chat_sessions.updated_at ASC
  `).all();
  let resumed = 0;
  for (const session of sessions) {
    if (activeDocumentPipelineJob(session.document_id, session.owner_user_id)) continue;
    const latestGeneration = db.prepare(`
      SELECT * FROM jobs
      WHERE document_id = ? AND owner_user_id = ? AND job_type = 'generate'
      ORDER BY created_at DESC LIMIT 1
    `).get(session.document_id, session.owner_user_id);
    if (latestGeneration?.status === 'failed' && jobPayload(latestGeneration).forceLocalFallback) continue;
    try {
      const configuration = parseJson(session.configuration_json, {});
      const jobId = ensureDocumentPipeline({
        documentId: session.document_id,
        userId: session.owner_user_id,
        aiMode: configuration.aiMode || 'basic',
      });
      if (jobId) resumed += 1;
    } catch (error) {
      createAdminAlert({
        kind: 'document_pipeline_recovery',
        severity: 'warning',
        userId: session.owner_user_id,
        documentId: session.document_id,
        summary: 'Alur dokumen belum dapat dilanjutkan otomatis dan perlu diperiksa.',
        errorCode: error?.code || 'PIPELINE_RECOVERY_FAILED',
      });
    }
  }
  if (resumed) logger.info({ resumed }, 'document pipelines resumed');
  return resumed;
}

function refundJobCreditSafely(job, payload) {
  if (job.job_type !== 'generate' || !payload.creditBucket) return true;
  try {
    if (payload.creditSessionId) refundLaprakCredit(job.owner_user_id, payload.creditSessionId);
    else refundCredit(job.owner_user_id, payload.creditBucket, job.document_id);
    return true;
  } catch (error) {
    createAdminAlert({
      kind: 'credit_refund_failed',
      severity: 'critical',
      userId: job.owner_user_id,
      documentId: job.document_id,
      jobId: job.id,
      summary: 'Pengembalian kredit setelah kegagalan generate perlu diperiksa.',
      errorCode: error?.code || 'CREDIT_REFUND_FAILED',
    });
    return false;
  }
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
  const runtimeSnapshot = ['active', 'revision'].includes(payload.aiConfigurationSource)
    ? captureAiRuntimeConfiguration({ revisionId: payload.aiConfigurationRevision })
    : captureAiRuntimeConfiguration();
  try {
    let result;
    let completionSummary = null;
    if (job.job_type === 'scan') {
      result = await scanDocumentFiles(job.document_id, job.owner_user_id, update);
    } else if (job.job_type === 'analyze') {
      result = await analyzeDocument(job.document_id, job.owner_user_id, update, { runtimeSnapshot });
    } else if (job.job_type === 'generate') {
      result = await generateDocument(job.document_id, job.owner_user_id, update, { ...payload, runtimeSnapshot });
      update(96, 'Memeriksa susunan dokumen Word');
      const preview = await buildDocumentDocxBuffer(job.document_id, job.owner_user_id, { enforceExportQuality: false });
      if (!preview?.buffer?.length) throw new HttpError(500, 'Dokumen Word belum tersusun utuh.', 'DOCX_BUILD_INCOMPLETE');
      db.prepare(`
        UPDATE documents SET status = 'generated', generated_at = COALESCE(generated_at, ?), updated_at = ?
        WHERE id = ? AND owner_user_id = ?
      `).run(now(), now(), job.document_id, job.owner_user_id);
      result = { ...(result || {}), docxVerified: true, docxBytes: preview.buffer.length };
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
    if (job.job_type === 'generate') {
      const generatedState = db.prepare(`
        SELECT document.generated_at,
          (SELECT COUNT(*) FROM report_sections section WHERE section.document_id = document.id) AS section_count
        FROM documents document WHERE document.id = ? AND document.owner_user_id = ?
      `).get(job.document_id, job.owner_user_id);
      if (!generatedState?.generated_at || Number(generatedState.section_count || 0) < 3) {
        createAdminAlert({
          kind: 'document_generation_incomplete',
          severity: 'critical',
          userId: job.owner_user_id,
          documentId: job.document_id,
          jobId: job.id,
          summary: 'Job generate selesai tetapi dokumen belum memiliki hasil yang utuh.',
          errorCode: 'GENERATE_RESULT_INCOMPLETE',
        });
        throw new HttpError(500, 'Hasil dokumen belum tersimpan lengkap.', 'GENERATE_RESULT_INCOMPLETE');
      }
      completionSummary = await summarizeDocumentWorkResult({
        documentId: job.document_id,
        userId: job.owner_user_id,
        isRevision: Boolean(payload.isRevision),
        instruction: payload.revisionInstruction || '',
        aiMode: payload.aiMode || 'basic',
        runtimeSnapshot,
      });
    }
    const completedAt = now();
    db.prepare(`
      UPDATE jobs SET status = 'completed', progress = 100, message = 'Selesai', result_json = ?, finished_at = ?, heartbeat_at = ?
      WHERE id = ?
    `).run(JSON.stringify(result || {}), completedAt, completedAt, job.id);
    if (job.job_type === 'analyze' && payload.pipelineAuto) {
      ensureDocumentPipeline({
        documentId: job.document_id,
        userId: job.owner_user_id,
        aiMode: payload.aiMode || 'basic',
      });
    } else if (job.job_type === 'generate') {
      db.prepare(`UPDATE chat_sessions SET workflow_state = 'DOCUMENT_PREVIEW', updated_at = ? WHERE document_id = ? AND owner_user_id = ?`)
        .run(now(), job.document_id, job.owner_user_id);
      const session = db.prepare(`
        SELECT id, work_plan_json FROM chat_sessions
        WHERE document_id = ? AND owner_user_id = ? AND archived_at IS NULL
        LIMIT 1
      `).get(job.document_id, job.owner_user_id);
      if (session) {
        const liveJob = db.prepare('SELECT started_at FROM jobs WHERE id = ?').get(job.id);
        const documentVersion = db.prepare('SELECT revision_count FROM documents WHERE id = ?').get(job.document_id);
        const versionNumber = Number(documentVersion?.revision_count || 0) + 1;
        const readyContent = completionSummary?.text || 'Dokumen sudah selesai disusun. Buka hasilnya untuk melakukan pemeriksaan akhir.';
        const readyMeta = JSON.stringify({
          kind: 'document_ready',
          jobId: job.id,
          isRevision: Boolean(payload.isRevision),
          provider: completionSummary?.provider || 'local',
          model: completionSummary?.model || 'local-summary',
          configurationRevision: completionSummary?.configurationRevision || runtimeSnapshot.revisionId,
          routeId: completionSummary?.routeId || '',
          workPlan: parseJson(session.work_plan_json, {}),
          thinkingStartedAt: liveJob?.started_at || job.created_at,
          thinkingFinishedAt: completedAt,
          documentVersion: versionNumber,
        });
        const existingReadyMessage = db.prepare(`
          SELECT id FROM chat_messages
          WHERE session_id = ? AND role = 'assistant'
            AND json_extract(meta_json, '$.kind') = 'document_ready'
            AND CAST(json_extract(meta_json, '$.documentVersion') AS INTEGER) = ?
          ORDER BY created_at DESC
          LIMIT 1
        `).get(session.id, versionNumber);
        if (existingReadyMessage) {
          db.prepare(`
            UPDATE chat_messages SET content = ?, meta_json = ?, created_at = ? WHERE id = ?
          `).run(readyContent, readyMeta, completedAt, existingReadyMessage.id);
        } else {
          db.prepare(`
            INSERT INTO chat_messages (id, session_id, owner_user_id, role, content, meta_json, created_at)
            VALUES (?, ?, ?, 'assistant', ?, ?, ?)
          `).run(nanoid(), session.id, job.owner_user_id, readyContent, readyMeta, completedAt);
        }
      }
    } else if (job.job_type === 'export') {
      db.prepare(`UPDATE chat_sessions SET workflow_state = 'FINAL', updated_at = ? WHERE document_id = ? AND owner_user_id = ?`)
        .run(now(), job.document_id, job.owner_user_id);
    }
    recordJobEvent(job.id);
    const jobCopy = {
      scan: { title: 'Pemeriksaan file selesai', body: 'Cek jika ada file yang perlu kamu redaksi sebelum dibagikan.' },
      analyze: { title: 'Bahan selesai dibaca', body: 'Pembuatan dokumen dilanjutkan otomatis.' },
      generate: { title: 'Dokumen Word sudah siap', body: 'Buka hasilnya untuk melakukan pemeriksaan akhir.' },
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
      refundJobCreditSafely(job, payload);
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
      const canRetry = error?.retryable !== false
        && (current?.attempt_count || 1) < (current?.max_attempts || 1);
      if (canRetry) {
        const providerBusy = /(?:RESOURCE_EXHAUSTED|AI_TIMEOUT|AI_NETWORK_ERROR)/i.test(String(error?.code || ''));
        const retryDelay = providerBusy
          ? Math.min(30000, 5000 * (2 ** Math.max(0, Number(current?.attempt_count || 1) - 1)))
          : 1500 * (current.attempt_count || 1);
        const runAfter = new Date(Date.now() + retryDelay).toISOString();
        db.prepare(`
          UPDATE jobs SET status = 'queued', progress = 0, message = ?, error_message = ?, run_after = ?, heartbeat_at = ?
          WHERE id = ?
        `).run(
          providerBusy ? 'Mencoba lagi' : 'Akan dicoba lagi',
          error?.message || 'Terjadi kesalahan sementara.',
          runAfter,
          now(),
          job.id,
        );
        recordJobEvent(job.id);
      } else {
        if (job.job_type === 'generate' && payload.pipelineAuto && !payload.forceLocalFallback) {
          refundJobCreditSafely(job, payload);
          db.prepare(`
            UPDATE documents SET status = 'analyzed', generated_at = NULL, updated_at = ?
            WHERE id = ? AND owner_user_id = ?
          `).run(now(), job.document_id, job.owner_user_id);
          db.prepare(`
            UPDATE jobs SET status = 'failed', message = 'Menyiapkan jalur penyelesaian', error_message = ?, finished_at = ?, heartbeat_at = ?
            WHERE id = ?
          `).run(error?.message || 'Penyusunan utama belum selesai.', now(), now(), job.id);
          recordJobEvent(job.id);
          const fallbackJobId = ensureDocumentPipeline({
            documentId: job.document_id,
            userId: job.owner_user_id,
            aiMode: payload.aiMode || 'basic',
            forceLocalFallback: true,
            recoveryAttempt: Number(payload.recoveryAttempt || 0) + 1,
          });
          audit(job.owner_user_id, 'job.fallback_enqueued', 'document', job.document_id, {
            jobId: job.id,
            fallbackJobId,
            jobType: job.job_type,
          });
          return;
        }
        const creditRefunded = refundJobCreditSafely(job, payload);
        db.prepare(`
          UPDATE jobs SET status = 'failed', message = 'Proses gagal', error_message = ?, finished_at = ?, heartbeat_at = ?
          WHERE id = ?
        `).run(error?.message || 'Terjadi kesalahan.', now(), now(), job.id);
        if (job.job_type === 'generate') {
          const session = db.prepare(`
            SELECT id FROM chat_sessions
            WHERE document_id = ? AND owner_user_id = ? AND archived_at IS NULL
            LIMIT 1
          `).get(job.document_id, job.owner_user_id);
          const document = db.prepare('SELECT generated_at FROM documents WHERE id = ?').get(job.document_id);
          db.prepare(`
            UPDATE chat_sessions SET workflow_state = ?, updated_at = ?
            WHERE document_id = ? AND owner_user_id = ?
          `).run(document?.generated_at ? 'DOCUMENT_PREVIEW' : 'READY_TO_GENERATE', now(), job.document_id, job.owner_user_id);
          if (session) {
            const providerBusy = /(?:RESOURCE_EXHAUSTED|AI_TIMEOUT|AI_NETWORK_ERROR)/i.test(String(error?.code || ''));
            db.prepare(`
              INSERT INTO chat_messages (id, session_id, owner_user_id, role, content, meta_json, created_at)
              VALUES (?, ?, ?, 'assistant', ?, ?, ?)
            `).run(
              nanoid(),
              session.id,
              job.owner_user_id,
              'Dokumen belum selesai pada percobaan ini. Bahan tetap tersimpan dan Laprakin akan melanjutkan pemulihan secara otomatis.',
              JSON.stringify({
                kind: 'generation_failed',
                jobId: job.id,
                retryable: Boolean(error?.retryable),
                errorCode: String(error?.code || 'AI_PROVIDER_ERROR').slice(0, 80),
              }),
              now(),
            );
          }
        }
        recordJobEvent(job.id);
        notifyUser(job.owner_user_id, {
          kind: 'error', title: 'Proses belum berhasil',
          body: job.job_type === 'generate' ? 'Tidak ada credit yang hangus karena kegagalan sistem. Kamu bisa mencoba kembali dari halaman laporan.' : 'Kamu bisa mencoba kembali dari halaman laporan.',
          href: `/app/documents/${job.document_id}`,
        });
        createAdminAlert({
          kind: job.job_type === 'generate' ? 'document_generation_failed' : 'job_failed',
          severity: creditRefunded ? 'warning' : 'critical',
          userId: job.owner_user_id,
          documentId: job.document_id,
          jobId: job.id,
          summary: creditRefunded
            ? `${job.job_type} gagal setelah percobaan terakhir; kredit telah dikembalikan bila sebelumnya direservasi.`
            : `${job.job_type} gagal dan pengembalian kredit perlu diperiksa.`,
          errorCode: error?.code || 'JOB_FAILED',
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
  if (result.changes) logger.info({ recovered: result.changes }, 'interrupted jobs recovered');
}

function recoverFailedGenerationSessions() {
  return resumePendingDocumentPipelines();
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
  const stagedDirectories = new Set();
  for (const file of files) {
    try { fs.unlinkSync(file.path); } catch { /* best effort cleanup */ }
    const directory = path.dirname(file.path || '');
    if (path.basename(directory) === 'staged') stagedDirectories.add(directory);
  }
  for (const directory of stagedDirectories) {
    try { fs.rmdirSync(directory); } catch { /* Keep a non-empty directory or clean it on the next failure. */ }
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
    callback(null, opaqueStorageName(file.originalname));
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

const institutionLogoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'image/png') return callback(new HttpError(400, 'Logo institusi wajib berformat PNG.', 'INSTITUTION_LOGO_TYPE'));
    return callback(null, true);
  },
});

app.get('/api/status', (_req, res) => {
  let database = true;
  try {
    db.prepare('SELECT 1').get();
  } catch {
    database = false;
  }
  const runtimeSnapshot = captureAiRuntimeConfiguration();
  const aiReadiness = getAiReadiness(runtimeSnapshot);
  return res.status(200).json(statusSnapshot({
    aiConfigured: isAiConfigured(runtimeSnapshot),
    aiReady: aiReadiness.textReady,
    database,
    worker: { status: workerBusy ? 'busy' : 'idle' },
  }));
});

app.get('/api/health', (_req, res) => {
  const queue = db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE status IN ('queued', 'running')").get().count;
  const runtimeSnapshot = captureAiRuntimeConfiguration();
  const aiReadiness = getAiReadiness(runtimeSnapshot);
  res.json({
    ok: true,
    mode: config.nodeEnv,
    aiConfigured: isAiConfigured(runtimeSnapshot),
    visionReady: aiReadiness.visionReady,
    aiCredentialIssue: aiReadiness.configured && !isAiConfigured(runtimeSnapshot) ? 'Provider AI belum siap atau capability registry belum tersedia.' : '',
    googleLoginConfigured: Boolean(!config.manualEmailAuthOnly && config.googleOauthRequired && config.googleClientId && config.googleClientSecret),
    paymentsMode: config.paymentsMode,
    queueDepth: queue,
    time: now(),
  });
});

app.get('/api/health/ready', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    const missing = [];
    const aiReadiness = getAiReadiness();
    if (config.aiRequired && (!aiReadiness.configured || !aiReadiness.registryCached || !aiReadiness.textReady || !aiReadiness.documentReady)) missing.push('ai');
    if (config.googleOauthRequired && (!config.googleClientId || !config.googleClientSecret)) missing.push('google_oauth');
    if (missing.length) return res.status(503).json({ ok: false, database: 'ready', missing });
    return res.json({ ok: true, database: 'ready', worker: workerBusy ? 'busy' : 'idle', ai: aiReadiness.textReady ? 'configured' : 'disabled', vision: aiReadiness.visionReady ? 'ready' : 'unavailable', googleOauth: config.googleOauthRequired ? 'configured' : 'disabled' });
  } catch {
    return res.status(503).json({ ok: false, database: 'unavailable' });
  }
});

app.get('/api/meta', (_req, res) => {
  const runtimeSnapshot = captureAiRuntimeConfiguration();
  res.json({
    departments,
    programs,
    features: {
      nararouterConfigured: isAiConfigured(runtimeSnapshot),
      manualPayments: config.paymentsMode === 'manual' && !config.isProd,
      uploadMaxMb: config.maxUploadBytes / 1024 / 1024,
      googleLoginEnabled: Boolean(!config.manualEmailAuthOnly && config.googleOauthRequired && config.googleClientId && config.googleClientSecret),
      supportAiEnabled: Boolean(config.supportAiEnabled && isAiConfigured(runtimeSnapshot)),
    },
  });
});

app.get('/api/ai/processor-manifest', (_req, res) => {
  res.json(captureAiRuntimeConfiguration().processorManifest);
});

app.get('/api/privacy/ai-consent', requireAuth, (req, res) => {
  const manifest = captureAiRuntimeConfiguration().processorManifest;
  res.json({ consent: getExternalAiConsent({ userId: req.user.id, manifest }), manifest });
});

app.post('/api/privacy/ai-consent', requireAuth, requireCsrf, (req, res) => {
  const input = externalAiConsentSchema.parse(req.body || {});
  const manifest = captureAiRuntimeConfiguration().processorManifest;
  if (input.manifestVersion !== manifest.manifestVersion || input.policyVersion !== manifest.policyVersion) {
    throw new HttpError(409, 'Daftar pemroses berubah. Tinjau ulang sebelum menyetujui.', 'AI_CONSENT_MANIFEST_CHANGED');
  }
  const consent = recordExternalAiConsent({
    userId: req.user.id,
    manifest,
    sourceSurface: input.sourceSurface,
  });
  audit(req.user.id, 'privacy.external_ai_consent_granted', 'user', req.user.id, {
    manifestVersion: manifest.manifestVersion,
    providerIds: consent.providerIds,
    sourceSurface: consent.sourceSurface,
  });
  res.json({ consent, manifest });
});

app.delete('/api/privacy/ai-consent', requireAuth, requireCsrf, (req, res) => {
  const manifest = captureAiRuntimeConfiguration().processorManifest;
  const consent = revokeExternalAiConsent({ userId: req.user.id, manifest });
  audit(req.user.id, 'privacy.external_ai_consent_revoked', 'user', req.user.id, {
    manifestVersion: manifest.manifestVersion,
  });
  res.json({ consent, manifest });
});

app.get('/api/auth/google/start', authLimiter, (req, res, next) => {
  try {
    assertAccessAllowed(req, '');
    const redirectPath = String(req.query.next || '/app');
    const { state, url } = createGoogleAuthorizationState(redirectPath);
    res.cookie('laprakin_google_state', state, { httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: 10 * 60 * 1000, path: '/' });
    res.redirect(url);
  } catch (error) { next(error); }
});

app.get('/api/auth/google/callback', async (req, res) => {
  res.clearCookie('laprakin_google_state', { httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/' });
  if (req.query.error) return res.redirect(`${config.appUrl}/auth?google=cancelled`);
  try {
    const state = String(req.query.state || '');
    const code = String(req.query.code || '');
    const cookieState = String(req.cookies?.laprakin_google_state || '');
    if (!code || !state || !cookieState || state !== cookieState) {
      throw new HttpError(400, 'Sesi masuk Google tidak valid. Coba lagi.', 'GOOGLE_STATE_INVALID');
    }
    const completed = await finishGoogleAuthorization({
      state,
      code,
      beforeCreate: (email) => {
        const guardId = reserveRegistration(req, email);
        return {
          bind: (userId) => bindRegistrationGuard(guardId, userId, true),
          release: () => releaseRegistrationGuard(guardId),
        };
      },
    });
    const googleDeviceId = observeDevice(req, completed.user.id);
    assertAccessAllowed(req, completed.user.id);
    evaluateSharedDeviceRisk(googleDeviceId, completed.user.id);
    try { claimWelcomeCredits(completed.user.id, googleDeviceId); } catch { /* akun lama atau shared-device review tidak boleh memblokir login */ }
    setSession(res, completed.user);
    return res.redirect(`${config.appUrl}${completed.redirectPath.startsWith('/app') ? completed.redirectPath : '/app'}?welcome=google`);
  } catch (error) {
    logger.warn({
      requestId: req.requestId,
      code: error?.code || 'GOOGLE_LOGIN_FAILED',
      status: Number(error?.status || 500),
    }, 'google authentication failed');
    if (Number(error?.status || 500) >= 500) reportException(error, {
      requestId: req.requestId,
      purpose: 'google_authentication',
      status: Number(error?.status || 500),
    });
    return res.redirect(`${config.appUrl}/auth?google=${error?.code === 'ACCOUNT_RESTRICTED' ? 'restricted' : 'failed'}`);
  }
});

app.post('/api/auth/register', authLimiter, asyncHandler(async (req, res) => {
  assertAccessAllowed(req, '');
  const input = registerSchema.parse(req.body || {});
  await enforcePasswordSafety(input.password);
  const guardId = reserveRegistration(req, input.email);
  let created;
  try {
    created = await createUser(input);
    bindRegistrationGuard(guardId, created.user.id);
  } catch (error) {
    releaseRegistrationGuard(guardId);
    throw error;
  }
  const registeredDeviceId = observeDevice(req, created.user.id);
  evaluateSharedDeviceRisk(registeredDeviceId, created.user.id);
  const response = {
    user: created.user,
    message: 'Akun dibuat. Verifikasi email untuk mengaktifkan credit gratis.',
  };
  if (!config.isProd) response.developmentVerificationToken = created.verificationToken;
  res.status(201).json(response);
}));

app.post('/api/auth/verify', authLimiter, asyncHandler(async (req, res) => {
  assertAccessAllowed(req, '');
  const token = String(req.body?.token || '');
  const user = verifyEmailToken(token);
  const verifiedDeviceId = observeDevice(req, user.id);
  evaluateSharedDeviceRisk(verifiedDeviceId, user.id);
  let welcomeGranted = false;
  try { claimWelcomeCredits(user.id, verifiedDeviceId); welcomeGranted = true; } catch { /* shared-device review can defer the promo without blocking verification */ }
  const csrfToken = setSession(res, user);
  res.json({ user, wallet: getWallet(user.id), csrfToken, welcomeGranted, message: welcomeGranted ? `${planBenefits('free').credits} credit gratis aktif.` : 'Email berhasil diverifikasi.' });
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
  await enforcePasswordSafety(input.password);
  const user = await resetPassword(input.token, input.password);
  assertAccessAllowed(req, user.id);
  if (!user.emailVerified) {
    clearSession(res);
    return res.json({ user, csrfToken: null, message: 'Kata sandi berhasil diperbarui. Verifikasi email sebelum masuk.' });
  }
  const csrfToken = setSession(res, user);
  return res.json({ user, wallet: getWallet(user.id), csrfToken, message: 'Kata sandi berhasil diperbarui.' });
}));

app.post('/api/auth/login', authLimiter, asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body || {});
  const user = await authenticateUser(input);
  const verifiedDeviceId = observeDevice(req, user.id);
  assertAccessAllowed(req, user.id);
  evaluateSharedDeviceRisk(verifiedDeviceId, user.id);
  const csrfToken = setSession(res, user);
  audit(user.id, 'auth.login', 'user', user.id, {});
  res.json({ user, wallet: getWallet(user.id), csrfToken });
}));

app.post('/api/auth/appeals', authLimiter, asyncHandler(async (req, res) => {
  const input = accountAppealSchema.parse(req.body || {});
  const normalizedEmail = input.email.trim().toLowerCase();
  const emailHash = hmac(normalizedEmail, config.tokenSecret);
  const user = db.prepare('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL').get(normalizedEmail);
  const prior = db.prepare(`
    SELECT id FROM account_appeals
    WHERE email_hash = ? AND status = 'open'
    ORDER BY created_at DESC LIMIT 1
  `).get(emailHash);
  if (!prior) {
    const id = nanoid();
    db.prepare(`
      INSERT INTO account_appeals (id, user_id, email_hash, message, status, created_at)
      VALUES (?, ?, ?, ?, 'open', ?)
    `).run(id, user?.id || null, emailHash, input.message, now());
    createAdminAlert({
      kind: 'account_appeal',
      severity: 'warning',
      userId: user?.id || null,
      summary: 'Permohonan peninjauan pembatasan akun menunggu respons admin.',
    });
    audit(user?.id || null, 'auth.appeal_submitted', 'account_appeal', id, {});
  }
  res.status(202).json({ message: 'Permohonan peninjauan diterima. Tim Laprakin akan mengirim hasilnya melalui email.' });
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

app.post('/api/auth/password-change-request', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const result = await requestPasswordReset(req.user.email);
  const response = { message: 'Link verifikasi perubahan kata sandi sudah dikirim ke email akunmu.' };
  if (!config.isProd && result.resetToken) response.developmentResetToken = result.resetToken;
  res.json(response);
}));

app.put('/api/auth/password', requireAuth, requireCsrf, (_req, _res, next) => {
  next(new HttpError(403, 'Perubahan kata sandi wajib dimulai dari link verifikasi email.', 'PASSWORD_EMAIL_VERIFICATION_REQUIRED'));
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  // Renew persistent cookie on active use. Session remains revocable via versioning.
  const csrfToken = setSession(res, req.user, { mfaVerifiedAt: req.session?.mfaVerifiedAt || null });
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
  const item = buildOrderQuote(input).items[0];
  grantCredit({
    userId: req.user.id,
    bucket: 'paid',
    amount: item.creditPerUnit * item.quantity,
    reason: `Credit satuan sandbox ×${buildOrderQuote(input).items[0].quantity}`,
    referenceType: 'sandbox_purchase',
    referenceId: nanoid(),
    expiresInDays: item.durationDays,
  });
  const singleQuantity = item.quantity;
  audit(req.user.id, 'pricing.single_sandbox_activated', 'wallet', req.user.id, { quantity: singleQuantity });
  res.status(201).json({ wallet: getWallet(req.user.id), quantity: singleQuantity });
}));

app.get('/api/storage/summary', requireAuth, (req, res) => {
  res.json(storageSummaryForUser(req.user.id));
});

app.delete('/api/storage/files/:kind/:id', requireAuth, requireCsrf, (req, res) => {
  const kind = String(req.params.kind || '');
  const deletedAt = now();
  if (kind === 'chat') {
    const attachment = db.prepare('SELECT * FROM chat_attachments WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL').get(req.params.id, req.user.id);
    if (!attachment) throw new HttpError(404, 'File tidak ditemukan.', 'STORAGE_FILE_NOT_FOUND');
    db.prepare('UPDATE chat_attachments SET deleted_at = ? WHERE id = ?').run(deletedAt, attachment.id);
    db.prepare(`
      UPDATE document_files SET deleted_at = ?
      WHERE owner_user_id = ? AND sha256 = ? AND original_name = ? AND deleted_at IS NULL
    `).run(deletedAt, req.user.id, attachment.sha256, attachment.original_name);
    try { fs.unlinkSync(attachment.storage_path); } catch { /* best effort */ }
    audit(req.user.id, 'storage.file_deleted', 'chat_attachment', attachment.id, { source: 'settings' });
    return res.json({ ok: true, storage: storageSummaryForUser(req.user.id) });
  }
  if (kind === 'document') {
    const file = db.prepare('SELECT * FROM document_files WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL').get(req.params.id, req.user.id);
    if (!file) throw new HttpError(404, 'File tidak ditemukan.', 'STORAGE_FILE_NOT_FOUND');
    db.prepare('UPDATE document_files SET deleted_at = ? WHERE id = ?').run(deletedAt, file.id);
    db.prepare(`
      UPDATE chat_attachments SET deleted_at = ?
      WHERE owner_user_id = ? AND sha256 = ? AND original_name = ? AND deleted_at IS NULL
    `).run(deletedAt, req.user.id, file.sha256, file.original_name);
    db.prepare('UPDATE evidence_mappings SET status = ? WHERE file_id = ?').run('ignored', file.id);
    try { fs.unlinkSync(file.storage_path); } catch { /* best effort */ }
    audit(req.user.id, 'storage.file_deleted', 'document_file', file.id, { source: 'settings' });
    return res.json({ ok: true, storage: storageSummaryForUser(req.user.id) });
  }
  throw new HttpError(400, 'Jenis file tidak valid.', 'STORAGE_FILE_KIND_INVALID');
});

app.get('/api/safety/status', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT 'risk' AS source, category AS code, summary, created_at
    FROM risk_events WHERE subject_user_id = ? AND status = 'open'
    UNION ALL
    SELECT 'alert' AS source, kind AS code, summary, created_at
    FROM admin_alerts WHERE user_id = ? AND status = 'open'
    ORDER BY created_at DESC
    LIMIT 12
  `).all(req.user.id, req.user.id);
  const seenReasons = new Set();
  const reasons = rows.map((row) => {
    const labels = {
      shared_device: 'Perangkat yang sama terhubung ke lebih dari satu akun.',
      device_registration_limit: 'Perangkat ini telah digunakan untuk beberapa pendaftaran akun.',
      upload_burst: 'Banyak file diunggah dalam waktu yang sangat singkat.',
      generation_burst: 'Banyak permintaan pembuatan dokumen dikirim berdekatan.',
      support_scope_burst: 'Bantuan digunakan berulang kali untuk permintaan di luar layanan Laprakin.',
      payment_mismatch: 'Ada pembayaran yang perlu dikonfirmasi kembali.',
      job_failed: 'Proses dokumen mengalami kegagalan berulang.',
    };
    return {
      reason: labels[row.code] || (row.source === 'risk' ? row.summary : 'Aktivitas akun perlu ditinjau oleh tim Laprakin.'),
      createdAt: row.created_at,
    };
  }).filter((item) => {
    if (seenReasons.has(item.reason)) return false;
    seenReasons.add(item.reason);
    return true;
  });
  res.json({
    hasAlert: reasons.length > 0,
    openAlerts: reasons.length,
    reasons,
  });
});

app.get('/api/wallet', requireAuth, (req, res) => {
  res.json({ ...getWallet(req.user.id), subscription: activeSubscription(req.user.id) });
});

app.get('/api/chat/processing-access', requireAuth, (req, res) => {
  const wallet = getWallet(req.user.id);
  res.json({
    available: wallet.balances.total > 0,
    credits: wallet.balances.total,
  });
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
  const current = db.prepare('SELECT full_name, nickname, nim, class_name, institution_name, institution_logo_url, faculty_name, study_program_name, lecturer_name, lecturer_nip, department_key, study_program_key FROM users WHERE id = ?').get(req.user.id);
  const departmentKey = input.departmentKey ?? current.department_key;
  const studyProgramKey = input.studyProgramKey ?? current.study_program_key;
  const program = studyProgramKey ? programs.find((item) => item.key === studyProgramKey) : null;
  if (studyProgramKey && !program) throw new HttpError(400, 'Prodi tidak valid.', 'INVALID_STUDY_PROGRAM');
  if (program && departmentKey && program.department !== departmentKey) {
    throw new HttpError(400, 'Prodi tidak sesuai dengan jurusan.', 'PROGRAM_DEPARTMENT_MISMATCH');
  }

  db.prepare(`
    UPDATE users SET
      full_name = ?, nickname = ?, nim = ?, class_name = ?, institution_name = ?, institution_logo_url = ?, faculty_name = ?, study_program_name = ?, lecturer_name = ?, lecturer_nip = ?, department_key = ?, study_program_key = ?, updated_at = ?
    WHERE id = ?
  `).run(
    input.fullName ?? current.full_name,
    input.nickname ?? current.nickname,
    input.nim ?? current.nim,
    input.className ?? current.class_name,
    input.institutionName ?? current.institution_name,
    input.institutionLogoUrl ?? current.institution_logo_url,
    input.facultyName ?? current.faculty_name,
    input.studyProgramName ?? current.study_program_name,
    input.lecturerName ?? current.lecturer_name,
    input.lecturerNip ?? current.lecturer_nip,
    program?.department || departmentKey,
    program?.key || '',
    now(),
    req.user.id,
  );
  audit(req.user.id, 'profile.updated', 'user', req.user.id, {});
  res.json({ user: publicUser(req.user.id) });
}));

/**
 * Unggah logo institusi.
 *
 * Menggantikan pengisian URL bebas. Selain lebih praktis bagi user, ini juga
 * menghapus permukaan SSRF: URL bebas membuat server melakukan fetch ke alamat
 * pilihan user, termasuk localhost dan jaringan internal.
 */
app.post('/api/profile/institution-logo', requireAuth, requireCsrf, uploadLimiter, institutionLogoUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Pilih berkas logo terlebih dahulu.', 'INSTITUTION_LOGO_REQUIRED');
  const detectedMime = detectBufferType(req.file.buffer);
  if (detectedMime !== req.file.mimetype) {
    throw new HttpError(400, 'Isi berkas tidak cocok dengan format yang dipilih.', 'INSTITUTION_LOGO_SIGNATURE');
  }
  const extension = detectedMime === 'image/png' ? '.png' : '';
  if (!extension) throw new HttpError(400, 'Logo institusi wajib berformat PNG.', 'INSTITUTION_LOGO_TYPE');

  const logoDir = path.join(config.uploadDir, 'institution-logos');
  fs.mkdirSync(logoDir, { recursive: true });
  const filename = `logo-${req.user.id}-${nanoid(8)}${extension}`;
  fs.writeFileSync(path.join(logoDir, filename), req.file.buffer, { flag: 'wx' });

  const previous = db.prepare('SELECT institution_logo_url FROM users WHERE id = ?').get(req.user.id)?.institution_logo_url || '';
  const url = `/api/profile/institution-logo/${filename}`;
  db.prepare('UPDATE users SET institution_logo_url = ?, updated_at = ? WHERE id = ?').run(url, now(), req.user.id);

  // Berkas lama hanya dihapus bila memang milik direktori logo, sehingga nilai
  // URL eksternal warisan tidak pernah dipakai sebagai path penghapusan.
  const previousName = previous.startsWith('/api/profile/institution-logo/') ? path.basename(previous) : '';
  if (previousName && previousName !== filename) {
    fs.rm(path.join(logoDir, previousName), { force: true }, () => {});
  }

  audit(req.user.id, 'profile.institution_logo_uploaded', 'user', req.user.id, { mimeType: detectedMime, size: req.file.size });
  res.status(201).json({ user: publicUser(req.user.id) });
}));

app.get('/api/profile/institution-logo/:filename', requireAuth, asyncHandler(async (req, res) => {
  // basename memblokir traversal, dan pola nama mengikat berkas ke pemiliknya.
  const filename = path.basename(String(req.params.filename || ''));
  if (!new RegExp(`^logo-${req.user.id}-[A-Za-z0-9_-]{1,32}\\.(?:png|jpg)$`).test(filename)) {
    throw new HttpError(404, 'Logo tidak ditemukan.', 'INSTITUTION_LOGO_NOT_FOUND');
  }
  const logoDir = path.join(config.uploadDir, 'institution-logos');
  const target = path.resolve(logoDir, filename);
  if (!target.startsWith(path.resolve(logoDir) + path.sep)) {
    throw new HttpError(404, 'Logo tidak ditemukan.', 'INSTITUTION_LOGO_NOT_FOUND');
  }
  if (!fs.existsSync(target)) throw new HttpError(404, 'Logo tidak ditemukan.', 'INSTITUTION_LOGO_NOT_FOUND');
  // The basename, owner-bound filename pattern, and resolved directory boundary are validated above.
  res.sendFile(target); // nosemgrep: javascript.express.security.audit.express-res-sendfile.express-res-sendfile
}));

app.delete('/api/profile/institution-logo', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const current = db.prepare('SELECT institution_logo_url FROM users WHERE id = ?').get(req.user.id)?.institution_logo_url || '';
  db.prepare("UPDATE users SET institution_logo_url = '', updated_at = ? WHERE id = ?").run(now(), req.user.id);
  if (current.startsWith('/api/profile/institution-logo/')) {
    fs.rm(path.join(config.uploadDir, 'institution-logos', path.basename(current)), { force: true }, () => {});
  }
  audit(req.user.id, 'profile.institution_logo_removed', 'user', req.user.id, {});
  res.json({ user: publicUser(req.user.id) });
}));

app.post('/api/profile/onboarding', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const input = onboardingPreferenceSchema.parse(req.body || {});
  db.prepare('UPDATE users SET onboarding_dismissed = ?, updated_at = ? WHERE id = ?')
    .run(input.dismissed ? 1 : 0, now(), req.user.id);
  audit(req.user.id, 'profile.onboarding_updated', 'user', req.user.id, { dismissed: input.dismissed });
  res.json({ user: publicUser(req.user.id) });
}));

function exposeChatSession(row) {
  if (!row) return null;
  return {
    ...row,
    isPinned: Boolean(row.is_pinned),
    workflowState: row.workflow_state || 'NEW_CHAT',
    clarificationCount: Number(row.clarification_count || 0),
    sourceRecommendationShown: Boolean(row.source_recommendation_shown),
    firstMessageAnalyzed: Boolean(row.first_message_analyzed),
    generatedTitle: row.generated_title || '',
    documentType: row.document_type || 'lab_report',
    courseName: row.course_name || '',
    practiceTopic: row.practice_topic || '',
    sourceStatus: defaultChatSourceStatus(row.source_status_json),
    contextSummary: row.context_summary || '',
    missingCriticalContext: row.missing_critical_context || '',
    processingCreditReserved: Boolean(row.processing_credit_bucket && !row.processing_credit_refunded_at),
    workPlan: parseJson(row.work_plan_json, {}),
    configuration: parseJson(row.configuration_json, {}),
  };
}

function listChatAttachments(sessionId, ownerUserId) {
  return db.prepare(`
    SELECT id, kind, original_name, mime_type, detected_mime, size_bytes, processing_status, created_at
    FROM chat_attachments
    WHERE session_id = ? AND owner_user_id = ? AND deleted_at IS NULL
    ORDER BY created_at ASC
  `).all(sessionId, ownerUserId);
}

function listChatMessages(sessionId, ownerUserId) {
  return db.prepare(`
    SELECT message.id, message.role, message.content, message.meta_json, message.created_at,
      COALESCE(reaction.reaction, '') AS reaction,
      COALESCE(reaction.reason_code, '') AS reaction_reason
    FROM chat_messages message
    LEFT JOIN message_reactions reaction
      ON reaction.owner_user_id = message.owner_user_id AND reaction.message_id = message.id
    WHERE message.session_id = ? AND message.owner_user_id = ?
    ORDER BY message.created_at ASC
  `).all(sessionId, ownerUserId).map((message) => ({ ...message, meta: parseJson(message.meta_json, {}) }));
}

function chatSourceModes(sourceStatus) {
  const sourceValues = [sourceStatus.module, sourceStatus.instruction, sourceStatus.template, sourceStatus.supportingDocument];
  const evidenceValue = sourceStatus.practiceEvidence;
  return {
    sourceMode: sourceValues.includes('UPLOADED')
      ? 'uploaded'
      : sourceValues.includes('AVAILABLE')
        ? 'described'
        : sourceValues.some((value) => ['NOT_AVAILABLE', 'SKIPPED'].includes(value))
          ? 'unavailable'
          : 'missing',
    evidenceMode: evidenceValue === 'UPLOADED'
      ? 'uploaded'
      : evidenceValue === 'AVAILABLE'
        ? 'described'
        : ['NOT_AVAILABLE', 'SKIPPED'].includes(evidenceValue)
          ? 'unavailable'
          : 'missing',
  };
}

function refreshChatWorkflow(sessionOrId, user, { deferAnalysis = false, forceReady = false } = {}) {
  const session = typeof sessionOrId === 'string'
    ? db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ?').get(sessionOrId, user.id)
    : sessionOrId;
  if (!session) throw new HttpError(404, 'Percakapan tidak ditemukan.', 'CHAT_NOT_FOUND');

  const messages = listChatMessages(session.id, user.id);
  const attachments = listChatAttachments(session.id, user.id);
  const analysis = analyzeChatRequest({ session, messages, attachments });
  const currentState = session.workflow_state || 'NEW_CHAT';
  const documentStates = new Set(['GENERATING', 'DOCUMENT_PREVIEW', 'REVISION', 'FINAL', 'QUIZ_REQUIRED', 'EXPORT_UNLOCKED']);
  let workflowState = currentState;
  let clarificationCount = Number(session.clarification_count || 0);
  let recommendationShown = Number(session.source_recommendation_shown || 0);

  if (session.document_id && documentStates.has(currentState)) {
    workflowState = currentState;
  } else if (deferAnalysis) {
    workflowState = 'ANALYZING_INPUT';
  } else if (!messages.length && !attachments.length) {
    workflowState = 'NEW_CHAT';
  } else if (forceReady) {
    workflowState = 'READY_TO_GENERATE';
  } else if (analysis.missingCriticalContext) {
    workflowState = 'CLARIFICATION_REQUIRED';
    clarificationCount = 1;
  } else {
    workflowState = 'READY_TO_GENERATE';
  }

  const generatedTitle = generateChatTitle(analysis);
  const currentTitle = String(session.title || '').trim();
  const titleIsGeneric = /^(?:laprak baru|chat baru|untitled)$/i.test(currentTitle);
  const nextTitle = generatedTitle && titleIsGeneric ? generatedTitle : currentTitle || 'Laprak baru';
  const nextMissingContext = forceReady ? '' : analysis.missingCriticalContext;

  db.prepare(`
    UPDATE chat_sessions SET
      title = ?,
      generated_title = ?,
      workflow_state = ?,
      clarification_count = ?,
      source_recommendation_shown = ?,
      first_message_analyzed = ?,
      document_type = ?,
      course_name = ?,
      practice_topic = ?,
      source_status_json = ?,
      context_summary = ?,
      missing_critical_context = ?,
      configuration_json = ?,
      course_group = CASE
        WHEN course_group = '' OR course_group = 'Belum dikelompokkan' THEN ?
        ELSE course_group
      END,
      updated_at = ?
    WHERE id = ? AND owner_user_id = ?
  `).run(
    nextTitle,
    generatedTitle || session.generated_title || '',
    workflowState,
    clarificationCount,
    recommendationShown,
    deferAnalysis ? Number(session.first_message_analyzed || 0) : Number(messages.length > 0 || attachments.length > 0),
    analysis.documentType,
    analysis.courseName,
    analysis.practiceTopic,
    JSON.stringify(analysis.sourceStatus),
    analysis.contextSummary,
    nextMissingContext,
    JSON.stringify(analysis.configuration),
    analysis.courseName || 'Belum dikelompokkan',
    now(),
    session.id,
    user.id,
  );
  return db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ?').get(session.id, user.id);
}

async function refreshChatWorkPlan(sessionOrId, user, { content = '', aiMode = 'basic', onlyIfCourseMissing = false, runtimeSnapshot = null } = {}) {
  const session = typeof sessionOrId === 'string'
    ? db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ?').get(sessionOrId, user.id)
    : sessionOrId;
  if (!session) throw new HttpError(404, 'Percakapan tidak ditemukan.', 'CHAT_NOT_FOUND');
  const plan = await createChatWorkPlan({ session, user, content, aiMode, runtimeSnapshot });
  const updated = db.prepare(`
    UPDATE chat_sessions
    SET work_plan_json = ?, work_plan_generated_at = ?, updated_at = ?
    WHERE id = ? AND owner_user_id = ?
      ${onlyIfCourseMissing ? "AND course_name = ''" : ''}
  `).run(JSON.stringify(plan), plan.generatedAt || now(), now(), session.id, user.id);
  if (!updated.changes) {
    return db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ?').get(session.id, user.id);
  }
  return db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ?').get(session.id, user.id);
}

function chatWorkflow(session, user) {
  const messages = listChatMessages(session.id, user.id);
  const attachments = listChatAttachments(session.id, user.id);
  const readiness = assessChatReadiness({
    session,
    user,
    messages,
    attachments,
  });
  const state = session.workflow_state || 'NEW_CHAT';
  const sourceStatus = defaultChatSourceStatus(session.source_status_json);
  const modes = chatSourceModes(sourceStatus);
  const readyStates = new Set(['READY_TO_GENERATE', 'GENERATING', 'DOCUMENT_PREVIEW', 'REVISION', 'FINAL', 'QUIZ_REQUIRED', 'EXPORT_UNLOCKED']);
  const canCreateDocument = readyStates.has(state);
  const canGenerateDraft = state === 'READY_TO_GENERATE';
  const missingCriticalContext = session.missing_critical_context || '';
  const nextQuestion = state === 'SOURCE_RECOMMENDED' || state === 'WAITING_SOURCE_DECISION'
    ? 'Modul dan bukti praktik sangat disarankan agar hasil lebih akurat, tetapi kamu tetap dapat melanjutkan tanpa file.'
    : state === 'CLARIFICATION_REQUIRED'
      ? missingCriticalContext === 'practice_topic'
        ? 'Saya perlu satu informasi lagi: praktikum ini membahas topik apa?'
        : missingCriticalContext === 'course_name'
          ? 'Saya perlu satu informasi lagi: praktikum ini untuk mata kuliah apa?'
          : missingCriticalContext === 'document_type_and_topic'
            ? 'Jenis dokumen dan topik apa yang ingin kamu susun?'
            : 'Mata kuliah dan topik praktikum ini apa?'
      : state === 'READY_TO_GENERATE'
        ? 'Konteksnya sudah cukup. Dokumen akan dibuat otomatis.'
        : readiness.nextQuestion;

  return {
    ...readiness,
    state,
    stage: state === 'NEW_CHAT'
      ? 'intake'
      : ['SOURCE_RECOMMENDED', 'WAITING_SOURCE_DECISION'].includes(state)
        ? 'source'
        : state === 'CLARIFICATION_REQUIRED'
          ? 'collecting'
          : state === 'READY_TO_GENERATE'
            ? 'ready'
            : state.toLowerCase(),
    canCreateDocument,
    canGenerateDraft,
    nextQuestion,
    known: {
      courseName: session.course_name || readiness.known?.courseName || '',
      moduleTitle: session.practice_topic || readiness.known?.moduleTitle || '',
    },
    sourceStatus,
    sourceMode: modes.sourceMode,
    evidenceMode: modes.evidenceMode,
    clarificationCount: Number(session.clarification_count || 0),
    sourceRecommendationShown: Boolean(session.source_recommendation_shown),
    firstMessageAnalyzed: Boolean(session.first_message_analyzed),
    documentType: session.document_type || 'lab_report',
    courseName: session.course_name || '',
    practiceTopic: session.practice_topic || '',
    contextSummary: session.context_summary || '',
    missingCriticalContext,
    attachmentsCount: attachments.length,
    workPlan: {
      ...parseJson(session.work_plan_json, {}),
      ready: Boolean((session.course_name || readiness.known?.courseName) && parseJson(session.work_plan_json, {}).steps?.length),
    },
  };
}

function inferAttachmentKind(filename = '') {
  const extension = path.extname(filename).toLowerCase();
  const normalized = path.basename(filename, extension).toLocaleLowerCase('id-ID').replace(/[^\p{L}\p{N}]+/gu, ' ');
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) return 'practice_evidence';
  if (/\b(ss|screenshot|capture|hasil|bukti|dokumentasi|foto)\b/.test(normalized)) return 'practice_evidence';
  if (/\b(template|format|contoh\s+(laporan|laprak))\b/.test(normalized)) return 'template';
  if (/\b(instruksi|ketentuan|rubrik|tugas)\b/.test(normalized)) return 'instruction';
  if (/\b(modul|materi|panduan|praktikum)\b/.test(normalized) || extension === '.pdf') return 'module';
  if (['.docx', '.txt', '.md'].includes(extension)) return 'supporting_document';
  if (['.csv', '.xlsx'].includes(extension)) return 'supporting_document';
  return 'unknown';
}

function documentCategoryForChatKind(kind = '') {
  if (kind === 'practice_evidence') return 'evidence';
  if (kind === 'instruction') return 'module';
  if (kind === 'supporting_document' || kind === 'unknown') return 'data';
  return kind;
}

function normalizeLegacyEvidenceKinds() {
  const evidenceNameClause = `
    LOWER(original_name) LIKE 'ss %'
    OR LOWER(original_name) LIKE 'ss-%'
    OR LOWER(original_name) LIKE 'ss_%'
    OR LOWER(original_name) LIKE '%screenshot%'
    OR LOWER(original_name) LIKE '%capture%'
    OR LOWER(original_name) LIKE '%bukti%'
    OR LOWER(original_name) LIKE '%dokumentasi%'
  `;
  db.prepare(`UPDATE chat_attachments SET kind = 'practice_evidence' WHERE kind = 'module' AND (${evidenceNameClause})`).run();
  db.prepare(`UPDATE document_files SET category = 'evidence', is_extracted = 0 WHERE category = 'module' AND (${evidenceNameClause})`).run();
}

normalizeLegacyEvidenceKinds();

const RETIRED_ADMIN_EMAILS = new Set(['main.laprakin@gmail.com']);

function retireRemovedAdminAccounts() {
  const timestamp = now();
  for (const email of RETIRED_ADMIN_EMAILS) {
    const users = db.prepare('SELECT id, role, deleted_at FROM users WHERE email = ?').all(email);
    for (const user of users) {
      db.prepare(`
        UPDATE users
        SET role = 'student', deleted_at = COALESCE(deleted_at, ?), verification_token = NULL, updated_at = ?
        WHERE id = ?
      `).run(timestamp, timestamp, user.id);
      db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);
      if (!user.deleted_at || user.role === 'admin') {
        audit(null, 'admin.account_retired', 'user', user.id, { email });
      }
    }
  }
}

retireRemovedAdminAccounts();
syncConfiguredAdminAccount();

function chatConversationPayload(sessionOrId, user, extra = {}) {
  const row = typeof sessionOrId === 'string'
    ? db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ?').get(sessionOrId, user.id)
    : sessionOrId;
  return {
    session: exposeChatSession(row),
    messages: listChatMessages(row.id, user.id),
    attachments: listChatAttachments(row.id, user.id),
    workflow: chatWorkflow(row, user),
    ...extra,
  };
}

function copyChatAttachmentToDocument(documentId, ownerUserId, attachment) {
  const existing = db.prepare(`
    SELECT id FROM document_files
    WHERE document_id = ? AND owner_user_id = ? AND category = ? AND sha256 = ? AND deleted_at IS NULL
    LIMIT 1
  `).get(documentId, ownerUserId, documentCategoryForChatKind(attachment.kind), attachment.sha256);
  if (existing) return existing.id;
  const targetDir = path.join(config.uploadDir, ownerUserId, documentId, 'source');
  fs.mkdirSync(targetDir, { recursive: true });
  const storageName = opaqueStorageName(attachment.original_name);
  const storagePath = path.join(targetDir, storageName);
  fs.copyFileSync(attachment.storage_path, storagePath);
  const id = nanoid();
  db.prepare(`
    INSERT INTO document_files (
      id, document_id, owner_user_id, category, original_name, storage_name, storage_path,
      mime_type, size_bytes, source_declaration, detected_mime, security_status, sha256, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'own', ?, 'pending', ?, ?)
  `).run(
    id, documentId, ownerUserId, documentCategoryForChatKind(attachment.kind), attachment.original_name, storageName, storagePath,
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

/**
 * Mengirim berkas privat hanya bila benar-benar berada di dalam direktori upload.
 *
 * Kepemilikan sudah diperiksa pemanggil dan storage_path selalu dibuat server
 * lewat nanoid + sanitizeFilename, jadi ini pertahanan berlapis: bila suatu saat
 * nilai storage_path dapat dipengaruhi input, path di luar uploadDir tetap
 * ditolak alih-alih terkirim.
 */
function sendPrivateFile(res, storagePath) {
  const root = path.resolve(config.uploadDir);
  const target = path.resolve(String(storagePath || ''));
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new HttpError(404, 'File tidak ditemukan.', 'FILE_NOT_FOUND');
  }
  return res.sendFile(target);
}

function sendPrivateDownload(res, storagePath, originalName) {
  res.attachment(sanitizeFilename(originalName));
  return sendPrivateFile(res, storagePath);
}

const featureUpdateMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp']);
    if (!allowed.has(file.mimetype)) return callback(new HttpError(400, 'Gambar update hanya mendukung PNG, JPG, atau WEBP.', 'FEATURE_UPDATE_MEDIA_TYPE'));
    return callback(null, true);
  },
});

const emailMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp']);
    if (!allowed.has(file.mimetype)) return callback(new HttpError(400, 'Gambar email hanya mendukung PNG, JPG, atau WEBP.', 'EMAIL_MEDIA_TYPE'));
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
  filename: (_req, file, callback) => callback(null, opaqueStorageName(file.originalname)),
});

const chatUpload = multer({
  storage: chatUploadStorage,
  limits: { fileSize: config.maxUploadBytes, files: config.maxFilesPerUpload },
  fileFilter: (_req, file, callback) => callback(null, acceptedExtensions.has(path.extname(file.originalname).toLowerCase())),
});

app.get('/api/chat/sessions', requireAuth, (req, res) => {
  const sessions = db.prepare(`
    SELECT id, title, department_key, study_program_key, structure_mode, course_group, sort_position, is_pinned, configuration_json, document_id, created_at, updated_at
    FROM chat_sessions session
    WHERE owner_user_id = ? AND archived_at IS NULL
      AND (
        document_id IS NOT NULL
        OR EXISTS (SELECT 1 FROM chat_messages message WHERE message.session_id = session.id AND message.owner_user_id = session.owner_user_id)
        OR EXISTS (SELECT 1 FROM chat_attachments attachment WHERE attachment.session_id = session.id AND attachment.owner_user_id = session.owner_user_id AND attachment.deleted_at IS NULL)
      )
    ORDER BY is_pinned DESC, course_group COLLATE NOCASE ASC, sort_position ASC, updated_at DESC LIMIT 60
  `).all(req.user.id).map(exposeChatSession);
  res.json({ sessions });
});

app.get('/api/chat/sessions/archived', requireAuth, (req, res) => {
  const sessions = db.prepare(`
    SELECT id, title, department_key, study_program_key, structure_mode, course_group, sort_position, is_pinned, configuration_json, document_id, archived_at, created_at, updated_at
    FROM chat_sessions
    WHERE owner_user_id = ? AND archived_at IS NOT NULL
    ORDER BY archived_at DESC LIMIT 100
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
    tone: input.configuration.tone || 'formal',
    perspective: input.configuration.perspective || 'saya',
    allowExternalAi: input.configuration.allowExternalAi === true,
  };
  const sortPosition = Number(db.prepare('SELECT COALESCE(MAX(sort_position), -1) AS value FROM chat_sessions WHERE owner_user_id = ? AND course_group = ?').get(req.user.id, courseGroup)?.value || -1) + 1;
  db.prepare(`INSERT INTO chat_sessions (id, owner_user_id, title, department_key, study_program_key, structure_mode, course_group, sort_position, configuration_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, req.user.id, input.title, departmentKey, studyProgramKey, input.structureMode, courseGroup, sortPosition, JSON.stringify(configuration), now(), now());
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id);
  res.status(201).json(chatConversationPayload(session, req.user));
}));

app.post('/api/chat/sessions/:id/processing-access', requireAuth, requireCsrf, (req, res) => {
  const session = db.prepare(`
    SELECT id FROM chat_sessions
    WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL
  `).get(req.params.id, req.user.id);
  if (!session) throw new HttpError(404, 'Percakapan tidak ditemukan.', 'CHAT_NOT_FOUND');
  const bucket = reserveLaprakCredit(req.user.id, session.id);
  const wallet = getWallet(req.user.id);
  res.json({ reserved: true, bucket, credits: wallet.balances.total });
});

app.delete('/api/chat/sessions/:id/processing-access', requireAuth, requireCsrf, (req, res) => {
  const session = db.prepare(`
    SELECT id, document_id FROM chat_sessions
    WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL
  `).get(req.params.id, req.user.id);
  if (!session) throw new HttpError(404, 'Percakapan tidak ditemukan.', 'CHAT_NOT_FOUND');
  const hasStarted = Boolean(
    session.document_id
    || db.prepare(`
      SELECT 1 FROM chat_messages
      WHERE session_id = ? AND owner_user_id = ? AND role = 'user'
      LIMIT 1
    `).get(session.id, req.user.id),
  );
  const released = hasStarted ? false : refundLaprakCredit(req.user.id, session.id);
  res.json({ released, credits: getWallet(req.user.id).balances.total });
});

app.get('/api/chat/sessions/:id', requireAuth, (req, res) => {
  let row = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL').get(req.params.id, req.user.id);
  if (!row) throw new HttpError(404, 'Percakapan tidak ditemukan.', 'CHAT_NOT_FOUND');
  if ((row.workflow_state || 'NEW_CHAT') === 'NEW_CHAT') {
    const hasInput = db.prepare('SELECT 1 FROM chat_messages WHERE session_id = ? AND owner_user_id = ? LIMIT 1').get(row.id, req.user.id)
      || db.prepare('SELECT 1 FROM chat_attachments WHERE session_id = ? AND owner_user_id = ? AND deleted_at IS NULL LIMIT 1').get(row.id, req.user.id);
    if (hasInput) row = refreshChatWorkflow(row, req.user);
  }
  res.json(chatConversationPayload(row, req.user));
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
  const updatedRow = refreshChatWorkflow(db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(session.id), req.user, {
    forceReady: ['READY_TO_GENERATE', 'GENERATING', 'DOCUMENT_PREVIEW', 'REVISION', 'FINAL', 'QUIZ_REQUIRED', 'EXPORT_UNLOCKED'].includes(session.workflow_state),
  });
  const updated = exposeChatSession(updatedRow);
  audit(req.user.id, 'chat.config_updated', 'chat_session', session.id, { structureMode: updated.structure_mode });
  res.json({ session: updated, workflow: chatWorkflow(updatedRow, req.user) });
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

app.get('/api/projects/pins', requireAuth, (req, res) => {
  const pins = db.prepare(`
    SELECT project_key, project_name, created_at, updated_at
    FROM project_pins
    WHERE owner_user_id = ?
    ORDER BY datetime(updated_at) DESC
  `).all(req.user.id).map((row) => ({
    projectKey: row.project_key,
    projectName: row.project_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  res.json({ pins });
});

app.post('/api/projects/pins', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const input = projectPinSchema.parse(req.body || {});
  const projectKey = input.projectKey
    .normalize('NFKD')
    .toLocaleLowerCase('id-ID')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!projectKey) throw new HttpError(400, 'Nama project tidak valid.', 'PROJECT_NAME_INVALID');
  if (input.pinned) {
    const timestamp = now();
    db.prepare(`
      INSERT INTO project_pins (id, owner_user_id, project_key, project_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_user_id, project_key) DO UPDATE SET
        project_name = excluded.project_name,
        updated_at = excluded.updated_at
    `).run(nanoid(), req.user.id, projectKey, input.projectName, timestamp, timestamp);
  } else {
    db.prepare('DELETE FROM project_pins WHERE owner_user_id = ? AND project_key = ?')
      .run(req.user.id, projectKey);
  }
  audit(req.user.id, input.pinned ? 'project.pinned' : 'project.unpinned', 'project', projectKey, {
    projectName: input.projectName,
  });
  res.json({ projectKey, pinned: input.pinned });
}));

app.post('/api/chat/sessions/:id/archive', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL').get(req.params.id, req.user.id);
  if (!session) throw new HttpError(404, 'Percakapan tidak ditemukan.', 'CHAT_NOT_FOUND');
  db.prepare('UPDATE chat_sessions SET archived_at = ?, updated_at = ? WHERE id = ?').run(now(), now(), session.id);
  audit(req.user.id, 'chat.archived', 'chat_session', session.id, {});
  res.json({ ok: true });
}));

app.post('/api/chat/sessions/:id/restore', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ? AND archived_at IS NOT NULL').get(req.params.id, req.user.id);
  if (!session) throw new HttpError(404, 'Chat arsip tidak ditemukan.', 'ARCHIVED_CHAT_NOT_FOUND');
  db.prepare('UPDATE chat_sessions SET archived_at = NULL, updated_at = ? WHERE id = ?').run(now(), session.id);
  audit(req.user.id, 'chat.restored', 'chat_session', session.id, {});
  res.json({ session: exposeChatSession(db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(session.id)) });
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
  if (!session.processing_credit_bucket && getWallet(req.user.id).balances.total < 1) {
    removeUploadedFiles(req.files);
    throw new HttpError(402, 'Kredit Basic habis. Tambah kredit untuk memulai Laprak baru.', 'INSUFFICIENT_CREDIT');
  }
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
      if (extension === '.docx' || extension === '.xlsx') validateArchiveFile(file.path);
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
      db.prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?').run(now(), session.id);
    }
  } catch (error) {
    removeUploadedFiles(req.files);
    throw error;
  }
  if (records.length) evaluateUploadBurstRisk(req.user.id);
  const refreshed = refreshChatWorkflow(
    db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ?').get(session.id, req.user.id),
    req.user,
    { deferAnalysis: !input.finalize },
  );
  res.status(201).json(chatConversationPayload(
    db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ?').get(session.id, req.user.id),
    req.user,
  ));
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
  const refreshed = refreshChatWorkflow(
    db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ?').get(req.params.id, req.user.id),
    req.user,
  );
  res.json(chatConversationPayload(refreshed, req.user, { ok: true }));
});

app.patch('/api/chat/sessions/:id/attachments/:attachmentId', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const input = chatAttachmentCategorySchema.parse(req.body || {});
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL').get(req.params.id, req.user.id);
  if (!session) throw new HttpError(404, 'Percakapan tidak ditemukan.', 'CHAT_NOT_FOUND');
  const attachment = db.prepare(`
    SELECT * FROM chat_attachments
    WHERE id = ? AND session_id = ? AND owner_user_id = ? AND deleted_at IS NULL
  `).get(req.params.attachmentId, session.id, req.user.id);
  if (!attachment) throw new HttpError(404, 'Lampiran tidak ditemukan.', 'ATTACHMENT_NOT_FOUND');
  db.prepare('UPDATE chat_attachments SET kind = ? WHERE id = ?').run(input.kind, attachment.id);
  if (session.document_id) {
    db.prepare(`
      UPDATE document_files SET category = ?
      WHERE document_id = ? AND owner_user_id = ? AND sha256 = ? AND original_name = ? AND deleted_at IS NULL
    `).run(documentCategoryForChatKind(input.kind), session.document_id, req.user.id, attachment.sha256, attachment.original_name);
  }
  const refreshed = refreshChatWorkflow(session.id, req.user);
  audit(req.user.id, 'chat.attachment_category_updated', 'chat_attachment', attachment.id, { kind: input.kind });
  res.json(chatConversationPayload(refreshed, req.user));
}));

app.get('/api/chat/attachments/:id/preview', requireAuth, (req, res) => {
  const attachment = db.prepare(`SELECT * FROM chat_attachments WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL`).get(req.params.id, req.user.id);
  if (!attachment) throw new HttpError(404, 'Lampiran tidak ditemukan.', 'ATTACHMENT_NOT_FOUND');
  if (path.extname(attachment.original_name).toLowerCase() === '.docx') {
    try {
      const entry = openSafeZip(attachment.storage_path).getEntries()
        .find((item) => item.entryName.startsWith('word/media/') && /\.(?:png|jpe?g)$/i.test(item.entryName) && !item.isDirectory);
      if (entry) {
        res.type(path.extname(entry.entryName).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg');
        res.setHeader('Content-Disposition', 'inline');
        // Binary PNG/JPEG bytes come from an ownership-checked DOCX parsed by openSafeZip, not HTML input.
        return res.send(entry.getData()); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
      }
    } catch { /* Unsupported DOCX preview falls through to the normal 415 response. */ }
    throw new HttpError(415, 'Dokumen ini tidak memiliki thumbnail visual.', 'PREVIEW_UNSUPPORTED');
  }
  if (!String(attachment.mime_type || '').startsWith('image/') && attachment.mime_type !== 'application/pdf') throw new HttpError(415, 'Preview hanya tersedia untuk gambar dan PDF.', 'PREVIEW_UNSUPPORTED');
  res.type(attachment.mime_type);
  res.setHeader('Content-Disposition', 'inline');
  sendPrivateFile(res, attachment.storage_path);
});

app.get('/api/chat/attachments/:id/file', requireAuth, (req, res) => {
  const attachment = db.prepare(`
    SELECT * FROM chat_attachments
    WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL
  `).get(req.params.id, req.user.id);
  if (!attachment) throw new HttpError(404, 'Lampiran tidak ditemukan.', 'ATTACHMENT_NOT_FOUND');
  res.type(attachment.detected_mime || attachment.mime_type || mime.lookup(attachment.original_name) || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${sanitizeFilename(attachment.original_name)}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  sendPrivateFile(res, attachment.storage_path);
});

app.get('/api/chat/attachments/:id/text-preview', requireAuth, asyncHandler(async (req, res) => {
  const attachment = db.prepare(`
    SELECT * FROM chat_attachments
    WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL
  `).get(req.params.id, req.user.id);
  if (!attachment) throw new HttpError(404, 'Lampiran tidak ditemukan.', 'ATTACHMENT_NOT_FOUND');
  const text = String(await extractText(attachment))
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1600);
  res.json({ text });
}));

app.post('/api/chat/sessions/:id/actions', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const input = chatActionSchema.parse(req.body || {});
  let session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL').get(req.params.id, req.user.id);
  if (!session) throw new HttpError(404, 'Percakapan tidak ditemukan.', 'CHAT_NOT_FOUND');
  if (input.type === 'SUBMIT_CLARIFICATION') {
    enforceContentPolicy({
      text: [input.payload.courseName, input.payload.practiceTopic, input.payload.answer].filter(Boolean).join(' - '),
      userId: req.user.id,
      sessionId: session.id,
      direction: 'input',
    });
  }
  const existing = db.prepare(`
    SELECT id FROM chat_session_actions
    WHERE session_id = ? AND owner_user_id = ? AND idempotency_key = ?
  `).get(session.id, req.user.id, input.idempotencyKey);
  if (existing) return res.json(chatConversationPayload(session, req.user, { idempotent: true, autoGenerate: false }));

  const state = session.workflow_state || 'NEW_CHAT';
  if (input.type === 'CONTINUE_WITHOUT_SOURCE' && !['SOURCE_RECOMMENDED', 'WAITING_SOURCE_DECISION'].includes(state)) {
    throw new HttpError(409, 'Keputusan sumber tidak sesuai dengan tahap percakapan saat ini.', 'CHAT_ACTION_STATE_INVALID');
  }
  if (input.type === 'SUBMIT_CLARIFICATION' && state !== 'CLARIFICATION_REQUIRED') {
    throw new HttpError(409, 'Klarifikasi ini sudah diproses atau tidak lagi dibutuhkan.', 'CHAT_ACTION_STATE_INVALID');
  }
  if (['CONTINUE_WITHOUT_SOURCE', 'SUBMIT_CLARIFICATION'].includes(input.type)) {
    reserveLaprakCredit(req.user.id, session.id);
  }

  let autoGenerate = false;
  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO chat_session_actions (
        id, session_id, owner_user_id, idempotency_key, action_type, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(nanoid(), session.id, req.user.id, input.idempotencyKey, input.type, JSON.stringify(input.payload), now());

    if (input.type === 'CONTINUE_WITHOUT_SOURCE') {
      const sourceStatus = defaultChatSourceStatus(session.source_status_json);
      const targetState = input.payload.availability === 'not_available' ? 'NOT_AVAILABLE' : 'SKIPPED';
      const sourceType = input.payload.sourceType || 'all';
      const sourceKeys = sourceType === 'all'
        ? Object.keys(sourceStatus)
        : sourceType === 'module'
          ? ['module', 'instruction', 'template', 'supportingDocument']
          : sourceType === 'practice_evidence'
            ? ['practiceEvidence']
            : [sourceType === 'supporting_document' ? 'supportingDocument' : sourceType];
      sourceKeys.forEach((key) => {
        if (sourceStatus[key] === 'UNKNOWN' || sourceStatus[key] === 'AVAILABLE') sourceStatus[key] = targetState;
      });
      db.prepare(`
        UPDATE chat_sessions SET source_status_json = ?, source_recommendation_shown = 1,
          workflow_state = 'ANALYZING_INPUT', updated_at = ? WHERE id = ?
      `).run(JSON.stringify(sourceStatus), now(), session.id);
      session = refreshChatWorkflow(session.id, req.user);
      const workflow = chatWorkflow(session, req.user);
      const analysis = analyzeChatRequest({
        session,
        messages: listChatMessages(session.id, req.user.id),
        attachments: listChatAttachments(session.id, req.user.id),
      });
      autoGenerate = workflow.state === 'READY_TO_GENERATE' && analysis.hasGenerationIntent;
    } else if (input.type === 'SUBMIT_CLARIFICATION') {
      const configuration = parseJson(session.configuration_json, {});
      const missing = session.missing_critical_context || '';
      let courseName = String(input.payload.courseName || '').trim();
      let practiceTopic = String(input.payload.practiceTopic || '').trim();
      if (!practiceTopic && input.payload.answer) practiceTopic = String(input.payload.answer).trim();
      if (input.payload.forceFromSources && !practiceTopic) {
        const source = listChatAttachments(session.id, req.user.id)[0];
        practiceTopic = source ? path.basename(source.original_name, path.extname(source.original_name)).slice(0, 150) : 'Topik dari bahan yang tersedia';
      }
      if (missing === 'course_name' && !courseName && input.payload.answer) courseName = String(input.payload.answer).trim();
      if (missing === 'practice_topic' && !practiceTopic && input.payload.answer) practiceTopic = String(input.payload.answer).trim();
      if (!courseName) courseName = session.course_name || configuration.courseName || '';
      if (!practiceTopic) practiceTopic = session.practice_topic || configuration.moduleTitle || '';
      if (!courseName || !practiceTopic) {
        throw new HttpError(422, 'Mata kuliah dan materi praktikum wajib diisi sebelum melanjutkan.', 'CHAT_CONTEXT_INCOMPLETE');
      }
      const documentType = input.payload.documentType || session.document_type || 'lab_report';
      db.prepare(`
        UPDATE chat_sessions SET configuration_json = ?, document_type = ?, course_name = ?,
          practice_topic = ?, clarification_count = 1, missing_critical_context = '',
          workflow_state = 'READY_TO_GENERATE', updated_at = ? WHERE id = ?
      `).run(
        JSON.stringify({ ...configuration, courseName, moduleTitle: practiceTopic }),
        documentType,
        courseName,
        practiceTopic,
        now(),
        session.id,
      );
      session = refreshChatWorkflow(session.id, req.user, { forceReady: true });
      autoGenerate = true;
    } else if (input.type === 'DOCUMENT_READY') {
      if (!session.document_id) throw new HttpError(409, 'Dokumen kerja belum dibuat.', 'CHAT_DOCUMENT_MISSING');
      const document = db.prepare('SELECT generated_at FROM documents WHERE id = ? AND owner_user_id = ?').get(session.document_id, req.user.id);
      if (!document?.generated_at) throw new HttpError(409, 'Dokumen belum selesai dibuat.', 'CHAT_DOCUMENT_NOT_READY');
      db.prepare(`UPDATE chat_sessions SET workflow_state = 'DOCUMENT_PREVIEW', updated_at = ? WHERE id = ?`).run(now(), session.id);
      session = db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(session.id);
    }
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
  if (input.type === 'SUBMIT_CLARIFICATION') {
    session = await refreshChatWorkPlan(
      db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ?').get(session.id, req.user.id),
      req.user,
      {
        content: [input.payload.courseName, input.payload.practiceTopic, input.payload.answer].filter(Boolean).join(' - '),
        aiMode: input.payload.aiMode || 'basic',
      },
    );
  }

  audit(req.user.id, 'chat.action_completed', 'chat_session', session.id, { type: input.type });
  return res.json(chatConversationPayload(
    db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ?').get(session.id, req.user.id),
    req.user,
    { autoGenerate },
  ));
}));

app.post('/api/chat/sessions/:id/messages', requireAuth, requireCsrf, aiChatLimiter, asyncHandler(async (req, res) => {
  const input = chatMessageSchema.parse(req.body || {});
  const idempotencyKey = String(req.get('idempotency-key') || '').trim();
  if (idempotencyKey && idempotencyKey !== input.requestId) {
    throw new HttpError(400, 'Idempotency-Key harus sama dengan requestId.', 'IDEMPOTENCY_KEY_MISMATCH');
  }
  const wantsStream = String(req.headers.accept || '').includes('text/event-stream');
  let sseChannel = null;
  let streamedText = false;
  let onDelta = null;
  const mutationResult = await runCanonicalChatMutation({
    ownerUserId: req.user.id,
    requestId: input.requestId,
    input: {
      sessionId: req.params.id,
      content: input.content,
      aiMode: input.aiMode,
      allowExternalAi: input.allowExternalAi,
    },
    execute: async () => {
      if (wantsStream) {
        sseChannel = createSseChannel(res);
        res.locals.sseChannel = sseChannel;
        onDelta = (text) => {
      streamedText = true;
      sseChannel.writeDelta(text);
        };
      }
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL').get(req.params.id, req.user.id);
  if (!session) throw new HttpError(404, 'Percakapan tidak ditemukan.', 'CHAT_NOT_FOUND');
  const aiRuntimeSnapshot = captureAiRuntimeConfiguration();
  enforceContentPolicy({ text: input.content, userId: req.user.id, sessionId: session.id, direction: 'input' });
  const userConfiguration = parseJson(session.configuration_json, {});
  if (isAiConfigured(aiRuntimeSnapshot) && !input.allowExternalAi) {
    throw new HttpError(412, 'Izinkan Laprakin memproses bahanmu di Pengaturan sebelum memakai chat.', 'AI_CONSENT_REQUIRED');
  }
  if (isAiConfigured(aiRuntimeSnapshot)) {
    requireExternalAiConsent({ userId: req.user.id, manifest: aiRuntimeSnapshot.processorManifest });
  }
  const aiModes = aiModeAccessForUser(req.user.id);
  if (!aiModes[input.aiMode]?.available) {
    const message = input.aiMode === 'xtrathink'
      ? 'Mode XtraThink hanya tersedia untuk subscription Max aktif.'
      : 'Mode Thinking membutuhkan pembelian kredit Laprakin atau subscription Pro/Max aktif.';
    throw new HttpError(403, message, 'AI_MODE_LOCKED');
  }
  const hadCreditReservation = Boolean(session.processing_credit_bucket && !session.processing_credit_refunded_at);
  reserveLaprakCredit(req.user.id, session.id, input.requestId);
  if (!session.document_id) {
    const previousState = session.workflow_state || 'NEW_CHAT';
    const priorUserMessages = listChatMessages(session.id, req.user.id)
      .filter((message) => message.role === 'user')
      .slice(-40);
    const inferredContext = inferChatContext({
      messages: [...priorUserMessages, { role: 'user', content: input.content }],
      configuration: parseJson(session.configuration_json, {}),
    });
    const configurationRevision = aiRuntimeSnapshot.revisionId;
    if (previousState === 'CLARIFICATION_REQUIRED') {
      const answer = input.content.replace(/\s+/g, ' ').trim().slice(0, 150);
      const parts = answer.split(/\s*(?:,|;|\|| - )\s*/).filter(isPlausibleAcademicContext);
      if (session.missing_critical_context === 'course_name' && !inferredContext.configuration.courseName && isPlausibleAcademicContext(answer)) {
        inferredContext.configuration.courseName = answer;
      } else if (session.missing_critical_context === 'practice_topic' && !inferredContext.configuration.moduleTitle && isPlausibleAcademicContext(answer)) {
        inferredContext.configuration.moduleTitle = answer;
      } else if (session.missing_critical_context === 'course_and_topic') {
        if (!inferredContext.configuration.courseName && parts.length > 1) inferredContext.configuration.courseName = parts[0];
        if (!inferredContext.configuration.moduleTitle && parts.length > 1) inferredContext.configuration.moduleTitle = parts.slice(1).join(' - ');
      } else if (session.missing_critical_context === 'document_type_and_topic' && !inferredContext.configuration.moduleTitle && isPlausibleAcademicContext(answer)) {
        inferredContext.configuration.moduleTitle = answer;
      }
    }
    const links = Array.from(input.content.matchAll(/https?:\/\/[^\s)]+/g)).map((match) => match[0]).slice(0, 8);
    const timestamp = now();
    const userMessageId = nanoid();
    db.prepare(`
      INSERT INTO chat_messages (id, session_id, owner_user_id, role, content, meta_json, created_at, request_id)
      VALUES (?, ?, ?, 'user', ?, ?, ?, ?)
    `).run(userMessageId, session.id, req.user.id, input.content, JSON.stringify({ links, aiMode: input.aiMode }), timestamp, input.requestId);
    db.prepare(`
      UPDATE chat_attachments SET message_id = ?
      WHERE session_id = ? AND owner_user_id = ? AND message_id IS NULL AND deleted_at IS NULL
    `).run(userMessageId, session.id, req.user.id);
    db.prepare('UPDATE chat_sessions SET configuration_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(inferredContext.configuration), timestamp, session.id);
    let refreshed = refreshChatWorkflow(session.id, req.user);
    let assistant;
    try {
      assistant = isAiConfigured(aiRuntimeSnapshot)
        ? await answerWorkspaceChat({ session: refreshed, user: req.user, content: input.content, aiMode: input.aiMode, requestId: input.requestId, onDelta, signal: sseChannel?.signal, runtimeSnapshot: aiRuntimeSnapshot })
        : { text: FRIENDLY_AI_NOT_READY_MESSAGE, model: 'local-unconfigured', provider: 'local' };
    } catch (error) {
      if (!hadCreditReservation) refundLaprakCredit(req.user.id, session.id, input.requestId);
      throw error;
    }
    enforceContentPolicy({ text: assistant.text, userId: req.user.id, sessionId: session.id, direction: 'output' });
    const analysis = analyzeChatRequest({
      session: refreshed,
      messages: listChatMessages(refreshed.id, req.user.id),
      attachments: listChatAttachments(refreshed.id, req.user.id),
    });
    const initialWorkflow = chatWorkflow(refreshed, req.user);
    const isClarification = assistant.isClarification ?? initialWorkflow.state === 'CLARIFICATION_REQUIRED';
    const fallbackShouldGenerate = initialWorkflow.state === 'READY_TO_GENERATE'
      && (previousState === 'CLARIFICATION_REQUIRED' || analysis.hasAttachments || analysis.hasGenerationIntent);
    // Jika konteks sudah lengkap dan user sudah mengirim bahan, pembuatan
    // laprak tidak boleh berhenti hanya karena jawaban singkat dari model
    // memilih RESPOND. Model tetap membantu menentukan konteks, tetapi
    // kesiapan workflow menjadi sumber keputusan eksekusinya.
    const autoGenerate = initialWorkflow.state === 'READY_TO_GENERATE'
      && !isClarification
      && (assistant.shouldGenerate === true || fallbackShouldGenerate);
    if (!isClarification && refreshed.course_name) {
      refreshed = await refreshChatWorkPlan(refreshed, req.user, { content: input.content, aiMode: input.aiMode, runtimeSnapshot: aiRuntimeSnapshot });
    }
    const currentTitle = String(refreshed.title || '').trim();
    const titleIsGeneric = /^(?:laprak baru|chat baru|untitled)$/i.test(String(session.title || '').trim())
      || /^(?:laprak baru|chat baru|untitled)$/i.test(currentTitle)
      || currentTitle === String(refreshed.generated_title || '').trim();
    if (assistant.title && titleIsGeneric) {
      db.prepare('UPDATE chat_sessions SET title = ?, generated_title = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?')
        .run(assistant.title, assistant.title, now(), refreshed.id, req.user.id);
      refreshed = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ?').get(refreshed.id, req.user.id);
    }
    if (!autoGenerate) {
      const finishedAt = now();
      db.prepare(`
        INSERT INTO chat_messages (id, session_id, owner_user_id, role, content, meta_json, created_at, request_id)
        VALUES (?, ?, ?, 'assistant', ?, ?, ?, ?)
      `).run(
        nanoid(),
        session.id,
        req.user.id,
        assistant.text,
        JSON.stringify({
          kind: isClarification ? 'clarification' : 'assistant_response',
          aiMode: input.aiMode,
          provider: assistant.provider || (isAiConfigured(aiRuntimeSnapshot) ? 'nararouter' : 'local'),
          model: assistant.model,
          configurationRevision,
          routeId: assistant.routeId || '',
          promptTemplateRevision: WORKSPACE_CHAT_PROMPT_REVISION,
          workflow: assistant.workflow || null,
          workPlan: isClarification ? null : parseJson(refreshed.work_plan_json, {}),
          thinkingStartedAt: timestamp,
          thinkingFinishedAt: finishedAt,
          isClarification,
        }),
        finishedAt,
        input.requestId,
      );
    }
    const workflow = chatWorkflow(refreshed, req.user);
    audit(req.user.id, 'chat.input_analyzed', 'chat_session', refreshed.id, {
      workflowState: workflow.state,
      documentType: workflow.documentType,
    });
    return {
      statusCode: 200,
      response: chatConversationPayload(refreshed, req.user, { autoGenerate }),
      resourceId: refreshed.id,
      providerId: assistant.provider || (isAiConfigured(aiRuntimeSnapshot) ? 'nararouter' : 'local'),
      modelId: assistant.model || '',
      configurationRevision,
      promptTemplateRevision: WORKSPACE_CHAT_PROMPT_REVISION,
    };
  }
  const priorUserMessages = db.prepare(`
    SELECT role, content FROM chat_messages
    WHERE session_id = ? AND owner_user_id = ? AND role = 'user'
    ORDER BY created_at DESC LIMIT 40
  `).all(session.id, req.user.id).reverse();
  const inferredContext = inferChatContext({
    messages: [...priorUserMessages, { role: 'user', content: input.content }],
    configuration: parseJson(session.configuration_json, {}),
  });
  const effectiveSession = {
    ...session,
    configuration_json: JSON.stringify(inferredContext.configuration),
    configuration: inferredContext.configuration,
  };
  const configurationRevision = aiRuntimeSnapshot.revisionId;
  const links = Array.from(input.content.matchAll(/https?:\/\/[^\s)]+/g)).map((match) => match[0]).slice(0, 8);
  let assistant;
  try {
    assistant = isAiConfigured(aiRuntimeSnapshot)
      ? await answerWorkspaceChat({ session: effectiveSession, user: req.user, content: input.content, aiMode: input.aiMode, requestId: input.requestId, onDelta, signal: sseChannel?.signal, runtimeSnapshot: aiRuntimeSnapshot })
      : { text: FRIENDLY_AI_NOT_READY_MESSAGE, model: 'local-unconfigured', provider: 'local' };
  } catch (error) {
    if (!hadCreditReservation) refundLaprakCredit(req.user.id, session.id, input.requestId);
    throw error;
  }
  enforceContentPolicy({ text: assistant.text, userId: req.user.id, sessionId: session.id, direction: 'output' });
  const timestamp = now();
  persistChatExchange({
    sessionId: session.id,
    ownerUserId: req.user.id,
    requestId: input.requestId,
    userMessage: {
      content: input.content,
      meta: { links, aiMode: input.aiMode },
      createdAt: timestamp,
    },
    assistantMessage: {
      content: assistant.text,
      meta: {
        aiMode: input.aiMode,
        provider: assistant.provider || (isAiConfigured(aiRuntimeSnapshot) ? 'nararouter' : 'local'),
        model: assistant.model,
        configurationRevision,
        routeId: assistant.routeId || '',
        promptTemplateRevision: WORKSPACE_CHAT_PROMPT_REVISION,
        workflow: assistant.workflow || null,
      },
      createdAt: timestamp,
    },
    sessionConfigurationJson: effectiveSession.configuration_json,
  });
  const workflow = chatWorkflow(effectiveSession, req.user);
  if (workflow.stage !== 'intake' && (!session.title || /^laprak baru$/i.test(session.title.trim()))) {
    const cfg = inferredContext.configuration;
    const candidate = [cfg.courseName, cfg.moduleTitle].filter(Boolean).join(' — ') || input.content.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
    const autoTitle = (candidate || 'Laprak baru').slice(0, 72);
    db.prepare(`UPDATE chat_sessions SET title = ?, course_group = CASE WHEN course_group = '' OR course_group = 'Belum dikelompokkan' THEN ? ELSE course_group END WHERE id = ?`).run(autoTitle, cfg.courseName || 'Belum dikelompokkan', session.id);
  }
  audit(req.user.id, 'ai.chat_completed', 'chat_session', session.id, { mode: input.aiMode, model: assistant.model, provider: assistant.provider || (isAiConfigured(aiRuntimeSnapshot) ? 'nararouter' : 'local'), configurationRevision, routeId: assistant.routeId || '' });
  const messages = listChatMessages(session.id, req.user.id);
  const refreshedSession = exposeChatSession(db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(session.id));
  return {
    statusCode: 200,
    response: { session: refreshedSession, messages, attachments: listChatAttachments(session.id, req.user.id), workflow: chatWorkflow(refreshedSession, req.user) },
    resourceId: session.id,
    providerId: assistant.provider || (isAiConfigured(aiRuntimeSnapshot) ? 'nararouter' : 'local'),
    modelId: assistant.model || '',
    configurationRevision,
    promptTemplateRevision: WORKSPACE_CHAT_PROMPT_REVISION,
  };
    },
  });
  if (!wantsStream) return res.status(mutationResult.statusCode).json(mutationResult.response);
  if (!sseChannel) {
    sseChannel = createSseChannel(res);
    res.locals.sseChannel = sseChannel;
  }
  const assistantText = [...(mutationResult.response?.messages || [])]
    .reverse()
    .find((message) => message.role === 'assistant')?.content || '';
  if (!streamedText && assistantText) sseChannel.writeDelta(assistantText);
  return sseChannel.finish(mutationResult.response);
}));

app.put('/api/chat/messages/:messageId/reaction', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const input = messageReactionSchema.parse(req.body || {});
  const reaction = setMessageReaction({
    ownerUserId: req.user.id,
    messageId: req.params.messageId,
    reaction: input.reaction,
    reasonCode: input.reasonCode,
  });
  audit(req.user.id, 'chat.message_reaction_set', 'chat_message', req.params.messageId, {
    reaction: reaction.reaction,
    reasonCode: reaction.reasonCode,
  });
  res.json({ reaction });
}));

app.delete('/api/chat/messages/:messageId/reaction', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  removeMessageReaction({ ownerUserId: req.user.id, messageId: req.params.messageId });
  audit(req.user.id, 'chat.message_reaction_removed', 'chat_message', req.params.messageId, {});
  res.json({ reaction: null });
}));

app.get('/api/mutations/:requestId', requireAuth, asyncHandler(async (req, res) => {
  const mutation = getMutationSnapshot({
    ownerUserId: req.user.id,
    operation: CHAT_MESSAGE_OPERATION,
    requestId: req.params.requestId,
  });
  if (!mutation) throw new HttpError(404, 'Mutasi tidak ditemukan.', 'MUTATION_NOT_FOUND');
  const statusByState = {
    completed: 200,
    processing: 202,
    retryable_failed: 409,
    terminal_failed: 422,
    canceled: 410,
  };
  return res.status(statusByState[mutation.state] || 200).json(mutation);
}));

app.post('/api/chat/sessions/:id/messages/:messageId/revise', requireAuth, requireCsrf, aiChatLimiter, asyncHandler(async (req, res) => {
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL').get(req.params.id, req.user.id);
  if (!session) throw new HttpError(404, 'Percakapan tidak ditemukan.', 'CHAT_NOT_FOUND');
  const aiRuntimeSnapshot = captureAiRuntimeConfiguration();

  let input;
  try {
    input = validateRevisionRequest(req.body || {});
  } catch (error) {
    throw revisionHttpError(error);
  }
  const userConfiguration = parseJson(session.configuration_json, {});
  if (userConfiguration.allowExternalAi !== true) {
    throw new HttpError(412, 'Izinkan Laprakin memproses bahanmu di Pengaturan sebelum memakai chat.', 'AI_CONSENT_REQUIRED');
  }

  const messages = listChatMessages(session.id, req.user.id);
  let revisionPlan;
  try {
    revisionPlan = buildRevisionPlan(messages, req.params.messageId, input.mode, input.content);
  } catch (error) {
    throw revisionHttpError(error);
  }
  enforceContentPolicy({ text: revisionPlan.userContent, userId: req.user.id, sessionId: session.id, direction: 'input' });

  const sourceAiMode = String(revisionPlan.source.meta?.aiMode || 'basic');
  const aiModes = aiModeAccessForUser(req.user.id);
  if (!aiModes[sourceAiMode]?.available) {
    const message = sourceAiMode === 'xtrathink'
      ? 'Mode XtraThink hanya tersedia untuk subscription Max aktif.'
      : 'Mode Thinking membutuhkan pembelian kredit Laprakin atau subscription Pro/Max aktif.';
    throw new HttpError(403, message, 'AI_MODE_LOCKED');
  }

  const hadCreditReservation = Boolean(session.processing_credit_bucket && !session.processing_credit_refunded_at);
  reserveLaprakCredit(req.user.id, session.id);

  const retainedMessages = revisionPlan.retainedMessages;
  const retainedMessageIds = new Set(retainedMessages.map((message) => message.id));
  const priorUserMessages = retainedMessages
    .filter((message) => message.role === 'user')
    .slice(-40);
  const retainedAttachments = db.prepare(`
    SELECT * FROM chat_attachments
    WHERE session_id = ? AND owner_user_id = ? AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 24
  `).all(session.id, req.user.id).filter((attachment) => !attachment.message_id || retainedMessageIds.has(attachment.message_id));
  const inferredContext = inferChatContext({
    messages: [...priorUserMessages, { role: 'user', content: revisionPlan.userContent }],
    configuration: userConfiguration,
  });
  const effectiveSession = {
    ...session,
    configuration_json: JSON.stringify(inferredContext.configuration),
    configuration: inferredContext.configuration,
  };
  let assistant;
  try {
    assistant = isAiConfigured(aiRuntimeSnapshot)
      ? await answerWorkspaceChat({
        session: effectiveSession,
        user: req.user,
        content: revisionPlan.userContent,
        aiMode: sourceAiMode,
        historyRowsOverride: [...retainedMessages, { role: 'user', content: revisionPlan.userContent }],
        attachmentRowsOverride: retainedAttachments,
        runtimeSnapshot: aiRuntimeSnapshot,
      })
      : { text: FRIENDLY_AI_NOT_READY_MESSAGE, model: 'local-unconfigured', provider: 'local' };
  } catch (error) {
    if (!hadCreditReservation) refundLaprakCredit(req.user.id, session.id);
    throw error;
  }
  enforceContentPolicy({ text: assistant.text, userId: req.user.id, sessionId: session.id, direction: 'output' });

  const timestamp = now();
  const links = Array.from(revisionPlan.userContent.matchAll(/https?:\/\/[^\s)]+/g)).map((match) => match[0]).slice(0, 8);
  const revisionMeta = {
    sourceMessageId: revisionPlan.source.id,
    mode: input.mode,
    revisionNumber: revisionPlan.revisionNumber,
  };
  persistChatExchange({
    sessionId: session.id,
    ownerUserId: req.user.id,
    userMessage: {
      content: revisionPlan.userContent,
      meta: {
        links,
        aiMode: sourceAiMode,
        revision: revisionMeta,
      },
      createdAt: timestamp,
    },
    assistantMessage: {
      content: assistant.text,
      meta: {
        aiMode: sourceAiMode,
        provider: assistant.provider || (isAiConfigured(aiRuntimeSnapshot) ? 'nararouter' : 'local'),
        model: assistant.model,
        configurationRevision: assistant.configurationRevision || aiRuntimeSnapshot.revisionId,
        routeId: assistant.routeId || '',
        workflow: assistant.workflow || null,
        revision: revisionMeta,
      },
      createdAt: timestamp,
    },
    sessionConfigurationJson: effectiveSession.configuration_json,
    sourceMessageId: revisionPlan.source.id,
    sourceMessageMeta: {
      revision: {
        latestRevisionNumber: revisionPlan.revisionNumber,
      },
    },
    deleteMessageIds: messages.slice(retainedMessages.length).map((message) => message.id),
  });

  let refreshed = refreshChatWorkflow(session.id, req.user);
  const currentTitle = String(refreshed.title || '').trim();
  const titleIsGeneric = /^(?:laprak baru|chat baru|untitled)$/i.test(String(session.title || '').trim())
    || /^(?:laprak baru|chat baru|untitled)$/i.test(currentTitle)
    || currentTitle === String(refreshed.generated_title || '').trim();
  if (assistant.title && titleIsGeneric) {
    db.prepare('UPDATE chat_sessions SET title = ?, generated_title = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?')
      .run(assistant.title, assistant.title, now(), refreshed.id, req.user.id);
    refreshed = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ?').get(refreshed.id, req.user.id);
  }

  audit(req.user.id, 'ai.chat_revised', 'chat_session', session.id, {
    mode: input.mode,
    sourceMessageId: revisionPlan.source.id,
    revisionNumber: revisionPlan.revisionNumber,
    model: assistant.model,
    provider: assistant.provider || (isAiConfigured(aiRuntimeSnapshot) ? 'nararouter' : 'local'),
  });
  return res.json(chatConversationPayload(refreshed, req.user, {
    revision: revisionMeta,
  }));
}));

app.post('/api/chat/sessions/:id/document', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL').get(req.params.id, req.user.id);
  if (!session) throw new HttpError(404, 'Percakapan tidak ditemukan.', 'CHAT_NOT_FOUND');
  if (session.document_id) {
    const jobId = ensureDocumentPipeline({ documentId: session.document_id, userId: req.user.id, aiMode: req.body?.aiMode || 'basic' });
    return res.json({ document: exposeDocument(db.prepare('SELECT * FROM documents WHERE id = ?').get(session.document_id)), jobId });
  }
  const workflow = chatWorkflow(session, req.user);
  if (!workflow.canCreateDocument) {
    throw new HttpError(422, `Konteks belum cukup untuk membuat dokumen. ${workflow.nextQuestion}`, 'CHAT_CONTEXT_INCOMPLETE');
  }
  reserveLaprakCredit(req.user.id, session.id);
  const sessionConfiguration = parseJson(session.configuration_json, {});
  const messages = db.prepare(`SELECT content FROM chat_messages WHERE session_id = ? AND owner_user_id = ? AND role = 'user' ORDER BY created_at`).all(session.id, req.user.id);
  const title = session.generated_title
    || (session.title === 'Laprak baru' ? (sessionConfiguration.moduleTitle || sessionConfiguration.courseName || 'Laprak dengan konteks terbatas').slice(0, 120) : session.title);
  const id = nanoid(); const timestamp = now();
  const recipe = {
    tone: sessionConfiguration.tone || 'formal',
    perspective: sessionConfiguration.perspective || 'saya',
    includeConclusion: false,
    useTimesNewRoman: true,
    blackText: true,
    allowExternalAi: sessionConfiguration.allowExternalAi !== false,
    sourceMode: workflow.sourceMode === 'missing' ? 'unavailable' : workflow.sourceMode,
    evidenceMode: workflow.evidenceMode === 'missing' ? 'unavailable' : workflow.evidenceMode,
    lecturerName: sessionConfiguration.lecturerName || req.user.lecturer_name || '',
    lecturerNip: sessionConfiguration.lecturerNip || req.user.lecturer_nip || '',
    instructions: [sessionConfiguration.instructions || '', sessionConfiguration.customStructure ? `Struktur khusus: ${sessionConfiguration.customStructure}` : '', ...messages.map((message) => message.content)].filter(Boolean).join('\n').slice(0, 3000),
  };
  db.prepare(`INSERT INTO documents (id, owner_user_id, title, course_name, module_title, lecturer_name, academic_year, document_profile, recipe_json, priority, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'normal', 'draft', ?, ?)`)
    .run(id, req.user.id, title, sessionConfiguration.courseName || '', sessionConfiguration.moduleTitle || '', recipe.lecturerName || '', sessionConfiguration.academicYear || '2025/2026', sessionConfiguration.documentProfile || (session.structure_mode === 'custom' ? 'proyek' : 'langkah'), JSON.stringify(recipe), timestamp, timestamp);
  const attachments = db.prepare(`SELECT * FROM chat_attachments WHERE session_id = ? AND owner_user_id = ? AND deleted_at IS NULL ORDER BY created_at`).all(session.id, req.user.id);
  for (const attachment of attachments) {
    copyChatAttachmentToDocument(id, req.user.id, attachment);
  }
  seedDocumentTasks(id, req.user.id, null);
  db.prepare(`UPDATE chat_sessions SET document_id = ?, workflow_state = 'GENERATING', updated_at = ? WHERE id = ?`).run(id, now(), session.id);
  audit(req.user.id, 'chat.document_created', 'chat_session', session.id, { documentId: id, attachmentCount: attachments.length });
  const jobId = ensureDocumentPipeline({ documentId: id, userId: req.user.id, aiMode: req.body?.aiMode || 'basic' });
  res.status(201).json({ document: exposeDocument(db.prepare('SELECT * FROM documents WHERE id = ?').get(id)), workflow, jobId });
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
  enforceContentPolicy({ text: input.content, userId: req.user.id, sessionId: thread.id, direction: 'input', targetType: 'support_thread' });
  const decision = await answerScopedSupportMessage(input.content, req.user.id);
  enforceContentPolicy({ text: decision.answer, userId: req.user.id, sessionId: thread.id, direction: 'output', targetType: 'support_thread' });
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

app.get('/api/documents/:id', requireAuth, requireDocumentOwner, asyncHandler(async (req, res) => {
  await prepareDocumentEvidence(req.document.id, req.user.id);
  res.json(exposeDocument(req.document));
}));

app.get('/api/documents/:id/preview.docx', requireAuth, requireDocumentOwner, asyncHandler(async (req, res) => {
  if (!req.document.generated_at) {
    throw new HttpError(409, 'Dokumen belum selesai dibuat.', 'DOCUMENT_NOT_READY');
  }
  const { buffer } = await buildDocumentDocxBuffer(req.document.id, req.user.id, { enforceExportQuality: false });
  res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `inline; filename="${sanitizeFilename(req.document.title || 'laprak')}.docx"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(buffer);
}));

app.get('/api/documents/:id/download.docx', requireAuth, requireDocumentOwner, asyncHandler(async (req, res) => {
  if (!req.document.generated_at) {
    throw new HttpError(409, 'Dokumen belum selesai dibuat.', 'DOCUMENT_NOT_READY');
  }
  const quizAccess = quizAccessForDocument(req.document.id, req.user.id);
  if (!quizAccess.canDownload) {
    throw new HttpError(403, `Nilai quiz minimal ${quizAccess.passScore}% diperlukan sebelum mengunduh dokumen.`, 'QUIZ_PASS_REQUIRED');
  }
  const { buffer } = await buildDocumentDocxBuffer(req.document.id, req.user.id, { enforceExportQuality: false });
  const fileName = `${sanitizeFilename(req.document.title || 'laprak')}.docx`;
  res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  audit(req.user.id, 'document.downloaded', 'document', req.document.id, {
    contentSignature: quizAccess.contentSignature,
  });
  res.send(buffer);
}));

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
        if (extension === '.docx' || extension === '.xlsx') {
          try {
            validateArchiveFile(file.path);
          } catch (error) {
            removeUploadedFiles(req.files);
            throw error;
          }
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
  sendPrivateDownload(res, file.storage_path, file.original_name);
});

app.get('/api/files/:id/preview', requireAuth, (req, res) => {
  const file = db.prepare(`
    SELECT * FROM document_files WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL
  `).get(req.params.id, req.user.id);
  if (!file) throw new HttpError(404, 'File tidak ditemukan.', 'FILE_NOT_FOUND');
  if (!String(file.mime_type || '').startsWith('image/') && file.mime_type !== 'application/pdf') {
    throw new HttpError(415, 'Preview hanya tersedia untuk gambar dan PDF.', 'PREVIEW_UNSUPPORTED');
  }
  res.type(file.mime_type);
  res.setHeader('Content-Disposition', 'inline');
  sendPrivateFile(res, file.storage_path);
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
    throw new HttpError(422, 'Bahan laprak belum cukup untuk disusun.', 'DOCUMENT_INPUT_INCOMPLETE');
  }
  const recipe = parseJson(req.document.recipe_json, {});
  if (!recipe.allowExternalAi) throw new HttpError(412, 'Izin pemrosesan bahan belum aktif.', 'AI_CONSENT_REQUIRED');
  const entitlement = revisionEntitlementForUser(req.user.id);
  const isInitialDraft = !req.document.generated_at;
  const revisionCount = Number(req.document.revision_count || 0);
  if (!isInitialDraft && revisionCount >= entitlement.maxRevisions) {
    throw new HttpError(402, `Batas ${entitlement.maxRevisions} revisi untuk laprak ini sudah dipakai. Pilih paket yang sesuai untuk revisi lebih banyak.`, 'REVISION_LIMIT_REACHED');
  }
  let bucket = null;
  let creditSessionId = null;
  if (isInitialDraft) {
    const creditSession = db.prepare(`
      SELECT id, processing_credit_bucket, processing_credit_refunded_at
      FROM chat_sessions
      WHERE document_id = ? AND owner_user_id = ? AND archived_at IS NULL
      LIMIT 1
    `).get(req.document.id, req.user.id);
    if (creditSession) {
      bucket = reserveLaprakCredit(req.user.id, creditSession.id);
      creditSessionId = creditSession.id;
    } else {
      bucket = consumeCredit(req.user.id, req.document.id);
    }
  }
  const jobId = enqueueJob({
    documentId: req.document.id,
    userId: req.user.id,
    jobType: 'generate',
    payload: { creditBucket: bucket, creditSessionId, isRevision: !isInitialDraft, revisionPlan: entitlement.plan },
  });
  db.prepare(`UPDATE chat_sessions SET workflow_state = 'GENERATING', updated_at = ? WHERE document_id = ? AND owner_user_id = ?`)
    .run(now(), req.document.id, req.user.id);
  evaluateGenerationBurstRisk(req.user.id);
  res.status(202).json({ jobId, bucket, isRevision: !isInitialDraft, revisionLimit: entitlement.maxRevisions, revisionsUsed: revisionCount });
});

app.post('/api/documents/:id/revise', requireAuth, requireCsrf, requireDocumentOwner, aiChatLimiter, asyncHandler(async (req, res) => {
  const input = revisionSchema.parse(req.body || {});
  enforceContentPolicy({ text: input.instruction, userId: req.user.id, sessionId: req.document.id, direction: 'input', targetType: 'document' });
  if (!req.document.generated_at) throw new HttpError(409, 'Dokumen masih disiapkan. Revisi dapat ditulis setelah hasilnya tersedia.', 'REVISION_DRAFT_REQUIRED');
  ensureNoActiveJob(req.document.id, 'generate');
  const recipe = parseJson(req.document.recipe_json, {});
  if (!recipe.allowExternalAi) throw new HttpError(412, 'Izinkan Laprakin memproses bahanmu di Pengaturan sebelum merevisi draft.', 'AI_CONSENT_REQUIRED');
  const aiRuntimeSnapshot = captureAiRuntimeConfiguration();
  if (!isAiConfigured(aiRuntimeSnapshot)) throw new HttpError(503, FRIENDLY_AI_NOT_READY_MESSAGE, 'AI_NOT_READY');
  const entitlement = revisionEntitlementForUser(req.user.id);
  const revisionCount = Number(req.document.revision_count || 0);
  if (revisionCount >= entitlement.maxRevisions) {
    throw new HttpError(402, `Batas ${entitlement.maxRevisions} revisi untuk laprak ini sudah dipakai.`, 'REVISION_LIMIT_REACHED');
  }
  const session = db.prepare(`
    SELECT * FROM chat_sessions
    WHERE document_id = ? AND owner_user_id = ? AND archived_at IS NULL
    LIMIT 1
  `).get(req.document.id, req.user.id);
  if (!session) throw new HttpError(404, 'Percakapan dokumen tidak ditemukan.', 'CHAT_NOT_FOUND');
  const timestamp = now();
  const userMessageId = nanoid();
  db.prepare(`
    INSERT INTO chat_messages (id, session_id, owner_user_id, role, content, meta_json, created_at)
    VALUES (?, ?, ?, 'user', ?, ?, ?)
  `).run(userMessageId, session.id, req.user.id, input.instruction, JSON.stringify({ kind: 'revision_request', aiMode: input.aiMode || 'basic' }), timestamp);
  db.prepare(`
    UPDATE chat_attachments SET message_id = ?
    WHERE session_id = ? AND owner_user_id = ? AND message_id IS NULL AND deleted_at IS NULL
  `).run(userMessageId, session.id, req.user.id);
  let validation;
  try {
    validation = await validateDocumentRevision({
      document: req.document,
      session,
      user: req.user,
      instruction: input.instruction,
      aiMode: input.aiMode || 'basic',
      runtimeSnapshot: aiRuntimeSnapshot,
    });
  } catch {
    const cleanInstruction = String(input.instruction || '').trim();
    const asksForAssessment = /\b(?:apa\s+(?:yang\s+)?kurang|cek|periksa|nilai|menurutmu|jelaskan)\b/i.test(cleanInstruction);
    const requestsChange = /\b(?:ubah|revisi|perbaiki|rapikan|natural|template|struktur|bagian|kata|kalimat|gambar|tambah|hapus)\b/i.test(cleanInstruction);
    const action = asksForAssessment ? 'ANSWER' : requestsChange ? 'REVISE' : 'ASK';
    validation = {
      action,
      accepted: action === 'REVISE',
      response: action === 'REVISE'
        ? 'Saya akan menerapkan perbaikan berdasarkan isi dokumen dan percakapan sebelumnya.'
        : action === 'ANSWER'
          ? 'Dokumen belum dapat dinilai karena layanan AI sedang tidak tersedia.'
          : 'Sebutkan perubahan atau penilaian yang kamu butuhkan dari dokumen ini.',
      title: '',
      model: 'validation-fallback',
    };
  }
  const currentSessionTitle = String(session.title || '').trim();
  const generatedSessionTitle = String(session.generated_title || '').trim();
  const canReplaceTitle = !currentSessionTitle
    || /^(?:laprak baru|chat baru|untitled)$/i.test(currentSessionTitle)
    || currentSessionTitle === generatedSessionTitle
    || currentSessionTitle.length > 72;
  if (validation.title && canReplaceTitle) {
    db.prepare('UPDATE chat_sessions SET title = ?, generated_title = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?')
      .run(validation.title, validation.title, now(), session.id, req.user.id);
    session.title = validation.title;
    session.generated_title = validation.title;
  }
  if (validation.action === 'ANSWER') {
    const plannedSession = await refreshChatWorkPlan(session, req.user, {
      content: input.instruction,
      aiMode: input.aiMode || 'basic',
      runtimeSnapshot: aiRuntimeSnapshot,
    });
    const finishedAt = now();
    db.prepare(`
      INSERT INTO chat_messages (id, session_id, owner_user_id, role, content, meta_json, created_at)
      VALUES (?, ?, ?, 'assistant', ?, ?, ?)
    `).run(nanoid(), session.id, req.user.id, validation.response, JSON.stringify({
      kind: 'revision_answer',
      model: validation.model,
      workPlan: parseJson(plannedSession.work_plan_json, {}),
      thinkingStartedAt: timestamp,
      thinkingFinishedAt: finishedAt,
      isClarification: false,
    }), finishedAt);
    db.prepare(`UPDATE chat_sessions SET updated_at = ? WHERE id = ?`).run(finishedAt, session.id);
    return res.json({
      answered: true,
      conversation: chatConversationPayload(session.id, req.user),
    });
  }
  if (!validation.accepted) {
    db.prepare(`
      INSERT INTO chat_messages (id, session_id, owner_user_id, role, content, meta_json, created_at)
      VALUES (?, ?, ?, 'assistant', ?, ?, ?)
    `).run(nanoid(), session.id, req.user.id, validation.response, JSON.stringify({
      kind: 'revision_clarification',
      model: validation.model,
      isClarification: true,
    }), now());
    db.prepare(`UPDATE chat_sessions SET updated_at = ? WHERE id = ?`).run(now(), session.id);
    return res.json({
      needsClarification: true,
      conversation: chatConversationPayload(session.id, req.user),
    });
  }
  await refreshChatWorkPlan(session, req.user, {
    content: input.instruction,
    aiMode: input.aiMode || 'basic',
    runtimeSnapshot: aiRuntimeSnapshot,
  });
  const jobId = enqueueJob({
    documentId: req.document.id,
    userId: req.user.id,
    jobType: 'generate',
    payload: {
      isRevision: true,
      revisionPlan: entitlement.plan,
      revisionInstruction: input.instruction,
      aiMode: input.aiMode || 'basic',
    },
  });
  db.prepare(`UPDATE chat_sessions SET workflow_state = 'REVISION', updated_at = ? WHERE document_id = ? AND owner_user_id = ?`)
    .run(now(), req.document.id, req.user.id);
  evaluateGenerationBurstRisk(req.user.id);
  res.status(202).json({
    jobId,
    isRevision: true,
    revisionLimit: entitlement.maxRevisions,
    revisionsUsed: revisionCount,
    conversation: chatConversationPayload(session.id, req.user),
  });
}));

app.post('/api/documents/:id/quiz', requireAuth, requireCsrf, requireDocumentOwner, aiChatLimiter, asyncHandler(async (req, res) => {
  const runtimeSnapshot = captureAiRuntimeConfiguration();
  const attempt = await createDocumentQuizAttempt(req.document.id, req.user.id, { runtimeSnapshot });
  db.prepare(`UPDATE chat_sessions SET workflow_state = 'QUIZ_REQUIRED', updated_at = ? WHERE document_id = ? AND owner_user_id = ?`)
    .run(now(), req.document.id, req.user.id);
  res.status(201).json(attempt);
}));

app.post('/api/documents/:id/quiz/attempts/:attemptId', requireAuth, requireCsrf, requireDocumentOwner, (req, res) => {
  const input = quizAttemptSchema.parse(req.body || {});
  const result = submitDocumentQuizAttempt(req.document.id, req.user.id, req.params.attemptId, input.answers);
  db.prepare(`UPDATE chat_sessions SET workflow_state = ?, updated_at = ? WHERE document_id = ? AND owner_user_id = ?`)
    .run(result.passed ? 'EXPORT_UNLOCKED' : 'QUIZ_REQUIRED', now(), req.document.id, req.user.id);
  res.json(result);
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
    let bucket = null;
    let creditSessionId = null;
    if (!document?.generated_at) {
      const creditSession = db.prepare(`
        SELECT id FROM chat_sessions
        WHERE document_id = ? AND owner_user_id = ? AND archived_at IS NULL
        LIMIT 1
      `).get(job.document_id, req.user.id);
      if (creditSession) {
        bucket = reserveLaprakCredit(req.user.id, creditSession.id);
        creditSessionId = creditSession.id;
      } else {
        bucket = consumeCredit(req.user.id, job.document_id);
      }
    }
    payload = { ...payload, creditBucket: bucket, creditSessionId, isRevision: Boolean(document?.generated_at) };
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
    if (job.job_type === 'generate' && payload.creditBucket) {
      if (payload.creditSessionId) refundLaprakCredit(req.user.id, payload.creditSessionId);
      else refundCredit(req.user.id, payload.creditBucket, job.document_id);
    }
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
  const quizAccess = quizAccessForDocument(req.document.id, req.user.id);
  if (!quizAccess.canDownload) {
    throw new HttpError(
      403,
      `Selesaikan quiz dari draft terbaru dengan nilai minimal ${quizAccess.passScore}% sebelum membuat file unduhan.`,
      'QUIZ_PASS_REQUIRED',
    );
  }
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
  const quizAccess = quizAccessForDocument(output.document_id, req.user.id);
  if (!quizAccess.canDownload) {
    throw new HttpError(
      403,
      `Nilai quiz minimal ${quizAccess.passScore}% diperlukan untuk mengunduh versi laporan ini.`,
      'QUIZ_PASS_REQUIRED',
    );
  }
  if (!output.content_signature || output.content_signature !== quizAccess.contentSignature) {
    throw new HttpError(409, 'File ini berasal dari versi laporan lama. Buat file Word baru dari draft terbaru.', 'EXPORT_VERSION_OUTDATED');
  }
  res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  sendPrivateDownload(res, output.storage_path, output.file_name);
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
    db.prepare('UPDATE chat_attachments SET deleted_at = ? WHERE owner_user_id = ? AND deleted_at IS NULL').run(now(), req.user.id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  audit(req.user.id, 'account.deleted', 'user', req.user.id, {});
  clearSession(res);
  res.status(204).end();
});

function requirePrivilegedUser(req, _res, next) {
  if (!isPrivilegedUser(req.user)) {
    return next(new HttpError(403, 'Akses tidak tersedia untuk tugas admin ini.', 'ADMIN_CAPABILITY_REQUIRED'));
  }
  return next();
}

function adminMfaState(req) {
  const status = getAdminMfaStatus(req.user.id);
  const required = adminMfaRequired({ role: req.user.role, mfaEnrolled: status.enrolled }, { enforced: config.adminMfaRequired });
  const verifiedAt = Number(req.session?.mfaVerifiedAt || 0);
  const verified = verifiedAt > 0
    && (Date.now() - verifiedAt) <= config.adminMfaWindowMinutes * 60 * 1000;
  return { ...status, required, verified, verifiedAt: verifiedAt || null };
}

function requireAdminMfa(req, _res, next) {
  if (/^\/mfa\/(?:status|enroll|verify)$/.test(req.path)) return next();
  if (!isPrivilegedUser(req.user)) {
    return next(new HttpError(403, 'Akses tidak tersedia untuk tugas admin ini.', 'ADMIN_CAPABILITY_REQUIRED'));
  }
  const state = adminMfaState(req);
  if (!state.required || state.verified) return next();
  if (!state.enrolled) {
    return next(new HttpError(428, 'Aktifkan verifikasi dua langkah sebelum memakai console admin.', 'ADMIN_MFA_ENROLLMENT_REQUIRED'));
  }
  return next(new HttpError(428, 'Masukkan kode verifikasi dua langkah untuk melanjutkan.', 'ADMIN_MFA_REQUIRED'));
}

function requireRecentAdminMfa(req, _res, next) {
  const state = adminMfaState(req);
  if (!state.enrolled) {
    return next(new HttpError(428, 'Aktifkan verifikasi dua langkah sebelum melakukan tindakan sensitif.', 'ADMIN_MFA_ENROLLMENT_REQUIRED'));
  }
  if (!state.verified) {
    return next(new HttpError(428, 'Verifikasi dua langkah terbaru diperlukan untuk tindakan ini.', 'ADMIN_MFA_REQUIRED'));
  }
  return next();
}

// Keep the step-up check uniform across every admin surface. Enrollment and
// challenge endpoints remain reachable so an administrator can recover a
// session without weakening the protection on operational mutations.
app.use('/api/admin', requireAuth, requireAdminMfa);

function adminMutationAction(req) {
  const segments = String(req.path || '').split('/').filter(Boolean).slice(0, 3);
  return `admin.${String(req.method || 'unknown').toLowerCase()}.${segments.join('.') || 'request'}`.slice(0, 120);
}

app.use('/api/admin', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  res.on('finish', () => {
    if (!isPrivilegedUser(req.user)) return;
    try {
      recordAdminAudit({
        actorUserId: req.user.id,
        action: adminMutationAction(req),
        target: String(req.path || '/').replace(/\/[^/]{18,}/g, '/:id').slice(0, 160),
        payloadDiff: { method: req.method, status: res.statusCode },
        ipAddress: req.ip,
      });
    } catch (error) {
      logger.error({ errorCode: 'ADMIN_AUDIT_WRITE_FAILED' }, 'admin audit write failed');
    }
  });
  return next();
});

function escapeEmailHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character]);
}

function renderBroadcastEmail(input) {
  const heading = capitalizeInitial(input.heading);
  const paragraphs = String(input.body || '')
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 16px;line-height:1.65">${escapeEmailHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const absoluteImageUrl = input.imageUrl
    ? new URL(input.imageUrl, config.appUrl).toString()
    : '';
  const image = absoluteImageUrl
    ? `<img src="${escapeEmailHtml(absoluteImageUrl)}" alt="" style="display:block;width:100%;height:auto;margin:0 0 24px;border-radius:8px">`
    : '';
  const cta = input.ctaLabel && input.ctaUrl
    ? `<p style="margin:24px 0 0"><a href="${escapeEmailHtml(input.ctaUrl)}" style="display:inline-block;padding:12px 18px;border-radius:6px;background:${input.accentColor};color:${input.textColor};font-weight:700;text-decoration:none">${escapeEmailHtml(input.ctaLabel)}</a></p>`
    : '';
  const brand = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px"><tr><td style="padding-right:10px;vertical-align:middle"><img src="${EMAIL_LOGO_URL}" width="36" height="36" alt="Logo Laprakin" style="display:block;width:36px;height:36px"></td><td style="vertical-align:middle;color:${input.textColor};font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:18px;font-weight:700">Laprakin</td></tr></table>`;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-weight:700;src:url(https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko20yw.woff2) format('woff2')}</style></head><body style="margin:0;background:${input.backgroundColor};color:${input.textColor};font-family:Arial,sans-serif"><div style="max-width:640px;margin:0 auto;padding:32px 20px">${brand}${image}<h1 style="margin:0 0 18px;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:28px;line-height:1.2">${escapeEmailHtml(heading)}</h1>${paragraphs}${cta}<p style="margin:32px 0 0;padding-top:16px;border-top:1px solid rgba(127,127,127,.35);font-size:12px;opacity:.72">Laprakin</p></div></body></html>`;
}

function broadcastRecipients(input) {
  if (input.audience === 'selected') {
    const placeholders = input.userIds.map(() => '?').join(',');
    return db.prepare(`
      SELECT id, email FROM users
      WHERE id IN (${placeholders}) AND deleted_at IS NULL AND role != 'admin'
        AND email_verified_at IS NOT NULL
      ORDER BY created_at
    `).all(...input.userIds);
  }
  if (input.audience === 'paid') {
    return db.prepare(`
      SELECT user.id, user.email
      FROM users user
      WHERE user.deleted_at IS NULL AND user.role != 'admin'
        AND user.email_verified_at IS NOT NULL
        AND (
          EXISTS (
            SELECT 1 FROM subscriptions subscription
            WHERE subscription.user_id = user.id
              AND subscription.status = 'active' AND subscription.ends_at > ?
          )
          OR EXISTS (
            SELECT 1 FROM wallet_entries entry
            WHERE entry.user_id = user.id AND entry.bucket = 'paid' AND entry.amount > 0
          )
        )
      ORDER BY user.created_at
    `).all(now());
  }
  return db.prepare(`
    SELECT id, email FROM users
    WHERE deleted_at IS NULL AND role != 'admin' AND email_verified_at IS NOT NULL
    ORDER BY created_at
  `).all();
}

function exposeRestriction(row) {
  return {
    id: row.id,
    userId: row.user_id || null,
    targetType: row.target_type,
    reason: row.reason,
    status: row.status,
    expiresAt: row.expires_at || null,
    permanent: !row.expires_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at || null,
  };
}

function publicBreakGlassAccess(grant) {
  return {
    id: grant.id,
    scope: grant.scope,
    userRef: anonymousUserRef(grant.targetUserId),
    ...(grant.targetResourceId ? { roomRef: anonymousRoomRef(grant.targetResourceId) } : {}),
    expiresAt: grant.expiresAt,
  };
}

function auditBreakGlass(req, action, grant, extra = {}) {
  recordAdminAudit({
    actorUserId: req.user.id,
    action,
    target: `${grant.scope}:${anonymousUserRef(grant.targetUserId)}${grant.targetResourceId ? `:${anonymousRoomRef(grant.targetResourceId)}` : ''}`,
    payloadDiff: {
      scope: grant.scope,
      reasonCode: grant.reasonCode,
      expiresAt: grant.expiresAt,
      ...extra,
    },
    ipAddress: req.ip,
  });
}

function activeBreakGlassGrant(req, scope) {
  try {
    return findActiveBreakGlassGrant({ store: db, grantId: req.params.grantId, actorUserId: req.user.id, scope });
  } catch (error) {
    if (error instanceof BreakGlassError) {
      recordAdminAudit({
        actorUserId: req.user.id,
        action: 'admin.break_glass_access_denied',
        target: `${scope}:grant`,
        payloadDiff: { scope, errorCode: error.code },
        ipAddress: req.ip,
      });
    }
    throw error;
  }
}

app.get('/api/admin/mfa/status', requireAuth, requirePrivilegedUser, (req, res) => {
  return res.json({ mfa: adminMfaState(req) });
});

app.post('/api/admin/mfa/enroll', requireAuth, requireCsrf, requirePrivilegedUser, (req, res) => {
  const secret = createTotpSecret(req.user.id);
  const label = encodeURIComponent(`Laprakin:${req.user.email}`);
  const issuer = encodeURIComponent('Laprakin');
  audit(req.user.id, 'admin.mfa_enrolled', 'admin_mfa', req.user.id, {});
  return res.status(201).json({
    mfa: adminMfaState(req),
    secret,
    otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
  });
});

app.post('/api/admin/mfa/verify', requireAuth, requireCsrf, requirePrivilegedUser, (req, res) => {
  const code = String(req.body?.code || '').trim();
  const status = getAdminMfaStatus(req.user.id);
  if (!status.enrolled) throw new HttpError(409, 'Buat enrollment verifikasi dua langkah terlebih dahulu.', 'ADMIN_MFA_NOT_ENROLLED');
  if (!verifyTotpCode(req.user.id, code)) throw new HttpError(401, 'Kode verifikasi tidak valid atau sudah dipakai.', 'ADMIN_MFA_INVALID');
  const csrfToken = setSession(res, req.user, { mfaVerifiedAt: Date.now() });
  audit(req.user.id, 'admin.mfa_verified', 'admin_mfa', req.user.id, {});
  return res.json({ csrfToken, mfa: adminMfaState({ ...req, session: { ...req.session, mfaVerifiedAt: Date.now() } }) });
});

app.get('/api/admin/capabilities', requireAuth, requirePrivilegedUser, (req, res) => {
  res.json({ role: req.user.role, capabilities: capabilitiesForUser(req.user) });
});

registerAdminAiRoutes(app, {
  store: db,
  config,
  requireAuth,
  requireCsrf,
  requireCapability,
  requireRecentMfa: requireRecentAdminMfa,
  mutationLimiter: adminMutationLimiter,
  asyncHandler,
  audit,
});

app.get('/api/admin/events', requireAuth, requireCapability('incidents.manage'), (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(`event: ready\ndata: ${JSON.stringify({ connectedAt: now() })}\n\n`);
  adminStreams.add(res);
  const heartbeat = setInterval(() => {
    try { res.write(': keepalive\n\n'); } catch { clearInterval(heartbeat); adminStreams.delete(res); }
  }, 25000);
  req.on('close', () => {
    clearInterval(heartbeat);
    adminStreams.delete(res);
  });
});

app.get('/api/admin/users', requireAuth, requireCapability('users.view'), (req, res) => {
  const query = parseAdminListQuery(req.query, { defaultLimit: 25 });
  const userId = String(req.query.userId || '').trim().slice(0, 160);
  const pattern = `%${query.q.replace(/[%_]/g, '\\$&')}%`;
  const rows = db.prepare(`
    SELECT id, role, email_verified_at, created_at
    FROM users
    WHERE deleted_at IS NULL AND role != 'admin'
      AND (? = '' OR id = ?)
      AND (? = '' OR id LIKE ? ESCAPE '\\' OR role LIKE ? ESCAPE '\\')
    ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?
  `).all(userId, userId, query.q, pattern, pattern, query.limit + 1, query.cursor);
  const page = adminListPage(rows, query);
  const users = page.items.map((user) => {
    const wallet = getWallet(user.id);
    const subscription = activeSubscription(user.id);
    const hasPaidCredit = Boolean(db.prepare(`
      SELECT 1 FROM wallet_entries WHERE user_id = ? AND bucket = 'paid' AND amount > 0 LIMIT 1
    `).get(user.id));
    const activity = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM chat_sessions WHERE owner_user_id = ?) AS room_count,
        (SELECT COUNT(*) FROM chat_messages WHERE owner_user_id = ?) AS message_count,
        (SELECT COALESCE(SUM(total_tokens), 0) FROM ai_usage_events WHERE user_id = ? AND status = 'success') AS total_tokens,
        (SELECT COUNT(*) FROM access_restrictions WHERE user_id = ? AND status = 'active'
          AND (expires_at IS NULL OR expires_at > ?)) AS restriction_count
    `).get(user.id, user.id, user.id, user.id, now());
    return {
      id: user.id,
      userRef: anonymousUserRef(user.id),
      emailVerified: Boolean(user.email_verified_at),
      credits: wallet.balances.total,
      plan: subscription?.plan_key === 'pro' ? 'Max' : subscription ? 'Pro' : hasPaidCredit ? 'Satuan' : 'Gratis',
      planKey: subscription?.plan_key || (hasPaidCredit ? 'single' : 'free'),
      planEndsAt: subscription?.ends_at || null,
      roomCount: Number(activity?.room_count || 0),
      messageCount: Number(activity?.message_count || 0),
      totalTokens: Number(activity?.total_tokens || 0),
      restrictionCount: Number(activity?.restriction_count || 0),
      createdAt: user.created_at,
    };
  });
  res.json({ users, pageInfo: page.pageInfo });
});

app.put('/api/admin/users/:id/plan', requireAuth, requireCsrf, requireCapability('billing.manage'), adminMutationLimiter, (req, res) => {
  const input = adminUserPlanSchema.parse(req.body || {});
  const user = db.prepare("SELECT id FROM users WHERE id = ? AND deleted_at IS NULL AND role != 'admin'").get(req.params.id);
  if (!user) throw new HttpError(404, 'User tidak ditemukan.', 'ADMIN_USER_NOT_FOUND');

  const changedAt = now();
  const subscriptionId = input.planKey === 'free' ? null : nanoid();
  const endsAt = input.planKey === 'free' ? null : addDays(input.durationDays);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`
      UPDATE subscriptions SET status = 'canceled'
      WHERE user_id = ? AND status = 'active'
    `).run(user.id);
    if (subscriptionId) {
      db.prepare(`
        INSERT INTO subscriptions (
          id, user_id, plan_key, status, provider, provider_reference,
          starts_at, ends_at, created_at
        ) VALUES (?, ?, ?, 'active', 'admin', ?, ?, ?, ?)
      `).run(
        subscriptionId,
        user.id,
        input.planKey,
        `admin-${req.user.id}-${subscriptionId}`,
        changedAt,
        endsAt,
        changedAt,
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }

  const label = input.planKey === 'pro' ? 'Max' : input.planKey === 'monthly' ? 'Pro' : 'Gratis';
  notifyUser(user.id, {
    kind: 'billing',
    title: `Plan diubah menjadi ${label}`,
    body: endsAt ? `Plan aktif sampai ${new Date(endsAt).toLocaleDateString('id-ID')}.` : 'Subscription aktif telah dihentikan.',
    href: '/app',
  });
  audit(req.user.id, 'admin.user_plan_changed', 'user', user.id, {
    planKey: input.planKey,
    durationDays: input.planKey === 'free' ? null : input.durationDays,
    subscriptionId,
  });
  res.json({
    userId: user.id,
    planKey: input.planKey,
    plan: label,
    endsAt,
  });
});

app.get('/api/admin/users/:id/rooms', requireAuth, requireCapability('users.view'), (req, res) => {
  const user = db.prepare("SELECT id FROM users WHERE id = ? AND deleted_at IS NULL AND role != 'admin'").get(req.params.id);
  if (!user) throw new HttpError(404, 'User tidak ditemukan.', 'ADMIN_USER_NOT_FOUND');
  const rooms = db.prepare(`
    SELECT session.id, session.document_id, session.updated_at,
      COUNT(DISTINCT message.id) AS message_count,
      COALESCE((
        SELECT SUM(usage.total_tokens)
        FROM ai_usage_events usage
        WHERE usage.user_id = session.owner_user_id AND usage.status = 'success'
          AND (
            (usage.context_type = 'chat_session' AND usage.context_id = session.id)
            OR (usage.context_type = 'document' AND usage.context_id = session.document_id)
          )
      ), 0) AS total_tokens
    FROM chat_sessions session
    LEFT JOIN chat_messages message ON message.session_id = session.id
    WHERE session.owner_user_id = ?
    GROUP BY session.id
    ORDER BY session.updated_at DESC
    LIMIT 100
  `).all(user.id).map((room) => ({
    id: room.id,
    roomRef: anonymousRoomRef(room.id),
    messageCount: Number(room.message_count || 0),
    totalTokens: Number(room.total_tokens || 0),
    updatedAt: room.updated_at,
  }));
  res.json({ rooms });
});

app.post('/api/admin/users/:id/pii-access', requireAuth, requireCsrf, requireCapability('users.pii.reveal'), requireRecentAdminMfa, adminMutationLimiter, (req, res) => {
  const input = adminBreakGlassSchema.parse(req.body || {});
  const user = db.prepare("SELECT id FROM users WHERE id = ? AND deleted_at IS NULL AND role != 'admin'").get(req.params.id);
  if (!user) throw new HttpError(404, 'User tidak ditemukan.', 'ADMIN_USER_NOT_FOUND');
  const grant = createBreakGlassGrant({
    store: db,
    actorUserId: req.user.id,
    targetUserId: user.id,
    scope: 'pii',
    reasonCode: input.reasonCode,
    reasonNote: input.reasonNote,
    durationMinutes: input.durationMinutes,
  });
  auditBreakGlass(req, 'admin.pii_access_granted', grant, { reasonNote: input.reasonNote });
  return res.status(201).json({ access: publicBreakGlassAccess(grant) });
});

app.get('/api/admin/break-glass/:grantId/pii', requireAuth, requireCapability('users.pii.reveal'), requireRecentAdminMfa, (req, res) => {
  const grant = activeBreakGlassGrant(req, 'pii');
  const user = db.prepare("SELECT id, email, full_name FROM users WHERE id = ? AND deleted_at IS NULL AND role != 'admin'").get(grant.targetUserId);
  if (!user) throw new HttpError(404, 'User tidak ditemukan.', 'ADMIN_USER_NOT_FOUND');
  auditBreakGlass(req, 'admin.pii_accessed', grant);
  res.setHeader('Cache-Control', 'no-store');
  return res.json({
    pii: { userRef: anonymousUserRef(user.id), email: user.email, fullName: user.full_name || '' },
    expiresAt: grant.expiresAt,
  });
});

app.post('/api/admin/users/:id/rooms/:roomId/content-access', requireAuth, requireCsrf, requireCapability('users.content.reveal'), requireRecentAdminMfa, adminMutationLimiter, (req, res) => {
  const input = adminBreakGlassSchema.parse(req.body || {});
  const room = db.prepare(`
    SELECT id, owner_user_id FROM chat_sessions
    WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL
  `).get(req.params.roomId, req.params.id);
  if (!room) throw new HttpError(404, 'Ruang percakapan tidak ditemukan.', 'ADMIN_ROOM_NOT_FOUND');
  const grant = createBreakGlassGrant({
    store: db,
    actorUserId: req.user.id,
    targetUserId: room.owner_user_id,
    targetResourceId: room.id,
    scope: 'content',
    reasonCode: input.reasonCode,
    reasonNote: input.reasonNote,
    durationMinutes: input.durationMinutes,
  });
  auditBreakGlass(req, 'admin.content_access_granted', grant, { reasonNote: input.reasonNote });
  return res.status(201).json({ access: publicBreakGlassAccess(grant) });
});

app.get('/api/admin/break-glass/:grantId/content', requireAuth, requireCapability('users.content.reveal'), requireRecentAdminMfa, (req, res) => {
  const grant = activeBreakGlassGrant(req, 'content');
  const room = db.prepare(`
    SELECT id, owner_user_id, title, created_at, updated_at FROM chat_sessions
    WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL
  `).get(grant.targetResourceId, grant.targetUserId);
  if (!room) throw new HttpError(404, 'Ruang percakapan tidak ditemukan.', 'ADMIN_ROOM_NOT_FOUND');
  const messages = db.prepare(`
    SELECT id, role, content, created_at FROM chat_messages
    WHERE session_id = ? AND owner_user_id = ? ORDER BY created_at ASC LIMIT 200
  `).all(room.id, room.owner_user_id).map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.created_at,
  }));
  const attachments = db.prepare(`
    SELECT id, kind, original_name, mime_type, size_bytes, created_at FROM chat_attachments
    WHERE session_id = ? AND owner_user_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 100
  `).all(room.id, room.owner_user_id).map((attachment) => ({
    id: attachment.id,
    kind: attachment.kind,
    originalName: attachment.original_name,
    mimeType: attachment.mime_type,
    sizeBytes: Number(attachment.size_bytes || 0),
    createdAt: attachment.created_at,
  }));
  auditBreakGlass(req, 'admin.content_accessed', grant, { messageCount: messages.length, attachmentCount: attachments.length });
  res.setHeader('Cache-Control', 'no-store');
  return res.json({
    content: {
      roomRef: anonymousRoomRef(room.id),
      title: room.title,
      messages,
      attachments,
      createdAt: room.created_at,
      updatedAt: room.updated_at,
    },
    expiresAt: grant.expiresAt,
  });
});

app.delete('/api/admin/break-glass/:grantId', requireAuth, requireCsrf, requirePrivilegedUser, requireRecentAdminMfa, adminMutationLimiter, (req, res) => {
  const grantRow = db.prepare('SELECT * FROM admin_break_glass_grants WHERE id = ? AND actor_user_id = ?').get(req.params.grantId, req.user.id);
  if (!grantRow) throw new HttpError(404, 'Break-glass grant tidak ditemukan.', 'BREAK_GLASS_GRANT_NOT_FOUND');
  const requiredCapability = grantRow.scope === 'pii' ? 'users.pii.reveal' : 'users.content.reveal';
  if (!hasCapability(req.user, requiredCapability)) throw new HttpError(403, 'Akses tidak tersedia untuk tugas admin ini.', 'ADMIN_CAPABILITY_REQUIRED');
  const revoked = revokeBreakGlassGrant({ store: db, grantId: req.params.grantId, actorUserId: req.user.id });
  if (!revoked) throw new HttpError(409, 'Break-glass grant sudah tidak aktif.', 'BREAK_GLASS_GRANT_INACTIVE');
  const grant = {
    id: grantRow.id,
    scope: grantRow.scope,
    targetUserId: grantRow.target_user_id,
    targetResourceId: grantRow.target_resource_id || null,
    reasonCode: grantRow.reason_code,
    expiresAt: grantRow.expires_at,
  };
  auditBreakGlass(req, 'admin.break_glass_revoked', grant);
  return res.status(204).end();
});

app.get('/api/admin/users/:id/restrictions', requireAuth, requireCapability('users.restrict'), (req, res) => {
  db.prepare(`
    UPDATE access_restrictions SET status = 'expired'
    WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= ?
  `).run(now());
  const rows = db.prepare(`
    SELECT * FROM access_restrictions
    WHERE user_id = ? ORDER BY created_at DESC LIMIT 100
  `).all(req.params.id).map(exposeRestriction);
  res.json({ restrictions: rows });
});

app.post('/api/admin/users/:id/restrictions', requireAuth, requireCsrf, requireCapability('users.restrict'), adminMutationLimiter, asyncHandler(async (req, res) => {
  const input = adminRestrictionSchema.parse(req.body || {});
  const user = db.prepare("SELECT id, email, full_name FROM users WHERE id = ? AND deleted_at IS NULL AND role != 'admin'").get(req.params.id);
  if (!user) throw new HttpError(404, 'User tidak ditemukan.', 'ADMIN_USER_NOT_FOUND');
  let targets = [];
  if (input.targetType === 'account') {
    targets = [user.id];
  } else if (input.targetType === 'device') {
    targets = [...new Set(db.prepare(`
      SELECT device_id, profile_hash FROM user_devices WHERE user_id = ?
    `).all(user.id).flatMap((row) => [row.device_id, row.profile_hash]).filter(Boolean))];
  } else {
    targets = db.prepare("SELECT DISTINCT ip_hash AS value FROM user_devices WHERE user_id = ? AND ip_hash IS NOT NULL AND ip_hash != ''").all(user.id).map((row) => row.value);
  }
  if (!targets.length) {
    throw new HttpError(400, 'Belum ada riwayat perangkat atau jaringan yang dapat dibatasi untuk user ini.', 'RESTRICTION_TARGET_EMPTY');
  }
  const expiresAt = input.durationDays ? addDays(input.durationDays) : null;
  const timestamp = now();
  const ids = [];
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const target of targets) {
      const existing = db.prepare(`
        SELECT id FROM access_restrictions
        WHERE target_type = ? AND target_value = ? AND status = 'active'
      `).get(input.targetType, target);
      if (existing) {
        db.prepare(`
          UPDATE access_restrictions SET
            user_id = ?, reason = ?, expires_at = ?, created_by_user_id = ?, created_at = ?,
            revoked_by_user_id = NULL, revoked_at = NULL
          WHERE id = ?
        `).run(user.id, input.reason, expiresAt, req.user.id, timestamp, existing.id);
        ids.push(existing.id);
      } else {
        const id = nanoid();
        db.prepare(`
          INSERT INTO access_restrictions (
            id, user_id, target_type, target_value, reason, status,
            expires_at, created_by_user_id, created_at
          ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
        `).run(id, user.id, input.targetType, target, input.reason, expiresAt, req.user.id, timestamp);
        ids.push(id);
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
  invalidateAllSessions(user.id);
  const durationText = expiresAt
    ? `Pembatasan berlaku sampai ${new Date(expiresAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}.`
    : 'Pembatasan ini berlaku sampai dicabut oleh tim Laprakin.';
  const emailProps = {
    name: user.full_name || '',
    reason: input.reason,
    durationText,
    appealUrl: `${config.appUrl}/auth`,
  };
  await queueTransactionalEmail({
    userId: user.id,
    recipient: user.email,
    subject: 'Akses akun Laprakin dibatasi',
    kind: 'account_restriction',
    text: accountRestrictionText(emailProps),
    react: AccountRestrictionEmail(emailProps),
  });
  audit(req.user.id, 'admin.restriction_created', 'user', user.id, {
    targetType: input.targetType,
    targetCount: targets.length,
    permanent: !expiresAt,
  });
  createAdminAlert({
    kind: 'account_restricted',
    severity: 'warning',
    userId: user.id,
    summary: `Akses ${anonymousUserRef(user.id)} dibatasi oleh admin.`,
  });
  res.status(201).json({
    restrictions: db.prepare(`SELECT * FROM access_restrictions WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids).map(exposeRestriction),
  });
}));

app.delete('/api/admin/users/:id/restrictions/:restrictionId', requireAuth, requireCsrf, requireCapability('users.restrict'), adminMutationLimiter, (req, res) => {
  const result = db.prepare(`
    UPDATE access_restrictions SET status = 'revoked', revoked_by_user_id = ?, revoked_at = ?
    WHERE id = ? AND user_id = ? AND status = 'active'
  `).run(req.user.id, now(), req.params.restrictionId, req.params.id);
  if (!result.changes) throw new HttpError(404, 'Pembatasan aktif tidak ditemukan.', 'RESTRICTION_NOT_FOUND');
  audit(req.user.id, 'admin.restriction_revoked', 'user', req.params.id, { restrictionId: req.params.restrictionId });
  res.status(204).end();
});

app.get('/api/admin/appeals', requireAuth, requireCapability('appeals.review'), (req, res) => {
  const query = parseAdminListQuery(req.query, { statuses: ['open', 'approved', 'rejected', 'all'], defaultStatus: 'open', defaultLimit: 25 });
  const pattern = `%${query.q.replace(/[%_]/g, '\\$&')}%`;
  const rows = db.prepare(`
    SELECT appeal.*
    FROM account_appeals appeal
    WHERE (? = 'all' OR appeal.status = ?)
      AND (? = '' OR appeal.message LIKE ? ESCAPE '\\')
    ORDER BY CASE appeal.status WHEN 'open' THEN 0 ELSE 1 END, appeal.created_at DESC, appeal.id DESC
    LIMIT ? OFFSET ?
  `).all(query.status, query.status, query.q, pattern, query.limit + 1, query.cursor);
  const page = adminListPage(rows, query);
  const appeals = page.items.map((appeal) => ({
    id: appeal.id,
    userId: appeal.user_id || null,
    userRef: anonymousUserRef(appeal.user_id || appeal.id),
    message: redactEmailAddresses(appeal.message),
    status: appeal.status,
    adminReply: appeal.admin_reply || '',
    createdAt: appeal.created_at,
    reviewedAt: appeal.reviewed_at || null,
  }));
  res.json({ appeals, pageInfo: page.pageInfo });
});

app.put('/api/admin/appeals/:id', requireAuth, requireCsrf, requireCapability('appeals.review'), adminMutationLimiter, asyncHandler(async (req, res) => {
  const input = adminAppealReviewSchema.parse(req.body || {});
  const appeal = db.prepare(`
    SELECT appeal.*, user.email, user.full_name
    FROM account_appeals appeal LEFT JOIN users user ON user.id = appeal.user_id
    WHERE appeal.id = ?
  `).get(req.params.id);
  if (!appeal) throw new HttpError(404, 'Appeal tidak ditemukan.', 'APPEAL_NOT_FOUND');
  if (appeal.status !== 'open') throw new HttpError(409, 'Appeal ini sudah ditinjau.', 'APPEAL_ALREADY_REVIEWED');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`
      UPDATE account_appeals SET status = ?, admin_reply = ?, reviewed_at = ?, reviewed_by_user_id = ?
      WHERE id = ?
    `).run(input.status, input.reply, now(), req.user.id, appeal.id);
    if (input.status === 'approved' && input.liftRestrictions && appeal.user_id) {
      db.prepare(`
        UPDATE access_restrictions SET status = 'revoked', revoked_by_user_id = ?, revoked_at = ?
        WHERE user_id = ? AND status = 'active'
      `).run(req.user.id, now(), appeal.user_id);
    }
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
  if (appeal.email) {
    const emailProps = {
      name: appeal.full_name || '',
      approved: input.status === 'approved',
      reply: input.reply,
    };
    await queueTransactionalEmail({
      userId: appeal.user_id,
      recipient: appeal.email,
      subject: input.status === 'approved' ? 'Appeal Laprakin disetujui' : 'Hasil peninjauan appeal Laprakin',
      kind: 'account_appeal_result',
      text: appealResultText(emailProps),
      react: AppealResultEmail(emailProps),
    });
  }
  audit(req.user.id, 'admin.appeal_reviewed', 'account_appeal', appeal.id, {
    status: input.status,
    restrictionsLifted: Boolean(input.status === 'approved' && input.liftRestrictions),
  });
  res.json({ ok: true });
}));

app.get('/api/admin/broadcasts', requireAuth, requireCapability('cms.publish'), (req, res) => {
  const query = parseAdminListQuery(req.query, { defaultLimit: 25 });
  const pattern = `%${query.q.replace(/[%_]/g, '\\$&')}%`;
  const rows = db.prepare(`
    SELECT id, audience, subject, image_url, recipient_count, delivered_count, created_at
    FROM admin_broadcasts
    WHERE (? = '' OR subject LIKE ? ESCAPE '\\' OR audience LIKE ? ESCAPE '\\')
    ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?
  `).all(query.q, pattern, pattern, query.limit + 1, query.cursor);
  const page = adminListPage(rows, query);
  const broadcasts = page.items.map((row) => ({
    id: row.id,
    audience: row.audience,
    subject: row.subject,
    imageUrl: row.image_url || '',
    recipientCount: Number(row.recipient_count || 0),
    deliveredCount: Number(row.delivered_count || 0),
    createdAt: row.created_at,
  }));
  res.json({ broadcasts, pageInfo: page.pageInfo });
});

app.post('/api/admin/broadcasts/image', requireAuth, requireCsrf, requireCapability('cms.publish'), uploadLimiter, emailMediaUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Pilih gambar terlebih dahulu.', 'EMAIL_IMAGE_REQUIRED');
  const detectedMime = detectBufferType(req.file.buffer);
  if (detectedMime !== req.file.mimetype || !['image/png', 'image/jpeg', 'image/webp'].includes(detectedMime)) {
    throw new HttpError(400, 'Isi file tidak cocok dengan format gambar yang dipilih.', 'EMAIL_IMAGE_SIGNATURE');
  }
  const extension = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }[detectedMime];
  fs.mkdirSync(config.emailMediaDir, { recursive: true });
  const filename = `email-${Date.now()}-${nanoid(10)}${extension}`;
  fs.writeFileSync(path.join(config.emailMediaDir, filename), req.file.buffer, { flag: 'wx' });
  audit(req.user.id, 'admin.broadcast_image_uploaded', 'email_media', filename, {
    mimeType: detectedMime,
    size: req.file.size,
  });
  res.status(201).json({ imageUrl: `/api/public/email-media/${filename}` });
}));

app.post('/api/admin/broadcasts', requireAuth, requireCsrf, requireCapability('cms.publish'), adminMutationLimiter, asyncHandler(async (req, res) => {
  const input = adminBroadcastSchema.parse(req.body || {});
  const recipients = broadcastRecipients(input);
  if (!recipients.length) throw new HttpError(404, 'Tidak ada user yang cocok dengan target email.', 'BROADCAST_TARGET_EMPTY');
  const html = renderBroadcastEmail(input);
  const text = `${capitalizeInitial(input.heading)}\n\n${input.body}${input.ctaLabel && input.ctaUrl ? `\n\n${input.ctaLabel}: ${input.ctaUrl}` : ''}`;
  const id = nanoid();
  db.prepare(`
    INSERT INTO admin_broadcasts (
      id, admin_user_id, audience, target_user_ids_json, subject, text_body,
      html_body, image_url, recipient_count, delivered_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    id,
    req.user.id,
    input.audience,
    JSON.stringify(input.audience === 'selected' ? recipients.map((recipient) => recipient.id) : []),
    input.subject,
    text,
    html,
    input.imageUrl,
    recipients.length,
    now(),
  );
  const results = await Promise.allSettled(recipients.map((recipient) => queueTransactionalEmail({
    userId: recipient.id,
    recipient: recipient.email,
    subject: input.subject,
    text,
    html,
    kind: 'admin_broadcast',
  })));
  const deliveredCount = results.filter((result) => result.status === 'fulfilled').length;
  db.prepare('UPDATE admin_broadcasts SET delivered_count = ? WHERE id = ?').run(deliveredCount, id);
  audit(req.user.id, 'admin.broadcast_sent', 'admin_broadcast', id, {
    audience: input.audience,
    recipientCount: recipients.length,
    deliveredCount,
  });
  res.status(201).json({ id, recipientCount: recipients.length, deliveredCount });
}));

app.get('/api/admin/pricing', requireAuth, requireCapability('pricing.manage'), (_req, res) => {
  res.json(pricingPayload());
});

app.put('/api/admin/pricing', requireAuth, requireCsrf, requireCapability('pricing.manage'), adminMutationLimiter, (req, res) => {
  const input = adminPricingSchema.parse(req.body || {});
  const timestamp = now();
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const product of input.products) {
      const expiresAt = normalizeDateTime(product.discountExpiresAt);
      if (product.discountExpiresAt && !expiresAt) {
        throw new HttpError(400, 'Waktu berakhir diskon tidak valid.', 'PRICING_DISCOUNT_EXPIRY_INVALID');
      }
      db.prepare(`
        INSERT INTO pricing_overrides (
          sku, unit_price_idr, discount_percent, discount_expires_at,
          credits, duration_days, revisions_per_report, storage_mb, features_json,
          updated_by_user_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(sku) DO UPDATE SET
          unit_price_idr = excluded.unit_price_idr,
          discount_percent = excluded.discount_percent,
          discount_expires_at = excluded.discount_expires_at,
          credits = excluded.credits,
          duration_days = excluded.duration_days,
          revisions_per_report = excluded.revisions_per_report,
          storage_mb = excluded.storage_mb,
          features_json = excluded.features_json,
          updated_by_user_id = excluded.updated_by_user_id,
          updated_at = excluded.updated_at
      `).run(
        product.sku,
        product.unitPriceIdr,
        product.discountPercent,
        expiresAt,
        product.credits,
        product.durationDays,
        product.revisionsPerReport,
        product.storageMb,
        JSON.stringify(product.features),
        req.user.id,
        timestamp,
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
  audit(req.user.id, 'admin.pricing_updated', 'pricing', 'catalogue', {
    products: input.products.map((product) => product.sku),
  });
  res.json(pricingPayload());
});

app.post('/api/admin/credits/grant', requireAuth, requireCsrf, requireCapability('credits.grant'), adminMutationLimiter, asyncHandler(async (req, res) => {
  const input = adminCreditGrantSchema.parse(req.body || {});
  const prior = db.prepare('SELECT * FROM admin_credit_grants WHERE idempotency_key = ?').get(input.idempotencyKey);
  if (prior) {
    return res.json({
      grantId: prior.id,
      recipientCount: Number(prior.recipient_count || 0),
      amount: Number(prior.amount),
      duplicate: true,
    });
  }

  let recipients;
  if (input.audience === 'user') {
    recipients = db.prepare(`
      SELECT id FROM users WHERE id = ? AND deleted_at IS NULL AND role != 'admin' LIMIT 1
    `).all(input.userId);
  } else if (input.audience === 'paid') {
    recipients = db.prepare(`
      SELECT user.id
      FROM users user
      WHERE user.deleted_at IS NULL AND user.role != 'admin' AND (
        EXISTS (
          SELECT 1 FROM subscriptions subscription
          WHERE subscription.user_id = user.id AND subscription.status = 'active' AND subscription.ends_at > ?
        )
        OR EXISTS (
          SELECT 1 FROM wallet_entries entry
          WHERE entry.user_id = user.id AND entry.bucket = 'paid' AND entry.amount > 0
        )
      )
      ORDER BY user.created_at
    `).all(now());
  } else {
    recipients = db.prepare(`
      SELECT id FROM users
      WHERE deleted_at IS NULL AND role != 'admin' AND email_verified_at IS NOT NULL
      ORDER BY created_at
    `).all();
  }
  if (!recipients.length) throw new HttpError(404, 'Tidak ada user yang cocok dengan target kredit.', 'ADMIN_CREDIT_TARGET_EMPTY');

  const grantId = nanoid();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`
      INSERT INTO admin_credit_grants (
        id, admin_user_id, idempotency_key, audience, target_user_id,
        amount, reason, recipient_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      grantId,
      req.user.id,
      input.idempotencyKey,
      input.audience,
      input.audience === 'user' ? input.userId : null,
      input.amount,
      input.reason,
      recipients.length,
      now(),
    );
    for (const recipient of recipients) {
      grantCredit({
        userId: recipient.id,
        bucket: 'admin',
        amount: input.amount,
        reason: input.reason,
        referenceType: 'admin_credit_grant',
        referenceId: grantId,
      });
      notifyUser(recipient.id, {
        kind: 'wallet',
        title: `${input.amount} kredit ditambahkan`,
        body: input.reason,
        href: '/app/wallet',
      });
    }
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    if (String(error?.message || '').includes('idempotency_key')) {
      const duplicate = db.prepare('SELECT * FROM admin_credit_grants WHERE idempotency_key = ?').get(input.idempotencyKey);
      return res.json({
        grantId: duplicate.id,
        recipientCount: Number(duplicate.recipient_count || 0),
        amount: Number(duplicate.amount),
        duplicate: true,
      });
    }
    throw error;
  }
  audit(req.user.id, 'admin.credit_granted', 'admin_credit_grant', grantId, {
    audience: input.audience,
    amount: input.amount,
    recipientCount: recipients.length,
  });
  publishAdminEvent('credit', { grantId, audience: input.audience, recipientCount: recipients.length, createdAt: now() });
  return res.status(201).json({ grantId, recipientCount: recipients.length, amount: input.amount, duplicate: false });
}));

app.get('/api/admin/alerts', requireAuth, requireCapability('incidents.manage'), (req, res) => {
  const query = parseAdminListQuery(req.query, { statuses: ['open', 'resolved', 'all'], defaultStatus: 'open', defaultLimit: 25 });
  const pattern = `%${query.q.replace(/[%_]/g, '\\$&')}%`;
  const rows = db.prepare(`
    SELECT alert.*
    FROM admin_alerts alert
    WHERE (? = 'all' OR alert.status = ?)
      AND (? = '' OR alert.summary LIKE ? ESCAPE '\\' OR alert.kind LIKE ? ESCAPE '\\' OR alert.error_code LIKE ? ESCAPE '\\')
    ORDER BY CASE alert.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
      alert.created_at DESC, alert.id DESC
    LIMIT ? OFFSET ?
  `).all(query.status, query.status, query.q, pattern, pattern, pattern, query.limit + 1, query.cursor);
  const page = adminListPage(rows, query);
  const alerts = page.items.map((alert) => ({
    id: alert.id,
    kind: alert.kind,
    severity: alert.severity,
    userId: alert.user_id || null,
    userRef: alert.user_id ? anonymousUserRef(alert.user_id) : null,
    documentId: alert.document_id || null,
    jobId: alert.job_id || null,
    summary: redactEmailAddresses(alert.summary),
    errorCode: alert.error_code || '',
    status: alert.status,
    createdAt: alert.created_at,
    resolvedAt: alert.resolved_at || null,
  }));
  res.json({ alerts, pageInfo: page.pageInfo });
});

app.put('/api/admin/alerts/:id', requireAuth, requireCsrf, requireCapability('incidents.manage'), adminMutationLimiter, (req, res) => {
  const input = adminAlertStatusSchema.parse(req.body || {});
  const result = db.prepare(`
    UPDATE admin_alerts
    SET status = ?, resolved_at = CASE WHEN ? = 'resolved' THEN ? ELSE NULL END,
      resolved_by_user_id = CASE WHEN ? = 'resolved' THEN ? ELSE NULL END
    WHERE id = ?
  `).run(input.status, input.status, now(), input.status, req.user.id, req.params.id);
  if (!result.changes) throw new HttpError(404, 'Alert admin tidak ditemukan.', 'ADMIN_ALERT_NOT_FOUND');
  audit(req.user.id, 'admin.alert_updated', 'admin_alert', req.params.id, { status: input.status });
  publishAdminEvent('alert-updated', { id: req.params.id, status: input.status, updatedAt: now() });
  res.json({ ok: true });
});

app.get('/api/admin/overview', requireAuth, requireCapability('audit.view'), (req, res) => {
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
    openAdminAlerts: Number(db.prepare("SELECT COUNT(*) AS count FROM admin_alerts WHERE status = 'open'").get().count),
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

app.get('/api/admin/search', requireAuth, requirePrivilegedUser, (req, res, next) => {
  try {
    const query = normalizeAdminSearchQuery(req.query);
    if (!query.q) return res.json({ query, results: [] });
    const candidates = [];
    const can = (capability) => hasCapability(req.user, capability);
    if (query.kind === 'all' || query.kind === 'features') {
      ADMIN_SEARCH_FEATURES.filter((item) => !item.capability || can(item.capability)).forEach((item) => candidates.push(item));
    }
    if ((query.kind === 'all' || query.kind === 'ai') && can('ai.health.view')) {
      db.prepare(`SELECT provider, model, route_id, COUNT(*) AS calls FROM ai_usage_events WHERE provider IS NOT NULL OR model IS NOT NULL OR route_id IS NOT NULL GROUP BY provider, model, route_id ORDER BY calls DESC LIMIT 200`).all().forEach((row) => {
        const provider = row.provider || 'Unknown provider';
        const model = row.model || 'Unknown model';
        const route = row.route_id || 'default';
        candidates.push({ id: `ai-${provider}-${model}-${route}`, kind: 'ai', title: model, subtitle: `${provider} · ${route} · ${Number(row.calls || 0).toLocaleString('en-US')} calls`, path: '/admin/ai/health', searchText: `${provider} ${model} ${route} ai health usage` });
      });
    }
    if ((query.kind === 'all' || query.kind === 'users') && can('users.view')) {
      db.prepare(`SELECT id, role, plan, created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 300`).all().forEach((row) => {
        const userRef = anonymousUserRef(row.id);
        candidates.push({ id: `user-${row.id}`, kind: 'users', title: userRef, subtitle: `${row.role || 'user'} · ${row.plan || 'free'}`, path: `/admin/users/${encodeURIComponent(row.id)}`, searchText: `${userRef} ${row.id} ${row.role || ''} ${row.plan || ''}` });
      });
    }
    if ((query.kind === 'all' || query.kind === 'alerts') && can('incidents.manage')) {
      db.prepare(`SELECT id, kind, severity, summary, status, created_at FROM admin_alerts ORDER BY created_at DESC LIMIT 200`).all().forEach((row) => {
        const summary = redactEmailAddresses(row.summary || row.kind || 'Operational alert');
        candidates.push({ id: `alert-${row.id}`, kind: 'alerts', title: summary, subtitle: `${row.severity || 'info'} · ${row.status || 'open'}`, path: '/admin/alerts', searchText: `${row.kind || ''} ${row.severity || ''} ${row.summary || ''} ${row.status || ''}` });
      });
    }
    if ((query.kind === 'all' || query.kind === 'audit') && can('audit.view')) {
      db.prepare(`SELECT id, action, target_type, target_id, actor_user_id, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 300`).all().forEach((row) => {
        const actorRef = row.actor_user_id ? anonymousUserRef(row.actor_user_id) : 'System';
        candidates.push({ id: `audit-${row.id}`, kind: 'audit', title: row.action || 'Audit event', subtitle: `${row.target_type || 'system'} · ${actorRef}`, path: '/admin/audit', searchText: `${row.action || ''} ${row.target_type || ''} ${row.target_id || ''} ${actorRef}` });
      });
    }
    const results = rankAdminSearchResults(candidates, query.q, query.limit).map(({ searchText, capability, score, ...result }) => ({ ...result, score }));
    return res.json({ query, results });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/admin/ai/usage', requireAuth, requireCapability('ai.health.view'), (req, res) => {
  const { query, since, sql: whereSql, params: whereParams } = buildAdminMonitoringWhere(req.query);
  const totals = db.prepare(`
    SELECT COUNT(*) AS calls,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successful,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS failed,
      COALESCE(SUM(input_tokens), 0) AS input_tokens,
      COALESCE(SUM(output_tokens), 0) AS output_tokens,
      COALESCE(SUM(reasoning_tokens), 0) AS reasoning_tokens,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(SUM(fallback_count), 0) AS fallback_count,
      COALESCE(ROUND(AVG(latency_ms)), 0) AS average_latency_ms
    FROM ai_usage_events usage WHERE ${whereSql}
  `).get(...whereParams);
  const breakdown = db.prepare(`
    SELECT purpose, mode, provider, model, route_id, status, COUNT(*) AS calls,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      COALESCE(ROUND(AVG(latency_ms)), 0) AS average_latency_ms
    FROM ai_usage_events usage WHERE ${whereSql}
    GROUP BY purpose, mode, provider, model, route_id, status
    ORDER BY calls DESC, purpose ASC, model ASC
  `).all(...whereParams);
  const daily = db.prepare(`
    SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS calls,
      COALESCE(SUM(total_tokens), 0) AS total_tokens,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successful,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors,
      COALESCE(ROUND(AVG(latency_ms)), 0) AS average_latency_ms
    FROM ai_usage_events usage WHERE ${whereSql}
    GROUP BY substr(created_at, 1, 10) ORDER BY day ASC
  `).all(...whereParams);
  const byUser = db.prepare(`
    SELECT usage.user_id,
      COUNT(*) AS calls,
      COALESCE(SUM(usage.total_tokens), 0) AS total_tokens,
      SUM(CASE WHEN usage.status = 'error' THEN 1 ELSE 0 END) AS errors,
      COALESCE(ROUND(AVG(usage.latency_ms)), 0) AS average_latency_ms
    FROM ai_usage_events usage
    WHERE ${whereSql} AND usage.user_id IS NOT NULL
    GROUP BY usage.user_id
    ORDER BY calls DESC LIMIT 100
  `).all(...whereParams).map((row) => ({
    userId: row.user_id,
    userRef: anonymousUserRef(row.user_id),
    calls: Number(row.calls || 0),
    totalTokens: Number(row.total_tokens || 0),
    errors: Number(row.errors || 0),
    averageLatencyMs: Number(row.average_latency_ms || 0),
  }));
  const recent = db.prepare(`
    SELECT usage.id, usage.user_id,
      usage.purpose, usage.mode, usage.provider, usage.model, usage.status,
      usage.route_id,
      usage.input_tokens, usage.output_tokens, usage.reasoning_tokens, usage.total_tokens,
      usage.latency_ms, usage.error_code, usage.fallback_count, usage.fallback_reason, usage.created_at
    FROM ai_usage_events usage
    WHERE ${whereSql}
    ORDER BY usage.created_at DESC LIMIT 200
  `).all(...whereParams).map((row) => ({
    id: row.id,
    userId: row.user_id || null,
    userRef: row.user_id ? anonymousUserRef(row.user_id) : null,
    purpose: row.purpose,
    mode: row.mode,
    provider: row.provider,
    model: row.model,
    route: row.route_id || '',
    status: row.status,
    inputTokens: Number(row.input_tokens || 0),
    outputTokens: Number(row.output_tokens || 0),
    reasoningTokens: Number(row.reasoning_tokens || 0),
    totalTokens: Number(row.total_tokens || 0),
    latencyMs: Number(row.latency_ms || 0),
    errorCode: row.error_code || '',
    fallbackCount: Number(row.fallback_count || 0),
    fallbackReason: row.fallback_reason || '',
    createdAt: row.created_at,
  }));
  const options = {
    providers: db.prepare("SELECT DISTINCT provider FROM ai_usage_events WHERE created_at >= ? AND provider IS NOT NULL AND provider <> '' ORDER BY provider ASC").all(since).map((row) => row.provider),
    models: db.prepare("SELECT DISTINCT model FROM ai_usage_events WHERE created_at >= ? AND model IS NOT NULL AND model <> '' ORDER BY model ASC").all(since).map((row) => row.model),
    routes: db.prepare("SELECT DISTINCT route_id FROM ai_usage_events WHERE created_at >= ? AND route_id IS NOT NULL AND route_id <> '' ORDER BY route_id ASC").all(since).map((row) => row.route_id),
    statuses: ['success', 'error', 'pending', 'timeout'],
  };
  res.json({ days: query.days, since, userId: query.userId || null, filters: query, options, totals, breakdown, daily, byUser, recent });
});

app.get('/api/admin/ai/reactions', requireAuth, requireCapability('ai.health.view'), (req, res) => {
  const query = z.object({ days: z.coerce.number().int().min(1).max(90).catch(30) }).parse(req.query);
  const since = new Date(Date.now() - query.days * 24 * 60 * 60 * 1000).toISOString();
  res.json({ days: query.days, since, ...getMessageReactionAnalytics({ since }) });
});

app.post('/api/admin/integrations/check', requireAuth, requireCsrf, requireCapability('ai.health.view'), integrationCheckLimiter, asyncHandler(async (req, res) => {
  const result = await verifyProductionIntegrations();
  audit(req.user.id, 'admin.integrations_checked', 'system', 'integrations', {
    ok: result.ok,
    nararouter: result.naraRouter.ok,
    googleOidc: result.googleOidc.ok,
  });
  res.status(result.ok ? 200 : 503).json(result);
}));

app.get('/api/admin/feedback', requireAuth, requireCapability('cms.edit'), (req, res) => {
  const query = parseAdminListQuery(req.query, { statuses: ['open', 'reviewing', 'resolved', 'closed', 'all'], defaultStatus: 'all', defaultLimit: 25 });
  const category = String(req.query.category || '').trim().slice(0, 80);
  const pattern = `%${query.q.replace(/[%_]/g, '\\$&')}%`;
  const rows = db.prepare(`
    SELECT * FROM feedback_items
    WHERE (? = 'all' OR status = ?) AND (? = '' OR category = ?)
      AND (? = '' OR body LIKE ? ESCAPE '\\' OR public_alias LIKE ? ESCAPE '\\')
    ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, updated_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(query.status, query.status, category, category, query.q, pattern, pattern, query.limit + 1, query.cursor);
  const page = adminListPage(rows, query);
  const items = page.items.map((row) => ({
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
  res.json({ items, pageInfo: page.pageInfo });
});

app.put('/api/admin/feedback/:id/status', requireAuth, requireCsrf, requireCapability('cms.edit'), asyncHandler(async (req, res) => {
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

app.post('/api/admin/feedback/:id/reply', requireAuth, requireCsrf, requireCapability('cms.edit'), asyncHandler(async (req, res) => {
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

app.post('/api/admin/feedback/:id/promote-testimonial', requireAuth, requireCsrf, requireCapability('cms.publish'), asyncHandler(async (req, res) => {
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

app.post('/api/admin/cms/landing-media', requireAuth, requireCsrf, requireCapability('cms.edit'), uploadLimiter, landingMediaUpload.single('file'), asyncHandler(async (req, res) => {
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

app.get('/api/admin/cms/landing', requireAuth, requireCapability('cms.edit'), (_req, res) => {
  res.json({ landing: getLandingContent() });
});

app.put('/api/admin/cms/landing', requireAuth, requireCsrf, requireCapability('cms.publish'), asyncHandler(async (req, res) => {
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

app.get('/api/admin/feature-updates', requireAuth, requireCapability('cms.edit'), (req, res) => {
  const query = parseAdminListQuery(req.query, { statuses: ['draft', 'published', 'archived', 'all'], defaultStatus: 'all', defaultLimit: 25 });
  const pattern = `%${query.q.replace(/[%_]/g, '\\$&')}%`;
  const rows = db.prepare(`
    SELECT feature_updates.*,
      (SELECT COUNT(*) FROM feature_update_receipts receipt WHERE receipt.update_id = feature_updates.id AND receipt.seen_at IS NOT NULL) AS seen_count,
      (SELECT COUNT(*) FROM feature_update_receipts receipt WHERE receipt.update_id = feature_updates.id AND receipt.opened_at IS NOT NULL) AS opened_count
    FROM feature_updates
    WHERE (? = 'all' OR status = ?) AND (? = '' OR title LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\' OR version_label LIKE ? ESCAPE '\\')
    ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, datetime(updated_at) DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(query.status, query.status, query.q, pattern, pattern, pattern, query.limit + 1, query.cursor);
  const page = adminListPage(rows, query);
  const updates = page.items.map((row) => ({ ...exposeFeatureUpdate(row), seenCount: Number(row.seen_count || 0), openedCount: Number(row.opened_count || 0) }));
  res.json({ updates, pageInfo: page.pageInfo });
});

app.post('/api/admin/feature-updates', requireAuth, requireCsrf, requireCapability('cms.edit'), asyncHandler(async (req, res) => {
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

app.put('/api/admin/feature-updates/:id', requireAuth, requireCsrf, requireCapability('cms.publish'), asyncHandler(async (req, res) => {
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

app.delete('/api/admin/feature-updates/:id', requireAuth, requireCsrf, requireCapability('cms.publish'), (req, res) => {
  const update = db.prepare('SELECT * FROM feature_updates WHERE id = ?').get(req.params.id);
  if (!update) throw new HttpError(404, 'Update fitur tidak ditemukan.', 'FEATURE_UPDATE_NOT_FOUND');
  db.prepare("UPDATE feature_updates SET status = 'archived', updated_by_user_id = ?, updated_at = ? WHERE id = ?").run(req.user.id, now(), update.id);
  audit(req.user.id, 'admin.feature_update_archived', 'feature_update', update.id, {});
  res.status(204).end();
});

app.post('/api/admin/feature-updates/:id/image', requireAuth, requireCsrf, requireCapability('cms.edit'), uploadLimiter, featureUpdateMediaUpload.single('file'), asyncHandler(async (req, res) => {
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

app.put('/api/admin/risk-events/:id', requireAuth, requireCsrf, requireCapability('incidents.manage'), asyncHandler(async (req, res) => {
  const input = riskStatusSchema.parse(req.body || {});
  const event = db.prepare('SELECT * FROM risk_events WHERE id = ?').get(req.params.id);
  if (!event) throw new HttpError(404, 'Kejadian tidak ditemukan.', 'RISK_EVENT_NOT_FOUND');
  db.prepare('UPDATE risk_events SET status = ?, reviewer_user_id = ?, reviewed_at = ? WHERE id = ?').run(input.status, req.user.id, now(), event.id);
  audit(req.user.id, 'admin.risk_event_reviewed', 'risk_event', event.id, { status: input.status });
  res.json({ id: event.id, status: input.status });
}));

app.get('/api/admin/audit', requireAuth, requireCapability('audit.view'), (req, res) => {
  const query = parseAdminListQuery(req.query, { defaultLimit: 25 });
  const rawCursor = String(req.query.cursor || '').trim();
  const legacyTimestampCursor = rawCursor && !/^\d+$/.test(rawCursor) ? rawCursor : null;
  const rows = listAdminAudit({
    actorUserId: String(req.query.actorUserId || '').trim() || null,
    action: query.q || String(req.query.action || '').trim(),
    limit: query.limit + 1,
    cursor: legacyTimestampCursor,
    offset: query.cursor,
  });
  const page = adminListPage(rows, query);
  const events = page.items
    .map((row) => ({
      id: row.id,
      actorRef: row.actor_user_id ? anonymousUserRef(row.actor_user_id) : 'Sistem',
      action: row.action,
      targetType: 'admin',
      metadata: row.metadata || {},
      createdAt: row.created_at,
    }));
  res.json({ events, pageInfo: page.pageInfo });
});

app.post('/api/admin/retention/run', requireAuth, requireCsrf, requireCapability('retention.execute'), asyncHandler(async (req, res) => {
  const result = await cleanupExpiredResources();
  audit(req.user.id, 'retention.cleanup_run', 'system', 'retention', result);
  res.json(result);
}));


fs.mkdirSync(config.landingMediaDir, { recursive: true });
fs.mkdirSync(config.featureUpdateMediaDir, { recursive: true });
fs.mkdirSync(config.emailMediaDir, { recursive: true });
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
app.use('/api/public/email-media', express.static(config.emailMediaDir, {
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
  // Express 5/path-to-regexp rejects the legacy `'*'` pattern at startup.
  app.get(/.*/, (_req, res) => res.sendFile(path.join(config.staticClientDir, 'index.html')));
}

app.use((err, req, res, _next) => {
  const status = err.status || 500;
  const route = req.route?.path || req.path || 'unknown';
  const requestLogger = logger.child({
    requestId: req.requestId,
    method: req.method,
    route,
    actorClass: actorClass(req),
  });
  requestLogger.error({ status, errorCode: err.code || 'INTERNAL_ERROR' }, 'request failed');
  if (status >= 500) reportException(err, {
    requestId: req.requestId,
    method: req.method,
    route,
    status,
    actorClass: actorClass(req),
  });
  if (res.headersSent) {
    res.locals.sseChannel?.fail(friendlyErrorCode(err));
    if (!res.writableEnded) res.end();
    return;
  }
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

  const typedAdminAiError = String(req.path || '').includes('/admin/ai/') && status < 500;

  return res.status(status).json({
    error: {
      message: typedAdminAiError ? (err.message || 'Tindakan konfigurasi AI tidak valid.') : friendlyErrorMessage(err, status),
      code: typedAdminAiError ? (err.code || 'AI_CONFIGURATION_INVALID') : friendlyErrorCode(err),
      ...(status < 500 && err.details ? { details: err.details } : {}),
      requestId: req.requestId,
    },
  });
});

recoverInterruptedJobs();
recoverFailedGenerationSessions();
initializeAiModelRegistry().catch((error) => {
  logger.error({ code: error?.code || 'AI_STARTUP_FAILED' }, 'AI model discovery failed');
  reportException(error, { purpose: 'ai_model_discovery' });
});
queueMicrotask(drainJobQueue);
setInterval(() => {
  drainJobQueue().catch((error) => {
    logger.error({ code: error?.code || 'JOB_DRAIN_FAILED' }, 'job queue drain failed');
    reportException(error, { purpose: 'job_queue_drain' });
  });
}, config.jobPollMs).unref();
setInterval(() => { resumePendingDocumentPipelines(); }, 30 * 1000).unref();
setInterval(() => {
  cleanupExpiredResources().catch((error) => {
    logger.error({ code: error?.code || 'RETENTION_SWEEP_FAILED' }, 'retention sweep failed');
    reportException(error, { purpose: 'retention_sweep' });
  });
}, config.retentionSweepMinutes * 60 * 1000).unref();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, version: config.appVersion }, 'Laprakin API started');
});

function shutdown(signal) {
  logger.info({ signal }, 'Laprakin API shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 8000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
