import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from './router';
import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, ArrowLeft, Bell, CheckCircle2, CircleAlert,
  CreditCard, FileText, FolderKanban, HelpCircle, LayoutTemplate, LoaderCircle, Mail, Search,
  LogOut, Menu, MessageCircle, Moon, Paperclip, PanelLeftClose,
  PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus, Save, Send, Settings2,
  ShieldCheck, SlidersHorizontal, Sparkles, Sun, Trash2, X,
  ChevronRight, Database, GripVertical, Keyboard, MoreHorizontal, Pin, PinOff, BellRing, Shield, Sliders, Monitor, Palette, Languages, CircleUserRound, LogOut as LogOutIcon, LayoutDashboard, Users, AlertTriangle, ClipboardList, Megaphone, RefreshCw, MessageSquareText, Activity, FileCog,
} from 'lucide-react';
import { api, apiStream, clearCsrfToken, download, setCsrfToken } from './api';
import { buildRevisionRequest, getEditableMessage } from './lib/chat-message-actions';
import { courseTokens, normalizedCourseKey } from './lib/academic';
import { inferPendingAttachmentKind } from './lib/attachments';
import { formatBytes, formatCurrency, formatDate } from './lib/formatters';
import { redirectToMidtransCheckout, validatedMidtransCheckoutUrl } from './lib/payment-redirect';
import { userInitials } from './lib/user';
import { resolveTheme, useResolvedTheme } from './lib/theme';
import { pricingFallback, pricingFeatures } from './data/pricing';
import { canonicalCourseLabel, clipboardImageFiles, courseLabelsMatch, defaultChatConfig, mergeFiles, preferredCourseLabel, resolveAccent, takeLandingDraft } from './lib/workspace-helpers';
import { BrandMark } from './components/BrandMark';
import { Button } from './components/Button';
import { CustomSelect } from './components/CustomSelect';
import { IconButton } from './components/IconButton';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import './styles/layers.css';
import './styles/tokens.css';
import './styles.css';
import './styles/landing.css';
import './styles/accessibility.css';
import './styles/auth.css';
import './styles/workspace.css';
import './styles/admin.css';
import LoadingScreen from './components/LoadingScreen';
import { loadPage } from './lib/load-page';
import { AppContext, useApp } from './state/ui-context';
import { createTranslator } from './i18n';
import { translateUiText } from './i18n/legacy';
import { I18nContext } from './i18n/context';
import { FeatureUpdatesAdmin, ProductUpdatePopup } from './FeatureUpdates';
import { ChatSessionRow, SessionGroup } from './pages/Workspace/Sidebar/ChatSessionRow';
import AccountPopover from './pages/Workspace/Sidebar/AccountPopover';
import { AppDialog } from './components/Dialog';
import { INSTITUTION_LOGO_MAX_BYTES } from './components/InstitutionLogoField';
import Toggle from './components/Toggle';
import { FeedbackModal, HelpModal, NotificationModal } from './components/WorkspaceOverlays';
import AdminAccessPanel from './pages/Admin/AdminAccessPanel';
import AdminPricingPanel from './pages/Admin/AdminPricingPanel';
import AdminAppealsPanel from './pages/Admin/AdminAppealsPanel';
import AdminBroadcastPanel from './pages/Admin/AdminBroadcastPanel';
import BillingPage from './pages/Billing/BillingPage';
import SettingsModal from './pages/Workspace/SettingsModal';
import { DocumentLibrary, ProjectsPage } from './pages/Workspace/WorkspaceCollections';
import IdentityIntakeModal from './pages/Workspace/IdentityIntakeModal';
import WorkspaceTutorial from './pages/Workspace/WorkspaceTutorial';
import DocumentSidePanel from './pages/Workspace/DocumentSidePanel';

const LandingRoutePage = loadPage(() => import('./pages/Landing/LandingPage'));
const AuthPageModule = loadPage(() => import('./pages/Auth/AuthPage'));
const AdminWorkspaceBoundary = loadPage(() => import('./pages/Admin/AdminWorkspace'));
const AdminMfaGate = loadPage(() => import('./pages/Admin/AdminMfaGate'));
const LegacyAdminWorkspace = loadPage(() => import('./pages/Admin/LegacyAdminWorkspace'));
const ChatSurface = loadPage(() => import('./pages/Workspace/ChatSurface'));
const WorkspaceBoundary = loadPage(() => import('./pages/Workspace/Workspace'));
const StatusPage = loadPage(() => import('./pages/Status/StatusPage'));
const PricingPage = loadPage(() => import('./pages/Pricing/PublicPricingPage'));

const textNodeOriginals = new WeakMap();
const textNodeRendered = new WeakMap();
const attributeOriginals = new WeakMap();
const attributeRendered = new WeakMap();


function I18nRuntime({ children }) {
  const { prefs } = useApp();
  const language = prefs?.language || 'id';
  const resolvedTheme = useResolvedTheme(prefs?.theme || 'system');
  const translateKey = useMemo(() => createTranslator(language), [language]);
  const translateDom = () => {
    const root = document.getElementById('root');
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE'].includes(parent.tagName)) return;
      const storedOriginal = textNodeOriginals.get(node);
      const lastRendered = textNodeRendered.get(node);
      const original = storedOriginal != null && node.nodeValue === lastRendered ? storedOriginal : node.nodeValue;
      textNodeOriginals.set(node, original);
      const next = translateUiText(original, language);
      if (node.nodeValue !== next) node.nodeValue = next;
      textNodeRendered.set(node, next);
    });
    root.querySelectorAll('[placeholder],[title],[aria-label]').forEach((element) => {
      let originals = attributeOriginals.get(element);
      if (!originals) { originals = {}; attributeOriginals.set(element, originals); }
      let rendered = attributeRendered.get(element);
      if (!rendered) { rendered = {}; attributeRendered.set(element, rendered); }
      ['placeholder', 'title', 'aria-label'].forEach((attribute) => {
        if (!element.hasAttribute(attribute)) return;
        const current = element.getAttribute(attribute);
        const previousRendered = rendered[attribute];
        if (!(attribute in originals) || current !== previousRendered) originals[attribute] = current;
        const next = translateUiText(originals[attribute], language);
        if (element.getAttribute(attribute) !== next) element.setAttribute(attribute, next);
        rendered[attribute] = next;
      });
    });
  };
  useEffect(() => {
    document.documentElement.lang = language === 'en' ? 'en' : 'id';
    document.body.dataset.laprakinTheme = resolvedTheme;
    let frame = requestAnimationFrame(translateDom);
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(translateDom);
    });
    const root = document.getElementById('root');
    if (root) observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [language, resolvedTheme]);
  return <I18nContext.Provider value={{ language, t: (value, values) => translateKey(value, values) }}>{children}</I18nContext.Provider>;
}

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Keep unexpected render failures from becoming a white screen and retain diagnostics for developers.
    console.error('Laprakin UI recovery boundary', error, info);
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <div className="app-recovery" role="alert">
      <BrandMark className="app-recovery-mark" alt="" />
      <div>
        <p>Halaman sedang dimuat ulang dengan aman.</p>
        <h1>Tampilan tidak dapat dimuat.</h1>
        <span>Data akun dan chat tidak dihapus. Muat ulang halaman untuk melanjutkan.</span>
      </div>
      <div className="app-recovery-actions">
        <button type="button" onClick={() => window.location.reload()}>Muat ulang</button>
        <a href="/">Kembali ke beranda</a>
      </div>
    </div>;
  }
}
const defaultPrefs = {
  theme: 'system', language: 'id', compact: true, reducedMotion: false, enterToSend: true,
  tone: 'formal', perspective: 'saya', profile: 'langkah', customInstructions: '', accent: 'lime', productUpdates: true, allowExternalAi: true,
};
// Aksen terang tetap boleh dipakai sebagai latar tombol pada tema terang.
// Untuk ikon, teks, dan focus ring, `lightInk` menyediakan pasangan yang lebih
// gelap agar kontrasnya tetap terbaca. Amber masih dibatasi ke tema gelap.
// Nama modal -> tab Settings yang dibuka. Sebelumnya berupa rantai ternary
// sepanjang delapan cabang, sehingga menambah satu tab mudah terlewat.
const SETTINGS_MODAL_TABS = {
  settings: 'general',
  'settings-billing': 'billing',
  'settings-general': 'general',
  'settings-personalization': 'personalization',
  'settings-academic': 'academic',
  'settings-storage': 'storage',
  'settings-security': 'security',
  'settings-archived': 'archived',
  'settings-referral': 'referral',
};

function noticeToneFor(value) {
  const text = String(value || '').toLocaleLowerCase('id-ID');
  return /gagal|error|belum|tidak|ditolak|habis|invalid|kesalahan|dibatalkan|kadaluwarsa|terjadi/.test(text)
    ? 'negative'
    : 'positive';
}

function readPrefs() {
  try { return { ...defaultPrefs, ...JSON.parse(localStorage.getItem('laprakin-preferences') || '{}') }; }
  catch { return defaultPrefs; }
}

function AppProvider({ children }) {
  const location = useLocation();
  const [session, setSession] = useState({ loading: true, user: null, wallet: null });
  const [prefs, setPrefs] = useState(readPrefs);
  const [notice, setNotice] = useState(null);
  const [dialog, setDialog] = useState(null);
  const sessionChecked = useRef(false);
  const refreshSession = async () => {
    try {
      const result = await api('/auth/me', { includeCsrf: false });
      setCsrfToken(result.csrfToken);
      setSession({ loading: false, user: result.user, wallet: result.wallet });
      return result;
    } catch {
      clearCsrfToken();
      setSession({ loading: false, user: null, wallet: null });
      return null;
    }
  };
  const showDialog = useCallback((options) => new Promise((resolve) => {
    setDialog({ ...options, resolve });
  }), []);
  const resolveDialog = useCallback((result) => {
    setDialog((current) => {
      current?.resolve?.(result);
      return null;
    });
  }, []);
  useEffect(() => {
    if (sessionChecked.current) return;
    if (location.pathname === '/privacy' || location.pathname === '/terms') {
      setSession({ loading: false, user: null, wallet: null });
      return;
    }
    sessionChecked.current = true;
    refreshSession();
  }, [location.pathname]);
  useEffect(() => { localStorage.setItem('laprakin-preferences', JSON.stringify(prefs)); }, [prefs]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const value = useMemo(() => ({ ...session, setSession, refreshSession, prefs, setPrefs, notice, setNotice, showDialog }), [session, prefs, notice, showDialog]);
  return <AppContext.Provider value={value}>{children}{notice && <div className={`toast toast-${noticeToneFor(notice)}`} role="status" aria-live="polite" aria-atomic="true"><span>{notice}</span><IconButton label="Tutup notifikasi" onClick={() => setNotice(null)}><X size={14} /></IconButton></div>}<AppDialog dialog={dialog} onResolve={resolveDialog} /></AppContext.Provider>;
}

function App() {
  const location = useLocation();
  return <AppErrorBoundary resetKey={location.pathname}><AppProvider><I18nRuntime><Suspense fallback={<LoadingScreen />}><div className="route-transition"><Routes><Route path="/" element={<LandingRoutePage />} /><Route path="/status" element={<StatusPage />} /><Route path="/auth" element={<AuthPageModule />} /><Route path="/privacy" element={<LegalPage type="privacy" />} /><Route path="/terms" element={<LegalPage type="terms" />} /><Route path="/pricing" element={<PricingPage />} /><Route path="/checkout" element={<PricingPage />} /><Route path="/billing" element={<PricingRedirect />} /><Route path="/app/billing" element={<PricingRedirect />} /><Route path="/admin/*" element={<ProtectedAdmin />} /><Route path="/app/*" element={<ProtectedApp />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></div></Suspense></I18nRuntime></AppProvider></AppErrorBoundary>;
}

const legalContent = {
  privacy: {
    eyebrow: 'Privasi',
    title: 'Kebijakan Privasi Laprakin',
    intro: 'Kami menjaga kerahasiaan data pengguna. Data identitas akademik, bahan, dan konteks tugas hanya diproses untuk menjalankan workspace serta membuat dan memperbaiki dokumen yang kamu minta—bukan untuk iklan, penjualan data, profiling, atau tujuan lain di luar layanan.',
    sections: [
      ['Komitmen utama kami', 'Laprakin tidak menjual, menyewakan, membagikan untuk iklan, atau memakai data pengguna untuk membangun profil pemasaran. Isi chat, file, identitas akademik, prompt, dan dokumen hanya dipakai untuk menyediakan fitur yang kamu minta, terutama menyusun, memperbaiki, menyimpan, menampilkan, dan mengekspor dokumen.'],
      ['Data akun dan keamanan akses', 'Kami memproses email, status verifikasi, metode login, sesi, serta metadata keamanan minimum agar akun dapat dibuat, diamankan, dan dipulihkan. Data ini tidak dipakai untuk membaca isi tugas atau menilai kamu. Password disimpan dalam bentuk hash dan tidak dapat dibaca oleh staf Laprakin.'],
      ['Identitas akademik', 'Nama, NIM/NPM, kelas, universitas, fakultas, jurusan, program studi, logo institusi, serta data akademik lain yang kamu isi digunakan hanya untuk mengisi, memformat, dan menghasilkan dokumen atau bagian workspace yang kamu minta. Data ini tidak digunakan untuk iklan, dijual, dipublikasikan, atau dipakai untuk tujuan selain pembuatan dokumen dan fitur yang langsung terkait.'],
      ['Bahan, chat, dan dokumen', 'File, gambar, tautan, teks, prompt, percakapan, draft, revisi, dan hasil export diproses agar Laprakin dapat memahami bahan, menjawab chat, menyusun dokumen, dan mempertahankan riwayat kerja. Kami tidak mengubahnya menjadi data publik dan tidak mengizinkan staf melihat isinya untuk kepentingan pribadi atau pemasaran.'],
      ['Pemrosesan oleh AI', 'Untuk menghasilkan respons atau dokumen, bagian konteks yang relevan dapat dikirim dari server ke Google Gemini sebagai provider pemrosesan. Pengiriman itu hanya dilakukan untuk memenuhi permintaanmu. Laprakin tidak mengirim API key ke browser, tidak memakai output untuk melatih model milik Laprakin, dan tidak menggunakan isi tugas untuk tujuan lain. Kontrol data yang tersedia di Settings tetap menjadi pilihanmu.'],
      ['Provider pendukung', 'Google dapat memproses autentikasi saat kamu memilih login Google. Midtrans memproses checkout QRIS. Provider email mengirim verifikasi dan reset password. Azure menyimpan resource dokumen bila storage production aktif. Provider tersebut hanya menerima data yang diperlukan untuk fungsi yang mereka jalankan; Laprakin tidak menyimpan detail kartu atau PIN pembayaran.'],
      ['Kerahasiaan dan akses internal', 'Akses internal dibatasi berdasarkan kebutuhan operasional. Dashboard admin menggunakan metadata agregat seperti jumlah pengguna, job, credit, dan error; isi chat, file, NIM, prompt, dan output AI tidak ditampilkan untuk monitoring rutin. Credential provider disimpan di server dan tidak dikirim ke browser.'],
      ['Keamanan teknis', 'Kami menggunakan cookie HttpOnly, perlindungan CSRF, validasi input, pembatasan akses berdasarkan pemilik akun, enkripsi saat transit, penyimpanan credential di server, serta audit metadata untuk melindungi layanan. Tidak ada sistem internet yang dapat dijamin bebas risiko, sehingga kami juga memantau akses dan menutup celah yang ditemukan.'],
      ['Retensi dan penghapusan', 'Data dipertahankan selama diperlukan untuk menyediakan workspace, memenuhi kewajiban transaksi, mencegah penyalahgunaan, atau menyelesaikan permintaanmu. File yang kamu hapus masuk proses penghapusan dan tidak ditampilkan lagi di workspace. Backup dan log operasional dapat memiliki masa retensi terbatas sebelum dibersihkan.'],
      ['Kendali dan permintaan pengguna', 'Kamu dapat mengunduh ringkasan data, mengubah preferensi, mencabut sesi, menghapus file, meminta penghapusan akun, dan meminta koreksi data melalui workspace atau menu Bantuan. Permintaan penghapusan tidak menghapus catatan yang wajib disimpan untuk keamanan, audit transaksi, atau kewajiban hukum, tetapi data tersebut tetap dibatasi penggunaannya.'],
      ['Anak, pihak lain, dan bahan milik orang lain', 'Layanan ditujukan untuk pengguna yang mampu menyetujui ketentuan. Jangan unggah data pribadi orang lain tanpa dasar atau izin yang sesuai. Jika bahan memuat NIM, nama, foto, atau informasi teman sekelas, pastikan penggunaannya memang diizinkan dan diperlukan untuk dokumenmu.'],
      ['Perubahan dan kontak privasi', 'Kami dapat memperbarui kebijakan ini ketika fitur, provider, atau kewajiban hukum berubah. Perubahan material akan ditampilkan melalui layanan. Jika kamu ingin menanyakan penggunaan data atau meminta penghapusan, gunakan menu Bantuan setelah masuk dan jelaskan data atau akun yang dimaksud.'],
      ['Integritas akademik', 'Laprakin membantu menyusun dan meninjau bahan yang benar-benar kamu punya, bukan membuat bukti, data praktikum, hasil eksperimen, identitas, atau sumber palsu. Kamu tetap bertanggung jawab memeriksa dokumen dan memastikan penggunaannya sesuai aturan kampus.'],
    ],
  },
  terms: {
    eyebrow: 'Ketentuan',
    title: 'Ketentuan Layanan Laprakin',
    intro: 'Dengan membuat akun, mengunggah bahan, atau menggunakan Laprakin, kamu menyetujui ketentuan ini. Ketentuan dibuat agar layanan tetap aman, jujur, dan jelas bagi pengguna maupun pihak yang datanya ikut berada di dalam bahan.',
    sections: [
      ['Penerimaan dan cakupan', 'Ketentuan ini berlaku untuk landing page, akun, workspace, chat, upload, AI, dokumen, export, pembayaran, dukungan, dan fitur lain yang disediakan Laprakin. Jika kamu tidak menyetujui bagian penting dari ketentuan ini, jangan membuat akun atau gunakan layanan.'],
      ['Akun dan informasi yang benar', 'Kamu wajib memberikan email dan informasi akun yang benar, menjaga password, dan segera memberi tahu kami bila menduga ada akses tidak sah. Satu akun tidak boleh dipindahtangankan tanpa persetujuan. Aktivitas yang dilakukan melalui akunmu dapat dianggap sebagai aktivitasmu sampai ada bukti sebaliknya.'],
      ['Penggunaan yang diperbolehkan', 'Gunakan Laprakin untuk mengelola bahan milikmu, memahami tugas, membuat laporan, meminta revisi, menyimpan riwayat kerja, dan mengekspor dokumen akademik yang sah. Kamu tetap harus mengikuti aturan kampus, instruksi dosen, dan hukum yang berlaku.'],
      ['Integritas akademik dan larangan pemalsuan', 'Dilarang memakai Laprakin untuk memalsukan bukti, data, screenshot, hasil eksperimen, tanda tangan, identitas, sumber, kehadiran, atau hasil penelitian. Dilarang pula meminta AI mengarang hasil yang tidak ada atau menyamarkan penggunaan bantuan dengan cara menipu.'],
      ['Konten yang dilarang', 'Jangan mengunggah malware, kredensial, data kartu, pornografi ilegal, eksploitasi anak, ancaman, doxing, data orang lain tanpa izin, materi yang melanggar hak cipta, atau konten yang mendorong kekerasan dan pelanggaran hukum.'],
      ['Bahan dan hak pengguna', 'Kamu mempertahankan hak atas bahan yang kamu unggah dan bertanggung jawab atas izin, lisensi, kerahasiaan, serta keakuratannya. Kamu memberi Laprakin izin terbatas, non-eksklusif, dan hanya selama diperlukan untuk menyimpan, memproses, menampilkan, merevisi, dan mengekspor dokumen yang kamu minta.'],
      ['Output AI dan pemeriksaan manusia', 'Respons AI dapat keliru, tidak lengkap, atau salah menafsirkan bahan. Output bukan jaminan kebenaran, bukan nasihat profesional, dan bukan pengganti pemeriksaan manusia. Kamu wajib memeriksa angka, kutipan, sumber, identitas, format, kesesuaian bahan, dan aturan dosen sebelum memakai atau mengumpulkan dokumen.'],
      ['Privasi dan kerahasiaan', 'Pemrosesan data tunduk pada Kebijakan Privasi. Laprakin tidak menjual data atau memakai identitas, bahan, chat, prompt, dan dokumen untuk iklan atau tujuan di luar penyediaan layanan. Provider AI dan provider teknis hanya dilibatkan ketika diperlukan untuk menjalankan fitur yang kamu minta.'],
      ['Plan, credit, dan pembayaran', 'Harga, credit, masa aktif, dan fitur paket ditampilkan sebelum checkout. Pembayaran QRIS diproses oleh Midtrans dan aktivasi mengikuti status yang diverifikasi server. Credit dapat memiliki masa berlaku atau batas pemakaian sesuai tampilan paket. Refund, pembatalan, dan sengketa ditinjau berdasarkan status transaksi dan aturan yang berlaku.'],
      ['Ketersediaan layanan beta', 'Laprakin masih berada dalam tahap beta. Fitur dapat berubah, mengalami pemeliharaan, memiliki batas penggunaan, atau tidak tersedia sementara. Kami berusaha menjaga backup, pemulihan, dan notifikasi operasional, tetapi tidak menjamin layanan selalu tersedia tanpa gangguan atau kehilangan data akibat kejadian di luar kendali kami.'],
      ['Keamanan, penyalahgunaan, dan penangguhan', 'Kami dapat membatasi, menunda, atau menutup akses jika ada pelanggaran ketentuan, aktivitas mencurigakan, risiko terhadap pengguna, tunggakan pembayaran, perintah hukum, atau kebutuhan pemeliharaan. Jika memungkinkan, kami memberikan alasan dan jalur appeal. Jangan mencoba melewati pembatasan dengan akun atau perangkat lain.'],
      ['Hak kekayaan intelektual Laprakin', 'Nama, logo, antarmuka, kode, desain, dokumentasi, dan komponen layanan Laprakin adalah milik Laprakin atau pemberi lisensinya. Kamu tidak boleh menyalin, menjual, membongkar, melakukan reverse engineering, menghapus atribusi, atau menggunakan merek Laprakin tanpa izin tertulis.'],
      ['Batas tanggung jawab', 'Laprakin membantu pekerjaan dan tidak menjamin dokumen diterima, mendapat nilai tertentu, bebas kesalahan, atau sesuai aturan kampus tanpa pemeriksaanmu. Sejauh diizinkan hukum, kamu bertanggung jawab atas keputusan dan penggunaan output, bahan yang diunggah, serta dampak dari pelanggaran aturan akademik atau hak pihak lain.'],
      ['Perubahan ketentuan dan kontak', 'Kami dapat memperbarui ketentuan untuk mencerminkan perubahan fitur, provider, keamanan, atau hukum. Perubahan material akan diinformasikan melalui layanan. Pertanyaan, laporan penyalahgunaan, dan permintaan penyelesaian dapat diajukan melalui menu Bantuan setelah masuk.'],
    ],
  },
};

function LegalPage({ type }) {
  const { prefs } = useApp();
  const theme = useResolvedTheme(prefs?.theme || 'system');
  const content = legalContent[type] || legalContent.privacy;
  return <div className={`legal-page theme-${theme}`}>
    <header className="legal-topbar">
      <Link to="/" className="legal-brand"><BrandMark alt="" /><b>laprakin</b><small>BETA</small></Link>
      <Link to="/" className="legal-home-link"><ArrowLeft size={14}/>Beranda</Link>
    </header>
    <main className="legal-shell">
      <article className="legal-document">
        <header><span>{content.eyebrow}</span><h1>{content.title}</h1><p>{content.intro}</p><small>Berlaku sejak 23 Juli 2026</small></header>
        <div className="legal-sections">{content.sections.map(([title, body], index) => <section key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><h2>{title}</h2><p>{body}</p></div></section>)}</div>
        <footer><p>Dokumen terkait:</p>{type === 'privacy' ? <Link to="/terms">Ketentuan Layanan</Link> : <Link to="/privacy">Kebijakan Privasi</Link>}</footer>
      </article>
    </main>
  </div>;
}

function ProtectedApp() { const { loading, user } = useApp(); if (loading) return <LoadingScreen />; if (!user) return <Navigate to="/auth" replace />; if (user.role === 'admin') return <Navigate to="/admin" replace />; return <WorkspaceBoundary><LegacyWorkspace /></WorkspaceBoundary>; }

function ProtectedBilling() {
  const { loading, user } = useApp();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to={`/auth?next=${encodeURIComponent(`/billing${location.search || ''}`)}`} replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return <BillingPage />;
}
function PricingRedirect() { const location = useLocation(); return <Navigate to={`/pricing${location.search || ''}`} replace />; }

function ProtectedAdmin() { const { loading, user } = useApp(); if (loading) return <LoadingScreen />; if (!user) return <Navigate to="/auth" replace />; if (user.role !== 'admin') return <Navigate to="/app" replace />; return <AdminWorkspaceBoundary render={() => <AdminMfaGate><LegacyAdminWorkspace /></AdminMfaGate>} />; }

function LegacyWorkspace() {
  const { user, wallet, refreshSession, setNotice, prefs, setPrefs, showDialog } = useApp();
  const resolvedTheme = useResolvedTheme(prefs.theme || 'system');
  const location = useLocation(); const navigate = useNavigate(); const uploadRef = useRef(null);
  const [sessions, setSessions] = useState([]); const [active, setActive] = useState(null); const [messages, setMessages] = useState([]); const [attachments, setAttachments] = useState([]); const [documentState, setDocumentState] = useState(null); const [workflow, setWorkflow] = useState(null); const [activeJob, setActiveJob] = useState(null);
  const [input, setInput] = useState(''); const [pendingLandingFiles, setPendingLandingFiles] = useState([]); const [busy, setBusy] = useState(false); const [actionBusy, setActionBusy] = useState(false); const [accountOpen, setAccountOpen] = useState(false); const [draggingSession, setDraggingSession] = useState(null); const [renamingId, setRenamingId] = useState(null); const [editingMessageId, setEditingMessageId] = useState(null); const [leftCollapsed, setLeftCollapsed] = useState(() => window.innerWidth < 860 || localStorage.getItem('laprakin-left-collapsed') === 'true'); const [rightOpen, setRightOpen] = useState(false); const [documentOpen, setDocumentOpen] = useState(false); const [quizMode, setQuizMode] = useState(false); const [modal, setModal] = useState(null); const [config, setConfig] = useState(defaultChatConfig); const [contextOpen, setContextOpen] = useState(false); const [attachmentKind, setAttachmentKind] = useState(''); const [documents, setDocuments] = useState([]); const [projectPins, setProjectPins] = useState([]); const [billingPlan, setBillingPlan] = useState(null); const [aiMode, setAiMode] = useState('basic'); const [aiModeAccess, setAiModeAccess] = useState({ basic: { available: true }, thinking: { available: false }, xtrathink: { available: false } }); const [recentSearchOpen, setRecentSearchOpen] = useState(false); const [recentSearchQuery, setRecentSearchQuery] = useState(''); const [identityIntake, setIdentityIntake] = useState(null); const [pendingConfigRequest, setPendingConfigRequest] = useState(null); const [tutorialOpen, setTutorialOpen] = useState(false); const [tutorialFirstUse, setTutorialFirstUse] = useState(false);
  const actionInFlightRef = useRef(false);
  const sendInFlightRef = useRef(false);
  const tutorialAutoOpenedRef = useRef(false);
  const recentSearchInputRef = useRef(null);
  const [productUpdate, setProductUpdate] = useState(null);
  const page = location.pathname.includes('/projects') ? 'projects' : location.pathname.includes('/documents') ? 'documents' : 'chat';
  const editingMessage = getEditableMessage(messages, editingMessageId);
  useEffect(() => {
    if (prefs.productUpdates === false || productUpdate) return undefined;
    let disposed = false;
    let lastActivityAt = Date.now();
    const loadPendingUpdate = async () => {
      try {
        const data = await api('/product-updates/pending');
        if (!disposed && data.update) {
          setProductUpdate(data.update);
          api(`/product-updates/${data.update.id}/receipt`, { method: 'POST', body: { action: 'seen' } }).catch(() => {});
        }
      } catch { /* product communication must never block the workspace */ }
    };
    const onActivity = () => {
      const wasIdle = Date.now() - lastActivityAt >= 5 * 60 * 1000;
      lastActivityAt = Date.now();
      if (wasIdle) loadPendingUpdate();
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') onActivity(); };
    loadPendingUpdate();
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    window.addEventListener('focus', onActivity);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('focus', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [prefs.productUpdates, productUpdate]);
  useEffect(() => {
    if (!recentSearchOpen) return undefined;
    const frame = window.requestAnimationFrame(() => recentSearchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [recentSearchOpen]);
  const projectParam = new URLSearchParams(location.search).get('project') || '';
  useEffect(() => { if (location.pathname === '/app/billing') navigate('/pricing', { replace: true }); }, [location.pathname, navigate]);
  const identityComplete = Boolean(user.fullName && user.nim && user.className && user.institutionName && user.institutionLogoUrl && (user.facultyName || user.departmentKey) && (user.studyProgramName || user.studyProgramKey));
  useEffect(() => {
    if (user.onboardingDismissed || tutorialAutoOpenedRef.current) return;
    tutorialAutoOpenedRef.current = true;
    setTutorialFirstUse(true);
    setTutorialOpen(true);
  }, [user.onboardingDismissed]);
  const updateConfig = (patch) => setConfig((value) => ({ ...value, ...patch, configuration: { ...value.configuration, ...(patch.configuration || {}) } }));
  const closeMobileSidebar = () => { if (window.innerWidth <= 700) setLeftCollapsed(true); };
  const setRoute = (next) => { closeMobileSidebar(); navigate(next === 'chat' ? '/app' : `/app/${next}`); };
  const writingPrefsConfig = (base = {}) => {
    const extraInstructions = String(prefs.customInstructions || '').trim();
    const localInstructions = String(base.instructions || '').trim();
    const instructions = extraInstructions && localInstructions
      ? localInstructions.includes(extraInstructions) ? localInstructions : `${extraInstructions}\n\n${localInstructions}`
      : extraInstructions || localInstructions;
    return {
      ...base,
      documentProfile: prefs.profile || 'langkah',
      tone: prefs.tone || 'formal',
      perspective: prefs.perspective || 'saya',
      instructions,
      allowExternalAi: prefs.allowExternalAi !== false,
    };
  };
  const createDefaultConfig = () => ({ ...defaultChatConfig, configuration: writingPrefsConfig(defaultChatConfig.configuration) });
  const sessionPayload = (base) => ({ ...base, departmentKey: user.departmentKey || '', studyProgramKey: user.studyProgramKey || '', structureMode: base.structureMode || 'guided', courseGroup: base.courseGroup || base.configuration?.courseName || 'Belum dikelompokkan' });
  const hydrate = (data) => { setActive(data.session); if (data.session?.id) localStorage.setItem('laprakin-active-chat-id', data.session.id); setMessages(data.messages || []); setAttachments(data.attachments || []); setWorkflow(data.workflow || null); const current = data.session.configuration || {}; setConfig({ title: data.session.title || 'Laprak baru', structureMode: data.session.structure_mode || 'guided', configuration: { ...defaultChatConfig.configuration, ...current } }); };
  const loadSessions = async () => {
    try {
      const data = await api('/chat/sessions');
      const nextSessions = data.sessions || [];
      setSessions(nextSessions);
      const savedId = localStorage.getItem('laprakin-active-chat-id');
      if (!active && savedId && nextSessions.some((item) => item.id === savedId)) {
        hydrate(await api(`/chat/sessions/${savedId}`));
      }
    } catch (err) { setNotice(err.message); }
  };
  const loadDocuments = async () => { try { setDocuments(await api('/documents')); } catch (err) { setNotice(err.message); } };
  const loadProjectPins = async () => { try { const data = await api('/projects/pins'); setProjectPins(data.pins || []); } catch { setProjectPins([]); } };
  const loadBillingPlan = async () => { try { const billing = await api('/billing'); setBillingPlan(billing.currentPlan || null); } catch { /* Keep the workspace available if billing is temporarily unavailable. */ } };
  const loadAiModes = async () => { try { const result = await api('/ai/modes'); const next = result.modes || {}; setAiModeAccess(next); setAiMode((current) => next[current]?.available ? current : 'basic'); } catch { setAiModeAccess({ basic: { available: true }, thinking: { available: false }, xtrathink: { available: false } }); } };
  const appendAssistantMessage = (content) => setMessages((items) => [...items, {
    id: `local-assistant-${crypto.randomUUID()}`,
    role: 'assistant',
    content: String(content || 'Permintaan belum dapat diproses. Coba jelaskan kembali perubahan yang kamu inginkan.'),
    meta: { kind: 'local_conversation_feedback' },
    created_at: new Date().toISOString(),
  }]);
  const groupLabel = (item) => canonicalCourseLabel(item.course_group || item.courseGroup || item.configuration?.courseName || 'Belum dikelompokkan');
  const groupsFromSessions = (items) => {
    const groups = [];
    [...items]
      .sort((left, right) => courseTokens(groupLabel(right)).length - courseTokens(groupLabel(left)).length)
      .forEach((item) => {
        const label = groupLabel(item);
        const matching = groups.find((group) => courseLabelsMatch(group.label, label));
        if (matching) {
          matching.label = preferredCourseLabel(matching.label, label);
          matching.items.push(item);
        } else {
          groups.push({ label, items: [item] });
        }
      });
    return Object.fromEntries(groups.map((group) => [group.label, group.items]));
  };
  const orderedSessions = useMemo(() => [...sessions].sort((a, b) =>
    new Date(b.updated_at || b.updatedAt || b.created_at || b.createdAt || 0) - new Date(a.updated_at || a.updatedAt || a.created_at || a.createdAt || 0)
  ), [sessions]);
  const visibleRecentSessions = useMemo(() => {
    const query = recentSearchQuery.trim().toLocaleLowerCase();
    if (!query) return orderedSessions;
    return orderedSessions.filter((item) => `${item.title || 'Chat baru'} ${groupLabel(item)}`.toLocaleLowerCase().includes(query));
  }, [orderedSessions, recentSearchQuery]);
  const sessionFolders = useMemo(() => Object.keys(groupsFromSessions(sessions)).filter((folder) => folder && folder !== 'Belum dikelompokkan'), [sessions]);
  const persistOrder = async (next) => {
    setSessions(next);
    try { await api('/chat/sessions/reorder', { method: 'POST', body: { items: next.map((item, index) => ({ id: item.id, courseGroup: groupLabel(item), sortPosition: index })) } }); } catch (err) { setNotice(err.message); await loadSessions(); }
  };
  const renameSession = async (id, title) => {
    const clean = title.trim().slice(0, 120); if (!clean) return setRenamingId(null);
    try { const data = await api(`/chat/sessions/${id}`, { method: 'PUT', body: { title: clean } }); setSessions((old) => old.map((item) => item.id === id ? data.session : item)); if (active?.id === id) setActive(data.session); setRenamingId(null); } catch (err) { setNotice(err.message); }
  };
  const moveSessionToGroup = async (session, targetGroup) => {
    const next = sessions.map((item) => item.id === session.id ? { ...item, course_group: targetGroup } : item);
    await persistOrder(next);
  };
  const setPinned = async (session, pinned) => {
    try {
      const data = await api(`/chat/sessions/${session.id}/pin`, { method: 'POST', body: { pinned } });
      setSessions((items) => items.map((item) => item.id === session.id ? data.session : item));
      setNotice(pinned ? 'Chat disematkan.' : 'Chat dilepas dari sematan.');
    } catch (err) { setNotice(err.message); }
  };
  const setProjectPinned = async (project, pinned) => {
    const projectKey = normalizedCourseKey(project.name);
    try {
      await api('/projects/pins', {
        method: 'POST',
        body: { projectName: project.name, projectKey, pinned },
      });
      setProjectPins((items) => pinned
        ? [...items.filter((item) => item.projectKey !== projectKey), { projectKey, projectName: project.name }]
        : items.filter((item) => item.projectKey !== projectKey));
      setNotice(pinned ? 'Project disematkan.' : 'Project dilepas dari sematan.');
    } catch (err) { setNotice(err.message); }
  };
  const archiveSession = async (session) => {
    try {
      await api(`/chat/sessions/${session.id}/archive`, { method: 'POST', body: {} });
      setSessions((items) => items.filter((item) => item.id !== session.id));
      if (active?.id === session.id) { localStorage.removeItem('laprakin-active-chat-id'); setActive(null); setMessages([]); setAttachments([]); setDocumentState(null); setWorkflow(null); setActiveJob(null); setEditingMessageId(null); setInput(''); }
      setNotice('Chat diarsipkan.');
    } catch (err) { setNotice(err.message); }
  };
  const deleteSession = async (session) => {
    try {
      await api(`/chat/sessions/${session.id}`, { method: 'DELETE' });
      setSessions((items) => items.filter((item) => item.id !== session.id));
      if (active?.id === session.id) { localStorage.removeItem('laprakin-active-chat-id'); setActive(null); setMessages([]); setAttachments([]); setDocumentState(null); setWorkflow(null); setActiveJob(null); setEditingMessageId(null); setInput(''); }
      setNotice('Chat dihapus permanen.');
    } catch (err) { setNotice(err.message); }
  };
  useEffect(() => { loadSessions(); loadDocuments(); loadProjectPins(); loadBillingPlan(); loadAiModes(); }, []);
  useEffect(() => { takeLandingDraft().then(({ prompt, files }) => { if (prompt) setInput(prompt); if (files?.length) setPendingLandingFiles(files); }); }, []);
  useEffect(() => { localStorage.setItem('laprakin-left-collapsed', String(leftCollapsed)); }, [leftCollapsed]);
  useEffect(() => {
    let disposed = false;
    let refreshTimer = null;
    if (!active?.document_id) { setDocumentState(null); setActiveJob(null); return undefined; }
    const refreshDocument = async () => {
      try {
        const data = await api(`/documents/${active.document_id}`);
        if (disposed) return;
        setDocumentState(data);
        const liveJob = data.jobs?.find((job) => ['queued', 'running', 'retry_queued'].includes(job.status));
        setActiveJob(liveJob || data.jobs?.[0] || null);
        if (data.status !== 'generated' || liveJob) refreshTimer = window.setTimeout(refreshDocument, 1000);
      } catch {
        if (!disposed) refreshTimer = window.setTimeout(refreshDocument, 2200);
      }
    };
    refreshDocument();
    return () => { disposed = true; if (refreshTimer) window.clearTimeout(refreshTimer); };
  }, [active?.document_id]);
  useEffect(() => { if (location.pathname.endsWith('/support')) { setModal('help'); navigate('/app', { replace: true }); } if (location.pathname.endsWith('/feedback')) { setModal('feedback'); navigate('/app', { replace: true }); } if (location.pathname.endsWith('/profile')) { setModal('settings'); navigate('/app', { replace: true }); } }, [location.pathname, navigate]);
  const createSession = async (openConfig = false, overrides = {}) => {
    setEditingMessageId(null);
    setInput('');
    setBusy(true);
    try {
      const fresh = createDefaultConfig();
      const payload = {
        ...fresh,
        ...overrides,
        configuration: { ...fresh.configuration, ...(overrides.configuration || {}) },
      };
      const data = await api('/chat/sessions', { method: 'POST', body: sessionPayload(payload) });
      hydrate(data);
      setSessions((old) => [data.session, ...old]);
      setRoute('chat');
      setRightOpen(openConfig);
      setDocumentOpen(false);
      setContextOpen(false);
      return data.session;
    } catch (err) {
      appendAssistantMessage(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const startNewChat = () => {
    localStorage.removeItem('laprakin-active-chat-id');
    setActive(null);
    setMessages([]);
    setAttachments([]);
    setDocumentState(null);
    setWorkflow(null);
    setActiveJob(null);
    setConfig(createDefaultConfig());
    setInput('');
    setEditingMessageId(null);
    setPendingLandingFiles([]);
    setIdentityIntake(null);
    setPendingConfigRequest(null);
    setContextOpen(false);
    setRightOpen(false);
    setDocumentOpen(false);
    if (window.innerWidth <= 700) setLeftCollapsed(true);
    setRoute('chat');
  };
  const openSession = async (id) => { setEditingMessageId(null); setInput(''); try { const data = await api(`/chat/sessions/${id}`); hydrate(data); setPendingConfigRequest(null); setRoute('chat'); setRightOpen(false); setDocumentOpen(false); setContextOpen(false); if (window.innerWidth <= 700) setLeftCollapsed(true); } catch (err) { setNotice(err.message); } };
  const saveConfig = async () => {
    const targetSession = active || pendingConfigRequest?.session;
    if (!targetSession) return;
    const courseName = String(config.configuration.courseName || '').trim();
    const moduleTitle = String(config.configuration.moduleTitle || '').trim();
    if (!courseName || !moduleTitle) {
      setNotice('Isi mata kuliah dan modul atau materi sebelum memulai chat.');
      return;
    }
    setBusy(true);
    try {
      const nextTitle = pendingConfigRequest ? moduleTitle.slice(0, 100) : config.title;
      const data = await api(`/chat/sessions/${targetSession.id}`, {
        method: 'PUT',
        body: sessionPayload({
          ...config,
          title: nextTitle,
          configuration: { ...config.configuration, courseName, moduleTitle },
          courseGroup: courseName,
        }),
      });
      setActive(data.session);
      setSessions((old) => old.map((item) => item.id === data.session.id ? data.session : item));
      const queued = pendingConfigRequest;
      setPendingConfigRequest(null);
      setRightOpen(false);
      setNotice('Konfigurasi chat disimpan.');
      if (queued?.session?.id === data.session.id) {
        const next = { ...queued, session: data.session };
        await dispatchChatMessage(next);
      }
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  };
  const dispatchChatMessage = async ({ session, content, files = [], kind = '' }) => {
    let current = session;
    let streamAssistantId = '';
    setBusy(true);
    try {
      await api(`/chat/sessions/${current.id}/processing-access`, { method: 'POST', body: {} });
      await refreshSession();
      if (files.length) current = await uploadFiles(current, files, kind, false);
      const currentConfiguration = current.configuration || config.configuration || {};
      const syncedConfig = {
        title: current.title || config.title || 'Laprak baru',
        structureMode: current.structure_mode || current.structureMode || config.structureMode || 'guided',
        configuration: writingPrefsConfig(currentConfiguration),
        courseGroup: currentConfiguration.courseName || current.course_group || 'Belum dikelompokkan',
      };
      const synced = await api(`/chat/sessions/${current.id}`, { method: 'PUT', body: sessionPayload(syncedConfig) });
      current = synced.session;
      setActive(synced.session);
      setConfig({ title: synced.session.title || 'Laprak baru', structureMode: synced.session.structure_mode || 'guided', configuration: { ...defaultChatConfig.configuration, ...(synced.session.configuration || {}) } });
      setSessions((old) => old.map((item) => item.id === synced.session.id ? synced.session : item));
      streamAssistantId = `local-assistant-${crypto.randomUUID()}`;
      setMessages((items) => [...items, {
        id: `local-user-${crypto.randomUUID()}`,
        role: 'user',
        content,
        meta: { aiMode },
        created_at: new Date().toISOString(),
      }]);
      const data = await apiStream(`/chat/sessions/${current.id}/messages`, {
        method: 'POST',
        body: { content, aiMode, allowExternalAi: prefs.allowExternalAi !== false },
        onDelta: (delta) => {
          const text = String(delta || '');
          if (!text) return;
          setMessages((items) => {
            const existing = items.findIndex((item) => item.id === streamAssistantId);
            if (existing < 0) {
              return [...items, {
                id: streamAssistantId,
                role: 'assistant',
                content: text,
                meta: { aiMode, streaming: true },
                created_at: new Date().toISOString(),
              }];
            }
            return items.map((item, index) => index === existing ? { ...item, content: `${item.content || ''}${text}` } : item);
          });
        },
      });
      hydrate(data);
      setSessions((old) => old.map((item) => item.id === data.session.id ? data.session : item));
      setInput('');
      setPendingLandingFiles([]);
      if (data.autoGenerate) await createDocument(data.session);
      return data;
    } catch (err) {
      if (current?.id) {
        try { await api(`/chat/sessions/${current.id}/processing-access`, { method: 'DELETE', body: {} }); } catch { /* reservation tetap aman bila proses sudah dimulai */ }
        await refreshSession();
      }
      if (streamAssistantId) setMessages((items) => items.filter((item) => item.id !== streamAssistantId));
      appendAssistantMessage(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const reviseChatMessage = async ({ messageId, mode, content = '' }) => {
    if (!active?.id || busy || actionBusy) return null;
    let request;
    try {
      request = buildRevisionRequest({ sessionId: active.id, messageId, mode, content });
    } catch (error) {
      setNotice(error.message);
      return null;
    }
    setBusy(true);
    try {
      const data = await api(request.path, { method: 'POST', body: request.body });
      hydrate(data);
      setSessions((old) => old.map((item) => item.id === data.session.id ? data.session : item));
      setInput('');
      setEditingMessageId(null);
      setNotice(mode === 'regenerate' ? 'Jawaban AI dibuat ulang.' : 'Pesan dan jawaban AI diperbarui.');
      return data;
    } catch (error) {
      setNotice(error.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const completeIdentityIntake = async (identity) => {
    if (!identityIntake) return;
    setBusy(true);
    try {
      await api('/profile', {
        method: 'PUT',
        body: {
          fullName: identity.fullName.trim(),
          nim: identity.nim.trim(),
          className: identity.className.trim(),
          institutionName: identity.institutionName.trim(),
          institutionLogoUrl: identity.institutionLogoUrl.trim(),
          facultyName: identity.facultyName.trim(),
          studyProgramName: identity.studyProgramName.trim(),
          departmentKey: identity.departmentKey,
          studyProgramKey: identity.studyProgramKey,
        },
      });
      const sessionUpdate = await api(`/chat/sessions/${identityIntake.session.id}`, {
        method: 'PUT',
        body: {
          departmentKey: identity.departmentKey,
          studyProgramKey: identity.studyProgramKey,
        },
      });
      await refreshSession();
      const pending = { ...identityIntake, session: sessionUpdate.session };
      setIdentityIntake(null);
      await dispatchChatMessage(pending);
    } catch (err) {
      appendAssistantMessage(err.message);
      setBusy(false);
    }
  };
  const send = async (event) => {
    event?.preventDefault();
    if (sendInFlightRef.current || busy || actionBusy || (!input.trim() && !pendingLandingFiles.length)) return;
    sendInFlightRef.current = true;
    try {
    if (editingMessageId) {
      await reviseChatMessage({ messageId: editingMessageId, mode: 'edit', content: input });
      return;
    }
    let current = active;
    const requiresConfiguration = !current;
    const landingContent = input.trim() || 'Saya sudah menambahkan bahan untuk laprak ini.';
    const landingFiles = [...pendingLandingFiles];
    if (current?.id && pendingConfigRequest?.session?.id === current.id) {
      setRightOpen(true);
      return;
    }
    if (current?.document_id && documentState?.status === 'generated') {
      const content = input.trim() || 'Gunakan bahan tambahan ini untuk memperbarui laprak.';
      setInput('');
      const files = [...pendingLandingFiles];
      setPendingLandingFiles([]);
      const optimisticId = `local-user-${crypto.randomUUID()}`;
      setMessages((items) => [...items, {
        id: optimisticId,
        role: 'user',
        content,
        meta: { kind: 'revision_request', pending: true },
        created_at: new Date().toISOString(),
      }]);
      setBusy(true);
      try {
        if (files.length) await uploadFiles(current, files, attachmentKind, false);
        const out = await api(`/documents/${current.document_id}/revise`, {
          method: 'POST',
          body: { instruction: content, aiMode },
        });
        if (out.conversation) hydrate(out.conversation);
        if (out.needsClarification || !out.jobId) return;
        setActiveJob({ id: out.jobId, type: 'generate', status: 'queued', progress: 0, message: 'Memvalidasi dan menyiapkan revisi', timeline: [] });
        const job = await waitForJob(out.jobId);
        if (job.status !== 'completed') throw new Error(job.errorMessage || job.message || 'Revisi belum berhasil diproses.');
        const nextDocument = await api(`/documents/${current.document_id}`);
        setDocumentState(nextDocument);
        setActiveJob(nextDocument.jobs?.find((item) => item.id === job.id) || job);
        hydrate(await api(`/chat/sessions/${current.id}`));
        await loadDocuments();
      } catch (err) {
        setMessages((items) => [
          ...items.filter((item) => item.id !== optimisticId),
          { id: optimisticId, role: 'user', content, meta: { kind: 'revision_request' }, created_at: new Date().toISOString() },
          { id: `local-assistant-${crypto.randomUUID()}`, role: 'assistant', content: err.message, meta: { kind: 'revision_error' }, created_at: new Date().toISOString() },
        ]);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!current) {
      try {
        const access = await api('/chat/processing-access');
        if (!access.available) {
          appendAssistantMessage('Kredit Basic kamu sudah habis. Tambah kredit sebelum memulai laprak baru.');
          return;
        }
      } catch (err) {
        appendAssistantMessage(err.message);
        return;
      }
    }
    if (!current) {
      setInput('');
      setPendingLandingFiles([]);
      current = await createSession(false);
    }
    if (!current) return;
    const content = landingContent;
    const files = landingFiles;
    setInput('');
    setPendingLandingFiles([]);
    await dispatchChatMessage({ session: current, content, files, kind: attachmentKind });
    } finally {
      sendInFlightRef.current = false;
    }
  };
  const uploadFiles = async (current, files, kind = '', finalize = true) => {
    const groups = new Map();
    files.forEach((file) => {
      const resolvedKind = kind || inferPendingAttachmentKind(file);
      groups.set(resolvedKind, [...(groups.get(resolvedKind) || []), file]);
    });
    for (const [resolvedKind, groupedFiles] of groups) {
      const form = new FormData(); form.append('kind', resolvedKind); form.append('finalize', String(finalize)); groupedFiles.forEach((file) => form.append('files', file));
      await api(`/chat/sessions/${current.id}/attachments`, { method: 'POST', body: form, form: true });
    }
    const refreshed = await api(`/chat/sessions/${current.id}`);
    hydrate(refreshed);
    if (refreshed.session.document_id) {
      const nextDocument = await api(`/documents/${refreshed.session.document_id}`);
      setDocumentState(nextDocument);
      setActiveJob(nextDocument.jobs?.[0] || null);
    }
    return refreshed.session;
  };
  const upload = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length) addPendingFiles(files);
    event.target.value = '';
  };
  const pasteImagesIntoChat = (event) => { const images = clipboardImageFiles(event); if (!images.length) return; event.preventDefault(); setPendingLandingFiles((items) => mergeFiles(items, images).slice(0, 12)); };
  const addPendingFiles = (files) => { const incoming = Array.from(files || []); if (!incoming.length) return; setPendingLandingFiles((items) => mergeFiles(items, incoming).slice(0, 12)); };
  const removeAttachment = async (id) => { if (!active) return; try { const refreshed = await api(`/chat/sessions/${active.id}/attachments/${id}`, { method: 'DELETE' }); hydrate(refreshed); if (refreshed.session.document_id) { const nextDocument = await api(`/documents/${refreshed.session.document_id}`); setDocumentState(nextDocument); setActiveJob(nextDocument.jobs?.[0] || null); } } catch (err) { setNotice(err.message); } };
  const updateAttachmentCategory = async (id, kind) => {
    if (!active) return;
    try {
      const refreshed = await api(`/chat/sessions/${active.id}/attachments/${id}`, { method: 'PATCH', body: { kind } });
      hydrate(refreshed);
      setNotice('Kategori bahan diperbarui.');
    } catch (err) { setNotice(err.message); }
  };
  const waitForJob = async (jobId) => { const started = Date.now(); while (Date.now() - started < 300000) { const job = await api(`/jobs/${jobId}`); setActiveJob(job); if (['completed', 'failed', 'canceled'].includes(job.status)) return job; await new Promise((resolve) => setTimeout(resolve, 650)); } throw new Error('Proses masih berjalan. Timeline akan tetap tersedia saat chat ini dibuka lagi.'); };
  const waitForDocumentReady = async (documentId, sessionId) => {
    const started = Date.now();
    while (Date.now() - started < 600000) {
      const nextDocument = await api(`/documents/${documentId}`);
      setDocumentState(nextDocument);
      const liveJob = nextDocument.jobs?.find((job) => ['queued', 'running', 'retry_queued'].includes(job.status));
      setActiveJob(liveJob || nextDocument.jobs?.[0] || null);
      const completedGeneration = nextDocument.jobs?.some((job) => job.type === 'generate' && job.status === 'completed');
      if (nextDocument.status === 'generated' && completedGeneration && !liveJob) {
        if (sessionId) hydrate(await api(`/chat/sessions/${sessionId}`));
        return nextDocument;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    return null;
  };
  const createDocument = async (sessionOverride = null) => {
    const targetSession = sessionOverride?.id ? sessionOverride : active;
    if (!targetSession) return;
    setBusy(true);
    try {
      const out = await api(`/chat/sessions/${targetSession.id}/document`, { method: 'POST', body: { aiMode } });
      setDocumentState(out.document);
      const queuedJob = out.document.jobs?.find((job) => job.id === out.jobId)
        || out.document.jobs?.find((job) => ['queued', 'running', 'retry_queued'].includes(job.status));
      setActiveJob(queuedJob || (out.jobId ? { id: out.jobId, type: 'analyze', status: 'queued', progress: 0, message: 'Membaca bahan', timeline: [] } : out.document.jobs?.[0] || null));
      const refreshed = await api(`/chat/sessions/${targetSession.id}`);
      hydrate(refreshed);
      await waitForDocumentReady(out.document.id, targetSession.id);
      await loadDocuments();
    } catch (err) {
      try { hydrate(await api(`/chat/sessions/${targetSession.id}`)); } catch {}
      setNotice('Dokumen tetap diproses otomatis. Kamu boleh meninggalkan chat ini dan kembali lagi nanti.');
    } finally {
      setBusy(false);
    }
  };
  const performChatAction = async (type, payload = {}) => {
    if (!active || actionInFlightRef.current) return null;
    actionInFlightRef.current = true;
    setActionBusy(true);
    try {
      const data = await api(`/chat/sessions/${active.id}/actions`, {
        method: 'POST',
        body: {
          idempotencyKey: `${type.toLowerCase()}-${crypto.randomUUID()}`,
          type,
          payload: { ...payload, aiMode },
        },
      });
      hydrate(data);
      setSessions((items) => items.map((item) => item.id === data.session.id ? data.session : item));
      if (type === 'OPEN_SOURCE_UPLOAD') {
        setAttachmentKind(payload.sourceType === 'practice_evidence' ? 'practice_evidence' : payload.sourceType || '');
        window.requestAnimationFrame(() => uploadRef.current?.click());
      }
      if (data.autoGenerate) await createDocument(data.session);
      return data;
    } catch (err) {
      appendAssistantMessage(err.message);
      return null;
    } finally {
      actionInFlightRef.current = false;
      setActionBusy(false);
    }
  };
  const closeTutorial = async () => {
    setTutorialOpen(false);
    if (!tutorialFirstUse) return;
    setTutorialFirstUse(false);
    try {
      await api('/profile/onboarding', { method: 'POST', body: { dismissed: true } });
      await refreshSession();
    } catch (err) {
      setNotice(err.message);
    }
  };
  const documentAction = async (action, payload = {}) => {
    if (!active?.document_id) return;
    // Tanpa dialog konfirmasi: pengingat memeriksa dokumen sudah tampil permanen
    // di panel dokumen, dan quiz pemahaman tetap menjadi gerbang sebelum unduh.
    setBusy(true);
    try {
      const path = action === 'analyze'
        ? `/documents/${active.document_id}/analyze`
        : action === 'generate'
          ? `/documents/${active.document_id}/generate`
          : action === 'revise'
            ? `/documents/${active.document_id}/revise`
            : `/documents/${active.document_id}/export`;
      const body = action === 'export'
        ? { confirmReviewed: true }
        : action === 'revise'
          ? { instruction: payload.instruction }
          : {};
      const out = await api(path, { method: 'POST', body });
      setActiveJob({ id: out.jobId, type: action, status: 'queued', progress: 0, message: 'Masuk antrean', timeline: [] });
      const job = await waitForJob(out.jobId);
      if (job.status !== 'completed') throw new Error(job.errorMessage || job.message || 'Proses belum berhasil.');
      const nextDocument = await api(`/documents/${active.document_id}`);
      setDocumentState(nextDocument);
      setActiveJob(nextDocument.jobs?.find((item) => item.id === job.id) || job);
      if (['generate', 'revise'].includes(action) && active?.id) hydrate(await api(`/chat/sessions/${active.id}`));
      if (action === 'analyze') appendAssistantMessage('Bahan selesai dibaca. Laprakin melanjutkan pembuatan dokumen secara otomatis.');
      if (action === 'export') setNotice('DOCX siap diunduh.');
      return true;
    } catch (err) {
      if (['generate', 'revise'].includes(action) && active?.id) {
        try { hydrate(await api(`/chat/sessions/${active.id}`)); } catch (innerErr) { appendAssistantMessage(innerErr.message || err.message); }
      } else {
        appendAssistantMessage(err.message);
      }
      return false;
    } finally { setBusy(false); }
  };
  const restoreDocumentVersion = async (versionId) => {
    if (!active?.document_id || !versionId) return false;
    const confirmed = await showDialog({
      kind: 'confirm',
      title: 'Pulihkan versi dokumen?',
      message: 'Isi saat ini akan disimpan sebagai versi baru sebelum versi pilihan dipulihkan.',
      confirmLabel: 'Pulihkan versi',
    });
    if (!confirmed) return false;
    setBusy(true);
    try {
      await api(`/documents/${active.document_id}/versions/${versionId}/restore`, { method: 'POST', body: {} });
      const nextDocument = await api(`/documents/${active.document_id}`);
      setDocumentState(nextDocument);
      return true;
    } catch (err) {
      appendAssistantMessage(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const startDocumentQuiz = async () => {
    if (!active?.document_id) return null;
    setRightOpen(false);
    setDocumentOpen(true);
    setQuizMode(true);
    setBusy(true);
    try {
      return await api(`/documents/${active.document_id}/quiz`, { method: 'POST' });
    } catch (err) {
      setNotice(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const submitDocumentQuiz = async (attemptId, answers) => {
    if (!active?.document_id) return null;
    setBusy(true);
    try {
      const result = await api(`/documents/${active.document_id}/quiz/attempts/${attemptId}`, { method: 'POST', body: { answers } });
      const nextDocument = await api(`/documents/${active.document_id}`);
      setDocumentState(nextDocument);
      setNotice(result.passed ? `Nilai ${result.score}%. Download sudah terbuka.` : `Nilai ${result.score}%. Minimal ${result.passScore}%; kamu bisa coba lagi dengan soal baru.`);
      if (result.passed) setQuizMode(false);
      return result;
    } catch (err) {
      setNotice(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  // Satu klik menuntaskan seluruh alur: buat DOCX bila belum ada, lalu unduh.
  // Sebelumnya tombol memilih export berdasarkan content_signature dokumen
  // sekarang, sedangkan fungsi ini mengambil export ready mana saja, sehingga
  // saat keduanya tidak cocok fungsi berhenti diam-diam tanpa efek apa pun.
  const downloadBusyRef = useRef(false);
  const downloadExport = async () => {
    if (downloadBusyRef.current) return;
    downloadBusyRef.current = true;
    try {
      if (!active?.document_id) throw new Error('Dokumen belum tersedia.');
      const fileName = `${String(documentState?.title || 'laprak').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'laprak'}.docx`;
      await download(`/documents/${active.document_id}/download.docx`, fileName);
    } catch (err) {
      setNotice(err.message);
    } finally {
      downloadBusyRef.current = false;
    }
  };
  const logout = async () => { try { await api('/auth/logout', { method: 'POST' }); } catch {} clearCsrfToken(); await refreshSession(); navigate('/'); };
  const projectEntries = useMemo(() => {
    const grouped = groupsFromSessions(sessions.filter((item) => groupLabel(item) !== 'Belum dikelompokkan'));
    const pinnedKeys = new Set(projectPins.map((item) => normalizedCourseKey(item.projectKey || item.projectName)));
    return Object.entries(grouped)
      .map(([name, items]) => ({
        name,
        items: [...items].sort((a, b) => new Date(b.updated_at || b.updatedAt || 0) - new Date(a.updated_at || a.updatedAt || 0)),
        count: items.length,
        isPinned: pinnedKeys.has(normalizedCourseKey(name)),
        updatedAt: items.reduce((latest, item) => {
          const value = item.updated_at || item.updatedAt || item.created_at || item.createdAt || null;
          return !latest || (value && new Date(value) > new Date(latest)) ? value : latest;
        }, null),
      }))
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }, [sessions, projectPins]);
  const openProject = (name) => { closeMobileSidebar(); navigate(`/app/projects?project=${encodeURIComponent(name)}`); };
  const createProject = async () => {
    const name = await showDialog({ kind: 'prompt', title: 'Project baru', message: 'Beri nama untuk mengelompokkan chat dan dokumen terkait.', placeholder: 'Contoh: Praktikum Jaringan', confirmLabel: 'Buat project' });
    const clean = String(name || '').trim().slice(0, 100);
    if (!clean) { if (name !== null) setNotice('Project belum diberi nama.'); return; }
    const session = await createSession(false, {
      title: 'Chat baru',
      courseGroup: clean,
      configuration: { courseName: clean },
    });
    if (session) { setNotice('Project dibuat.'); openProject(clean); }
  };
  const createProjectChat = async (projectName, title = '') => {
    const cleanTitle = String(title || '').trim().slice(0, 120) || 'Chat baru';
    const session = await createSession(false, {
      title: cleanTitle,
      courseGroup: projectName,
      configuration: { courseName: projectName },
    });
    return session;
  };
  const navItems = [
    { key: 'chat', label: 'Chats', icon: MessageCircle },
    { key: 'projects', label: 'Projects', icon: FolderKanban },
    { key: 'documents', label: 'Dokumen', icon: FolderOpen },
  ];
  const workspacePlanLabel = billingPlan?.key === 'pro' ? 'Max' : billingPlan?.key === 'monthly' ? 'Pro' : 'Free plan';
  const hasSubscriptionPlan = ['monthly', 'pro'].includes(billingPlan?.key);
  const isMaxPlan = billingPlan?.key === 'pro';
  const headerSubtitle = active
    ? [workflow?.courseName || active.configuration?.courseName, workflow?.practiceTopic || active.configuration?.moduleTitle].filter(Boolean).join(' · ') || 'Konteks laprak belum diisi'
    : 'Mulai dengan teks, bahan, atau link yang kamu punya.';
  const workspaceAccent = resolveAccent(prefs.accent, resolvedTheme);
  const recordProductUpdate = async (action) => {
    if (!productUpdate) return;
    try { await api(`/product-updates/${productUpdate.id}/receipt`, { method: 'POST', body: { action } }); }
    catch { /* receipt failure does not interrupt user navigation */ }
  };
  const closeProductUpdate = async (action) => {
    if (action) await recordProductUpdate(action);
    setProductUpdate(null);
  };
  const reorderSidebarSession = async (source, target) => {
    const sourceIndex = sessions.findIndex((row) => row.id === source.id);
    const targetIndex = sessions.findIndex((row) => row.id === target.id);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const reordered = [...sessions];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    await persistOrder(reordered);
  };
  const sidebarGroupProps = {
    activeId: active?.id,
    page,
    onOpen: openSession,
    renamingId,
    setRenamingId,
    onRename: renameSession,
    draggingSession,
    setDraggingSession,
    folders: sessionFolders,
    onPin: setPinned,
    onMove: moveSessionToGroup,
    onArchive: archiveSession,
    onDelete: deleteSession,
    onDropSession: reorderSidebarSession,
  };
  const pinnedProjects = projectEntries.filter((project) => project.isPinned);
  const pinnedProjectKeys = new Set(pinnedProjects.map((project) => normalizedCourseKey(project.name)));
  const pinnedSessions = visibleRecentSessions.filter((item) => item.isPinned && !pinnedProjectKeys.has(normalizedCourseKey(groupLabel(item))));
  const recentGroups = Object.entries(groupsFromSessions(visibleRecentSessions.filter((item) => !item.isPinned && !pinnedProjectKeys.has(normalizedCourseKey(groupLabel(item))))));
  return <div className={`workspace ${leftCollapsed ? 'left-collapsed' : ''} ${rightOpen && page === 'chat' ? 'right-open' : ''} ${documentOpen && page === 'chat' ? 'document-open' : ''} ${resolvedTheme === 'dark' ? 'theme-dark' : ''} ${prefs.compact ? 'compact' : ''}`} data-motion={prefs.reducedMotion ? 'reduce' : 'full'} data-accent={workspaceAccent.key} data-contrast={prefs.contrast || 'default'} data-language={prefs.language || 'id'} style={{ '--workspace-orange': workspaceAccent.color, '--workspace-accent': workspaceAccent.color, '--workspace-accent-contrast': workspaceAccent.contrast, '--workspace-accent-ink': resolvedTheme === 'light' ? workspaceAccent.lightInk : workspaceAccent.color }}>
    <aside className="left-sidebar">
      <div className="sidebar-top">
        <Link to="/app" className="workspace-brand"><BrandMark /><b>Laprakin</b></Link>
        <IconButton className="sidebar-collapse-button" label={leftCollapsed ? 'Buka sidebar' : 'Minimalkan sidebar'} onClick={() => setLeftCollapsed(!leftCollapsed)}>{leftCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</IconButton>
      </div>
      <nav className="workspace-nav">{navItems.map(({ key, label, icon: Icon }) => <button key={key} className={page === key ? 'active' : ''} onClick={() => key === 'chat' ? startNewChat() : setRoute(key)} title={label}><Icon size={16} /><span>{label}</span></button>)}</nav>
      <div className="sidebar-session-scroll">
        {pinnedProjects.length || pinnedSessions.length ? <div className="pinned-session-block">
          <div className="session-section-title"><span>Pinned</span></div>
          {pinnedProjects.map((project) => <button type="button" className="pinned-project-row" key={normalizedCourseKey(project.name)} onClick={() => openProject(project.name)} title={project.name}><FolderKanban size={14}/><span>{project.name}</span><small>{project.count}</small></button>)}
          <div className="session-list"><SessionGroup group="Disematkan" items={pinnedSessions} {...sidebarGroupProps} onDropGroup={(session) => moveSessionToGroup(session, groupLabel(session))} /></div>
        </div> : null}
        <div className={`session-heading ${recentSearchOpen ? 'is-searching' : ''}`}>
           {recentSearchOpen ? <label className="recent-search-field"><Search size={13}/><input ref={recentSearchInputRef} value={recentSearchQuery} onChange={(event) => setRecentSearchQuery(event.target.value)} placeholder="Cari chat" aria-label="Cari chat terbaru" onKeyDown={(event) => { if (event.key === 'Escape') { setRecentSearchOpen(false); setRecentSearchQuery(''); } }} /><button type="button" aria-label="Tutup pencarian" onClick={() => { setRecentSearchOpen(false); setRecentSearchQuery(''); }}><X size={12}/></button></label> : <><span>Recents</span><button className="recent-search-trigger" type="button" title="Cari chat" aria-label="Cari chat" onClick={() => setRecentSearchOpen(true)}><Search size={13} /></button></>}
        </div>
        <div className="session-list">{recentGroups.map(([group, items]) => <SessionGroup key={normalizedCourseKey(group)} group={group} items={items} {...sidebarGroupProps} onDropGroup={(session) => moveSessionToGroup(session, group)} />)}</div>
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-support-actions">
          <button onClick={() => { closeMobileSidebar(); setModal('help'); }} title="Bantuan"><HelpCircle size={16} /><span>Bantuan</span></button>
          <button onClick={() => { closeMobileSidebar(); setModal('feedback'); }} title="Feedback"><MessageCircle size={16} /><span>Feedback</span></button>
          <button onClick={() => { closeMobileSidebar(); setModal('settings'); }} title="Settings"><Settings2 size={16} /><span>Settings</span></button>
        </div>
    <div className="account-row"><button onClick={() => setAccountOpen(!accountOpen)} title="Menu akun"><span>{userInitials(user)}</span><div><b>{user.fullName || user.email.split('@')[0]}</b><small>{wallet?.balances?.total || 0} laprak tersedia</small></div><ChevronRight size={14} /></button></div>
      </div>
    </aside>
    {accountOpen && <AccountPopover showUpgrade={!isMaxPlan} onClose={() => setAccountOpen(false)} onOpen={(target) => { closeMobileSidebar(); setAccountOpen(false); if (target === 'billing') navigate('/pricing'); else setModal(target); }} onLogout={logout} />}
    {!leftCollapsed && <button className="mobile-scrim" aria-label="Tutup navigasi" onClick={() => setLeftCollapsed(true)} />}
    <IconButton className="mobile-nav-toggle" label="Buka navigasi" onClick={() => setLeftCollapsed(false)}><Menu size={17} /></IconButton>
    <main className="workspace-main">
      {page === 'chat' && <>
        <header className="workspace-header"><div className={`header-title ${active ? '' : 'is-empty'}`}><b>{active?.title || 'Chat Laprakin'}</b><small>{headerSubtitle}</small></div>{!hasSubscriptionPlan && <button className="workspace-plan" onClick={() => navigate('/pricing')} title="Buka billing"><span>{workspacePlanLabel}</span><i>?</i><b>Upgrade</b></button>}<div className="header-actions"><button className={`header-config-button ${rightOpen ? 'active' : ''}`} aria-label="Konfigurasi chat" title="Konfigurasi chat" onClick={() => { setDocumentOpen(false); setRightOpen((value) => !value); }}><SlidersHorizontal size={15} /><span>Konfigurasi</span></button><IconButton label="Buka tutorial" className="tutorial-button" onClick={() => { setTutorialFirstUse(false); setTutorialOpen(true); }}><HelpCircle size={16} /></IconButton><IconButton label={prefs.theme === 'system' ? 'Tema mengikuti sistem' : resolvedTheme === 'dark' ? 'Gunakan mode terang' : 'Gunakan dark mode'} className="theme-button" onClick={() => setPrefs((value) => ({ ...value, theme: value.theme === 'system' ? (resolvedTheme === 'dark' ? 'light' : 'dark') : value.theme === 'dark' ? 'light' : 'system' }))}>{prefs.theme === 'system' ? <Monitor size={16} /> : resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</IconButton><IconButton label="Notifikasi" onClick={() => setModal('notifications')}><Bell size={16} /></IconButton></div></header>
        <ChatSurface active={active} messages={messages} attachments={attachments} documentState={documentState} workflow={workflow} activeJob={activeJob} user={user} input={input} setInput={setInput} busy={busy || actionBusy} attachmentKind={attachmentKind} setAttachmentKind={setAttachmentKind} uploadRef={uploadRef} send={send} upload={upload} removeAttachment={removeAttachment} updateAttachmentCategory={updateAttachmentCategory} createDocument={createDocument} onWorkflowAction={performChatAction} contextOpen={contextOpen} setContextOpen={setContextOpen} config={config} updateConfig={updateConfig} pendingFiles={pendingLandingFiles} onPasteImages={pasteImagesIntoChat} onAddPendingFiles={addPendingFiles} onRemovePending={(index) => setPendingLandingFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))} aiMode={aiMode} setAiMode={setAiMode} aiModeAccess={aiModeAccess} onUpgrade={() => navigate('/pricing')} onOpenDocument={() => { setRightOpen(false); setDocumentOpen(true); }} quizMode={quizMode} onCloseQuiz={() => setQuizMode(false)} onStartQuiz={startDocumentQuiz} onSubmitQuiz={submitDocumentQuiz} editingMessage={editingMessage} onEditMessage={(message) => { const editable = getEditableMessage(messages, message.id); if (!editable) return; setEditingMessageId(editable.id); setInput(editable.content || ''); }} onCancelEdit={() => { setEditingMessageId(null); setInput(''); }} onRevise={reviseChatMessage} />
      </>}
      {page === 'documents' && <DocumentLibrary documents={documents} onRefresh={loadDocuments} onOpen={(doc) => { const session = sessions.find((item) => item.document_id === doc.id); if (session) openSession(session.id); else setNotice('Dokumen ini belum memiliki ruang chat yang bisa dibuka.'); }} />}
    {page === 'projects' && <ProjectsPage
      projects={projectEntries}
      selectedProject={projectParam}
      documents={documents}
      onOpenProject={openProject}
      onBack={() => navigate('/app/projects')}
      onCreate={createProject}
      onNewChat={createProjectChat}
      onOpenSession={openSession}
      onPinProject={setProjectPinned}
      onNotice={setNotice}
    />}</main>
    {page === 'chat' && <aside className={`right-config ${documentOpen ? 'right-document' : ''}`}>
      {documentOpen
        ? <DocumentSidePanel documentState={documentState} activeJob={activeJob} workflow={workflow} busy={busy || actionBusy} user={user} onClose={() => setDocumentOpen(false)} onAction={documentAction} onDownload={downloadExport} onRestoreVersion={restoreDocumentVersion} onStartQuiz={startDocumentQuiz} onSubmitQuiz={submitDocumentQuiz} />
        : <div className="config-inner">
          <div className="right-head"><div><b>Konfigurasi chat</b><small>{pendingConfigRequest ? 'Lengkapi sebelum AI mulai bekerja.' : 'Hanya untuk laprak ini.'}</small></div><IconButton label="Tutup konfigurasi" onClick={() => setRightOpen(false)}><PanelRightClose size={16} /></IconButton></div>
          {(active || pendingConfigRequest?.session) ? <>
            <div className="right-body">
              {pendingConfigRequest && <div className="config-required-note"><CircleAlert size={16} /><div><b>Konteks wajib diisi</b><p>AI baru memproses prompt setelah mata kuliah dan materi disimpan.</p></div></div>}
              {!pendingConfigRequest && <label>Nama chat<input aria-label="Nama chat" value={config.title} onChange={(event) => updateConfig({ title: event.target.value })} /></label>}
              <label>Mata kuliah <small>wajib</small><input aria-label="Mata kuliah" required value={config.configuration.courseName} onChange={(event) => updateConfig({ configuration: { courseName: event.target.value } })} placeholder="Contoh: Jaringan Komputer" /></label>
              <label>Modul atau materi <small>wajib</small><input aria-label="Modul atau materi" required value={config.configuration.moduleTitle} onChange={(event) => updateConfig({ configuration: { moduleTitle: event.target.value } })} placeholder="Contoh: Routing Protocol" /></label>
              <label>Dosen pengampu <small>opsional</small><input aria-label="Dosen pengampu" value={config.configuration.lecturerName || ''} onChange={(event) => updateConfig({ configuration: { lecturerName: event.target.value } })} placeholder="Nama dosen" /></label>
              <label>NIP dosen <small>opsional</small><input aria-label="NIP dosen" value={config.configuration.lecturerNip || ''} onChange={(event) => updateConfig({ configuration: { lecturerNip: event.target.value } })} placeholder="NIP jika ada" /></label>
              <label htmlFor="config-document-profile">Jenis struktur<CustomSelect id="config-document-profile" ariaLabel="Jenis struktur" value={config.configuration.documentProfile} onChange={(value) => updateConfig({ configuration: { documentProfile: value } })} options={[{ value: 'langkah', label: 'Berbasis langkah' }, { value: 'pengujian', label: 'Berbasis pengujian' }, { value: 'proyek', label: 'Berbasis proyek' }]} /></label>
              <div className="structure-choice"><button className={config.structureMode === 'guided' ? 'active' : ''} onClick={() => updateConfig({ structureMode: 'guided' })}><LayoutTemplate size={15} /><span><b>Struktur prodi</b><small>Dipakai otomatis.</small></span></button><button className={config.structureMode === 'custom' ? 'active' : ''} onClick={() => updateConfig({ structureMode: 'custom' })}><SlidersHorizontal size={15} /><span><b>Struktur khusus</b><small>Hanya bila tugas berbeda.</small></span></button></div>
               {config.structureMode === 'custom' && <label>Susunan bagian<textarea aria-label="Susunan bagian" value={config.configuration.customStructure} onChange={(event) => updateConfig({ configuration: { customStructure: event.target.value } })} placeholder="Pendahuluan, hasil, pembahasan, kesimpulan" /></label>}
               <label>Instruksi tambahan<textarea aria-label="Instruksi tambahan" value={config.configuration.instructions} onChange={(event) => updateConfig({ configuration: { instructions: event.target.value } })} placeholder="Contoh: fokus ke analisis hasil." /></label>
            </div>
            <div className="right-foot"><Button onClick={saveConfig} disabled={busy}><Save size={14} />{pendingConfigRequest ? 'Simpan & mulai' : 'Simpan'}</Button><small>Mata kuliah dan materi disimpan persis dari isianmu, bukan ditebak AI.</small></div>
          </> : <div className="empty-config"><PanelRightOpen size={20} /><b>Belum ada chat aktif.</b><p>Kirim prompt untuk membuka konfigurasi awal.</p></div>}
        </div>}
    </aside>}
    {SETTINGS_MODAL_TABS[modal] && <SettingsModal initialTab={SETTINGS_MODAL_TABS[modal]} onClose={() => setModal(null)} onSaved={refreshSession} onArchivedChanged={loadSessions} onOpenBilling={() => { setModal(null); navigate('/pricing'); }} prefs={prefs} setPrefs={setPrefs} />}{modal === 'help' && <HelpModal onClose={() => setModal(null)} />}{modal === 'feedback' && <FeedbackModal onClose={() => setModal(null)} />}{modal === 'notifications' && <NotificationModal onClose={() => setModal(null)} />}{identityIntake && <IdentityIntakeModal user={user} busy={busy} onSave={completeIdentityIntake} onBack={() => setIdentityIntake(null)} />}{tutorialOpen && <WorkspaceTutorial onClose={closeTutorial} />}{productUpdate && <ProductUpdatePopup update={productUpdate} onReceipt={recordProductUpdate} onClose={closeProductUpdate} />}
  </div>;
}

createRoot(document.getElementById('root')).render(<BrowserRouter><App /></BrowserRouter>);
