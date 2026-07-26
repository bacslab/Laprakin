import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from './router';
import { Component, Fragment, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, ArrowDownToLine, ArrowLeft, ArrowRight, Bell, Check, CheckCircle2, ChevronDown, CircleAlert,
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
import { renderAsync as renderDocx } from 'docx-preview';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

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
  'Tulis mata kuliah dan materinya sekali. Laprakin akan menangkap brief, lalu menanyakan hanya yang benar-benar kurang.': 'Mention the course and topic once. Laprakin will capture the brief and only ask for what is truly missing.',
  'Siapkan identitas cover': 'Set up cover identity',
  'Opsional sekarang. Disimpan sekali dan otomatis dipakai pada laprak berikutnya.': 'Optional for now. Save it once and reuse it on future reports.',
  'Nama lengkap': 'Full name',
  'Nomor mahasiswa': 'Student number',
  'Nanti': 'Later',
  'Deteksi otomatis': 'Auto-detect',
  'Brief tertangkap': 'Brief captured',
  'Acuan dan ketentuan': 'Sources and requirements',
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
  configuration: { courseName: '', moduleTitle: '', lecturerName: '', lecturerNip: '', documentProfile: 'langkah', customStructure: '', instructions: '', tone: 'semi-formal', perspective: 'saya', allowExternalAi: true },
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

function GoogleLogo() {
  return <svg className="google-logo" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>;
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
  return <AppContext.Provider value={value}>{children}{notice && <div className="toast" role="status"><span>{notice}</span><IconButton label="Tutup notifikasi" onClick={() => setNotice(null)}><X size={14} /></IconButton></div>}<AppDialog dialog={dialog} onResolve={resolveDialog} /></AppContext.Provider>;
}

function App() {
  const location = useLocation();
  return <AppErrorBoundary resetKey={location.pathname}><AppProvider><I18nRuntime><div className="route-transition"><Routes><Route path="/" element={<Landing />} /><Route path="/auth" element={<AuthPage />} /><Route path="/privacy" element={<LegalPage type="privacy" />} /><Route path="/terms" element={<LegalPage type="terms" />} /><Route path="/pricing" element={<PublicPricingPage />} /><Route path="/checkout" element={<PublicPricingPage />} /><Route path="/billing" element={<PricingRedirect />} /><Route path="/app/billing" element={<PricingRedirect />} /><Route path="/admin/*" element={<ProtectedAdmin />} /><Route path="/app/*" element={<ProtectedApp />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></div></I18nRuntime></AppProvider></AppErrorBoundary>;
}

function Landing() {
  const { user, loading } = useApp();
  const navigate = useNavigate();
  if (loading) return <LoadingScreen />;
  if (user?.emailVerified) return <Navigate to={user.role === 'admin' ? '/admin' : '/app'} replace />;
  return <FigmaLanding navigate={navigate} />;
}

const legalContent = {
  privacy: {
    eyebrow: 'Privasi',
    title: 'Kebijakan Privasi Laprakin',
    intro: 'Kebijakan ini menjelaskan data yang diproses saat kamu memakai landing page, login, workspace, AI, penyimpanan dokumen, dan pembayaran Laprakin.',
    sections: [
      ['Data yang kami proses', 'Data akun seperti email, nama, metode login, profil akademik yang kamu isi, preferensi workspace, serta metadata keamanan minimum. Isi chat, file, dan dokumen diproses hanya untuk menjalankan fitur yang kamu minta.'],
      ['Pemrosesan AI', 'Jika izin provider AI eksternal aktif, konteks chat dan bagian lampiran yang relevan dapat dikirim dari server Laprakin ke Google Gemini untuk menghasilkan respons atau draft. API key tidak pernah dikirim ke browser. Kamu dapat mematikan izin ini melalui Settings > Kontrol data.'],
      ['Login dan layanan pendukung', 'Google memproses autentikasi saat kamu memilih login Google. Midtrans memproses checkout QRIS. Provider email mengirim verifikasi dan reset password. Laprakin menyimpan status yang diperlukan, bukan detail rekening atau instrumen pembayaranmu.'],
      ['Keamanan dan retensi', 'Sesi memakai cookie HttpOnly dan tindakan sensitif dilindungi CSRF. Token sementara, state OAuth, dan telemetry AI dipangkas otomatis. File yang dihapus masuk masa penghapusan sebelum dibersihkan permanen sesuai kebijakan retensi layanan.'],
      ['Kendali pengguna', 'Kamu dapat mengunduh ringkasan data, mencabut seluruh sesi, mengubah preferensi AI, menghapus file, dan meminta penghapusan akun melalui workspace. Untuk pertanyaan privasi, gunakan menu Bantuan setelah masuk.'],
      ['Integritas akademik', 'Laprakin membantu menyusun dan meninjau bahan, bukan membuat bukti, data praktikum, hasil eksperimen, atau sumber palsu. Kamu tetap bertanggung jawab memeriksa dokumen sebelum digunakan atau dikumpulkan.'],
    ],
  },
  terms: {
    eyebrow: 'Ketentuan',
    title: 'Ketentuan Layanan Laprakin',
    intro: 'Dengan membuat akun atau menggunakan Laprakin, kamu menyetujui ketentuan penggunaan layanan berikut.',
    sections: [
      ['Penggunaan layanan', 'Gunakan Laprakin untuk membantu mengelola bahan, percakapan, draft, revisi, dan export tugas akademik yang sah. Kamu wajib memberikan informasi yang benar dan menjaga keamanan akunmu.'],
      ['Larangan', 'Dilarang memakai layanan untuk memalsukan bukti, data, screenshot, hasil praktikum, identitas, atau sumber; mengunggah materi tanpa hak; mencoba mengakses akun lain; menyalahgunakan sistem; atau mengganggu ketersediaan layanan.'],
      ['Output AI', 'Respons dan draft AI bersifat bantuan kerja, dapat keliru, dan bukan pengganti penilaian akademik atau profesional. Kamu wajib meninjau fakta, angka, kutipan, struktur, serta kesesuaian dengan instruksi dosen sebelum menggunakannya.'],
      ['File dan hak penggunaan', 'Kamu mempertahankan hak atas bahanmu dan menyatakan memiliki izin untuk mengunggah serta memprosesnya. Kamu memberi Laprakin izin terbatas untuk menyimpan dan memproses bahan hanya demi menyediakan fitur yang diminta.'],
      ['Plan dan pembayaran', 'Harga, credit, masa aktif, dan fitur plan ditampilkan sebelum checkout. Pembayaran QRIS diproses Midtrans. Aktivasi mengikuti status pembayaran yang diverifikasi server; refund atau sengketa ditinjau berdasarkan status transaksi dan aturan yang berlaku.'],
      ['Ketersediaan dan perubahan', 'Laprakin masih dalam tahap beta. Kami dapat memperbaiki, membatasi, atau menghentikan fitur demi keamanan, kepatuhan, dan keandalan. Perubahan material pada ketentuan akan diinformasikan melalui layanan.'],
      ['Penangguhan akun', 'Akun dapat dibatasi bila terdapat penyalahgunaan, pelanggaran ketentuan, risiko keamanan, atau kewajiban hukum. Kami berupaya memberikan penjelasan dan jalur penyelesaian bila memungkinkan.'],
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
  const googleStatus = query.get('google') || '';
  const safeNext = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '';
  const destination = safeNext || (user?.role === 'admin' ? '/admin' : '/app');
  const [mode, setMode] = useState(resetToken ? 'reset' : 'login');
  const [form, setForm] = useState({ email: '', password: '', newPassword: '', referralCode: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(googleStatus === 'cancelled'
    ? 'Masuk dengan Google dibatalkan.'
    : googleStatus === 'failed'
      ? 'Masuk dengan Google belum berhasil. Coba lagi.'
      : '');
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
      if (mode === 'reset') { const data = await api('/auth/reset-password', { method: 'POST', body: { token: resetToken || devToken, password: form.newPassword }, includeCsrf: false }); setCsrfToken(data.csrfToken || ''); if (!data.csrfToken) { setMessage(data.message); setMode('login'); return; } const nextSession = await refreshSession(); navigate(safeNext || (nextSession?.user?.role === 'admin' ? '/admin' : '/app')); }
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
          <button type="button" className="google-button" onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL || '/api'}/auth/google/start?next=${encodeURIComponent(safeNext || '/app')}`; }}><GoogleLogo /> Lanjutkan dengan Google</button>
          <div className="auth-divider"><span>atau gunakan email</span></div>
        </>}
        {success && <div className="auth-notice success"><CheckCircle2 size={15} />{success}</div>}
        {devToken && mode === 'register' ? <div className="local-verify"><p>Mode lokal: verifikasi tanpa provider email.</p><button type="button" className="auth-submit" onClick={verifyDev} disabled={busy}>Verifikasi sekarang <ArrowRight size={15} /></button></div> : <form onSubmit={submit} className="auth-form">
          {mode !== 'reset' && <label><span>Email</span><input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="nama@email.com" /></label>}
          {['login', 'register'].includes(mode) && <label><span>Kata sandi</span><input type="password" minLength={mode === 'register' ? 12 : 1} maxLength="64" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={mode === 'register' ? 'Minimal 12 karakter' : 'Kata sandi'} /></label>}
          {mode === 'register' && <label><span>Kode referral <small>opsional</small></span><input value={form.referralCode} onChange={(event) => setForm({ ...form, referralCode: event.target.value })} placeholder="R-XXXXXXXX" /></label>}
          {mode === 'reset' && <label><span>Kata sandi baru</span><input type="password" minLength="12" maxLength="64" required value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} placeholder="Minimal 12 karakter" /></label>}
          {error && <div className="auth-notice error"><CircleAlert size={15} />{error}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy && <LoaderCircle className="spin" size={15} />}{mode === 'login' ? 'Masuk ke workspace' : mode === 'register' ? 'Buat akun' : mode === 'forgot' ? 'Kirim link reset' : 'Simpan kata sandi'} <ArrowRight size={15} /></button>
        </form>}
        <div className="auth-card-footer">
          {mode === 'login' && <button type="button" className="auth-text-button" onClick={() => changeMode('forgot')}>Lupa kata sandi?</button>}
          {['forgot', 'reset'].includes(mode) && <button type="button" className="auth-text-button" onClick={() => changeMode('login')}><ArrowLeft size={13} />Kembali ke masuk</button>}
          {formModes && <span>File tetap privat di dalam akunmu.</span>}
        </div>
      </section>
      <p className="auth-legal">Dengan melanjutkan, kamu menyetujui <Link to="/terms">Ketentuan Layanan</Link> dan <Link to="/privacy">Kebijakan Privasi</Link> Laprakin.</p>
    </main>
  </div>;
}

function ProtectedApp() { const { loading, user } = useApp(); if (loading) return <LoadingScreen />; if (!user) return <Navigate to="/auth" replace />; if (user.role === 'admin') return <Navigate to="/admin" replace />; return <Workspace />; }

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
      key: 'monthly', label: 'Pro', note: 'Untuk laprak harian', recommended: true, price: formatCurrency(pricing.monthly?.price || 29900), suffix: '/ 30 hari',
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
    <header className="pricing-compact-nav"><button type="button" onClick={() => navigate(user ? '/app' : '/')} aria-label="Kembali"><ArrowLeft size={18}/></button></header>
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
            <div className="pricing-compact-price"><strong>{card.price}</strong>{card.suffix && <span>{card.suffix}</span>}</div>
            <div className="pricing-compact-action-slot">
              {card.key === 'credit' ? <div className="pricing-compact-quantity" onClick={(event) => event.stopPropagation()}><span>Jumlah</span><div><button type="button" aria-label="Kurangi credit" onClick={() => updateCreditQuantity(creditQuantity - 1)}>-</button><b>{creditQuantity}</b><button type="button" aria-label="Tambah credit" onClick={() => updateCreditQuantity(creditQuantity + 1)}>+</button></div></div> : <span className="pricing-compact-quantity-placeholder" aria-hidden="true" />}
            </div>
            <button type="button" className={isCurrent || isFree ? 'is-quiet' : ''} onClick={() => selectProduct(card.key)}>{actionLabel}{!isFree && <ArrowRight size={15}/>}</button>
            <div className="pricing-compact-divider" />
            <ul>{card.features.map((feature) => <li key={feature}><Check size={13}/><span>{feature}</span></li>)}</ul>
          </article>;
        })}
      </section>}
      {user && selected && isCheckoutPage && <section className="pricing-compact-checkout" aria-live="polite"><div><small>Checkout QRIS</small><b>{quoteBusy ? 'Menghitung...' : quote?.displayTotal || 'Rp0'}</b><span>{quote?.items?.map((item) => `${item.label}${item.quantity > 1 ? ` x${item.quantity}` : ""}`).join(' + ') || 'Produk pilihan'}</span></div><Button onClick={checkout} disabled={busy || quoteBusy || !gateway?.enabled}>{busy ? <LoaderCircle className="spin" size={15}/> : <CreditCard size={15}/>} {gateway?.enabled ? 'Bayar dengan QRIS' : 'Gateway belum aktif'}</Button></section>}
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
function ProtectedAdmin() { const { loading, user } = useApp(); if (loading) return <LoadingScreen />; if (!user) return <Navigate to="/auth" replace />; if (user.role !== 'admin') return <Navigate to="/app" replace />; return <AdminWorkspace />; }

function canonicalCourseLabel(value = '') {
  const clean = String(value || '')
    .replace(/^\s*laprak\s+/i, '')
    .replace(/\s+\d+\s*chat\b.*$/i, '')
    .replace(/\s*[|·]\s*project pribadi\b.*$/i, '')
    .replace(/\s+project pribadi\b.*$/i, '')
    .replace(/\bmanajemen\s+(?:intra|inter)networkin(?:g)?\b/i, 'Manajemen Internetworking')
    .replace(/\bsecurity\b/gi, 'Security')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^(?:mana(?:nya)?|halo|hai|hello|kok|kenapa|gimana|bagaimana|sudah|udah|belum|lanjut|oke|ok|iya|ya|tidak|nggak|gak|ga|terserah)[?!.]*$/i.test(clean)) {
    return 'Belum dikelompokkan';
  }
  return clean || 'Belum dikelompokkan';
}

function normalizedCourseKey(value = '') {
  return canonicalCourseLabel(value)
    .normalize('NFKD')
    .toLocaleLowerCase('id-ID')
    .replace(/\b(?:intra|inter)networkin(?:g)?\b/g, 'internetworking')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'belum dikelompokkan';
}

function courseTokens(value = '') {
  return normalizedCourseKey(value)
    .split(' ')
    .filter((token) => token && !['dan', 'and', 'mata', 'kuliah', 'mk'].includes(token));
}

function courseAcronym(value = '') {
  const tokens = courseTokens(value);
  if (tokens.length === 1 && tokens[0].length <= 6) return tokens[0];
  return tokens.map((token) => token[0]).join('');
}

function editDistance(left = '', right = '') {
  const a = String(left);
  const b = String(right);
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return row[b.length];
}

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

function Workspace() {
  const { user, wallet, refreshSession, setNotice, prefs, setPrefs, showDialog } = useApp();
  const resolvedTheme = useResolvedTheme(prefs.theme || 'system');
  const location = useLocation(); const navigate = useNavigate(); const uploadRef = useRef(null);
  const [sessions, setSessions] = useState([]); const [active, setActive] = useState(null); const [messages, setMessages] = useState([]); const [attachments, setAttachments] = useState([]); const [documentState, setDocumentState] = useState(null); const [workflow, setWorkflow] = useState(null); const [activeJob, setActiveJob] = useState(null);
  const [input, setInput] = useState(''); const [pendingLandingFiles, setPendingLandingFiles] = useState([]); const [busy, setBusy] = useState(false); const [actionBusy, setActionBusy] = useState(false); const [accountOpen, setAccountOpen] = useState(false); const [draggingSession, setDraggingSession] = useState(null); const [renamingId, setRenamingId] = useState(null); const [leftCollapsed, setLeftCollapsed] = useState(() => window.innerWidth < 860 || localStorage.getItem('laprakin-left-collapsed') === 'true'); const [rightOpen, setRightOpen] = useState(false); const [documentOpen, setDocumentOpen] = useState(false); const [quizMode, setQuizMode] = useState(false); const [modal, setModal] = useState(null); const [config, setConfig] = useState(defaultChatConfig); const [contextOpen, setContextOpen] = useState(false); const [attachmentKind, setAttachmentKind] = useState(''); const [documents, setDocuments] = useState([]); const [projectPins, setProjectPins] = useState([]); const [billingPlan, setBillingPlan] = useState(null); const [aiMode, setAiMode] = useState('basic'); const [aiModeAccess, setAiModeAccess] = useState({ basic: { available: true }, thinking: { available: false }, xtrathink: { available: false } }); const [recentSearchOpen, setRecentSearchOpen] = useState(false); const [recentSearchQuery, setRecentSearchQuery] = useState(''); const [identityIntake, setIdentityIntake] = useState(null); const [tutorialOpen, setTutorialOpen] = useState(false); const [tutorialFirstUse, setTutorialFirstUse] = useState(false);
  const actionInFlightRef = useRef(false);
  const tutorialAutoOpenedRef = useRef(false);
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
  const identityComplete = Boolean(user.fullName && user.nim && user.className && user.institutionName && (user.facultyName || user.departmentKey) && (user.studyProgramName || user.studyProgramKey));
  useEffect(() => {
    if (!identityComplete || user.onboardingDismissed || tutorialAutoOpenedRef.current) return;
    tutorialAutoOpenedRef.current = true;
    setTutorialFirstUse(true);
    setTutorialOpen(true);
  }, [identityComplete, user.onboardingDismissed]);
  const updateConfig = (patch) => setConfig((value) => ({ ...value, ...patch, configuration: { ...value.configuration, ...(patch.configuration || {}) } }));
  const setRoute = (next) => navigate(next === 'chat' ? '/app' : `/app/${next}`);
  const createDefaultConfig = () => ({ ...defaultChatConfig, configuration: { ...defaultChatConfig.configuration, documentProfile: prefs.profile || 'langkah', tone: prefs.tone || 'semi-formal', perspective: prefs.perspective || 'saya', allowExternalAi: prefs.allowExternalAi !== false } });
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
      if (active?.id === session.id) { localStorage.removeItem('laprakin-active-chat-id'); setActive(null); setMessages([]); setAttachments([]); setDocumentState(null); setWorkflow(null); setActiveJob(null); }
      setNotice('Chat diarsipkan.');
    } catch (err) { setNotice(err.message); }
  };
  const deleteSession = async (session) => {
    try {
      await api(`/chat/sessions/${session.id}`, { method: 'DELETE' });
      setSessions((items) => items.filter((item) => item.id !== session.id));
      if (active?.id === session.id) { localStorage.removeItem('laprakin-active-chat-id'); setActive(null); setMessages([]); setAttachments([]); setDocumentState(null); setWorkflow(null); setActiveJob(null); }
      setNotice('Chat dihapus permanen.');
    } catch (err) { setNotice(err.message); }
  };
  useEffect(() => { loadSessions(); loadDocuments(); loadProjectPins(); loadBillingPlan(); loadAiModes(); }, []);
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
    setPendingLandingFiles([]);
    setIdentityIntake(null);
    setContextOpen(false);
    setRightOpen(false);
    setDocumentOpen(false);
    if (window.innerWidth <= 700) setLeftCollapsed(true);
    setRoute('chat');
  };
  const openSession = async (id) => { try { const data = await api(`/chat/sessions/${id}`); hydrate(data); setRoute('chat'); setRightOpen(false); setDocumentOpen(false); setContextOpen(false); if (window.innerWidth <= 700) setLeftCollapsed(true); } catch (err) { setNotice(err.message); } };
  const saveConfig = async () => { if (!active) return; setBusy(true); try { const data = await api(`/chat/sessions/${active.id}`, { method: 'PUT', body: sessionPayload({ ...config, courseGroup: config.configuration.courseName || 'Belum dikelompokkan' }) }); setActive(data.session); setSessions((old) => old.map((item) => item.id === data.session.id ? data.session : item)); setRightOpen(false); setNotice('Konfigurasi chat disimpan.'); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const dispatchChatMessage = async ({ session, content, files = [], kind = '' }) => {
    let current = session;
    setBusy(true);
    try {
      await api(`/chat/sessions/${current.id}/processing-access`, { method: 'POST', body: {} });
      await refreshSession();
      if (files.length) current = await uploadFiles(current, files, kind, false);
      const data = await api(`/chat/sessions/${current.id}/messages`, {
        method: 'POST',
        body: { content, aiMode, allowExternalAi: prefs.allowExternalAi !== false },
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
      appendAssistantMessage(err.message);
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
          lecturerName: identity.lecturerName.trim(),
          lecturerNip: identity.lecturerNip.trim(),
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
    if (!input.trim() && !pendingLandingFiles.length) return;
    let current = active;
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
    if (!current) current = await createSession(false);
    if (!current) return;
    const content = input.trim() || 'Saya sudah menambahkan bahan untuk laprak ini.';
    const files = [...pendingLandingFiles];
    if (!identityComplete) {
      setInput('');
      setPendingLandingFiles([]);
      setIdentityIntake({ session: current, content, files, kind: attachmentKind });
      return;
    }
    await dispatchChatMessage({ session: current, content, files, kind: attachmentKind });
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
  const createDocument = async (sessionOverride = null) => {
    const targetSession = sessionOverride?.id ? sessionOverride : active;
    if (!targetSession) return;
    let stage = 'create';
    setBusy(true);
    try {
      const out = await api(`/chat/sessions/${targetSession.id}/document`, { method: 'POST' });
      setDocumentState(out.document);
      const refreshed = await api(`/chat/sessions/${targetSession.id}`);
      hydrate(refreshed);
      stage = 'analyze';
      const analysis = await api(`/documents/${out.document.id}/analyze`, { method: 'POST' });
      setActiveJob({ id: analysis.jobId, type: 'analyze', status: 'queued', progress: 0, message: 'Membaca bahan', timeline: [] });
      const analysisJob = await waitForJob(analysis.jobId);
      if (analysisJob.status !== 'completed') throw new Error(analysisJob.errorMessage || 'Bahan belum berhasil dianalisis.');
      stage = 'generate';
      const generation = await api(`/documents/${out.document.id}/generate`, { method: 'POST' });
      setActiveJob({ id: generation.jobId, type: 'generate', status: 'queued', progress: 0, message: 'Menyusun laporan', timeline: [] });
      const generationJob = await waitForJob(generation.jobId);
      if (generationJob.status !== 'completed') throw new Error(generationJob.errorMessage || 'Draft belum berhasil disusun.');
      const nextDocument = await api(`/documents/${out.document.id}`);
      setDocumentState(nextDocument);
      setActiveJob(nextDocument.jobs?.find((item) => item.id === generationJob.id) || generationJob);
      const readyState = await api(`/chat/sessions/${targetSession.id}/actions`, {
        method: 'POST',
        body: {
          idempotencyKey: `document-ready-${out.document.id}-${generationJob.id}`,
          type: 'DOCUMENT_READY',
          payload: {},
        },
      });
      hydrate(readyState);
      await loadDocuments();
    } catch (err) {
      if (stage === 'generate' && targetSession?.id) {
        try { hydrate(await api(`/chat/sessions/${targetSession.id}`)); } catch { appendAssistantMessage(err.message); }
      } else {
        appendAssistantMessage(err.message);
      }
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
    if (action === 'export') {
      const confirmed = await showDialog({ kind: 'confirm', title: 'Sudah cek draft?', message: 'Pastikan isi, angka, bukti, nama, NIM, dan kelas sudah benar. DOCX dibuat setelah konfirmasi ini.', confirmLabel: 'Sudah, export' });
      if (!confirmed) return;
    }
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
      if (action === 'analyze') appendAssistantMessage('Bahan selesai dibaca. Struktur dokumen kerja sudah diperbarui dan siap disusun.');
      if (action === 'export') setNotice('DOCX siap diunduh.');
      return true;
    } catch (err) {
      if (['generate', 'revise'].includes(action) && active?.id) {
        try { hydrate(await api(`/chat/sessions/${active.id}`)); } catch { appendAssistantMessage(err.message); }
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
  const downloadExport = async () => { const exported = documentState?.exports?.find((item) => item.status === 'ready'); if (!exported) return; try { await download(`/exports/${exported.id}/download`, exported.file_name); } catch (err) { setNotice(err.message); } };
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
  const hasSubscriptionPlan = ['monthly', 'pro'].includes(billingPlan?.key);
  const isMaxPlan = billingPlan?.key === 'pro';
  const workflowStatusLabel = {
    NEW_CHAT: 'Percakapan baru',
    SOURCE_RECOMMENDED: 'Menunggu keputusan bahan',
    WAITING_SOURCE_DECISION: 'Menunggu keputusan bahan',
    CLARIFICATION_REQUIRED: 'Menunggu satu klarifikasi',
    READY_TO_GENERATE: 'Siap disusun',
    GENERATING: 'Sedang menyusun',
    DOCUMENT_PREVIEW: 'Siap direview',
    REVISION: 'Sedang direvisi',
    QUIZ_REQUIRED: 'Cek pemahaman diperlukan',
    EXPORT_UNLOCKED: 'Download terbuka',
    FINAL: 'Selesai',
  }[workflow?.state] || 'Workspace laprak';
  const headerSubtitle = active
    ? [workflow?.courseName || active.configuration?.courseName, workflow?.practiceTopic || active.configuration?.moduleTitle, user.studyProgramName || activeProgram?.label, workflowStatusLabel].filter(Boolean).join(' ? ')
    : 'Mulai dengan teks, bahan, atau link yang kamu punya.';
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
  return <div className={`workspace ${leftCollapsed ? 'left-collapsed' : ''} ${rightOpen && page === 'chat' ? 'right-open' : ''} ${documentOpen && page === 'chat' ? 'document-open' : ''} ${resolvedTheme === 'dark' ? 'theme-dark' : ''} ${prefs.compact ? 'compact' : ''}`} data-motion={prefs.reducedMotion ? 'reduce' : 'full'} data-accent={workspaceAccent.key} data-contrast={prefs.contrast || 'default'} data-language={prefs.language || 'id'} style={{ '--workspace-orange': workspaceAccent.color, '--workspace-accent': workspaceAccent.color, '--workspace-accent-contrast': workspaceAccent.contrast }}>
    <aside className="left-sidebar">
      <div className="sidebar-top">
        <Link to="/app" className="workspace-brand"><BrandMark /><b>Laprakin</b></Link>
        <IconButton className="sidebar-collapse-button" label={leftCollapsed ? 'Buka sidebar' : 'Minimalkan sidebar'} onClick={() => setLeftCollapsed(!leftCollapsed)}>{leftCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</IconButton>
      </div>
      <Button className="new-chat" onClick={startNewChat} disabled={busy}><Plus size={15} /><span>Chat baru</span></Button>
      <nav className="workspace-nav">{navItems.map(({ key, label, icon: Icon }) => <button key={key} className={page === key ? 'active' : ''} onClick={() => setRoute(key)} title={label}><Icon size={16} /><span>{label}</span></button>)}</nav>
      <div className="sidebar-session-scroll">
        {pinnedProjects.length || pinnedSessions.length ? <div className="pinned-session-block">
          <div className="session-section-title"><span>Pinned</span></div>
          {pinnedProjects.map((project) => <button type="button" className="pinned-project-row" key={normalizedCourseKey(project.name)} onClick={() => openProject(project.name)} title={project.name}><FolderKanban size={14}/><span>{project.name}</span><small>{project.count}</small></button>)}
          <div className="session-list"><SessionGroup group="Disematkan" items={pinnedSessions} {...sidebarGroupProps} onDropGroup={(session) => moveSessionToGroup(session, groupLabel(session))} /></div>
        </div> : null}
        <div className={`session-heading ${recentSearchOpen ? 'is-searching' : ''}`}>
          {recentSearchOpen ? <label className="recent-search-field"><Search size={13}/><input autoFocus value={recentSearchQuery} onChange={(event) => setRecentSearchQuery(event.target.value)} placeholder="Cari chat" aria-label="Cari chat terbaru" onKeyDown={(event) => { if (event.key === 'Escape') { setRecentSearchOpen(false); setRecentSearchQuery(''); } }} /><button type="button" aria-label="Tutup pencarian" onClick={() => { setRecentSearchOpen(false); setRecentSearchQuery(''); }}><X size={12}/></button></label> : <><span>Recents</span><button className="recent-search-trigger" type="button" title="Cari chat" aria-label="Cari chat" onClick={() => setRecentSearchOpen(true)}><Search size={13} /></button></>}
        </div>
        <div className="session-list">{recentGroups.map(([group, items]) => <SessionGroup key={normalizedCourseKey(group)} group={group} items={items} {...sidebarGroupProps} onDropGroup={(session) => moveSessionToGroup(session, group)} />)}</div>
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-support-actions">
          <button onClick={() => setModal('help')} title="Bantuan"><HelpCircle size={16} /><span>Bantuan</span></button>
          <button onClick={() => setModal('feedback')} title="Feedback"><MessageCircle size={16} /><span>Feedback</span></button>
          <button onClick={() => setModal('settings')} title="Settings"><Settings2 size={16} /><span>Settings</span></button>
        </div>
        <div className="account-row"><button onClick={() => setAccountOpen(!accountOpen)} title="Menu akun"><span>{userInitials(user)}</span><div><b>{user.fullName || user.email.split('@')[0]}</b><small>{wallet?.balances?.total || 0} laprak tersedia</small></div><ChevronRight size={14} /></button></div>
      </div>
    </aside>
    {accountOpen && <AccountPopover showUpgrade={!isMaxPlan} onClose={() => setAccountOpen(false)} onOpen={(target) => { setAccountOpen(false); if (target === 'billing') navigate('/pricing'); else setModal(target); }} onLogout={logout} />}
    {!leftCollapsed && <button className="mobile-scrim" aria-label="Tutup navigasi" onClick={() => setLeftCollapsed(true)} />}
    <IconButton className="mobile-nav-toggle" label="Buka navigasi" onClick={() => setLeftCollapsed(false)}><Menu size={17} /></IconButton>
    <main className="workspace-main">
      {page === 'chat' && <>
        <header className="workspace-header"><div className={`header-title ${active ? '' : 'is-empty'}`}><b>{active?.title || 'Chat Laprakin'}</b><small>{headerSubtitle}</small></div>{!hasSubscriptionPlan && <button className="workspace-plan" onClick={() => navigate('/pricing')} title="Buka billing"><span>{workspacePlanLabel}</span><i>?</i><b>Upgrade</b></button>}<div className="header-actions"><button className={`header-config-button ${rightOpen ? 'active' : ''}`} onClick={() => { setDocumentOpen(false); setRightOpen((value) => !value); }}><SlidersHorizontal size={15} /><span>Konfigurasi</span></button><IconButton label="Buka tutorial" className="tutorial-button" onClick={() => { setTutorialFirstUse(false); setTutorialOpen(true); }}><HelpCircle size={16} /></IconButton><IconButton label={prefs.theme === 'system' ? 'Tema mengikuti sistem' : resolvedTheme === 'dark' ? 'Gunakan mode terang' : 'Gunakan dark mode'} className="theme-button" onClick={() => setPrefs((value) => ({ ...value, theme: value.theme === 'system' ? (resolvedTheme === 'dark' ? 'light' : 'dark') : value.theme === 'dark' ? 'light' : 'system' }))}>{prefs.theme === 'system' ? <Monitor size={16} /> : resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</IconButton><IconButton label="Notifikasi" onClick={() => setModal('notifications')}><Bell size={16} /></IconButton></div></header>
        <ChatSurface active={active} messages={messages} attachments={attachments} documentState={documentState} workflow={workflow} activeJob={activeJob} user={user} input={input} setInput={setInput} busy={busy || actionBusy} attachmentKind={attachmentKind} setAttachmentKind={setAttachmentKind} uploadRef={uploadRef} send={send} upload={upload} removeAttachment={removeAttachment} updateAttachmentCategory={updateAttachmentCategory} createDocument={createDocument} onWorkflowAction={performChatAction} contextOpen={contextOpen} setContextOpen={setContextOpen} config={config} updateConfig={updateConfig} pendingFiles={pendingLandingFiles} onPasteImages={pasteImagesIntoChat} onAddPendingFiles={addPendingFiles} onRemovePending={(index) => setPendingLandingFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))} aiMode={aiMode} setAiMode={setAiMode} aiModeAccess={aiModeAccess} onUpgrade={() => navigate('/pricing')} onOpenDocument={() => { setRightOpen(false); setDocumentOpen(true); }} quizMode={quizMode} onCloseQuiz={() => setQuizMode(false)} onStartQuiz={startDocumentQuiz} onSubmitQuiz={submitDocumentQuiz} />
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
        : <div className="config-inner"><div className="right-head"><div><b>Konfigurasi chat</b><small>Hanya untuk laprak ini.</small></div><IconButton label="Tutup konfigurasi" onClick={() => setRightOpen(false)}><PanelRightClose size={16} /></IconButton></div>{active ? <><div className="right-body"><label>Nama laprak<input value={config.title} onChange={(event) => updateConfig({ title: event.target.value })} /></label><label>Mata kuliah<input value={config.configuration.courseName} onChange={(event) => updateConfig({ configuration: { courseName: event.target.value } })} placeholder="Opsional" /></label><label>Modul atau konteks<input value={config.configuration.moduleTitle} onChange={(event) => updateConfig({ configuration: { moduleTitle: event.target.value } })} placeholder="Opsional" /></label><label>Dosen pengampu <small>opsional</small><input value={config.configuration.lecturerName || ''} onChange={(event) => updateConfig({ configuration: { lecturerName: event.target.value } })} placeholder="Nama dosen" /></label><label>NIP dosen <small>opsional</small><input value={config.configuration.lecturerNip || ''} onChange={(event) => updateConfig({ configuration: { lecturerNip: event.target.value } })} placeholder="NIP jika ada" /></label><label>Jenis struktur<CustomSelect value={config.configuration.documentProfile} onChange={(value) => updateConfig({ configuration: { documentProfile: value } })} options={[{ value: 'langkah', label: 'Berbasis langkah' }, { value: 'pengujian', label: 'Berbasis pengujian' }, { value: 'proyek', label: 'Berbasis proyek' }]} /></label><div className="structure-choice"><button className={config.structureMode === 'guided' ? 'active' : ''} onClick={() => updateConfig({ structureMode: 'guided' })}><LayoutTemplate size={15} /><span><b>Struktur prodi</b><small>Dipakai otomatis.</small></span></button><button className={config.structureMode === 'custom' ? 'active' : ''} onClick={() => updateConfig({ structureMode: 'custom' })}><SlidersHorizontal size={15} /><span><b>Struktur khusus</b><small>Hanya bila tugas berbeda.</small></span></button></div>{config.structureMode === 'custom' && <label>Susunan bagian<textarea value={config.configuration.customStructure} onChange={(event) => updateConfig({ configuration: { customStructure: event.target.value } })} placeholder="Pendahuluan, hasil, pembahasan, kesimpulan" /></label>}<label>Instruksi tambahan<textarea value={config.configuration.instructions} onChange={(event) => updateConfig({ configuration: { instructions: event.target.value } })} placeholder="Contoh: fokus ke analisis hasil." /></label></div><div className="right-foot"><Button onClick={saveConfig} disabled={busy}><Save size={14} />Simpan</Button><small>Jurusan, prodi, gaya penulisan, dan billing ada di Settings. Dark mode bisa diubah dari header workspace.</small></div></> : <div className="empty-config"><PanelRightOpen size={20} /><b>Buat chat laprak dulu.</b><p>Panel ini baru dipakai untuk mengubah konteks tugas yang sedang dibuka.</p></div>}</div>}
    </aside>}
    {['settings','settings-billing','settings-general','settings-personalization','settings-academic','settings-storage','settings-security','settings-archived'].includes(modal) && <SettingsModal initialTab={modal === 'settings-billing' ? 'billing' : modal === 'settings-general' ? 'general' : modal === 'settings-personalization' ? 'personalization' : modal === 'settings-academic' ? 'academic' : modal === 'settings-storage' ? 'storage' : modal === 'settings-security' ? 'security' : modal === 'settings-archived' ? 'archived' : 'general'} onClose={() => setModal(null)} onSaved={refreshSession} onArchivedChanged={loadSessions} onOpenBilling={() => { setModal(null); navigate('/pricing'); }} prefs={prefs} setPrefs={setPrefs} />}{modal === 'help' && <HelpModal onClose={() => setModal(null)} />}{modal === 'feedback' && <FeedbackModal onClose={() => setModal(null)} />}{modal === 'notifications' && <NotificationModal onClose={() => setModal(null)} />}{identityIntake && <IdentityIntakeModal user={user} busy={busy} onSave={completeIdentityIntake} onBack={() => setIdentityIntake(null)} />}{tutorialOpen && <WorkspaceTutorial onClose={closeTutorial} />}{productUpdate && <ProductUpdatePopup update={productUpdate} onReceipt={recordProductUpdate} onClose={closeProductUpdate} />}
  </div>;
}

function AccountPopover({ onOpen, onLogout, onClose, showUpgrade = true }) {
  const { user, setNotice } = useApp();
  const ref = useRef(null);
  useEffect(() => {
    const closeOutside = (event) => { if (ref.current && !ref.current.contains(event.target)) onClose?.(); };
    window.addEventListener('mousedown', closeOutside);
    return () => window.removeEventListener('mousedown', closeOutside);
  }, [onClose]);
  const copyReferral = async () => {
    const code = user?.referralCode || '';
    if (!code) return setNotice('Kode referral belum tersedia.');
    try {
      await navigator.clipboard?.writeText(code);
      setNotice('Kode referral disalin. Bonus aktif jika teman belanja minimal Rp29.900 atau subscribe Pro.');
    } catch {
      setNotice(`Kode referral: ${code}. Bonus aktif jika teman belanja minimal Rp29.900 atau subscribe Pro.`);
    }
  };
  return <div ref={ref} className="account-popover account-popover-fixed" onMouseDown={(event) => event.stopPropagation()}><div className="account-popover-head"><span className="account-popover-avatar" aria-hidden="true">{userInitials(user)}</span><div><b>{user?.fullName || 'Akun Laprakin'}</b><small>Workspace pribadi</small></div></div><div className="account-popover-divider" />{showUpgrade && <button onClick={() => onOpen('billing')}><Sparkles size={15} />Upgrade plan<ChevronRight size={14} /></button>}<button onClick={copyReferral}><Megaphone size={15} />Referral <small>min. Rp29.900</small></button><button onClick={() => onOpen('settings-personalization')}><Sliders size={15} />Personalisasi</button><button onClick={() => onOpen('settings-academic')}><UserRound size={15} />Jurusan & prodi</button><button onClick={() => onOpen('settings-general')}><Settings2 size={15} />Settings</button><div className="account-popover-divider" /><button onClick={() => onOpen('help')}><HelpCircle size={15} />Help<ChevronRight size={14} /></button><button className="logout-item" onClick={onLogout}><LogOut size={15} />Log out<ChevronRight size={14} /></button></div>;
}

function SessionGroup({ group, items, activeId, page, onOpen, renamingId, setRenamingId, onRename, draggingSession, setDraggingSession, onDropSession, onDropGroup, folders = [], onPin, onMove, onArchive, onDelete }) {
  if (!items.length) return null;
  const isUngrouped = group === 'Belum dikelompokkan';
  const hideGroupLabel = group === 'Disematkan';
  return <section className={`session-group ${hideGroupLabel ? 'pinned-group' : ''} ${isUngrouped ? 'ungrouped-group' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggingSession) onDropGroup(draggingSession); setDraggingSession(null); }}>{!isUngrouped && !hideGroupLabel && <div className="session-group-label"><span>{group}</span><small>{items.length}</small></div>}{items.map((item) => <ChatSessionRow key={item.id} item={item} active={activeId === item.id && page === 'chat'} onOpen={onOpen} editing={renamingId === item.id} setEditing={setRenamingId} onRename={onRename} draggingSession={draggingSession} onDragStart={setDraggingSession} onDropSession={onDropSession} folders={folders} onPin={onPin} onMove={onMove} onArchive={onArchive} onDelete={onDelete} />)}</section>;
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
  return <article className={`session-row ${active ? 'active' : ''}`} draggable={!editing} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; onDragStart(item); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); if (draggingSession && draggingSession.id !== item.id) onDropSession?.(draggingSession, item); }}><div className="session-open" role="button" tabIndex={0} onClick={() => !editing && onOpen(item.id)} onKeyDown={(event) => { if (!editing && (event.key === 'Enter' || event.key === ' ')) onOpen(item.id); }} title={item.title}>{editing ? <form onSubmit={submit} onClick={(event) => event.stopPropagation()}><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setEditing(null); }} onBlur={() => onRename(item.id, title)} /></form> : <span>{item.title || 'Chat baru'}</span>}</div><div className="session-row-actions"><button className="session-menu-trigger" type="button" title="Menu chat" aria-label="Menu chat" onClick={(event) => { event.stopPropagation(); setMenuOpen((open) => !open); setMoveOpen(false); }}><MoreHorizontal size={15}/></button>{menuOpen && <div className="session-menu" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => { setEditing(item.id); setMenuOpen(false); }}><Pencil size={14}/><span>Ubah nama</span></button><div className="session-menu-folder"><button type="button" onClick={() => setMoveOpen((open) => !open)}><FolderOpen size={14}/><span>Pindahkan ke folder</span><ChevronRight size={13}/></button>{moveOpen && <div className="session-submenu">{folders.filter((folder) => normalizedCourseKey(folder) !== normalizedCourseKey(item.course_group)).map((folder) => <button key={folder} type="button" onClick={() => chooseFolder(folder)}>{folder}</button>)}<button type="button" className="new-folder-action" onClick={createFolder}><Plus size={13}/>Folder baru</button></div>}</div><button type="button" onClick={() => { onPin(item, !item.isPinned); setMenuOpen(false); }}>{item.isPinned ? <PinOff size={14}/> : <Pin size={14}/>}<span>{item.isPinned ? 'Lepas pin' : 'Pin chat'}</span></button><button type="button" onClick={() => { onArchive(item); setMenuOpen(false); }}><Archive size={14}/><span>Arsip</span></button><button type="button" className="delete-action" onClick={async () => { setMenuOpen(false); const confirmed = await showDialog({ kind: 'confirm', title: 'Hapus chat?', message: `Chat “${item.title || 'Chat baru'}” akan dihapus permanen dan tidak dapat dipulihkan.`, confirmLabel: 'Hapus', destructive: true }); if (confirmed) await onDelete(item); }}><Trash2 size={14}/><span>Hapus</span></button></div>}</div></article>;
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
  const [form, setForm] = useState({
    fullName: user.fullName || '',
    nim: user.nim || '',
    className: user.className || '',
    institutionName: user.institutionName || '',
    institutionLogoUrl: user.institutionLogoUrl || '',
    facultyName: user.facultyName || '',
    studyProgramName: user.studyProgramName || '',
    lecturerName: user.lecturerName || '',
    lecturerNip: user.lecturerNip || '',
    departmentKey: user.departmentKey || '',
    studyProgramKey: user.studyProgramKey || '',
  });
  const valid = form.fullName.trim().length >= 2
    && form.nim.trim().length >= 3
    && form.className.trim().length >= 1
    && form.institutionName.trim().length >= 2
    && form.facultyName.trim().length >= 2
    && form.studyProgramName.trim().length >= 2;
  const submit = async (event) => { event.preventDefault(); if (valid) await onSave(form); };
  return <div className="identity-intake-overlay" role="dialog" aria-modal="true" aria-labelledby="identity-intake-title">
    <form className="identity-intake-modal" onSubmit={submit}>
      <header><span><UserRound size={17} /></span><div><small>Sekali saja</small><h2 id="identity-intake-title">Lengkapi identitas laprakmu</h2><p>Data ini dipakai untuk cover. Setelah disimpan, pesan yang tadi kamu kirim langsung diproses.</p></div></header>
      <div className="identity-intake-grid">
        <label>Nama lengkap<input autoFocus autoComplete="name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Nama sesuai data kampus" /></label>
        <label>NPM / NIM<input inputMode="numeric" autoComplete="off" value={form.nim} onChange={(event) => setForm({ ...form, nim: event.target.value })} placeholder="Nomor mahasiswa" /></label>
        <label>Kelas<input autoComplete="off" value={form.className} onChange={(event) => setForm({ ...form, className: event.target.value })} placeholder="Contoh: RKS 20C" /></label>
        <label>Univ / institusi<input value={form.institutionName} onChange={(event) => setForm({ ...form, institutionName: event.target.value })} placeholder="Contoh: Politeknik Negeri Cilacap" /></label>
        <label>Logo institusi <small>opsional</small><input value={form.institutionLogoUrl} onChange={(event) => setForm({ ...form, institutionLogoUrl: event.target.value })} placeholder="URL logo kampus" /></label>
        <label>Fakultas / Jurusan<input value={form.facultyName} onChange={(event) => setForm({ ...form, facultyName: event.target.value })} placeholder="Contoh: Jurusan Komputer dan Bisnis" /></label>
        <label>Program studi<input value={form.studyProgramName} onChange={(event) => setForm({ ...form, studyProgramName: event.target.value })} placeholder="Contoh: D4 Rekayasa Keamanan Siber" /></label>
        <label>Dosen pengampu <small>opsional</small><input value={form.lecturerName} onChange={(event) => setForm({ ...form, lecturerName: event.target.value })} placeholder="Nama dosen" /></label>
        <label>NIP dosen <small>opsional</small><input value={form.lecturerNip} onChange={(event) => setForm({ ...form, lecturerNip: event.target.value })} placeholder="NIP jika ada" /></label>
      </div>
      <footer><button type="button" onClick={onBack} disabled={busy}>Kembali edit pesan</button><Button type="submit" disabled={busy || !valid}>{busy ? <LoaderCircle className="spin" size={14} /> : <ArrowRight size={14} />}Simpan & lanjutkan</Button></footer>
    </form>
  </div>;
}
function ChatSurface({ active, messages, attachments, documentState, workflow, activeJob, user, input, setInput, busy, attachmentKind, setAttachmentKind, uploadRef, send, upload, removeAttachment, updateAttachmentCategory, createDocument, onWorkflowAction, contextOpen, setContextOpen, config, updateConfig, pendingFiles, onPasteImages, onAddPendingFiles, onRemovePending, aiMode, setAiMode, aiModeAccess, onUpgrade, onOpenDocument, quizMode = false, onCloseQuiz, onStartQuiz, onSubmitQuiz }) {
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
  const liveJob = ['queued', 'running', 'retry_queued'].includes(activeJob?.status);
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
      {quizMode && documentState ? <div className="quiz-workspace-panel"><header><div><small>Cek pemahaman</small><h2>Jawab quiz singkat sebelum download</h2><p>Soal diambil dari laprak yang sedang kamu preview. Minimal benar 70%.</p></div><button type="button" onClick={onCloseQuiz}>Kembali ke chat</button></header><DocumentQuiz access={documentState.quizAccess} busy={busy} onStart={onStartQuiz} onSubmit={onSubmitQuiz} /></div> : blankChat ? <div className="chat-welcome chat-welcome-minimal"><h1 className={greetingClass}>mau <em>laprakin</em> apa hari ini, {greetingName}?</h1></div> : <div className="thread-content">
      {visibleMessages.map((message) => <Fragment key={message.id}>
        {message.role === 'user' && attachmentBuckets.get(message.id)?.length ? <SourceBar compact attachments={attachmentBuckets.get(message.id)} onOpen={setPreviewFile} /> : null}
        {message.role === 'assistant' && !message.meta?.isClarification && message.meta?.workPlan?.steps?.length ? <WorkPlanRail
          plan={message.meta.workPlan}
          job={jobForMessage(message)}
          completed
          startedAt={message.meta.thinkingStartedAt}
          finishedAt={message.meta.thinkingFinishedAt || message.created_at}
        /> : null}
        <article className={`message ${message.role}`}><div><p>{message.content}</p>{message.meta?.links?.length ? <div className="link-row">{message.meta.links.map((link) => <a key={link} href={link} target="_blank" rel="noreferrer"><Globe2 size={12} />{new URL(link).hostname}</a>)}</div> : null}</div></article>
        {message.meta?.kind === 'document_ready' ? <DocumentCard documentState={documentState} activeJob={jobForMessage(message)} version={message.meta.documentVersion} onOpen={onOpenDocument} /> : null}
      </Fragment>)}
      {active && visibleMessages.length > 0 && !active.document_id && <ChatBriefPanel config={config} updateConfig={updateConfig} />}
      {contextOpen && <InlineContext config={config} updateConfig={updateConfig} onClose={() => setContextOpen(false)} />}
      {orphanAttachments.length > 0 && <SourceBar compact attachments={orphanAttachments} onOpen={setPreviewFile} />}
      {active?.document_id
        ? <>{busy && !liveJob && <ThinkingRail />}{liveJob && <WorkPlanRail workflow={workflow} job={activeJob || documentState?.jobs?.[0] || null} documentState={documentState} />}{!liveJob && !hasDocumentReadyMessage && <DocumentCard documentState={documentState} activeJob={activeJob} onOpen={onOpenDocument} />}</>
        : !hasEmbeddedPlan && <WorkflowPanel workflow={workflow} busy={busy} onCreate={createDocument} onAction={onWorkflowAction} aiMode={aiMode} />}
      {busy && !active?.document_id && !['queued', 'running', 'retry_queued'].includes(activeJob?.status) && <ThinkingRail />}
    </div>}</div>
    {!quizMode && <Composer input={input} setInput={setInput} busy={busy} attachmentKind={attachmentKind} setAttachmentKind={setAttachmentKind} uploadRef={uploadRef} send={send} upload={upload} centered={blankChat} pendingFiles={pendingFiles} onPasteImages={onPasteImages} onAddPendingFiles={onAddPendingFiles} onRemovePending={onRemovePending} aiMode={aiMode} setAiMode={setAiMode} aiModeAccess={aiModeAccess} onUpgrade={onUpgrade} />}
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
  return <section className={`source-bar ${compact ? 'message-source-bar' : ''}`} aria-label="Bahan terlampir">
    <div className="source-preview-list">{attachments.map((file) => {
      const detectedKind = ['module', 'unknown'].includes(file.kind) ? inferPendingAttachmentKind({ name: file.original_name, type: file.mime_type }) : file.kind;
      return <button type="button" className="source-preview-item" key={file.id} onClick={() => onOpen(file)} title={`Preview ${file.original_name}`}><AttachmentThumbnail file={file} /><span><b>{file.original_name}</b><small>{detectedKind === 'practice_evidence' || detectedKind === 'evidence' ? 'Bukti praktik' : detectedKind === 'module' ? 'Modul' : 'Bahan'}</small></span></button>;
    })}</div>
    {onAdd && <div className="source-bar-actions"><button type="button" onClick={onAdd}><Plus size={13} />Tambah file</button></div>}
  </section>;
}

function PdfAttachmentPreview({ file }) {
  const canvasRef = useRef(null);
  const documentRef = useRef(null);
  const renderRef = useRef(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => { setPageNumber(1); setError(''); }, [file.id]);
  useEffect(() => {
    let disposed = false;
    const render = async () => {
      try {
        const { GlobalWorkerOptions, getDocument: getPdfDocument } = await import('pdfjs-dist/build/pdf.mjs');
        GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        if (!documentRef.current) {
          const task = getPdfDocument({ url: `/api/chat/attachments/${file.id}/file`, withCredentials: true });
          documentRef.current = await task.promise;
        }
        const pdf = documentRef.current;
        if (disposed) return;
        setPageCount(pdf.numPages);
        const page = await pdf.getPage(Math.min(pageNumber, pdf.numPages));
        const canvas = canvasRef.current;
        if (!canvas || disposed) return;
        const viewport = page.getViewport({ scale: 1.55 });
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        renderRef.current?.cancel();
        renderRef.current = page.render({ canvasContext: context, viewport });
        await renderRef.current.promise;
      } catch (previewError) {
        if (!disposed && previewError?.name !== 'RenderingCancelledException') setError('PDF tidak dapat ditampilkan.');
      }
    };
    render();
    return () => { disposed = true; try { renderRef.current?.cancel(); } catch {} };
  }, [file.id, pageNumber]);
  useEffect(() => () => { documentRef.current?.destroy(); documentRef.current = null; }, [file.id]);
  return <div className="attachment-pdf-preview">
    {error ? <div className="attachment-preview-error"><CircleAlert size={17}/>{error}</div> : <canvas ref={canvasRef} />}
    {pageCount > 1 && <div className="attachment-page-controls"><button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber((value) => value - 1)}><ArrowLeft size={14}/>Sebelumnya</button><span>Halaman {pageNumber} dari {pageCount}</span><button type="button" disabled={pageNumber >= pageCount} onClick={() => setPageNumber((value) => value + 1)}>Berikutnya<ArrowRight size={14}/></button></div>}
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
  if (workflow.state === 'ANALYZING_INPUT') return <section className="work-plan-reading" aria-live="polite"><LoaderCircle className="spin" size={16} /><div><b>Membaca bahan yang kamu kirim</b><small>File sedang diperiksa sebelum alur kerja disusun.</small></div></section>;
  if (workflow.state !== 'READY_TO_GENERATE') return null;
  return <section className="work-plan-ready" aria-label="Alur kerja Laprak">
    <WorkPlanRail workflow={workflow} />
    {!busy && <div className="work-plan-start"><span>{workflow.practiceTopic ? `${workflow.courseName} · ${workflow.practiceTopic}` : workflow.courseName}</span><Button onClick={onCreate}><Sparkles size={15} />Mulai susun</Button></div>}
  </section>;
}

function ClarificationCard({ workflow, busy, onAction }) {
  const [courseName, setCourseName] = useState(workflow.courseName || '');
  const [practiceTopic, setPracticeTopic] = useState(workflow.practiceTopic || '');
  const valid = Boolean(courseName.trim());
  const submit = (event) => {
    event.preventDefault();
    if (!valid) return;
    onAction('SUBMIT_CLARIFICATION', { courseName: courseName.trim(), practiceTopic: practiceTopic.trim(), documentType: workflow.documentType || 'lab_report' });
  };
  return <form className="clarification-inline" onSubmit={submit}>
    <div className="clarification-inline-copy"><span><LoaderCircle className={busy ? 'spin' : ''} size={15} /></span><div><small>{workflow.attachmentsCount ? `Membaca ${workflow.attachmentsCount} bahan` : 'Menyiapkan konteks Laprak'}</small><b>Tambahkan mata kuliah sebelum alur kerja ditampilkan.</b></div></div>
    <div className="clarification-fields">
      <label>Mata kuliah<input autoFocus value={courseName} onChange={(event) => setCourseName(event.target.value)} placeholder="Contoh: Jaringan Komputer" /></label>
      <label>Judul materi <small>Opsional</small><input value={practiceTopic} onChange={(event) => setPracticeTopic(event.target.value)} placeholder="Contoh: Routing Statis" /></label>
      <Button type="submit" disabled={busy || !valid}>{busy ? <LoaderCircle className="spin" size={14} /> : <ArrowRight size={14} />}Lanjutkan</Button>
    </div>
  </form>;
}

function ThinkingRail() {
  return <section className="work-plan-rail work-plan-pending" aria-live="polite"><div className="work-plan-toggle"><b>Sedang berfikir</b><LoaderCircle className="spin" size={14}/></div></section>;
}

function WorkPlanRail({ workflow, job = null, documentState = null, plan: planOverride = null, completed = false, startedAt: startedAtOverride = '', finishedAt: finishedAtOverride = '' }) {
  const plan = planOverride || workflow?.workPlan || {};
  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  const jobLive = ['queued', 'running', 'retry_queued'].includes(job?.status);
  const generated = completed || !jobLive && (documentState?.status === 'generated' || job?.status === 'completed' && job?.type === 'generate');
  const [expanded, setExpanded] = useState(!generated);
  useEffect(() => { if (generated) setExpanded(false); }, [generated]);
  if (!steps.length) return null;
  const failed = ['failed', 'canceled'].includes(job?.status);
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
    <button type="button" className="work-plan-toggle" onClick={() => setExpanded((value) => !value)}><b>{generated ? `Berfikir selama ${durationLabel}` : 'Sedang berfikir'}</b>{expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button>
    {expanded && <ol>{visibleSteps.map((step, index) => {
      const done = index < completedCount;
      const current = index === completedCount && completedCount < steps.length;
      return <li key={step.id || `${step.title}-${index}`} className={`${done ? 'done' : ''} ${current ? 'current' : ''} ${current && failed ? 'failed' : ''}`}>
        <span>{done ? <Check size={12} /> : current && !failed ? <LoaderCircle className="spin" size={12} /> : index + 1}</span>
        <div><b>{step.title}</b><small>{current && job?.message ? job.message : step.detail}</small></div>
      </li>;
    })}</ol>}
    {expanded && failed && job?.errorMessage && <p className="work-plan-error">{job.errorMessage}</p>}
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

function Composer({ input, setInput, busy, attachmentKind, setAttachmentKind, uploadRef, send, upload, centered, pendingFiles = [], onPasteImages, onRemovePending, aiMode, setAiMode, aiModeAccess, onUpgrade }) {
  const shortcutItems = [
    { key: 'laprak', label: 'Laprak', icon: FileText, prompt: 'Buatkan saya laprak untuk mata kuliah [nama mata kuliah], dengan materi [topik praktikum].' },
    { key: 'proposal', label: 'Proposal', icon: LayoutTemplate, prompt: 'Bantu saya menyusun proposal tentang [topik] berdasarkan ketentuan berikut: ' },
    { key: 'makalah', label: 'Makalah', icon: GraduationCap, prompt: 'Bantu saya menyusun makalah untuk mata kuliah [nama mata kuliah], dengan topik [topik].' },
    { key: 'tugas-akhir', label: 'Tugas akhir', icon: ClipboardList, prompt: 'Bantu saya mengerjakan bagian [nama bagian] tugas akhir berdasarkan arahan dan sumber berikut: ' },
    { key: 'jurnal', label: 'Jurnal', icon: Pencil, prompt: 'Bantu saya menyusun artikel jurnal dari data dan tujuan penelitian berikut: ' },
  ];
  const placeholder = centered ? 'Ceritakan tugas yang ingin kamu susun...' : (pendingFiles.length ? 'Tambahkan pesan untuk bahan ini...' : 'Tulis tugasmu, tempel link, atau paste gambar...');
  return <div className={`composer-zone ${centered ? 'composer-centered composer-claude' : ''}`}>
    {pendingFiles.length ? <div className="pending-files">{pendingFiles.map((file, index) => <PendingAttachmentChip file={file} index={index} key={`${file.name}-${index}`} onRemove={onRemovePending} />)}</div> : null}
    <form className={`composer ${centered ? 'composer-style-reference' : ''}`} onSubmit={send}>
      <textarea rows="1" value={input} onChange={(event) => setInput(event.target.value)} onPaste={onPasteImages} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(event); } }} placeholder={placeholder} />
      <div className="composer-bottom-row">
        <div className="composer-left">
          <CustomSelect className="composer-select" value={attachmentKind} onChange={setAttachmentKind} ariaLabel="Jenis bahan" options={[{ value: '', label: 'Deteksi otomatis' }, { value: 'module', label: 'Modul' }, { value: 'instruction', label: 'Instruksi' }, { value: 'practice_evidence', label: 'Bukti praktik' }, { value: 'template', label: 'Template' }, { value: 'supporting_document', label: 'Dokumen pendukung' }]} />
          <button type="button" className="attach-button" onClick={() => uploadRef.current?.click()} title="Tambah bahan"><Plus size={18} /></button>
          <input ref={uploadRef} hidden type="file" multiple accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.png,.jpg,.jpeg,.webp" onChange={upload} />
        </div>
        <div className="composer-actions">
          <AiModeMenu value={aiMode} onChange={setAiMode} access={aiModeAccess} onUpgrade={onUpgrade} />
          <button type="button" className="composer-utility-button" aria-label="Voice input"><Mic size={16} /></button>
          <button className="send-button" type="submit" disabled={busy || (!input.trim() && !pendingFiles.length)} aria-label="Kirim pesan"><Send size={17} /></button>
        </div>
      </div>
    </form>
    {centered ? <div className="composer-shortcuts" aria-label="Pilih jenis dokumen">{shortcutItems.map((item) => { const Icon = item.icon; return <button key={item.key} type="button" className="composer-shortcut" onClick={() => setInput(item.prompt)}><Icon size={14} /><span>{item.label}</span></button>; })}</div> : null}
    {!centered ? <small>Enter untuk kirim · Shift + Enter untuk baris baru · file hanya terlihat di akunmu</small> : null}
  </div>;
}

function ChatBriefPanel({ config, updateConfig }) {
  return <form className="chat-brief-panel" onSubmit={(event) => event.preventDefault()}>
    <div><small>Brief laprak</small><b>Lengkapi jika ada yang belum ketangkap</b></div>
    <label>Mata kuliah<input value={config.configuration.courseName || ''} onChange={(event) => updateConfig({ configuration: { courseName: event.target.value } })} placeholder="Contoh: Administrasi Jaringan Komputer" /></label>
    <label>Judul modul<input value={config.configuration.moduleTitle || ''} onChange={(event) => updateConfig({ configuration: { moduleTitle: event.target.value } })} placeholder="Contoh: Dynamic Host Configuration Protocol" /></label>
    <label>Dosen <small>opsional</small><input value={config.configuration.lecturerName || ''} onChange={(event) => updateConfig({ configuration: { lecturerName: event.target.value } })} placeholder="Nama dosen" /></label>
    <label>NIP <small>opsional</small><input value={config.configuration.lecturerNip || ''} onChange={(event) => updateConfig({ configuration: { lecturerNip: event.target.value } })} placeholder="NIP dosen" /></label>
  </form>;
}

function InlineContext({ config, updateConfig, onClose }) {
  return <form className="inline-context" onSubmit={(event) => { event.preventDefault(); onClose(); }}><div className="context-title"><div><b>Konteks laprak</b><p>Isi seperlunya agar bahan lebih mudah dibaca.</p></div><button type="button" onClick={onClose} aria-label="Tutup form konteks"><X size={14} /></button></div><div className="context-fields"><label>Mata kuliah<input value={config.configuration.courseName} onChange={(event) => updateConfig({ configuration: { courseName: event.target.value } })} placeholder="Jaringan Komputer" /></label><label>Judul materi <small>Opsional</small><input value={config.configuration.moduleTitle} onChange={(event) => updateConfig({ configuration: { moduleTitle: event.target.value } })} placeholder="Routing Protocol" /></label><Button type="submit" variant="secondary">Simpan</Button></div></form>;
}

function ReportPreview({ documentState, user, embedded = false }) {
  const [open, setOpen] = useState(true);
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
        <img className="report-cover-logo" src="/pnc-logo.png" alt="Politeknik Negeri Cilacap" />
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
    return <section className="quiz-gate quiz-passed"><span><CheckCircle2 size={18} /></span><div><small>Quiz selesai</small><b>Download sudah terbuka</b><p>Nilai terakhir {access.latestScore}% · minimum {access.passScore}%.</p></div></section>;
  }
  if (!attempt) {
    return <section className="quiz-gate">
      <div><small>{access?.subscriptionBypass ? 'Opsional untuk paket berlangganan' : 'Sebelum download'}</small><h3>Quiz singkat dari laprakmu</h3><p>{access?.attemptCount ? `Nilai terakhir ${access.latestScore}%. Soal berikutnya akan diacak ulang.` : 'Pertanyaan mudah dengan jawaban singkat dari isi laporan.'}</p></div>
      <Button onClick={begin} disabled={busy}><Sparkles size={14} />{access?.attemptCount ? 'Coba lagi' : 'Mulai quiz'}</Button>
    </section>;
  }
  if (result) {
    return <section className={`quiz-result ${result.passed ? 'passed' : 'failed'}`}>
      <div className="quiz-result-score"><span>{result.score}</span><small>/ 100</small></div>
      <div><small>{result.passed ? 'Lulus' : 'Belum lulus'}</small><h3>{result.passed ? 'Download sudah terbuka' : `Butuh minimal ${result.passScore}%`}</h3><p>{result.passed ? 'Kamu bisa membuat dan mengunduh file Word dari versi laporan ini.' : 'Coba lagi. Urutan dan pilihan soal akan diacak dari materi yang sama.'}</p></div>
      {!result.passed && <Button onClick={begin} disabled={busy}><RefreshCw size={14} />Soal baru</Button>}
    </section>;
  }
  const question = attempt.questions[questionIndex];
  const selected = answers[question.id];
  const isLast = questionIndex === attempt.questions.length - 1;
  return <section className="quiz-player">
    <header><span>Quiz laprak</span><b>{questionIndex + 1} / {attempt.questions.length}</b><div><i style={{ width: `${((questionIndex + 1) / attempt.questions.length) * 100}%` }} /></div></header>
    <article className="quiz-question-card"><small>{question.sectionTitle}</small><h3>{question.question}</h3></article>
    <div className="quiz-options">{question.options.map((option, index) => <button type="button" key={`${question.id}-${index}`} className={`quiz-option quiz-option-${index} ${selected === index ? 'selected' : ''}`} onClick={() => setAnswers((value) => ({ ...value, [question.id]: index }))}><span>{String.fromCharCode(65 + index)}</span><b>{option}</b></button>)}</div>
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
    <div className="document-card-copy"><b>{documentState.title}</b><small>{liveJob ? latestJob.message || 'Sedang menyusun' : isGenerated ? `Dokumen Word · Versi ${Number(version || Number(documentState.revision_count || 0) + 1)}` : 'Dokumen kerja'}</small></div>
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
  const liveJob = ['queued', 'running', 'retry_queued'].includes(latestJob?.status);
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
        {exported && canDownload ? <button type="button" onClick={onDownload}><ArrowDownToLine size={15} />Unduh</button> : isGenerated ? <button type="button" disabled={busy} onClick={() => canDownload ? onAction('export') : onStartQuiz()}><ArrowDownToLine size={15} />Unduh</button> : null}
        <IconButton label="Tutup dokumen" onClick={onClose}><X size={17} /></IconButton>
      </div>
    </header>
    <div className="document-side-scroll">
      <div className="document-version-rail">
        <span><small>Versi dokumen</small><b>{versionOptions.find((option) => option.value === selectedVersion)?.label || versionOptions[0].label}</b></span>
        <CustomSelect className="document-version-select" value={selectedVersion} onChange={chooseVersion} ariaLabel="Pilih versi dokumen" options={versionOptions} />
      </div>
      {!isGenerated && !liveJob && !busy && <div className="document-recovery"><p>Proses belum selesai. Lanjutkan dari tahap terakhir.</p><button disabled={busy} onClick={() => onAction(documentState.status === 'analyzed' ? 'generate' : 'analyze')}>{documentState.status === 'analyzed' ? 'Susun draft' : 'Baca ulang bahan'}</button></div>}
      {isGenerated && <>
        <RenderedDocxPreview documentId={documentState.id} revision={documentState.revision_count || 0} />
        <div className="revision-chat-note"><MessageCircle size={16} /><div><b>Sudah lengkap atau perlu revisi?</b><p>Tulis perubahan di chat utama. Bagian lain akan tetap dipertahankan.</p></div></div>
      </>}
    </div>
  </div>;
}

function DocumentLibrary({ documents, onRefresh, onOpen }) { const [query, setQuery] = useState(''); const visible = documents.filter((doc) => `${doc.title} ${doc.course_name} ${doc.module_title}`.toLowerCase().includes(query.toLowerCase())); return <section className="library-page"><header><div><h1>Dokumen</h1><p>Laprak yang dibuat dari percakapanmu.</p></div><button onClick={onRefresh}>Refresh</button></header><label className="search-field"><FolderOpen size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari judul, mata kuliah, atau modul" /></label><div className="library-list">{visible.length ? visible.map((doc) => <article key={doc.id}><div><span className="doc-file"><FileText size={16} /></span><div><b>{doc.title}</b><small>{doc.course_name || 'Mata kuliah belum diisi'} · {doc.status === 'generated' ? 'Draft siap cek' : doc.status === 'analyzed' ? 'Siap disusun' : 'Menunggu analisis'}</small></div></div><button onClick={() => onOpen(doc)}>Buka chat <ArrowRight size={13} /></button></article>) : <div className="empty-library"><FolderOpen size={22} /><b>Belum ada dokumen.</b><p>Buat chat laprak, lalu pilih “Buat laprak” saat konteksnya sudah cukup.</p></div>}</div></section>; }

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
    <div className="projects-table">{visibleProjects.length ? visibleProjects.map((project) => <article key={project.name} className="project-row"><button type="button" className="project-row-open" onClick={() => onOpenProject(project.name)}><span className="project-row-icon"><FolderKanban size={18}/></span><span className="project-row-copy"><b>{project.name}</b><small>{project.count} chat</small></span><span className="project-row-date">{formatDate(project.updatedAt)}</span></button><button type="button" className={`project-pin-button ${project.isPinned ? 'active' : ''}`} onClick={() => onPinProject(project, !project.isPinned)} aria-label={project.isPinned ? `Lepas pin ${project.name}` : `Pin ${project.name}`} title={project.isPinned ? 'Lepas pin project' : 'Pin project'}>{project.isPinned ? <PinOff size={16}/> : <Pin size={16}/>}</button></article>) : <div className="projects-empty"><FolderKanban size={26}/><b>Belum ada project.</b><p>Buat project pertamamu untuk mengelompokkan chat dan dokumen.</p><Button onClick={onCreate}><Plus size={14}/>Project baru</Button></div>}</div>
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

function SettingsModal({ onClose, onSaved, onArchivedChanged, onOpenBilling, prefs, setPrefs, initialTab = 'general' }) {
  const { user, setNotice, refreshSession, showDialog } = useApp();
  const [tab, setTab] = useState(initialTab);
  const [form, setForm] = useState({ nickname: user.nickname || '', fullName: user.fullName || '', nim: user.nim || '', className: user.className || '', institutionName: user.institutionName || '', institutionLogoUrl: user.institutionLogoUrl || '', facultyName: user.facultyName || '', studyProgramName: user.studyProgramName || '', lecturerName: user.lecturerName || '', lecturerNip: user.lecturerNip || '', departmentKey: user.departmentKey || '', studyProgramKey: user.studyProgramKey || '' });
  const [storage, setStorage] = useState(null);
  const [archivedChats, setArchivedChats] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [settingsQuery, setSettingsQuery] = useState('');
  useEffect(() => { api('/storage/summary').then(setStorage).catch(() => {}); }, []);
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
  const saveAcademic = async () => { setBusy(true); try { await api('/profile', { method: 'PUT', body: { fullName: form.fullName, nim: form.nim, className: form.className, institutionName: form.institutionName, institutionLogoUrl: form.institutionLogoUrl, facultyName: form.facultyName, studyProgramName: form.studyProgramName, lecturerName: form.lecturerName, lecturerNip: form.lecturerNip, departmentKey: form.departmentKey, studyProgramKey: form.studyProgramKey } }); await onSaved(); setNotice('Profil akademik disimpan.'); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
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
  const deleteAccount = async () => { if (deleteConfirm !== user.email) return setNotice('Masukkan email akun dengan tepat untuk melanjutkan.'); setBusy(true); try { await api('/me', { method: 'DELETE', body: { confirmation: deleteConfirm } }); clearCsrfToken(); await refreshSession(); onClose(); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const tabs = [
    { key: 'general', label: 'Umum', icon: Settings2, title: 'Tampilan workspace', description: 'Atur tema, kepadatan, bahasa, dan warna aksen.' },
    { key: 'notifications', label: 'Notifikasi', icon: BellRing, title: 'Notifikasi yang berguna', description: 'Pilih kabar yang benar-benar perlu muncul.' },
    { key: 'personalization', label: 'Personalisasi', icon: Sliders, title: 'Cara Laprakin menulis', description: 'Jadikan preferensi ini sebagai titik awal untuk chat baru.' },
    { key: 'billing', label: 'Billing', icon: CreditCard, title: 'Plan dan transaksi', description: 'Lihat status plan, credit, dan histori pembayaran.' },
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
          <section className="settings-group"><div className="settings-group-heading"><b>Appearance</b><small>Perubahan diterapkan langsung.</small></div><Row title="Tema"><ThemePicker value={prefs.theme || 'system'} onChange={(value) => updatePrefs({ theme: value })} /></Row><Row title="Kontras"><CustomSelect value={prefs.contrast || 'default'} onChange={(value) => updatePrefs({ contrast: value })} options={[{ value: 'default', label: 'Default' }, { value: 'high', label: 'Tinggi' }]} /></Row><Row title="Bahasa"><CustomSelect value={prefs.language || 'id'} onChange={(value) => updatePrefs({ language: value })} options={[{ value: 'id', label: 'Bahasa Indonesia' }, { value: 'en', label: 'English' }]} /></Row></section>
          <section className="settings-group accent-settings-group"><div className="settings-group-heading"><b>Warna aksen</b><small>Dipakai untuk tombol utama dan status aktif—bukan seluruh hover.</small></div><AccentPicker value={prefs.accent || 'lime'} onChange={(accent) => updatePrefs({ accent })} /></section>
          <Toggle checked={prefs.compact} onChange={(checked) => updatePrefs({ compact: checked })} title="Workspace ringkas" description="Rapatkan sidebar, toolbar, dan area percakapan." />
        </div>}
        {tab === 'notifications' && <div className="settings-pane"><section className="settings-group"><Toggle checked={prefs.jobNotifications !== false} onChange={(checked) => updatePrefs({ jobNotifications: checked })} title="Proses dokumen" description="Beritahu saat analisis, draft, atau export selesai." /><Toggle checked={prefs.deadlineNotifications !== false} onChange={(checked) => updatePrefs({ deadlineNotifications: checked })} title="Deadline tugas" description="Pengingat ringan untuk dokumen yang memiliki tenggat." /><Toggle checked={prefs.productUpdates !== false} onChange={(checked) => updatePrefs({ productUpdates: checked })} title="Update produk" description="Hanya perubahan fitur beta yang penting." /></section></div>}
        {tab === 'personalization' && <div className="settings-pane"><section className="settings-group nickname-settings"><div className="settings-group-heading"><b>Nama panggilan</b><small>Dipakai hanya untuk menyapamu di halaman chat. Kosongkan untuk memakai nama depan.</small></div><div className="nickname-settings-control"><label><span>Nama panggilan</span><input value={form.nickname} maxLength={20} autoComplete="nickname" onChange={(event) => setForm({ ...form, nickname: event.target.value })} placeholder={userGreetingName({ ...user, nickname: '' })} /></label><small>{form.nickname.length}/20</small><Button type="button" variant="secondary" onClick={saveNickname} disabled={busy}><Save size={14}/>Simpan</Button></div></section><section className="settings-group"><Row title="Gaya bahasa"><CustomSelect value={prefs.tone} onChange={(value) => updatePrefs({ tone: value })} options={[{ value: 'semi-formal', label: 'Semi-formal' }, { value: 'formal', label: 'Formal' }]} /></Row><Row title="Sudut pandang"><CustomSelect value={prefs.perspective} onChange={(value) => updatePrefs({ perspective: value })} options={[{ value: 'saya', label: 'Saya' }, { value: 'kita', label: 'Kita' }, { value: 'impersonal', label: 'Impersonal' }]} /></Row><Row title="Struktur awal"><CustomSelect value={prefs.profile} onChange={(value) => updatePrefs({ profile: value })} options={[{ value: 'langkah', label: 'Berbasis langkah' }, { value: 'pengujian', label: 'Berbasis pengujian' }, { value: 'proyek', label: 'Berbasis proyek' }]} /></Row></section><label className="settings-textarea"><span>Instruksi tambahan</span><small>Dipakai sebagai preferensi, bukan isi otomatis.</small><textarea value={prefs.customInstructions || ''} onChange={(event) => updatePrefs({ customInstructions: event.target.value })} placeholder="Contoh: gunakan bahasa teknis yang ringkas." /></label></div>}
        {tab === 'billing' && <BillingSettingsPane onOpenBilling={onOpenBilling} />}
        {tab === 'data' && <div className="settings-pane"><div className="settings-trust-card"><ShieldCheck size={19}/><div><b>Privat secara default</b><p>Isi chat dan file tidak tampil di dashboard operasional. Akses hanya dilakukan untuk proses yang kamu minta.</p></div></div><section className="settings-group"><Toggle checked={Boolean(prefs.allowExternalAi)} onChange={(checked) => updatePrefs({ allowExternalAi: checked })} title="Izinkan provider AI eksternal" description="Aktif hanya saat provider tersedia dan dibutuhkan untuk permintaanmu." /><Row title="Salinan data" description="Unduh profil, preferensi, dan ringkasan aktivitas akun."><Button variant="secondary" onClick={exportData}><ArrowDownToLine size={14}/>Unduh data</Button></Row></section></div>}
        {tab === 'storage' && <div className="settings-pane">{storage ? <><div className="storage-overview"><div><span>Terpakai</span><b>{formatBytes(storage.usedBytes)}</b><small>dari {formatBytes(storage.limitBytes)}</small></div><strong>{storagePercentage}%</strong></div><div className="storage-meter"><i><em style={{ width: `${storagePercentage}%` }} /></i></div><div className="storage-cards"><span><FolderOpen size={17}/><b>{storage.tier === 'pro' ? 'Pro' : storage.tier === 'subscription' ? 'Subscription' : storage.tier === 'paid' ? 'Satuan' : 'Gratis'}</b><small>{storage.retentionHint}</small></span><span><FileText size={17}/><b>Yang dihitung</b><small>Modul, bukti, template, data, dan export DOCX.</small></span></div></> : <div className="settings-loading-state"><LoaderCircle className="spin" size={16}/>Memuat ringkasan penyimpanan...</div>}<p className="settings-footnote">Chat teks dan preferensi tidak dihitung sebagai penyimpanan file.</p></div>}
        {tab === 'safety' && <div className="settings-pane"><div className="safety-principles"><article><ShieldCheck size={18}/><div><b>Bukti tetap asli</b><p>Laprakin tidak membuat screenshot, data, atau hasil praktikum palsu.</p></div></article><article><FileText size={18}/><div><b>Draft tetap perlu ditinjau</b><p>Kamu memegang keputusan akhir sebelum dokumen diekspor atau dikumpulkan.</p></div></article><article><Eye size={18}/><div><b>Review secara kontekstual</b><p>Sinyal tidak biasa ditinjau sebagai metadata minimum, bukan isi pribadi.</p></div></article></div><div className="settings-info-banner"><CircleAlert size={16}/><p>Satu sinyal tidak menyebabkan pemblokiran otomatis. Jika ada batasan, Laprakin menjelaskan tindakan yang perlu dilakukan.</p></div></div>}
        {tab === 'security' && <div className="settings-pane">
          {String(user.authProvider || 'password').includes('google') && <section className="settings-group"><Row title="Google terhubung" description="Akun Google ini dapat dipakai untuk masuk tanpa kata sandi."><span className="settings-connected-status"><CheckCircle2 size={14}/>Aktif</span></Row></section>}
          <section className="settings-group"><div className="settings-group-heading"><b>{user.authProvider === 'google' ? 'Buat kata sandi Laprakin' : 'Ubah kata sandi'}</b><small>Untuk keamanan, verifikasi dilakukan melalui link yang dikirim ke {user.email}.</small></div><Button type="button" variant="secondary" onClick={requestPasswordChange} disabled={busy}><Mail size={14}/>Kirim link verifikasi</Button></section>
          <section className="settings-group"><Row title="Keluar dari semua perangkat" description="Gunakan setelah login dari perangkat umum."><Button variant="secondary" onClick={logoutAll} disabled={busy}>Akhiri semua sesi</Button></Row></section>
        </div>}
        {tab === 'archived' && <div className="settings-pane"><section className="settings-group archived-chat-settings"><div className="settings-group-heading"><b>Percakapan arsip</b><small>Chat yang dipulihkan akan kembali muncul di sidebar.</small></div>{archivedLoading ? <div className="settings-loading-state"><LoaderCircle className="spin" size={16}/>Memuat chat arsip...</div> : archivedChats.length ? <div className="archived-chat-list">{archivedChats.map((session) => <article key={session.id}><div><b>{session.title || 'Chat baru'}</b><small>{session.course_group || 'Belum dikelompokkan'} · {formatDate(session.archived_at || session.updated_at)}</small></div><Button type="button" variant="secondary" disabled={busy} onClick={() => restoreArchivedChat(session.id)}>Pulihkan</Button></article>)}</div> : <div className="settings-empty-state"><Archive size={18}/><div><b>Belum ada chat diarsipkan</b><p>Chat yang kamu arsipkan dari sidebar akan muncul di sini.</p></div></div>}</section></div>}
        {tab === 'academic' && <div className="settings-pane"><section className="settings-group academic-settings-form academic-settings-wide"><label><span>Nama lengkap</span><input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Nama pada cover" /></label><label><span>NPM / NIM</span><input value={form.nim} onChange={(event) => setForm({ ...form, nim: event.target.value })} placeholder="Nomor mahasiswa" /></label><label><span>Kelas</span><input value={form.className} onChange={(event) => setForm({ ...form, className: event.target.value })} placeholder="Contoh: RKS 20C" /></label><label><span>Univ / institusi</span><input value={form.institutionName} onChange={(event) => setForm({ ...form, institutionName: event.target.value })} placeholder="Nama kampus" /></label><label><span>Logo institusi</span><input value={form.institutionLogoUrl} onChange={(event) => setForm({ ...form, institutionLogoUrl: event.target.value })} placeholder="URL logo kampus" /></label><label><span>Fakultas / Jurusan</span><input value={form.facultyName} onChange={(event) => setForm({ ...form, facultyName: event.target.value })} placeholder="Fakultas atau jurusan" /></label><label><span>Program studi</span><input value={form.studyProgramName} onChange={(event) => setForm({ ...form, studyProgramName: event.target.value })} placeholder="Program studi" /></label><label><span>Dosen pengampu <small>opsional</small></span><input value={form.lecturerName} onChange={(event) => setForm({ ...form, lecturerName: event.target.value })} placeholder="Nama dosen" /></label><label><span>NIP dosen <small>opsional</small></span><input value={form.lecturerNip} onChange={(event) => setForm({ ...form, lecturerNip: event.target.value })} placeholder="NIP jika ada" /></label><Button onClick={saveAcademic} disabled={busy}><Save size={14}/>Simpan profil akademik</Button></section><section className="settings-danger-zone"><div><b>Hapus akun</b><p>Unduh data yang diperlukan terlebih dahulu. Tindakan ini tidak dapat dibatalkan.</p></div><input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} placeholder={user.email} /><Button variant="danger" onClick={deleteAccount} disabled={busy || deleteConfirm !== user.email}>Hapus akun</Button></section></div>}
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

function NotificationModal({ onClose }) { const { setNotice } = useApp(); const [data, setData] = useState({ notifications: [], unread: 0 }); const ref = useRef(null); useEffect(() => { api('/notifications').then(setData).catch((err) => setNotice(err.message)); }, []); useEffect(() => { const closeOutside = (event) => { if (ref.current && !ref.current.contains(event.target)) onClose(); }; window.addEventListener('mousedown', closeOutside); return () => window.removeEventListener('mousedown', closeOutside); }, [onClose]); useEffect(() => { const timer = window.setTimeout(onClose, 5000); return () => window.clearTimeout(timer); }, [onClose]); const markRead = async () => { try { setData(await api('/notifications/read', { method: 'PUT', body: {} })); } catch (err) { setNotice(err.message); } }; return <aside ref={ref} className="notification-popover" role="dialog" aria-label="Notifikasi"><header><div><b>Notifikasi</b><small>{data.unread ? `${data.unread} baru` : 'Semua sudah dibaca'}</small></div><IconButton label="Tutup" onClick={onClose}><X size={16} /></IconButton></header>{data.unread ? <button className="notification-read" onClick={markRead}>Tandai semua dibaca</button> : null}<div className="notification-list">{data.notifications.length ? data.notifications.map((note) => <article key={note.id}><span /><div><b>{note.title}</b><p>{note.body}</p><small>{formatDate(note.created_at)}</small></div></article>) : <p className="muted-note">Belum ada notifikasi.</p>}</div></aside>; }

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
    ['overview', 'Monitoring', LayoutDashboard], ['credits', 'Kredit user', CreditCard], ['alerts', 'Error realtime', BellRing], ['integrations', 'AI & Login', Sparkles], ['updates', 'Updates', BellRing], ['feedback', 'Feedback', MessageSquareText], ['risk', 'Risk review', AlertTriangle], ['cms', 'Landing CMS', Megaphone], ['audit', 'Audit log', ClipboardList], ['retention', 'Retensi', FileCog],
  ];
  const tabGroups = [
    ['Operasional', ['overview', 'credits', 'alerts', 'integrations']],
    ['Konten', ['updates', 'feedback', 'cms']],
    ['Keamanan', ['risk', 'audit', 'retention']],
  ];
  if (!overview || !landing) return <div className="admin-loading-state"><LoaderCircle className="spin" size={20} /><b>Memuat Admin Console…</b><span>Jika data belum masuk, gunakan tombol muat ulang setelah beberapa saat.</span><Button variant="secondary" onClick={load}>Coba muat ulang</Button></div>;
  return <div className={`admin-workspace ${adminTheme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
    <aside className="admin-sidebar"><div className="admin-brand"><BrandMark alt=""/><div><b>Laprakin</b><small>Admin console</small></div></div><nav>{tabGroups.map(([group, keys]) => <div className="admin-nav-group" key={group}><small>{group}</small>{keys.map((key) => { const [, label, Icon] = tabs.find(([tabKey]) => tabKey === key); return <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)} title={label}><Icon size={16} /><span>{label}</span></button>; })}</div>)}</nav><div className="admin-sidebar-foot"><div><span>{(user.email || 'A').slice(0,1).toUpperCase()}</span><small>{user.email}</small></div><button onClick={async () => { await api('/auth/logout', { method: 'POST', body: {} }); await refreshSession(); navigate('/'); }}><LogOut size={15} />Keluar</button></div></aside>
    <main className="admin-main"><header className="admin-header"><div><p>Admin console</p><h1>{tabs.find(([key]) => key === tab)?.[1]}</h1></div><div className="admin-header-actions"><button className="admin-theme-toggle" onClick={() => setAdminTheme((value) => value === 'dark' ? 'light' : 'dark')} title="Ubah tema admin" aria-label="Ubah tema admin">{adminTheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button><button className="admin-refresh" onClick={load}><RefreshCw size={15} /><span>Muat ulang</span></button></div></header>
      {tab === 'overview' && <section className="admin-content"><div className="admin-privacy-note"><ShieldCheck size={17} /><div><b>Privacy-first monitoring</b><span>Hanya metadata operasional. Isi chat, dokumen, file, NIM, IP, fingerprint, prompt, dan output AI tidak ditampilkan.</span></div></div><div className="admin-metric-grid">{[['User aktif',overview.stats.users,Users],['Dokumen aktif',overview.stats.documents,FileText],['Job berjalan',overview.stats.queuedJobs,Activity],['AI call 24j',overview.stats.aiCalls24h,Sparkles],['Token AI 24j',Number(overview.stats.aiTokens24h || 0).toLocaleString('id-ID'),Activity],['Error AI 24j',overview.stats.aiErrors24h,AlertTriangle],['Alert terbuka',overview.stats.openAdminAlerts || 0,BellRing],['Feedback terbuka',overview.stats.openFeedback,MessageCircle],['Risk terbuka',overview.stats.openRiskEvents,AlertTriangle],['Storage',formatBytes(overview.storageBytes),Database]].map(([label,value,Icon]) => <article key={label}><Icon size={16}/><span>{label}</span><b>{value}</b></article>)}</div><div className="admin-grid"><section className="admin-panel"><div className="admin-panel-head"><h2>Aktivitas 7 hari</h2><small>Event agregat</small></div><div className="activity-bars">{overview.dailyActivity?.length ? overview.dailyActivity.map((day) => <div key={day.day}><i style={{height:`${Math.max(8, Math.min(100, day.count * 12))}%`}} /><span>{day.day.slice(5)}</span><b>{day.count}</b></div>) : <p>Belum ada aktivitas.</p>}</div></section><section className="admin-panel"><div className="admin-panel-head"><h2>Job terbaru</h2><small>Tanpa isi dokumen</small></div><div className="admin-list">{overview.jobs?.length ? overview.jobs.map((job) => <article key={job.id}><div><b>{job.job_type}</b><small>{job.message || 'Memproses'}</small></div><span className={`status-${job.status}`}>{job.status}</span></article>) : <p>Belum ada job.</p>}</div></section></div></section>}
      {tab === 'credits' && <section className="admin-content"><div className="admin-grid"><section className="admin-panel admin-credit-panel"><div className="admin-panel-head"><h2>Tambahkan kredit</h2><small>Tercatat di wallet dan audit log</small></div><label>Target<CustomSelect value={creditForm.audience} onChange={(audience) => setCreditForm((value) => ({ ...value, audience }))} options={[{value:'user',label:'Satu user'},{value:'all',label:'Semua user terverifikasi'},{value:'paid',label:'Semua user paid'}]} /></label>{creditForm.audience === 'user' && <label>User<CustomSelect value={creditForm.userId} onChange={(userId) => setCreditForm((value) => ({ ...value, userId }))} options={[{value:'',label:'Pilih user'},...adminUsers.map((item)=>({value:item.id,label:`${item.email} · ${item.credits} kredit`}))]} /></label>}<label>Jumlah<input type="number" min="1" max="100" value={creditForm.amount} onChange={(event) => setCreditForm((value) => ({ ...value, amount: event.target.value }))} /></label><label>Alasan<input maxLength="160" value={creditForm.reason} onChange={(event) => setCreditForm((value) => ({ ...value, reason: event.target.value }))} /></label><Button onClick={grantAdminCredit} disabled={busy || (creditForm.audience === 'user' && !creditForm.userId)}><CreditCard size={14}/>Tambahkan kredit</Button></section><section className="admin-panel"><div className="admin-panel-head"><h2>User terbaru</h2><small>{adminUsers.length} akun</small></div><div className="admin-list admin-user-list">{adminUsers.slice(0,30).map((item)=><article key={item.id}><div><b>{item.fullName || item.email}</b><small>{item.email} · {item.plan}</small></div><span>{item.credits} kredit</span></article>)}</div></section></div></section>}
      {tab === 'alerts' && <section className="admin-content"><div className="admin-panel admin-wide"><div className="admin-panel-head"><h2>Error operasional</h2><small>Diperbarui realtime, tanpa isi dokumen</small></div><div className="admin-list admin-alert-list">{adminAlerts.length ? adminAlerts.map((alert)=><article key={alert.id} className={`admin-alert-${alert.severity}`}><div><b>{alert.summary}</b><small>{alert.userEmail || 'Sistem'} · {alert.kind}{alert.errorCode ? ` · ${alert.errorCode}` : ''} · {formatDate(alert.createdAt)}</small></div><div className="admin-actions"><span className={`status-${alert.status === 'resolved' ? 'completed' : 'failed'}`}>{alert.status}</span><button onClick={()=>updateAdminAlert(alert.id,alert.status === 'open' ? 'resolved' : 'open')}>{alert.status === 'open' ? 'Tandai selesai' : 'Buka lagi'}</button></div></article>) : <p className="empty-admin">Belum ada error operasional.</p>}</div></div></section>}
      {tab === 'integrations' && <section className="admin-content"><div className="admin-privacy-note"><ShieldCheck size={17}/><div><b>Credential tetap di server</b><span>Health check hanya menampilkan status model dan metadata OIDC. API key, client secret, prompt, serta output AI tidak pernah dikirim ke browser.</span></div></div><div className="admin-metric-grid">{[['Call 30 hari',aiUsage?.totals?.calls || 0,Sparkles],['Berhasil',aiUsage?.totals?.successful || 0,CheckCircle2],['Gagal',aiUsage?.totals?.failed || 0,AlertTriangle],['Input token',Number(aiUsage?.totals?.input_tokens || 0).toLocaleString('id-ID'),Activity],['Output token',Number(aiUsage?.totals?.output_tokens || 0).toLocaleString('id-ID'),Activity],['Latency rata-rata',`${aiUsage?.totals?.average_latency_ms || 0} ms`,Activity]].map(([label,value,Icon])=><article key={label}><Icon size={16}/><span>{label}</span><b>{value}</b></article>)}</div><div className="admin-grid"><section className="admin-panel"><div className="admin-panel-head"><h2>Status integrasi</h2><Button variant="secondary" onClick={checkIntegrations} disabled={busy}>{busy ? <LoaderCircle className="spin" size={14}/> : <RefreshCw size={14}/>}Cek sekarang</Button></div><div className="admin-list"><article><div><b>Gemini API</b><small>{integrationStatus?.gemini?.models?.length ? integrationStatus.gemini.models.map((item)=>`${item.model}: ${item.ok?'ready':'gagal'}`).join(' · ') : 'Jalankan pengecekan menggunakan credential server.'}</small></div><span className={integrationStatus?.gemini?.ok?'status-completed':integrationStatus?'status-failed':''}>{integrationStatus?.gemini?.ok?'ready':integrationStatus?'belum siap':'belum dicek'}</span></article><article><div><b>Google Login</b><small>{integrationStatus?.googleOidc?.redirectOrigin || 'Memvalidasi OIDC Discovery, PKCE S256, dan callback origin.'}</small></div><span className={integrationStatus?.googleOidc?.ok?'status-completed':integrationStatus?'status-failed':''}>{integrationStatus?.googleOidc?.ok?'ready':integrationStatus?'belum siap':'belum dicek'}</span></article></div></section><section className="admin-panel"><div className="admin-panel-head"><h2>Pemakaian per model</h2><small>30 hari</small></div><div className="admin-list">{aiUsage?.breakdown?.length?aiUsage.breakdown.slice(0,10).map((item)=><article key={`${item.purpose}-${item.mode}-${item.model}-${item.status}`}><div><b>{item.purpose} · {item.mode}</b><small>{item.model} · {Number(item.total_tokens || 0).toLocaleString('id-ID')} token · {item.average_latency_ms || 0} ms</small></div><span className={`status-${item.status==='success'?'completed':'failed'}`}>{item.calls} call</span></article>):<p>Belum ada pemakaian AI.</p>}</div></section></div></section>}
      {tab === 'integrations' && <section className="admin-content"><div className="admin-panel admin-wide"><div className="admin-panel-head"><h2>Pemakaian AI per user</h2><small>Metadata 30 hari, tanpa prompt dan output</small></div><div className="admin-list admin-user-usage">{aiUsage?.byUser?.length ? aiUsage.byUser.map((item)=><article key={item.userId}><div><b>{item.fullName || item.email}</b><small>{item.email} · {item.errors} error · rata-rata {item.averageLatencyMs} ms</small></div><span>{item.calls} call · {Number(item.totalTokens || 0).toLocaleString('id-ID')} token</span></article>) : <p>Belum ada pemakaian per user.</p>}</div></div></section>}
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
