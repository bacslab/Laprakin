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
import { api, clearCsrfToken, setCsrfToken } from './api';
import { redirectToMidtransCheckout, validatedMidtransCheckoutUrl } from './lib/payment-redirect';
import { useResolvedTheme } from './lib/theme';
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
import './styles/pricing.css';
import LoadingScreen from './components/LoadingScreen';
import { loadPage } from './lib/load-page';
import { AppContext, useApp } from './state/ui-context';
import I18nRuntime from './i18n/I18nRuntime';
import { createTranslator } from './i18n';
import { AppDialog } from './components/Dialog';
import BillingPage from './pages/Billing/BillingPage';

const LandingRoutePage = loadPage(() => import('./pages/Landing/LandingPage'));
const AuthPageModule = loadPage(() => import('./pages/Auth/AuthPage'));
const AdminWorkspaceBoundary = loadPage(() => import('./pages/Admin/AdminWorkspace'));
const AdminMfaGate = loadPage(() => import('./pages/Admin/AdminMfaGate'));
const LegacyAdminWorkspace = loadPage(() => import('./pages/Admin/LegacyAdminWorkspace'));
const LegacyWorkspace = loadPage(() => import('./pages/Workspace/LegacyWorkspace'));
const WorkspaceBoundary = loadPage(() => import('./pages/Workspace/Workspace'));
const StatusPage = loadPage(() => import('./pages/Status/StatusPage'));
const PricingPage = loadPage(() => import('./pages/Pricing/PublicPricingPage'));

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
  tone: 'formal', perspective: 'saya', profile: 'langkah', customInstructions: '', accent: 'lime', productUpdates: true, allowExternalAi: false,
};
// Aksen terang tetap boleh dipakai sebagai latar tombol pada tema terang.
// Untuk ikon, teks, dan focus ring, `lightInk` menyediakan pasangan yang lebih
// gelap agar kontrasnya tetap terbaca. Amber masih dibatasi ke tema gelap.
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
  const translate = useMemo(() => createTranslator(prefs.language), [prefs.language]);
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
  return <AppContext.Provider value={value}>{children}{notice && <div className={`toast toast-${noticeToneFor(notice)}`} role="status" aria-live="polite" aria-atomic="true"><span>{notice}</span><IconButton label={translate('common.closeNotification')} onClick={() => setNotice(null)}><X size={14} /></IconButton></div>}<AppDialog dialog={dialog} onResolve={resolveDialog} /></AppContext.Provider>;
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

const PRIVILEGED_ADMIN_ROLES = new Set(['owner', 'admin', 'ai_admin', 'support_admin', 'billing_admin', 'content_admin', 'privacy_admin', 'security_admin', 'auditor']);
function ProtectedAdmin() { const { loading, user } = useApp(); if (loading) return <LoadingScreen />; if (!user) return <Navigate to="/auth" replace />; if (!PRIVILEGED_ADMIN_ROLES.has(user.role)) return <Navigate to="/app" replace />; return <AdminWorkspaceBoundary AdminMfaGate={AdminMfaGate} LegacyWorkspace={LegacyAdminWorkspace} />; }


createRoot(document.getElementById('root')).render(<BrowserRouter><App /></BrowserRouter>);
