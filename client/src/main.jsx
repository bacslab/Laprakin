import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Component, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, ArrowDownToLine, ArrowLeft, ArrowRight, AudioLines, Bell, Check, CheckCircle2, ChevronDown, CircleAlert,
  CodeXml, CreditCard, FileText, FolderOpen, FolderKanban, Globe2, GraduationCap, HelpCircle, LayoutTemplate, LoaderCircle, Mail, Mic, Search,
  LockKeyhole, LogOut, Menu, MessageCircle, Moon, Paperclip, PanelLeftClose,
  PanelLeftOpen, PanelRightClose, PanelRightOpen, Plus, Save, Send, Settings2,
  ShieldCheck, SlidersHorizontal, Sparkles, Sun, Trash2, UploadCloud, X,
  ChevronRight, Database, Eye, GripVertical, Keyboard, MoreHorizontal, Pencil, Pin, PinOff, UserRound, Volume2, BellRing, Shield, Sliders, Monitor, Palette, Languages, CircleUserRound, LogOut as LogOutIcon, LayoutDashboard, Users, AlertTriangle, ClipboardList, Megaphone, RefreshCw, MessageSquareText, Activity, FileCog,
} from 'lucide-react';
import { api, clearCsrfToken, download, setCsrfToken } from './api';
import { departments, programs } from './data';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import './styles.css';
import FigmaLanding from './FigmaLanding';
import { FeatureUpdatesAdmin, ProductUpdatePopup } from './FeatureUpdates';

const AppContext = createContext(null);

const I18nContext = createContext({ language: 'id', t: (value) => value });
const textNodeOriginals = new WeakMap();
const textNodeRendered = new WeakMap();
const attributeOriginals = new WeakMap();
const attributeRendered = new WeakMap();

const EN_UI = {
  'Chat baru': 'New chat',
  'Chats': 'Chats',
  'Dokumen': 'Documents',
  'Recents': 'Recents',
  'Disematkan': 'Pinned',
  'Belum dikelompokkan': 'Ungrouped',
  'Bantuan': 'Help',
  'Feedback': 'Feedback',
  'Settings': 'Settings',
  'Keluar': 'Log out',
  'Log out': 'Log out',
  'Upgrade plan': 'Upgrade plan',
  'Personalisasi': 'Personalization',
  'Jurusan & prodi': 'Department & program',
  'Akun Laprakin': 'Laprakin account',
  'Workspace pribadi': 'Personal workspace',
  'General': 'General',
  'Notifications': 'Notifications',
  'Personalization': 'Personalization',
  'Billing': 'Billing',
  'Data controls': 'Data controls',
  'Storage': 'Storage',
  'Safety': 'Safety',
  'Security and login': 'Security and login',
  'Keyboard': 'Keyboard',
  'Appearance': 'Appearance',
  'Contrast': 'Contrast',
  'Accent color': 'Accent color',
  'Language': 'Language',
  'Light': 'Light',
  'Dark': 'Dark',
  'System': 'System',
  'Default': 'Default',
  'High': 'High',
  'Bahasa Indonesia': 'Bahasa Indonesia',
  'English': 'English',
  'Compact workspace': 'Compact workspace',
  'Rapatkan jarak dan komponen di workspace.': 'Use tighter spacing and compact components in the workspace.',
  'Proses dokumen': 'Document processing',
  'Deadline laprak': 'Report deadline',
  'Update produk': 'Product updates',
  'Gaya bahasa': 'Writing style',
  'Sudut pandang': 'Perspective',
  'Struktur awal': 'Default structure',
  'Instruksi tambahan': 'Additional instructions',
  'Billing & QRIS': 'Billing & QRIS',
  'Current plan': 'Current plan',
  'Pilih plan': 'Choose a plan',
  'Pilih kebutuhanmu.': 'Choose what you need.',
  'Plan aktif': 'Current plan',
  'Pilih Pro': 'Choose Pro',
  'Pilih Max': 'Choose Max',
  'Dipilih': 'Selected',
  'Bayar dengan QRIS': 'Pay with QRIS',
  'Refresh status': 'Refresh status',
  'Kembali ke workspace': 'Back to workspace',
  'History transaksi': 'Transaction history',
  'Riwayat akun': 'Account history',
  'Muat ulang': 'Reload',
  'Belum ada transaksi.': 'No transactions yet.',
  'Buka Billing': 'Open Billing',
  'Kelola billing di halaman khusus.': 'Manage billing on a dedicated page.',
  'Chat disematkan.': 'Chat pinned.',
  'Chat dilepas dari sematan.': 'Chat unpinned.',
  'Chat diarsipkan.': 'Chat archived.',
  'Chat dihapus permanen.': 'Chat permanently deleted.',
  'Ubah nama': 'Rename',
  'Pindahkan ke folder': 'Move to folder',
  'Folder baru': 'New folder',
  'Pin chat': 'Pin chat',
  'Lepas pin': 'Unpin chat',
  'Arsip': 'Archive',
  'Hapus': 'Delete',
  'Konfigurasi': 'Configuration',
  'Konfigurasi chat': 'Chat configuration',
  'Simpan': 'Save',
  'Muat dokumen kerja...': 'Loading working document...',
  'Buat laprak': 'Create report',
  'Export Word': 'Export Word',
  'Unduh': 'Download',
  'Kirim': 'Send',
  'Tambah bahan': 'Add material',
  'Jenis bahan': 'Material type',
  'Modul / artikel': 'Module / article',
  'Screenshot / bukti': 'Screenshot / evidence',
  'Template': 'Template',
  'Data': 'Data',
  'Tulis tugasmu, tempel link, atau paste gambar...': 'Write your task, paste a link, or paste an image...',
  'Tambahkan pesan untuk bahan ini...': 'Add a message for these materials...',
  'Enter untuk kirim · Shift + Enter untuk baris baru · file hanya terlihat di akunmu': 'Enter to send · Shift + Enter for a new line · files are private to your account',
  'Notifikasi': 'Notifications',
  'Tandai semua dibaca': 'Mark all as read',
  'Semua sudah dibaca': 'All caught up',
  'Belum ada notifikasi.': 'No notifications yet.',
  'Tutup': 'Close',
  'Buat chat laprak dulu.': 'Create a report chat first.',
  'Mulai dengan teks, bahan, atau link yang kamu punya.': 'Start with any text, materials, or links you have.',
  'Chat Laprakin': 'Laprakin chat',
  'Dokumen kerja': 'Working document',
  'Dokumen ini belum memiliki ruang chat yang bisa dibuka.': 'This document does not yet have a chat room that can be opened.',
  'Refresh': 'Refresh',
  'Cari judul, mata kuliah, atau modul': 'Search title, course, or module',
  'Buka chat': 'Open chat',
  'mau laprakin apa hari ini,': 'what would you like to Laprakin today,',
  'Buat folder baru': 'Create new folder',
  'Nama folder baru': 'New folder name',
  'Pilih jurusan': 'Choose department',
  'Pilih prodi': 'Choose program',
  'Formal': 'Formal',
  'Semi-formal': 'Semi-formal',
  'Saya': 'I',
  'Kita': 'We',
  'Impersonal': 'Impersonal',
  'Berbasis langkah': 'Step-based',
  'Berbasis pengujian': 'Testing-based',
  'Berbasis proyek': 'Project-based',
  'Gratis': 'Free',
  'Credit tersedia': 'Available credits',
  'Tidak berlangganan': 'Not subscribed',
  'Status': 'Status',
  'Menunggu pembayaran. Scan QRIS yang muncul di checkout Midtrans.': 'Waiting for payment. Scan the QRIS shown in Midtrans checkout.',
  'Pembayaran berhasil. Credit atau plan telah diaktifkan oleh server.': 'Payment successful. Credits or plan were activated by the server.',
  'Pembayaran ditolak. Pilih checkout QRIS baru bila ingin mencoba lagi.': 'Payment was declined. Create a new QRIS checkout to try again.',
  'Kode QRIS sudah kedaluwarsa. Buat checkout QRIS baru.': 'The QRIS code has expired. Create a new QRIS checkout.',
  'Checkout dibatalkan. Belum ada credit atau plan yang ditambahkan.': 'Checkout was cancelled. No credits or plan were added.',
  'Gateway belum aktif': 'Gateway unavailable',
  'Pembayaran aman melalui QRIS Dinamis Midtrans.': 'Secure payment through Dynamic QRIS Midtrans.',
  'Pilih paket yang sesuai ritme belajarmu.': 'Choose the plan that fits your study rhythm.',
  'Plan untuk kebutuhan praktikum yang rutin.': 'A plan for regular practical coursework.',
  'Plan untuk semester padat dan revisi intensif.': 'A plan for busy semesters and intensive revisions.',
  'Mulai dan pahami alur kerja Laprakin.': 'Start and learn the Laprakin workflow.',
};


Object.assign(EN_UI, {
  'Perbandingan dokumen': 'Document comparison',
  'Bandingkan hasilnya.': 'Compare the results.',
  'Lihat perbedaan alur, kelengkapan pembahasan, dan kerapian hasil dari dua dokumen yang mengerjakan konteks praktikum yang sama.': 'See the difference in flow, completeness, and document polish for the same practical-work context.',
  'Pilih mode untuk melihat perbandingan Laprakin yang sesuai.': 'Choose a mode to view the matching Laprakin comparison.',
  'Perbandingan mode': 'Mode comparison',
  'Geser atau scroll dokumen untuk melihat detailnya.': 'Swipe or scroll the documents to see the details.',
  'Masuk': 'Sign in',
  'Coba gratis': 'Try for free',
  'Layanan': 'Services',
  'Perbedaan': 'Compare',
  'Tutorial': 'Tutorial',
  'Harga': 'Pricing',
  'Ceritakan tugasmu atau paste gambar di sini...': 'Describe your task or paste an image here...',
  'Lampirkan file': 'Attach file',
  'Punya modul & bukti': 'I have a module & evidence',
  'Hanya teks': 'Text only',
  'Lihat perbedaan': 'See the comparison',
  'Scroll untuk lanjut': 'Scroll to continue',
  'Muat ulang halaman untuk melanjutkan.': 'Reload the page to continue.',
  'Halaman sedang dimuat ulang dengan aman.': 'The page is being safely reloaded.',
  'Tampilan tidak dapat dimuat.': 'This view could not be loaded.',
  'Kembali ke beranda': 'Back to homepage',
  'Daftar': 'Sign up',
  'Masuk dengan Google': 'Sign in with Google',
  'Lupa kata sandi?': 'Forgot password?',
  'Buat akun': 'Create account',
  'Email': 'Email',
  'Kata sandi': 'Password',
  'Nama lengkap': 'Full name',
  'Verifikasi email': 'Verify email',
  'Kirim ulang email': 'Resend email',
  'Buat chat laprak dulu.': 'Create a report chat first.',
  'Panel ini baru dipakai untuk mengubah konteks tugas yang sedang dibuka.': 'This panel is used to change the context of the open task.',
  'Hanya untuk laprak ini.': 'Only for this report chat.',
  'Nama laprak': 'Report name',
  'Mata kuliah': 'Course',
  'Modul atau konteks': 'Module or context',
  'Jenis struktur': 'Structure type',
  'Struktur prodi': 'Program structure',
  'Dipakai otomatis.': 'Applied automatically.',
  'Struktur khusus': 'Custom structure',
  'Hanya bila tugas berbeda.': 'Only for a different task format.',
  'Susunan bagian': 'Section order',
  'Simpan konfigurasi': 'Save configuration',
  'Jurusan, prodi, gaya penulisan, dan billing ada di Settings. Dark mode bisa diubah dari header workspace.': 'Department, program, writing preferences, and billing are in Settings. Dark mode can be changed from the workspace header.',
  'Ringkas konteks tugas.': 'Summarize the task context.',
  'Opsional bila bahan file belum cukup menjelaskan tugas.': 'Optional when uploaded materials do not fully explain the task.',
  'Modul / topik': 'Module / topic',
  'Permintaan dosen': 'Instructor request',
  'Tambah modul / paper / screenshot': 'Add module / paper / screenshot',
  'Tambahkan file bila perlu.': 'Add files if needed.',
  'Siap membuat dokumen kerja?': 'Ready to create a working document?',
  'Semua bahan dan konteks chat ini akan dipakai sebagai titik awal.': 'All materials and chat context will be used as a starting point.',
  'Analisis': 'Analyze',
  'Susun draft': 'Create draft',
  'Susun ulang': 'Regenerate',
  'Pilih atau upgrade plan dari halaman harga. Riwayat pembayaran disimpan di Settings ini.': 'Choose or upgrade a plan from the pricing page. Payment history is stored in these settings.',
  'Lihat plan': 'View plans',
  'Memuat riwayat...': 'Loading history...',
  'Plan dan riwayat transaksi.': 'Plan and transaction history.',
  'Plan dasar': 'Base plan',
  'Mulai gratis': 'Start free',
  'Individual': 'Individual',
  'Pilih plan yang pas untukmu.': 'Choose the plan that fits you.',
  'Pilih plan yang tepat untukmu.': 'Choose the plan that is right for you.',
  'Mulai dari kebutuhan praktikum harian, lalu naikkan kapasitas saat ritme belajarmu bertambah.': 'Start with daily coursework, then increase capacity as your workload grows.',
  'Kembali': 'Back',
  'Cari chat': 'Search chats',
  'Cari settings': 'Search settings',
  'Mulai tanpa biaya': 'Start at no cost',
  'Untuk laprak harian': 'For everyday reports',
  'Untuk semester padat': 'For busy semesters',
  'Pembayaran QRIS baru dimulai setelah login.': 'QRIS payment starts after you sign in.',
  'Naikkan kapasitas Laprakin saat kamu membutuhkannya.': 'Increase Laprakin capacity when you need it.',
  'Checkout QRIS': 'QRIS checkout',
  'Menghitung…': 'Calculating…',
  'Plan pilihanmu': 'Your selected plan',
  'berlaku 30 hari': 'valid for 30 days',
  'Status pembayaran': 'Payment status',
  'Status pembayaran sedang diproses.': 'Payment status is being processed.',
  'Menyiapkan checkout QRIS.': 'Preparing QRIS checkout.',
  'Pembayaran QRIS berhasil diverifikasi.': 'QRIS payment was successfully verified.',
  'Bantuan Laprakin': 'Laprakin help',
  'Feedback pengguna': 'User feedback',
  'Kirim feedback': 'Send feedback',
  'Riwayat feedback': 'Feedback history',
  'Monitoring': 'Monitoring',
  'Risk review': 'Risk review',
  'CMS landing': 'Landing CMS',
  'Audit log': 'Audit log',
  'Retensi': 'Retention',
  'Admin console': 'Admin console',
  'Muat Admin Console…': 'Loading Admin Console…',
  'Coba muat ulang': 'Try reloading',
  'Muat ulang': 'Reload',
  'Privacy-first monitoring': 'Privacy-first monitoring',
  'User aktif': 'Active users',
  'Dokumen aktif': 'Active documents',
  'Job berjalan': 'Running jobs',
  'Feedback terbuka': 'Open feedback',
  'Risk terbuka': 'Open risks',
  'Aktivitas 7 hari': '7-day activity',
  'Job terbaru': 'Recent jobs',
  'Kejadian perlu ditinjau': 'Events requiring review',
  'Tinjau': 'Review',
  'Tutup': 'Close',
  'Landing CMS': 'Landing CMS',
  'Simpan CMS': 'Save CMS',
  'Pembersihan retensi': 'Retention cleanup',
  'Jalankan pembersihan': 'Run cleanup',
  'Akhiri semua sesi': 'End all sessions',
  'Ubah kata sandi': 'Change password',
  'Hapus akun': 'Delete account',
  'Unduh data saya': 'Download my data',
  'Izinkan AI eksternal': 'Allow external AI',
  'Kurangi animasi': 'Reduce motion',
  'Enter untuk kirim': 'Enter to send',
  'Gunakan Shift + Enter untuk membuat baris baru.': 'Use Shift + Enter to create a new line.',
  'Pengaturan akun': 'Account settings',
  'Projects': 'Projects',
  'Project baru': 'New project',
  'Cari project': 'Search projects',
  'Semua': 'All',
  'Dibuat oleh kamu': 'Created by you',
  'Dibagikan dengan kamu': 'Shared with you',
  'Nama': 'Name',
  'Diubah': 'Modified',
  'Belum ada project.': 'No projects yet.',
  'Buat project pertamamu untuk mengelompokkan chat dan dokumen.': 'Create your first project to organize chats and documents.',
  'Beri nama project baru': 'Name your new project',
  'Chat baru di': 'New chat in',
  'Sumber': 'Sources',
  'Belum ada chat di project ini.': 'No chats in this project yet.',
  'Belum ada sumber dalam project ini.': 'No sources in this project yet.',
  'Bagikan': 'Share',
  'Project pribadi': 'Personal project',
  'Kembali ke Projects': 'Back to Projects',
  'Buka project': 'Open project',
  'Buka chat': 'Open chat',
  'Project belum diberi nama.': 'Project needs a name.',
  'Project dibuat.': 'Project created.',
  'Bandingkan hasilnya': 'Compare the results',
  'AI chat gratisan': 'Free AI chat',
  'Hasil pembanding': 'Comparison result',
  'PDF belum ditambahkan': 'PDF not added yet',
  'Upload dua dokumen untuk mode ini melalui CMS Landing.': 'Upload two documents for this mode through Landing CMS.',
  'Analisis lebih terarah': 'More focused analysis',
  'Penalaran paling mendalam': 'Deepest reasoning',
  'Tersedia untuk semua': 'Available to everyone',
  'Credit Laprak atau Pro': 'Laprakin credit or Pro',
  'Khusus Max': 'Max only',
});

Object.assign(EN_UI, {
  'Atur titik awal sekali saja.': 'Set your starting point once.',
  'Preferensi ini disimpan untuk chat berikutnya dan selalu bisa diubah di Settings.': 'These preferences are saved for future chats and can always be changed in Settings.',
  'Jurusan': 'Department',
  'Prodi': 'Study program',
  'Gaya': 'Tone',
  'Opsional, bisa ditambahkan sekarang atau nanti.': 'Optional. Add it now or later.',
  'Simpan & lanjut': 'Save & continue',
  'bahan siap dikirim': 'materials ready to send',
  'Bahan di chat': 'Chat materials',
  'file ikut saat laprak dibuat.': 'files will be included when the report is created.',
  'Siap membuat dokumen kerja?': 'Ready to create a working document?',
  'Semua bahan dan konteks chat ini akan dipakai sebagai titik awal.': 'All materials and chat context will be used as the starting point.',
  'Buat laprak': 'Create report',
  'Menyiapkan respons...': 'Preparing response...',
  'Ceritakan tugas yang ingin kamu susun...': 'Describe the assignment you want to work on...',
  'Laprak': 'Report',
  'Makalah': 'Paper',
  'Tugas akhir': 'Final project',
  'Jurnal': 'Journal',
  'Pilih jenis dokumen': 'Choose a document type',
  'Ikuti sistem': 'Use system setting',
  'Terang': 'Light',
  'Gelap': 'Dark',
  'Tinggi': 'High',
  'Tema': 'Theme',
  'Kontras': 'Contrast',
  'Bahasa': 'Language',
  'Warna aksen': 'Accent color',
  'Dipakai untuk tombol utama dan status aktif—bukan seluruh hover.': 'Used for primary actions and active status—not every hover state.',
  'Workspace ringkas': 'Compact workspace',
  'Perubahan diterapkan langsung.': 'Changes apply instantly.',
  'Tampilan workspace': 'Workspace appearance',
  'Atur tema, kepadatan, bahasa, dan warna aksen.': 'Set the theme, density, language, and accent color.',
});

function translateUiText(value, language) {
  if (language !== 'en' || typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  const translated = EN_UI[trimmed] || trimmed
    .replace(/^mau laprakin apa hari ini,\s*/i, 'what would you like to Laprakin today, ')
    .replace(/^Free plan$/, 'Free plan')
    .replace(/^Free plan\s*·\s*Upgrade$/, 'Free plan · Upgrade')
    .replace(/^Pro\s*·\s*Upgrade$/, 'Pro · Upgrade')
    .replace(/^Max\s*·\s*Upgrade$/, 'Max · Upgrade');
  if (translated === trimmed) return value;
  const leading = value.match(/^\s*/)?.[0] || '';
  const trailing = value.match(/\s*$/)?.[0] || '';
  return `${leading}${translated}${trailing}`;
}

function I18nRuntime({ children }) {
  const { prefs } = useApp();
  const language = prefs?.language || 'id';
  const resolvedTheme = useResolvedTheme(prefs?.theme || 'system');
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
  return <I18nContext.Provider value={{ language, t: (value) => translateUiText(value, language) }}>{children}</I18nContext.Provider>;
}

function useI18n() { return useContext(I18nContext); }

function userInitials(user) {
  const source = String(user?.fullName || user?.email || 'Laprakin').trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase().slice(0, 2) || 'L';
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
  free: { credits: 2, revisionsPerReport: 3, storageMb: 100 },
  single: { unitPrice: 3900, minQuantity: 1, maxQuantity: 20, revisionsPerReport: 5, storageMb: 500 },
  monthly: { price: 29900, credits: 12, durationDays: 30, revisionsPerReport: 5, storageGb: 1 },
  pro: { price: 45900, credits: 20, durationDays: 30, revisionsPerReport: 15, storageGb: 5 },
};
function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme = 'system') {
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  return getSystemTheme();
}

function useResolvedTheme(theme = 'system') {
  const [resolved, setResolved] = useState(() => resolveTheme(theme));
  useEffect(() => {
    const update = () => setResolved(resolveTheme(theme));
    update();
    if (theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, [theme]);
  return resolved;
}

const defaultPrefs = {
  theme: 'system', language: 'id', compact: true, reducedMotion: false, enterToSend: true,
  tone: 'semi-formal', perspective: 'saya', profile: 'langkah', accent: 'lime', productUpdates: true, allowExternalAi: true,
};
const workspaceAccents = [
  { key: 'lime', label: 'Lime', color: '#c2ff33', contrast: '#101506' },
  { key: 'blue', label: 'Biru', color: '#78a9ff', contrast: '#07111f' },
  { key: 'violet', label: 'Ungu', color: '#b69cff', contrast: '#130d22' },
  { key: 'coral', label: 'Koral', color: '#ff9b7b', contrast: '#24100a' },
  { key: 'amber', label: 'Amber', color: '#f3c969', contrast: '#211704' },
  { key: 'gray', label: 'Abu-abu', color: '#b9bab6', contrast: '#111210' },
];
const defaultChatConfig = {
  title: 'Laprak baru',
  structureMode: 'guided',
  configuration: { courseName: '', moduleTitle: '', documentProfile: 'langkah', customStructure: '', instructions: '', tone: 'semi-formal', perspective: 'saya', allowExternalAi: true },
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

function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('App context belum tersedia.');
  return value;
}

function BrandMark({ className = '', alt = 'Laprakin' }) {
  return <img className={`brand-mark ${className}`.trim()} src="/brand/laprakin-mark.png" alt={alt} />;
}

function Button({ children, to, variant = 'primary', className = '', type = 'button', onClick, disabled, title }) {
  const classes = `button button-${variant} ${className}`.trim();
  if (to) return <Link className={classes} to={to} title={title}>{children}</Link>;
  return <button className={classes} type={type} onClick={onClick} disabled={disabled} title={title}>{children}</button>;
}

function IconButton({ label, children, className = '', onClick, disabled = false, type = 'button' }) {
  return <button type={type} className={`icon-button ${className}`} title={label} aria-label={label} onClick={onClick} disabled={disabled}>{children}</button>;
}

function CustomSelect({ value, onChange, options, className = '', disabled = false, ariaLabel = 'Pilih opsi' }) {
  const [open, setOpen] = useState(false);
  const current = options.find((item) => item.value === value) || options[0];
  return <div className={`select-menu ${className}`}>
    <button type="button" className="select-trigger" disabled={disabled} aria-label={ariaLabel} aria-expanded={open} onClick={() => setOpen(!open)}>
      <span>{current?.label || 'Pilih'}</span><ChevronDown size={14} />
    </button>
    {open && <div className="select-options">{options.map((item) => <button key={item.value} type="button" className={item.value === value ? 'selected' : ''} onClick={() => { onChange(item.value); setOpen(false); }}><span>{item.label}</span>{item.value === value && <Check size={13} />}</button>)}</div>}
  </div>;
}

function Toggle({ checked, onChange, title, description }) {
  return <label className="toggle-control"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="toggle-dot" /><span><b>{title}</b>{description && <small>{description}</small>}</span></label>;
}

function formatCurrency(value = 0) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value); }
function formatBytes(value = 0) {
  if (!value) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}
function formatDate(value) { const locale = document.documentElement.lang === 'en' ? 'en-US' : 'id-ID'; return value ? new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '—'; }

function AppProvider({ children }) {
  const [session, setSession] = useState({ loading: true, user: null, wallet: null });
  const [prefs, setPrefs] = useState(readPrefs);
  const [notice, setNotice] = useState(null);
  const [dialog, setDialog] = useState(null);
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
  useEffect(() => { refreshSession(); }, []);
  useEffect(() => { localStorage.setItem('laprakin-preferences', JSON.stringify(prefs)); }, [prefs]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const value = useMemo(() => ({ ...session, setSession, refreshSession, prefs, setPrefs, notice, setNotice, showDialog }), [session, prefs, notice, showDialog]);
  return <AppContext.Provider value={value}>{children}{notice && <div className="toast" role="status"><span>{notice}</span><IconButton label="Tutup notifikasi" onClick={() => setNotice(null)}><X size={14} /></IconButton></div>}<AppDialog dialog={dialog} onResolve={resolveDialog} /></AppContext.Provider>;
}

function App() {
  const location = useLocation();
  return <AppErrorBoundary resetKey={location.pathname}><AppProvider><I18nRuntime><div className="route-transition"><Routes><Route path="/" element={<Landing />} /><Route path="/auth" element={<AuthPage />} /><Route path="/pricing" element={<PublicPricingPage />} /><Route path="/billing" element={<PricingRedirect />} /><Route path="/app/billing" element={<PricingRedirect />} /><Route path="/admin/*" element={<ProtectedAdmin />} /><Route path="/app/*" element={<ProtectedApp />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></div></I18nRuntime></AppProvider></AppErrorBoundary>;
}

function Landing() {
  const { user, loading } = useApp();
  const navigate = useNavigate();
  if (loading) return <LoadingScreen />;
  if (user?.emailVerified) return <Navigate to={user.role === 'admin' ? '/admin' : '/app'} replace />;
  return <FigmaLanding navigate={navigate} />;
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
  if (!url) return <div className="laprakin-window compare-document-fallback"><div className="attachment-row"><FileText size={14} /><span>modul-routing.pdf</span><Check size={13} /></div><div className="attachment-row"><FileText size={14} /><span>bukti-praktik.docx · 12 gambar</span><Check size={13} /></div><div className="doc-mini"><small>Dokumen kerja</small><b>Routing Protocol</b><div><span className="done">Analisis</span><span>Susun draft</span><span>Export Word</span></div></div></div>;
  return <div className={`compare-linked-preview ${isPdf ? 'pdf' : 'image'}`} tabIndex="0"><div className="compare-scroll-stage">{isPdf ? <iframe src={`${url}#toolbar=0&navpanes=0&scrollbar=0`} title="Preview PDF landing" /> : <img src={url} alt={media?.compareCaption || 'Preview bahan Laprakin'} />}</div><div className="compare-scroll-hint"><span>{isPdf ? 'Preview PDF' : 'Preview WEBP / gambar'}</span><small>Hover untuk melihat bagian bawah</small></div></div>;
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

function AuthPage() {
  const { user, refreshSession, prefs } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const authTheme = useResolvedTheme(prefs?.theme || 'system');
  const query = new URLSearchParams(location.search);
  const verifyToken = query.get('verify') || '';
  const resetToken = query.get('reset') || '';
  const requestedNext = query.get('next') || '';
  const safeNext = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '';
  const destination = safeNext || (user?.role === 'admin' ? '/admin' : '/app');
  const [mode, setMode] = useState(resetToken ? 'reset' : 'login');
  const [form, setForm] = useState({ email: '', password: '', newPassword: '', referralCode: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devToken, setDevToken] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);
  useEffect(() => { api('/meta', { includeCsrf: false }).then((data) => setGoogleEnabled(Boolean(data.features?.googleLoginEnabled))).catch(() => {}); }, []);
  useEffect(() => { if (user?.emailVerified) navigate(destination); }, [user, navigate, destination]);
  useEffect(() => { if (!verifyToken) return; (async () => { setBusy(true); try { const data = await api('/auth/verify', { method: 'POST', body: { token: verifyToken }, includeCsrf: false }); setCsrfToken(data.csrfToken); const nextSession = await refreshSession(); navigate(safeNext || (nextSession?.user?.role === 'admin' ? '/admin' : '/app')); } catch (err) { setError(err.message); } finally { setBusy(false); } })(); }, [verifyToken, navigate, refreshSession]);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      if (mode === 'login') { const data = await api('/auth/login', { method: 'POST', body: { email: form.email, password: form.password }, includeCsrf: false }); setCsrfToken(data.csrfToken); const nextSession = await refreshSession(); navigate(safeNext || (nextSession?.user?.role === 'admin' ? '/admin' : '/app')); }
      if (mode === 'register') { const data = await api('/auth/register', { method: 'POST', body: { email: form.email, password: form.password, referralCode: form.referralCode }, includeCsrf: false }); setDevToken(data.developmentVerificationToken || ''); setSuccess('Akun dibuat. Verifikasi email sebelum memakai credit gratis.'); }
      if (mode === 'forgot') { const data = await api('/auth/request-password-reset', { method: 'POST', body: { email: form.email }, includeCsrf: false }); setDevToken(data.developmentResetToken || ''); setSuccess(data.message || 'Link reset telah diproses.'); }
      if (mode === 'reset') { const data = await api('/auth/reset-password', { method: 'POST', body: { token: resetToken || devToken, password: form.newPassword }, includeCsrf: false }); setCsrfToken(data.csrfToken); const nextSession = await refreshSession(); navigate(safeNext || (nextSession?.user?.role === 'admin' ? '/admin' : '/app')); }
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const verifyDev = async () => { setBusy(true); try { const data = await api('/auth/verify', { method: 'POST', body: { token: devToken }, includeCsrf: false }); setCsrfToken(data.csrfToken); const nextSession = await refreshSession(); navigate(safeNext || (nextSession?.user?.role === 'admin' ? '/admin' : '/app')); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  const info = { login: ['Masuk', 'Lanjutkan chat dan laprak yang sedang kamu kerjakan.'], register: ['Buat akun', '2 credit aktif setelah email terverifikasi.'], forgot: ['Atur ulang akses', 'Masukkan email untuk meminta link reset.'], reset: ['Kata sandi baru', 'Gunakan kata sandi yang belum pernah dipakai.'] }[mode];
  const changeMode = (nextMode) => { setMode(nextMode); setError(''); setSuccess(''); setDevToken(''); };
  const formModes = !['forgot', 'reset'].includes(mode);
  return <div className={`auth-page auth-page-${mode} theme-${authTheme}`}>
    <header className="auth-topbar">
      <Link to="/" className="auth-brand"><BrandMark /><b>laprakin</b><small>BETA</small></Link>
      <Link to="/" className="auth-back-link"><ArrowLeft size={15} />Beranda</Link>
    </header>
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-card-heading">
          <span className="auth-eyebrow">Workspace akademik</span>
          <h1>{info[0]}</h1>
          <p>{info[1]}</p>
        </div>
        {formModes && <div className="auth-mode-tabs" aria-label="Pilih akses akun">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>Masuk</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => changeMode('register')}>Daftar</button>
        </div>}
        {googleEnabled && formModes && <>
          <button type="button" className="google-button" onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL || '/api'}/auth/google/start?next=${encodeURIComponent(safeNext || '/app')}`; }}><b>G</b> Lanjutkan dengan Google</button>
          <div className="auth-divider"><span>atau gunakan email</span></div>
        </>}
        {success && <div className="auth-notice success"><CheckCircle2 size={15} />{success}</div>}
        {devToken && mode === 'register' ? <div className="local-verify"><p>Mode lokal: verifikasi tanpa provider email.</p><button type="button" className="auth-submit" onClick={verifyDev} disabled={busy}>Verifikasi sekarang <ArrowRight size={15} /></button></div> : <form onSubmit={submit} className="auth-form">
          {mode !== 'reset' && <label><span>Email</span><input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="nama@email.com" /></label>}
          {['login', 'register'].includes(mode) && <label><span>Kata sandi</span><input type="password" minLength="8" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Minimal 8 karakter" /></label>}
          {mode === 'register' && <label><span>Kode referral <small>opsional</small></span><input value={form.referralCode} onChange={(event) => setForm({ ...form, referralCode: event.target.value })} placeholder="R-XXXXXXXX" /></label>}
          {mode === 'reset' && <label><span>Kata sandi baru</span><input type="password" minLength="8" required value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} placeholder="Minimal 8 karakter" /></label>}
          {error && <div className="auth-notice error"><CircleAlert size={15} />{error}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy && <LoaderCircle className="spin" size={15} />}{mode === 'login' ? 'Masuk ke workspace' : mode === 'register' ? 'Buat akun' : mode === 'forgot' ? 'Kirim link reset' : 'Simpan kata sandi'} <ArrowRight size={15} /></button>
        </form>}
        <div className="auth-card-footer">
          {mode === 'login' && <button type="button" className="auth-text-button" onClick={() => changeMode('forgot')}>Lupa kata sandi?</button>}
          {['forgot', 'reset'].includes(mode) && <button type="button" className="auth-text-button" onClick={() => changeMode('login')}><ArrowLeft size={13} />Kembali ke masuk</button>}
          {formModes && <span>File tetap privat di dalam akunmu.</span>}
        </div>
      </section>
      <p className="auth-legal">Dengan melanjutkan, kamu menyetujui ketentuan dan kebijakan privasi Laprakin.</p>
    </main>
  </div>;
}

function ProtectedApp() { const { loading, user } = useApp(); if (loading) return <LoadingScreen />; if (!user) return <Navigate to="/auth" replace />; if (user.role === 'admin') return <Navigate to="/admin" replace />; return <Workspace />; }

function PublicPricingPage() {
  const { user, prefs, setNotice, refreshSession } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
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
  const [error, setError] = useState('');

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
      features: [`${pricing.free?.credits || 2} credit awal`, `${pricing.free?.revisionsPerReport || 3} revisi per laprak`, `${pricing.free?.storageMb || 100} MB penyimpanan`],
    },
    {
      key: 'credit', label: 'Satuan', note: 'Bayar sesuai kebutuhan', price: formatCurrency(pricing.single?.unitPrice || 3900), suffix: '/ laprak',
      features: ['Tanpa subscription', `${pricing.single?.revisionsPerReport || 5} revisi per laprak`, 'Aktif hingga 180 hari'],
    },
    {
      key: 'monthly', label: 'Pro', note: 'Untuk laprak harian', price: formatCurrency(pricing.monthly?.price || 29900), suffix: '/ 30 hari',
      features: [`${pricing.monthly?.credits || 12} credit / 30 hari`, 'Mode Thinking terbuka', `${pricing.monthly?.storageGb || 1} GB penyimpanan`],
    },
    {
      key: 'pro', label: 'Max', note: 'Untuk semester padat', price: formatCurrency(pricing.pro?.price || 45900), suffix: '/ 30 hari',
      features: [`${pricing.pro?.credits || 20} credit / 30 hari`, 'Mode XtraThink terbuka', `${pricing.pro?.storageGb || 5} GB penyimpanan`],
    },
  ];

  const updateSelectedUrl = (key, quantity = creditQuantity) => {
    const query = new URLSearchParams();
    query.set('plan', key);
    if (key === 'credit') query.set('quantity', String(quantity));
    navigate(`/pricing?${query.toString()}`, { replace: true });
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
      const next = `/pricing?${query.toString()}`;
      navigate(`/auth?next=${encodeURIComponent(next)}`);
      return;
    }
    setError('');
    setSelected(key);
    updateSelectedUrl(key);
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
    try {
      const payload = await api('/payments/checkout', { method: 'POST', body: { items: cartItems } });
      if (payload.mode === 'manual') {
        await updateOrder(payload.order, 'Checkout QRIS lokal diproses untuk pengujian.');
        return;
      }
      await updateOrder(payload.order);
      window.sessionStorage.setItem('laprakin:active-payment-order', payload.orderId);
      const snap = await loadMidtransSnap(payload);
      const refreshAfterCallback = () => refreshOrder(payload.orderId, true);
      if (snap && payload.snapToken) {
        snap.pay(payload.snapToken, {
          onSuccess: refreshAfterCallback,
          onPending: refreshAfterCallback,
          onError: () => setError('Pembayaran QRIS belum berhasil. Periksa status order atau coba lagi.'),
          onClose: () => setNotice('Checkout ditutup. Order tetap menunggu selama QRIS belum kedaluwarsa.'),
        });
      } else if (payload.checkoutUrl) {
        window.location.assign(payload.checkoutUrl);
      } else {
        throw new Error('Checkout QRIS belum tersedia. Coba lagi beberapa saat.');
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

  return <div className={`pricing-compact-page ${resolvedTheme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
    <header className="pricing-compact-nav"><button type="button" onClick={() => navigate(user ? '/app' : '/')} aria-label="Kembali"><ArrowLeft size={18}/></button></header>
    <main className="pricing-compact-main">
      <section className="pricing-compact-intro" aria-labelledby="pricing-compact-title">
        <span>Pilihan Laprakin</span>
        <h1 id="pricing-compact-title">Pilih plan yang pas buat kamu.</h1>
        <p>Mulai gratis, beli credit satuan, atau pilih akses bulanan sesuai ritme praktikum.</p>
      </section>
      <section className="pricing-compact-grid" aria-label="Pilihan plan Laprakin">
        {cards.map((card) => {
          const isFree = card.key === 'free';
          const isCurrent = card.key === currentPlanKey;
          const isSelected = card.key === selected;
          const actionLabel = isFree ? (user ? 'Masuk workspace' : 'Mulai gratis') : isSelected && user ? 'Dipilih' : `Pilih ${card.label}`;
          return <article key={card.key} className={`pricing-compact-card ${isSelected ? 'is-selected' : ''} ${isCurrent ? 'is-current' : ''}`} onClick={() => !isFree && selectProduct(card.key)}>
            <div className="pricing-compact-card-head"><span className="pricing-compact-symbol" aria-hidden="true"><Sparkles size={14}/></span><div><b>{card.label}</b><small>{isCurrent ? 'Plan aktif' : card.note}</small></div></div>
            <div className="pricing-compact-price"><strong>{card.price}</strong>{card.suffix && <span>{card.suffix}</span>}</div>
            <div className="pricing-compact-action-slot">
              {card.key === 'credit' ? <div className="pricing-compact-quantity" onClick={(event) => event.stopPropagation()}><span>Jumlah</span><div><button type="button" aria-label="Kurangi credit" onClick={() => updateCreditQuantity(creditQuantity - 1)}>−</button><b>{creditQuantity}</b><button type="button" aria-label="Tambah credit" onClick={() => updateCreditQuantity(creditQuantity + 1)}>+</button></div></div> : <span className="pricing-compact-quantity-placeholder" aria-hidden="true" />}
            </div>
            <button type="button" className={isCurrent || isFree ? 'is-quiet' : ''} onClick={(event) => { event.stopPropagation(); selectProduct(card.key); }}>{actionLabel}{!isFree && <ArrowRight size={15}/>}</button>
            <div className="pricing-compact-divider" />
            <ul>{card.features.map((feature) => <li key={feature}><Check size={13}/><span>{feature}</span></li>)}</ul>
          </article>;
        })}
      </section>
      {user && selected && <section className="pricing-compact-checkout" aria-live="polite"><div><small>Checkout QRIS</small><b>{quoteBusy ? 'Menghitung…' : quote?.displayTotal || 'Rp0'}</b><span>{quote?.items?.map((item) => `${item.label}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`).join(' + ') || 'Produk pilihan'}</span></div><Button onClick={checkout} disabled={busy || quoteBusy || !gateway?.enabled}>{busy ? <LoaderCircle className="spin" size={15}/> : <CreditCard size={15}/>} {gateway?.enabled ? 'Bayar dengan QRIS' : 'Gateway belum aktif'}</Button></section>}
      {activeOrder && <section className={`pricing-compact-status ${activeOrder.status || 'pending'}`}><div><b>{activeOrder.statusLabel || 'Status pembayaran'}</b><p>{statusCopy[activeOrder.status] || 'Status pembayaran sedang diproses.'}</p></div>{['created', 'pending'].includes(activeOrder.status) ? <button type="button" onClick={() => refreshOrder(activeOrder.id, true)} disabled={busy}><RefreshCw size={14}/>Refresh</button> : <CheckCircle2 size={20}/>}</section>}
      {error && <div className="pricing-compact-error"><CircleAlert size={16}/><span>{error}</span></div>}
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
function ProtectedAdmin() { const { loading, user } = useApp(); if (loading) return <LoadingScreen />; if (!user) return <Navigate to="/auth" replace />; if (user.role !== 'admin') return <Navigate to="/app" replace />; return <AdminWorkspace />; }

function Workspace() {
  const { user, wallet, refreshSession, setNotice, prefs, setPrefs, showDialog } = useApp();
  const resolvedTheme = useResolvedTheme(prefs.theme || 'system');
  const location = useLocation(); const navigate = useNavigate(); const uploadRef = useRef(null);
  const [sessions, setSessions] = useState([]); const [active, setActive] = useState(null); const [messages, setMessages] = useState([]); const [attachments, setAttachments] = useState([]); const [documentState, setDocumentState] = useState(null); const [workflow, setWorkflow] = useState(null); const [activeJob, setActiveJob] = useState(null);
  const [input, setInput] = useState(''); const [pendingLandingFiles, setPendingLandingFiles] = useState([]); const [busy, setBusy] = useState(false); const [accountOpen, setAccountOpen] = useState(false); const [draggingSession, setDraggingSession] = useState(null); const [renamingId, setRenamingId] = useState(null); const [leftCollapsed, setLeftCollapsed] = useState(() => window.innerWidth < 860 || localStorage.getItem('laprakin-left-collapsed') === 'true'); const [rightOpen, setRightOpen] = useState(false); const [modal, setModal] = useState(null); const [config, setConfig] = useState(defaultChatConfig); const [contextOpen, setContextOpen] = useState(false); const [attachmentKind, setAttachmentKind] = useState('module'); const [documents, setDocuments] = useState([]); const [billingPlan, setBillingPlan] = useState(null); const [aiMode, setAiMode] = useState('basic'); const [aiModeAccess, setAiModeAccess] = useState({ basic: { available: true }, thinking: { available: false }, xtrathink: { available: false } }); const [recentSearchOpen, setRecentSearchOpen] = useState(false); const [recentSearchQuery, setRecentSearchQuery] = useState('');
  const [productUpdate, setProductUpdate] = useState(null);
  const page = location.pathname.includes('/projects') ? 'projects' : location.pathname.includes('/documents') ? 'documents' : 'chat';
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
  const projectParam = new URLSearchParams(location.search).get('project') || '';
  useEffect(() => { if (location.pathname === '/app/billing') navigate('/pricing', { replace: true }); }, [location.pathname, navigate]);
  const activeProgram = programs.find((item) => item.key === user.studyProgramKey);
  const updateConfig = (patch) => setConfig((value) => ({ ...value, ...patch, configuration: { ...value.configuration, ...(patch.configuration || {}) } }));
  const setRoute = (next) => navigate(next === 'chat' ? '/app' : `/app/${next}`);
  const createDefaultConfig = () => ({ ...defaultChatConfig, configuration: { ...defaultChatConfig.configuration, documentProfile: prefs.profile || 'langkah', tone: prefs.tone || 'semi-formal', perspective: prefs.perspective || 'saya', allowExternalAi: prefs.allowExternalAi !== false } });
  const sessionPayload = (base) => ({ ...base, departmentKey: user.departmentKey || '', studyProgramKey: user.studyProgramKey || '', structureMode: base.structureMode || 'guided', courseGroup: base.courseGroup || base.configuration?.courseName || 'Belum dikelompokkan' });
  const hydrate = (data) => { setActive(data.session); setMessages(data.messages || []); setAttachments(data.attachments || []); setWorkflow(data.workflow || null); const current = data.session.configuration || {}; setConfig({ title: data.session.title || 'Laprak baru', structureMode: data.session.structure_mode || 'guided', configuration: { ...defaultChatConfig.configuration, ...current } }); };
  const loadSessions = async () => { try { const data = await api('/chat/sessions'); setSessions(data.sessions || []); } catch (err) { setNotice(err.message); } };
  const loadDocuments = async () => { try { setDocuments(await api('/documents')); } catch (err) { setNotice(err.message); } };
  const loadBillingPlan = async () => { try { const billing = await api('/billing'); setBillingPlan(billing.currentPlan || null); } catch { /* Keep the workspace available if billing is temporarily unavailable. */ } };
  const loadAiModes = async () => { try { const result = await api('/ai/modes'); const next = result.modes || {}; setAiModeAccess(next); setAiMode((current) => next[current]?.available ? current : 'basic'); } catch { setAiModeAccess({ basic: { available: true }, thinking: { available: false }, xtrathink: { available: false } }); } };
  const groupLabel = (item) => item.course_group || item.courseGroup || item.configuration?.courseName || 'Belum dikelompokkan';
  const groupsFromSessions = (items) => items.reduce((acc, item) => { const key = groupLabel(item); (acc[key] ||= []).push(item); return acc; }, {});
  const orderedSessions = useMemo(() => [...sessions].sort((a, b) =>
    new Date(b.updated_at || b.updatedAt || b.created_at || b.createdAt || 0) - new Date(a.updated_at || a.updatedAt || a.created_at || a.createdAt || 0)
  ), [sessions]);
  const visibleRecentSessions = useMemo(() => {
    const query = recentSearchQuery.trim().toLocaleLowerCase();
    if (!query) return orderedSessions;
    return orderedSessions.filter((item) => `${item.title || 'Chat baru'} ${groupLabel(item)}`.toLocaleLowerCase().includes(query));
  }, [orderedSessions, recentSearchQuery]);
  const sessionFolders = useMemo(() => Array.from(new Set(sessions.map(groupLabel))).filter((folder) => folder && folder !== 'Belum dikelompokkan'), [sessions]);
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
  const archiveSession = async (session) => {
    try {
      await api(`/chat/sessions/${session.id}/archive`, { method: 'POST', body: {} });
      setSessions((items) => items.filter((item) => item.id !== session.id));
      if (active?.id === session.id) { setActive(null); setMessages([]); setAttachments([]); setDocumentState(null); setWorkflow(null); setActiveJob(null); }
      setNotice('Chat diarsipkan.');
    } catch (err) { setNotice(err.message); }
  };
  const deleteSession = async (session) => {
    try {
      await api(`/chat/sessions/${session.id}`, { method: 'DELETE' });
      setSessions((items) => items.filter((item) => item.id !== session.id));
      if (active?.id === session.id) { setActive(null); setMessages([]); setAttachments([]); setDocumentState(null); setWorkflow(null); setActiveJob(null); }
      setNotice('Chat dihapus permanen.');
    } catch (err) { setNotice(err.message); }
  };
  useEffect(() => { loadSessions(); loadDocuments(); loadBillingPlan(); loadAiModes(); }, []);
  useEffect(() => { takeLandingDraft().then(({ prompt, files }) => { if (prompt) setInput(prompt); if (files?.length) setPendingLandingFiles(files); }); }, []);
  useEffect(() => { localStorage.setItem('laprakin-left-collapsed', String(leftCollapsed)); }, [leftCollapsed]);
  useEffect(() => {
    let disposed = false;
    if (!active?.document_id) { setDocumentState(null); setActiveJob(null); return undefined; }
    api(`/documents/${active.document_id}`).then((data) => {
      if (disposed) return;
      setDocumentState(data);
      setActiveJob(data.jobs?.[0] || null);
    }).catch(() => { if (!disposed) { setDocumentState(null); setActiveJob(null); } });
    return () => { disposed = true; };
  }, [active?.document_id]);
  useEffect(() => { if (location.pathname.endsWith('/support')) { setModal('help'); navigate('/app', { replace: true }); } if (location.pathname.endsWith('/feedback')) { setModal('feedback'); navigate('/app', { replace: true }); } if (location.pathname.endsWith('/profile')) { setModal('settings'); navigate('/app', { replace: true }); } }, [location.pathname, navigate]);
  const createSession = async (openConfig = false, overrides = {}) => {
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
      setContextOpen(false);
      return data.session;
    } catch (err) {
      setNotice(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const saveFreshSetup = async (setup) => { setBusy(true); try { await api('/profile', { method: 'PUT', body: { departmentKey: setup.departmentKey, studyProgramKey: setup.studyProgramKey } }); setPrefs((old) => ({ ...old, tone: setup.tone, perspective: setup.perspective })); await refreshSession(); if (active) { const next = { ...config, configuration: { ...config.configuration, tone: setup.tone, perspective: setup.perspective } }; setConfig(next); const data = await api(`/chat/sessions/${active.id}`, { method: 'PUT', body: sessionPayload(next) }); setActive(data.session); } setNotice('Preferensi awal tersimpan. Kamu bisa lanjut bercerita tentang tugasnya.'); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const openSession = async (id) => { try { const data = await api(`/chat/sessions/${id}`); hydrate(data); setRoute('chat'); setRightOpen(false); setContextOpen(false); } catch (err) { setNotice(err.message); } };
  const saveConfig = async () => { if (!active) return; setBusy(true); try { const data = await api(`/chat/sessions/${active.id}`, { method: 'PUT', body: sessionPayload({ ...config, courseGroup: config.configuration.courseName || 'Belum dikelompokkan' }) }); setActive(data.session); setSessions((old) => old.map((item) => item.id === data.session.id ? data.session : item)); setRightOpen(false); setNotice('Konfigurasi chat disimpan.'); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const send = async (event) => { event?.preventDefault(); if (!input.trim() && !pendingLandingFiles.length) return; let current = active; if (!current) current = await createSession(false); if (!current) return; setBusy(true); try { if (pendingLandingFiles.length) { current = await uploadFiles(current, pendingLandingFiles); setPendingLandingFiles([]); } const content = input.trim() || 'Saya sudah menambahkan bahan untuk laprak ini.'; const data = await api(`/chat/sessions/${current.id}/messages`, { method: 'POST', body: { content, aiMode, allowExternalAi: prefs.allowExternalAi !== false } }); hydrate(data); setSessions((old) => old.map((item) => item.id === data.session.id ? data.session : item)); setInput(''); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const uploadFiles = async (current, files, kind = '') => {
    const groups = new Map();
    files.forEach((file) => {
      const resolvedKind = kind || (file.type?.startsWith('image/') ? 'evidence' : /\.(?:pdf|docx|txt|md)$/i.test(file.name) ? 'module' : 'data');
      groups.set(resolvedKind, [...(groups.get(resolvedKind) || []), file]);
    });
    for (const [resolvedKind, groupedFiles] of groups) {
      const form = new FormData(); form.append('kind', resolvedKind); groupedFiles.forEach((file) => form.append('files', file));
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
  const upload = async (event) => { const files = Array.from(event.target.files || []); if (!files.length) return; let current = active; if (!current) current = await createSession(false); if (!current) { event.target.value = ''; return; } setBusy(true); try { await uploadFiles(current, files, attachmentKind); setNotice(`${files.length} bahan masuk ke chat.`); } catch (err) { setNotice(err.message); } finally { setBusy(false); event.target.value = ''; } };
  const pasteImagesIntoChat = (event) => { const images = clipboardImageFiles(event); if (!images.length) return; event.preventDefault(); setPendingLandingFiles((items) => mergeFiles(items, images).slice(0, 12)); setNotice(`${images.length} gambar dari clipboard siap dikirim.`); };
  const addPendingFiles = (files) => { const incoming = Array.from(files || []); if (!incoming.length) return; setPendingLandingFiles((items) => mergeFiles(items, incoming).slice(0, 12)); setNotice(`${incoming.length} bahan siap dikirim bersama pesan berikutnya.`); };
  const removeAttachment = async (id) => { if (!active) return; try { await api(`/chat/sessions/${active.id}/attachments/${id}`, { method: 'DELETE' }); const refreshed = await api(`/chat/sessions/${active.id}`); hydrate(refreshed); if (refreshed.session.document_id) { const nextDocument = await api(`/documents/${refreshed.session.document_id}`); setDocumentState(nextDocument); setActiveJob(nextDocument.jobs?.[0] || null); } } catch (err) { setNotice(err.message); } };
  const createDocument = async () => { if (!active) return; setBusy(true); try { const out = await api(`/chat/sessions/${active.id}/document`, { method: 'POST' }); setDocumentState(out.document); const refreshed = await api(`/chat/sessions/${active.id}`); hydrate(refreshed); await loadDocuments(); setNotice('Dokumen kerja dibuat dari chat ini.'); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const waitForJob = async (jobId) => { const started = Date.now(); while (Date.now() - started < 120000) { const job = await api(`/jobs/${jobId}`); setActiveJob(job); if (['completed', 'failed', 'canceled'].includes(job.status)) return job; await new Promise((resolve) => setTimeout(resolve, 650)); } throw new Error('Proses masih berjalan. Timeline akan tetap tersedia saat chat ini dibuka lagi.'); };
  const documentAction = async (action) => {
    if (!active?.document_id) return;
    if (action === 'export') {
      const confirmed = await showDialog({ kind: 'confirm', title: 'Sudah cek draft?', message: 'Pastikan isi, angka, bukti, nama, NIM, dan kelas sudah benar. DOCX dibuat setelah konfirmasi ini.', confirmLabel: 'Sudah, export' });
      if (!confirmed) return;
    }
    setBusy(true);
    try {
      const path = action === 'analyze' ? `/documents/${active.document_id}/analyze` : action === 'generate' ? `/documents/${active.document_id}/generate` : `/documents/${active.document_id}/export`;
      const out = await api(path, { method: 'POST', body: action === 'export' ? { confirmReviewed: true } : {} });
      setActiveJob({ id: out.jobId, type: action, status: 'queued', progress: 0, message: 'Masuk antrean', timeline: [] });
      const job = await waitForJob(out.jobId);
      if (job.status !== 'completed') throw new Error(job.errorMessage || job.message || 'Proses belum berhasil.');
      const nextDocument = await api(`/documents/${active.document_id}`);
      setDocumentState(nextDocument);
      setActiveJob(nextDocument.jobs?.find((item) => item.id === job.id) || job);
      setNotice(action === 'analyze' ? 'Bahan sudah dianalisis.' : action === 'generate' ? 'Draft berhasil disusun dan lolos pemeriksaan awal.' : 'DOCX siap diunduh.');
    } catch (err) { setNotice(err.message); } finally { setBusy(false); }
  };
  const downloadExport = async () => { const exported = documentState?.exports?.find((item) => item.status === 'ready'); if (!exported) return; try { await download(`/exports/${exported.id}/download`, exported.file_name); } catch (err) { setNotice(err.message); } };
  const logout = async () => { try { await api('/auth/logout', { method: 'POST' }); } catch {} clearCsrfToken(); await refreshSession(); navigate('/'); };
  const projectEntries = useMemo(() => {
    const grouped = groupsFromSessions(sessions.filter((item) => groupLabel(item) !== 'Belum dikelompokkan'));
    return Object.entries(grouped)
      .map(([name, items]) => ({
        name,
        items: [...items].sort((a, b) => new Date(b.updated_at || b.updatedAt || 0) - new Date(a.updated_at || a.updatedAt || 0)),
        count: items.length,
        updatedAt: items.reduce((latest, item) => {
          const value = item.updated_at || item.updatedAt || item.created_at || item.createdAt || null;
          return !latest || (value && new Date(value) > new Date(latest)) ? value : latest;
        }, null),
      }))
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }, [sessions]);
  const openProject = (name) => navigate(`/app/projects?project=${encodeURIComponent(name)}`);
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
  const workspaceAccent = workspaceAccents.find((item) => item.key === prefs.accent) || workspaceAccents[0];
  const recordProductUpdate = async (action) => {
    if (!productUpdate) return;
    try { await api(`/product-updates/${productUpdate.id}/receipt`, { method: 'POST', body: { action } }); }
    catch { /* receipt failure does not interrupt user navigation */ }
  };
  const closeProductUpdate = async (action) => {
    if (action) await recordProductUpdate(action);
    setProductUpdate(null);
  };
  return <div className={`workspace ${leftCollapsed ? 'left-collapsed' : ''} ${rightOpen && page === 'chat' ? 'right-open' : ''} ${resolvedTheme === 'dark' ? 'theme-dark' : ''} ${prefs.compact ? 'compact' : ''}`} data-motion={prefs.reducedMotion ? 'reduce' : 'full'} data-accent={workspaceAccent.key} data-contrast={prefs.contrast || 'default'} data-language={prefs.language || 'id'} style={{ '--workspace-orange': workspaceAccent.color, '--workspace-accent': workspaceAccent.color, '--workspace-accent-contrast': workspaceAccent.contrast }}>
    <aside className="left-sidebar"><div className="sidebar-top"><Link to="/app" className="workspace-brand"><BrandMark /><b>Laprakin</b></Link><IconButton className="sidebar-collapse-button" label={leftCollapsed ? 'Buka sidebar' : 'Minimalkan sidebar'} onClick={() => setLeftCollapsed(!leftCollapsed)}>{leftCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</IconButton></div><Button className="new-chat" onClick={() => createSession(false)} disabled={busy}><Plus size={15} /><span>Chat baru</span></Button><nav className="workspace-nav">{navItems.map(({ key, label, icon: Icon }) => <button key={key} className={page === key ? 'active' : ''} onClick={() => setRoute(key)} title={label}><Icon size={16} /><span>{label}</span></button>)}</nav><div className={`session-heading ${recentSearchOpen ? 'is-searching' : ''}`}>{recentSearchOpen ? <label className="recent-search-field"><Search size={13}/><input autoFocus value={recentSearchQuery} onChange={(event) => setRecentSearchQuery(event.target.value)} placeholder="Cari chat" aria-label="Cari chat terbaru" onKeyDown={(event) => { if (event.key === 'Escape') { setRecentSearchOpen(false); setRecentSearchQuery(''); } }} /><button type="button" aria-label="Tutup pencarian" onClick={() => { setRecentSearchOpen(false); setRecentSearchQuery(''); }}><X size={12}/></button></label> : <><span>Recents</span><button className="recent-search-trigger" type="button" title="Cari chat" aria-label="Cari chat" onClick={() => setRecentSearchOpen(true)}><Search size={13} /></button></>}</div><div className="session-list">{visibleRecentSessions.length ? <><SessionGroup group="Disematkan" items={visibleRecentSessions.filter((item) => item.isPinned)} activeId={active?.id} page={page} onOpen={openSession} renamingId={renamingId} setRenamingId={setRenamingId} onRename={renameSession} draggingSession={draggingSession} setDraggingSession={setDraggingSession} folders={sessionFolders} onPin={setPinned} onMove={moveSessionToGroup} onArchive={archiveSession} onDelete={deleteSession} onDropSession={async (source, target) => { const sourceIndex = sessions.findIndex((row) => row.id === source.id); const targetIndex = sessions.findIndex((row) => row.id === target.id); const reordered = [...sessions]; const [moved] = reordered.splice(sourceIndex, 1); reordered.splice(targetIndex, 0, moved); await persistOrder(reordered); }} onDropGroup={(session) => moveSessionToGroup(session, groupLabel(session))} />{Object.entries(groupsFromSessions(visibleRecentSessions.filter((item) => !item.isPinned))).map(([group, items]) => <SessionGroup key={group} group={group} items={items} activeId={active?.id} page={page} onOpen={openSession} renamingId={renamingId} setRenamingId={setRenamingId} onRename={renameSession} draggingSession={draggingSession} setDraggingSession={setDraggingSession} folders={sessionFolders} onPin={setPinned} onMove={moveSessionToGroup} onArchive={archiveSession} onDelete={deleteSession} onDropSession={async (source, target) => { const sourceIndex = sessions.findIndex((row) => row.id === source.id); const targetIndex = sessions.findIndex((row) => row.id === target.id); const reordered = [...sessions]; const [moved] = reordered.splice(sourceIndex, 1); reordered.splice(targetIndex, 0, moved); await persistOrder(reordered); }} onDropGroup={(session) => moveSessionToGroup(session, group)} />)}</> : null}</div><div className="sidebar-bottom"><button onClick={() => setModal('help')} title="Bantuan"><HelpCircle size={16} /><span>Bantuan</span></button><button onClick={() => setModal('feedback')} title="Feedback"><MessageCircle size={16} /><span>Feedback</span></button><button onClick={() => setModal('settings')} title="Settings"><Settings2 size={16} /><span>Settings</span></button><div className="account-row"><button onClick={() => setAccountOpen(!accountOpen)} title="Menu akun"><span>{userInitials(user)}</span><div><b>{user.fullName || user.email.split('@')[0]}</b><small>{wallet?.balances?.total || 0} laprak tersedia</small></div><ChevronRight size={14} /></button>{accountOpen && <AccountPopover onClose={() => setAccountOpen(false)} onOpen={(target) => { setAccountOpen(false); if (target === 'billing') navigate('/pricing'); else setModal(target); }} onLogout={logout} />}</div></div></aside>
    {!leftCollapsed && <button className="mobile-scrim" aria-label="Tutup navigasi" onClick={() => setLeftCollapsed(true)} />}
    <IconButton className="mobile-nav-toggle" label="Buka navigasi" onClick={() => setLeftCollapsed(false)}><Menu size={17} /></IconButton>
    <main className="workspace-main">
      {page === 'chat' && <>
        <header className="workspace-header"><div className={`header-title ${active ? '' : 'is-empty'}`}><b>{active?.title || 'Chat Laprakin'}</b><small>{active ? `${activeProgram?.label || 'Template prodi'} · ${active.structure_mode === 'custom' ? 'struktur khusus' : 'struktur default'}` : 'Mulai dengan teks, bahan, atau link yang kamu punya.'}</small></div><button className="workspace-plan" onClick={() => navigate('/pricing')} title="Buka billing"><span>{workspacePlanLabel}</span><i>·</i><b>Upgrade</b></button><div className="header-actions"><button className={`header-config-button ${rightOpen ? 'active' : ''}`} onClick={() => setRightOpen(!rightOpen)}><SlidersHorizontal size={15} /><span>Konfigurasi</span></button><IconButton label={prefs.theme === 'system' ? 'Tema mengikuti sistem' : resolvedTheme === 'dark' ? 'Gunakan mode terang' : 'Gunakan dark mode'} className="theme-button" onClick={() => setPrefs((value) => ({ ...value, theme: value.theme === 'system' ? (resolvedTheme === 'dark' ? 'light' : 'dark') : value.theme === 'dark' ? 'light' : 'system' }))}>{prefs.theme === 'system' ? <Monitor size={16} /> : resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</IconButton><IconButton label="Notifikasi" onClick={() => setModal('notifications')}><Bell size={16} /></IconButton></div></header>
        <ChatSurface active={active} messages={messages} attachments={attachments} documentState={documentState} workflow={workflow} activeJob={activeJob} user={user} input={input} setInput={setInput} busy={busy} attachmentKind={attachmentKind} setAttachmentKind={setAttachmentKind} uploadRef={uploadRef} send={send} upload={upload} removeAttachment={removeAttachment} createDocument={createDocument} documentAction={documentAction} downloadExport={downloadExport} contextOpen={contextOpen} setContextOpen={setContextOpen} config={config} updateConfig={updateConfig} needsSetup={!user.departmentKey || !user.studyProgramKey} onCompleteSetup={saveFreshSetup} pendingFiles={pendingLandingFiles} onPasteImages={pasteImagesIntoChat} onAddPendingFiles={addPendingFiles} onRemovePending={(index) => setPendingLandingFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))} aiMode={aiMode} setAiMode={setAiMode} aiModeAccess={aiModeAccess} onUpgrade={() => navigate('/pricing')} />
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
      onNotice={setNotice}
    />}</main>
    {page === 'chat' && <aside className="right-config"><div className="config-inner"><div className="right-head"><div><b>Konfigurasi chat</b><small>Hanya untuk laprak ini.</small></div><IconButton label="Tutup konfigurasi" onClick={() => setRightOpen(false)}><PanelRightClose size={16} /></IconButton></div>{active ? <><div className="right-body"><label>Nama laprak<input value={config.title} onChange={(event) => updateConfig({ title: event.target.value })} /></label><label>Mata kuliah<input value={config.configuration.courseName} onChange={(event) => updateConfig({ configuration: { courseName: event.target.value } })} placeholder="Opsional" /></label><label>Modul atau konteks<input value={config.configuration.moduleTitle} onChange={(event) => updateConfig({ configuration: { moduleTitle: event.target.value } })} placeholder="Opsional" /></label><label>Jenis struktur<CustomSelect value={config.configuration.documentProfile} onChange={(value) => updateConfig({ configuration: { documentProfile: value } })} options={[{ value: 'langkah', label: 'Berbasis langkah' }, { value: 'pengujian', label: 'Berbasis pengujian' }, { value: 'proyek', label: 'Berbasis proyek' }]} /></label><div className="structure-choice"><button className={config.structureMode === 'guided' ? 'active' : ''} onClick={() => updateConfig({ structureMode: 'guided' })}><LayoutTemplate size={15} /><span><b>Struktur prodi</b><small>Dipakai otomatis.</small></span></button><button className={config.structureMode === 'custom' ? 'active' : ''} onClick={() => updateConfig({ structureMode: 'custom' })}><SlidersHorizontal size={15} /><span><b>Struktur khusus</b><small>Hanya bila tugas berbeda.</small></span></button></div>{config.structureMode === 'custom' && <label>Susunan bagian<textarea value={config.configuration.customStructure} onChange={(event) => updateConfig({ configuration: { customStructure: event.target.value } })} placeholder="Pendahuluan, hasil, pembahasan, kesimpulan" /></label>}<label>Instruksi tambahan<textarea value={config.configuration.instructions} onChange={(event) => updateConfig({ configuration: { instructions: event.target.value } })} placeholder="Contoh: fokus ke analisis hasil." /></label></div><div className="right-foot"><Button onClick={saveConfig} disabled={busy}><Save size={14} />Simpan</Button><small>Jurusan, prodi, gaya penulisan, dan billing ada di Settings. Dark mode bisa diubah dari header workspace.</small></div></> : <div className="empty-config"><PanelRightOpen size={20} /><b>Buat chat laprak dulu.</b><p>Panel ini baru dipakai untuk mengubah konteks tugas yang sedang dibuka.</p></div>}</div></aside>}
    {['settings','settings-billing','settings-general','settings-personalization','settings-academic','settings-storage','settings-security'].includes(modal) && <SettingsModal initialTab={modal === 'settings-billing' ? 'billing' : modal === 'settings-general' ? 'general' : modal === 'settings-personalization' ? 'personalization' : modal === 'settings-academic' ? 'academic' : modal === 'settings-storage' ? 'storage' : modal === 'settings-security' ? 'security' : 'general'} onClose={() => setModal(null)} onSaved={refreshSession} onOpenBilling={() => { setModal(null); navigate('/pricing'); }} prefs={prefs} setPrefs={setPrefs} />}{modal === 'help' && <HelpModal onClose={() => setModal(null)} />}{modal === 'feedback' && <FeedbackModal onClose={() => setModal(null)} />}{modal === 'notifications' && <NotificationModal onClose={() => setModal(null)} />}{productUpdate && <ProductUpdatePopup update={productUpdate} onReceipt={recordProductUpdate} onClose={closeProductUpdate} />}
  </div>;
}

function AccountPopover({ onOpen, onLogout, onClose }) {
  const { user } = useApp();
  useEffect(() => { const timer = window.setTimeout(onClose, 5000); return () => window.clearTimeout(timer); }, [onClose]);
  return <div className="account-popover" onMouseDown={(event) => event.stopPropagation()}><div className="account-popover-head"><span className="account-popover-avatar" aria-hidden="true">{userInitials(user)}</span><div><b>{user?.fullName || 'Akun Laprakin'}</b><small>Workspace pribadi</small></div></div><div className="account-popover-divider" /><button onClick={() => onOpen('billing')}><Sparkles size={15} />Upgrade plan<ChevronRight size={14} /></button><button onClick={() => onOpen('settings-personalization')}><Sliders size={15} />Personalisasi</button><button onClick={() => onOpen('settings-academic')}><UserRound size={15} />Jurusan & prodi</button><button onClick={() => onOpen('settings-general')}><Settings2 size={15} />Settings</button><div className="account-popover-divider" /><button onClick={() => onOpen('help')}><HelpCircle size={15} />Help<ChevronRight size={14} /></button><button className="logout-item" onClick={onLogout}><LogOut size={15} />Log out<ChevronRight size={14} /></button></div>;
}

function SessionGroup({ group, items, activeId, page, onOpen, renamingId, setRenamingId, onRename, draggingSession, setDraggingSession, onDropSession, onDropGroup, folders = [], onPin, onMove, onArchive, onDelete }) {
  if (!items.length) return null;
  const isUngrouped = group === 'Belum dikelompokkan';
  return <section className={`session-group ${group === 'Disematkan' ? 'pinned-group' : ''} ${isUngrouped ? 'ungrouped-group' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggingSession) onDropGroup(draggingSession); setDraggingSession(null); }}>{!isUngrouped && <div className="session-group-label">{group === 'Disematkan' ? <Pin size={11} /> : <FolderOpen size={11} />}<span>{group}</span><small>{items.length}</small></div>}{items.map((item) => <ChatSessionRow key={item.id} item={item} active={activeId === item.id && page === 'chat'} onOpen={onOpen} editing={renamingId === item.id} setEditing={setRenamingId} onRename={onRename} draggingSession={draggingSession} onDragStart={setDraggingSession} onDropSession={onDropSession} folders={folders} onPin={onPin} onMove={onMove} onArchive={onArchive} onDelete={onDelete} />)}</section>;
}

function RecentSettingsPopover({ value, onChange, onClose }) {
  useEffect(() => { const timer = window.setTimeout(onClose, 5000); return () => window.clearTimeout(timer); }, [onClose]);
  return <div className="recent-settings-popover" role="dialog" aria-label="Atur daftar chat"><b>Atur daftar chat</b><small>Urutan chat di sidebar</small><button type="button" className={value === 'latest' ? 'active' : ''} onClick={() => onChange('latest')}><Check size={13} />Terbaru diperbarui</button><button type="button" className={value === 'title' ? 'active' : ''} onClick={() => onChange('title')}><Check size={13} />Judul A–Z</button></div>;
}

function ChatSessionRow({ item, active, onOpen, editing, setEditing, onRename, draggingSession, onDragStart, onDropSession, folders, onPin, onMove, onArchive, onDelete }) {
  const { showDialog } = useApp();
  const [title, setTitle] = useState(item.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  useEffect(() => { if (!menuOpen) return undefined; const timer = window.setTimeout(() => { setMenuOpen(false); setMoveOpen(false); }, 5000); return () => window.clearTimeout(timer); }, [menuOpen]);
  useEffect(() => setTitle(item.title), [item.title]);
  useEffect(() => { if (!menuOpen) return undefined; const timer = window.setTimeout(() => { setMenuOpen(false); setMoveOpen(false); }, 5000); return () => window.clearTimeout(timer); }, [menuOpen]);
  const submit = (event) => { event.preventDefault(); onRename(item.id, title); };
  const chooseFolder = async (folder) => { await onMove(item, folder); setMenuOpen(false); setMoveOpen(false); };
  const createFolder = async () => { const folder = await showDialog({ kind: 'prompt', title: 'Folder baru', message: 'Masukkan nama folder untuk mengelompokkan chat.', placeholder: 'Contoh: Modul 5 Firewall', confirmLabel: 'Buat folder' }); if (folder?.trim()) chooseFolder(folder.trim().slice(0, 100)); };
  return <article className={`session-row ${active ? 'active' : ''}`} draggable={!editing} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; onDragStart(item); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); if (draggingSession && draggingSession.id !== item.id) onDropSession?.(draggingSession, item); }}><GripVertical className="drag-handle" size={12} /><div className="session-open" role="button" tabIndex={0} onClick={() => !editing && onOpen(item.id)} onKeyDown={(event) => { if (!editing && (event.key === 'Enter' || event.key === ' ')) onOpen(item.id); }} title={item.title}>{item.document_id ? <Check size={12} /> : <MessageCircle size={13} />}{editing ? <form onSubmit={submit} onClick={(event) => event.stopPropagation()}><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setEditing(null); }} onBlur={() => onRename(item.id, title)} /></form> : <span>{item.title || 'Chat baru'}</span>}</div>{item.isPinned && <Pin className="session-pinned-icon" size={11} />}<div className="session-row-actions"><button className="session-menu-trigger" type="button" title="Menu chat" aria-label="Menu chat" onClick={(event) => { event.stopPropagation(); setMenuOpen((open) => !open); setMoveOpen(false); }}><MoreHorizontal size={15}/></button>{menuOpen && <div className="session-menu" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => { setEditing(item.id); setMenuOpen(false); }}><Pencil size={14}/><span>Ubah nama</span></button><div className="session-menu-folder"><button type="button" onClick={() => setMoveOpen((open) => !open)}><FolderOpen size={14}/><span>Pindahkan ke folder</span><ChevronRight size={13}/></button>{moveOpen && <div className="session-submenu">{folders.filter((folder) => folder !== item.course_group).map((folder) => <button key={folder} type="button" onClick={() => chooseFolder(folder)}>{folder}</button>)}<button type="button" className="new-folder-action" onClick={createFolder}><Plus size={13}/>Folder baru</button></div>}</div><button type="button" onClick={() => { onPin(item, !item.isPinned); setMenuOpen(false); }}>{item.isPinned ? <PinOff size={14}/> : <Pin size={14}/>}<span>{item.isPinned ? 'Lepas pin' : 'Pin chat'}</span></button><button type="button" onClick={() => { onArchive(item); setMenuOpen(false); }}><Archive size={14}/><span>Arsip</span></button><button type="button" className="delete-action" onClick={async () => { setMenuOpen(false); const confirmed = await showDialog({ kind: 'confirm', title: 'Hapus chat?', message: `Chat “${item.title || 'Chat baru'}” akan dihapus permanen dan tidak dapat dipulihkan.`, confirmLabel: 'Hapus', destructive: true }); if (confirmed) await onDelete(item); }}><Trash2 size={14}/><span>Hapus</span></button></div>}</div></article>;
}

function AttachmentThumbnail({ file }) {
  const image = String(file.mime_type || file.detected_mime || '').startsWith('image/');
  return <span className={`attachment-thumb ${image ? 'image' : ''}`}>{image ? <img src={`/api/chat/attachments/${file.id}/preview`} alt="" /> : <FileText size={13} />}</span>;
}
function PendingAttachmentChip({ file, index, onRemove }) {
  const [preview, setPreview] = useState('');
  useEffect(() => { if (file?.type?.startsWith('image/')) { const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); } return undefined; }, [file]);
  return <span className="pending-file-chip">{preview ? <img src={preview} alt="" /> : <FileText size={12} />}<b>{file.name}</b><button type="button" onClick={() => onRemove(index)} aria-label={`Hapus ${file.name}`}><X size={11} /></button></span>;
}
function FreshSetupCard({ onSave, busy }) {
  const [form, setForm] = useState({ departmentKey: '', studyProgramKey: '', tone: 'semi-formal', perspective: 'saya' });
  const submit = async (event) => { event.preventDefault(); if (!form.departmentKey || !form.studyProgramKey) return; await onSave(form); };
  return <form className="fresh-setup-card fresh-setup-compact" onSubmit={submit}>
    <div className="fresh-setup-title"><div><b>Lengkapi profil akademik</b><p>Cukup sekali agar struktur dan cover laprak sesuai prodi.</p></div></div>
    <div className="fresh-grid"><label>Jurusan<CustomSelect value={form.departmentKey} onChange={(value) => setForm({ ...form, departmentKey: value, studyProgramKey: '' })} options={[{ value: '', label: 'Pilih jurusan' }, ...departments.map((item) => ({ value: item.key, label: item.label }))]} /></label><label>Prodi<CustomSelect value={form.studyProgramKey} onChange={(value) => setForm({ ...form, studyProgramKey: value })} options={[{ value: '', label: 'Pilih prodi' }, ...programs.filter((item) => item.department === form.departmentKey).map((item) => ({ value: item.key, label: item.label }))]} /></label></div>
    <Button type="submit" variant="secondary" disabled={busy || !form.departmentKey || !form.studyProgramKey}>Simpan</Button>
  </form>;
}
function ChatSurface({ active, messages, attachments, documentState, workflow, activeJob, user, input, setInput, busy, attachmentKind, setAttachmentKind, uploadRef, send, upload, removeAttachment, createDocument, documentAction, downloadExport, contextOpen, setContextOpen, config, updateConfig, needsSetup, onCompleteSetup, pendingFiles, onPasteImages, onAddPendingFiles, onRemovePending, aiMode, setAiMode, aiModeAccess, onUpgrade }) {
  return <div className={`chat-surface ${active ? 'has-chat' : 'empty-chat'}`}>
    <div className="chat-thread">{!active ? <div className="chat-welcome chat-welcome-minimal"><h1>mau <em>laprakin</em> apa hari ini, {user.fullName || user.email.split('@')[0]}?</h1></div> : <div className="thread-content">
      {needsSetup && <FreshSetupCard onSave={onCompleteSetup} busy={busy} />}
      {messages.map((message) => <article key={message.id} className={`message ${message.role}`}>{message.role === 'assistant' && <BrandMark className="message-brand-mark" alt="" />}<div><p>{message.content}</p>{message.meta?.links?.length ? <div className="link-row">{message.meta.links.map((link) => <a key={link} href={link} target="_blank" rel="noreferrer"><Globe2 size={12} />{new URL(link).hostname}</a>)}</div> : null}</div></article>)}
      {contextOpen && <InlineContext config={config} updateConfig={updateConfig} onClose={() => setContextOpen(false)} onAddPendingFiles={onAddPendingFiles} pendingCount={pendingFiles.length} />}
      {attachments.length > 0 && <div className="staged-files"><div><b>Bahan di chat</b><small>{attachments.length} file tersimpan sebagai acuan atau bukti.</small></div><div>{attachments.map((file) => <span key={file.id}><AttachmentThumbnail file={file} /><b>{file.original_name}</b><small>{formatBytes(file.size_bytes)}</small><button onClick={() => removeAttachment(file.id)} aria-label={`Hapus ${file.original_name}`}><X size={12} /></button></span>)}</div></div>}
      {active.document_id
        ? <DocumentCard documentState={documentState} activeJob={activeJob} busy={busy} onAction={documentAction} onDownload={downloadExport} />
        : <WorkflowPanel workflow={workflow} busy={busy} needsSetup={needsSetup} onCreate={createDocument} />}
      {busy && !['queued', 'running', 'retry_queued'].includes(activeJob?.status) && <article className="message assistant loading"><BrandMark className="message-brand-mark" alt="" /><div><LoaderCircle className="spin" size={14} /> Menyiapkan respons...</div></article>}
    </div>}</div>
    <Composer input={input} setInput={setInput} busy={busy} attachmentKind={attachmentKind} setAttachmentKind={setAttachmentKind} uploadRef={uploadRef} send={send} upload={upload} centered={!active} pendingFiles={pendingFiles} onPasteImages={onPasteImages} onRemovePending={onRemovePending} aiMode={aiMode} setAiMode={setAiMode} aiModeAccess={aiModeAccess} onUpgrade={onUpgrade} />
  </div>;
}

function WorkflowPanel({ workflow, busy, needsSetup, onCreate }) {
  if (!workflow) return null;
  const items = (workflow.items || []).filter((item) => item.key !== 'identity');
  const readyCount = items.filter((item) => item.ready).length;
  const stageLabel = workflow.stage === 'intake' ? 'Pahami tugas' : workflow.stage === 'collecting' ? 'Lengkapi acuan' : workflow.stage === 'evidence' ? 'Tambahkan bukti' : 'Siap dibuat';
  return <section className="workflow-panel" aria-label="Alur pembuatan laprak">
    <header><div><small>Alur laprak</small><b>{stageLabel}</b></div><span>{readyCount}/{items.length}</span></header>
    <ol className="chat-workflow-steps">{items.map((item, index) => <li key={item.key} className={item.ready ? 'ready' : ''}>
      <span>{item.ready ? <Check size={12} /> : index + 1}</span>
      <div><b>{item.label}</b><small>{item.detail}</small></div>
    </li>)}</ol>
    <div className="workflow-next"><div><small>Berikutnya</small><p>{workflow.nextQuestion}</p></div>{workflow.canCreateDocument && <Button variant="secondary" onClick={onCreate} disabled={busy || needsSetup}>Buat dokumen kerja <ArrowRight size={14} /></Button>}</div>
  </section>;
}

function JobTimeline({ job }) {
  if (!job) return null;
  const source = job.timeline?.length ? job.timeline : [{ status: job.status, progress: job.progress, message: job.message }];
  const events = source.filter((event, index) => index === 0 || event.status !== source[index - 1].status || event.progress !== source[index - 1].progress || event.message !== source[index - 1].message).slice(-6);
  const live = ['queued', 'running', 'retry_queued'].includes(job.status);
  const title = job.type === 'generate' ? 'Penyusunan draft' : job.type === 'export' ? 'Pembuatan DOCX' : 'Analisis bahan';
  return <section className={`job-timeline ${live ? 'is-live' : ''}`} aria-live="polite">
    <header><div><small>Progres AI</small><b>{title}</b></div><span>{Math.max(0, Math.min(100, Number(job.progress || 0)))}%</span></header>
    <div className="job-progress-track"><i style={{ width: `${Math.max(0, Math.min(100, Number(job.progress || 0)))}%` }} /></div>
    <ol>{events.map((event, index) => <li key={event.id || `${event.status}-${event.progress}-${index}`} className={index === events.length - 1 ? 'current' : ''}><span>{event.status === 'completed' ? <Check size={11} /> : index + 1}</span><div><b>{event.message || 'Memproses dokumen'}</b><small>{event.status === 'failed' ? 'Gagal' : event.status === 'canceled' ? 'Dibatalkan' : event.status === 'completed' ? 'Selesai' : `${event.progress || 0}%`}</small></div></li>)}</ol>
    {job.errorMessage && <p className="job-error">{job.errorMessage}</p>}
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
  return <div className="ai-mode-menu"><button type="button" className="ai-mode-trigger" onClick={() => setOpen((item) => !item)} aria-haspopup="menu" aria-expanded={open}><Sparkles size={13} /><span>{current.label}</span><ChevronDown size={13} /></button>{open && <div className="ai-mode-popover" role="menu">{modes.map((mode) => { const available = Boolean(access?.[mode.key]?.available); return <button type="button" key={mode.key} className={`${mode.key === value ? 'selected' : ''} ${available ? '' : 'locked'}`} role="menuitem" onClick={() => choose(mode)}><span className="ai-mode-option-copy"><b>{mode.label}</b><small>{mode.description}</small></span>{available ? (mode.key === value ? <Check size={15} /> : <ChevronRight size={15} />) : <span className="ai-mode-lock"><LockKeyhole size={13} />{mode.unlock}</span>}</button>; })}</div>}</div>;
}

function Composer({ input, setInput, busy, attachmentKind, setAttachmentKind, uploadRef, send, upload, centered, pendingFiles = [], onPasteImages, onRemovePending, aiMode, setAiMode, aiModeAccess, onUpgrade }) {
  const shortcutItems = [
    { key: 'laprak', label: 'Laprak', icon: FileText, prompt: 'Bantu saya menyusun laporan praktikum berdasarkan bahan yang akan saya unggah.' },
    { key: 'proposal', label: 'Proposal', icon: LayoutTemplate, prompt: 'Bantu saya menyusun proposal akademik yang terstruktur dan mudah direvisi.' },
    { key: 'makalah', label: 'Makalah', icon: GraduationCap, prompt: 'Bantu saya menyusun makalah dari topik dan referensi yang saya punya.' },
    { key: 'tugas-akhir', label: 'Tugas akhir', icon: ClipboardList, prompt: 'Bantu saya merapikan bagian tugas akhir berdasarkan arahan dan sumber saya.' },
    { key: 'jurnal', label: 'Jurnal', icon: Pencil, prompt: 'Bantu saya menyusun draft artikel jurnal dari data dan referensi yang saya berikan.' },
  ];
  const placeholder = centered ? 'Ceritakan tugas yang ingin kamu susun...' : (pendingFiles.length ? 'Tambahkan pesan untuk bahan ini...' : 'Tulis tugasmu, tempel link, atau paste gambar...');
  return <div className={`composer-zone ${centered ? 'composer-centered composer-claude' : ''}`}>
    {pendingFiles.length ? <div className="pending-files">{pendingFiles.map((file, index) => <PendingAttachmentChip file={file} index={index} key={`${file.name}-${index}`} onRemove={onRemovePending} />)}</div> : null}
    <form className={`composer ${centered ? 'composer-style-reference' : ''}`} onSubmit={send}>
      <textarea rows="1" value={input} onChange={(event) => setInput(event.target.value)} onPaste={onPasteImages} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(event); } }} placeholder={placeholder} />
      <div className="composer-bottom-row">
        <div className="composer-left">
          <CustomSelect className="composer-select" value={attachmentKind} onChange={setAttachmentKind} ariaLabel="Jenis bahan" options={[{ value: 'module', label: 'Modul / artikel' }, { value: 'evidence', label: 'Screenshot / bukti' }, { value: 'template', label: 'Template' }, { value: 'data', label: 'Data' }]} />
          <button type="button" className="attach-button" onClick={() => uploadRef.current?.click()} title="Tambah bahan"><Plus size={18} /></button>
          <input ref={uploadRef} hidden type="file" multiple accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.png,.jpg,.jpeg,.webp" onChange={upload} />
        </div>
        <div className="composer-actions">
          <AiModeMenu value={aiMode} onChange={setAiMode} access={aiModeAccess} onUpgrade={onUpgrade} />
          <button type="button" className="composer-utility-button" aria-label="Voice input"><Mic size={16} /></button>
          <button className="send-button send-button-wave" type="submit" disabled={busy || (!input.trim() && !pendingFiles.length)} aria-label="Kirim"><AudioLines size={17} /></button>
        </div>
      </div>
    </form>
    {centered ? <div className="composer-shortcuts" aria-label="Pilih jenis dokumen">{shortcutItems.map((item) => { const Icon = item.icon; return <button key={item.key} type="button" className="composer-shortcut" onClick={() => setInput(item.prompt)}><Icon size={14} /><span>{item.label}</span></button>; })}</div> : null}
    {!centered ? <small>Enter untuk kirim · Shift + Enter untuk baris baru · file hanya terlihat di akunmu</small> : null}
  </div>;
}

function InlineContext({ config, updateConfig, onClose, onAddPendingFiles, pendingCount = 0 }) {
  const uploadRef = useRef(null);
  return <form className="inline-context" onSubmit={(event) => { event.preventDefault(); onClose(); }}><div className="context-title"><div><b>Ringkas konteks tugas.</b><p>Opsional bila bahan file belum cukup menjelaskan tugas.</p></div><button type="button" onClick={onClose} aria-label="Tutup form konteks"><X size={14} /></button></div><div className="context-fields"><label>Mata kuliah<input value={config.configuration.courseName} onChange={(event) => updateConfig({ configuration: { courseName: event.target.value } })} placeholder="Jaringan Komputer" /></label><label>Modul / topik<input value={config.configuration.moduleTitle} onChange={(event) => updateConfig({ configuration: { moduleTitle: event.target.value } })} placeholder="Routing Protocol" /></label></div><label>Permintaan dosen<textarea value={config.configuration.instructions} onChange={(event) => updateConfig({ configuration: { instructions: event.target.value } })} placeholder="Tahapan, hasil, dan kesimpulan yang diminta..." /></label><div className="context-actions"><button type="button" className="context-attach" onClick={() => uploadRef.current?.click()}><Paperclip size={14} />Modul / paper / screenshot</button><input ref={uploadRef} hidden type="file" multiple accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.png,.jpg,.jpeg,.webp" onChange={(event) => { onAddPendingFiles(Array.from(event.target.files || [])); event.target.value = ''; }} /><small>{pendingCount ? `${pendingCount} bahan siap di composer` : 'Tambahkan file bila perlu.'}</small><Button type="submit" variant="secondary">Simpan</Button></div></form>;
}

function DocumentCard({ documentState, activeJob, busy, onAction, onDownload }) {
  if (!documentState) return <div className="document-card loading-doc"><LoaderCircle className="spin" size={15} />Memuat dokumen kerja...</div>;
  const exported = documentState.exports?.find((item) => item.status === 'ready');
  const isGenerated = documentState.status === 'generated';
  const latestJob = activeJob || documentState.jobs?.[0] || null;
  const latestAnalysis = documentState.jobs?.find((job) => job.type === 'analyze' && job.status === 'completed');
  const hasNewFiles = Boolean(latestAnalysis?.finishedAt && documentState.files?.some((file) => new Date(file.created_at).getTime() > new Date(latestAnalysis.finishedAt).getTime()));
  const canAnalyze = documentState.status === 'draft' || hasNewFiles;
  const attention = documentState.readiness?.attention?.[0];
  const description = hasNewFiles
    ? 'Ada bahan baru. Analisis ulang agar sumber, bukti, dan pemetaannya ikut ke draft berikutnya.'
    : isGenerated
    ? `Draft siap dibaca ulang. Susun ulang dihitung sebagai revisi (${documentState.revision_count || 0} dipakai).`
    : documentState.status === 'analyzed'
      ? (attention?.detail || 'Bahan sudah dianalisis. Pastikan bukti cukup sebelum menyusun draft.')
      : 'Dokumen kerja dibuat. Analisis akan membaca modul, bukti, dan struktur yang tersedia.';
  return <article className="document-card document-workflow-card">
    <div className="document-card-head"><div><small>Dokumen kerja</small><h3>{documentState.title}</h3><p>{description}</p></div>{documentState.readiness && <span className="readiness-score">{documentState.readiness.score}% siap</span>}</div>
    <JobTimeline job={latestJob} />
    <div className="doc-actions"><button className={!canAnalyze && documentState.status !== 'draft' ? 'done' : ''} disabled={busy || !canAnalyze} onClick={() => onAction('analyze')}>{!canAnalyze && documentState.status !== 'draft' && <Check size={13} />}{hasNewFiles ? 'Analisis ulang' : 'Analisis bahan'}</button><button className={isGenerated ? 'revision-action' : ''} disabled={busy || hasNewFiles || !['analyzed', 'generated'].includes(documentState.status)} onClick={() => onAction('generate')}>{isGenerated ? 'Susun ulang' : 'Susun draft'}</button><button disabled={busy || hasNewFiles || !isGenerated} onClick={() => onAction('export')}>Export Word</button></div>
    {exported && <div className="export-row"><CheckCircle2 size={14} /><span>{exported.file_name}</span><button onClick={onDownload}><ArrowDownToLine size={13} />Unduh</button></div>}
  </article>;
}

function DocumentLibrary({ documents, onRefresh, onOpen }) { const [query, setQuery] = useState(''); const visible = documents.filter((doc) => `${doc.title} ${doc.course_name} ${doc.module_title}`.toLowerCase().includes(query.toLowerCase())); return <section className="library-page"><header><div><h1>Dokumen</h1><p>Laprak yang dibuat dari percakapanmu.</p></div><button onClick={onRefresh}>Refresh</button></header><label className="search-field"><FolderOpen size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari judul, mata kuliah, atau modul" /></label><div className="library-list">{visible.length ? visible.map((doc) => <article key={doc.id}><div><span className="doc-file"><FileText size={16} /></span><div><b>{doc.title}</b><small>{doc.course_name || 'Mata kuliah belum diisi'} · {doc.status === 'generated' ? 'Draft siap cek' : doc.status === 'analyzed' ? 'Siap disusun' : 'Menunggu analisis'}</small></div></div><button onClick={() => onOpen(doc)}>Buka chat <ArrowRight size={13} /></button></article>) : <div className="empty-library"><FolderOpen size={22} /><b>Belum ada dokumen.</b><p>Buat chat laprak, lalu pilih “Buat laprak” saat konteksnya sudah cukup.</p></div>}</div></section>; }

function ProjectsPage({ projects, selectedProject, documents, onOpenProject, onBack, onCreate, onNewChat, onOpenSession, onNotice }) {
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
        <div className="project-detail-actions"><Button variant="secondary" onClick={() => onNotice('Project ini masih bersifat pribadi.')}>Bagikan</Button><IconButton label="Menu project" onClick={() => onNotice('Pengaturan project akan segera tersedia.')}><MoreHorizontal size={17} /></IconButton></div>
      </header>
      <form className="project-new-chat" onSubmit={startProjectChat}>
        <Plus size={18} />
        <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder={`Chat baru di ${activeProject.name}`} />
        <button type="submit" aria-label="Buat chat"><Send size={16} /></button>
      </form>
      <nav className="project-tabs" aria-label="Navigasi project"><button className={tab === 'chats' ? 'active' : ''} type="button" onClick={() => setTab('chats')}>Chats</button><button className={tab === 'sources' ? 'active' : ''} type="button" onClick={() => setTab('sources')}>Sumber</button></nav>
      {tab === 'chats' ? <div className="project-chat-list">{activeProject.items.length ? activeProject.items.map((session) => <button key={session.id} type="button" onClick={() => onOpenSession(session.id)}><span className="project-chat-avatar">{session.title?.slice(0, 1).toUpperCase() || 'L'}</span><div><b>{session.title || 'Chat baru'}</b><small>{session.document_id ? 'Dokumen kerja tersambung' : 'Percakapan project'} · {formatDate(session.updated_at || session.updatedAt || session.created_at || session.createdAt)}</small></div><ArrowRight size={15} /></button>) : <div className="project-empty"><MessageCircle size={22}/><b>Belum ada chat di project ini.</b><p>Buat chat pertama untuk mulai mengumpulkan bahan dan menyusun laprak.</p></div>}</div> : <div className="project-source-list">{sources.length ? sources.map((doc) => <article key={doc.id}><span><FileText size={16}/></span><div><b>{doc.title}</b><small>{doc.course_name || activeProject.name} · {doc.status || 'draft'}</small></div></article>) : <div className="project-empty"><FileText size={22}/><b>Belum ada sumber dalam project ini.</b><p>Dokumen kerja dari chat project akan muncul di sini.</p></div>}</div>}
    </section>;
  }

  return <section className="projects-page projects-index-page">
    <header className="projects-header"><div><h1>Projects</h1><p>Kelompokkan chat dan dokumen praktikum dalam satu ruang kerja.</p></div><div className="projects-head-actions"><label className="project-search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari project" /></label><Button onClick={onCreate}><Plus size={15}/>Project baru</Button></div></header>
    <nav className="projects-filter" aria-label="Filter project"><button className="active" type="button">Semua</button><button type="button" onClick={() => onNotice('Semua project di halaman ini dibuat oleh akunmu.')}>Dibuat oleh kamu</button><button type="button" onClick={() => onNotice('Belum ada project yang dibagikan kepadamu.')}>Dibagikan dengan kamu</button></nav>
    <div className="projects-table-head"><span>Nama</span><span>Diubah</span><span aria-hidden="true" /></div>
    <div className="projects-table">{visibleProjects.length ? visibleProjects.map((project) => <button key={project.name} type="button" className="project-row" onClick={() => onOpenProject(project.name)}><span className="project-row-icon"><FolderKanban size={18}/></span><span className="project-row-copy"><b>{project.name}</b><small>{project.count} chat</small></span><span className="project-row-date">{formatDate(project.updatedAt)}</span><MoreHorizontal size={17}/></button>) : <div className="projects-empty"><FolderKanban size={26}/><b>Belum ada project.</b><p>Buat project pertamamu untuk mengelompokkan chat dan dokumen.</p><Button onClick={onCreate}><Plus size={14}/>Project baru</Button></div>}</div>
  </section>;
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

function loadMidtransSnap({ scriptUrl, clientKey }) {
  if (window.snap) return Promise.resolve(window.snap);
  if (!scriptUrl || !clientKey) return Promise.resolve(null);
  const existing = document.querySelector('script[data-laprakin-midtrans="true"]');
  if (existing) return new Promise((resolve, reject) => {
    existing.addEventListener('load', () => resolve(window.snap || null), { once: true });
    existing.addEventListener('error', () => reject(new Error('Checkout payment belum dapat dimuat.')), { once: true });
  });
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.dataset.clientKey = clientKey;
    script.dataset.laprakinMidtrans = 'true';
    script.onload = () => resolve(window.snap || null);
    script.onerror = () => reject(new Error('Checkout payment belum dapat dimuat.'));
    document.body.appendChild(script);
  });
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
    free: { key: 'free', label: 'Gratis', price: 0, description: 'Mulai dan pahami alur kerja Laprakin.', features: [`${pricing.free?.credits || 2} credit awal setelah verifikasi`, `${pricing.free?.revisionsPerReport || 3} revisi per laporan`, `${pricing.free?.storageMb || 100} MB penyimpanan`] },
    monthly: { key: 'monthly', label: 'Pro', price: pricing.monthly?.price || 29900, description: 'Untuk kebutuhan praktikum yang rutin.', features: [`${pricing.monthly?.credits || 12} credit / 30 hari`, `${pricing.monthly?.revisionsPerReport || 5} revisi per laporan`, `${pricing.monthly?.storageGb || 1} GB penyimpanan`] },
    pro: { key: 'pro', label: 'Max', price: pricing.pro?.price || 45900, description: 'Untuk semester padat dan revisi intensif.', features: [`${pricing.pro?.credits || 20} credit / 30 hari`, `${pricing.pro?.revisionsPerReport || 15} revisi per laporan`, `${pricing.pro?.storageGb || 5} GB penyimpanan`, 'Prioritas support operasional'] },
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
    try {
      const payload = await api('/payments/checkout', { method: 'POST', body: { items: cartItems } });
      if (payload.mode === 'manual') {
        await updateOrder(payload.order, 'Checkout QRIS lokal diproses untuk pengujian.');
        return;
      }
      await updateOrder(payload.order);
      window.sessionStorage.setItem('laprakin:active-payment-order', payload.orderId);
      const snap = await loadMidtransSnap(payload);
      const refreshAfterCallback = () => getOrder(payload.orderId, true);
      if (snap && payload.snapToken) {
        snap.pay(payload.snapToken, {
          onSuccess: refreshAfterCallback,
          onPending: refreshAfterCallback,
          onError: () => setError('Pembayaran QRIS belum berhasil. Periksa status order atau coba lagi.'),
          onClose: () => setNotice('Checkout ditutup. Order tetap menunggu selama QRIS belum kedaluwarsa.'),
        });
      } else if (payload.checkoutUrl) {
        window.location.assign(payload.checkoutUrl);
      } else {
        throw new Error('Checkout QRIS belum tersedia. Coba lagi beberapa saat.');
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
      {error && <div className="billing-inline-error"><CircleAlert size={16}/><span>{error}</span></div>}
    </main>
  </div>;
}

function LegacySettingsModal({ onClose, onSaved, onOpenBilling, prefs, setPrefs, initialTab = 'general' }) {
  const { user, setNotice, refreshSession, showDialog } = useApp();
  const [tab, setTab] = useState(initialTab);
  const [form, setForm] = useState({ departmentKey: user.departmentKey || '', studyProgramKey: user.studyProgramKey || '' });
  const [storage, setStorage] = useState(null);
  const [security, setSecurity] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [settingsQuery, setSettingsQuery] = useState('');
  useEffect(() => { api('/storage/summary').then(setStorage).catch(() => {}); }, []);
  useEffect(() => setTab(initialTab), [initialTab]);
  const updatePrefs = (patch) => setPrefs((value) => ({ ...value, ...patch }));
  const saveAcademic = async () => { setBusy(true); try { await api('/profile', { method: 'PUT', body: { departmentKey: form.departmentKey, studyProgramKey: form.studyProgramKey } }); await onSaved(); setNotice('Jurusan dan prodi aktif disimpan.'); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const changePassword = async (event) => { event.preventDefault(); setBusy(true); try { const data = await api('/auth/password', { method: 'PUT', body: security }); setCsrfToken(data.csrfToken); setSecurity({ currentPassword: '', newPassword: '' }); setNotice('Kata sandi diperbarui. Sesi perangkat lain berakhir.'); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const logoutAll = async () => { const confirmed = await showDialog({ kind: 'confirm', title: 'Keluar dari semua perangkat?', message: 'Sesi di perangkat lain akan diakhiri. Perangkat ini tetap dapat melanjutkan setelah refresh.', confirmLabel: 'Akhiri sesi' }); if (!confirmed) return; setBusy(true); try { await api('/auth/logout-all', { method: 'POST' }); clearCsrfToken(); await refreshSession(); setNotice('Semua sesi sudah diakhiri.'); onClose(); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const exportData = async () => { try { await download('/privacy/data-export', 'laprakin-data.json'); setNotice('Ringkasan data berhasil diunduh.'); } catch (err) { setNotice(err.message); } };
  const deleteAccount = async () => { if (deleteConfirm !== user.email) return setNotice('Masukkan email akun dengan tepat untuk melanjutkan.'); setBusy(true); try { await api('/me', { method: 'DELETE', body: { confirmation: deleteConfirm } }); clearCsrfToken(); await refreshSession(); onClose(); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const tabs = [
    { key: 'general', label: 'General', icon: Settings2 },
    { key: 'notifications', label: 'Notifications', icon: BellRing },
    { key: 'personalization', label: 'Personalization', icon: Sliders },
    { key: 'billing', label: 'Billing', icon: CreditCard },
    { key: 'data', label: 'Data controls', icon: Database },
    { key: 'storage', label: 'Storage', icon: FolderOpen },
    { key: 'safety', label: 'Safety', icon: Shield },
    { key: 'security', label: 'Security and login', icon: LockKeyhole },
    { key: 'academic', label: 'Jurusan & prodi', icon: UserRound },
    { key: 'keyboard', label: 'Keyboard', icon: Keyboard },
  ];
  const visibleTabs = tabs.filter((item) => item.label.toLocaleLowerCase().includes(settingsQuery.trim().toLocaleLowerCase()));
  const Row = ({ title, description, children }) => <div className="settings-row"><div><b>{title}</b>{description && <small>{description}</small>}</div>{children}</div>;
  return <Modal title="Settings" onClose={onClose} className="settings-modal settings-reference"><div className="settings-layout"><nav className="settings-side"><IconButton label="Tutup settings" className="settings-close" onClick={onClose}><X size={18} /></IconButton><label className="settings-sidebar-search"><Search size={14}/><input value={settingsQuery} onChange={(event) => setSettingsQuery(event.target.value)} placeholder="Cari settings" aria-label="Cari settings" />{settingsQuery && <button type="button" onClick={() => setSettingsQuery('')} aria-label="Hapus pencarian"><X size={12}/></button>}</label>{visibleTabs.map(({ key, label, icon: Icon }) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><Icon size={16} /><span>{label}</span></button>)}</nav><div className="settings-content">{tab === 'general' && <div className="settings-pane"><h3>General</h3><Row title="Appearance"><CustomSelect value={prefs.theme || 'system'} onChange={(value) => updatePrefs({ theme: value })} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} /></Row><Row title="Contrast"><CustomSelect value={prefs.contrast || 'default'} onChange={(value) => updatePrefs({ contrast: value })} options={[{ value: 'default', label: 'Default' }, { value: 'high', label: 'High' }]} /></Row><Row title="Accent color"><span className="accent-choice"><i />Laprakin</span></Row><Row title="Language"><CustomSelect value={prefs.language || 'id'} onChange={(value) => updatePrefs({ language: value })} options={[{ value: 'id', label: 'Bahasa Indonesia' }, { value: 'en', label: 'English' }]} /></Row><Toggle checked={prefs.compact} onChange={(checked) => updatePrefs({ compact: checked })} title="Compact workspace" description="Rapatkan jarak dan komponen di workspace." /></div>}{tab === 'notifications' && <div className="settings-pane"><h3>Notifications</h3><Toggle checked={prefs.jobNotifications !== false} onChange={(checked) => updatePrefs({ jobNotifications: checked })} title="Proses dokumen" description="Beritahu saat analisis, draft, atau export selesai." /><Toggle checked={prefs.deadlineNotifications !== false} onChange={(checked) => updatePrefs({ deadlineNotifications: checked })} title="Deadline laprak" description="Pengingat ringan untuk laporan dengan deadline." /><Toggle checked={Boolean(prefs.productUpdates)} onChange={(checked) => updatePrefs({ productUpdates: checked })} title="Update produk" description="Kabar fitur baru dan perubahan penting beta." /></div>}{tab === 'personalization' && <div className="settings-pane"><h3>Personalization</h3><p className="muted-note">Preferensi ini dipakai untuk chat laprak baru. Struktur di tiap room tetap dapat diubah.</p><Row title="Gaya bahasa"><CustomSelect value={prefs.tone} onChange={(value) => updatePrefs({ tone: value })} options={[{ value: 'semi-formal', label: 'Semi-formal' }, { value: 'formal', label: 'Formal' }]} /></Row><Row title="Sudut pandang"><CustomSelect value={prefs.perspective} onChange={(value) => updatePrefs({ perspective: value })} options={[{ value: 'saya', label: 'Saya' }, { value: 'kita', label: 'Kita' }, { value: 'impersonal', label: 'Impersonal' }]} /></Row><Row title="Struktur awal"><CustomSelect value={prefs.profile} onChange={(value) => updatePrefs({ profile: value })} options={[{ value: 'langkah', label: 'Berbasis langkah' }, { value: 'pengujian', label: 'Berbasis pengujian' }, { value: 'proyek', label: 'Berbasis proyek' }]} /></Row><label className="settings-textarea">Instruksi tambahan<textarea value={prefs.customInstructions || ''} onChange={(event) => updatePrefs({ customInstructions: event.target.value })} placeholder="Contoh: gunakan bahasa teknis yang ringkas." /></label></div>}{tab === 'billing' && <BillingSettingsPane onOpenBilling={onOpenBilling} />}{tab === 'data' && <div className="settings-pane"><h3>Data controls</h3><Toggle checked={Boolean(prefs.allowExternalAi)} onChange={(checked) => updatePrefs({ allowExternalAi: checked })} title="Izinkan AI eksternal" description="Hanya dipakai saat provider AI aktif dan untuk menyusun draft yang kamu minta." /><Row title="Unduh data"><Button variant="secondary" onClick={exportData}>Unduh data saya</Button></Row><p className="muted-note">File tetap privat secara default. Admin operasional tidak dapat membaca isi chat atau dokumenmu dari dashboard.</p></div>}{tab === 'storage' && <div className="settings-pane"><h3>Storage</h3>{storage ? <><div className="storage-meter"><div><span>{formatBytes(storage.usedBytes)} dipakai dari {formatBytes(storage.limitBytes)}</span><b>{Math.round((storage.usedBytes / storage.limitBytes) * 100)}%</b></div><i><em style={{ width: `${Math.min(100, (storage.usedBytes / storage.limitBytes) * 100)}%` }} /></i></div><div className="storage-cards"><span><b>{storage.tier === 'pro' ? 'Pro' : storage.tier === 'subscription' ? 'Subscription' : storage.tier === 'paid' ? 'Satuan' : 'Gratis'}</b><small>{storage.retentionHint}</small></span><span><b>Yang dihitung</b><small>Modul, bukti, template, data, dan export DOCX.</small></span></div></> : <p className="muted-note">Memuat ringkasan storage...</p>}<p className="muted-note">Chat teks dan preferensi tidak dihitung sebagai storage.</p></div>}{tab === 'safety' && <div className="settings-pane"><h3>Safety</h3><div className="safety-card"><ShieldCheck size={17} /><div><b>Gunakan bukti praktik yang sah.</b><p>Laprakin membantu merapikan bahanmu, bukan membuat hasil, screenshot, atau data palsu.</p></div></div><p className="muted-note">Sinyal operasional yang tidak biasa ditinjau sebagai metadata minimum. Tidak ada pemblokiran otomatis hanya dari satu sinyal.</p></div>}{tab === 'security' && <div className="settings-pane"><h3>Security and login</h3><form onSubmit={changePassword} className="security-form"><label>Kata sandi saat ini<input required type="password" value={security.currentPassword} onChange={(event) => setSecurity({ ...security, currentPassword: event.target.value })} /></label><label>Kata sandi baru<input required minLength="8" type="password" value={security.newPassword} onChange={(event) => setSecurity({ ...security, newPassword: event.target.value })} /></label><Button type="submit" disabled={busy}><LockKeyhole size={14} />Ubah kata sandi</Button></form><div className="settings-divider" /><Row title="Keluar dari semua perangkat" description="Gunakan setelah login dari perangkat umum."><Button variant="secondary" onClick={logoutAll} disabled={busy}>Akhiri semua sesi</Button></Row></div>}{tab === 'academic' && <div className="settings-pane"><h3>Jurusan & prodi</h3><p className="muted-note">Digunakan sebagai titik awal struktur. Tidak mengunci bentuk tugas yang berbeda.</p><label>Jurusan<CustomSelect value={form.departmentKey} onChange={(value) => setForm({ departmentKey: value, studyProgramKey: '' })} options={[{ value: '', label: 'Pilih jurusan' }, ...departments.map((item) => ({ value: item.key, label: item.label }))]} /></label><label>Prodi aktif<CustomSelect value={form.studyProgramKey} onChange={(value) => setForm({ ...form, studyProgramKey: value })} options={[{ value: '', label: 'Pilih prodi' }, ...programs.filter((item) => item.department === form.departmentKey).map((item) => ({ value: item.key, label: item.label }))]} /></label><Button onClick={saveAcademic} disabled={busy}><Save size={14} />Simpan</Button><div className="settings-divider" /><h4>Hapus akun</h4><p className="muted-note">Masukkan email akun untuk konfirmasi. Unduh data yang diperlukan terlebih dahulu.</p><input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} placeholder={user.email} /><Button variant="danger" onClick={deleteAccount} disabled={busy || deleteConfirm !== user.email}>Hapus akun</Button></div>}{tab === 'keyboard' && <div className="settings-pane"><h3>Keyboard</h3><Toggle checked={prefs.enterToSend !== false} onChange={(checked) => updatePrefs({ enterToSend: checked })} title="Enter untuk kirim" description="Gunakan Shift + Enter untuk membuat baris baru." /><Toggle checked={prefs.reducedMotion} onChange={(checked) => updatePrefs({ reducedMotion: checked })} title="Kurangi animasi" description="Transisi tetap halus, tetapi lebih singkat." /></div>}</div></div></Modal>;
}

function AccentPicker({ value, onChange }) {
  return <div className="accent-picker" role="radiogroup" aria-label="Warna aksen workspace">
    {workspaceAccents.map((accent) => <button key={accent.key} type="button" role="radio" aria-label={accent.label} title={accent.label} aria-checked={value === accent.key} className={value === accent.key ? 'selected' : ''} onClick={() => onChange(accent.key)} style={{ '--accent-swatch': accent.color }}>
      <span className="accent-swatch">{value === accent.key && <Check size={13} />}</span>
    </button>)}
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

function SettingsModal({ onClose, onSaved, onOpenBilling, prefs, setPrefs, initialTab = 'general' }) {
  const { user, setNotice, refreshSession, showDialog } = useApp();
  const [tab, setTab] = useState(initialTab);
  const [form, setForm] = useState({ departmentKey: user.departmentKey || '', studyProgramKey: user.studyProgramKey || '' });
  const [storage, setStorage] = useState(null);
  const [security, setSecurity] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [settingsQuery, setSettingsQuery] = useState('');
  useEffect(() => { api('/storage/summary').then(setStorage).catch(() => {}); }, []);
  useEffect(() => setTab(initialTab), [initialTab]);
  const updatePrefs = (patch) => setPrefs((value) => ({ ...value, ...patch }));
  const saveAcademic = async () => { setBusy(true); try { await api('/profile', { method: 'PUT', body: { departmentKey: form.departmentKey, studyProgramKey: form.studyProgramKey } }); await onSaved(); setNotice('Jurusan dan prodi aktif disimpan.'); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const changePassword = async (event) => { event.preventDefault(); setBusy(true); try { const data = await api('/auth/password', { method: 'PUT', body: security }); setCsrfToken(data.csrfToken); setSecurity({ currentPassword: '', newPassword: '' }); setNotice('Kata sandi diperbarui. Sesi perangkat lain berakhir.'); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const logoutAll = async () => { const confirmed = await showDialog({ kind: 'confirm', title: 'Keluar dari semua perangkat?', message: 'Sesi di perangkat lain akan diakhiri. Perangkat ini tetap dapat melanjutkan setelah refresh.', confirmLabel: 'Akhiri sesi' }); if (!confirmed) return; setBusy(true); try { await api('/auth/logout-all', { method: 'POST' }); clearCsrfToken(); await refreshSession(); setNotice('Semua sesi sudah diakhiri.'); onClose(); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const exportData = async () => { try { await download('/privacy/data-export', 'laprakin-data.json'); setNotice('Ringkasan data berhasil diunduh.'); } catch (err) { setNotice(err.message); } };
  const deleteAccount = async () => { if (deleteConfirm !== user.email) return setNotice('Masukkan email akun dengan tepat untuk melanjutkan.'); setBusy(true); try { await api('/me', { method: 'DELETE', body: { confirmation: deleteConfirm } }); clearCsrfToken(); await refreshSession(); onClose(); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const tabs = [
    { key: 'general', label: 'Umum', icon: Settings2, title: 'Tampilan workspace', description: 'Atur tema, kepadatan, bahasa, dan warna aksen.' },
    { key: 'notifications', label: 'Notifikasi', icon: BellRing, title: 'Notifikasi yang berguna', description: 'Pilih kabar yang benar-benar perlu muncul.' },
    { key: 'personalization', label: 'Personalisasi', icon: Sliders, title: 'Cara Laprakin menulis', description: 'Jadikan preferensi ini sebagai titik awal untuk chat baru.' },
    { key: 'billing', label: 'Billing', icon: CreditCard, title: 'Plan dan transaksi', description: 'Lihat status plan, credit, dan histori pembayaran.' },
    { key: 'data', label: 'Kontrol data', icon: Database, title: 'Data tetap dalam kendalimu', description: 'Atur pemrosesan eksternal dan unduh ringkasan data.' },
    { key: 'storage', label: 'Penyimpanan', icon: FolderOpen, title: 'Penggunaan penyimpanan', description: 'Pantau file yang tersimpan pada workspace.' },
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
          <section className="settings-group"><div className="settings-group-heading"><b>Appearance</b><small>Perubahan diterapkan langsung.</small></div><Row title="Tema"><ThemePicker value={prefs.theme || 'system'} onChange={(value) => updatePrefs({ theme: value })} /></Row><Row title="Kontras"><CustomSelect value={prefs.contrast || 'default'} onChange={(value) => updatePrefs({ contrast: value })} options={[{ value: 'default', label: 'Default' }, { value: 'high', label: 'Tinggi' }]} /></Row><Row title="Bahasa"><CustomSelect value={prefs.language || 'id'} onChange={(value) => updatePrefs({ language: value })} options={[{ value: 'id', label: 'Bahasa Indonesia' }, { value: 'en', label: 'English' }]} /></Row></section>
          <section className="settings-group accent-settings-group"><div className="settings-group-heading"><b>Warna aksen</b><small>Dipakai untuk tombol utama dan status aktif—bukan seluruh hover.</small></div><AccentPicker value={prefs.accent || 'lime'} onChange={(accent) => updatePrefs({ accent })} /></section>
          <Toggle checked={prefs.compact} onChange={(checked) => updatePrefs({ compact: checked })} title="Workspace ringkas" description="Rapatkan sidebar, toolbar, dan area percakapan." />
        </div>}
        {tab === 'notifications' && <div className="settings-pane"><section className="settings-group"><Toggle checked={prefs.jobNotifications !== false} onChange={(checked) => updatePrefs({ jobNotifications: checked })} title="Proses dokumen" description="Beritahu saat analisis, draft, atau export selesai." /><Toggle checked={prefs.deadlineNotifications !== false} onChange={(checked) => updatePrefs({ deadlineNotifications: checked })} title="Deadline tugas" description="Pengingat ringan untuk dokumen yang memiliki tenggat." /><Toggle checked={prefs.productUpdates !== false} onChange={(checked) => updatePrefs({ productUpdates: checked })} title="Update produk" description="Hanya perubahan fitur beta yang penting." /></section></div>}
        {tab === 'personalization' && <div className="settings-pane"><section className="settings-group"><Row title="Gaya bahasa"><CustomSelect value={prefs.tone} onChange={(value) => updatePrefs({ tone: value })} options={[{ value: 'semi-formal', label: 'Semi-formal' }, { value: 'formal', label: 'Formal' }]} /></Row><Row title="Sudut pandang"><CustomSelect value={prefs.perspective} onChange={(value) => updatePrefs({ perspective: value })} options={[{ value: 'saya', label: 'Saya' }, { value: 'kita', label: 'Kita' }, { value: 'impersonal', label: 'Impersonal' }]} /></Row><Row title="Struktur awal"><CustomSelect value={prefs.profile} onChange={(value) => updatePrefs({ profile: value })} options={[{ value: 'langkah', label: 'Berbasis langkah' }, { value: 'pengujian', label: 'Berbasis pengujian' }, { value: 'proyek', label: 'Berbasis proyek' }]} /></Row></section><label className="settings-textarea"><span>Instruksi tambahan</span><small>Dipakai sebagai preferensi, bukan isi otomatis.</small><textarea value={prefs.customInstructions || ''} onChange={(event) => updatePrefs({ customInstructions: event.target.value })} placeholder="Contoh: gunakan bahasa teknis yang ringkas." /></label></div>}
        {tab === 'billing' && <BillingSettingsPane onOpenBilling={onOpenBilling} />}
        {tab === 'data' && <div className="settings-pane"><div className="settings-trust-card"><ShieldCheck size={19}/><div><b>Privat secara default</b><p>Isi chat dan file tidak tampil di dashboard operasional. Akses hanya dilakukan untuk proses yang kamu minta.</p></div></div><section className="settings-group"><Toggle checked={Boolean(prefs.allowExternalAi)} onChange={(checked) => updatePrefs({ allowExternalAi: checked })} title="Izinkan provider AI eksternal" description="Aktif hanya saat provider tersedia dan dibutuhkan untuk permintaanmu." /><Row title="Salinan data" description="Unduh profil, preferensi, dan ringkasan aktivitas akun."><Button variant="secondary" onClick={exportData}><ArrowDownToLine size={14}/>Unduh data</Button></Row></section></div>}
        {tab === 'storage' && <div className="settings-pane">{storage ? <><div className="storage-overview"><div><span>Terpakai</span><b>{formatBytes(storage.usedBytes)}</b><small>dari {formatBytes(storage.limitBytes)}</small></div><strong>{storagePercentage}%</strong></div><div className="storage-meter"><i><em style={{ width: `${storagePercentage}%` }} /></i></div><div className="storage-cards"><span><FolderOpen size={17}/><b>{storage.tier === 'pro' ? 'Pro' : storage.tier === 'subscription' ? 'Subscription' : storage.tier === 'paid' ? 'Satuan' : 'Gratis'}</b><small>{storage.retentionHint}</small></span><span><FileText size={17}/><b>Yang dihitung</b><small>Modul, bukti, template, data, dan export DOCX.</small></span></div></> : <div className="settings-loading-state"><LoaderCircle className="spin" size={16}/>Memuat ringkasan penyimpanan...</div>}<p className="settings-footnote">Chat teks dan preferensi tidak dihitung sebagai penyimpanan file.</p></div>}
        {tab === 'safety' && <div className="settings-pane"><div className="safety-principles"><article><ShieldCheck size={18}/><div><b>Bukti tetap asli</b><p>Laprakin tidak membuat screenshot, data, atau hasil praktikum palsu.</p></div></article><article><FileText size={18}/><div><b>Draft tetap perlu ditinjau</b><p>Kamu memegang keputusan akhir sebelum dokumen diekspor atau dikumpulkan.</p></div></article><article><Eye size={18}/><div><b>Review secara kontekstual</b><p>Sinyal tidak biasa ditinjau sebagai metadata minimum, bukan isi pribadi.</p></div></article></div><div className="settings-info-banner"><CircleAlert size={16}/><p>Satu sinyal tidak menyebabkan pemblokiran otomatis. Jika ada batasan, Laprakin menjelaskan tindakan yang perlu dilakukan.</p></div></div>}
        {tab === 'security' && <div className="settings-pane"><form onSubmit={changePassword} className="security-form settings-group"><div className="settings-group-heading"><b>Ubah kata sandi</b><small>Minimal 8 karakter dan berbeda dari sebelumnya.</small></div><label><span>Kata sandi saat ini</span><input required type="password" value={security.currentPassword} onChange={(event) => setSecurity({ ...security, currentPassword: event.target.value })} /></label><label><span>Kata sandi baru</span><input required minLength="8" type="password" value={security.newPassword} onChange={(event) => setSecurity({ ...security, newPassword: event.target.value })} /></label><Button type="submit" disabled={busy}><LockKeyhole size={14}/>Ubah kata sandi</Button></form><section className="settings-group"><Row title="Keluar dari semua perangkat" description="Gunakan setelah login dari perangkat umum."><Button variant="secondary" onClick={logoutAll} disabled={busy}>Akhiri semua sesi</Button></Row></section></div>}
        {tab === 'academic' && <div className="settings-pane"><section className="settings-group academic-settings-form"><label><span>Jurusan</span><CustomSelect value={form.departmentKey} onChange={(value) => setForm({ departmentKey: value, studyProgramKey: '' })} options={[{ value: '', label: 'Pilih jurusan' }, ...departments.map((item) => ({ value: item.key, label: item.label }))]} /></label><label><span>Program studi aktif</span><CustomSelect value={form.studyProgramKey} onChange={(value) => setForm({ ...form, studyProgramKey: value })} options={[{ value: '', label: 'Pilih program studi' }, ...programs.filter((item) => item.department === form.departmentKey).map((item) => ({ value: item.key, label: item.label }))]} /></label><Button onClick={saveAcademic} disabled={busy}><Save size={14}/>Simpan profil akademik</Button></section><section className="settings-danger-zone"><div><b>Hapus akun</b><p>Unduh data yang diperlukan terlebih dahulu. Tindakan ini tidak dapat dibatalkan.</p></div><input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} placeholder={user.email} /><Button variant="danger" onClick={deleteAccount} disabled={busy || deleteConfirm !== user.email}>Hapus akun</Button></section></div>}
        {tab === 'keyboard' && <div className="settings-pane"><section className="settings-group"><Toggle checked={prefs.enterToSend !== false} onChange={(checked) => updatePrefs({ enterToSend: checked })} title="Enter untuk kirim" description="Gunakan Shift + Enter untuk membuat baris baru." /><Toggle checked={prefs.reducedMotion} onChange={(checked) => updatePrefs({ reducedMotion: checked })} title="Kurangi animasi" description="Pertahankan feedback penting dengan gerakan yang lebih singkat." /></section></div>}
      </div>
    </div>
  </Modal>;
}

function LegacyHelpModal({ onClose }) { const { setNotice } = useApp(); const [messages, setMessages] = useState([]); const [input, setInput] = useState(''); const [pendingLandingFiles, setPendingLandingFiles] = useState([]); const [busy, setBusy] = useState(false); const [accountOpen, setAccountOpen] = useState(false); const [draggingSession, setDraggingSession] = useState(null); const [renamingId, setRenamingId] = useState(null); useEffect(() => { api('/support/thread').then((data) => setMessages(data.messages || [])).catch((err) => setNotice(err.message)); }, []); const send = async (event) => { event.preventDefault(); if (!input.trim()) return; setBusy(true); try { const data = await api('/support/message', { method: 'POST', body: { content: input } }); setMessages(data.messages || []); setInput(''); } catch (err) { setNotice(err.message); } finally { setBusy(false); } }; return <Modal title="Bantuan Laprakin" onClose={onClose} className="support-modal"><p className="modal-description">CS hanya menjawab tentang Laprakin: akun, prodi, bahan, draft, export, billing, privasi, dan kendala sistem.</p><div className="modal-thread">{messages.length ? messages.map((item) => <article key={item.id} className={`mini-message ${item.role}`}><span>{item.role === 'assistant' ? 'L' : 'K'}</span><p>{item.content}</p></article>) : <div className="empty-modal"><HelpCircle size={19} /><b>Ada kendala?</b><p>Contoh: “Kenapa file saya gagal diunggah?”</p></div>}</div><form className="modal-composer" onSubmit={send}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Tanyakan soal Laprakin..." /><button disabled={busy || !input.trim()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}</button></form></Modal>; }

function LegacyFeedbackModal({ onClose }) { const { setNotice } = useApp(); const [items, setItems] = useState([]); const [form, setForm] = useState({ category: 'idea', rating: 5, body: '', contactAllowed: false, allowPublicQuote: false, publicAlias: '' }); const [busy, setBusy] = useState(false); useEffect(() => { api('/feedback').then((data) => setItems(data.items || [])).catch((err) => setNotice(err.message)); }, []); const submit = async (event) => { event.preventDefault(); setBusy(true); try { const data = await api('/feedback', { method: 'POST', body: form }); setItems((old) => [data.item, ...old]); setForm({ category: 'idea', rating: 5, body: '', contactAllowed: false, allowPublicQuote: false, publicAlias: '' }); setNotice('Feedback terkirim.'); } catch (err) { setNotice(err.message); } finally { setBusy(false); } }; return <Modal title="Feedback" onClose={onClose} className="feedback-modal"><p className="modal-description">Kirim bug, ide, atau pengalaman. Balasan tim tetap muncul di popup ini.</p><form className="feedback-form" onSubmit={submit}><div className="feedback-grid"><label>Kategori<CustomSelect value={form.category} onChange={(value) => setForm({ ...form, category: value })} options={[{ value: 'idea', label: 'Ide fitur' }, { value: 'bug', label: 'Bug' }, { value: 'experience', label: 'Pengalaman' }, { value: 'other', label: 'Lainnya' }]} /></label><label>Rating<CustomSelect value={String(form.rating)} onChange={(value) => setForm({ ...form, rating: Number(value) })} options={[5,4,3,2,1].map((value) => ({ value: String(value), label: `${value} / 5` }))} /></label></div><label>Masukan<textarea minLength="12" required value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Ceritakan yang perlu diperbaiki atau dikembangkan..." /></label><Toggle checked={form.contactAllowed} onChange={(checked) => setForm({ ...form, contactAllowed: checked })} title="Boleh dihubungi lewat akun" description="Admin tetap tidak otomatis melihat email atau NIM." /><Toggle checked={form.allowPublicQuote} onChange={(checked) => setForm({ ...form, allowPublicQuote: checked })} title="Boleh dipertimbangkan sebagai testimoni" description="Hanya dipakai bila kamu juga mengisi alias publik." />{form.allowPublicQuote && <label>Alias publik<input value={form.publicAlias} onChange={(event) => setForm({ ...form, publicAlias: event.target.value })} placeholder="Contoh: Mahasiswa TI semester 4" /></label>}<Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}Kirim feedback</Button></form><div className="feedback-history"><b>Riwayat feedback</b>{items.length ? items.map((item) => <article key={item.id}><div><span>{item.category} · {item.rating ? `${item.rating}/5` : 'tanpa rating'}</span><small>{formatDate(item.updatedAt)}</small></div><p>{item.body}</p><em>{item.status}</em>{item.replies?.map((reply) => <div className="feedback-reply" key={reply.id}><b>Tim Laprakin</b><p>{reply.body}</p></div>)}</article>) : <p className="muted-note">Belum ada feedback yang dikirim.</p>}</div></Modal>; }

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
    <form className="support-composer" onSubmit={send}><textarea rows="2" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Tulis kendalamu..."/><div><small>Jangan kirim kata sandi atau data sensitif.</small><button type="submit" disabled={busy || !input.trim()}>{busy ? <LoaderCircle className="spin" size={15}/> : <Send size={15}/>}Kirim</button></div></form>
  </Modal>;
}

function FeedbackModal({ onClose }) {
  const { setNotice } = useApp();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ category: 'idea', rating: 5, body: '', contactAllowed: false, allowPublicQuote: false, publicAlias: '' });
  const [busy, setBusy] = useState(false);
  const categories = [{ value: 'idea', label: 'Ide fitur' }, { value: 'bug', label: 'Bug' }, { value: 'experience', label: 'Pengalaman' }, { value: 'other', label: 'Lainnya' }];
  useEffect(() => { api('/feedback').then((data) => setItems(data.items || [])).catch((err) => setNotice(err.message)); }, []);
  const submit = async (event) => { event.preventDefault(); setBusy(true); try { const data = await api('/feedback', { method: 'POST', body: form }); setItems((old) => [data.item, ...old]); setForm({ category: 'idea', rating: 5, body: '', contactAllowed: false, allowPublicQuote: false, publicAlias: '' }); setNotice('Feedback terkirim.'); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  return <Modal title="Feedback" onClose={onClose} className="feedback-modal feedback-modal-v2">
    <div className="feedback-layout">
      <form className="feedback-form" onSubmit={submit}>
        <header><span>Bagikan masukan</span><h2>Bantu kami memperbaiki Laprakin.</h2><p>Masukan yang spesifik lebih mudah ditindaklanjuti.</p></header>
        <fieldset className="feedback-category"><legend>Kategori</legend><div>{categories.map((item) => <button type="button" key={item.value} className={form.category === item.value ? 'active' : ''} onClick={() => setForm({ ...form, category: item.value })}>{item.label}</button>)}</div></fieldset>
        <fieldset className="feedback-rating"><legend>Pengalaman kamu</legend><div>{[1,2,3,4,5].map((rating) => <button type="button" key={rating} className={form.rating === rating ? 'active' : ''} onClick={() => setForm({ ...form, rating })}><b>{rating}</b><span>{rating === 1 ? 'Buruk' : rating === 5 ? 'Bagus' : ''}</span></button>)}</div></fieldset>
        <label className="feedback-body"><span>Masukan</span><textarea minLength="12" maxLength="1200" required value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Apa yang terjadi, dan seperti apa hasil yang kamu harapkan?"/><small>{form.body.length} / 1200</small></label>
        <div className="feedback-consent"><Toggle checked={form.contactAllowed} onChange={(checked) => setForm({ ...form, contactAllowed: checked })} title="Boleh dihubungi" description="Tim dapat membalas lewat akun ini."/><Toggle checked={form.allowPublicQuote} onChange={(checked) => setForm({ ...form, allowPublicQuote: checked })} title="Boleh dijadikan testimoni" description="Hanya dengan alias yang kamu tentukan."/>{form.allowPublicQuote && <label><span>Alias publik</span><input value={form.publicAlias} onChange={(event) => setForm({ ...form, publicAlias: event.target.value })} placeholder="Mahasiswa TI semester 4"/></label>}</div>
        <button className="feedback-submit" type="submit" disabled={busy || form.body.trim().length < 12}>{busy ? <LoaderCircle className="spin" size={15}/> : <Send size={15}/>}Kirim feedback</button>
      </form>
      <aside className="feedback-history"><header><div><b>Riwayat</b><small>{items.length} masukan</small></div><MessageSquareText size={17}/></header>{items.length ? <div>{items.map((item) => <article key={item.id}><div><span>{item.category} · {item.rating ? `${item.rating}/5` : 'tanpa rating'}</span><small>{formatDate(item.updatedAt)}</small></div><p>{item.body}</p><em>{item.status}</em>{item.replies?.map((reply) => <div className="feedback-reply" key={reply.id}><b>Tim Laprakin</b><p>{reply.body}</p></div>)}</article>)}</div> : <div className="feedback-empty"><MessageSquareText size={18}/><b>Belum ada feedback</b><p>Masukan yang dikirim akan tersimpan dan balasan tim muncul di sini.</p></div>}</aside>
    </div>
  </Modal>;
}

function NotificationModal({ onClose }) { const { setNotice } = useApp(); const [data, setData] = useState({ notifications: [], unread: 0 }); useEffect(() => { api('/notifications').then(setData).catch((err) => setNotice(err.message)); }, []); useEffect(() => { const timer = window.setTimeout(onClose, 5000); return () => window.clearTimeout(timer); }, [onClose]); const markRead = async () => { try { setData(await api('/notifications/read', { method: 'PUT', body: {} })); } catch (err) { setNotice(err.message); } }; return <aside className="notification-popover" role="dialog" aria-label="Notifikasi"><header><div><b>Notifikasi</b><small>{data.unread ? `${data.unread} baru` : 'Semua sudah dibaca'}</small></div><IconButton label="Tutup" onClick={onClose}><X size={16} /></IconButton></header>{data.unread ? <button className="notification-read" onClick={markRead}>Tandai semua dibaca</button> : null}<div className="notification-list">{data.notifications.length ? data.notifications.map((note) => <article key={note.id}><span /><div><b>{note.title}</b><p>{note.body}</p><small>{formatDate(note.created_at)}</small></div></article>) : <p className="muted-note">Belum ada notifikasi.</p>}</div></aside>; }

function AppDialog({ dialog, onResolve }) {
  const [value, setValue] = useState('');
  const isPrompt = dialog?.kind === 'prompt';
  useEffect(() => { setValue(dialog?.initialValue || ''); }, [dialog]);
  if (!dialog) return null;
  const close = (result) => onResolve(isPrompt && result === true ? value.trim() : result);
  return <div className="app-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(isPrompt ? null : false); }}><section className={`app-dialog ${dialog.destructive ? 'is-danger' : ''}`} role="dialog" aria-modal="true" aria-labelledby="app-dialog-title"><div className="app-dialog-icon">{dialog.destructive ? <Trash2 size={17} /> : isPrompt ? <Pencil size={17} /> : <CircleAlert size={17} />}</div><div className="app-dialog-copy"><h2 id="app-dialog-title">{dialog.title || 'Konfirmasi'}</h2>{dialog.message && <p>{dialog.message}</p>}</div>{isPrompt && <form onSubmit={(event) => { event.preventDefault(); close(true); }}><input autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder={dialog.placeholder || ''} maxLength={dialog.maxLength || 100} /><div className="app-dialog-actions"><button type="button" className="app-dialog-cancel" onClick={() => close(null)}>Batal</button><button type="submit" className="app-dialog-confirm">{dialog.confirmLabel || 'Simpan'}</button></div></form>}{!isPrompt && <div className="app-dialog-actions"><button type="button" className="app-dialog-cancel" onClick={() => close(false)}>Batal</button><button type="button" className="app-dialog-confirm" onClick={() => close(true)}>{dialog.confirmLabel || 'Lanjutkan'}</button></div>}</section></div>;
}

function Modal({ title, onClose, children, className = '' }) {
  useEffect(() => { const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby="workspace-modal-title"><header><b id="workspace-modal-title">{title}</b><IconButton label="Tutup" onClick={onClose}><X size={16}/></IconButton></header>{children}</section></div>;
}

function AdminWorkspace() {
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
  const [integrationStatus, setIntegrationStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState({});
  const load = async () => {
    try {
      const [nextOverview, nextFeedback, nextAudit, nextCms, nextAiUsage] = await Promise.all([
        api('/admin/overview'), api('/admin/feedback'), api('/admin/audit'), api('/admin/cms/landing'), api('/admin/ai/usage?days=30'),
      ]);
      setOverview(nextOverview); setFeedback(nextFeedback.items || []); setAudit(nextAudit.events || []); setLanding(nextCms.landing || null); setAiUsage(nextAiUsage);
    } catch (error) { setNotice(error.message); }
  };
  useEffect(() => { load(); }, []);
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
    ['overview', 'Monitoring', LayoutDashboard], ['integrations', 'AI & Login', Sparkles], ['updates', 'Updates', BellRing], ['feedback', 'Feedback', MessageSquareText], ['risk', 'Risk review', AlertTriangle], ['cms', 'Landing CMS', Megaphone], ['audit', 'Audit log', ClipboardList], ['retention', 'Retensi', FileCog],
  ];
  const tabGroups = [
    ['Operasional', ['overview', 'integrations']],
    ['Konten', ['updates', 'feedback', 'cms']],
    ['Keamanan', ['risk', 'audit', 'retention']],
  ];
  if (!overview || !landing) return <div className="admin-loading-state"><LoaderCircle className="spin" size={20} /><b>Memuat Admin Console…</b><span>Jika data belum masuk, gunakan tombol muat ulang setelah beberapa saat.</span><Button variant="secondary" onClick={load}>Coba muat ulang</Button></div>;
  return <div className={`admin-workspace ${adminTheme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
    <aside className="admin-sidebar"><div className="admin-brand"><BrandMark alt=""/><div><b>Laprakin</b><small>Admin console</small></div></div><nav>{tabGroups.map(([group, keys]) => <div className="admin-nav-group" key={group}><small>{group}</small>{keys.map((key) => { const [, label, Icon] = tabs.find(([tabKey]) => tabKey === key); return <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)} title={label}><Icon size={16} /><span>{label}</span></button>; })}</div>)}</nav><div className="admin-sidebar-foot"><div><span>{(user.email || 'A').slice(0,1).toUpperCase()}</span><small>{user.email}</small></div><button onClick={async () => { await api('/auth/logout', { method: 'POST', body: {} }); await refreshSession(); navigate('/'); }}><LogOut size={15} />Keluar</button></div></aside>
    <main className="admin-main"><header className="admin-header"><div><p>Admin console</p><h1>{tabs.find(([key]) => key === tab)?.[1]}</h1></div><div className="admin-header-actions"><button className="admin-theme-toggle" onClick={() => setAdminTheme((value) => value === 'dark' ? 'light' : 'dark')} title="Ubah tema admin" aria-label="Ubah tema admin">{adminTheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button><button className="admin-refresh" onClick={load}><RefreshCw size={15} /><span>Muat ulang</span></button></div></header>
      {tab === 'overview' && <section className="admin-content"><div className="admin-privacy-note"><ShieldCheck size={17} /><div><b>Privacy-first monitoring</b><span>Hanya metadata operasional dan referensi anonim. Isi chat, dokumen, file, email, NIM, IP, dan fingerprint tidak ditampilkan.</span></div></div><div className="admin-metric-grid">{[['User aktif',overview.stats.users,Users],['Dokumen aktif',overview.stats.documents,FileText],['Job berjalan',overview.stats.queuedJobs,Activity],['AI call 24j',overview.stats.aiCalls24h,Sparkles],['Token AI 24j',Number(overview.stats.aiTokens24h || 0).toLocaleString('id-ID'),Activity],['Error AI 24j',overview.stats.aiErrors24h,AlertTriangle],['Feedback terbuka',overview.stats.openFeedback,MessageCircle],['Risk terbuka',overview.stats.openRiskEvents,AlertTriangle],['Storage',formatBytes(overview.storageBytes),Database]].map(([label,value,Icon]) => <article key={label}><Icon size={16}/><span>{label}</span><b>{value}</b></article>)}</div><div className="admin-grid"><section className="admin-panel"><div className="admin-panel-head"><h2>Aktivitas 7 hari</h2><small>Event agregat</small></div><div className="activity-bars">{overview.dailyActivity?.length ? overview.dailyActivity.map((day) => <div key={day.day}><i style={{height:`${Math.max(8, Math.min(100, day.count * 12))}%`}} /><span>{day.day.slice(5)}</span><b>{day.count}</b></div>) : <p>Belum ada aktivitas.</p>}</div></section><section className="admin-panel"><div className="admin-panel-head"><h2>Job terbaru</h2><small>Tanpa isi dokumen</small></div><div className="admin-list">{overview.jobs?.length ? overview.jobs.map((job) => <article key={job.id}><div><b>{job.job_type}</b><small>{job.message || 'Memproses'}</small></div><span className={`status-${job.status}`}>{job.status}</span></article>) : <p>Belum ada job.</p>}</div></section></div></section>}
      {tab === 'integrations' && <section className="admin-content"><div className="admin-privacy-note"><ShieldCheck size={17}/><div><b>Credential tetap di server</b><span>Health check hanya menampilkan status model dan metadata OIDC. API key, client secret, prompt, serta output AI tidak pernah dikirim ke browser.</span></div></div><div className="admin-metric-grid">{[['Call 30 hari',aiUsage?.totals?.calls || 0,Sparkles],['Berhasil',aiUsage?.totals?.successful || 0,CheckCircle2],['Gagal',aiUsage?.totals?.failed || 0,AlertTriangle],['Input token',Number(aiUsage?.totals?.input_tokens || 0).toLocaleString('id-ID'),Activity],['Output token',Number(aiUsage?.totals?.output_tokens || 0).toLocaleString('id-ID'),Activity],['Latency rata-rata',`${aiUsage?.totals?.average_latency_ms || 0} ms`,Activity]].map(([label,value,Icon])=><article key={label}><Icon size={16}/><span>{label}</span><b>{value}</b></article>)}</div><div className="admin-grid"><section className="admin-panel"><div className="admin-panel-head"><h2>Status integrasi</h2><Button variant="secondary" onClick={checkIntegrations} disabled={busy}>{busy ? <LoaderCircle className="spin" size={14}/> : <RefreshCw size={14}/>}Cek sekarang</Button></div><div className="admin-list"><article><div><b>Gemini API</b><small>{integrationStatus?.gemini?.models?.length ? integrationStatus.gemini.models.map((item)=>`${item.model}: ${item.ok?'ready':'gagal'}`).join(' · ') : 'Jalankan pengecekan menggunakan credential server.'}</small></div><span className={integrationStatus?.gemini?.ok?'status-completed':integrationStatus?'status-failed':''}>{integrationStatus?.gemini?.ok?'ready':integrationStatus?'belum siap':'belum dicek'}</span></article><article><div><b>Google Login</b><small>{integrationStatus?.googleOidc?.redirectOrigin || 'Memvalidasi OIDC Discovery, PKCE S256, dan callback origin.'}</small></div><span className={integrationStatus?.googleOidc?.ok?'status-completed':integrationStatus?'status-failed':''}>{integrationStatus?.googleOidc?.ok?'ready':integrationStatus?'belum siap':'belum dicek'}</span></article></div></section><section className="admin-panel"><div className="admin-panel-head"><h2>Pemakaian per model</h2><small>30 hari</small></div><div className="admin-list">{aiUsage?.breakdown?.length?aiUsage.breakdown.slice(0,10).map((item)=><article key={`${item.purpose}-${item.mode}-${item.model}-${item.status}`}><div><b>{item.purpose} · {item.mode}</b><small>{item.model} · {Number(item.total_tokens || 0).toLocaleString('id-ID')} token · {item.average_latency_ms || 0} ms</small></div><span className={`status-${item.status==='success'?'completed':'failed'}`}>{item.calls} call</span></article>):<p>Belum ada pemakaian AI.</p>}</div></section></div></section>}
      {tab === 'updates' && <FeatureUpdatesAdmin setNotice={setNotice} />}
      {tab === 'feedback' && <section className="admin-content"><div className="admin-panel admin-wide"><div className="admin-panel-head"><h2>Feedback pengguna</h2><small>Referensi akun dianonimkan.</small></div><div className="admin-list feedback-admin-list">{feedback.length ? feedback.map((item) => <article key={item.id}><div className="feedback-admin-body"><div><b>{item.category} · {item.rating || '—'}/5</b><small>{item.userRef} · {formatDate(item.updatedAt)}</small></div><p>{item.body}</p>{item.replies?.map((itemReply) => <small key={itemReply.id} className="admin-reply">Tim: {itemReply.body}</small>)}<div className="admin-inline"><input value={reply[item.id] || ''} onChange={(event) => setReply((prev)=>({...prev,[item.id]:event.target.value}))} placeholder="Tulis balasan untuk user..." /><Button onClick={() => sendReply(item.id)} disabled={busy}>Kirim</Button></div></div><div className="admin-actions"><CustomSelect value={item.status} onChange={(value) => updateFeedback(item.id, value)} options={[{value:'open',label:'Open'},{value:'reviewing',label:'Reviewing'},{value:'resolved',label:'Resolved'},{value:'closed',label:'Closed'}]} /></div></article>) : <p className="empty-admin">Belum ada feedback.</p>}</div></div></section>}
      {tab === 'risk' && <section className="admin-content"><div className="admin-panel admin-wide"><div className="admin-panel-head"><h2>Kejadian perlu ditinjau</h2><small>Tidak otomatis menuduh atau memblokir akun.</small></div><div className="admin-list">{overview.events?.length ? overview.events.map((event) => <article key={event.id}><div><b>{event.summary}</b><small>{event.userRef} · {event.category} · {event.severity} · {formatDate(event.createdAt)}</small></div><div className="admin-risk-actions"><span className={`risk-${event.status}`}>{event.status}</span>{event.status === 'open' && <><button onClick={() => reviewRisk(event.id,'reviewed')}>Tinjau</button><button onClick={() => reviewRisk(event.id,'dismissed')}>Tutup</button></>}</div></article>) : <p className="empty-admin">Belum ada kejadian yang perlu ditinjau.</p>}</div></div></section>}
      {tab === 'cms' && <section className="admin-content"><div className="admin-panel admin-wide"><div className="admin-panel-head"><h2>Landing CMS</h2><small>Atur teks, testimoni berizin, dan visual landing.</small></div><div className="cms-form"><Toggle checked={Boolean(landing.announcement?.enabled)} onChange={(checked)=>setLanding((prev)=>({...prev,announcement:{...prev.announcement,enabled:checked}}))} title="Tampilkan announcement" description="Muncul di bagian atas hero." /><label>Teks announcement<input value={landing.announcement?.text || ''} onChange={(event)=>setLanding((prev)=>({...prev,announcement:{...prev.announcement,text:event.target.value}}))} maxLength="180" /></label><label>CTA announcement<input value={landing.announcement?.ctaLabel || ''} onChange={(event)=>setLanding((prev)=>({...prev,announcement:{...prev.announcement,ctaLabel:event.target.value}}))} maxLength="32" /></label><div className="cms-copy-section"><div><b>Copy landing</b><small>Ubah judul dan teks utama landing tanpa menyentuh layout.</small></div><div className="cms-copy-grid"><label>Judul hero<input value={landing.copy?.heroTitle || 'Laprakin'} onChange={(event)=>setLanding((prev)=>({...prev,copy:{...(prev.copy || {}),heroTitle:event.target.value}}))} maxLength="60" /></label><label>Deskripsi hero<textarea value={landing.copy?.heroSubtitle || ''} onChange={(event)=>setLanding((prev)=>({...prev,copy:{...(prev.copy || {}),heroSubtitle:event.target.value}}))} maxLength="280" /></label><label>Judul layanan<input value={landing.copy?.servicesTitle || ''} onChange={(event)=>setLanding((prev)=>({...prev,copy:{...(prev.copy || {}),servicesTitle:event.target.value}}))} maxLength="120" /></label><label>Deskripsi layanan<textarea value={landing.copy?.servicesSubtitle || ''} onChange={(event)=>setLanding((prev)=>({...prev,copy:{...(prev.copy || {}),servicesSubtitle:event.target.value}}))} maxLength="280" /></label><label>Judul perbedaan<input value={landing.copy?.compareTitle || ''} onChange={(event)=>setLanding((prev)=>({...prev,copy:{...(prev.copy || {}),compareTitle:event.target.value}}))} maxLength="120" /></label><label>Deskripsi perbedaan<textarea value={landing.copy?.compareSubtitle || ''} onChange={(event)=>setLanding((prev)=>({...prev,copy:{...(prev.copy || {}),compareSubtitle:event.target.value}}))} maxLength="280" /></label><label>Judul tutorial<input value={landing.copy?.tutorialTitle || ''} onChange={(event)=>setLanding((prev)=>({...prev,copy:{...(prev.copy || {}),tutorialTitle:event.target.value}}))} maxLength="120" /></label><label>Deskripsi tutorial<textarea value={landing.copy?.tutorialSubtitle || ''} onChange={(event)=>setLanding((prev)=>({...prev,copy:{...(prev.copy || {}),tutorialSubtitle:event.target.value}}))} maxLength="280" /></label><label>Deskripsi footer<textarea value={landing.copy?.footerText || ''} onChange={(event)=>setLanding((prev)=>({...prev,copy:{...(prev.copy || {}),footerText:event.target.value}}))} maxLength="280" /></label></div></div><div className="cms-media-grid cms-media-grid-expanded">
  <article className="cms-media-card"><b>Gambar latar hero</b><small>Opsional. PNG, JPG, atau WEBP. Gradient tetap menjaga teks hero terbaca.</small><div className="cms-media-preview">{landing.media?.heroImageUrl ? <img src={landing.media.heroImageUrl} alt="Preview hero" /> : 'Belum ada gambar'}</div><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event)=>uploadLandingMedia(event,'hero')} disabled={busy}/><input value={landing.media?.heroImageUrl || ''} onChange={(event)=>updateLandingMedia({heroImageUrl:event.target.value})} placeholder="Atau tempel URL gambar" /></article>
  <article className="cms-media-card"><b>Compare Basic — AI lain</b><small>PDF sisi kiri untuk tab Basic.</small><div className={`cms-media-preview ${(landing.media?.compareBasicAiPdfUrl || landing.media?.compareAiPdfUrl) ? 'pdf' : ''}`}>{(landing.media?.compareBasicAiPdfUrl || landing.media?.compareAiPdfUrl) ? 'PDF tersambung' : 'Pakai PDF demo bawaan'}</div><input type="file" accept="application/pdf" onChange={(event)=>uploadLandingMedia(event,'compare-basic-ai')} disabled={busy}/><input value={landing.media?.compareBasicAiPdfUrl || landing.media?.compareAiPdfUrl || ''} onChange={(event)=>updateLandingMedia({compareAiPdfUrl:event.target.value,compareBasicAiPdfUrl:event.target.value})} placeholder="Atau tempel URL PDF" /></article>
  <article className="cms-media-card"><b>Compare Basic — Laprakin</b><small>PDF sisi kanan untuk tab Basic.</small><div className={`cms-media-preview ${(landing.media?.compareBasicLaprakinPdfUrl || landing.media?.compareLaprakinPdfUrl) ? 'pdf' : ''}`}>{(landing.media?.compareBasicLaprakinPdfUrl || landing.media?.compareLaprakinPdfUrl) ? 'PDF tersambung' : 'Pakai PDF demo bawaan'}</div><input type="file" accept="application/pdf" onChange={(event)=>uploadLandingMedia(event,'compare-basic-laprakin')} disabled={busy}/><input value={landing.media?.compareBasicLaprakinPdfUrl || landing.media?.compareLaprakinPdfUrl || ''} onChange={(event)=>updateLandingMedia({compareLaprakinPdfUrl:event.target.value,compareBasicLaprakinPdfUrl:event.target.value})} placeholder="Atau tempel URL PDF" /></article>
  <article className="cms-media-card"><b>Compare Thinking — AI lain</b><small>PDF sisi kiri untuk tab Thinking.</small><div className={`cms-media-preview ${landing.media?.compareThinkingAiPdfUrl ? 'pdf' : ''}`}>{landing.media?.compareThinkingAiPdfUrl ? 'PDF tersambung' : 'Belum ada PDF'}</div><input type="file" accept="application/pdf" onChange={(event)=>uploadLandingMedia(event,'compare-thinking-ai')} disabled={busy}/><input value={landing.media?.compareThinkingAiPdfUrl || ''} onChange={(event)=>updateLandingMedia({compareThinkingAiPdfUrl:event.target.value})} placeholder="Atau tempel URL PDF" /></article>
  <article className="cms-media-card"><b>Compare Thinking — Laprakin</b><small>PDF sisi kanan untuk tab Thinking.</small><div className={`cms-media-preview ${landing.media?.compareThinkingLaprakinPdfUrl ? 'pdf' : ''}`}>{landing.media?.compareThinkingLaprakinPdfUrl ? 'PDF tersambung' : 'Belum ada PDF'}</div><input type="file" accept="application/pdf" onChange={(event)=>uploadLandingMedia(event,'compare-thinking-laprakin')} disabled={busy}/><input value={landing.media?.compareThinkingLaprakinPdfUrl || ''} onChange={(event)=>updateLandingMedia({compareThinkingLaprakinPdfUrl:event.target.value})} placeholder="Atau tempel URL PDF" /></article>
  <article className="cms-media-card"><b>Compare XtraThink — AI lain</b><small>PDF sisi kiri untuk tab XtraThink.</small><div className={`cms-media-preview ${landing.media?.compareXtraThinkAiPdfUrl ? 'pdf' : ''}`}>{landing.media?.compareXtraThinkAiPdfUrl ? 'PDF tersambung' : 'Belum ada PDF'}</div><input type="file" accept="application/pdf" onChange={(event)=>uploadLandingMedia(event,'compare-xtrathink-ai')} disabled={busy}/><input value={landing.media?.compareXtraThinkAiPdfUrl || ''} onChange={(event)=>updateLandingMedia({compareXtraThinkAiPdfUrl:event.target.value})} placeholder="Atau tempel URL PDF" /></article>
  <article className="cms-media-card"><b>Compare XtraThink — Laprakin</b><small>PDF sisi kanan untuk tab XtraThink.</small><div className={`cms-media-preview ${landing.media?.compareXtraThinkLaprakinPdfUrl ? 'pdf' : ''}`}>{landing.media?.compareXtraThinkLaprakinPdfUrl ? 'PDF tersambung' : 'Belum ada PDF'}</div><input type="file" accept="application/pdf" onChange={(event)=>uploadLandingMedia(event,'compare-xtrathink-laprakin')} disabled={busy}/><input value={landing.media?.compareXtraThinkLaprakinPdfUrl || ''} onChange={(event)=>updateLandingMedia({compareXtraThinkLaprakinPdfUrl:event.target.value})} placeholder="Atau tempel URL PDF" /></article>
  <article className="cms-media-card cms-video-card"><b>Video perbandingan</b><small>MP4 atau WEBM yang membandingkan AI umum dengan Laprakin dalam satu video.</small><div className="cms-media-preview">{landing.media?.compareVideoUrl ? <video src={landing.media.compareVideoUrl} muted playsInline preload="metadata" /> : 'Belum ada video'}</div><input type="file" accept="video/mp4,video/webm" onChange={(event)=>uploadLandingMedia(event,'compare-video')} disabled={busy}/><input value={landing.media?.compareVideoUrl || ''} onChange={(event)=>updateLandingMedia({compareVideoUrl:event.target.value})} placeholder="Atau tempel URL video" /></article>
  <article className="cms-media-card cms-video-card"><b>Video product demo</b><small>MP4 atau WEBM. Diputar otomatis di hero tanpa suara dan berulang.</small><div className="cms-media-preview">{landing.media?.tutorialVideoUrl ? <video src={landing.media.tutorialVideoUrl} muted playsInline preload="metadata" /> : 'Belum ada video'}</div><input type="file" accept="video/mp4,video/webm" onChange={(event)=>uploadLandingMedia(event,'tutorial-video')} disabled={busy}/><input value={landing.media?.tutorialVideoUrl || ''} onChange={(event)=>updateLandingMedia({tutorialVideoUrl:event.target.value})} placeholder="Atau tempel URL video" /></article>
</div><div className="cms-testimonials"><b>Testimoni</b>{(landing.testimonials || []).length ? landing.testimonials.map((item,index)=><article key={item.id || index}><div><b>{item.name}</b><small>{item.label}</small><p>{item.quote}</p></div><Toggle checked={Boolean(item.published)} onChange={(checked)=>setLanding((prev)=>({...prev,testimonials:prev.testimonials.map((row,i)=>i===index?{...row,published:checked}:row)}))} title="Publish" /></article>) : <p className="muted-note">Belum ada testimoni berizin.</p>}</div><Button onClick={saveLanding} disabled={busy}><Save size={14}/>Simpan CMS</Button></div></div></section>}
      {tab === 'audit' && <section className="admin-content"><div className="admin-panel admin-wide"><div className="admin-panel-head"><h2>Audit log</h2><small>Metadata event, tanpa isi chat/file.</small></div><div className="admin-list">{audit.map((event)=><article key={event.id}><div><b>{event.action}</b><small>{event.actorRef} · {event.targetType} · {formatDate(event.createdAt)}</small></div></article>)}</div></div></section>}
      {tab === 'retention' && <section className="admin-content"><div className="admin-panel admin-wide retention-panel"><FileCog size={24}/><h2>Pembersihan retensi</h2><p>Menghapus resource sementara atau melewati masa retensi sesuai kebijakan. Tidak membaca isi file pengguna.</p><Button onClick={runRetention} disabled={busy}><RefreshCw size={14}/>Jalankan pembersihan</Button></div></section>}
    </main>
  </div>;
}

function LoadingScreen() { return <div className="loading-screen"><LoaderCircle className="spin" size={20} /><span>Menyiapkan Laprakin...</span></div>; }

createRoot(document.getElementById('root')).render(<BrowserRouter><App /></BrowserRouter>);
