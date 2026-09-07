import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, LoaderCircle } from '../../icons';
import { Link, useLocation, useNavigate } from '../../router';
import { api, setCsrfToken } from '../../api';
import { formatDate } from '../../lib/formatters';
import { useResolvedTheme } from '../../lib/theme';
import { BrandMark } from '../../components/BrandMark';
import GoogleLogo from '../../components/GoogleLogo';
import { useApp } from '../../state/ui-context';
import { useI18n } from '../../i18n/context';

export default function AuthPage() {
  const { user, refreshSession, prefs } = useApp();
  const { language, t } = useI18n();
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
    ? t('auth.googleCancelled')
    : googleStatus === 'failed'
      ? t('auth.googleFailed')
      : googleStatus === 'restricted'
        ? t('auth.googleRestricted')
        : '');
  const [restriction, setRestriction] = useState(googleStatus === 'restricted' ? { appealAllowed: true } : null);
  const [appealMessage, setAppealMessage] = useState('');
  const [appealOpen, setAppealOpen] = useState(googleStatus === 'restricted');
  const [success, setSuccess] = useState('');
  const [devToken, setDevToken] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => { api('/meta', { includeCsrf: false }).then((data) => setGoogleEnabled(Boolean(data.features?.googleLoginEnabled))).catch(() => {}); }, []);
  useEffect(() => { if (user?.emailVerified) navigate(destination); }, [user, navigate, destination]);
  useEffect(() => {
    if (!verifyToken) return;
    (async () => {
      setBusy(true);
      try {
        const data = await api('/auth/verify', { method: 'POST', body: { token: verifyToken }, includeCsrf: false });
        setCsrfToken(data.csrfToken);
        const nextSession = await refreshSession();
        navigate(safeNext || (nextSession?.user?.role === 'admin' ? '/admin' : '/app'));
      } catch (err) { setError(err.message); } finally { setBusy(false); }
    })();
  }, [verifyToken, navigate, refreshSession, safeNext]);

  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      if (mode === 'login') {
        const data = await api('/auth/login', { method: 'POST', body: { email: form.email, password: form.password }, includeCsrf: false });
        setCsrfToken(data.csrfToken);
        const nextSession = await refreshSession();
        navigate(safeNext || (nextSession?.user?.role === 'admin' ? '/admin' : '/app'));
      }
      if (mode === 'register') {
        const data = await api('/auth/register', { method: 'POST', body: { email: form.email, password: form.password, referralCode: form.referralCode }, includeCsrf: false });
        setDevToken(data.developmentVerificationToken || ''); setSuccess(t('auth.registerSuccess'));
      }
      if (mode === 'forgot') {
        const data = await api('/auth/request-password-reset', { method: 'POST', body: { email: form.email }, includeCsrf: false });
        setDevToken(data.developmentResetToken || ''); setSuccess(data.message || t('auth.resetProcessed'));
      }
      if (mode === 'reset') {
        const data = await api('/auth/reset-password', { method: 'POST', body: { token: resetToken || devToken, password: form.newPassword }, includeCsrf: false });
        setCsrfToken(data.csrfToken || '');
        if (!data.csrfToken) { setSuccess(data.message); setMode('login'); return; }
        const nextSession = await refreshSession();
        navigate(safeNext || (nextSession?.user?.role === 'admin' ? '/admin' : '/app'));
      }
    } catch (err) {
      setError(err.message);
      if (err.code === 'ACCOUNT_RESTRICTED') { setRestriction(err.payload?.error?.details || { appealAllowed: true }); setAppealOpen(true); }
    } finally { setBusy(false); }
  };

  const submitAppeal = async () => {
    if (!form.email || appealMessage.trim().length < 20) return;
    setBusy(true); setError('');
    try {
      const data = await api('/auth/appeals', { method: 'POST', body: { email: form.email, message: appealMessage }, includeCsrf: false });
      setSuccess(data.message || t('auth.appealAccepted')); setAppealOpen(false); setAppealMessage('');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const verifyDev = async () => {
    setBusy(true);
    try {
      const data = await api('/auth/verify', { method: 'POST', body: { token: devToken }, includeCsrf: false });
      setCsrfToken(data.csrfToken); const nextSession = await refreshSession();
      navigate(safeNext || (nextSession?.user?.role === 'admin' ? '/admin' : '/app'));
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const info = {
    login: [t('auth.login'), t('auth.loginDescription')],
    register: [t('auth.register'), t('auth.registerDescription')],
    forgot: [t('auth.forgotTitle'), t('auth.forgotDescription')],
    reset: [t('auth.newPassword'), t('auth.resetDescription')],
  }[mode];
  const changeMode = (nextMode) => { setMode(nextMode); setError(''); setSuccess(''); setDevToken(''); };
  const formModes = !['forgot', 'reset'].includes(mode);
  const locale = language === 'en' ? 'en-US' : 'id-ID';

  return <div className={`auth-page auth-page-${mode} theme-${authTheme}`}>
    <header className="auth-topbar">
      <Link to="/" className="auth-brand"><BrandMark /><b>laprakin</b><small>BETA</small></Link>
      <Link to="/" className="auth-back-link"><ArrowLeft size={15} />{t('auth.home')}</Link>
    </header>
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-card-heading"><span className="auth-eyebrow">{t('auth.workspaceEyebrow')}</span><h1>{info[0]}</h1><p>{info[1]}</p></div>
        {formModes && <div className="auth-mode-tabs" aria-label={t('auth.chooseAccess')}><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>{t('auth.login')}</button><button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => changeMode('register')}>{t('auth.register')}</button></div>}
        {googleEnabled && formModes && <><button type="button" className="google-button" onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL || '/api'}/auth/google/start?next=${encodeURIComponent(safeNext || '/app')}`; }}><GoogleLogo /> {t('auth.googleContinue')}</button><div className="auth-divider"><span>{t('auth.orEmail')}</span></div></>}
        {success && <div className="auth-notice success"><CheckCircle2 size={15} />{success}</div>}
        {devToken && mode === 'register' ? <div className="local-verify"><p>{t('auth.localMode')}</p><button type="button" className="auth-submit" onClick={verifyDev} disabled={busy}>{t('auth.verifyNow')} <ArrowRight size={15} /></button></div> : <form onSubmit={submit} className="auth-form">
          {mode !== 'reset' && <label htmlFor="auth-email"><span>{t('auth.email')}</span><input id="auth-email" aria-label={t('auth.email')} type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder={t('auth.emailPlaceholder')} /></label>}
          {['login', 'register'].includes(mode) && <label htmlFor="auth-password"><span>{t('auth.password')}</span><input id="auth-password" aria-label={t('auth.password')} type="password" minLength={mode === 'register' ? 12 : 1} maxLength="64" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={mode === 'register' ? t('auth.newPasswordPlaceholder') : t('auth.passwordPlaceholder')} /></label>}
          {mode === 'register' && <label htmlFor="auth-referral"><span>{t('auth.referralCode')} <small>{t('auth.optional')}</small></span><input id="auth-referral" aria-label={t('auth.referralCode')} value={form.referralCode} onChange={(event) => setForm({ ...form, referralCode: event.target.value })} placeholder={t('auth.referralPlaceholder')} /></label>}
          {mode === 'reset' && <label htmlFor="auth-new-password"><span>{t('auth.newPassword')}</span><input id="auth-new-password" aria-label={t('auth.newPassword')} type="password" minLength="12" maxLength="64" required value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} placeholder={t('auth.newPasswordPlaceholder')} /></label>}
          {error && !restriction?.appealAllowed && <div className="auth-notice error"><CircleAlert size={15} />{error}</div>}
          {restriction?.appealAllowed && <section className="auth-appeal-panel"><div><b>{t('auth.appealRestricted')}</b><p>{restriction.reason || t('auth.appealDefaultReason')}</p>{restriction.expiresAt && <small>{t('auth.appealUntil', { date: formatDate(restriction.expiresAt, locale) })}</small>}</div>{!appealOpen ? <button type="button" className="auth-text-button" onClick={() => setAppealOpen(true)}>{t('auth.appealAction')}</button> : <><label htmlFor="auth-appeal"><span>{t('auth.appealLabel')}</span><textarea id="auth-appeal" aria-label={t('auth.appealLabel')} minLength="20" maxLength="1200" value={appealMessage} onChange={(event) => setAppealMessage(event.target.value)} placeholder={t('auth.appealPlaceholder')} /></label><button type="button" className="auth-appeal-submit" disabled={busy || !form.email || appealMessage.trim().length < 20} onClick={submitAppeal}>{t('auth.appealSubmit')}</button></>}</section>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy && <LoaderCircle className="spin" size={15} />}{mode === 'login' ? t('auth.loginSubmit') : mode === 'register' ? t('auth.registerSubmit') : mode === 'forgot' ? t('auth.forgotSubmit') : t('auth.resetSubmit')} <ArrowRight size={15} /></button>
        </form>}
        <div className="auth-card-footer">{mode === 'login' && <button type="button" className="auth-text-button" onClick={() => changeMode('forgot')}>{t('auth.forgotPassword')}</button>}{['forgot', 'reset'].includes(mode) && <button type="button" className="auth-text-button" onClick={() => changeMode('login')}><ArrowLeft size={13} />{t('auth.forgotBack')}</button>}</div>
      </section>
      <p className="auth-legal">{t('auth.legalPrefix')} <Link to="/terms">{t('auth.terms')}</Link> {t('auth.and')} <Link to="/privacy">{t('auth.privacy')}</Link> Laprakin.</p>
    </main>
  </div>;
}
