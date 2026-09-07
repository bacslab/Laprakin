import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from '../../icons';

import { api, setCsrfToken } from '../../api';
import { Button } from '../../components/Button';
import LoadingScreen from '../../components/LoadingScreen';
import { useI18n } from '../../i18n/context';
import { useApp } from '../../state/ui-context';

export default function AdminMfaGate({ children }) {
  const { setNotice } = useApp();
  const { t } = useI18n();
  const [state, setState] = useState(null);
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const data = await api('/admin/mfa/status');
      setState(data.mfa);
    } catch (error) {
      setNotice(error.message);
    }
  }, [setNotice]);
  useEffect(() => { load(); }, [load]);
  if (!state || !state.required || state.verified) return state ? children : <LoadingScreen />;
  const enroll = async () => {
    setBusy(true);
    try {
      const data = await api('/admin/mfa/enroll', { method: 'POST', body: {} });
      setSecret(data.secret || '');
      setState(data.mfa);
      setNotice(t('admin.enrollmentReady'));
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const verify = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await api('/admin/mfa/verify', { method: 'POST', body: { code } });
      setCsrfToken(data.csrfToken);
      setState(data.mfa);
      setCode('');
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  return <main className="admin-mfa-gate" aria-labelledby="admin-mfa-title">
    <section className="admin-mfa-card">
      <ShieldCheck size={24} aria-hidden="true" />
      <span className="admin-eyebrow">{t('admin.securityEyebrow')}</span>
      <h1 id="admin-mfa-title">{t('admin.mfaTitle')}</h1>
      <p>{t('admin.mfaDescription')}</p>
      {!state.enrolled && !secret && <Button onClick={enroll} disabled={busy}>{busy ? t('admin.preparing') : t('admin.startEnrollment')}</Button>}
      {secret && <div className="admin-mfa-secret"><b>{t('admin.authenticatorSecret')}</b><code>{secret}</code><small>{t('admin.secretHint')}</small></div>}
      {(state.enrolled || secret) && <form onSubmit={verify} className="admin-mfa-form"><label htmlFor="admin-mfa-code"><span>{t('admin.sixDigitCode')}</span><input id="admin-mfa-code" aria-label={t('admin.sixDigitCode')} required inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} autoComplete="one-time-code" /></label><Button type="submit" disabled={busy || code.length !== 6}>{busy ? t('admin.checking') : t('admin.verifyAndOpen')}</Button></form>}
    </section>
  </main>;
}
