import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from './router';
import { Component, Fragment, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, ArrowDownToLine, ArrowLeft, ArrowRight, Bell, Check, CheckCircle2, ChevronDown, CircleAlert,
  CodeXml, CreditCard, FileText, FolderOpen, FolderKanban, Globe2, GraduationCap, HelpCircle, LayoutTemplate, LoaderCircle, Mail, Search,
  LockKeyhole, LogOut, Menu, MessageCircle, Moon, Paperclip, PanelLeftClose,
  PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus, Save, Send, Settings2,
  ShieldCheck, SlidersHorizontal, Sparkles, Sun, Trash2, UploadCloud, X,
  ChevronRight, Database, Eye, GripVertical, Keyboard, MoreHorizontal, Pencil, Pin, PinOff, UserRound, Volume2, BellRing, Shield, Sliders, Monitor, Palette, Languages, CircleUserRound, LogOut as LogOutIcon, LayoutDashboard, Users, AlertTriangle, ClipboardList, Megaphone, RefreshCw, MessageSquareText, Activity, FileCog,
  Copy, ThumbsDown, ThumbsUp, Upload,
} from 'lucide-react';
import { api, apiStream, clearCsrfToken, download, setCsrfToken } from './api';
import { buildRevisionRequest, getEditableMessage, getRegenerationTarget } from './lib/chat-message-actions';
import { canonicalCourseLabel, courseAcronym, courseTokens, editDistance, normalizedCourseKey } from './lib/academic';
import { formatBytes, formatCurrency, formatDate } from './lib/formatters';
import { resolveTheme, useResolvedTheme } from './lib/theme';
import { departments, programs } from './data';
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
import { useFocusReturn } from './hooks/useFocusReturn';
import { useFocusTrap } from './hooks/useFocusTrap';
import { createTranslator } from './i18n';
import { translateUiText } from './i18n/legacy';
import { I18nContext } from './i18n/context';
import { FeatureUpdatesAdmin, ProductUpdatePopup } from './FeatureUpdates';
import { ChatSessionRow, SessionGroup } from './pages/Workspace/Sidebar/ChatSessionRow';
import AccountPopover from './pages/Workspace/Sidebar/AccountPopover';
import { renderAsync as renderDocx } from 'docx-preview';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const LandingRoutePage = loadPage(() => import('./pages/Landing/LandingPage'));
const AuthPageModule = loadPage(() => import('./pages/Auth/AuthPage'));
const AdminWorkspaceBoundary = loadPage(() => import('./pages/Admin/AdminWorkspace'));
const AdminMfaGate = loadPage(() => import('./pages/Admin/AdminMfaGate'));
const WorkspaceBoundary = loadPage(() => import('./pages/Workspace/Workspace'));
const StatusPage = loadPage(() => import('./pages/Status/StatusPage'));

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

function userInitials(user) {
  const source = String(user?.fullName || user?.email || 'Laprakin').trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase().slice(0, 2) || 'L';
}

function userGreetingName(user) {
  const nickname = String(user?.nickname || '').trim();
  if (nickname) return nickname;
  const fullName = String(user?.fullName || '').trim();
  if (fullName) return fullName.split(/\s+/)[0];
  return String(user?.email || 'kamu').split('@')[0].split(/[._-]+/)[0] || 'kamu';
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
const pricingFallback = {
  free: { credits: 2, durationDays: 60, revisionsPerReport: 3, storageMb: 100, features: ['2 credit awal', '3 revisi per laprak', '100 MB penyimpanan'] },
  single: { unitPrice: 3900, minQuantity: 1, maxQuantity: 20, credits: 1, durationDays: 180, revisionsPerReport: 5, storageMb: 500, features: ['Tanpa subscription', '5 revisi per laprak', 'Aktif hingga 180 hari'] },
  monthly: { price: 29900, credits: 12, durationDays: 30, revisionsPerReport: 5, storageMb: 1024, storageGb: 1, features: ['12 credit / 30 hari', 'Mode Thinking terbuka', '1 GB penyimpanan'] },
  pro: { price: 45900, credits: 20, durationDays: 30, revisionsPerReport: 15, storageMb: 5120, storageGb: 5, features: ['20 credit / 30 hari', 'Mode XtraThink terbuka', '5 GB penyimpanan'] },
};
function pricingFeatures(plan, fallback) {
  return Array.isArray(plan?.features) ? plan.features : fallback;
}
const defaultPrefs = {
  theme: 'system', language: 'id', compact: true, reducedMotion: false, enterToSend: true,
  tone: 'formal', perspective: 'saya', profile: 'langkah', customInstructions: '', accent: 'lime', productUpdates: true, allowExternalAi: true,
};
const workspaceAccents = [
  { key: 'lime', label: 'Lime', color: '#c2ff33', contrast: '#101506', lightInk: '#4d7000' },
  { key: 'orange', label: 'Oranye', color: '#ff8a4c', contrast: '#211006', lightInk: '#a33c00' },
  { key: 'blue', label: 'Biru', color: '#78a9ff', contrast: '#07111f', lightInk: '#2455a4' },
  { key: 'violet', label: 'Ungu', color: '#b69cff', contrast: '#130d22', lightInk: '#6243a7' },
  { key: 'coral', label: 'Koral', color: '#ff9b7b', contrast: '#24100a', lightInk: '#9b3c24' },
  { key: 'amber', label: 'Amber', color: '#f3c969', contrast: '#211704', lightInk: '#765500' },
  { key: 'gray', label: 'Abu-abu', color: '#b9bab6', contrast: '#111210', lightInk: '#50514d' },
];

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

const DARK_ONLY_ACCENTS = new Set(['amber']);
const LIGHT_FALLBACK_ACCENT = 'gray';

/**
 * Aksen yang benar-benar dirender. Preferensi user tidak pernah ditulis ulang,
 * sehingga pilihan aslinya kembali begitu tema gelap dipakai lagi.
 */
function resolveAccent(accentKey, resolvedTheme) {
  const requested = workspaceAccents.find((item) => item.key === accentKey) || workspaceAccents[0];
  if (resolvedTheme !== 'light' || !DARK_ONLY_ACCENTS.has(requested.key)) return requested;
  return workspaceAccents.find((item) => item.key === LIGHT_FALLBACK_ACCENT) || requested;
}

function noticeToneFor(value) {
  const text = String(value || '').toLocaleLowerCase('id-ID');
  return /gagal|error|belum|tidak|ditolak|habis|invalid|kesalahan|dibatalkan|kadaluwarsa|terjadi/.test(text)
    ? 'negative'
    : 'positive';
}

const defaultChatConfig = {
  title: 'Laprak baru',
  structureMode: 'guided',
  configuration: { courseName: '', moduleTitle: '', lecturerName: '', lecturerNip: '', documentProfile: 'langkah', customStructure: '', instructions: '', tone: 'formal', perspective: 'saya', allowExternalAi: true },
};
const previewTestimonials = [
  { quote: '“Saya baru ingin lihat bentuk ulasannya dulu. Nantinya kutipan asli hanya tampil setelah pengguna menyetujui publikasi.”', name: 'Preview ulasan beta', label: 'Bukan testimoni pengguna' },
  { quote: '“Ulasan yang dipublikasikan akan memakai alias. Email, NIM, dan bahan praktikum tidak ditampilkan.”', name: 'Privasi diutamakan', label: 'Bukan testimoni pengguna' },
  { quote: '“Struktur ini sengaja ringkas supaya calon pengguna dapat membaca pengalaman orang lain tanpa terasa seperti iklan.”', name: 'Format transparan', label: 'Bukan testimoni pengguna' },
];

const LANDING_DRAFT_KEY = 'laprakin-landing-draft';
function openLandingDraftDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('laprakin-landing-drafts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function saveLandingDraft(prompt, files = []) {
  sessionStorage.setItem(LANDING_DRAFT_KEY, prompt || '');
  try { const db = await openLandingDraftDb(); const tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put(files, 'pending'); await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close(); } catch { /* prompt still survives even if browser blocks IndexedDB */ }
}
async function takeLandingDraft() {
  const prompt = sessionStorage.getItem(LANDING_DRAFT_KEY) || '';
  sessionStorage.removeItem(LANDING_DRAFT_KEY);
  let files = [];
  try { const db = await openLandingDraftDb(); const tx = db.transaction('drafts', 'readwrite'); const request = tx.objectStore('drafts').get('pending'); files = await new Promise((resolve) => { request.onsuccess = () => resolve(request.result || []); request.onerror = () => resolve([]); }); tx.objectStore('drafts').delete('pending'); db.close(); } catch { /* no local files */ }
  return { prompt, files };
}

function isImageFile(file) { return Boolean(file?.type?.startsWith('image/')); }
function fileKey(file) { return `${file?.name || 'file'}:${file?.size || 0}:${file?.lastModified || 0}`; }
function mergeFiles(existing = [], incoming = []) {
  const keys = new Set(existing.map(fileKey));
  return [...existing, ...incoming.filter((file) => file && !keys.has(fileKey(file)))];
}
function clipboardImageFiles(event) {
  const items = Array.from(event.clipboardData?.items || []);
  return items
    .filter((item) => item.type?.startsWith('image/'))
    .map((item, index) => {
      const blob = item.getAsFile();
      if (!blob) return null;
      const ext = blob.type.split('/')[1] || 'png';
      return new File([blob], `gambar-clipboard-${Date.now()}-${index + 1}.${ext}`, { type: blob.type || 'image/png' });
    })
    .filter(Boolean);
}
function LocalFilePreview({ file, className = '' }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (!isImageFile(file)) { setSrc(''); return undefined; }
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return src ? <img className={className} src={src} alt="Preview lampiran" /> : <FileText size={12} />;
}
function HeroFileChip({ file, index, onRemove }) {
  return <span className={`hero-file-chip ${isImageFile(file) ? 'has-image' : ''}`}>
    <span className="hero-file-thumb"><LocalFilePreview file={file} /></span>
    <b>{file.name}</b>
    <button type="button" aria-label={`Hapus ${file.name}`} onClick={() => onRemove(index)}><X size={11} /></button>
  </span>;
}

function readPrefs() {
  try { return { ...defaultPrefs, ...JSON.parse(localStorage.getItem('laprakin-preferences') || '{}') }; }
  catch { return defaultPrefs; }
}

function Toggle({ checked, onChange, title, description }) {
  return <label className="toggle-control"><input type="checkbox" aria-label={title} checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="toggle-dot" /><span><b>{title}</b>{description && <small>{description}</small>}</span></label>;
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
  return <AppErrorBoundary resetKey={location.pathname}><AppProvider><I18nRuntime><Suspense fallback={<LoadingScreen />}><div className="route-transition"><Routes><Route path="/" element={<LandingRoutePage />} /><Route path="/status" element={<StatusPage />} /><Route path="/auth" element={<AuthPageModule />} /><Route path="/privacy" element={<LegalPage type="privacy" />} /><Route path="/terms" element={<LegalPage type="terms" />} /><Route path="/pricing" element={<PublicPricingPage />} /><Route path="/checkout" element={<PublicPricingPage />} /><Route path="/billing" element={<PricingRedirect />} /><Route path="/app/billing" element={<PricingRedirect />} /><Route path="/admin/*" element={<ProtectedAdmin />} /><Route path="/app/*" element={<ProtectedApp />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></div></Suspense></I18nRuntime></AppProvider></AppErrorBoundary>;
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

function TutorialVideo({ media = {}, copy = {} }) {
  const sectionRef = useRef(null);
  const videoRef = useRef(null);
  const videoUrl = media?.tutorialVideoUrl || '';
  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    if (!section || !video || !videoUrl || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      });
    }, { threshold: 0.42 });
    observer.observe(section);
    return () => observer.disconnect();
  }, [videoUrl]);
  return <section id="tutorial" className="landing-section tutorial-section tutorial-video-section landing-reveal" ref={sectionRef}>
    <div className="section-copy split"><div><span className="section-index">03</span><h2>{copy.tutorialTitle || 'Lihat alurnya dalam satu video.'}</h2><p>{copy.tutorialSubtitle || 'Video diputar otomatis saat bagian ini terlihat di layar.'}</p></div></div>
    <article className="tutorial-video-frame">
      {videoUrl ? <video ref={videoRef} src={videoUrl} poster={media?.tutorialVideoPosterUrl || undefined} muted loop playsInline preload="metadata" aria-label="Video tutorial Laprakin" /> : <div className="tutorial-video-empty"><span className="video-placeholder-index">03</span><Volume2 size={28} /><b>Ruang video siap dipakai.</b><p>Video showcase Laprakin dapat kamu unggah nanti dari CMS Landing.</p><span className="video-placeholder-caption">VIDEO PLACEHOLDER · MP4 / WEBM</span></div>}
      {videoUrl && <div className="tutorial-video-overlay"><span>Video tutorial</span><small>Diputar saat section terlihat</small></div>}
    </article>
  </section>;
}

function CompareLinkedPreview({ media = {} }) {
  const url = media?.compareMediaUrl || '';
  const isPdf = media?.compareMediaType === 'pdf' || /\.pdf(?:$|\?)/i.test(url);
  if (!url) return <div className="laprakin-window compare-document-fallback"><div className="attachment-row"><FileText size={14} /><span>modul-routing.pdf</span><Check size={13} /></div><div className="attachment-row"><FileText size={14} /><span>bukti-praktik.docx · 12 gambar</span><Check size={13} /></div><div className="doc-mini"><small>Dokumen kerja</small><b>Routing Protocol</b><div><span className="done">Bahan dibaca</span><span>Dokumen disusun</span><span>Word siap</span></div></div></div>;
  return <div className={`compare-linked-preview ${isPdf ? 'pdf' : 'image'}`}><div className="compare-scroll-stage">{isPdf ? <iframe src={`${url}#toolbar=0&navpanes=0&scrollbar=0`} title="Preview PDF landing" /> : <img src={url} alt={media?.compareCaption || 'Preview bahan Laprakin'} />}</div><div className="compare-scroll-hint"><span>{isPdf ? 'Preview PDF' : 'Preview WEBP / gambar'}</span><small>Hover untuk melihat bagian bawah</small></div></div>;
}

function TutorialCarousel({ media = {}, copy = {} }) {
  const fallbackSlides = [
    { id: 'fallback-1', title: 'Hubungkan sumber', text: 'Tambahkan modul, artikel, atau bukti praktik ke ruang kerja yang sama.', imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=80', alt: 'Laptop dan catatan belajar' },
    { id: 'fallback-2', title: 'Rapikan konteks', text: 'Tambahkan mata kuliah dan arahan dosen hanya bila memang dibutuhkan.', imageUrl: 'https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=1600&q=80', alt: 'Dokumen dan meja belajar' },
    { id: 'fallback-3', title: 'Cek sebelum export', text: 'Review isi draft, lakukan revisi, lalu buat DOCX editable.', imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80', alt: 'Mahasiswa berdiskusi' },
  ];
  const slides = media?.tutorialSlides?.length ? media.tutorialSlides : fallbackSlides;
  const [index, setIndex] = useState(0);
  const dragStart = useRef(null);
  const current = slides[index] || slides[0];
  const go = (step) => setIndex((value) => (value + step + slides.length) % slides.length);
  const pointerDown = (event) => { dragStart.current = event.clientX; event.currentTarget.setPointerCapture?.(event.pointerId); };
  const pointerUp = (event) => { if (dragStart.current == null) return; const distance = event.clientX - dragStart.current; dragStart.current = null; if (Math.abs(distance) > 38) go(distance < 0 ? 1 : -1); };
  return <section id="tutorial" className="landing-section tutorial-section landing-reveal"><div className="section-copy split"><div><span className="section-index">03</span><h2>{copy.tutorialTitle || 'Tiga langkah, satu alur.'}</h2><p>{copy.tutorialSubtitle || 'Geser gambar atau gunakan navigasi langsung di dalam gambar.'}</p></div></div><article className="tutorial-frame"><div className="tutorial-image-wrap" onPointerDown={pointerDown} onPointerUp={pointerUp}>{current.imageUrl ? <img key={current.imageUrl} src={current.imageUrl} alt={current.alt || current.title} onError={(event) => event.currentTarget.classList.add('image-fallback')} /> : <div className="tutorial-placeholder">Gambar tutorial belum dipilih di CMS.</div>}<div className="tutorial-image-overlay" /><button className="tutorial-image-nav previous" onClick={() => go(-1)} aria-label="Tutorial sebelumnya">←</button><button className="tutorial-image-nav next" onClick={() => go(1)} aria-label="Tutorial selanjutnya">→</button><div className="tutorial-image-count">{String(index + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</div></div><div className="tutorial-caption"><small>Langkah {index + 1}</small><h3>{current.title}</h3><p>{current.text}</p><div className="tutorial-dots">{slides.map((slide, dotIndex) => <button key={slide.id || slide.title} className={dotIndex === index ? 'active' : ''} onClick={() => setIndex(dotIndex)} aria-label={`Buka tutorial ${dotIndex + 1}`} />)}</div></div></article></section>;
}

function ProtectedApp() { const { loading, user } = useApp(); if (loading) return <LoadingScreen />; if (!user) return <Navigate to="/auth" replace />; if (user.role === 'admin') return <Navigate to="/admin" replace />; return <WorkspaceBoundary><LegacyWorkspace /></WorkspaceBoundary>; }

function PublicPricingPage() {
  const { user, prefs, setNotice, refreshSession } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const isCheckoutPage = location.pathname === '/checkout';
  const resolvedTheme = useResolvedTheme(prefs.theme || 'system');
  const params = new URLSearchParams(location.search);
  const normalizePlan = (value) => value === 'single' ? 'credit' : ['credit', 'monthly', 'pro'].includes(value) ? value : '';
  const requestedPlan = normalizePlan(params.get('plan') || '');
  const requestedQty = Math.max(1, Math.min(20, Number(params.get('quantity') || 1) || 1));
  const [pricing, setPricing] = useState(pricingFallback);
  const [billing, setBilling] = useState(null);
  const [gateway, setGateway] = useState(null);
  const [selected, setSelected] = useState(requestedPlan);
  const [creditQuantity, setCreditQuantity] = useState(requestedQty);
  const [quote, setQuote] = useState(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [checkoutRecoveryUrl, setCheckoutRecoveryUrl] = useState('');
  const [error, setError] = useState('');
  const paymentReturn = params.get('payment') || '';

  const loadPricing = useCallback(async () => {
    try {
      const nextPricing = await api('/pricing', { includeCsrf: false });
      setPricing(nextPricing || pricingFallback);
      if (!user) {
        setBilling(null);
        setGateway(null);
        return;
      }
      const [nextBilling, paymentConfig] = await Promise.all([
        api('/billing'),
        api('/payments/config', { includeCsrf: false }),
      ]);
      setBilling(nextBilling);
      setGateway(paymentConfig);
      const pending = (nextBilling.orders || []).find((order) => ['created', 'pending'].includes(order.status));
      if (pending) setActiveOrder((current) => current?.id === pending.id ? current : { ...pending, canRefresh: true });
    } catch (err) {
      setError(err.message);
    }
  }, [user]);

  useEffect(() => { loadPricing(); }, [loadPricing]);
  useEffect(() => { setSelected(requestedPlan); }, [requestedPlan]);
  useEffect(() => { setCreditQuantity(requestedQty); }, [requestedQty]);
  useEffect(() => {
    if (!['canceled', 'cancelled', 'failed', 'error'].includes(paymentReturn)) return;
    window.sessionStorage.removeItem('laprakin:active-payment-order');
    if (location.pathname !== '/pricing' || location.search) navigate('/pricing', { replace: true });
  }, [paymentReturn, location.pathname, location.search, navigate]);

  const cartItems = useMemo(() => {
    if (!selected) return [];
    return [{ sku: selected, quantity: selected === 'credit' ? creditQuantity : 1 }];
  }, [selected, creditQuantity]);
  const cartKey = cartItems.map((item) => `${item.sku}:${item.quantity}`).join('|');

  useEffect(() => {
    let cancelled = false;
    if (!user || !cartItems.length) {
      setQuote(null);
      return undefined;
    }
    setQuoteBusy(true);
    api('/pricing/quote', { method: 'POST', body: { items: cartItems } })
      .then((next) => { if (!cancelled) setQuote(next); })
      .catch((err) => { if (!cancelled) { setQuote(null); setError(err.message); } })
      .finally(() => { if (!cancelled) setQuoteBusy(false); });
    return () => { cancelled = true; };
  }, [user, cartKey]);

  const currentPlanKey = billing?.currentPlan?.key || 'free';
  const maxCreditQty = pricing.single?.maxQuantity || 20;
  const cards = [
    {
      key: 'free', label: 'Free', note: 'Mulai tanpa biaya', price: 'Rp0', suffix: '',
      features: pricingFeatures(pricing.free, pricingFallback.free.features),
    },
    {
      key: 'credit', label: 'Satuan', note: 'Bayar sesuai kebutuhan', price: formatCurrency(pricing.single?.unitPrice || 3900), originalPrice: formatCurrency(pricing.single?.originalPrice || pricing.single?.unitPrice || 3900), discountPercent: pricing.single?.discountPercent || 0, suffix: '/ laprak',
      features: pricingFeatures(pricing.single, pricingFallback.single.features),
    },
    {
      key: 'monthly', label: 'Pro', note: 'Untuk laprak harian', recommended: true, price: formatCurrency(pricing.monthly?.price || 29900), originalPrice: formatCurrency(pricing.monthly?.originalPrice || pricing.monthly?.price || 29900), discountPercent: pricing.monthly?.discountPercent || 0, suffix: '/ 30 hari',
      features: pricingFeatures(pricing.monthly, pricingFallback.monthly.features),
    },
    {
      key: 'pro', label: 'Max', note: 'Untuk semester padat', price: formatCurrency(pricing.pro?.price || 45900), originalPrice: formatCurrency(pricing.pro?.originalPrice || pricing.pro?.price || 45900), discountPercent: pricing.pro?.discountPercent || 0, suffix: '/ 30 hari',
      features: pricingFeatures(pricing.pro, pricingFallback.pro.features),
    },
  ];

  const updateSelectedUrl = (key, quantity = creditQuantity) => {
    const query = new URLSearchParams();
    query.set('plan', key);
    if (key === 'credit') query.set('quantity', String(quantity));
    navigate(`${isCheckoutPage ? '/checkout' : '/pricing'}?${query.toString()}`, { replace: true });
  };

  const selectProduct = (key) => {
    if (key === 'free') {
      navigate(user ? '/app' : '/auth');
      return;
    }
    if (!user) {
      const query = new URLSearchParams();
      query.set('plan', key);
      if (key === 'credit') query.set('quantity', String(creditQuantity));
      const next = `/checkout?${query.toString()}`;
      navigate(`/auth?next=${encodeURIComponent(next)}`);
      return;
    }
    setError('');
    setSelected(key);
    const query = new URLSearchParams();
    query.set('plan', key);
    if (key === 'credit') query.set('quantity', String(creditQuantity));
    navigate(`/checkout?${query.toString()}`);
  };

  const updateCreditQuantity = (nextQuantity) => {
    const next = Math.max(1, Math.min(maxCreditQty, Number(nextQuantity) || 1));
    setCreditQuantity(next);
    if (selected === 'credit') updateSelectedUrl('credit', next);
  };

  const updateOrder = async (order, notice = '') => {
    setActiveOrder(order);
    if (order?.id && ['created', 'pending'].includes(order.status)) window.sessionStorage.setItem('laprakin:active-payment-order', order.id);
    if (order?.id && ['paid', 'failed', 'expired', 'canceled', 'refunded'].includes(order.status)) window.sessionStorage.removeItem('laprakin:active-payment-order');
    if (order?.status === 'paid') {
      await refreshSession();
      await loadPricing();
      setNotice(notice || 'Pembayaran QRIS berhasil diverifikasi. Produk sudah aktif.');
      navigate('/app', { replace: true });
    }
  };

  const refreshOrder = async (orderId, verifyWithGateway = true) => {
    try {
      setBusy(verifyWithGateway);
      const response = verifyWithGateway
        ? await api(`/payments/orders/${orderId}/refresh`, { method: 'POST', body: {} })
        : await api(`/payments/orders/${orderId}`, { includeCsrf: false });
      await updateOrder(response.order, verifyWithGateway && response.order?.status === 'paid' ? 'Pembayaran QRIS berhasil diverifikasi.' : 'Status pembayaran diperbarui.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const orderId = window.sessionStorage.getItem('laprakin:active-payment-order');
    if (!user || !orderId) return;
    const returned = new URLSearchParams(window.location.search).get('payment') === 'finished';
    refreshOrder(orderId, returned);
  }, [user]);

  useEffect(() => {
    if (!activeOrder?.id || !['created', 'pending'].includes(activeOrder.status)) return undefined;
    const timer = window.setInterval(() => refreshOrder(activeOrder.id, false), 10_000);
    return () => window.clearInterval(timer);
  }, [activeOrder?.id, activeOrder?.status]);

  const checkout = async () => {
    if (!user) return selectProduct(selected || 'monthly');
    if (!cartItems.length) return setError('Pilih plan atau credit terlebih dahulu.');
    if (!user.emailVerified) return setError('Verifikasi email sebelum melakukan pembayaran.');
    setBusy(true);
    setError('');
    setCheckoutRecoveryUrl('');
    try {
      const payload = await api('/payments/checkout', { method: 'POST', body: { items: cartItems } });
      if (payload.mode === 'manual') {
        await updateOrder(payload.order, 'Checkout QRIS lokal diproses untuk pengujian.');
        return;
      }
      await updateOrder(payload.order);
      window.sessionStorage.setItem('laprakin:active-payment-order', payload.orderId);
      const checkoutUrl = validatedMidtransCheckoutUrl(payload.checkoutUrl);
      if (!checkoutUrl) {
        throw new Error('URL checkout QRIS dari gateway tidak valid.');
      }
      setCheckoutRecoveryUrl(checkoutUrl);
      if (!redirectToMidtransCheckout(checkoutUrl)) {
        throw new Error('Navigasi otomatis diblokir browser. Buka checkout QRIS lewat tombol di bawah.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const statusCopy = {
    created: 'Menyiapkan checkout QRIS.',
    pending: 'Menunggu pembayaran. Scan QRIS di checkout Midtrans.',
    paid: 'Pembayaran berhasil. Produk sudah aktif.',
    failed: 'Pembayaran ditolak. Buat checkout baru untuk mencoba lagi.',
    expired: 'Kode QRIS sudah kedaluwarsa. Buat checkout baru.',
    canceled: 'Checkout dibatalkan. Belum ada produk yang ditambahkan.',
  };

  return <div className={`pricing-compact-page ${isCheckoutPage ? 'pricing-checkout-page' : ''} ${resolvedTheme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
    {/* Dari halaman checkout, Kembali harus mengembalikan ke daftar plan supaya
    user dapat mengganti pilihan; hanya dari daftar plan ia keluar ke workspace. */}
    <header className="pricing-compact-nav"><button type="button" onClick={() => (isCheckoutPage ? navigate('/pricing') : navigate(user ? '/app' : '/'))} aria-label={isCheckoutPage ? 'Kembali ke pilihan plan' : 'Kembali'} title={isCheckoutPage ? 'Kembali ke pilihan plan' : 'Kembali'}><ArrowLeft size={18}/></button></header>
    <main className="pricing-compact-main">
      <section className="pricing-compact-intro" aria-labelledby="pricing-compact-title">
        <span>Pilihan Laprakin</span>
        <h1 id="pricing-compact-title">{isCheckoutPage ? 'Selesaikan pembayaran.' : 'Pilih plan yang pas buat kamu.'}</h1>
        <p>{isCheckoutPage ? 'Cek ringkasan pembelian, lalu lanjutkan ke QRIS Midtrans.' : 'Mulai gratis, beli credit satuan, atau pilih akses bulanan sesuai ritme praktikum.'}</p>
      </section>
      {!isCheckoutPage && <section className="pricing-compact-grid" aria-label="Pilihan plan Laprakin">
        {cards.map((card) => {
          const isFree = card.key === 'free';
          const isCurrent = card.key === currentPlanKey;
          const isSelected = card.key === selected;
          const actionLabel = isFree ? (user ? 'Masuk workspace' : 'Mulai gratis') : isSelected && user ? 'Dipilih' : `Pilih ${card.label}`;
          return <article key={card.key} className={`pricing-compact-card ${card.recommended ? 'is-recommended' : ''} ${isSelected ? 'is-selected' : ''} ${isCurrent ? 'is-current' : ''}`}>
            {card.recommended && <span className="pricing-recommended-badge">Rekomendasi</span>}
            <div className="pricing-compact-card-head"><div><b>{card.label}</b><small>{isCurrent ? 'Plan aktif' : card.note}</small></div></div>
            <div className="pricing-compact-price">{card.discountPercent > 0 && <small className="pricing-original-price">{card.originalPrice}</small>}<strong>{card.price}</strong>{card.suffix && <span>{card.suffix}</span>}{card.discountPercent > 0 && <em>Hemat {card.discountPercent}%</em>}</div>
            <div className="pricing-compact-action-slot">
              {card.key === 'credit' ? <div className="pricing-compact-quantity" onClick={(event) => event.stopPropagation()}><span>Jumlah</span><div><button type="button" aria-label="Kurangi credit" onClick={() => updateCreditQuantity(creditQuantity - 1)}>-</button><b>{creditQuantity}</b><button type="button" aria-label="Tambah credit" onClick={() => updateCreditQuantity(creditQuantity + 1)}>+</button></div></div> : <span className="pricing-compact-quantity-placeholder" aria-hidden="true" />}
            </div>
            <button type="button" className={isCurrent || isFree ? 'is-quiet' : ''} onClick={() => selectProduct(card.key)}>{actionLabel}{!isFree && <ArrowRight size={15}/>}</button>
            <div className="pricing-compact-divider" />
            <ul>{card.features.map((feature) => <li key={feature}><Check size={13}/><span>{feature}</span></li>)}</ul>
          </article>;
        })}
      </section>}
      {user && selected && isCheckoutPage && <section className="checkout-summary" aria-live="polite">
        <header className="checkout-summary-head">
          <div><b>Ringkasan pesanan</b><small>Periksa kembali sebelum membayar.</small></div>
          <Link to="/pricing" className="checkout-change-plan">Ubah pilihan</Link>
        </header>

        <ul className="checkout-lines">
          {(quote?.items || []).map((item) => <li key={item.sku}>
            <div>
              <b>{item.label}{item.quantity > 1 ? ` × ${item.quantity}` : ''}</b>
              <small>
                {item.kind === 'subscription'
                  ? `${item.creditPerUnit} credit · aktif ${item.durationDays} hari`
                  : `${item.creditPerUnit * item.quantity} credit · berlaku 180 hari`}
              </small>
            </div>
            <span>{formatCurrency(item.subtotalIdr)}</span>
          </li>)}
          {!quote?.items?.length && <li className="checkout-lines-empty"><span>{quoteBusy ? 'Menghitung pesanan…' : 'Belum ada produk terpilih.'}</span></li>}
        </ul>

        {Number(quote?.discountIdr || 0) > 0 && <div className="checkout-discount"><span>Subtotal <s>{formatCurrency(quote.subtotalIdr)}</s></span><b>Diskon -{formatCurrency(quote.discountIdr)}</b></div>}
        <div className="checkout-total">
          <div><span>Total</span><small>Sudah termasuk seluruh biaya.</small></div>
          <b>{quoteBusy ? 'Menghitung…' : quote?.displayTotal || 'Rp0'}</b>
        </div>

        {quote?.totalCredits > 0 && <p className="checkout-gain"><Check size={14} />Kamu mendapat <b>{quote.totalCredits} credit</b> begitu pembayaran terverifikasi.</p>}

        <Button className="checkout-pay-button" onClick={checkout} disabled={busy || quoteBusy || !gateway?.enabled}>
          {busy ? <LoaderCircle className="spin" size={15}/> : <CreditCard size={15}/>} {gateway?.enabled ? 'Bayar dengan QRIS' : 'Gateway belum aktif'}
        </Button>

        <ul className="checkout-notes">
          <li>Scan QRIS memakai aplikasi bank atau e-wallet apa pun.</li>
          <li>Kode QRIS berlaku 15 menit. Lewat itu, buat pesanan baru.</li>
          <li>Credit masuk otomatis setelah pembayaran diverifikasi—tidak perlu konfirmasi manual.</li>
        </ul>
      </section>}
      {activeOrder && <section className={`pricing-compact-status ${activeOrder.status || 'pending'}`}><div><b>{activeOrder.statusLabel || 'Status pembayaran'}</b><p>{statusCopy[activeOrder.status] || 'Status pembayaran sedang diproses.'}</p></div>{['created', 'pending'].includes(activeOrder.status) ? <button type="button" onClick={() => refreshOrder(activeOrder.id, true)} disabled={busy}><RefreshCw size={14}/>Refresh</button> : <CheckCircle2 size={20}/>}</section>}
      {error && <div className="pricing-compact-error"><CircleAlert size={16}/><span>{error}</span>{checkoutRecoveryUrl && <a href={checkoutRecoveryUrl}>Buka checkout QRIS</a>}</div>}
    </main>
  </div>;
}

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

function courseLabelsMatch(left, right) {
  const a = normalizedCourseKey(left);
  const b = normalizedCourseKey(right);
  if (a === b) return true;
  if (a === 'belum dikelompokkan' || b === 'belum dikelompokkan') return false;
  const acronymA = courseAcronym(a);
  const acronymB = courseAcronym(b);
  if (acronymA.length >= 2 && acronymA === acronymB) return true;
  const compactA = a.replace(/\s+/g, '');
  const compactB = b.replace(/\s+/g, '');
  if (Math.min(compactA.length, compactB.length) < 7) return false;
  return 1 - (editDistance(compactA, compactB) / Math.max(compactA.length, compactB.length)) >= 0.84;
}

function preferredCourseLabel(left, right) {
  const leftTokens = courseTokens(left).length;
  const rightTokens = courseTokens(right).length;
  if (leftTokens !== rightTokens) return leftTokens > rightTokens ? left : right;
  return String(left).length >= String(right).length ? left : right;
}

function inferPendingAttachmentKind(file) {
  const name = String(file?.name || '').toLocaleLowerCase('id-ID');
  const extension = name.split('.').pop() || '';
  if (file?.type?.startsWith('image/') || /\b(ss|screenshot|capture|hasil|bukti|dokumentasi|foto)\b/.test(name)) return 'practice_evidence';
  if (/\b(template|format|contoh[\s_-]*(laporan|laprak))\b/.test(name)) return 'template';
  if (/\b(instruksi|ketentuan|rubrik|tugas)\b/.test(name)) return 'instruction';
  if (/\b(modul|materi|panduan|praktikum)\b/.test(name) || extension === 'pdf') return 'module';
  if (['docx', 'txt', 'md', 'csv', 'xlsx'].includes(extension)) return 'supporting_document';
  return 'unknown';
}

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

function PdfThumbnail({ url = '', file = null, size = 58 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    let active = true;
    let loadingTask;
    let renderTask;
    const render = async () => {
      const { GlobalWorkerOptions, getDocument: getPdfDocument } = await import('pdfjs-dist/build/pdf.mjs');
      GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      const source = file
        ? { data: new Uint8Array(await file.arrayBuffer()) }
        : { url, withCredentials: true };
      loadingTask = getPdfDocument(source);
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      if (!active || !canvasRef.current) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: size / baseViewport.width });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = canvasRef.current;
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      canvas.style.width = `${Math.ceil(viewport.width)}px`;
      canvas.style.height = `${Math.ceil(viewport.height)}px`;
      renderTask = page.render({
        canvasContext: canvas.getContext('2d', { alpha: false }),
        viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      });
      await renderTask.promise;
    };
    render().catch(() => {});
    return () => {
      active = false;
      try { renderTask?.cancel(); } catch {}
      loadingTask?.destroy();
    };
  }, [file, size, url]);
  return <canvas className="pdf-thumbnail-canvas" ref={canvasRef} aria-hidden="true" />;
}

function AttachmentThumbnail({ file }) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const [excerpt, setExcerpt] = useState('');
  const image = String(file.mime_type || file.detected_mime || '').startsWith('image/');
  const extension = String(file.original_name || file.name || 'FILE').split('.').pop()?.toUpperCase().slice(0, 5) || 'FILE';
  const pdf = extension === 'PDF' || file.mime_type === 'application/pdf';
  const textDocument = ['TXT', 'MD', 'CSV', 'JSON', 'XLSX'].includes(extension);
  const visualPreview = !previewFailed && (image || extension === 'DOCX');
  useEffect(() => {
    if (!file?.id || (!textDocument && !(extension === 'DOCX' && previewFailed))) return;
    let active = true;
    api(`/chat/attachments/${file.id}/text-preview`)
      .then((data) => { if (active) setExcerpt(String(data.text || '').slice(0, 180)); })
      .catch(() => { if (active) setExcerpt(''); });
    return () => { active = false; };
  }, [file?.id, extension, previewFailed, textDocument]);
  if (pdf) {
    return <span className="attachment-thumb pdf"><PdfThumbnail url={`/api/chat/attachments/${file.id}/preview`} /></span>;
  }
  if (visualPreview) {
    return <span className="attachment-thumb image"><img src={`/api/chat/attachments/${file.id}/preview`} alt={`Preview ${file.original_name || 'lampiran'}`} onError={() => setPreviewFailed(true)} /></span>;
  }
  if (excerpt) {
    return <span className="attachment-thumb text-document"><i>{excerpt}</i><small>{extension}</small></span>;
  }
  return <span className="attachment-thumb document"><FileText size={17} /><small>{extension}</small></span>;
}
function PendingAttachmentChip({ file, index, onRemove }) {
  const [preview, setPreview] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const pdf = file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '');
  useEffect(() => {
    if (file?.type?.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    if (/\.(?:txt|md|csv|json)$/i.test(file?.name || '')) {
      let active = true;
      file.text().then((text) => { if (active) setExcerpt(text.replace(/\s+/g, ' ').trim().slice(0, 90)); });
      return () => { active = false; };
    }
    return undefined;
  }, [file]);
  return <span className="pending-file-chip">{pdf ? <PdfThumbnail file={file} size={34} /> : preview ? <img src={preview} alt="" /> : excerpt ? <i>{excerpt}</i> : <FileText size={12} />}<b>{file.name}</b><button type="button" onClick={() => onRemove(index)} aria-label={`Hapus ${file.name}`}><X size={11} /></button></span>;
}
function IdentityIntakeModal({ user, onSave, onBack, busy }) {
  const { setNotice } = useApp();
  const logoInputRef = useRef(null);
  const identityFirstInputRef = useRef(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoPreviewFailed, setLogoPreviewFailed] = useState(false);
  const [form, setForm] = useState({
    fullName: user.fullName || '',
    nim: user.nim || '',
    className: user.className || '',
    institutionName: user.institutionName || '',
    institutionLogoUrl: user.institutionLogoUrl || '',
    facultyName: user.facultyName || '',
    studyProgramName: user.studyProgramName || '',
    departmentKey: user.departmentKey || '',
    studyProgramKey: user.studyProgramKey || '',
  });
  useEffect(() => setLogoPreviewFailed(false), [form.institutionLogoUrl]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => identityFirstInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const hasLogoPreview = Boolean(form.institutionLogoUrl) && !logoPreviewFailed;
  const valid = form.fullName.trim().length >= 2
    && form.nim.trim().length >= 3
    && form.className.trim().length >= 1
    && form.institutionName.trim().length >= 2
    && form.facultyName.trim().length >= 2
    && form.studyProgramName.trim().length >= 2
    && hasLogoPreview;
  const uploadLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.type !== 'image/png' || !/\.png$/i.test(file.name)) {
      setNotice('Logo institusi wajib berformat PNG.');
      return;
    }
    if (file.size > INSTITUTION_LOGO_MAX_BYTES) {
      setNotice('Ukuran logo maksimal 5 MB.');
      return;
    }
    const body = new FormData();
    body.append('file', file);
    setLogoBusy(true);
    try {
      const result = await api('/profile/institution-logo', { method: 'POST', body, form: true });
      setLogoPreviewFailed(false);
      setForm((value) => ({ ...value, institutionLogoUrl: result.user?.institutionLogoUrl || '' }));
      setNotice('Logo institusi siap dipakai.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLogoBusy(false);
    }
  };
  const submit = async (event) => { event.preventDefault(); if (valid) await onSave(form); };
  return <div className="identity-intake-overlay" role="dialog" aria-modal="true" aria-labelledby="identity-intake-title">
    <form className="identity-intake-modal" onSubmit={submit}>
      <header><span><UserRound size={17} /></span><div><small>Sekali saja</small><h2 id="identity-intake-title">Lengkapi identitas laprakmu</h2><p>Identitas diperlukan hanya untuk pembuatan dokumen. Kami tidak dapat melihat dan mengakses data pengguna untuk keperluan apa pun.</p><p className="identity-intake-follow-up">Setelah disimpan, pesan yang tadi kamu kirim baru diproses.</p></div></header>
      <div className="identity-intake-grid">
        <label>Nama lengkap<input ref={identityFirstInputRef} aria-label="Nama lengkap" autoComplete="name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Nama sesuai data kampus" /></label>
        <label>NPM / NIM<input aria-label="NPM atau NIM" inputMode="numeric" autoComplete="off" value={form.nim} onChange={(event) => setForm({ ...form, nim: event.target.value })} placeholder="Nomor mahasiswa" /></label>
        <label>Kelas<input aria-label="Kelas" autoComplete="off" value={form.className} onChange={(event) => setForm({ ...form, className: event.target.value })} placeholder="Kelas anda" /></label>
        <label>Univ / institusi<input aria-label="Universitas atau institusi" value={form.institutionName} onChange={(event) => setForm({ ...form, institutionName: event.target.value })} placeholder="Contoh: Universitas Republik Indonesia" /></label>
        <label>Fakultas / Jurusan<input aria-label="Fakultas atau jurusan" value={form.facultyName} onChange={(event) => setForm({ ...form, facultyName: event.target.value })} placeholder="Contoh: Fakultas Hukum" /></label>
        <label>Program studi<input aria-label="Program studi" value={form.studyProgramName} onChange={(event) => setForm({ ...form, studyProgramName: event.target.value })} placeholder="Contoh: S1 Rekayasa Hukum" /></label>
        <div className="identity-logo-field">
          <span>Logo institusi</span>
          <div className="identity-logo-control">
            <span className={`identity-logo-preview ${hasLogoPreview ? '' : 'is-empty'}`.trim()}>{hasLogoPreview ? <img src={form.institutionLogoUrl} alt="Logo institusi" onError={() => setLogoPreviewFailed(true)} /> : null}</span>
            <div><b>{hasLogoPreview ? 'Logo PNG terunggah' : 'Unggah logo PNG'}</b><small>Wajib untuk cover, maksimal 5 MB.</small></div>
            <input ref={logoInputRef} aria-label="Upload logo institusi" hidden type="file" accept=".png,image/png" onChange={uploadLogo} />
            <Button type="button" variant="secondary" disabled={busy || logoBusy} onClick={() => logoInputRef.current?.click()}>{logoBusy ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />}{hasLogoPreview ? 'Ganti' : 'Unggah'}</Button>
          </div>
        </div>
      </div>
      <footer><button type="button" onClick={onBack} disabled={busy || logoBusy}>Kembali edit pesan</button><Button type="submit" disabled={busy || logoBusy || !valid}>{busy ? <LoaderCircle className="spin" size={14} /> : <ArrowRight size={14} />}Simpan & lanjutkan</Button></footer>
    </form>
  </div>;
}
function InlineMessageText({ text }) {
  return String(text || '').split(/(`[^`\n]+`)/g).map((part, index) => (
    part.startsWith('`') && part.endsWith('`')
      ? <code className="message-inline-code" key={`${part}-${index}`}>{part.slice(1, -1)}</code>
      : <Fragment key={`${part}-${index}`}>{part}</Fragment>
  ));
}

function MessageContent({ content }) {
  const blocks = String(content || '').split(/(```[\s\S]*?```)/g).filter(Boolean);
  return <div className="message-content">{blocks.map((block, blockIndex) => {
    if (block.startsWith('```') && block.endsWith('```')) {
      const raw = block.slice(3, -3).replace(/^\n/, '');
      const firstBreak = raw.indexOf('\n');
      const possibleLanguage = firstBreak >= 0 ? raw.slice(0, firstBreak).trim() : '';
      const hasLanguage = /^[a-z0-9_+#.-]{1,24}$/i.test(possibleLanguage);
      const language = hasLanguage ? possibleLanguage : 'code';
      const code = (hasLanguage ? raw.slice(firstBreak + 1) : raw).replace(/\n$/, '');
      return <div className="message-code-block" key={`code-${blockIndex}`}>
        <div><CodeXml size={13}/><span>{language}</span></div>
        <pre><code>{code}</code></pre>
      </div>;
    }
    return block.split(/\n{2,}/).filter((paragraph) => paragraph.trim()).map((paragraph, paragraphIndex) => (
      <p key={`text-${blockIndex}-${paragraphIndex}`}><InlineMessageText text={paragraph.trim()} /></p>
    ));
  })}</div>;
}

function AssistantMessageActions({ message, onRegenerate, busy = false }) {
  const { setNotice } = useApp();
  const [reaction, setReaction] = useState('');
  const [copied, setCopied] = useState(false);
  const text = String(message.content || '');
  const timestamp = new Date(message.created_at || message.createdAt || Date.now()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setNotice('Jawaban AI disalin.');
      window.setTimeout(() => setCopied(false), 1400);
    } catch { setNotice('Jawaban AI belum dapat disalin.'); }
  };
  const rate = (value) => {
    setReaction((current) => current === value ? '' : value);
    setNotice(value === 'up' ? 'Masukan positif tersimpan.' : 'Masukan perbaikan tersimpan.');
  };
  return <footer className="message-actions" aria-label="Aksi jawaban AI">
    <button type="button" onClick={copy} aria-label="Salin jawaban" title="Salin jawaban">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
    <button type="button" className={reaction === 'up' ? 'selected' : ''} onClick={() => rate('up')} aria-label="Jawaban membantu" title="Membantu"><ThumbsUp size={14} /></button>
    <button type="button" className={reaction === 'down' ? 'selected' : ''} onClick={() => rate('down')} aria-label="Jawaban perlu diperbaiki" title="Perlu diperbaiki"><ThumbsDown size={14} /></button>
    {onRegenerate && <button type="button" onClick={onRegenerate} disabled={busy} aria-label="Buat ulang jawaban" title="Buat ulang jawaban"><RefreshCw size={14} /></button>}
    <time dateTime={message.created_at || message.createdAt}>{timestamp}</time>
  </footer>;
}

function UserMessageActions({ message, onEdit, busy = false }) {
  return <footer className="message-actions message-actions-user" aria-label="Aksi pesanmu">
    <button type="button" onClick={() => onEdit?.(message)} disabled={busy} aria-label="Ubah pesan" title="Ubah pesan"><Pencil size={14} />Ubah pesan</button>
  </footer>;
}

function ChatSurface({ active, messages, attachments, documentState, workflow, activeJob, user, input, setInput, busy, attachmentKind, setAttachmentKind, uploadRef, send, upload, removeAttachment, updateAttachmentCategory, createDocument, onWorkflowAction, contextOpen, setContextOpen, config, updateConfig, pendingFiles, onPasteImages, onAddPendingFiles, onRemovePending, aiMode, setAiMode, aiModeAccess, onUpgrade, onOpenDocument, quizMode = false, onCloseQuiz, onStartQuiz, onSubmitQuiz, editingMessage, onEditMessage, onCancelEdit, onRevise }) {
  const blankChat = !active || (!messages.length && !attachments.length && !active.document_id);
  const [previewFile, setPreviewFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const greetingName = userGreetingName(user);
  const greetingClass = greetingName.length > 17 ? 'greeting-name-very-long' : greetingName.length > 12 ? 'greeting-name-long' : '';
  const visibleMessages = messages
    .filter((message) => message.meta?.kind !== 'attachments')
    .filter((message, index, items) => {
      if (!index || message.role !== 'assistant') return true;
      const previous = items[index - 1];
      return previous.role !== 'assistant' || previous.content.trim() !== message.content.trim();
    });
  const userMessages = visibleMessages.filter((message) => message.role === 'user');
  const attachmentBuckets = new Map();
  attachments.forEach((file) => {
    let messageId = file.message_id;
    if (!messageId && userMessages.length) {
      const uploadedAt = new Date(file.created_at || file.createdAt || 0).getTime();
      messageId = userMessages.find((message) => new Date(message.created_at || message.createdAt || 0).getTime() >= uploadedAt)?.id
        || userMessages.at(-1)?.id;
    }
    if (!messageId) return;
    attachmentBuckets.set(messageId, [...(attachmentBuckets.get(messageId) || []), file]);
  });
  const assignedAttachmentIds = new Set(Array.from(attachmentBuckets.values()).flat().map((file) => file.id));
  const orphanAttachments = attachments.filter((file) => !assignedAttachmentIds.has(file.id));
  const documentProcessing = Boolean(active?.document_id && (documentState?.status !== 'generated' || ['queued', 'running', 'retry_queued'].includes(activeJob?.status)));
  const hasDocumentReadyMessage = visibleMessages.some((message) => message.meta?.kind === 'document_ready');
  const hasEmbeddedPlan = visibleMessages.some((message) => message.role === 'assistant' && message.meta?.workPlan?.steps?.length);
  const jobForMessage = (message) => {
    const jobId = message.meta?.jobId;
    if (!jobId) return null;
    return activeJob?.id === jobId
      ? activeJob
      : documentState?.jobs?.find((job) => job.id === jobId) || null;
  };
  const hasFileDrag = (event) => Array.from(event.dataTransfer?.types || []).includes('Files');
  return <div
    className={`chat-surface ${blankChat ? 'empty-chat' : 'has-chat'} ${dragActive ? 'chat-drop-active' : ''}`}
    onDragEnter={(event) => { if (!hasFileDrag(event)) return; event.preventDefault(); setDragActive(true); }}
    onDragOver={(event) => { if (!hasFileDrag(event)) return; event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false); }}
    onDrop={(event) => {
      if (!hasFileDrag(event)) return;
      event.preventDefault();
      setDragActive(false);
      onAddPendingFiles(Array.from(event.dataTransfer.files || []));
    }}
  >
    {dragActive && <div className="workspace-drop-hint" aria-hidden="true"><UploadCloud size={22} /><b>Lepas file untuk melampirkan</b><small>File tetap menunggu sampai kamu menekan Enter.</small></div>}
    <div className="chat-thread">
      {quizMode && documentState ? <div className="quiz-workspace-panel"><header><div><small>Cek pemahaman</small><h2>Quiz laprak</h2></div><button type="button" onClick={onCloseQuiz}><ArrowLeft size={14}/>Kembali</button></header><DocumentQuiz access={documentState.quizAccess} busy={busy} onStart={onStartQuiz} onSubmit={onSubmitQuiz} /></div> : blankChat ? <div className="chat-welcome chat-welcome-minimal"><h1 className={greetingClass}>mau <em>laprakin</em> apa hari ini, {greetingName}?</h1></div> : <div className="thread-content">
      {visibleMessages.map((message) => <div className={`message-turn message-turn-${message.role}`} key={message.id}>
        {message.role === 'user' && attachmentBuckets.get(message.id)?.length ? <SourceBar compact attachments={attachmentBuckets.get(message.id)} onOpen={setPreviewFile} /> : null}
        {message.role === 'assistant' && !message.meta?.isClarification && message.meta?.workPlan?.steps?.length ? <WorkPlanRail
          plan={message.meta.workPlan}
          job={jobForMessage(message) || (message.meta?.kind === 'document_ready' ? null : activeJob)}
          documentState={documentState}
          completed={message.meta?.kind === 'document_ready'}
          startedAt={message.meta.thinkingStartedAt}
          finishedAt={message.meta.thinkingFinishedAt || message.created_at}
        /> : null}
        <article className={`message ${message.role}`}><div><MessageContent content={message.content}/>{message.meta?.links?.length ? <div className="link-row">{message.meta.links.map((link) => <a key={link} href={link} target="_blank" rel="noreferrer"><Globe2 size={12} />{new URL(link).hostname}</a>)}</div> : null}</div></article>
        {message.role === 'user' && <UserMessageActions message={message} onEdit={onEditMessage} busy={busy} />}
        {message.role === 'assistant' && <AssistantMessageActions
          message={message}
          busy={busy}
          onRegenerate={getRegenerationTarget(visibleMessages, message.id) ? () => {
            const target = getRegenerationTarget(visibleMessages, message.id);
            onRevise?.({ messageId: target.id, mode: 'regenerate' });
          } : undefined}
        />}
        {message.meta?.kind === 'document_ready' ? <DocumentCard documentState={documentState} activeJob={jobForMessage(message)} version={message.meta.documentVersion} onOpen={onOpenDocument} /> : null}
      </div>)}
      {active && workflow?.state === 'CLARIFICATION_REQUIRED' && !active.document_id && <ChatBriefPanel config={config} updateConfig={updateConfig} workflow={workflow} busy={busy} onSubmit={(payload) => onWorkflowAction('SUBMIT_CLARIFICATION', payload)} />}
      {contextOpen && <InlineContext config={config} updateConfig={updateConfig} onClose={() => setContextOpen(false)} />}
      {orphanAttachments.length > 0 && <SourceBar compact attachments={orphanAttachments} onOpen={setPreviewFile} />}
      {active?.document_id
        ? <>{documentProcessing && !hasEmbeddedPlan && <WorkPlanRail workflow={workflow} job={activeJob || documentState?.jobs?.[0] || null} documentState={documentState} />}{!documentProcessing && !hasDocumentReadyMessage && <DocumentCard documentState={documentState} activeJob={activeJob} onOpen={onOpenDocument} />}</>
        : !hasEmbeddedPlan && <WorkflowPanel workflow={workflow} busy={busy} onCreate={createDocument} onAction={onWorkflowAction} aiMode={aiMode} />}
      {busy && !active?.document_id && !['queued', 'running', 'retry_queued'].includes(activeJob?.status) && <ThinkingRail />}
    </div>}</div>
    {!quizMode && <Composer input={input} setInput={setInput} busy={busy} attachmentKind={attachmentKind} setAttachmentKind={setAttachmentKind} uploadRef={uploadRef} send={send} upload={upload} centered={blankChat} pendingFiles={pendingFiles} onPasteImages={onPasteImages} onAddPendingFiles={onAddPendingFiles} onRemovePending={onRemovePending} aiMode={aiMode} setAiMode={setAiMode} aiModeAccess={aiModeAccess} onUpgrade={onUpgrade} editingMessage={editingMessage} onCancelEdit={onCancelEdit} />}
    {previewFile && <AttachmentPreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
  </div>;
}

function WorkspaceTutorial({ onClose }) {
  const steps = [
    { title: 'Ceritakan tugasmu', description: 'Tulis jenis tugas, mata kuliah, dan topik praktik secara singkat di kotak chat.', video: '/tutorial/alur-1.webm' },
    { title: 'Tambahkan bahan utama', description: 'Unggah modul, instruksi dosen, atau template supaya susunannya mengikuti bahan yang benar.', video: '/tutorial/alur-2.webm' },
    { title: 'Lengkapi bukti praktik', description: 'Tambahkan screenshot, foto hasil, data, atau dokumentasi yang memang kamu miliki.', video: '/tutorial/alur-3.webm' },
    { title: 'Review sampai siap diunduh', description: 'Periksa draft, minta revisi bila perlu, lalu selesaikan cek pemahaman untuk membuka download.', video: '/tutorial/alur-4.webm' },
  ];
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  return <div className="tutorial-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="workspace-tutorial" role="dialog" aria-modal="true" aria-labelledby="workspace-tutorial-title">
      <header><div><small>Langkah {stepIndex + 1} dari {steps.length}</small><h2 id="workspace-tutorial-title">{step.title}</h2><p>{step.description}</p></div><IconButton label="Tutup tutorial" onClick={onClose}><X size={17} /></IconButton></header>
      <div className="tutorial-progress" aria-label={`Langkah ${stepIndex + 1} dari ${steps.length}`}>{steps.map((item, index) => <span key={item.title} className={index <= stepIndex ? 'active' : ''} />)}</div>
      <div className="tutorial-video">
        <video key={step.video} src={step.video} autoPlay muted loop playsInline controls preload="metadata" aria-label={`Video ${step.title}`} />
      </div>
      <footer>
        <button type="button" className="tutorial-previous" onClick={() => setStepIndex((value) => Math.max(0, value - 1))} disabled={stepIndex === 0}><ArrowLeft size={15} />Sebelumnya</button>
        <Button type="button" onClick={() => { if (isLastStep) onClose(); else setStepIndex((value) => value + 1); }}>{isLastStep ? 'Mulai chat' : 'Lanjut'}{!isLastStep && <ArrowRight size={15} />}</Button>
      </footer>
    </section>
  </div>;
}

function SourceBar({ attachments, onOpen, onAdd, compact = false }) {
  return <section className={`source-bar ${compact ? 'message-source-bar' : ''} ${attachments.length > 1 ? 'has-many' : ''}`} aria-label="Bahan terlampir">
    <div className="source-preview-list">{attachments.map((file) => {
      const detectedKind = ['module', 'unknown'].includes(file.kind) ? inferPendingAttachmentKind({ name: file.original_name, type: file.mime_type }) : file.kind;
      return <button type="button" className="source-preview-item" key={file.id} onClick={() => onOpen(file)} title={`Preview ${file.original_name}`}><AttachmentThumbnail file={file} /><span><b>{file.original_name}</b><small>{detectedKind === 'practice_evidence' || detectedKind === 'evidence' ? 'Bukti praktik' : detectedKind === 'module' ? 'Modul' : 'Bahan'}</small></span></button>;
    })}</div>
    {onAdd && <div className="source-bar-actions"><button type="button" onClick={onAdd}><Plus size={13} />Tambah file</button></div>}
  </section>;
}

/**
 * Preview PDF yang seluruh halamannya dirender berurutan ke bawah.
 *
 * Versi sebelumnya menampilkan satu halaman dengan tombol maju/mundur dan
 * memanggil destroy() pada dokumen pdf.js lewat effect terpisah. Saat modal
 * ditutup, destroy() berjalan sementara getPage/render masih tertunda, promise
 * yang ditolak tidak pernah ditangkap, dan seluruh tampilan jatuh ke error
 * boundary. Sekarang satu effect memegang seluruh siklus hidupnya.
 */
function PdfAttachmentPreview({ file }) {
  const containerRef = useRef(null);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;
    let pdf = null;
    const container = containerRef.current;
    setError('');
    setPageCount(0);

    const renderAll = async () => {
      try {
        const { GlobalWorkerOptions, getDocument: getPdfDocument } = await import('pdfjs-dist/build/pdf.mjs');
        GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        pdf = await getPdfDocument({ url: `/api/chat/attachments/${file.id}/file`, withCredentials: true }).promise;
        if (disposed) return;
        setPageCount(pdf.numPages);
        for (let number = 1; number <= pdf.numPages; number += 1) {
          if (disposed || !container) return;
          const page = await pdf.getPage(number);
          if (disposed || !container) return;
          const viewport = page.getViewport({ scale: 1.35 });
          const canvas = document.createElement('canvas');
          canvas.className = 'attachment-pdf-page';
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          container.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        }
      } catch (previewError) {
        if (!disposed && previewError?.name !== 'RenderingCancelledException') setError('PDF tidak dapat ditampilkan.');
      }
    };
    renderAll();

    return () => {
      disposed = true;
      // destroy() menolak setiap operasi yang masih tertunda. Tanpa catch,
      // penolakan itu lolos sebagai unhandled rejection saat modal ditutup.
      try { pdf?.destroy?.()?.catch?.(() => {}); } catch { /* sudah terlanjur tertutup */ }
      if (container) container.replaceChildren();
    };
  }, [file.id]);

  return <div className="attachment-pdf-preview">
    {error && <div className="attachment-preview-error"><CircleAlert size={17}/>{error}</div>}
    <div ref={containerRef} className="attachment-pdf-pages" aria-label={pageCount ? `Dokumen ${pageCount} halaman` : 'Memuat dokumen'} />
  </div>;
}

function DocxAttachmentPreview({ file }) {
  const hostRef = useRef(null);
  const renderRef = useRef(null);
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const render = async () => {
      try {
        setStatus('loading');
        const response = await fetch(`/api/chat/attachments/${file.id}/file`, { credentials: 'same-origin', signal: controller.signal });
        if (!response.ok) throw new Error('Dokumen Word tidak dapat dimuat.');
        const blob = await response.blob();
        if (disposed || !renderRef.current) return;
        renderRef.current.replaceChildren();
        await renderDocx(blob, renderRef.current, undefined, {
          className: 'laprakin-source-docx',
          inWrapper: true,
          breakPages: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          experimental: true,
        });
        if (!disposed) setStatus('ready');
      } catch (error) {
        if (!disposed && error.name !== 'AbortError') setStatus(error.message || 'Dokumen Word tidak dapat ditampilkan.');
      }
    };
    render();
    return () => { disposed = true; controller.abort(); };
  }, [file.id]);
  useEffect(() => {
    if (status !== 'ready' || !hostRef.current || !renderRef.current) return undefined;
    const resize = () => {
      const available = Math.max(300, hostRef.current.clientWidth - 20);
      renderRef.current.style.zoom = String(Math.min(1, available / 816));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, [status]);
  return <div className="attachment-docx-preview" ref={hostRef}>
    {status === 'loading' && <div className="attachment-preview-loading"><LoaderCircle className="spin" size={17}/>Memuat dokumen Word asli...</div>}
    {status !== 'loading' && status !== 'ready' && <div className="attachment-preview-error"><CircleAlert size={17}/>{status}</div>}
    <div className={status === 'ready' ? 'is-ready' : 'is-loading'} ref={renderRef} />
  </div>;
}

function TextAttachmentPreview({ file, extension }) {
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    const load = async () => {
      try {
        if (extension === 'XLSX') {
          const result = await api(`/chat/attachments/${file.id}/text-preview`);
          if (!disposed) setContent(result.text || '');
          return;
        }
        const response = await fetch(`/api/chat/attachments/${file.id}/file`, { credentials: 'same-origin' });
        if (!response.ok) throw new Error();
        const text = await response.text();
        if (!disposed) setContent(text.slice(0, 200000));
      } catch {
        if (!disposed) setError('Isi file tidak dapat ditampilkan.');
      }
    };
    load();
    return () => { disposed = true; };
  }, [extension, file.id]);
  if (error) return <div className="attachment-preview-error"><CircleAlert size={17}/>{error}</div>;
  if (!content) return <div className="attachment-preview-loading"><LoaderCircle className="spin" size={17}/>Memuat isi file...</div>;
  return <pre className="attachment-text-preview">{content}</pre>;
}

function AttachmentPreviewModal({ file, onClose }) {
  const extension = String(file.original_name || '').split('.').pop()?.toUpperCase() || '';
  const mimeType = String(file.detected_mime || file.mime_type || '');
  const image = mimeType.startsWith('image/') || ['PNG', 'JPG', 'JPEG', 'WEBP'].includes(extension);
  return <div className="attachment-preview-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="attachment-preview-modal" role="dialog" aria-modal="true" aria-label={`Preview ${file.original_name}`}>
      <header><div><small>Preview file asli</small><b>{file.original_name}</b></div><IconButton label="Tutup preview" onClick={onClose}><X size={17}/></IconButton></header>
      <div className="attachment-preview-body">
        {extension === 'PDF' || mimeType === 'application/pdf'
          ? <PdfAttachmentPreview file={file} />
          : extension === 'DOCX'
            ? <DocxAttachmentPreview file={file} />
            : image
              ? <img className="attachment-image-preview" src={`/api/chat/attachments/${file.id}/file`} alt={file.original_name} />
              : <TextAttachmentPreview file={file} extension={extension} />}
      </div>
    </section>
  </div>;
}

function WorkflowPanel({ workflow, busy, onCreate, onAction, aiMode }) {
  if (!workflow) return null;
  if (workflow.state === 'CLARIFICATION_REQUIRED') return null;
  if (workflow.state === 'ANALYZING_INPUT') return null;
  if (workflow.state !== 'READY_TO_GENERATE') return null;
  return <section className="work-plan-ready" aria-label="Alur kerja Laprak">
    <WorkPlanRail workflow={workflow} />
    {!busy && <div className="work-plan-start"><span>{workflow.practiceTopic ? `${workflow.courseName} · ${workflow.practiceTopic}` : workflow.courseName}</span><Button onClick={onCreate}><Sparkles size={15} />Mulai susun</Button></div>}
  </section>;
}

function ClarificationCard({ workflow, busy, onAction }) {
  const [courseName, setCourseName] = useState(workflow.courseName || '');
  const [practiceTopic, setPracticeTopic] = useState(workflow.practiceTopic || '');
  const courseInputRef = useRef(null);
  useEffect(() => { courseInputRef.current?.focus(); }, []);
  const valid = Boolean(courseName.trim());
  const submit = (event) => {
    event.preventDefault();
    if (!valid) return;
    onAction('SUBMIT_CLARIFICATION', { courseName: courseName.trim(), practiceTopic: practiceTopic.trim(), documentType: workflow.documentType || 'lab_report' });
  };
  return <form className="clarification-inline" onSubmit={submit}>
    <div className="clarification-inline-copy"><span><LoaderCircle className={busy ? 'spin' : ''} size={15} /></span><div><small>{workflow.attachmentsCount ? `Membaca ${workflow.attachmentsCount} bahan` : 'Menyiapkan konteks Laprak'}</small><b>Tambahkan mata kuliah sebelum alur kerja ditampilkan.</b></div></div>
    <div className="clarification-fields">
       <label>Mata kuliah<input ref={courseInputRef} aria-label="Mata kuliah" value={courseName} onChange={(event) => setCourseName(event.target.value)} placeholder="Contoh: Jaringan Komputer" /></label>
       <label>Judul materi <small>Opsional</small><input aria-label="Judul materi" value={practiceTopic} onChange={(event) => setPracticeTopic(event.target.value)} placeholder="Contoh: Routing Statis" /></label>
      <Button type="submit" disabled={busy || !valid}>{busy ? <LoaderCircle className="spin" size={14} /> : <ArrowRight size={14} />}Lanjutkan</Button>
    </div>
  </form>;
}

function ThinkingRail() {
  return <section className="work-plan-rail work-plan-pending" aria-live="polite"><div className="work-plan-toggle"><b>Sedang berpikir</b><LoaderCircle className="spin" size={14}/></div></section>;
}

function WorkPlanRail({ workflow, job = null, documentState = null, plan: planOverride = null, completed = false, startedAt: startedAtOverride = '', finishedAt: finishedAtOverride = '' }) {
  const plan = planOverride || workflow?.workPlan || {};
  const steps = Array.isArray(plan.steps) && plan.steps.length ? plan.steps : (documentState || job ? [
    { id: 'read', title: 'Membaca seluruh bahan', detail: 'Mengambil struktur, instruksi, data, dan bukti yang tersedia.' },
    { id: 'structure', title: 'Mempelajari susunan dokumen', detail: 'Mengikuti urutan bagian dan gaya dari template yang dipakai.' },
    { id: 'write', title: 'Menyusun isi laprak', detail: 'Menghubungkan langkah, bukti, hasil, dan pembahasan.' },
    { id: 'layout', title: 'Menata dokumen Word', detail: 'Memeriksa judul, paragraf, gambar, caption, dan pergantian halaman.' },
    { id: 'finish', title: 'Menyiapkan hasil akhir', detail: 'Menyimpan dokumen agar siap dibuka dan diperiksa.' },
  ] : []);
  const jobLive = ['queued', 'running', 'retry_queued'].includes(job?.status);
  const generated = completed || !jobLive && (documentState?.status === 'generated' || job?.status === 'completed' && job?.type === 'generate');
  const [expanded, setExpanded] = useState(!generated);
  useEffect(() => { if (generated) setExpanded(false); }, [generated]);
  if (!steps.length) return null;
  const failed = ['failed', 'canceled'].includes(job?.status) && generated;
  const progress = Math.max(0, Math.min(100, Number(job?.progress || 0)));
  const foundationCount = Math.min(2, steps.length);
  let completedCount = 1;
  if (generated) completedCount = steps.length;
  else if (job?.type === 'analyze') completedCount = job.status === 'completed' ? foundationCount : Math.min(1, steps.length - 1);
  else if (job?.type === 'generate') {
    const remaining = Math.max(1, steps.length - foundationCount);
    completedCount = Math.min(steps.length - 1, foundationCount + Math.floor((progress / 100) * remaining));
  } else if (documentState?.status === 'analyzed') completedCount = foundationCount;
  const visibleCount = completedCount >= steps.length ? steps.length : Math.min(steps.length, completedCount + 1);
  const visibleSteps = steps.slice(0, visibleCount);
  const startedAt = new Date(startedAtOverride || job?.startedAt || job?.createdAt || plan.generatedAt || Date.now()).getTime();
  const finishedAt = new Date(finishedAtOverride || job?.finishedAt || job?.updatedAt || (generated ? documentState?.updated_at : Date.now()) || Date.now()).getTime();
  const durationSeconds = Math.max(1, Math.round((finishedAt - startedAt) / 1000));
  const durationLabel = durationSeconds >= 60
    ? `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}dtk`
    : `${durationSeconds}dtk`;
  return <section className={`work-plan-rail ${expanded ? 'is-expanded' : 'is-collapsed'}`} aria-live="polite">
    <button type="button" className="work-plan-toggle" onClick={() => setExpanded((value) => !value)}><b>{generated ? `Berpikir selama ${durationLabel}` : 'Sedang berpikir'}</b>{expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button>
    {expanded && <ol>{visibleSteps.map((step, index) => {
      const done = index < completedCount;
      const current = index === completedCount && completedCount < steps.length;
      return <li key={step.id || `${step.title}-${index}`} className={`${done ? 'done' : ''} ${current ? 'current' : ''} ${current && failed ? 'failed' : ''}`}>
        <span>{done ? <Check size={12} /> : current && !failed ? <LoaderCircle className="spin" size={12} /> : index + 1}</span>
        <div><b>{step.title}</b><small>{current && job?.message ? job.message : step.detail}</small></div>
      </li>;
    })}</ol>}
    {expanded && failed && <p className="work-plan-error">Dokumen tetap tersimpan dan sedang disiapkan kembali.</p>}
  </section>;
}

function AiModeMenu({ value, onChange, access = {}, onUpgrade }) {
  const [open, setOpen] = useState(false);
  const modes = [
    { key: 'basic', label: 'Basic', description: 'Untuk laprak harian', unlock: 'Tersedia untuk semua' },
    { key: 'thinking', label: 'Thinking', description: 'Analisis lebih terarah', unlock: 'Credit Laprak atau Pro' },
    { key: 'xtrathink', label: 'XtraThink', description: 'Penalaran paling mendalam', unlock: 'Khusus Max' },
  ];
  const current = modes.find((item) => item.key === value) || modes[0];
  useEffect(() => { if (!open) return undefined; const timer = window.setTimeout(() => setOpen(false), 5000); return () => window.clearTimeout(timer); }, [open]);
  const choose = (mode) => {
    if (!access?.[mode.key]?.available) { setOpen(false); onUpgrade?.(); return; }
    onChange(mode.key); setOpen(false);
  };
  return <div className="ai-mode-menu"><button type="button" className="ai-mode-trigger" onClick={() => setOpen((item) => !item)} aria-haspopup="menu" aria-expanded={open}><span>{current.label}</span><ChevronDown size={13} /></button>{open && <div className="ai-mode-popover" role="menu">{modes.map((mode) => { const available = Boolean(access?.[mode.key]?.available); return <button type="button" key={mode.key} className={`${mode.key === value ? 'selected' : ''} ${available ? '' : 'locked'}`} role="menuitem" onClick={() => choose(mode)}><span className="ai-mode-option-copy"><b>{mode.label}</b><small>{mode.description}</small></span>{available ? (mode.key === value ? <Check size={15} /> : <ChevronRight size={15} />) : <span className="ai-mode-lock"><LockKeyhole size={13} />{mode.unlock}</span>}</button>; })}</div>}</div>;
}

function resizeComposerTextarea(textarea) {
  if (!textarea || typeof window === 'undefined') return;
  const style = window.getComputedStyle(textarea);
  const fontSize = Number.parseFloat(style.fontSize) || 13;
  const lineHeight = Number.parseFloat(style.lineHeight) || fontSize * 1.5;
  const verticalPadding = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
  const verticalBorder = (Number.parseFloat(style.borderTopWidth) || 0) + (Number.parseFloat(style.borderBottomWidth) || 0);
  const minBoxHeight = Math.ceil(lineHeight * 2 + verticalPadding + verticalBorder);
  const maxBoxHeight = Math.ceil(lineHeight * 11 + verticalPadding + verticalBorder);

  // Reset to the minimum before reading scrollHeight. This makes deletion
  // shrink the composer immediately instead of measuring its previous height.
  textarea.classList.remove('is-overflowing');
  textarea.style.overflowY = 'hidden';
  textarea.style.height = '0px';

  const requiredBoxHeight = Math.max(textarea.scrollHeight + verticalBorder, minBoxHeight);
  const overflowing = requiredBoxHeight > maxBoxHeight + 2;
  textarea.style.height = `${Math.min(Math.ceil(requiredBoxHeight), maxBoxHeight)}px`;
  textarea.classList.toggle('is-overflowing', overflowing);
  textarea.style.overflowY = overflowing ? 'auto' : 'hidden';
}

function Composer({ input, setInput, busy, attachmentKind, setAttachmentKind, uploadRef, send, upload, centered, pendingFiles = [], onPasteImages, onRemovePending, aiMode, setAiMode, aiModeAccess, onUpgrade, editingMessage = null, onCancelEdit }) {
  const textareaRef = useRef(null);
  const shortcutItems = [
    { key: 'laprak', label: 'Laprak', icon: FileText, prompt: 'Buatkan saya laporan praktikum berdasarkan bahan dan instruksi yang tersedia.' },
    { key: 'proposal', label: 'Proposal', icon: LayoutTemplate, prompt: 'Bantu saya menyusun proposal berdasarkan bahan dan instruksi berikut: ' },
    { key: 'makalah', label: 'Makalah', icon: GraduationCap, prompt: 'Bantu saya menyusun makalah berdasarkan bahan dan instruksi berikut: ' },
    { key: 'tugas-akhir', label: 'Tugas akhir', icon: ClipboardList, prompt: 'Bantu saya mengerjakan bagian tugas akhir berdasarkan arahan dan sumber berikut: ' },
    { key: 'jurnal', label: 'Jurnal', icon: Pencil, prompt: 'Bantu saya menyusun artikel jurnal dari data dan tujuan penelitian berikut: ' },
  ];
  const placeholder = centered ? 'Ceritakan tugas yang ingin kamu susun...' : (pendingFiles.length ? 'Tambahkan pesan untuk bahan ini...' : 'Tulis tugasmu, tempel link, atau paste gambar...');
  useLayoutEffect(() => {
    resizeComposerTextarea(textareaRef.current);
  }, [input]);
  useEffect(() => {
    const resize = () => resizeComposerTextarea(textareaRef.current);
    let measuredWidth = textareaRef.current?.getBoundingClientRect().width || 0;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width || 0;
      if (Math.abs(nextWidth - measuredWidth) < 1) return;
      measuredWidth = nextWidth;
      resize();
    });
    if (textareaRef.current) observer?.observe(textareaRef.current);
    window.addEventListener('resize', resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);
  useEffect(() => {
    if (!editingMessage) return undefined;
    setInput(editingMessage.content || '');
    const frame = window.requestAnimationFrame(() => textareaRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [editingMessage, setInput]);
  return <div className={`composer-zone ${centered ? 'composer-centered composer-claude' : ''}`}>
    {pendingFiles.length ? <div className="pending-files">{pendingFiles.map((file, index) => <PendingAttachmentChip file={file} index={index} key={`${file.name}-${index}`} onRemove={onRemovePending} />)}</div> : null}
    {editingMessage && <div className="composer-editing-banner" role="status" aria-live="polite"><span><Pencil size={13} />Mengubah pesan</span><button type="button" onClick={onCancelEdit} disabled={busy}>Batalkan</button></div>}
    <form className={`composer ${centered ? 'composer-style-reference' : ''}`} onSubmit={send}>
      <textarea ref={textareaRef} aria-label={placeholder || 'Pesan chat'} rows="2" value={input} onChange={(event) => setInput(event.target.value)} onPaste={onPasteImages} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={placeholder} />
      <div className="composer-bottom-row">
        <div className="composer-left">
          <CustomSelect className="composer-select" value={attachmentKind} onChange={setAttachmentKind} ariaLabel="Jenis bahan" options={[{ value: '', label: 'Deteksi otomatis' }, { value: 'module', label: 'Modul' }, { value: 'instruction', label: 'Instruksi' }, { value: 'practice_evidence', label: 'Bukti praktik' }, { value: 'template', label: 'Template' }, { value: 'supporting_document', label: 'Dokumen pendukung' }]} />
          <button type="button" className="attach-button" onClick={() => uploadRef.current?.click()} title="Tambah bahan"><Plus size={18} /></button>
          <input ref={uploadRef} aria-label="Lampirkan bahan" hidden type="file" multiple accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.png,.jpg,.jpeg,.webp" onChange={upload} />
        </div>
        <div className="composer-actions">
          <AiModeMenu value={aiMode} onChange={setAiMode} access={aiModeAccess} onUpgrade={onUpgrade} />
          <button className="send-button" type="submit" disabled={busy || (!input.trim() && !pendingFiles.length)} aria-label={editingMessage ? 'Simpan perubahan pesan' : 'Kirim pesan'}><Send size={17} /></button>
        </div>
      </div>
    </form>
    {centered ? <div className="composer-shortcuts" aria-label="Pilih jenis dokumen">{shortcutItems.map((item) => { const Icon = item.icon; return <button key={item.key} type="button" className="composer-shortcut" onClick={() => setInput(item.prompt)}><Icon size={14} /><span>{item.label}</span></button>; })}</div> : null}
    {!centered ? <small>Enter untuk kirim · Shift + Enter untuk baris baru · file hanya terlihat di akunmu</small> : null}
  </div>;
}

function ChatBriefPanel({ config, updateConfig, workflow, busy, onSubmit }) {
  const missing = workflow?.missingCriticalContext || '';
  const courseName = config.configuration.courseName || workflow?.courseName || '';
  const moduleTitle = config.configuration.moduleTitle || workflow?.practiceTopic || '';
  const needsCourse = ['course_name', 'course_and_topic'].includes(missing) || !courseName;
  const needsModule = ['practice_topic', 'course_and_topic', 'document_type_and_topic'].includes(missing) || !moduleTitle;
  const ready = (!needsCourse || courseName.trim()) && (!needsModule || moduleTitle.trim());
  const firstInputRef = useRef(null);
  useEffect(() => { firstInputRef.current?.focus(); }, [missing]);
  return <form className="chat-brief-panel" onSubmit={(event) => {
    event.preventDefault();
    if (!ready) return;
    onSubmit?.({
      courseName: courseName.trim(),
      practiceTopic: moduleTitle.trim(),
    });
  }}>
    <div><small>Lengkapi konteks</small><b>{needsCourse && needsModule ? 'Mata kuliah dan materi' : needsCourse ? 'Mata kuliah' : 'Materi praktikum'}</b></div>
     {needsCourse && <label>Mata kuliah<input ref={firstInputRef} aria-label="Mata kuliah" value={courseName} onChange={(event) => updateConfig({ configuration: { courseName: event.target.value } })} placeholder="Contoh: Administrasi Jaringan Komputer" /></label>}
     {needsModule && <label>Materi / modul<input ref={!needsCourse ? firstInputRef : undefined} aria-label="Materi atau modul" value={moduleTitle} onChange={(event) => updateConfig({ configuration: { moduleTitle: event.target.value } })} placeholder="Contoh: Dynamic Host Configuration Protocol" /></label>}
    <Button type="submit" disabled={busy || !ready}>{busy ? <LoaderCircle className="spin" size={14} /> : <ArrowRight size={14} />}Lanjutkan</Button>
  </form>;
}

function InlineContext({ config, updateConfig, onClose }) {
  return <form className="inline-context" onSubmit={(event) => { event.preventDefault(); onClose(); }}><div className="context-title"><div><b>Konteks laprak</b><p>Isi seperlunya agar bahan lebih mudah dibaca.</p></div><button type="button" onClick={onClose} aria-label="Tutup form konteks"><X size={14} /></button></div><div className="context-fields"><label>Mata kuliah<input aria-label="Mata kuliah" value={config.configuration.courseName} onChange={(event) => updateConfig({ configuration: { courseName: event.target.value } })} placeholder="Jaringan Komputer" /></label><label>Judul materi <small>Opsional</small><input aria-label="Judul materi" value={config.configuration.moduleTitle} onChange={(event) => updateConfig({ configuration: { moduleTitle: event.target.value } })} placeholder="Routing Protocol" /></label><Button type="submit" variant="secondary">Simpan</Button></div></form>;
}

function ReportPreview({ documentState, user, embedded = false }) {
  const [open, setOpen] = useState(true);
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => setLogoFailed(false), [user.institutionLogoUrl]);
  const studyProgram = programs.find((item) => item.key === user.studyProgramKey)?.label || 'Program studi';
  const department = departments.find((item) => item.key === user.departmentKey)?.label || 'Jurusan / fakultas';
  const mappingsBySection = (documentState.mappings || []).reduce((result, mapping, index) => {
    const candidates = (documentState.sections || []).filter((section) => section.section_type === mapping.section_type);
    const target = candidates.length ? candidates[Math.max(0, Number(mapping.step_number || mapping.display_order || index + 1) - 1) % candidates.length] : null;
    if (target) (result[target.id] ||= []).push(mapping);
    return result;
  }, {});
  return <section className={`report-preview ${open || embedded ? 'is-open' : ''} ${embedded ? 'is-embedded' : ''}`}>
    {!embedded && <button type="button" className="report-preview-toggle" onClick={() => setOpen((value) => !value)}><span><Eye size={15} /><b>Preview laporan</b><small>Versi yang akan dipakai untuk quiz dan export</small></span><ChevronDown size={16} /></button>}
    {(open || embedded) && <div className="report-paper-stack">
      <article className="report-paper report-cover">
        <p className="report-cover-kicker">LAPORAN PRAKTIKUM</p>
        <h2>{documentState.course_name || 'MATA KULIAH'}</h2>
        <h3>{documentState.module_title || documentState.title}</h3>
        {user.institutionLogoUrl && !logoFailed && <img className="report-cover-logo" src={user.institutionLogoUrl} alt={`Logo ${user.institutionName || 'institusi'}`} onError={() => setLogoFailed(true)} />}
        <div className="report-cover-lecturer"><small>Dosen Pengampu:</small><b>{documentState.lecturer_name || '-'}</b><span>NIP : -</span></div>
        <div className="report-cover-identity"><small>Disusun Oleh:</small><b>{user.fullName || 'Nama mahasiswa'} ({user.nim || 'NPM / NIM'})</b><span>{user.className || 'Kelas'}</span></div>
        <div className="report-cover-institution"><b>PROGRAM STUDI {studyProgram.toUpperCase()}</b><span>{department.toUpperCase()}</span><span>POLITEKNIK NEGERI CILACAP</span><span>TAHUN AKADEMIK {documentState.academic_year || '2025/2026'}</span></div>
      </article>
      <article className="report-paper report-body-preview">
        <h2>Langkah Latihan Soal Praktikum</h2>
        {(documentState.sections || []).map((section) => <section key={section.id}>
          <h3>{section.title}</h3>
          {String(section.content || '').split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={`${section.id}-${index}`}>{paragraph}</p>)}
          {(mappingsBySection[section.id] || []).map((mapping, index) => <figure key={mapping.id}>
            <img src={`/api/files/${mapping.file_id}/preview`} alt={mapping.caption || mapping.original_name || `Bukti ${index + 1}`} />
            <figcaption>{mapping.caption || `Gambar ${index + 1}. ${mapping.original_name || 'Bukti praktikum'}`}</figcaption>
          </figure>)}
        </section>)}
      </article>
    </div>}
  </section>;
}

function DocumentQuiz({ access, busy, onStart, onSubmit }) {
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [result, setResult] = useState(null);
  const begin = async () => {
    const next = await onStart();
    if (!next) return;
    setAttempt(next);
    setAnswers({});
    setQuestionIndex(0);
    setResult(null);
  };
  const finish = async () => {
    const payload = attempt.questions.map((question) => ({ questionId: question.id, selectedIndex: answers[question.id] }));
    const next = await onSubmit(attempt.attemptId, payload);
    if (next) setResult(next);
  };
  if (access?.passed && !attempt) {
    return <section className="quiz-gate quiz-passed"><span><CheckCircle2 size={18} /></span><div><small>Selesai</small><b>Download terbuka</b><p>Nilai {access.latestScore ?? 0}%</p></div></section>;
  }
  if (!attempt) {
    return <section className="quiz-gate">
      <div><small>Pre-quiz</small><h3>{access?.attemptCount ? `Nilai terakhir ${access.latestScore ?? 0}%` : '5 soal singkat'}</h3>{access?.attemptCount ? <p>Minimal {access.passScore}%</p> : null}</div>
      <Button onClick={begin} disabled={busy}><Sparkles size={14} />{access?.attemptCount ? 'Coba lagi' : 'Mulai quiz'}</Button>
    </section>;
  }
  if (result) {
    return <section className={`quiz-result ${result.passed ? 'passed' : 'failed'}`}>
      <div className="quiz-result-score"><span>{result.score}</span><small>/ 100</small></div>
      <div><small>{result.passed ? 'Lulus' : 'Belum lulus'}</small><h3>{result.passed ? 'Download terbuka' : `Minimal ${result.passScore}%`}</h3></div>
      {!result.passed && <Button onClick={begin} disabled={busy}><RefreshCw size={14} />Soal baru</Button>}
    </section>;
  }
  const question = attempt.questions[questionIndex];
  const selected = answers[question.id];
  const isLast = questionIndex === attempt.questions.length - 1;
  return <section className="quiz-player">
    <header><span>Soal</span><b>{questionIndex + 1} / {attempt.questions.length}</b><div><i style={{ width: `${((questionIndex + 1) / attempt.questions.length) * 100}%` }} /></div></header>
    <article className="quiz-question-card"><small>{question.sectionTitle}</small><h3>{question.question}</h3></article>
    {/* Tanpa kelas warna per-opsi: empat warna keras yang berbeda membuat
    pilihan terlihat seperti kuis permainan dan tidak mengikuti tema. */}
    <div className="quiz-options">{question.options.map((option, index) => <button type="button" key={`${question.id}-${index}`} className={`quiz-option ${selected === index ? 'selected' : ''}`} onClick={() => setAnswers((value) => ({ ...value, [question.id]: index }))}><span>{String.fromCharCode(65 + index)}</span><b>{option}</b></button>)}</div>
    <footer><button type="button" disabled={questionIndex === 0} onClick={() => setQuestionIndex((value) => value - 1)}>Sebelumnya</button><Button disabled={selected === undefined || busy} onClick={() => isLast ? finish() : setQuestionIndex((value) => value + 1)}>{isLast ? 'Selesai' : 'Lanjut'}<ArrowRight size={14} /></Button></footer>
  </section>;
}

function DocumentCard({ documentState, activeJob, version = null, onOpen }) {
  if (!documentState) return <div className="document-card loading-doc"><LoaderCircle className="spin" size={15} />Memuat dokumen kerja...</div>;
  const isGenerated = documentState.status === 'generated';
  const latestJob = activeJob || documentState.jobs?.[0] || null;
  const liveJob = ['queued', 'running', 'retry_queued'].includes(latestJob?.status);
  return <article className={`document-card document-slim-card ${isGenerated ? 'document-is-ready' : 'document-is-processing'}`}>
    <span className="document-card-icon"><FileText size={20} /></span>
    <div className="document-card-copy"><b>{documentState.title}</b><small>{isGenerated ? `Dokumen Word · Versi ${Number(version || Number(documentState.revision_count || 0) + 1)}` : liveJob ? latestJob.message || 'Sedang menyiapkan dokumen' : 'Menyiapkan tahap berikutnya secara otomatis'}</small></div>
    <button type="button" className="document-open-button" onClick={onOpen}>{isGenerated ? 'Buka' : 'Lihat proses'}</button>
  </article>;
}

function RenderedDocxPreview({ documentId, revision = 0 }) {
  const hostRef = useRef(null);
  const renderRef = useRef(null);
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const render = async () => {
      setStatus('loading');
      try {
        const response = await fetch(`/api/documents/${documentId}/preview.docx?v=${revision}`, {
          credentials: 'same-origin',
          signal: controller.signal,
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error?.message || error.message || 'Preview dokumen belum dapat dimuat.');
        }
        const blob = await response.blob();
        if (!active || !renderRef.current) return;
        renderRef.current.replaceChildren();
        await renderDocx(blob, renderRef.current, undefined, {
          className: 'laprakin-docx',
          inWrapper: true,
          breakPages: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          experimental: true,
        });
        if (active) setStatus('ready');
      } catch (error) {
        if (error.name !== 'AbortError' && active) setStatus(error.message || 'Preview gagal dimuat.');
      }
    };
    render();
    return () => { active = false; controller.abort(); };
  }, [documentId, revision]);
  useEffect(() => {
    if (!hostRef.current || !renderRef.current) return undefined;
    const resize = () => {
      const available = Math.max(280, hostRef.current.clientWidth - 8);
      renderRef.current.style.zoom = String(Math.min(1, available / 816));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, [status]);
  return <section className="docx-preview-host" ref={hostRef}>
    {status === 'loading' && <div className="docx-preview-state"><LoaderCircle className="spin" size={17} />Memuat dokumen Word asli...</div>}
    {status !== 'loading' && status !== 'ready' && <div className="docx-preview-state error"><CircleAlert size={17} />{status}</div>}
    <div className={`docx-render-root ${status === 'ready' ? 'is-ready' : 'is-loading'}`} ref={renderRef} />
  </section>;
}

function DocumentSidePanel({ documentState, activeJob, workflow, busy, user, onClose, onAction, onDownload, onRestoreVersion, onStartQuiz, onSubmitQuiz }) {
  const [selectedVersion, setSelectedVersion] = useState('');
  if (!documentState) return <div className="document-side-shell"><header><div><b>Dokumen</b><small>Memuat hasil laprak</small></div><IconButton label="Tutup dokumen" onClick={onClose}><X size={17} /></IconButton></header><div className="document-side-loading"><LoaderCircle className="spin" size={18} />Memuat dokumen kerja...</div></div>;
  const exported = documentState.exports?.find((item) => item.status === 'ready' && item.content_signature === documentState.quizAccess?.contentSignature);
  const latestJob = activeJob || documentState.jobs?.[0] || null;
  const isGenerated = documentState.status === 'generated';
  const canDownload = Boolean(documentState.quizAccess?.canDownload ?? documentState.quizAccess?.passed);
  const versionOptions = [
    { value: '', label: `Versi saat ini${documentState.revision_count ? ` · Revisi ${documentState.revision_count}` : ''}` },
    ...(documentState.versions || []).map((version, index) => ({ value: version.id, label: `${version.label || `Versi ${index + 1}`} · ${formatDate(version.created_at)}` })),
  ];
  const chooseVersion = async (versionId) => {
    setSelectedVersion(versionId);
    if (!versionId) return;
    const restored = await onRestoreVersion?.(versionId);
    if (restored) setSelectedVersion('');
  };
  return <div className="document-side-shell">
    <header className="document-side-head">
      <div><small>Dokumen laprak</small><b>{documentState.title}</b></div>
      <div className="document-side-actions">
        {isGenerated && <button type="button" disabled={busy} onClick={() => (canDownload ? onDownload() : onStartQuiz())}><ArrowDownToLine size={15} />Unduh</button>}
        <IconButton label="Tutup dokumen" onClick={onClose}><X size={17} /></IconButton>
      </div>
    </header>
    <div className="document-side-scroll">
      <div className="document-version-rail">
        <span><small>Versi dokumen</small><b>{versionOptions.find((option) => option.value === selectedVersion)?.label || versionOptions[0].label}</b></span>
        <CustomSelect className="document-version-select" value={selectedVersion} onChange={chooseVersion} ariaLabel="Pilih versi dokumen" options={versionOptions} />
      </div>
      {!isGenerated && <div className="document-recovery"><p>Laprakin sedang menyiapkan dokumen ini secara otomatis. Kamu boleh menutup panel atau berpindah chat; proses akan tetap berjalan.</p><WorkPlanRail workflow={workflow} job={latestJob} documentState={documentState} /></div>}
      {isGenerated && <>
        <RenderedDocxPreview documentId={documentState.id} revision={documentState.revision_count || 0} />
        <div className="revision-chat-note"><MessageCircle size={16} /><div><b>Sudah lengkap atau perlu revisi?</b><p>Tulis perubahan di chat utama. Bagian lain akan tetap dipertahankan.</p></div></div>
      </>}
    </div>
  </div>;
}

function DocumentLibrary({ documents, onRefresh, onOpen }) { const [query, setQuery] = useState(''); const visible = documents.filter((doc) => `${doc.title} ${doc.course_name} ${doc.module_title}`.toLowerCase().includes(query.toLowerCase())); return <section className="library-page"><header><div><h1>Dokumen</h1><p>Laprak yang dibuat dari percakapanmu.</p></div><button onClick={onRefresh}>Refresh</button></header><label className="search-field"><FolderOpen size={15} /><input aria-label="Cari dokumen" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari judul, mata kuliah, atau modul" /></label><div className="library-list">{visible.length ? visible.map((doc) => <article key={doc.id}><div><span className="doc-file"><FileText size={16} /></span><div><b>{doc.title}</b><small>{doc.course_name || 'Mata kuliah belum diisi'} · {doc.status === 'generated' ? 'Dokumen siap diperiksa' : 'Dokumen sedang dibuat'}</small></div></div><button onClick={() => onOpen(doc)}>Buka chat <ArrowRight size={13} /></button></article>) : <div className="empty-library"><FolderOpen size={22} /><b>Belum ada dokumen.</b><p>Buat chat laprak, lalu pilih “Buat laprak” saat konteksnya sudah cukup.</p></div>}</div></section>; }

function ProjectsPage({ projects, selectedProject, documents, onOpenProject, onBack, onCreate, onNewChat, onOpenSession, onPinProject, onNotice }) {
  const [query, setQuery] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [tab, setTab] = useState('chats');
  const visibleProjects = projects.filter((project) => project.name.toLowerCase().includes(query.trim().toLowerCase()));
  const activeProject = projects.find((project) => project.name === selectedProject);
  useEffect(() => { setDraftTitle(''); setTab('chats'); }, [selectedProject]);

  if (selectedProject && activeProject) {
    const projectDocumentIds = new Set(activeProject.items.map((item) => item.document_id).filter(Boolean));
    const sources = documents.filter((doc) => projectDocumentIds.has(doc.id) || doc.course_name === activeProject.name);
    const startProjectChat = async (event) => {
      event.preventDefault();
      const session = await onNewChat(activeProject.name, draftTitle);
      if (session) setDraftTitle('');
    };
    return <section className="projects-page project-detail-page">
      <header className="project-detail-header">
        <button type="button" className="project-back" onClick={onBack} aria-label="Kembali ke Projects"><ArrowLeft size={17} /></button>
        <div className="project-title-wrap"><span className="project-title-icon"><FolderKanban size={19} /></span><div><h1>{activeProject.name}</h1><small>{activeProject.count} chat · Project pribadi</small></div></div>
        <div className="project-detail-actions"><IconButton label={activeProject.isPinned ? 'Lepas pin project' : 'Pin project'} onClick={() => onPinProject(activeProject, !activeProject.isPinned)}>{activeProject.isPinned ? <PinOff size={17}/> : <Pin size={17}/>}</IconButton><Button variant="secondary" onClick={() => onNotice('Project ini masih bersifat pribadi.')}>Bagikan</Button><IconButton label="Menu project" onClick={() => onNotice('Pengaturan project akan segera tersedia.')}><MoreHorizontal size={17} /></IconButton></div>
      </header>
      <form className="project-new-chat" onSubmit={startProjectChat}>
        <Plus size={18} />
         <input aria-label="Judul chat baru" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder={`Chat baru di ${activeProject.name}`} />
        <button type="submit" aria-label="Buat chat"><Send size={16} /></button>
      </form>
      <nav className="project-tabs" aria-label="Navigasi project"><button className={tab === 'chats' ? 'active' : ''} type="button" onClick={() => setTab('chats')}>Chats</button><button className={tab === 'sources' ? 'active' : ''} type="button" onClick={() => setTab('sources')}>Sumber</button></nav>
      {tab === 'chats' ? <div className="project-chat-list">{activeProject.items.length ? activeProject.items.map((session) => <button key={session.id} type="button" onClick={() => onOpenSession(session.id)}><span className="project-chat-avatar">{session.title?.slice(0, 1).toUpperCase() || 'L'}</span><div><b>{session.title || 'Chat baru'}</b><small>{session.document_id ? 'Dokumen kerja tersambung' : 'Percakapan project'} · {formatDate(session.updated_at || session.updatedAt || session.created_at || session.createdAt)}</small></div><ArrowRight size={15} /></button>) : <div className="project-empty"><MessageCircle size={22}/><b>Belum ada chat di project ini.</b><p>Buat chat pertama untuk mulai mengumpulkan bahan dan menyusun laprak.</p></div>}</div> : <div className="project-source-list">{sources.length ? sources.map((doc) => <article key={doc.id}><span><FileText size={16}/></span><div><b>{doc.title}</b><small>{doc.course_name || activeProject.name} · {doc.status || 'draft'}</small></div></article>) : <div className="project-empty"><FileText size={22}/><b>Belum ada sumber dalam project ini.</b><p>Dokumen kerja dari chat project akan muncul di sini.</p></div>}</div>}
    </section>;
  }

  return <section className="projects-page projects-index-page">
    <header className="projects-header"><div><h1>Projects</h1><p>Kelompokkan chat dan dokumen praktikum dalam satu ruang kerja.</p></div><div className="projects-head-actions"><label className="project-search"><Search size={15}/><input aria-label="Cari project" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari project" /></label><Button onClick={onCreate}><Plus size={15}/>Project baru</Button></div></header>
    <nav className="projects-filter" aria-label="Filter project"><button className="active" type="button">Semua</button><button type="button" onClick={() => onNotice('Semua project di halaman ini dibuat oleh akunmu.')}>Dibuat oleh kamu</button><button type="button" onClick={() => onNotice('Belum ada project yang dibagikan kepadamu.')}>Dibagikan dengan kamu</button></nav>
    <div className="projects-table-head"><span>Nama</span><span>Diubah</span><span aria-hidden="true" /></div>
    <div className="projects-table">{visibleProjects.length ? visibleProjects.map((project) => <article key={project.name} className="project-row"><button type="button" className="project-row-open" onClick={() => onOpenProject(project.name)}><span className="project-row-icon"><FolderKanban size={18}/></span><span className="project-row-copy"><b>{project.name}</b><small>{project.count} chat</small></span><span className="project-row-date">{formatDate(project.updatedAt)}</span></button><button type="button" className={`project-pin-button ${project.isPinned ? 'active' : ''}`} onClick={() => onPinProject(project, !project.isPinned)} aria-label={project.isPinned ? `Lepas pin ${project.name}` : `Pin ${project.name}`} title={project.isPinned ? 'Lepas pin project' : 'Pin project'}>{project.isPinned ? <PinOff size={16}/> : <Pin size={16}/>}</button></article>) : <div className="projects-empty"><FolderKanban size={26}/><b>Belum ada project.</b><p>Buat project pertamamu untuk mengelompokkan chat dan dokumen.</p><Button onClick={onCreate}><Plus size={14}/>Project baru</Button></div>}</div>
  </section>;
}

const INSTITUTION_LOGO_MAX_BYTES = 5 * 1024 * 1024;

function InstitutionLogoField({ logoUrl = '', onChanged, setNotice }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const hasStoredLogo = Boolean(logoUrl);
  const hasLogo = hasStoredLogo && !previewFailed;
  useEffect(() => { setPreviewFailed(false); }, [logoUrl]);

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    // Diperiksa juga di server; cek di sini hanya agar user tidak menunggu
    // unggahan yang pasti ditolak.
    if (file.size > INSTITUTION_LOGO_MAX_BYTES) return setNotice('Ukuran logo maksimal 5 MB.');
    if (file.type !== 'image/png' || !/\.png$/i.test(file.name)) return setNotice('Logo harus berformat PNG.');
    const body = new FormData();
    body.append('file', file);
    setBusy(true);
    try {
      await api('/profile/institution-logo', { method: 'POST', body, form: true });
      setPreviewFailed(false);
      await onChanged?.();
      setNotice('Logo institusi diperbarui.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api('/profile/institution-logo', { method: 'DELETE' });
      setPreviewFailed(false);
      await onChanged?.();
      setNotice('Logo institusi dihapus.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  };

  return <section className="settings-group institution-logo-field">
    <div className="settings-group-heading"><b>Logo institusi</b><small>Dipakai pada cover dokumen. PNG, maksimal 5 MB.</small></div>
    <div className="institution-logo-row">
      <div className={`institution-logo-preview ${hasLogo ? '' : 'is-empty'}`}>
        {hasLogo ? <img src={logoUrl} alt="Logo institusi" onError={() => setPreviewFailed(true)} /> : null}
      </div>
      <div className="institution-logo-actions">
         <input ref={inputRef} aria-label="Upload logo institusi" type="file" accept=".png,image/png" onChange={pick} hidden />
        <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Upload size={14} />{hasLogo ? 'Ganti logo' : 'Unggah logo'}
        </Button>
        {hasStoredLogo && <Button variant="secondary" onClick={remove} disabled={busy}><Trash2 size={14} />Hapus</Button>}
      </div>
    </div>
  </section>;
}

const REFERRAL_STATUS_LABEL = {
  registered: { label: 'Terdaftar', hint: 'Menunggu pembelian pertama.' },
  pending: { label: 'Menunggu masa tahan', hint: 'Bonus dilepas setelah masa tahan selesai.' },
  held: { label: 'Ditahan', hint: 'Sedang ditinjau sebelum bonus dilepas.' },
  rewarded: { label: 'Bonus diberikan', hint: 'Credit sudah masuk ke saldomu.' },
  rejected: { label: 'Tidak memenuhi syarat', hint: 'Undangan tidak memenuhi ketentuan bonus.' },
};

function ReferralSettingsPane() {
  const { user, setNotice } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');

  const load = async () => {
    setLoading(true);
    try { setData(await api('/referral')); } catch { setData(null); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const code = data?.code || user?.referralCode || '';
  const inviteLink = code ? `${window.location.origin}/auth?ref=${encodeURIComponent(code)}` : '';

  const copy = async (value, key) => {
    if (!value) return setNotice('Kode referral belum tersedia.');
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? '' : current)), 2000);
    } catch {
      setNotice(`Salin manual: ${value}`);
    }
  };

  const referrals = data?.referrals || [];
  const rewarded = referrals.filter((item) => item.status === 'rewarded').length;

  return <div className="referral-settings-pane">
    <section className="referral-code-card">
      <div className="referral-code-head"><span className="referral-code-icon"><Megaphone size={19} /></span><div><small>Kode referralmu</small><h3>{loading && !code ? '…' : code || 'Belum tersedia'}</h3></div></div>
      <div className="referral-code-actions">
        <Button variant="secondary" onClick={() => copy(code, 'code')} disabled={!code}>
          {copied === 'code' ? <><Check size={14} />Tersalin</> : <><Copy size={14} />Salin kode</>}
        </Button>
        <Button variant="secondary" onClick={() => copy(inviteLink, 'link')} disabled={!inviteLink}>
          {copied === 'link' ? <><Check size={14} />Tersalin</> : <><Copy size={14} />Salin link undangan</>}
        </Button>
      </div>
    </section>

    <section className="referral-terms">
      <b>Cara bonus dihitung</b>
      <ul>
        <li>Temanmu memasukkan kodemu saat mendaftar.</li>
        <li>Bonus aktif setelah temanmu belanja minimal Rp29.900 atau berlangganan Pro.</li>
        <li>Credit masuk setelah masa tahan selesai, untuk memastikan transaksinya sah.</li>
        <li>Akun yang dibuat dari perangkat yang sama tidak dihitung.</li>
      </ul>
    </section>

    <section className="referral-list">
      <div className="referral-list-head">
        <div><b>Undangan</b><small>{loading ? 'Memuat…' : `${referrals.length} terdaftar · ${rewarded} berbonus`}</small></div>
        <button type="button" onClick={load} disabled={loading}><RefreshCw size={13} />Muat ulang</button>
      </div>
      {!loading && !referrals.length && <p className="referral-empty">Belum ada yang mendaftar memakai kodemu. Bagikan link undangan di atas untuk mulai.</p>}
      {referrals.map((item) => {
        const status = REFERRAL_STATUS_LABEL[item.status] || { label: item.status, hint: '' };
        return <article key={item.id} className="referral-row">
          <div><b>{item.email}</b><small>{status.hint || item.rejection_reason || ''}</small></div>
          <span className={`referral-status referral-status-${item.status}`}>{status.label}</span>
        </article>;
      })}
    </section>
  </div>;
}

function BillingSettingsPane({ onOpenBilling }) {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); try { setBilling(await api('/billing')); } catch { setBilling(null); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const currentPlan = billing?.currentPlan || {};
  const transactionCount = billing?.transactions?.length || 0;
  const availableCredits = billing?.wallet?.balances?.total ?? billing?.balances?.total ?? '—';
  return <div className="billing-settings-pane billing-settings-history-pane">
    <section className="billing-overview-card">
      <span className="billing-overview-icon"><CreditCard size={19} /></span>
      <div><small>Plan aktif</small><h3>{currentPlan.label || currentPlan.name || 'Free plan'}</h3><p>Kelola plan dan credit tanpa meninggalkan riwayat transaksi akunmu.</p></div>
      <Button onClick={onOpenBilling}>Kelola plan <ArrowRight size={14} /></Button>
    </section>
    <div className="billing-summary-grid">
      <article><span>Credit tersedia</span><b>{availableCredits}</b><small>Dipakai saat proses dokumen berjalan.</small></article>
      <article><span>Transaksi</span><b>{loading ? '…' : transactionCount}</b><small>Tercatat pada akun ini.</small></article>
    </div>
    <section className="settings-billing-history">
      <div className="settings-billing-history-head"><div><b>Riwayat transaksi</b><small>Pembayaran dan perubahan credit</small></div><button type="button" onClick={load} disabled={loading}><RefreshCw size={13} />Muat ulang</button></div>
      {loading ? <div className="settings-loading-state"><LoaderCircle className="spin" size={16} />Memuat riwayat...</div> : billing?.transactions?.length ? <div>{billing.transactions.map((item) => <article key={item.id}><span className="transaction-mark">{item.kind === 'payment' || item.kind === 'subscription' ? <CreditCard size={13} /> : <Sparkles size={13} />}</span><div><b>{item.title}</b><small>{item.detail}</small></div><div><strong>{item.amountLabel}</strong><small>{formatDate(item.createdAt)}</small></div></article>)}</div> : <div className="settings-empty-state"><CreditCard size={18} /><div><b>Belum ada transaksi</b><p>Riwayat pembayaran akan muncul di sini setelah checkout pertama.</p></div></div>}
    </section>
  </div>;
}

function validatedMidtransCheckoutUrl(checkoutUrl) {
  if (!checkoutUrl) return '';
  try {
    const target = new URL(checkoutUrl);
    const allowedHosts = new Set(['app.midtrans.com', 'app.sandbox.midtrans.com']);
    if (target.protocol !== 'https:' || !allowedHosts.has(target.hostname)) return '';
    return target.href;
  } catch {
    return '';
  }
}

function redirectToMidtransCheckout(checkoutUrl) {
  const target = validatedMidtransCheckoutUrl(checkoutUrl);
  if (!target) return false;
  try {
    window.location.assign(target);
    return true;
  } catch {
    return false;
  }
}

function BillingPage() {
  const { user, setNotice, refreshSession, prefs } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedPlanFromLink = new URLSearchParams(location.search).get('plan') || '';
  const [data, setData] = useState(null);
  const [pricing, setPricing] = useState(pricingFallback);
  const [gateway, setGateway] = useState(null);
  const [subscriptionChoice, setSubscriptionChoice] = useState('none');
  const billingPrefs = prefs;
  const billingTheme = useResolvedTheme(billingPrefs.theme || 'system');
  const [quote, setQuote] = useState(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [checkoutRecoveryUrl, setCheckoutRecoveryUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [billing, nextPricing, paymentConfig] = await Promise.all([
        api('/billing'),
        api('/pricing', { includeCsrf: false }),
        api('/payments/config', { includeCsrf: false }),
      ]);
      setData(billing);
      setPricing(nextPricing || pricingFallback);
      setGateway(paymentConfig);
      const pending = (billing.orders || []).find((order) => ['created', 'pending'].includes(order.status));
      if (pending) setActiveOrder((current) => current?.id === pending.id ? current : { ...pending, canRefresh: true });
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (['monthly', 'pro'].includes(selectedPlanFromLink)) setSubscriptionChoice(selectedPlanFromLink);
  }, [selectedPlanFromLink]);

  // Snap may use a full-page redirect on some browsers. Remember the internal
  // order id locally so the billing page can show an authoritative status after
  // the customer returns; the server still performs the verification.
  useEffect(() => {
    const orderId = window.sessionStorage.getItem('laprakin:active-payment-order');
    if (!orderId) return;
    const returnedFromSnap = new URLSearchParams(window.location.search).get('payment') === 'finished';
    if (returnedFromSnap) getOrder(orderId, true);
    else getOrder(orderId, false);
  }, []);

  const cartItems = useMemo(() => {
    if (subscriptionChoice === 'monthly' || subscriptionChoice === 'pro') return [{ sku: subscriptionChoice, quantity: 1 }];
    return [];
  }, [subscriptionChoice]);
  const cartKey = cartItems.map((item) => `${item.sku}:${item.quantity}`).join('|');

  useEffect(() => {
    let cancelled = false;
    if (!cartItems.length) { setQuote(null); return undefined; }
    setQuoteBusy(true);
    api('/pricing/quote', { method: 'POST', body: { items: cartItems } })
      .then((next) => { if (!cancelled) setQuote(next); })
      .catch((err) => { if (!cancelled) { setQuote(null); setError(err.message); } })
      .finally(() => { if (!cancelled) setQuoteBusy(false); });
    return () => { cancelled = true; };
  }, [cartKey]);

  const plan = data?.currentPlan || { key: 'free', label: 'Gratis', status: 'active', credits: 0, endsAt: null, description: 'Paket awal untuk mencoba Laprakin.' };
  const catalogue = {
    free: { key: 'free', label: 'Gratis', price: 0, description: 'Mulai dan pahami alur kerja Laprakin.', features: pricingFeatures(pricing.free, pricingFallback.free.features) },
    monthly: { key: 'monthly', label: 'Pro', price: pricing.monthly?.price || 29900, description: 'Untuk kebutuhan praktikum yang rutin.', features: pricingFeatures(pricing.monthly, pricingFallback.monthly.features) },
    pro: { key: 'pro', label: 'Max', price: pricing.pro?.price || 45900, description: 'Untuk semester padat dan revisi intensif.', features: pricingFeatures(pricing.pro, pricingFallback.pro.features) },
  };
  const paymentStatusCopy = {
    created: 'Menyiapkan checkout QRIS.',
    pending: 'Menunggu pembayaran. Scan QRIS yang muncul di checkout Midtrans.',
    paid: 'Pembayaran berhasil. Credit atau plan telah diaktifkan oleh server.',
    failed: 'Pembayaran ditolak. Pilih checkout QRIS baru bila ingin mencoba lagi.',
    expired: 'Kode QRIS sudah kedaluwarsa. Buat checkout QRIS baru.',
    canceled: 'Checkout dibatalkan. Belum ada credit atau plan yang ditambahkan.',
    refunded: 'Refund tercatat. Status entitlement ditinjau sesuai kebijakan refund.',
  };

  const updateOrder = async (order, successNotice = '') => {
    setActiveOrder(order);
    if (order?.id && ['created', 'pending'].includes(order.status)) {
      window.sessionStorage.setItem('laprakin:active-payment-order', order.id);
    }
    if (order?.id && ['paid', 'failed', 'expired', 'canceled', 'refunded'].includes(order.status)) {
      window.sessionStorage.removeItem('laprakin:active-payment-order');
    }
    if (order?.status === 'paid') {
      await refreshSession();
      await load();
      setNotice(successNotice || 'Pembayaran QRIS berhasil diverifikasi. Plan atau credit sudah aktif.');
      navigate('/app', { replace: true });
    }
  };

  const getOrder = async (orderId, verifyWithGateway = false) => {
    try {
      setBusy(verifyWithGateway);
      const response = verifyWithGateway
        ? await api(`/payments/orders/${orderId}/refresh`, { method: 'POST', body: {} })
        : await api(`/payments/orders/${orderId}`, { includeCsrf: false });
      await updateOrder(response.order, verifyWithGateway && response.order?.status === 'paid' ? 'Pembayaran QRIS berhasil diverifikasi.' : 'Status pembayaran diperbarui.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!activeOrder?.id || !['created', 'pending'].includes(activeOrder.status)) return undefined;
    const timer = window.setInterval(() => { getOrder(activeOrder.id, false); }, 10_000);
    return () => window.clearInterval(timer);
  }, [activeOrder?.id, activeOrder?.status]);

  const checkout = async () => {
    if (!cartItems.length) { setError('Tambahkan plan atau credit ke keranjang terlebih dahulu.'); return; }
    if (!user?.emailVerified) { setError('Verifikasi email sebelum melakukan pembayaran.'); return; }
    setBusy(true);
    setError('');
    setCheckoutRecoveryUrl('');
    try {
      const payload = await api('/payments/checkout', { method: 'POST', body: { items: cartItems } });
      if (payload.mode === 'manual') {
        await updateOrder(payload.order, 'Checkout QRIS lokal diproses untuk pengujian.');
        return;
      }
      await updateOrder(payload.order);
      window.sessionStorage.setItem('laprakin:active-payment-order', payload.orderId);
      const checkoutUrl = validatedMidtransCheckoutUrl(payload.checkoutUrl);
      if (!checkoutUrl) {
        throw new Error('URL checkout QRIS dari gateway tidak valid.');
      }
      setCheckoutRecoveryUrl(checkoutUrl);
      if (!redirectToMidtransCheckout(checkoutUrl)) {
        throw new Error('Navigasi otomatis diblokir browser. Buka checkout QRIS lewat tombol di bawah.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const selectSubscription = (key) => { setSubscriptionChoice(key === 'free' ? 'none' : key); setError(''); };
  return <div className={`billing-portal pricing-only ${billingTheme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
    <header className="pricing-only-nav"><button className="billing-back" onClick={() => navigate('/app')} aria-label="Kembali ke workspace"><ArrowLeft size={18} /></button></header>
    <main className="pricing-only-main">
      <section className="pricing-only-copy"><h1>Pilih plan yang pas untukmu.</h1><p>Naikkan kapasitas Laprakin saat kamu membutuhkannya.</p></section>
      <section className="pricing-only-grid">
        {['free', 'monthly', 'pro'].map((key) => {
          const item = catalogue[key];
          const current = plan.key === key;
          const isSelected = subscriptionChoice === key;
          const paid = key !== 'free';
          return <article key={key} className={`pricing-only-card ${current ? 'current' : ''} ${isSelected ? 'selected' : ''}`} onClick={() => paid && selectSubscription(key)}>
            <div className="pricing-only-card-top"><span className="pricing-only-marker" aria-hidden="true" /><small>{current ? 'Plan aktif' : key === 'free' ? 'Mulai gratis' : 'Individual'}</small></div>
            <h2>{item.label}</h2><p>{item.description}</p>
            <div className="pricing-only-price"><b>{key === 'free' ? 'Rp0' : formatCurrency(item.price)}</b>{key !== 'free' && <span>/ 30 hari</span>}</div>
            <button type="button" className={current || !paid ? 'muted' : ''} onClick={(event) => { event.stopPropagation(); if (paid) selectSubscription(key); }}>
              {current ? `${item.label} aktif` : !paid ? 'Plan dasar' : isSelected ? 'Dipilih' : `Pilih ${item.label}`}
            </button>
            <ul>{item.features.map((feature) => <li key={feature}><Check size={14}/>{feature}</li>)}</ul>
          </article>;
        })}
      </section>
      {subscriptionChoice !== 'none' && <section className="pricing-only-checkout"><div><small>Checkout QRIS</small><b>{quoteBusy ? 'Menghitung…' : quote?.displayTotal || 'Rp0'}</b><span>{quote?.items?.[0]?.label || 'Plan pilihanmu'} · berlaku 30 hari</span></div><Button onClick={checkout} disabled={busy || quoteBusy || !gateway?.enabled}>{busy ? <LoaderCircle className="spin" size={15}/> : <CreditCard size={15}/>} {gateway?.enabled ? 'Bayar dengan QRIS' : 'Gateway belum aktif'}</Button></section>}
      {activeOrder && <div className={`pricing-only-status ${activeOrder.status || 'pending'}`}><div><b>{activeOrder.statusLabel || paymentStatusCopy[activeOrder.status] || 'Status pembayaran'}</b><p>{paymentStatusCopy[activeOrder.status] || 'Status pembayaran sedang diproses.'}</p></div>{activeOrder.canRefresh !== false && ['created', 'pending'].includes(activeOrder.status) ? <Button variant="secondary" onClick={() => getOrder(activeOrder.id, true)} disabled={busy}><RefreshCw size={14}/> Refresh status</Button> : <CheckCircle2 size={20}/>}</div>}
      {error && <div className="billing-inline-error"><CircleAlert size={16}/><span>{error}</span>{checkoutRecoveryUrl && <a href={checkoutRecoveryUrl}>Buka checkout QRIS</a>}</div>}
    </main>
  </div>;
}

function AccentPicker({ value, onChange, resolvedTheme = 'dark' }) {
  const lightMode = resolvedTheme === 'light';
  return <div className="accent-picker" role="radiogroup" aria-label="Warna aksen workspace">
    {workspaceAccents.map((accent) => {
      const unavailable = lightMode && DARK_ONLY_ACCENTS.has(accent.key);
      return <button
        key={accent.key}
        type="button"
        role="radio"
        aria-label={unavailable ? `${accent.label} (hanya tersedia pada tema gelap)` : accent.label}
        title={unavailable ? `${accent.label} tidak terbaca pada tema terang. Tersedia kembali di tema gelap.` : accent.label}
        aria-checked={value === accent.key}
        disabled={unavailable}
        className={`${value === accent.key ? 'selected' : ''}${unavailable ? ' accent-unavailable' : ''}`.trim()}
        onClick={() => onChange(accent.key)}
        style={{ '--accent-swatch': accent.color }}
      >
        <span className="accent-swatch">{value === accent.key && !unavailable && <Check size={13} />}</span>
      </button>;
    })}
  </div>;
}

function ThemePicker({ value, onChange }) {
  const themes = [
    { key: 'system', label: 'Ikuti sistem', icon: Monitor },
    { key: 'light', label: 'Tema terang', icon: Sun },
    { key: 'dark', label: 'Tema gelap', icon: Moon },
  ];
  return <div className="theme-picker" role="radiogroup" aria-label="Tema workspace">
    {themes.map(({ key, label, icon: Icon }) => <button key={key} type="button" role="radio" aria-label={label} title={label} aria-checked={value === key} className={value === key ? 'selected' : ''} onClick={() => onChange(key)}><Icon size={15} /></button>)}
  </div>;
}

function SettingsPaneHeader({ eyebrow, title, description }) {
  return <header className="settings-pane-header"><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p></header>;
}

function SettingsModal({ onClose, onSaved, onArchivedChanged, onOpenBilling, prefs, setPrefs, initialTab = 'general' }) {
  const { user, setNotice, refreshSession, showDialog } = useApp();
  const settingsTheme = useResolvedTheme(prefs?.theme || 'system');
  const [tab, setTab] = useState(initialTab);
  const [form, setForm] = useState({ nickname: user.nickname || '', fullName: user.fullName || '', nim: user.nim || '', className: user.className || '', institutionName: user.institutionName || '', institutionLogoUrl: user.institutionLogoUrl || '', facultyName: user.facultyName || '', studyProgramName: user.studyProgramName || '', lecturerName: user.lecturerName || '', lecturerNip: user.lecturerNip || '', departmentKey: user.departmentKey || '', studyProgramKey: user.studyProgramKey || '' });
  const [storage, setStorage] = useState(null);
  const [storageBusy, setStorageBusy] = useState('');
  const [safetyStatus, setSafetyStatus] = useState(null);
  const [archivedChats, setArchivedChats] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [settingsQuery, setSettingsQuery] = useState('');
  const loadStorage = async () => { try { setStorage(await api('/storage/summary')); } catch { setStorage(null); } };
  useEffect(() => { loadStorage(); api('/safety/status').then(setSafetyStatus).catch(() => setSafetyStatus(null)); }, []);
  useEffect(() => setTab(initialTab), [initialTab]);
  const loadArchivedChats = async () => {
    setArchivedLoading(true);
    try { const data = await api('/chat/sessions/archived'); setArchivedChats(data.sessions || []); }
    catch (err) { setNotice(err.message); }
    finally { setArchivedLoading(false); }
  };
  useEffect(() => { if (tab === 'archived') loadArchivedChats(); }, [tab]);
  const updatePrefs = (patch) => setPrefs((value) => ({ ...value, ...patch }));
  const saveNickname = async () => {
    setBusy(true);
    try {
      await api('/profile', { method: 'PUT', body: { nickname: form.nickname.trim() } });
      await onSaved();
      setNotice(form.nickname.trim() ? 'Nama panggilan disimpan.' : 'Sapaan kembali memakai nama depan.');
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };
  const saveAcademic = async () => { setBusy(true); try { await api('/profile', { method: 'PUT', body: { fullName: form.fullName, nim: form.nim, className: form.className, institutionName: form.institutionName, facultyName: form.facultyName, studyProgramName: form.studyProgramName, lecturerName: form.lecturerName, lecturerNip: form.lecturerNip, departmentKey: form.departmentKey, studyProgramKey: form.studyProgramKey } }); await onSaved(); setNotice('Profil akademik disimpan.'); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const requestPasswordChange = async () => { setBusy(true); try { await api('/auth/password-change-request', { method: 'POST', body: {} }); setNotice('Link verifikasi perubahan kata sandi sudah dikirim ke email akunmu.'); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const restoreArchivedChat = async (sessionId) => {
    setBusy(true);
    try {
      await api(`/chat/sessions/${sessionId}/restore`, { method: 'POST', body: {} });
      await loadArchivedChats();
      await onArchivedChanged?.();
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  };
  const logoutAll = async () => { const confirmed = await showDialog({ kind: 'confirm', title: 'Keluar dari semua perangkat?', message: 'Sesi di perangkat lain akan diakhiri. Perangkat ini tetap dapat melanjutkan setelah refresh.', confirmLabel: 'Akhiri sesi' }); if (!confirmed) return; setBusy(true); try { await api('/auth/logout-all', { method: 'POST' }); clearCsrfToken(); await refreshSession(); setNotice('Semua sesi sudah diakhiri.'); onClose(); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const exportData = async () => { try { await download('/privacy/data-export', 'laprakin-data.json'); setNotice('Ringkasan data berhasil diunduh.'); } catch (err) { setNotice(err.message); } };
  const deleteStorageFile = async (file) => {
    const confirmed = await showDialog({ kind: 'confirm', title: 'Hapus file?', message: `${file.name || 'File ini'} akan dihapus dari penyimpanan akunmu.`, confirmLabel: 'Hapus', destructive: true });
    if (!confirmed) return;
    setStorageBusy(file.id);
    try {
      await api(`/storage/files/${file.kind}/${file.id}`, { method: 'DELETE', body: {} });
      await loadStorage();
      setNotice('File dihapus dari penyimpanan.');
    } catch (err) {
      setNotice(err.message);
    } finally {
      setStorageBusy('');
    }
  };
  const deleteAccount = async () => { if (deleteConfirm !== user.email) return setNotice('Masukkan email akun dengan tepat untuk melanjutkan.'); setBusy(true); try { await api('/me', { method: 'DELETE', body: { confirmation: deleteConfirm } }); clearCsrfToken(); await refreshSession(); onClose(); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const tabs = [
    { key: 'general', label: 'Umum', icon: Settings2, title: 'Tampilan workspace', description: 'Atur tema, kepadatan, bahasa, dan warna aksen.' },
    { key: 'notifications', label: 'Notifikasi', icon: BellRing, title: 'Notifikasi yang berguna', description: 'Pilih kabar yang benar-benar perlu muncul.' },
    { key: 'personalization', label: 'Personalisasi', icon: Sliders, title: 'Cara Laprakin menulis', description: 'Jadikan preferensi ini sebagai titik awal untuk chat baru.' },
    { key: 'billing', label: 'Billing', icon: CreditCard, title: 'Plan dan transaksi', description: 'Lihat status plan, credit, dan histori pembayaran.' },
    { key: 'referral', label: 'Referral', icon: Megaphone, title: 'Ajak teman pakai Laprakin', description: 'Bagikan kodemu dan pantau status bonus tiap undangan.' },
    { key: 'data', label: 'Kontrol data', icon: Database, title: 'Data tetap dalam kendalimu', description: 'Atur pemrosesan eksternal dan unduh ringkasan data.' },
    { key: 'storage', label: 'Penyimpanan', icon: FolderOpen, title: 'Penggunaan penyimpanan', description: 'Pantau file yang tersimpan pada workspace.' },
    { key: 'archived', label: 'Chat diarsipkan', icon: Archive, title: 'Chat diarsipkan', description: 'Lihat dan pulihkan percakapan yang pernah kamu arsipkan.' },
    { key: 'safety', label: 'Safety', icon: Shield, title: 'Batas penggunaan yang jelas', description: 'Laprakin membantu menyusun, bukan memalsukan hasil akademik.' },
    { key: 'security', label: 'Keamanan & login', icon: LockKeyhole, title: 'Akses akun', description: 'Kelola kata sandi dan sesi perangkat.' },
    { key: 'academic', label: 'Profil akademik', icon: UserRound, title: 'Jurusan dan program studi', description: 'Dipakai sebagai konteks awal tanpa mengunci struktur tugas.' },
    { key: 'keyboard', label: 'Keyboard', icon: Keyboard, title: 'Interaksi dan gerakan', description: 'Sesuaikan cara mengirim pesan dan intensitas animasi.' },
  ];
  const activeTab = tabs.find((item) => item.key === tab) || tabs[0];
  const visibleTabs = tabs.filter((item) => `${item.label} ${item.title}`.toLocaleLowerCase().includes(settingsQuery.trim().toLocaleLowerCase()));
  const Row = ({ title, description, children, className = '' }) => <div className={`settings-row ${className}`}><div><b>{title}</b>{description && <small>{description}</small>}</div>{children}</div>;
  const storagePercentage = storage?.limitBytes ? Math.min(100, Math.round((storage.usedBytes / storage.limitBytes) * 100)) : 0;

  return <Modal title="Settings" onClose={onClose} className="settings-modal settings-reference settings-v2">
    <div className="settings-layout">
      <nav className="settings-side" aria-label="Navigasi settings">
        <div className="settings-side-head"><div><b>Settings</b><small>Workspace pribadi</small></div><IconButton label="Tutup settings" className="settings-close" onClick={onClose}><X size={18} /></IconButton></div>
        <label className="settings-sidebar-search"><Search size={14}/><input value={settingsQuery} onChange={(event) => setSettingsQuery(event.target.value)} placeholder="Cari pengaturan" aria-label="Cari pengaturan" />{settingsQuery && <button type="button" onClick={() => setSettingsQuery('')} aria-label="Hapus pencarian"><X size={12}/></button>}</label>
        <div className="settings-nav-list">{visibleTabs.map(({ key, label, icon: Icon }) => <button type="button" key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><Icon size={16} /><span>{label}</span></button>)}</div>
        <div className="settings-account-mini"><span>{userInitials(user)}</span><div><b>{user.fullName || user.email.split('@')[0]}</b><small>{user.email}</small></div></div>
      </nav>
      <div className="settings-content">
        <SettingsPaneHeader eyebrow={activeTab.label} title={activeTab.title} description={activeTab.description} />
         {tab === 'general' && <div className="settings-pane">
           <section className="settings-group"><div className="settings-group-heading"><b>Appearance</b><small>Perubahan diterapkan langsung.</small></div><Row title="Tema" className="theme-settings-row"><ThemePicker value={prefs.theme || 'system'} onChange={(value) => updatePrefs({ theme: value })} /></Row><Row title="Kontras"><CustomSelect ariaLabel="Kontras workspace" value={prefs.contrast || 'default'} onChange={(value) => updatePrefs({ contrast: value })} options={[{ value: 'default', label: 'Default' }, { value: 'high', label: 'Tinggi' }]} /></Row><Row title="Bahasa"><CustomSelect ariaLabel="Bahasa workspace" value={prefs.language || 'id'} onChange={(value) => updatePrefs({ language: value })} options={[{ value: 'id', label: 'Bahasa Indonesia' }, { value: 'en', label: 'English' }]} /></Row></section>
          <section className="settings-group accent-settings-group"><div className="settings-group-heading"><b>Warna aksen</b><small>Dipakai untuk tombol utama dan status aktif—bukan seluruh hover.</small></div><AccentPicker value={prefs.accent || 'lime'} onChange={(accent) => updatePrefs({ accent })} resolvedTheme={settingsTheme} /></section>
          <Toggle checked={prefs.compact} onChange={(checked) => updatePrefs({ compact: checked })} title="Workspace ringkas" description="Rapatkan sidebar, toolbar, dan area percakapan." />
        </div>}
        {tab === 'notifications' && <div className="settings-pane"><section className="settings-group"><Toggle checked={prefs.jobNotifications !== false} onChange={(checked) => updatePrefs({ jobNotifications: checked })} title="Proses dokumen" description="Beritahu saat analisis, draft, atau export selesai." /><Toggle checked={prefs.deadlineNotifications !== false} onChange={(checked) => updatePrefs({ deadlineNotifications: checked })} title="Deadline tugas" description="Pengingat ringan untuk dokumen yang memiliki tenggat." /><Toggle checked={prefs.productUpdates !== false} onChange={(checked) => updatePrefs({ productUpdates: checked })} title="Update produk" description="Hanya perubahan fitur beta yang penting." /></section></div>}
         {tab === 'personalization' && <div className="settings-pane"><section className="settings-group nickname-settings"><div className="settings-group-heading"><b>Nama panggilan</b><small>Dipakai hanya untuk menyapamu di halaman chat. Kosongkan untuk memakai nama depan.</small></div><div className="nickname-settings-control"><label aria-label="Sapaan"><input aria-label="Nama panggilan" value={form.nickname} maxLength={20} autoComplete="nickname" onChange={(event) => setForm({ ...form, nickname: event.target.value })} placeholder={userGreetingName({ ...user, nickname: '' })} /></label><small>{form.nickname.length}/20</small><Button type="button" variant="secondary" onClick={saveNickname} disabled={busy}><Save size={14}/>Simpan</Button></div></section><section className="settings-group"><Row title="Gaya bahasa"><CustomSelect ariaLabel="Gaya bahasa" value={prefs.tone || 'formal'} onChange={(value) => updatePrefs({ tone: value })} options={[{ value: 'formal', label: 'Formal' }, { value: 'semi-formal', label: 'Semi-formal' }]} /></Row><Row title="Sudut pandang"><CustomSelect ariaLabel="Sudut pandang" value={prefs.perspective || 'saya'} onChange={(value) => updatePrefs({ perspective: value })} options={[{ value: 'saya', label: 'Saya' }, { value: 'kita', label: 'Kita' }, { value: 'impersonal', label: 'Impersonal' }]} /></Row><Row title="Struktur awal"><CustomSelect ariaLabel="Struktur awal" value={prefs.profile || 'langkah'} onChange={(value) => updatePrefs({ profile: value })} options={[{ value: 'langkah', label: 'Berbasis langkah' }, { value: 'pengujian', label: 'Berbasis pengujian' }, { value: 'proyek', label: 'Berbasis proyek' }]} /></Row></section><label className="settings-textarea"><span>Instruksi tambahan</span><small>Selalu dikirim sebagai acuan AI untuk chat dan generate laprak.</small><textarea aria-label="Instruksi tambahan" value={prefs.customInstructions || ''} onChange={(event) => updatePrefs({ customInstructions: event.target.value })} placeholder="Contoh: gunakan bahasa teknis yang ringkas." /></label></div>}
        {tab === 'billing' && <BillingSettingsPane onOpenBilling={onOpenBilling} />}
        {tab === 'referral' && <ReferralSettingsPane />}
        {tab === 'data' && <div className="settings-pane"><section className="settings-group"><Row title="Salinan data" description="Unduh profil, preferensi, dan ringkasan aktivitas akun."><Button variant="secondary" onClick={exportData}><ArrowDownToLine size={14}/>Unduh data</Button></Row></section><p className="settings-privacy-note"><ShieldCheck size={15}/>Semua data dan pemrosesan dijamin kerahasiaannya karena tersimpan dan diproses dengan perlindungan enkripsi.</p>
          {/* Hapus akun berada satu tab dengan unduh data: urutan yang benar
          adalah mengunduh salinan lebih dulu, baru menghapus. */}
          <section className="settings-danger-zone">
            <div><b>Hapus akun</b><p>Unduh data yang diperlukan terlebih dahulu. Tindakan ini tidak dapat dibatalkan.</p></div>
            <input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} placeholder={user.email} aria-label="Ketik email akun untuk konfirmasi" />
            <Button variant="danger" onClick={deleteAccount} disabled={busy || deleteConfirm !== user.email}>Hapus akun</Button>
          </section>
        </div>}
        {tab === 'storage' && <div className="settings-pane">{storage ? <><div className="storage-overview"><div><span>Terpakai</span><b>{formatBytes(storage.usedBytes)}</b><small>dari {formatBytes(storage.limitBytes)}</small></div><strong>{storagePercentage}%</strong></div><div className="storage-meter"><i><em style={{ width: `${storagePercentage}%` }} /></i></div><div className="storage-cards"><span><FolderOpen size={17}/><b>{storage.tier === 'pro' ? 'Pro' : storage.tier === 'subscription' ? 'Subscription' : storage.tier === 'paid' ? 'Satuan' : 'Gratis'}</b><small>{storage.retentionHint}</small></span><span><FileText size={17}/><b>Yang dihitung</b><small>Modul, bukti, template, data, dan export DOCX.</small></span></div><section className="settings-group storage-file-manager"><div className="settings-group-heading"><b>File tersimpan</b><small>{storage.files?.length || 0} file bisa dikelola</small></div>{storage.files?.length ? <div className="storage-file-list">{storage.files.map((file) => <article key={`${file.kind}-${file.id}`}><FileText size={15}/><div><b>{file.name}</b><small>{file.sourceLabel} · {formatBytes(file.sizeBytes)} · {formatDate(file.createdAt)}</small></div><Button variant="secondary" onClick={() => deleteStorageFile(file)} disabled={Boolean(storageBusy)}>{storageBusy === file.id ? <LoaderCircle className="spin" size={14}/> : <Trash2 size={14}/>}Hapus</Button></article>)}</div> : <div className="settings-empty-state"><FolderOpen size={18}/><div><b>Belum ada file tersimpan</b><p>File modul, bukti, data, dan export akan muncul di sini.</p></div></div>}</section></> : <div className="settings-loading-state"><LoaderCircle className="spin" size={16}/>Memuat ringkasan penyimpanan...</div>}<p className="settings-footnote">Chat teks dan preferensi tidak dihitung sebagai penyimpanan file.</p></div>}
        {tab === 'safety' && <div className="settings-pane safety-settings-pane">
          <section className={`safety-account-status ${safetyStatus?.hasAlert ? 'has-alert' : ''}`}>{safetyStatus ? safetyStatus.hasAlert ? <><CircleAlert size={20}/><div><b>Akun sedang mendapat alert</b><p>Ada aktivitas akun yang perlu kamu periksa.</p><small>{safetyStatus.openAlerts} alert terbuka</small></div></> : <><ShieldCheck size={20}/><div><b>Tidak ada alert pada akun</b><p>Penggunaan akunmu tidak sedang memiliki sinyal safety terbuka.</p><small>Status terakhir diperbarui otomatis.</small></div></> : <><LoaderCircle className="spin" size={18}/><div><b>Memuat status akun</b><p>Safety status sedang diperiksa.</p></div></>}</section>
          {safetyStatus?.hasAlert && Boolean(safetyStatus.reasons?.length) && <section className="safety-reasons-panel"><b>Alasan alert</b><ul className="safety-reason-list">{safetyStatus.reasons.map((item, index) => <li key={`${item.createdAt || ''}-${index}`}>{item.reason}</li>)}</ul></section>}
        </div>}
        {tab === 'security' && <div className="settings-pane">
          {String(user.authProvider || 'password').includes('google') && <section className="settings-group"><Row title="Google terhubung" description="Akun Google ini dapat dipakai untuk masuk tanpa kata sandi."><span className="settings-connected-status"><CheckCircle2 size={14}/>Aktif</span></Row></section>}
          <section className="settings-group"><div className="settings-group-heading"><b>{user.authProvider === 'google' ? 'Buat kata sandi Laprakin' : 'Ubah kata sandi'}</b><small>Untuk keamanan, verifikasi dilakukan melalui link yang dikirim ke {user.email}.</small></div><Button type="button" variant="secondary" onClick={requestPasswordChange} disabled={busy}><Mail size={14}/>Kirim link verifikasi</Button></section>
          <section className="settings-group"><Row title="Keluar dari semua perangkat" description="Gunakan setelah login dari perangkat umum."><Button variant="secondary" onClick={logoutAll} disabled={busy}>Akhiri semua sesi</Button></Row></section>
        </div>}
        {tab === 'archived' && <div className="settings-pane"><section className="archived-chat-settings">{archivedLoading ? <div className="settings-loading-state"><LoaderCircle className="spin" size={16}/>Memuat chat arsip...</div> : archivedChats.length ? <div className="archived-chat-list">{archivedChats.map((session) => <article key={session.id}><span className="archived-chat-icon"><Archive size={16}/></span><div><b>{session.title || 'Chat baru'}</b><small>{session.course_group || 'Belum dikelompokkan'}</small><time>{formatDate(session.archived_at || session.updated_at)}</time></div><Button type="button" variant="secondary" disabled={busy} onClick={() => restoreArchivedChat(session.id)}>Pulihkan</Button></article>)}</div> : <div className="settings-empty-state"><Archive size={18}/><div><b>Belum ada chat diarsipkan</b><p>Chat yang kamu arsipkan dari sidebar akan muncul di sini.</p></div></div>}</section></div>}
        {tab === 'academic' && <div className="settings-pane">
          <section className="settings-group academic-settings-form academic-settings-wide">
             <label><span>Nama lengkap</span><input aria-label="Nama lengkap" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Nama pada cover" /></label>
             <label><span>NPM / NIM</span><input aria-label="NPM / NIM" value={form.nim} onChange={(event) => setForm({ ...form, nim: event.target.value })} placeholder="Nomor mahasiswa" /></label>
             <label><span>Kelas</span><input aria-label="Kelas" value={form.className} onChange={(event) => setForm({ ...form, className: event.target.value })} placeholder="Kelas anda" /></label>
             <label><span>Univ / institusi</span><input aria-label="Univ / institusi" value={form.institutionName} onChange={(event) => setForm({ ...form, institutionName: event.target.value })} placeholder="Nama kampus" /></label>
             <label><span>Fakultas / Jurusan</span><input aria-label="Fakultas / Jurusan" value={form.facultyName} onChange={(event) => setForm({ ...form, facultyName: event.target.value })} placeholder="Fakultas atau jurusan" /></label>
             <label><span>Program studi</span><input aria-label="Program studi" value={form.studyProgramName} onChange={(event) => setForm({ ...form, studyProgramName: event.target.value })} placeholder="Program studi" /></label>
            <Button onClick={saveAcademic} disabled={busy}><Save size={14}/>Simpan profil akademik</Button>
          </section>
          <InstitutionLogoField logoUrl={user.institutionLogoUrl || ''} onChanged={onSaved} setNotice={setNotice} />
        </div>}
        {tab === 'keyboard' && <div className="settings-pane"><section className="settings-group"><Toggle checked={prefs.enterToSend !== false} onChange={(checked) => updatePrefs({ enterToSend: checked })} title="Enter untuk kirim" description="Gunakan Shift + Enter untuk membuat baris baru." /><Toggle checked={prefs.reducedMotion} onChange={(checked) => updatePrefs({ reducedMotion: checked })} title="Kurangi animasi" description="Pertahankan feedback penting dengan gerakan yang lebih singkat." /></section></div>}
      </div>
    </div>
  </Modal>;
}

function HelpModal({ onClose }) {
  const { setNotice } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const quickTopics = ['File gagal diunggah', 'Export DOCX', 'Billing dan credit', 'Privasi file'];
  useEffect(() => { api('/support/thread').then((data) => setMessages(data.messages || [])).catch((err) => setNotice(err.message)); }, []);
  const send = async (event) => { event.preventDefault(); if (!input.trim()) return; setBusy(true); try { const data = await api('/support/message', { method: 'POST', body: { content: input.trim() } }); setMessages(data.messages || []); setInput(''); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  return <Modal title="Bantuan" onClose={onClose} className="support-modal support-modal-v2">
    <div className="support-intro"><span><HelpCircle size={20}/></span><div><h2>Apa yang bisa kami bantu?</h2><p>Tanyakan soal akun, bahan, export, billing, atau kendala workspace.</p></div><small><i/>Support aktif</small></div>
    <div className="support-quick-topics">{quickTopics.map((topic) => <button type="button" key={topic} onClick={() => setInput(topic)}>{topic}<ArrowRight size={13}/></button>)}</div>
    <div className="modal-thread support-thread" aria-live="polite">{messages.length ? messages.map((item) => <article key={item.id} className={`support-message ${item.role}`}><span>{item.role === 'assistant' ? <BrandMark alt=""/> : 'K'}</span><div><small>{item.role === 'assistant' ? 'Tim Laprakin' : 'Kamu'}</small><p>{item.content}</p></div></article>) : <div className="support-empty"><MessageCircle size={20}/><div><b>Belum ada percakapan</b><p>Pilih topik di atas atau ceritakan kendalanya secara singkat.</p></div></div>}</div>
     <form className="support-composer" onSubmit={send}><textarea aria-label="Pesan bantuan" rows="2" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Tulis kendalamu..."/><div><small>Jangan kirim kata sandi atau data sensitif.</small><button type="submit" disabled={busy || !input.trim()}>{busy ? <LoaderCircle className="spin" size={15}/> : <Send size={15}/>}Kirim</button></div></form>
  </Modal>;
}

function FeedbackModal({ onClose }) {
  const { setNotice } = useApp();
  const [items, setItems] = useState([]);
  const emptyForm = { category: 'idea', rating: null, body: '', contactAllowed: false, allowPublicQuote: false, publicAlias: '' };
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const categories = [{ value: 'idea', label: 'Ide fitur' }, { value: 'bug', label: 'Bug' }, { value: 'experience', label: 'Pengalaman' }, { value: 'other', label: 'Lainnya' }];
  useEffect(() => { api('/feedback').then((data) => setItems(data.items || [])).catch((err) => setNotice(err.message)); }, []);
  const submit = async (event) => { event.preventDefault(); if (busy || form.body.trim().length < 12 || (form.allowPublicQuote && !form.publicAlias.trim())) return; setBusy(true); try { const data = await api('/feedback', { method: 'POST', body: { ...form, body: form.body.trim(), publicAlias: form.publicAlias.trim() } }); setItems((old) => [data.item, ...old]); setForm(emptyForm); setNotice('Feedback terkirim.'); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  return <Modal title="Feedback" onClose={onClose} className="feedback-modal feedback-modal-v2">
    <div className="feedback-layout">
      <form className="feedback-form" onSubmit={submit}>
        <header><span>Masukan produk</span><h2>Ceritakan yang perlu kami perbaiki.</h2><p>Jelaskan kendala atau hasil yang kamu harapkan. Tim akan membaca riwayatnya di panel sebelah.</p></header>
        <fieldset className="feedback-category"><legend>Jenis masukan</legend><div>{categories.map((item) => <button type="button" key={item.value} aria-pressed={form.category === item.value} className={form.category === item.value ? 'active' : ''} onClick={() => setForm({ ...form, category: item.value })}>{item.label}</button>)}</div></fieldset>
        <fieldset className="feedback-rating"><legend>Nilai pengalaman <small>opsional</small></legend><div>{[1,2,3,4,5].map((rating) => <button type="button" key={rating} aria-pressed={form.rating === rating} aria-label={`Nilai ${rating} dari 5`} className={form.rating === rating ? 'active' : ''} onClick={() => setForm({ ...form, rating: form.rating === rating ? null : rating })}><b>{rating}</b><span>{rating === 1 ? 'Buruk' : rating === 5 ? 'Bagus' : ''}</span></button>)}</div></fieldset>
         <label className="feedback-body"><span>Masukan</span><textarea aria-label="Masukan" minLength="12" maxLength="1200" required value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Apa yang terjadi, dan seperti apa hasil yang kamu harapkan?"/><small>{form.body.length} / 1200</small></label>
         <div className="feedback-consent"><Toggle checked={form.contactAllowed} onChange={(checked) => setForm({ ...form, contactAllowed: checked })} title="Boleh dihubungi" description="Tim dapat membalas lewat akun ini."/><Toggle checked={form.allowPublicQuote} onChange={(checked) => setForm({ ...form, allowPublicQuote: checked, publicAlias: checked ? form.publicAlias : '' })} title="Boleh dijadikan testimoni" description="Tidak dipublikasikan tanpa alias dan persetujuanmu."/>{form.allowPublicQuote && <label><span>Alias publik <small>wajib</small></span><input aria-label="Alias publik" required value={form.publicAlias} onChange={(event) => setForm({ ...form, publicAlias: event.target.value })} placeholder="Contoh: Mahasiswa TI semester 4"/></label>}</div>
        <button className="feedback-submit" type="submit" disabled={busy || form.body.trim().length < 12 || (form.allowPublicQuote && !form.publicAlias.trim())}>{busy ? <LoaderCircle className="spin" size={15}/> : <Send size={15}/>}Kirim masukan</button>
      </form>
      <aside className="feedback-history"><header><div><b>Riwayat</b><small>{items.length} masukan</small></div><MessageSquareText size={17}/></header>{items.length ? <div>{items.map((item) => <article key={item.id}><div><span>{item.category} · {item.rating ? `${item.rating}/5` : 'tanpa rating'}</span><small>{formatDate(item.updatedAt)}</small></div><p>{item.body}</p><em>{item.status}</em>{item.replies?.map((reply) => <div className="feedback-reply" key={reply.id}><b>Tim Laprakin</b><p>{reply.body}</p></div>)}</article>)}</div> : <div className="feedback-empty"><MessageSquareText size={18}/><b>Belum ada feedback</b><p>Masukan yang dikirim akan tersimpan dan balasan tim muncul di sini.</p></div>}</aside>
    </div>
  </Modal>;
}

function NotificationModal({ onClose }) { const { setNotice } = useApp(); const [data, setData] = useState({ notifications: [], unread: 0 }); const ref = useRef(null); useEffect(() => { api('/notifications').then(setData).catch((err) => setNotice(err.message)); }, []); useEffect(() => { const closeOutside = (event) => { if (ref.current && !ref.current.contains(event.target)) onClose(); }; window.addEventListener('mousedown', closeOutside); return () => window.removeEventListener('mousedown', closeOutside); }, [onClose]); useEffect(() => { const timer = window.setTimeout(onClose, 5000); return () => window.clearTimeout(timer); }, [onClose]); const markRead = async () => { try { setData(await api('/notifications/read', { method: 'PUT', body: {} })); } catch (err) { setNotice(err.message); } }; return <aside ref={ref} className="notification-popover" role="dialog" aria-modal="true" aria-label="Notifikasi"><header><div><b>Notifikasi</b><small>{data.unread ? `${data.unread} baru` : 'Semua sudah dibaca'}</small></div><IconButton label="Tutup" onClick={onClose}><X size={16} /></IconButton></header>{data.unread ? <button className="notification-read" onClick={markRead}>Tandai semua dibaca</button> : null}<div className="notification-list">{data.notifications.length ? data.notifications.map((note) => <article key={note.id} className={note.is_read ? 'is-read' : ''}><span /> <div><b>{note.title}</b><p>{note.body}</p><small>{formatDate(note.created_at)}</small></div></article>) : <p className="muted-note">Belum ada notifikasi.</p>}</div></aside>; }

function AppDialog({ dialog, onResolve }) {
  const [value, setValue] = useState('');
  const dialogRef = useRef(null);
  const promptInputRef = useRef(null);
  useFocusReturn(Boolean(dialog));
  useFocusTrap(dialogRef, Boolean(dialog));
  const isPrompt = dialog?.kind === 'prompt';
  useEffect(() => { setValue(dialog?.initialValue || ''); }, [dialog]);
  useEffect(() => {
    if (!dialog || !isPrompt) return undefined;
    const frame = window.requestAnimationFrame(() => promptInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [dialog, isPrompt]);
  if (!dialog) return null;
  const close = (result) => onResolve(isPrompt && result === true ? value.trim() : result);
  return <div className="app-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(isPrompt ? null : false); }}><section ref={dialogRef} className={`app-dialog ${dialog.destructive ? 'is-danger' : ''}`} role="dialog" aria-modal="true" aria-labelledby="app-dialog-title"><div className="app-dialog-icon">{dialog.destructive ? <Trash2 size={17} /> : isPrompt ? <Pencil size={17} /> : <CircleAlert size={17} />}</div><div className="app-dialog-copy"><h2 id="app-dialog-title">{dialog.title || 'Konfirmasi'}</h2>{dialog.message && <p>{dialog.message}</p>}</div>{isPrompt && <form onSubmit={(event) => { event.preventDefault(); close(true); }}><input ref={promptInputRef} aria-label={dialog.title || 'Input'} value={value} onChange={(event) => setValue(event.target.value)} placeholder={dialog.placeholder || ''} maxLength={dialog.maxLength || 100} /><div className="app-dialog-actions"><button type="button" className="app-dialog-cancel" onClick={() => close(null)}>Batal</button><button type="submit" className="app-dialog-confirm">{dialog.confirmLabel || 'Simpan'}</button></div></form>}{!isPrompt && <div className="app-dialog-actions"><button type="button" className="app-dialog-cancel" onClick={() => close(false)}>Batal</button><button type="button" className="app-dialog-confirm" onClick={() => close(true)}>{dialog.confirmLabel || 'Lanjutkan'}</button></div>}</section></div>;
}

function Modal({ title, onClose, children, className = '' }) {
  const modalRef = useRef(null);
  useFocusReturn(true);
  useFocusTrap(modalRef, true);
  useEffect(() => { const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={modalRef} className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby="workspace-modal-title"><header><b id="workspace-modal-title">{title}</b><IconButton label="Tutup" onClick={onClose}><X size={16}/></IconButton></header>{children}</section></div>;
}

function AdminAccessPanel({ users, setNotice, onRefresh }) {
  const [selectedId, setSelectedId] = useState(users[0]?.id || '');
  const [rooms, setRooms] = useState([]);
  const [restrictions, setRestrictions] = useState([]);
  const [form, setForm] = useState({ targetType: 'account', durationDays: '7', permanent: false, reason: '' });
  const [planForm, setPlanForm] = useState({ planKey: 'free', durationDays: '30' });
  const [busy, setBusy] = useState(false);
  const selected = users.find((item) => item.id === selectedId);
  const loadDetails = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const [roomData, restrictionData] = await Promise.all([
        api(`/admin/users/${userId}/rooms`),
        api(`/admin/users/${userId}/restrictions`),
      ]);
      setRooms(roomData.rooms || []);
      setRestrictions(restrictionData.restrictions || []);
    } catch (error) { setNotice(error.message); }
  }, [setNotice]);
  useEffect(() => { loadDetails(selectedId); }, [selectedId, loadDetails]);
  useEffect(() => {
    setPlanForm({
      planKey: ['monthly', 'pro'].includes(selected?.planKey) ? selected.planKey : 'free',
      durationDays: '30',
    });
  }, [selectedId, selected?.planKey]);
  const changePlan = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await api(`/admin/users/${selectedId}/plan`, {
        method: 'PUT',
        body: {
          planKey: planForm.planKey,
          durationDays: Number(planForm.durationDays || 30),
        },
      });
      await onRefresh();
      setNotice(`Plan ${selected?.email || 'user'} berhasil diperbarui.`);
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const createRestriction = async () => {
    if (!selectedId || form.reason.trim().length < 8) return;
    setBusy(true);
    try {
      await api(`/admin/users/${selectedId}/restrictions`, {
        method: 'POST',
        body: {
          targetType: form.targetType,
          durationDays: form.permanent ? null : Number(form.durationDays),
          reason: form.reason,
        },
      });
      setForm((value) => ({ ...value, reason: '' }));
      await Promise.all([loadDetails(selectedId), onRefresh()]);
      setNotice('Pembatasan diterapkan dan user menerima pemberitahuan email.');
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const revokeRestriction = async (restrictionId) => {
    setBusy(true);
    try {
      await api(`/admin/users/${selectedId}/restrictions/${restrictionId}`, { method: 'DELETE' });
      await Promise.all([loadDetails(selectedId), onRefresh()]);
      setNotice('Pembatasan dicabut.');
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  return <section className="admin-content admin-access-layout">
    <section className="admin-panel admin-user-picker"><div className="admin-panel-head"><h2>User</h2><small>{users.length} akun</small></div><div className="admin-list">{users.map((item) => <button type="button" key={item.id} className={selectedId === item.id ? 'active' : ''} onClick={() => setSelectedId(item.id)}><div><b>{item.fullName || item.email}</b><small>{item.email} · {item.plan}</small></div><span>{item.restrictionCount ? `${item.restrictionCount} batasan` : `${item.roomCount} room`}</span></button>)}</div></section>
    <div className="admin-access-detail">
       <section className="admin-panel"><div className="admin-panel-head"><div><h2>{selected?.fullName || selected?.email || 'Pilih user'}</h2><small>{selected ? `${selected.messageCount} pesan · ${Number(selected.totalTokens || 0).toLocaleString('id-ID')} token` : ''}</small></div></div>{selected && <><div className="admin-plan-control"><label htmlFor="admin-plan-key">Plan akun<CustomSelect id="admin-plan-key" ariaLabel="Plan akun" value={planForm.planKey} onChange={(planKey) => setPlanForm((value) => ({ ...value, planKey }))} options={[{value:'free',label:'Gratis'},{value:'monthly',label:'Pro'},{value:'pro',label:'Max'}]} /></label>{planForm.planKey !== 'free' && <label>Masa aktif<input aria-label="Masa aktif plan" type="number" min="1" max="3650" value={planForm.durationDays} onChange={(event) => setPlanForm((value) => ({ ...value, durationDays: event.target.value }))}/><small>hari</small></label>}<Button onClick={changePlan} disabled={busy}><CreditCard size={14}/>Ubah plan</Button><span>Plan saat ini: <b>{selected.plan}</b></span></div><div className="admin-restriction-form"><label htmlFor="admin-restriction-target">Jenis pembatasan<CustomSelect id="admin-restriction-target" ariaLabel="Jenis pembatasan" value={form.targetType} onChange={(targetType) => setForm((value) => ({ ...value, targetType }))} options={[{value:'account',label:'Suspend akun'},{value:'device',label:'Blokir perangkat terkait'},{value:'ip',label:'Blokir jaringan terkait'}]} /></label><label className="admin-permanent-check"><input aria-label="Permanen" type="checkbox" checked={form.permanent} onChange={(event) => setForm((value) => ({ ...value, permanent: event.target.checked }))}/><span>Permanen</span></label>{!form.permanent && <label>Durasi hari<input aria-label="Durasi pembatasan" type="number" min="1" max="3650" value={form.durationDays} onChange={(event) => setForm((value) => ({ ...value, durationDays: event.target.value }))}/></label>}<label className="admin-form-wide">Alasan untuk user<textarea aria-label="Alasan pembatasan" maxLength="280" value={form.reason} onChange={(event) => setForm((value) => ({ ...value, reason: event.target.value }))} placeholder="Jelaskan alasan tanpa istilah teknis."/></label><Button onClick={createRestriction} disabled={busy || form.reason.trim().length < 8}><Shield size={14}/>Terapkan pembatasan</Button></div></>}</section>
      <section className="admin-panel"><div className="admin-panel-head"><h2>Pembatasan</h2><small>Target disimpan secara pseudonim</small></div><div className="admin-list">{restrictions.length ? restrictions.map((item) => <article key={item.id}><div><b>{item.targetType === 'account' ? 'Akun' : item.targetType === 'device' ? 'Perangkat' : 'Jaringan'}</b><small>{item.reason} · {item.permanent ? 'Permanen' : `hingga ${formatDate(item.expiresAt)}`}</small></div><div className="admin-actions"><span className={`status-${item.status === 'active' ? 'failed' : 'completed'}`}>{item.status}</span>{item.status === 'active' && <button type="button" onClick={() => revokeRestriction(item.id)}>Cabut</button>}</div></article>) : <p className="empty-admin">Tidak ada pembatasan.</p>}</div></section>
      <section className="admin-panel"><div className="admin-panel-head"><h2>Roomchat</h2><small>Hanya metadata pemakaian</small></div><div className="admin-list">{rooms.length ? rooms.map((room) => <article key={room.id}><div><b>{room.title}</b><small>Diperbarui {formatDate(room.updatedAt)}</small></div><span>{room.messageCount} pesan · {Number(room.totalTokens || 0).toLocaleString('id-ID')} token</span></article>) : <p className="empty-admin">Belum ada roomchat.</p>}</div></section>
    </div>
  </section>;
}

function AdminAppealsPanel({ setNotice, onRefresh }) {
  const [appeals, setAppeals] = useState([]);
  const [replies, setReplies] = useState({});
  const [busy, setBusy] = useState(false);
  const loadAppeals = useCallback(() => api('/admin/appeals?status=all').then((data) => setAppeals(data.appeals || [])).catch((error) => setNotice(error.message)), [setNotice]);
  useEffect(() => { loadAppeals(); }, [loadAppeals]);
  const review = async (appeal, status) => {
    const reply = (replies[appeal.id] || '').trim();
    if (reply.length < 4) return;
    setBusy(true);
    try {
      await api(`/admin/appeals/${appeal.id}`, {
        method: 'PUT',
        body: { status, reply, liftRestrictions: status === 'approved' },
      });
      await Promise.all([loadAppeals(), onRefresh()]);
      setNotice(status === 'approved' ? 'Appeal disetujui dan pembatasan akun dicabut.' : 'Hasil appeal dikirim ke user.');
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  return <section className="admin-content"><div className="admin-panel admin-wide"><div className="admin-panel-head"><h2>Appeal akun</h2><small>User menerima hasil lewat email</small></div><div className="admin-list admin-appeal-list">{appeals.length ? appeals.map((appeal) => <article key={appeal.id}><div className="admin-appeal-copy"><div><b>{appeal.userName || appeal.userEmail || 'Akun tidak aktif'}</b><small>{appeal.userEmail || 'Email terlindungi'} · {formatDate(appeal.createdAt)}</small></div><p>{appeal.message}</p>{appeal.status === 'open' ? <textarea aria-label={`Balasan appeal untuk ${appeal.userEmail || 'user'}`} value={replies[appeal.id] || ''} onChange={(event) => setReplies((value) => ({ ...value, [appeal.id]: event.target.value }))} placeholder="Tulis hasil peninjauan untuk user."/> : <small className="admin-reply">{appeal.adminReply}</small>}</div><div className="admin-actions"><span className={`status-${appeal.status === 'approved' ? 'completed' : appeal.status === 'open' ? 'queued' : 'failed'}`}>{appeal.status}</span>{appeal.status === 'open' && <><button disabled={busy} onClick={() => review(appeal, 'approved')}>Setujui</button><button disabled={busy} onClick={() => review(appeal, 'rejected')}>Tolak</button></>}</div></article>) : <p className="empty-admin">Belum ada appeal.</p>}</div></div></section>;
}

function AdminBroadcastPanel({ users, setNotice }) {
  const [form, setForm] = useState({ audience: 'all', userIds: [], subject: '', heading: '', body: '', ctaLabel: '', ctaUrl: '', imageUrl: '', accentColor: '#b7ff24', backgroundColor: '#f5f5f2', textColor: '#171715' });
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const loadHistory = useCallback(() => api('/admin/broadcasts').then((data) => setHistory(data.broadcasts || [])).catch((error) => setNotice(error.message)), [setNotice]);
  useEffect(() => { loadHistory(); }, [loadHistory]);
  const toggleRecipient = (id) => setForm((value) => ({ ...value, userIds: value.userIds.includes(id) ? value.userIds.filter((item) => item !== id) : [...value.userIds, id] }));
  const uploadImage = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    setBusy(true);
    try {
      const body = new FormData(); body.append('file', file);
      const result = await api('/admin/broadcasts/image', { method: 'POST', body, form: true });
      setForm((value) => ({ ...value, imageUrl: result.imageUrl }));
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const sendBroadcast = async () => {
    setBusy(true);
    try {
      const result = await api('/admin/broadcasts', { method: 'POST', body: form });
      setNotice(`${result.deliveredCount} dari ${result.recipientCount} email berhasil diproses.`);
      setForm((value) => ({ ...value, subject: '', heading: '', body: '', ctaLabel: '', ctaUrl: '', imageUrl: '' }));
      await loadHistory();
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const invalid = form.subject.trim().length < 3 || form.heading.trim().length < 2 || form.body.trim().length < 10 || (form.audience === 'selected' && !form.userIds.length);
  return <section className="admin-content"><div className="admin-grid admin-broadcast-grid"><section className="admin-panel admin-broadcast-form"><div className="admin-panel-head"><h2>Email user</h2><small>Promosi, update, atau maintenance</small></div><label htmlFor="admin-broadcast-audience">Target<CustomSelect id="admin-broadcast-audience" ariaLabel="Target email" value={form.audience} onChange={(audience) => setForm((value) => ({ ...value, audience }))} options={[{value:'all',label:'Semua user terverifikasi'},{value:'paid',label:'Semua user paid'},{value:'selected',label:'User terpilih'}]}/></label>{form.audience === 'selected' && <div className="admin-recipient-list">{users.map((item) => <label key={item.id}><input aria-label={`Pilih penerima ${item.email}`} type="checkbox" checked={form.userIds.includes(item.id)} onChange={() => toggleRecipient(item.id)}/><span>{item.email}</span></label>)}</div>}<label>Subjek<input aria-label="Subjek email" maxLength="140" value={form.subject} onChange={(event) => setForm((value) => ({ ...value, subject: event.target.value }))}/></label><label>Judul email<input aria-label="Judul email" maxLength="140" value={form.heading} onChange={(event) => setForm((value) => ({ ...value, heading: event.target.value }))}/></label><label>Isi<textarea aria-label="Isi email" maxLength="6000" value={form.body} onChange={(event) => setForm((value) => ({ ...value, body: event.target.value }))}/></label><div className="admin-form-row"><label>Label tombol<input aria-label="Label tombol email" maxLength="50" value={form.ctaLabel} onChange={(event) => setForm((value) => ({ ...value, ctaLabel: event.target.value }))}/></label><label>URL tombol<input aria-label="URL tombol email" type="url" value={form.ctaUrl} onChange={(event) => setForm((value) => ({ ...value, ctaUrl: event.target.value }))}/></label></div><label>Gambar<input aria-label="Gambar email" type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadImage}/></label><div className="admin-color-row"><label>Aksen<input aria-label="Warna aksen email" type="color" value={form.accentColor} onChange={(event) => setForm((value) => ({ ...value, accentColor: event.target.value }))}/></label><label>Latar<input aria-label="Warna latar email" type="color" value={form.backgroundColor} onChange={(event) => setForm((value) => ({ ...value, backgroundColor: event.target.value }))}/></label><label>Teks<input aria-label="Warna teks email" type="color" value={form.textColor} onChange={(event) => setForm((value) => ({ ...value, textColor: event.target.value }))}/></label></div><Button onClick={sendBroadcast} disabled={busy || invalid}><Send size={14}/>Kirim email</Button></section><div><section className="admin-email-preview" style={{background:form.backgroundColor,color:form.textColor}}>{form.imageUrl && <img src={form.imageUrl} alt="Preview email"/>}<h2>{form.heading || 'Judul email'}</h2><p>{form.body || 'Isi email akan tampil di sini.'}</p>{form.ctaLabel && <span style={{background:form.accentColor,color:form.textColor}}>{form.ctaLabel}</span>}</section><section className="admin-panel"><div className="admin-panel-head"><h2>Riwayat</h2><small>{history.length} email</small></div><div className="admin-list">{history.slice(0,20).map((item) => <article key={item.id}><div><b>{item.subject}</b><small>{item.audience} · {formatDate(item.createdAt)}</small></div><span>{item.deliveredCount}/{item.recipientCount}</span></article>)}</div></section></div></div></section>;
}

function AdminPricingPanel({ setNotice }) {
  const [products, setProducts] = useState([]);
  const [busy, setBusy] = useState(false);
  const loadPricing = useCallback(() => api('/admin/pricing').then((data) => {
    const createProduct = (sku, label, plan, fallback, price) => ({
      sku,
      label,
      unitPriceIdr: price,
      discountPercent: plan?.discountPercent || 0,
      discountExpiresAt: plan?.discountExpiresAt || '',
      credits: plan?.credits ?? fallback.credits,
      durationDays: plan?.durationDays ?? fallback.durationDays,
      revisionsPerReport: plan?.revisionsPerReport ?? fallback.revisionsPerReport,
      storageMb: plan?.storageMb ?? fallback.storageMb,
      featuresText: pricingFeatures(plan, fallback.features).join('\n'),
    });
    setProducts([
      createProduct('free', 'Free', data.free, pricingFallback.free, 0),
      createProduct('credit', 'Satuan', data.single, pricingFallback.single, data.single?.originalPrice || data.single?.unitPrice || 3900),
      createProduct('monthly', 'Pro', data.monthly, pricingFallback.monthly, data.monthly?.originalPrice || data.monthly?.price || 29900),
      createProduct('pro', 'Max', data.pro, pricingFallback.pro, data.pro?.originalPrice || data.pro?.price || 45900),
    ]);
  }).catch((error) => setNotice(error.message)), [setNotice]);
  useEffect(() => { loadPricing(); }, [loadPricing]);
  const update = (sku, patch) => setProducts((items) => items.map((item) => item.sku === sku ? { ...item, ...patch } : item));
  const save = async () => {
    setBusy(true);
    try {
      await api('/admin/pricing', {
        method: 'PUT',
        body: {
          products: products.map((product) => ({
            sku: product.sku,
            unitPriceIdr: Number(product.unitPriceIdr),
            discountPercent: product.sku === 'free' ? 0 : Number(product.discountPercent),
            discountExpiresAt: product.sku === 'free' ? '' : product.discountExpiresAt,
            credits: Number(product.credits),
            durationDays: Number(product.durationDays),
            revisionsPerReport: Number(product.revisionsPerReport),
            storageMb: Number(product.storageMb),
            features: product.featuresText.split('\n').map((item) => item.trim()).filter(Boolean),
          })),
        },
      });
      await loadPricing(); setNotice('Benefit, harga, dan diskon berhasil diperbarui.');
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  return <section className="admin-content">
    <div className="admin-panel admin-wide">
      <div className="admin-panel-head"><h2>Plan dan benefit</h2><small>Nilai ini dipakai langsung oleh pricing, checkout, credit, revisi, dan penyimpanan.</small></div>
      <div className="admin-pricing-grid">
        {products.map((product) => <article key={product.sku}>
          <h3>{product.label}</h3>
          <div className="admin-pricing-fields">
             <label>Harga rupiah<input aria-label={`${product.label} harga rupiah`} type="number" min={product.sku === 'free' ? 0 : 1000} max="10000000" disabled={product.sku === 'free'} value={product.unitPriceIdr} onChange={(event) => update(product.sku, { unitPriceIdr: event.target.value })}/></label>
             <label>Jumlah credit<input aria-label={`${product.label} jumlah credit`} type="number" min="1" max="1000" value={product.credits} onChange={(event) => update(product.sku, { credits: event.target.value })}/></label>
             <label>Masa aktif (hari)<input aria-label={`${product.label} masa aktif`} type="number" min="1" max="3650" value={product.durationDays} onChange={(event) => update(product.sku, { durationDays: event.target.value })}/></label>
             <label>Revisi per laprak<input aria-label={`${product.label} revisi per laprak`} type="number" min="0" max="100" value={product.revisionsPerReport} onChange={(event) => update(product.sku, { revisionsPerReport: event.target.value })}/></label>
             <label>Penyimpanan (MB)<input aria-label={`${product.label} penyimpanan megabyte`} type="number" min="1" max="102400" value={product.storageMb} onChange={(event) => update(product.sku, { storageMb: event.target.value })}/></label>
             {product.sku !== 'free' && <label>Diskon persen<input aria-label={`${product.label} diskon persen`} type="number" min="0" max="90" value={product.discountPercent} onChange={(event) => update(product.sku, { discountPercent: event.target.value })}/></label>}
             {product.sku !== 'free' && <label>Diskon berakhir<input aria-label={`${product.label} diskon berakhir`} type="datetime-local" value={product.discountExpiresAt ? product.discountExpiresAt.slice(0,16) : ''} onChange={(event) => update(product.sku, { discountExpiresAt: event.target.value })}/></label>}
          </div>
           <label>Daftar fitur <span>Satu fitur per baris</span><textarea aria-label={`${product.label} daftar fitur`} rows="4" maxLength="1200" value={product.featuresText} onChange={(event) => update(product.sku, { featuresText: event.target.value })}/></label>
        </article>)}
      </div>
      <Button onClick={save} disabled={busy || products.length !== 4}><Save size={14}/>Simpan plan</Button>
    </div>
  </section>;
}

function LegacyAdminWorkspace() {
  const { user, refreshSession, setNotice, prefs, setPrefs } = useApp();
  const navigate = useNavigate();
  const adminTheme = useResolvedTheme(prefs.theme || 'system');
  const setAdminTheme = (next) => setPrefs((value) => ({ ...value, theme: typeof next === 'function' ? next(resolveTheme(value.theme || 'system')) : next }));
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [audit, setAudit] = useState([]);
  const [landing, setLanding] = useState(null);
  const [aiUsage, setAiUsage] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminAlerts, setAdminAlerts] = useState([]);
  const [creditForm, setCreditForm] = useState({ audience: 'user', userId: '', amount: 1, reason: 'Kredit tambahan dari admin' });
  const [integrationStatus, setIntegrationStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState({});
  const load = async () => {
    try {
      const [nextOverview, nextFeedback, nextAudit, nextCms, nextAiUsage, nextUsers, nextAlerts] = await Promise.all([
        api('/admin/overview'), api('/admin/feedback'), api('/admin/audit'), api('/admin/cms/landing'), api('/admin/ai/usage?days=30'),
        api('/admin/users?limit=100'), api('/admin/alerts?status=all'),
      ]);
      setOverview(nextOverview); setFeedback(nextFeedback.items || []); setAudit(nextAudit.events || []); setLanding(nextCms.landing || null); setAiUsage(nextAiUsage);
      setAdminUsers(nextUsers.users || []); setAdminAlerts(nextAlerts.alerts || []);
    } catch (error) { setNotice(error.message); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const stream = new EventSource('/api/admin/events');
    const refreshOperationalData = () => {
      Promise.all([api('/admin/overview'), api('/admin/alerts?status=all')])
        .then(([nextOverview, nextAlerts]) => { setOverview(nextOverview); setAdminAlerts(nextAlerts.alerts || []); })
        .catch(() => {});
    };
    stream.addEventListener('alert', refreshOperationalData);
    stream.addEventListener('alert-updated', refreshOperationalData);
    stream.addEventListener('credit', () => { load(); });
    return () => stream.close();
  }, []);
  const reviewRisk = async (id, status) => {
    try { await api(`/admin/risk-events/${id}`, { method: 'PUT', body: { status } }); await load(); setNotice('Status kejadian diperbarui.'); } catch (error) { setNotice(error.message); }
  };
  const updateFeedback = async (id, status) => {
    try { await api(`/admin/feedback/${id}/status`, { method: 'PUT', body: { status, adminNote: '' } }); await load(); } catch (error) { setNotice(error.message); }
  };
  const sendReply = async (id) => {
    const body = (reply[id] || '').trim(); if (!body) return;
    setBusy(true);
    try { await api(`/admin/feedback/${id}/reply`, { method: 'POST', body: { body } }); setReply((prev) => ({ ...prev, [id]: '' })); await load(); setNotice('Balasan dikirim ke user lewat notifikasi aplikasi.'); } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const saveLanding = async () => {
    if (!landing) return;
    setBusy(true);
    try { const data = await api('/admin/cms/landing', { method: 'PUT', body: landing }); setLanding(data.landing); setNotice('Konten landing dipublikasikan.'); } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const runRetention = async () => { setBusy(true); try { const data = await api('/admin/retention/run', { method: 'POST', body: {} }); setNotice(`Pembersihan selesai: ${data.deletedDocuments || 0} dokumen, ${data.deletedObjects || 0} objek.`); await load(); } catch (error) { setNotice(error.message); } finally { setBusy(false); } };
  const checkIntegrations = async () => {
    setBusy(true);
    try {
      const result = await api('/admin/integrations/check', { method: 'POST', body: {} });
      setIntegrationStatus(result); setNotice('Gemini dan Google OIDC terhubung dengan benar.');
    } catch (error) {
      if (error.payload?.gemini || error.payload?.googleOidc) setIntegrationStatus(error.payload);
      setNotice('Ada integrasi yang belum siap. Lihat detail pada tab AI & Login.');
    } finally { setBusy(false); }
  };
  const grantAdminCredit = async () => {
    setBusy(true);
    try {
      const result = await api('/admin/credits/grant', {
        method: 'POST',
        body: {
          ...creditForm,
          amount: Number(creditForm.amount),
          idempotencyKey: `admin-credit:${crypto.randomUUID()}`,
        },
      });
      setNotice(`${result.recipientCount} user menerima ${result.amount} kredit.`);
      await load();
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const updateAdminAlert = async (id, status) => {
    try {
      await api(`/admin/alerts/${id}`, { method: 'PUT', body: { status } });
      const next = await api('/admin/alerts?status=all');
      setAdminAlerts(next.alerts || []);
    } catch (error) { setNotice(error.message); }
  };
  const updateLandingMedia = (patch) => setLanding((prev) => ({ ...prev, media: { ...(prev.media || {}), ...patch } }));
  const uploadLandingMedia = async (event, target, index = null) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData(); form.append('file', file);
      const result = await api('/admin/cms/landing-media', { method: 'POST', body: form, form: true });
      if (target === 'hero') updateLandingMedia({ heroImageUrl: result.media.url });
      if (target === 'compare-ai' || target === 'compare-basic-ai') updateLandingMedia({ compareAiPdfUrl: result.media.url, compareBasicAiPdfUrl: result.media.url });
      if (target === 'compare-laprakin' || target === 'compare-basic-laprakin') updateLandingMedia({ compareLaprakinPdfUrl: result.media.url, compareBasicLaprakinPdfUrl: result.media.url });
      if (target === 'compare-thinking-ai') updateLandingMedia({ compareThinkingAiPdfUrl: result.media.url });
      if (target === 'compare-thinking-laprakin') updateLandingMedia({ compareThinkingLaprakinPdfUrl: result.media.url });
      if (target === 'compare-xtrathink-ai') updateLandingMedia({ compareXtraThinkAiPdfUrl: result.media.url });
      if (target === 'compare-xtrathink-laprakin') updateLandingMedia({ compareXtraThinkLaprakinPdfUrl: result.media.url });
      if (target === 'compare-video') updateLandingMedia({ compareVideoUrl: result.media.url });
      if (target === 'tutorial-video') updateLandingMedia({ tutorialVideoUrl: result.media.url });
      setNotice('Media berhasil diupload. Klik Simpan CMS untuk mempublikasikan perubahan.');
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const tabs = [
    ['overview', 'Monitoring', LayoutDashboard], ['credits', 'Kredit user', CreditCard], ['pricing', 'Harga & diskon', CreditCard], ['alerts', 'Error realtime', BellRing], ['integrations', 'AI & Login', Sparkles], ['updates', 'Updates', BellRing], ['broadcasts', 'Email user', Mail], ['feedback', 'Feedback', MessageSquareText], ['users', 'Akses user', Shield], ['appeals', 'Appeal', MessageCircle], ['risk', 'Risk review', AlertTriangle], ['cms', 'Landing CMS', Megaphone], ['audit', 'Audit log', ClipboardList], ['retention', 'Retensi', FileCog],
  ];
  const tabGroups = [
    ['Operasional', ['overview', 'credits', 'pricing', 'alerts', 'integrations']],
    ['Konten', ['updates', 'broadcasts', 'feedback', 'cms']],
    ['Keamanan', ['users', 'appeals', 'risk', 'audit', 'retention']],
  ];
  if (!overview || !landing) return <div className="admin-loading-state"><LoaderCircle className="spin" size={20} /><b>Memuat Admin Console…</b><span>Jika data belum masuk, gunakan tombol muat ulang setelah beberapa saat.</span><Button variant="secondary" onClick={load}>Coba muat ulang</Button></div>;
  return <div className={`admin-workspace ${adminTheme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
    <aside className="admin-sidebar"><div className="admin-brand"><BrandMark alt=""/><div><b>Laprakin</b><small>Admin console</small></div></div><nav>{tabGroups.map(([group, keys]) => <div className="admin-nav-group" key={group}><small>{group}</small>{keys.map((key) => { const [, label, Icon] = tabs.find(([tabKey]) => tabKey === key); return <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)} title={label}><Icon size={16} /><span>{label}</span></button>; })}</div>)}</nav><div className="admin-sidebar-foot"><div><span>{(user.email || 'A').slice(0,1).toUpperCase()}</span><small>{user.email}</small></div><button onClick={async () => { await api('/auth/logout', { method: 'POST', body: {} }); await refreshSession(); navigate('/'); }}><LogOut size={15} />Keluar</button></div></aside>
    <main className="admin-main"><header className="admin-header"><div><p>Admin console</p><h1>{tabs.find(([key]) => key === tab)?.[1]}</h1></div><div className="admin-header-actions"><button className="admin-theme-toggle" onClick={() => setAdminTheme((value) => value === 'dark' ? 'light' : 'dark')} title="Ubah tema admin" aria-label="Ubah tema admin">{adminTheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button><button className="admin-refresh" onClick={load}><RefreshCw size={15} /><span>Muat ulang</span></button></div></header>
      {tab === 'overview' && <section className="admin-content"><div className="admin-privacy-note"><ShieldCheck size={17} /><div><b>Privacy-first monitoring</b><span>Hanya metadata operasional. Isi chat, dokumen, file, NIM, IP, fingerprint, prompt, dan output AI tidak ditampilkan.</span></div></div><div className="admin-metric-grid">{[['User aktif',overview.stats.users,Users],['Dokumen aktif',overview.stats.documents,FileText],['Job berjalan',overview.stats.queuedJobs,Activity],['AI call 24j',overview.stats.aiCalls24h,Sparkles],['Token AI 24j',Number(overview.stats.aiTokens24h || 0).toLocaleString('id-ID'),Activity],['Error AI 24j',overview.stats.aiErrors24h,AlertTriangle],['Alert terbuka',overview.stats.openAdminAlerts || 0,BellRing],['Feedback terbuka',overview.stats.openFeedback,MessageCircle],['Risk terbuka',overview.stats.openRiskEvents,AlertTriangle],['Storage',formatBytes(overview.storageBytes),Database]].map(([label,value,Icon]) => <article key={label}><Icon size={16}/><span>{label}</span><b>{value}</b></article>)}</div><div className="admin-grid"><section className="admin-panel"><div className="admin-panel-head"><h2>Aktivitas 7 hari</h2><small>Event agregat</small></div><div className="activity-bars">{overview.dailyActivity?.length ? overview.dailyActivity.map((day) => <div key={day.day}><i style={{height:`${Math.max(8, Math.min(100, day.count * 12))}%`}} /><span>{day.day.slice(5)}</span><b>{day.count}</b></div>) : <p>Belum ada aktivitas.</p>}</div></section><section className="admin-panel"><div className="admin-panel-head"><h2>Job terbaru</h2><small>Tanpa isi dokumen</small></div><div className="admin-list">{overview.jobs?.length ? overview.jobs.map((job) => <article key={job.id}><div><b>{job.job_type}</b><small>{job.message || 'Memproses'}</small></div><span className={`status-${job.status}`}>{job.status}</span></article>) : <p>Belum ada job.</p>}</div></section></div></section>}
       {tab === 'credits' && <section className="admin-content"><div className="admin-grid"><section className="admin-panel admin-credit-panel"><div className="admin-panel-head"><h2>Tambahkan kredit</h2><small>Tercatat di wallet dan audit log</small></div><label htmlFor="admin-credit-audience">Target<CustomSelect id="admin-credit-audience" ariaLabel="Target kredit" value={creditForm.audience} onChange={(audience) => setCreditForm((value) => ({ ...value, audience }))} options={[{value:'user',label:'Satu user'},{value:'all',label:'Semua user terverifikasi'},{value:'paid',label:'Semua user paid'}]} /></label>{creditForm.audience === 'user' && <label htmlFor="admin-credit-user">User<CustomSelect id="admin-credit-user" ariaLabel="User penerima kredit" value={creditForm.userId} onChange={(userId) => setCreditForm((value) => ({ ...value, userId }))} options={[{value:'',label:'Pilih user'},...adminUsers.map((item)=>({value:item.id,label:`${item.email} · ${item.credits} kredit`}))]} /></label>}<label>Jumlah<input aria-label="Jumlah kredit" type="number" min="1" max="100" value={creditForm.amount} onChange={(event) => setCreditForm((value) => ({ ...value, amount: event.target.value }))} /></label><label>Alasan<input aria-label="Alasan pemberian kredit" maxLength="160" value={creditForm.reason} onChange={(event) => setCreditForm((value) => ({ ...value, reason: event.target.value }))} /></label><Button onClick={grantAdminCredit} disabled={busy || (creditForm.audience === 'user' && !creditForm.userId)}><CreditCard size={14}/>Tambahkan kredit</Button></section><section className="admin-panel"><div className="admin-panel-head"><h2>User terbaru</h2><small>{adminUsers.length} akun</small></div><div className="admin-list admin-user-list">{adminUsers.slice(0,30).map((item)=><article key={item.id}><div><b>{item.fullName || item.email}</b><small>{item.email} · {item.plan}</small></div><span>{item.credits} kredit</span></article>)}</div></section></div></section>}
      {tab === 'pricing' && <AdminPricingPanel setNotice={setNotice}/>}
      {tab === 'users' && <AdminAccessPanel users={adminUsers} setNotice={setNotice} onRefresh={load}/>}
      {tab === 'appeals' && <AdminAppealsPanel setNotice={setNotice} onRefresh={load}/>}
      {tab === 'broadcasts' && <AdminBroadcastPanel users={adminUsers} setNotice={setNotice}/>}
      {tab === 'alerts' && <section className="admin-content"><div className="admin-panel admin-wide"><div className="admin-panel-head"><h2>Error operasional</h2><small>Diperbarui realtime, tanpa isi dokumen</small></div><div className="admin-list admin-alert-list">{adminAlerts.length ? adminAlerts.map((alert)=><article key={alert.id} className={`admin-alert-${alert.severity}`}><div><b>{alert.summary}</b><small>{alert.userEmail || 'Sistem'} · {alert.kind}{alert.errorCode ? ` · ${alert.errorCode}` : ''} · {formatDate(alert.createdAt)}</small></div><div className="admin-actions"><span className={`status-${alert.status === 'resolved' ? 'completed' : 'failed'}`}>{alert.status}</span><button onClick={()=>updateAdminAlert(alert.id,alert.status === 'open' ? 'resolved' : 'open')}>{alert.status === 'open' ? 'Tandai selesai' : 'Buka lagi'}</button></div></article>) : <p className="empty-admin">Belum ada error operasional.</p>}</div></div></section>}
      {tab === 'integrations' && <section className="admin-content"><div className="admin-privacy-note"><ShieldCheck size={17}/><div><b>Credential tetap di server</b><span>Health check hanya menampilkan status model dan metadata OIDC. API key, client secret, prompt, serta output AI tidak pernah dikirim ke browser.</span></div></div><div className="admin-metric-grid">{[['Call 30 hari',aiUsage?.totals?.calls || 0,Sparkles],['Berhasil',aiUsage?.totals?.successful || 0,CheckCircle2],['Gagal',aiUsage?.totals?.failed || 0,AlertTriangle],['Input token',Number(aiUsage?.totals?.input_tokens || 0).toLocaleString('id-ID'),Activity],['Output token',Number(aiUsage?.totals?.output_tokens || 0).toLocaleString('id-ID'),Activity],['Latency rata-rata',`${aiUsage?.totals?.average_latency_ms || 0} ms`,Activity]].map(([label,value,Icon])=><article key={label}><Icon size={16}/><span>{label}</span><b>{value}</b></article>)}</div><div className="admin-grid"><section className="admin-panel"><div className="admin-panel-head"><h2>Status integrasi</h2><Button variant="secondary" onClick={checkIntegrations} disabled={busy}>{busy ? <LoaderCircle className="spin" size={14}/> : <RefreshCw size={14}/>}Cek sekarang</Button></div><div className="admin-list"><article><div><b>Gemini API</b><small>{integrationStatus?.gemini?.models?.length ? integrationStatus.gemini.models.map((item)=>`${item.model}: ${item.ok?'ready':'gagal'}`).join(' · ') : 'Jalankan pengecekan menggunakan credential server.'}</small></div><span className={integrationStatus?.gemini?.ok?'status-completed':integrationStatus?'status-failed':''}>{integrationStatus?.gemini?.ok?'ready':integrationStatus?'belum siap':'belum dicek'}</span></article><article><div><b>Azure Blob Storage</b><small>{integrationStatus?.azureBlob?.containerName ? `Container: ${integrationStatus.azureBlob.containerName}` : 'Container tersambung untuk dokumen pengguna.'}</small></div><span className={integrationStatus?.azureBlob?.ok?'status-completed':integrationStatus?'status-failed':''}>{integrationStatus?.azureBlob?.ok?'ready':integrationStatus?'belum siap':'belum dicek'}</span></article></div></section><section className="admin-panel"><div className="admin-panel-head"><h2>Pemakaian per model</h2><small>30 hari</small></div><div className="admin-list">{aiUsage?.breakdown?.length?aiUsage.breakdown.slice(0,10).map((item)=><article key={`${item.purpose}-${item.mode}-${item.model}-${item.status}`}><div><b>{item.purpose} · {item.mode}</b><small>{item.model} · {Number(item.total_tokens || 0).toLocaleString('id-ID')} token · {item.average_latency_ms || 0} ms</small></div><span className={`status-${item.status==='success'?'completed':'failed'}`}>{item.calls} call</span></article>):<p>Belum ada pemakaian AI.</p>}</div></section></div></section>}
      {tab === 'integrations' && <section className="admin-content"><div className="admin-panel admin-wide"><div className="admin-panel-head"><h2>Pemakaian AI per user</h2><small>Metadata 30 hari, tanpa prompt dan output</small></div><div className="admin-list admin-user-usage">{aiUsage?.byUser?.length ? aiUsage.byUser.map((item)=><article key={item.userId}><div><b>{item.fullName || item.email}</b><small>{item.email} · {item.errors} error · rata-rata {item.averageLatencyMs} ms</small></div><span>{item.calls} call · {Number(item.totalTokens || 0).toLocaleString('id-ID')} token</span></article>) : <p>Belum ada pemakaian per user.</p>}</div></div></section>}
      {tab === 'updates' && <FeatureUpdatesAdmin setNotice={setNotice} />}
       {tab === 'feedback' && <section className="admin-content"><div className="admin-panel admin-wide"><div className="admin-panel-head"><h2>Feedback pengguna</h2><small>Referensi akun dianonimkan.</small></div><div className="admin-list feedback-admin-list">{feedback.length ? feedback.map((item) => <article key={item.id}><div className="feedback-admin-body"><div><b>{item.category} · {item.rating || '—'}/5</b><small>{item.userRef} · {formatDate(item.updatedAt)}</small></div><p>{item.body}</p>{item.replies?.map((itemReply) => <small key={itemReply.id} className="admin-reply">Tim: {itemReply.body}</small>)}<div className="admin-inline"><input aria-label={`Balasan feedback ${item.userRef}`} value={reply[item.id] || ''} onChange={(event) => setReply((prev)=>({...prev,[item.id]:event.target.value}))} placeholder="Tulis balasan untuk user..." /><Button onClick={() => sendReply(item.id)} disabled={busy}>Kirim</Button></div></div><div className="admin-actions"><CustomSelect ariaLabel={`Status feedback ${item.userRef}`} value={item.status} onChange={(value) => updateFeedback(item.id, value)} options={[{value:'open',label:'Open'},{value:'reviewing',label:'Reviewing'},{value:'resolved',label:'Resolved'},{value:'closed',label:'Closed'}]} /></div></article>) : <p className="empty-admin">Belum ada feedback.</p>}</div></div></section>}
      {tab === 'risk' && <section className="admin-content"><div className="admin-panel admin-wide"><div className="admin-panel-head"><h2>Kejadian perlu ditinjau</h2><small>Tidak otomatis menuduh atau memblokir akun.</small></div><div className="admin-list">{overview.events?.length ? overview.events.map((event) => <article key={event.id}><div><b>{event.summary}</b><small>{event.userRef} · {event.category} · {event.severity} · {formatDate(event.createdAt)}</small></div><div className="admin-risk-actions"><span className={`risk-${event.status}`}>{event.status}</span>{event.status === 'open' && <><button onClick={() => reviewRisk(event.id,'reviewed')}>Tinjau</button><button onClick={() => reviewRisk(event.id,'dismissed')}>Tutup</button></>}</div></article>) : <p className="empty-admin">Belum ada kejadian yang perlu ditinjau.</p>}</div></div></section>}
       {tab === 'cms' && <section className="admin-content"><div className="admin-panel admin-wide"><div className="admin-panel-head"><h2>Landing CMS</h2><small>Atur teks, testimoni berizin, dan visual landing.</small></div><div className="cms-form"><Toggle checked={Boolean(landing.announcement?.enabled)} onChange={(checked)=>setLanding((prev)=>({...prev,announcement:{...prev.announcement,enabled:checked}}))} title="Tampilkan announcement" description="Muncul di bagian atas hero." /><label>Teks announcement<input aria-label="Teks announcement" value={landing.announcement?.text || ''} onChange={(event)=>setLanding((prev)=>({...prev,announcement:{...prev.announcement,text:event.target.value}}))} maxLength="180" /></label><label>CTA announcement<input aria-label="CTA announcement" value={landing.announcement?.ctaLabel || ''} onChange={(event)=>setLanding((prev)=>({...prev,announcement:{...prev.announcement,ctaLabel:event.target.value}}))} maxLength="32" /></label><div className="cms-copy-section"><div><b>Copy landing</b><small>Ubah judul dan teks utama landing tanpa menyentuh layout.</small></div><div className="cms-copy-grid"><label>Judul hero<input aria-label="Judul hero" value={landing.copy?.heroTitle || 'Laprakin'} onChange={(event)=>setLanding((prev)=>({...prev,copy:{...(prev.copy || {}),heroTitle:event.target.value}}))} maxLength="60" /></label><label>Deskripsi hero<textarea aria-label="Deskripsi hero" value={landing.copy?.heroSubtitle || ''} onChange={(event)=>setLanding((prev)=>({...prev,copy:{...(prev.copy || {}),heroSubtitle:event.target.value}}))} maxLength="280" /></label><label>Judul layanan<input aria-label="Judul layanan" value={landing.copy?.servicesTitle || ''} onChange={(event)=>setLanding((prev)=>({...prev,copy:{...(prev.copy || {}),servicesTitle:event.target.value}}))} maxLength="120" /></label><label>Deskripsi layanan<textarea aria-label="Deskripsi layanan" value={landing.copy?.servicesSubtitle || ''} onChange={(event)=>setLanding((prev)=>({...prev,copy:{...(prev.copy || {}),servicesSubtitle:event.target.value}}))} maxLength="280" /></label><label>Judul perbedaan<input aria-label="Judul perbedaan" value={landing.copy?.compareTitle || ''} onChange={(event)=>setLanding((prev)=>({...prev,copy:{...(prev.copy || {}),compareTitle:event.target.value}}))} maxLength="120" /></label><label>Deskripsi perbedaan<textarea aria-label="Deskripsi perbedaan" value={landing.copy?.compareSubtitle || ''} onChange={(event)=>setLanding((prev)=>({...prev,copy:{...(prev.copy || {}),compareSubtitle:event.target.value}}))} maxLength="280" /></label><label>Judul tutorial<input aria-label="Judul tutorial" value={landing.copy?.tutorialTitle || ''} onChange={(event)=>setLanding((prev)=>({...prev,copy:{...(prev.copy || {}),tutorialTitle:event.target.value}}))} maxLength="120" /></label><label>Deskripsi tutorial<textarea aria-label="Deskripsi tutorial" value={landing.copy?.tutorialSubtitle || ''} onChange={(event)=>setLanding((prev)=>({...prev,copy:{...(prev.copy || {}),tutorialSubtitle:event.target.value}}))} maxLength="280" /></label><label>Deskripsi footer<textarea aria-label="Deskripsi footer" value={landing.copy?.footerText || ''} onChange={(event)=>setLanding((prev)=>({...prev,copy:{...(prev.copy || {}),footerText:event.target.value}}))} maxLength="280" /></label></div></div><div className="cms-media-grid cms-media-grid-expanded">
   <article className="cms-media-card"><b>Gambar latar hero</b><small>Opsional. PNG, JPG, atau WEBP. Gradient tetap menjaga teks hero terbaca.</small><div className="cms-media-preview">{landing.media?.heroImageUrl ? <img src={landing.media.heroImageUrl} alt="Preview hero" /> : 'Belum ada gambar'}</div><input aria-label="Upload gambar latar hero" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event)=>uploadLandingMedia(event,'hero')} disabled={busy}/><input aria-label="URL gambar latar hero" value={landing.media?.heroImageUrl || ''} onChange={(event)=>updateLandingMedia({heroImageUrl:event.target.value})} placeholder="Atau tempel URL gambar" /></article>
   <article className="cms-media-card"><b>Compare Basic — AI lain</b><small>PDF sisi kiri untuk tab Basic.</small><div className={`cms-media-preview ${(landing.media?.compareBasicAiPdfUrl || landing.media?.compareAiPdfUrl) ? 'pdf' : ''}`}>{(landing.media?.compareBasicAiPdfUrl || landing.media?.compareAiPdfUrl) ? 'PDF tersambung' : 'Pakai PDF demo bawaan'}</div><input aria-label="Upload PDF compare Basic AI lain" type="file" accept="application/pdf" onChange={(event)=>uploadLandingMedia(event,'compare-basic-ai')} disabled={busy}/><input aria-label="URL PDF compare Basic AI lain" value={landing.media?.compareBasicAiPdfUrl || landing.media?.compareAiPdfUrl || ''} onChange={(event)=>updateLandingMedia({compareAiPdfUrl:event.target.value,compareBasicAiPdfUrl:event.target.value})} placeholder="Atau tempel URL PDF" /></article>
   <article className="cms-media-card"><b>Compare Basic — Laprakin</b><small>PDF sisi kanan untuk tab Basic.</small><div className={`cms-media-preview ${(landing.media?.compareBasicLaprakinPdfUrl || landing.media?.compareLaprakinPdfUrl) ? 'pdf' : ''}`}>{(landing.media?.compareBasicLaprakinPdfUrl || landing.media?.compareLaprakinPdfUrl) ? 'PDF tersambung' : 'Pakai PDF demo bawaan'}</div><input aria-label="Upload PDF compare Basic Laprakin" type="file" accept="application/pdf" onChange={(event)=>uploadLandingMedia(event,'compare-basic-laprakin')} disabled={busy}/><input aria-label="URL PDF compare Basic Laprakin" value={landing.media?.compareBasicLaprakinPdfUrl || landing.media?.compareLaprakinPdfUrl || ''} onChange={(event)=>updateLandingMedia({compareLaprakinPdfUrl:event.target.value,compareBasicLaprakinPdfUrl:event.target.value})} placeholder="Atau tempel URL PDF" /></article>
   <article className="cms-media-card"><b>Compare Thinking — AI lain</b><small>PDF sisi kiri untuk tab Thinking.</small><div className={`cms-media-preview ${landing.media?.compareThinkingAiPdfUrl ? 'pdf' : ''}`}>{landing.media?.compareThinkingAiPdfUrl ? 'PDF tersambung' : 'Belum ada PDF'}</div><input aria-label="Upload PDF compare Thinking AI lain" type="file" accept="application/pdf" onChange={(event)=>uploadLandingMedia(event,'compare-thinking-ai')} disabled={busy}/><input aria-label="URL PDF compare Thinking AI lain" value={landing.media?.compareThinkingAiPdfUrl || ''} onChange={(event)=>updateLandingMedia({compareThinkingAiPdfUrl:event.target.value})} placeholder="Atau tempel URL PDF" /></article>
   <article className="cms-media-card"><b>Compare Thinking — Laprakin</b><small>PDF sisi kanan untuk tab Thinking.</small><div className={`cms-media-preview ${landing.media?.compareThinkingLaprakinPdfUrl ? 'pdf' : ''}`}>{landing.media?.compareThinkingLaprakinPdfUrl ? 'PDF tersambung' : 'Belum ada PDF'}</div><input aria-label="Upload PDF compare Thinking Laprakin" type="file" accept="application/pdf" onChange={(event)=>uploadLandingMedia(event,'compare-thinking-laprakin')} disabled={busy}/><input aria-label="URL PDF compare Thinking Laprakin" value={landing.media?.compareThinkingLaprakinPdfUrl || ''} onChange={(event)=>updateLandingMedia({compareThinkingLaprakinPdfUrl:event.target.value})} placeholder="Atau tempel URL PDF" /></article>
   <article className="cms-media-card"><b>Compare XtraThink — AI lain</b><small>PDF sisi kiri untuk tab XtraThink.</small><div className={`cms-media-preview ${landing.media?.compareXtraThinkAiPdfUrl ? 'pdf' : ''}`}>{landing.media?.compareXtraThinkAiPdfUrl ? 'PDF tersambung' : 'Belum ada PDF'}</div><input aria-label="Upload PDF compare XtraThink AI lain" type="file" accept="application/pdf" onChange={(event)=>uploadLandingMedia(event,'compare-xtrathink-ai')} disabled={busy}/><input aria-label="URL PDF compare XtraThink AI lain" value={landing.media?.compareXtraThinkAiPdfUrl || ''} onChange={(event)=>updateLandingMedia({compareXtraThinkAiPdfUrl:event.target.value})} placeholder="Atau tempel URL PDF" /></article>
   <article className="cms-media-card"><b>Compare XtraThink — Laprakin</b><small>PDF sisi kanan untuk tab XtraThink.</small><div className={`cms-media-preview ${landing.media?.compareXtraThinkLaprakinPdfUrl ? 'pdf' : ''}`}>{landing.media?.compareXtraThinkLaprakinPdfUrl ? 'PDF tersambung' : 'Belum ada PDF'}</div><input aria-label="Upload PDF compare XtraThink Laprakin" type="file" accept="application/pdf" onChange={(event)=>uploadLandingMedia(event,'compare-xtrathink-laprakin')} disabled={busy}/><input aria-label="URL PDF compare XtraThink Laprakin" value={landing.media?.compareXtraThinkLaprakinPdfUrl || ''} onChange={(event)=>updateLandingMedia({compareXtraThinkLaprakinPdfUrl:event.target.value})} placeholder="Atau tempel URL PDF" /></article>
    <article className="cms-media-card cms-video-card"><b>Video perbandingan</b><small>MP4 atau WEBM yang membandingkan AI umum dengan Laprakin dalam satu video.</small><div className="cms-media-preview">{landing.media?.compareVideoUrl ? <video aria-label="Preview video perbandingan" src={landing.media.compareVideoUrl} muted playsInline preload="metadata" /> : 'Belum ada video'}</div><input aria-label="Upload video perbandingan" type="file" accept="video/mp4,video/webm" onChange={(event)=>uploadLandingMedia(event,'compare-video')} disabled={busy}/><input aria-label="URL video perbandingan" value={landing.media?.compareVideoUrl || ''} onChange={(event)=>updateLandingMedia({compareVideoUrl:event.target.value})} placeholder="Atau tempel URL video" /></article>
    <article className="cms-media-card cms-video-card"><b>Video product demo</b><small>MP4 atau WEBM. Diputar otomatis di hero tanpa suara dan berulang.</small><div className="cms-media-preview">{landing.media?.tutorialVideoUrl ? <video aria-label="Preview video product demo" src={landing.media.tutorialVideoUrl} muted playsInline preload="metadata" /> : 'Belum ada video'}</div><input aria-label="Upload video product demo" type="file" accept="video/mp4,video/webm" onChange={(event)=>uploadLandingMedia(event,'tutorial-video')} disabled={busy}/><input aria-label="URL video product demo" value={landing.media?.tutorialVideoUrl || ''} onChange={(event)=>updateLandingMedia({tutorialVideoUrl:event.target.value})} placeholder="Atau tempel URL video" /></article>
</div><div className="cms-testimonials"><b>Testimoni</b>{(landing.testimonials || []).length ? landing.testimonials.map((item,index)=><article key={item.id || index}><div><b>{item.name}</b><small>{item.label}</small><p>{item.quote}</p></div><Toggle checked={Boolean(item.published)} onChange={(checked)=>setLanding((prev)=>({...prev,testimonials:prev.testimonials.map((row,i)=>i===index?{...row,published:checked}:row)}))} title="Publish" /></article>) : <p className="muted-note">Belum ada testimoni berizin.</p>}</div><Button onClick={saveLanding} disabled={busy}><Save size={14}/>Simpan CMS</Button></div></div></section>}
      {tab === 'audit' && <section className="admin-content"><div className="admin-panel admin-wide"><div className="admin-panel-head"><h2>Audit log</h2><small>Metadata event, tanpa isi chat/file.</small></div><div className="admin-list">{audit.map((event)=><article key={event.id}><div><b>{event.action}</b><small>{event.actorRef} · {event.targetType} · {formatDate(event.createdAt)}</small></div></article>)}</div></div></section>}
      {tab === 'retention' && <section className="admin-content"><div className="admin-panel admin-wide retention-panel"><FileCog size={24}/><h2>Pembersihan retensi</h2><p>Menghapus resource sementara atau melewati masa retensi sesuai kebijakan. Tidak membaca isi file pengguna.</p><Button onClick={runRetention} disabled={busy}><RefreshCw size={14}/>Jalankan pembersihan</Button></div></section>}
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<BrowserRouter><App /></BrowserRouter>);
