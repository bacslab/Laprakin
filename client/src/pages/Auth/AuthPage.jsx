import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-react';
import { Link, useLocation, useNavigate } from '../../router';
import { api, setCsrfToken } from '../../api';
import { formatDate } from '../../lib/formatters';
import { useResolvedTheme } from '../../lib/theme';
import { BrandMark } from '../../components/BrandMark';
import GoogleLogo from '../../components/GoogleLogo';
import { useApp } from '../../state/ui-context';

export default function AuthPage() {
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
      : googleStatus === 'restricted'
        ? 'Akses akun atau perangkat ini sedang dibatasi.'
      : '');
  const [restriction, setRestriction] = useState(googleStatus === 'restricted' ? { appealAllowed: true } : null);
  const [appealMessage, setAppealMessage] = useState('');
  const [appealOpen, setAppealOpen] = useState(googleStatus === 'restricted');
  const [success, setSuccess] = useState('');
  const [devToken, setDevToken] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);
  useEffect(() => { api('/meta', { includeCsrf: false }).then((data) => setGoogleEnabled(Boolean(data.features?.googleLoginEnabled))).catch(() => {}); }, []);
  useEffect(() => { if (user?.emailVerified) navigate(destination); }, [user, navigate, destination]);
  useEffect(() => { if (!verifyToken) return; (async () => { setBusy(true); try { const data = await api('/auth/verify', { method: 'POST', body: { token: verifyToken }, includeCsrf: false }); setCsrfToken(data.csrfToken); const nextSession = await refreshSession(); navigate(safeNext || (nextSession?.user?.role === 'admin' ? '/admin' : '/app')); } catch (err) { setError(err.message); } finally { setBusy(false); } })(); }, [verifyToken, navigate, refreshSession, safeNext]);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      if (mode === 'login') { const data = await api('/auth/login', { method: 'POST', body: { email: form.email, password: form.password }, includeCsrf: false }); setCsrfToken(data.csrfToken); const nextSession = await refreshSession(); navigate(safeNext || (nextSession?.user?.role === 'admin' ? '/admin' : '/app')); }
      if (mode === 'register') { const data = await api('/auth/register', { method: 'POST', body: { email: form.email, password: form.password, referralCode: form.referralCode }, includeCsrf: false }); setDevToken(data.developmentVerificationToken || ''); setSuccess('Akun dibuat. Verifikasi email sebelum memakai credit gratis.'); }
      if (mode === 'forgot') { const data = await api('/auth/request-password-reset', { method: 'POST', body: { email: form.email }, includeCsrf: false }); setDevToken(data.developmentResetToken || ''); setSuccess(data.message || 'Link reset telah diproses.'); }
      if (mode === 'reset') { const data = await api('/auth/reset-password', { method: 'POST', body: { token: resetToken || devToken, password: form.newPassword }, includeCsrf: false }); setCsrfToken(data.csrfToken || ''); if (!data.csrfToken) { setSuccess(data.message); setMode('login'); return; } const nextSession = await refreshSession(); navigate(safeNext || (nextSession?.user?.role === 'admin' ? '/admin' : '/app')); }
    } catch (err) {
      setError(err.message);
      if (err.code === 'ACCOUNT_RESTRICTED') { setRestriction(err.payload?.error?.details || { appealAllowed: true }); setAppealOpen(true); }
    } finally { setBusy(false); }
  };
  const submitAppeal = async () => {
    if (!form.email || appealMessage.trim().length < 20) return;
    setBusy(true); setError('');
    try { const data = await api('/auth/appeals', { method: 'POST', body: { email: form.email, message: appealMessage }, includeCsrf: false }); setSuccess(data.message || 'Permohonan appeal telah diterima.'); setAppealOpen(false); setAppealMessage(''); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const verifyDev = async () => { setBusy(true); try { const data = await api('/auth/verify', { method: 'POST', body: { token: devToken }, includeCsrf: false }); setCsrfToken(data.csrfToken); const nextSession = await refreshSession(); navigate(safeNext || (nextSession?.user?.role === 'admin' ? '/admin' : '/app')); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  const info = { login: ['Masuk', 'Lanjutkan chat dan laprak yang sedang kamu kerjakan.'], register: ['Buat akun', 'Credit gratis aktif setelah email terverifikasi.'], forgot: ['Atur ulang akses', 'Masukkan email untuk meminta link reset.'], reset: ['Kata sandi baru', 'Gunakan kata sandi yang belum pernah dipakai.'] }[mode];
  const changeMode = (nextMode) => { setMode(nextMode); setError(''); setSuccess(''); setDevToken(''); };
  const formModes = !['forgot', 'reset'].includes(mode);
  return <div className={`auth-page auth-page-${mode} theme-${authTheme}`}>
    <header className="auth-topbar">
      <Link to="/" className="auth-brand"><BrandMark /><b>laprakin</b><small>BETA</small></Link>
      <Link to="/" className="auth-back-link"><ArrowLeft size={15} />Beranda</Link>
    </header>
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-card-heading"><span className="auth-eyebrow">Workspace akademik</span><h1>{info[0]}</h1><p>{info[1]}</p></div>
        {formModes && <div className="auth-mode-tabs" aria-label="Pilih akses akun"><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>Masuk</button><button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => changeMode('register')}>Daftar</button></div>}
        {googleEnabled && formModes && <><button type="button" className="google-button" onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL || '/api'}/auth/google/start?next=${encodeURIComponent(safeNext || '/app')}`; }}><GoogleLogo /> Lanjutkan dengan Google</button><div className="auth-divider"><span>atau gunakan email</span></div></>}
        {success && <div className="auth-notice success"><CheckCircle2 size={15} />{success}</div>}
        {devToken && mode === 'register' ? <div className="local-verify"><p>Mode lokal: verifikasi tanpa provider email.</p><button type="button" className="auth-submit" onClick={verifyDev} disabled={busy}>Verifikasi sekarang <ArrowRight size={15} /></button></div> : <form onSubmit={submit} className="auth-form">
          {mode !== 'reset' && <label><span>Email</span><input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="nama@email.com" /></label>}
          {['login', 'register'].includes(mode) && <label><span>Kata sandi</span><input type="password" minLength={mode === 'register' ? 12 : 1} maxLength="64" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={mode === 'register' ? 'Minimal 12 karakter' : 'Kata sandi'} /></label>}
          {mode === 'register' && <label><span>Kode referral <small>opsional</small></span><input value={form.referralCode} onChange={(event) => setForm({ ...form, referralCode: event.target.value })} placeholder="R-XXXXXXXX" /></label>}
          {mode === 'reset' && <label><span>Kata sandi baru</span><input type="password" minLength="12" maxLength="64" required value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} placeholder="Minimal 12 karakter" /></label>}
          {error && !restriction?.appealAllowed && <div className="auth-notice error"><CircleAlert size={15} />{error}</div>}
          {restriction?.appealAllowed && <section className="auth-appeal-panel"><div><b>Akses sedang dibatasi</b><p>{restriction.reason || 'Tim Laprakin perlu meninjau aktivitas akun atau perangkat ini.'}</p>{restriction.expiresAt && <small>Berlaku sampai {formatDate(restriction.expiresAt)}.</small>}</div>{!appealOpen ? <button type="button" className="auth-text-button" onClick={() => setAppealOpen(true)}>Ajukan appeal</button> : <><label><span>Penjelasan appeal</span><textarea minLength="20" maxLength="1200" value={appealMessage} onChange={(event) => setAppealMessage(event.target.value)} placeholder="Jelaskan alasan aksesmu perlu ditinjau kembali." /></label><button type="button" className="auth-appeal-submit" disabled={busy || !form.email || appealMessage.trim().length < 20} onClick={submitAppeal}>Kirim appeal</button></>}</section>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy && <LoaderCircle className="spin" size={15} />}{mode === 'login' ? 'Masuk ke workspace' : mode === 'register' ? 'Buat akun' : mode === 'forgot' ? 'Kirim link reset' : 'Simpan kata sandi'} <ArrowRight size={15} /></button>
        </form>}
        <div className="auth-card-footer">{mode === 'login' && <button type="button" className="auth-text-button" onClick={() => changeMode('forgot')}>Lupa kata sandi?</button>}{['forgot', 'reset'].includes(mode) && <button type="button" className="auth-text-button" onClick={() => changeMode('login')}><ArrowLeft size={13} />Kembali ke masuk</button>}</div>
      </section>
      <p className="auth-legal">Dengan melanjutkan, kamu menyetujui <Link to="/terms">Ketentuan Layanan</Link> dan <Link to="/privacy">Kebijakan Privasi</Link> Laprakin.</p>
    </main>
  </div>;
}
