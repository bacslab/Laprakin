import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createTranslatorFromDictionaries } from '../src/i18n/translate.js';

const [id, en, source, landingSource, statusSource, pricingSource, billingSource, tutorialSource, composerSource, previewSource, attachmentSource, overlaysSource, documentSource, workflowSource, settingsSource] = await Promise.all([
  readFile(new URL('../src/i18n/id.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../src/i18n/en.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../src/i18n/index.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Landing/LandingView.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Status/StatusPage.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Pricing/PublicPricingPage.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Billing/BillingPage.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Workspace/WorkspaceTutorial.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Workspace/Composer.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Workspace/AttachmentPreview.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Workspace/AttachmentComponents.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/WorkspaceOverlays.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Workspace/DocumentSidePanel.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Workspace/WorkspaceWorkflow.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/Workspace/SettingsModal.jsx', import.meta.url), 'utf8'),
]);
const runtimeSource = await readFile(new URL('../src/i18n/I18nRuntime.jsx', import.meta.url), 'utf8');
const workspaceShellSource = await readFile(new URL('../src/pages/Workspace/LegacyWorkspaceView.jsx', import.meta.url), 'utf8');
const workspaceControllerSource = await readFile(new URL('../src/pages/Workspace/useLegacyWorkspaceController.js', import.meta.url), 'utf8');
const workspaceCollectionsSource = await readFile(new URL('../src/pages/Workspace/WorkspaceCollections.jsx', import.meta.url), 'utf8');
const workspaceSidebarSource = await readFile(new URL('../src/pages/Workspace/Sidebar/ChatSessionRow.jsx', import.meta.url), 'utf8');
const identitySource = await readFile(new URL('../src/pages/Workspace/IdentityIntakeModal.jsx', import.meta.url), 'utf8');
const adminConsoleSource = await readFile(new URL('../src/pages/Admin/LegacyAdminWorkspace.jsx', import.meta.url), 'utf8');
const adminPricingSource = await readFile(new URL('../src/pages/Admin/AdminPricingPanel.jsx', import.meta.url), 'utf8');
const adminAccessSource = await readFile(new URL('../src/pages/Admin/AdminAccessPanel.jsx', import.meta.url), 'utf8');
const adminAppealsSource = await readFile(new URL('../src/pages/Admin/AdminAppealsPanel.jsx', import.meta.url), 'utf8');
const adminBroadcastSource = await readFile(new URL('../src/pages/Admin/AdminBroadcastPanel.jsx', import.meta.url), 'utf8');
const featureUpdatesSource = await readFile(new URL('../src/FeatureUpdates.jsx', import.meta.url), 'utf8');
const adminContentPanelsSource = await readFile(new URL('../src/pages/Admin/AdminLegacyContentPanels.jsx', import.meta.url), 'utf8');
const chatComponentsSource = await readFile(new URL('../src/pages/Workspace/ChatComponents.jsx', import.meta.url), 'utf8');
const chatSurfaceSource = await readFile(new URL('../src/pages/Workspace/ChatSurface.jsx', import.meta.url), 'utf8');
const accountPopoverSource = await readFile(new URL('../src/pages/Workspace/Sidebar/AccountPopover.jsx', import.meta.url), 'utf8');
const institutionLogoSource = await readFile(new URL('../src/components/InstitutionLogoField.jsx', import.meta.url), 'utf8');
const dialogSource = await readFile(new URL('../src/components/Dialog.jsx', import.meta.url), 'utf8');

function keys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return nested && typeof nested === 'object' ? keys(nested, path) : [path];
  });
}

test('locale files have identical keyed surfaces and Indonesian defaults', () => {
  assert.deepEqual(keys(id).sort(), keys(en).sort());
  for (const key of keys(id)) assert.ok(String(key.split('.').reduce((current, part) => current?.[part], id) || '').trim(), key);
});

test('workspace runtime namespaces resolve at the paths used by components', () => {
  const runtimeNamespaces = [
    'productUpdate',
    'chatSurface',
    'messageActions',
    'brief',
    'context',
    'quiz',
    'documentCard',
    'account',
    'institutionLogo',
  ];
  for (const namespace of runtimeNamespaces) {
    assert.ok(id.workspace[namespace], `missing id workspace.${namespace}`);
    assert.ok(en.workspace[namespace], `missing en workspace.${namespace}`);
    assert.equal(id.workspace.settings[namespace], undefined, `workspace.${namespace} must not be nested under settings`);
    assert.equal(en.workspace.settings[namespace], undefined, `workspace.${namespace} must not be nested under settings`);
  }
});

test('translator falls back to Indonesian and interpolates values', () => {
  assert.match(source, /export function createTranslator/);
  const translate = createTranslatorFromDictionaries({ id: { greeting: 'Halo {{name}}' }, en: {} }, 'en');
  assert.equal(translate('greeting', { name: 'Ayu' }), 'Halo Ayu');
});

test('translator selects plural forms before interpolating and preserves Indonesian fallback', () => {
  const dictionaries = {
    id: { reports: { count_one: '{{count}} laprak tersedia', count_other: '{{count}} laprak tersedia' } },
    en: { reports: { count_one: '{{count}} report available', count_other: '{{count}} reports available' } },
  };
  const english = createTranslatorFromDictionaries(dictionaries, 'en');
  const indonesian = createTranslatorFromDictionaries(dictionaries, 'id');
  assert.equal(english('reports.count', { count: 1 }), '1 report available');
  assert.equal(english('reports.count', { count: 2 }), '2 reports available');
  assert.equal(indonesian('reports.count', { count: 1 }), '1 laprak tersedia');
  assert.equal(english('reports.missing', { count: 2 }), 'reports.missing');
});

test('landing page consumes keyed locale copy', () => {
  assert.match(landingSource, /useI18n/);
  assert.match(landingSource, /t\('landing\.heroDescription'\)/);
  assert.match(landingSource, /t\('landing\.faqTitle'\)/);
  assert.doesNotMatch(landingSource, /Fokus praktikum\./);
  assert.doesNotMatch(landingSource, /Bahanmu bukan sekadar lampiran/);
  assert.doesNotMatch(landingSource, /Pertanyaan yang sering muncul/);
});

test('status page keeps dynamic health labels in locale keys', () => {
  assert.match(statusSource, /status\.checks\.database/);
  assert.match(statusSource, /status\.values\.\$\{normalized\}/);
  assert.doesNotMatch(statusSource, /Operational|Berjalan normal|Provider AI/);
});

test('public pricing flow consumes keyed locale copy', () => {
  assert.match(pricingSource, /useI18n/);
  assert.match(pricingSource, /t\('pricing\.plansTitle'\)/);
  assert.match(pricingSource, /t\('pricing\.status\.created'\)/);
  assert.match(pricingSource, /localizedFallbackFeatures\('pricing\.features\.free'/);
  assert.doesNotMatch(pricingSource, /Pilih plan yang pas buat kamu|Bayar dengan QRIS|Ringkasan pesanan/);
});

test('billing flow consumes keyed locale copy', () => {
  assert.match(billingSource, /useI18n/);
  assert.match(billingSource, /t\('billing\.title'\)/);
  assert.match(billingSource, /t\('billing\.status\.processing'\)/);
  assert.match(billingSource, /localizedFallbackFeatures\('pricing\.features\.free'/);
  assert.doesNotMatch(billingSource, /Pilih plan yang pas untukmu|Naikkan kapasitas Laprakin|Checkout QRIS lokal diproses/);
});

test('workspace tutorial and composer consume keyed locale copy', () => {
  assert.match(tutorialSource, /useI18n/);
  assert.match(tutorialSource, /workspace\.tutorial\.steps\.0\.title/);
  assert.match(composerSource, /workspace\.composer\.placeholders\.centered/);
  assert.match(composerSource, /workspace\.aiMode\.thinking\.description/);
  assert.match(composerSource, /workspace\.composer\.hintEnter/);
  assert.match(composerSource, /workspace\.composer\.hintShortcut/);
  assert.match(composerSource, /localizeAiDataClasses/);
  assert.doesNotMatch(tutorialSource, /Ceritakan tugasmu|Tutup tutorial|Mulai chat/);
  assert.doesNotMatch(composerSource, /Tulis tugasmu, tempel link|Deteksi otomatis|Tambahkan bahan/);
});

test('workspace attachment previews consume keyed locale copy', () => {
  assert.match(previewSource, /useI18n/);
  assert.match(previewSource, /workspace\.attachments\.previewTitle/);
  assert.match(attachmentSource, /workspace\.attachments\.attachedMaterials/);
  assert.match(attachmentSource, /workspace\.attachments\.removeFile/);
  assert.doesNotMatch(previewSource, /PDF tidak dapat ditampilkan|Tutup preview|Memuat isi file/);
  assert.doesNotMatch(attachmentSource, /Bahan terlampir|Tambah file|Hapus \$\{file\.name\}/);
});

test('workspace help, feedback, and notification overlays consume keyed locale copy', () => {
  assert.match(overlaysSource, /useI18n/);
  assert.match(overlaysSource, /workspace\.overlays\.help\.introTitle/);
  assert.match(overlaysSource, /workspace\.overlays\.feedback\.categories/);
  assert.match(overlaysSource, /workspace\.overlays\.notifications\.markAllRead/);
  assert.doesNotMatch(overlaysSource, /Apa yang bisa kami bantu|Ceritakan yang perlu kami perbaiki|Tandai semua dibaca/);
});

test('workspace document and workflow surfaces consume keyed locale copy', () => {
  assert.match(documentSource, /workspace\.document\.revisionQuestion/);
  assert.match(documentSource, /workspace\.document\.loadingWord/);
  assert.match(workflowSource, /workspace\.workflow\.defaultSteps\.0\.title/);
  assert.match(workflowSource, /workspace\.workflow\.thinkingDuration/);
  assert.doesNotMatch(documentSource, /Memuat dokumen kerja|Versi dokumen|Sudah lengkap atau perlu revisi/);
  assert.doesNotMatch(workflowSource, /Sedang berpikir|Mulai susun|Membaca seluruh bahan/);
});

test('workspace settings referral, billing, and appearance surfaces consume keyed locale copy', () => {
  assert.match(settingsSource, /workspace\.settings\.referral\.codeLabel/);
  assert.match(settingsSource, /workspace\.settings\.billing\.history/);
  assert.match(settingsSource, /workspace\.settings\.appearance\.darkOnlyTitle/);
  assert.match(settingsSource, /workspace\.settings\.appearance\.themes\.system/);
  assert.match(settingsSource, /workspace\.settings\.data\.deleteTitle/);
  assert.match(settingsSource, /workspace\.settings\.storage\.filesTitle/);
  assert.match(settingsSource, /workspace\.settings\.safety\.alertTitle/);
  assert.match(settingsSource, /workspace\.settings\.security\.verifyDescription/);
  assert.match(settingsSource, /workspace\.settings\.archived\.restore/);
  assert.match(settingsSource, /workspace\.settings\.academic\.fullName/);
  assert.match(settingsSource, /workspace\.settings\.keyboard\.enterToSend/);
  assert.doesNotMatch(settingsSource, /Kode referralmu|Cara bonus dihitung|Warna aksen workspace|Ikuti sistem/);
  assert.doesNotMatch(settingsSource, /Akun sedang mendapat alert|Google terhubung|Belum ada chat diarsipkan|Nama lengkap/);
});

test('workspace shell navigation and configuration consume keyed locale copy', () => {
  assert.match(workspaceShellSource, /workspace\.shell\.sidebarOpen/);
  assert.match(workspaceShellSource, /workspace\.shell\.chatConfiguration/);
  assert.match(workspaceShellSource, /workspace\.shell\.requiredContext/);
  assert.match(workspaceShellSource, /workspace\.shell\.saveAndStart/);
  assert.doesNotMatch(workspaceShellSource, /Minimalkan sidebar|Cari chat terbaru|Konteks wajib diisi|Simpan & mulai|Tutup navigasi/);
  assert.match(workspaceControllerSource, /workspace\.notices\.quizPassed/);
  assert.match(workspaceControllerSource, /workspace\.dialogs\.newProjectTitle/);
  assert.doesNotMatch(workspaceControllerSource, /Chat disematkan|Project dibuat|DOCX siap diunduh|Pulihkan versi dokumen/);
  assert.match(workspaceCollectionsSource, /workspace\.collections\.documents\.title/);
  assert.match(workspaceCollectionsSource, /workspace\.collections\.projects\.emptyTitle/);
  assert.match(workspaceSidebarSource, /workspace\.sidebar\.deleteMessage/);
  assert.match(identitySource, /workspace\.identity\.title/);
  assert.doesNotMatch(workspaceCollectionsSource, /Belum ada dokumen|Kelompokkan chat|Buat project pertamamu/);
  assert.doesNotMatch(workspaceSidebarSource, /Folder baru|Pindahkan ke folder|Hapus chat/);
  assert.doesNotMatch(identitySource, /Lengkapi identitas laprakmu|Logo institusi wajib/);
});

test('admin console shell and operational panels consume keyed locale copy', () => {
  assert.match(adminConsoleSource, /admin\.console\.tabs\.overview/);
  assert.match(adminConsoleSource, /admin\.console\.privacyDescription/);
  assert.match(adminConsoleSource, /admin\.console\.credits\.grantNotice/);
  assert.match(adminConsoleSource, /admin\.console\.alerts\.markResolved/);
  assert.match(adminConsoleSource, /admin\.console\.retention\.done/);
  assert.doesNotMatch(adminConsoleSource, /Privacy-first monitoring|Tambahkan kredit|Error operasional|Pembersihan retensi/);
  assert.match(adminPricingSource, /admin\.console\.pricing\.planAndBenefits/);
  assert.match(adminAccessSource, /admin\.console\.access\.restrictionApplied/);
  assert.match(adminAppealsSource, /admin\.console\.appeals\.approvedNotice/);
  assert.doesNotMatch(adminPricingSource, /Plan dan benefit|Simpan plan/);
  assert.doesNotMatch(adminAccessSource, /Jenis pembatasan|Terapkan pembatasan/);
  assert.doesNotMatch(adminAppealsSource, /Appeal akun|Belum ada appeal/);
});

test('remaining admin content surfaces consume keyed locale copy', () => {
  assert.match(adminBroadcastSource, /admin\.console\.broadcasts\.delivered/);
  assert.match(featureUpdatesSource, /admin\.console\.updates\.draftCreated/);
  assert.match(featureUpdatesSource, /workspace\.productUpdate\.close/);
  assert.match(adminContentPanelsSource, /admin\.console\.integrations\.privacyDescription/);
  assert.match(adminContentPanelsSource, /admin\.console\.feedback\.replyPlaceholder/);
  assert.match(adminContentPanelsSource, /admin\.console\.risk\.title/);
  assert.match(adminContentPanelsSource, /admin\.console\.cms\.copyTitle/);
  assert.doesNotMatch(adminBroadcastSource, /Promosi, update, atau maintenance|Semua user terverifikasi|Kirim email/);
  assert.doesNotMatch(featureUpdatesSource, /Kelola draft, jadwal tayang|Buat draft untuk mulai|Tutup update fitur/);
  assert.doesNotMatch(adminContentPanelsSource, /Credential tetap di server|Feedback pengguna|Kejadian perlu ditinjau|Landing CMS/);
});

test('remaining workspace controls and dialogs consume keyed locale copy', () => {
  assert.match(chatComponentsSource, /workspace\.messageActions\.copyNotice/);
  assert.match(chatComponentsSource, /workspace\.quiz\.question/);
  assert.match(chatSurfaceSource, /workspace\.chatSurface\.greetingAccent/);
  assert.match(accountPopoverSource, /workspace\.account\.privateWorkspace/);
  assert.match(institutionLogoSource, /workspace\.institutionLogo\.maxSize/);
  assert.match(dialogSource, /common\.dialogConfirm/);
  assert.doesNotMatch(chatComponentsSource, /Jawaban AI disalin|Lengkapi konteks|Mulai quiz|Memuat dokumen kerja/);
  assert.doesNotMatch(chatSurfaceSource, /Lepas file untuk melampirkan|Cek pemahaman|Quiz laprak/);
  assert.doesNotMatch(accountPopoverSource, /Workspace pribadi|Personalisasi|Jurusan & prodi/);
  assert.doesNotMatch(institutionLogoSource, /Ukuran logo maksimal|Logo harus berformat PNG|Ganti logo/);
  assert.doesNotMatch(dialogSource, /Konfirmasi|Batal|Lanjutkan/);
});

test('i18n runtime never walks or mutates rendered DOM', async () => {
  const mainSource = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.match(mainSource, /I18nRuntime/);
  assert.doesNotMatch(runtimeSource, /translateUiText|MutationObserver|createTreeWalker|querySelectorAll|nodeValue|setAttribute/);
  assert.equal(existsSync(new URL('../src/i18n/legacy.js', import.meta.url)), false);
  assert.doesNotMatch(mainSource, /function I18nRuntime/);
  assert.doesNotMatch(mainSource, /translateUiText/);
});
