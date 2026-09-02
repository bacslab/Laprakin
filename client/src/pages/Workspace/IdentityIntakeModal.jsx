import { useEffect, useRef, useState } from 'react';
import { ArrowRight, LoaderCircle, Upload, UserRound } from 'lucide-react';
import { api } from '../../api';
import { Button } from '../../components/Button';
import { INSTITUTION_LOGO_MAX_BYTES } from '../../components/InstitutionLogoField';
import { useApp } from '../../state/ui-context';
import { useI18n } from '../../i18n';

export default function IdentityIntakeModal({ user, onSave, onBack, busy }) {
  const { setNotice } = useApp();
  const { t } = useI18n();
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
      setNotice(t('workspace.identity.invalidLogoType'));
      return;
    }
    if (file.size > INSTITUTION_LOGO_MAX_BYTES) {
      setNotice(t('workspace.identity.logoTooLarge'));
      return;
    }
    const body = new FormData();
    body.append('file', file);
    setLogoBusy(true);
    try {
      const result = await api('/profile/institution-logo', { method: 'POST', body, form: true });
      setLogoPreviewFailed(false);
      setForm((value) => ({ ...value, institutionLogoUrl: result.user?.institutionLogoUrl || '' }));
      setNotice(t('workspace.identity.logoReady'));
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLogoBusy(false);
    }
  };
  const submit = async (event) => { event.preventDefault(); if (valid) await onSave(form); };
  return <div className="identity-intake-overlay" role="dialog" aria-modal="true" aria-labelledby="identity-intake-title">
    <form className="identity-intake-modal" onSubmit={submit}>
      <header><span><UserRound size={17} /></span><div><small>{t('workspace.identity.oneTime')}</small><h2 id="identity-intake-title">{t('workspace.identity.title')}</h2><p>{t('workspace.identity.description')}</p><p className="identity-intake-follow-up">{t('workspace.identity.followUp')}</p></div></header>
      <div className="identity-intake-grid">
        <label>{t('workspace.identity.fullName')}<input ref={identityFirstInputRef} aria-label={t('workspace.identity.fullNameAria')} autoComplete="name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder={t('workspace.identity.fullNamePlaceholder')} /></label>
        <label>{t('workspace.identity.studentId')}<input aria-label={t('workspace.identity.studentIdAria')} inputMode="numeric" autoComplete="off" value={form.nim} onChange={(event) => setForm({ ...form, nim: event.target.value })} placeholder={t('workspace.identity.studentIdPlaceholder')} /></label>
        <label>{t('workspace.identity.class')}<input aria-label={t('workspace.identity.class')} autoComplete="off" value={form.className} onChange={(event) => setForm({ ...form, className: event.target.value })} placeholder={t('workspace.identity.classPlaceholder')} /></label>
        <label>{t('workspace.identity.institution')}<input aria-label={t('workspace.identity.institutionAria')} value={form.institutionName} onChange={(event) => setForm({ ...form, institutionName: event.target.value })} placeholder={t('workspace.identity.institutionPlaceholder')} /></label>
        <label>{t('workspace.identity.faculty')}<input aria-label={t('workspace.identity.facultyAria')} value={form.facultyName} onChange={(event) => setForm({ ...form, facultyName: event.target.value })} placeholder={t('workspace.identity.facultyPlaceholder')} /></label>
        <label>{t('workspace.identity.studyProgram')}<input aria-label={t('workspace.identity.studyProgram')} value={form.studyProgramName} onChange={(event) => setForm({ ...form, studyProgramName: event.target.value })} placeholder={t('workspace.identity.studyProgramPlaceholder')} /></label>
        <div className="identity-logo-field">
          <span>{t('workspace.identity.logo')}</span>
          <div className="identity-logo-control">
            <span className={`identity-logo-preview ${hasLogoPreview ? '' : 'is-empty'}`.trim()}>{hasLogoPreview ? <img src={form.institutionLogoUrl} alt={t('workspace.identity.logo')} onError={() => setLogoPreviewFailed(true)} /> : null}</span>
            <div><b>{hasLogoPreview ? t('workspace.identity.logoUploaded') : t('workspace.identity.uploadLogo')}</b><small>{t('workspace.identity.logoHint')}</small></div>
            <input ref={logoInputRef} aria-label={t('workspace.identity.uploadLogoAria')} hidden type="file" accept=".png,image/png" onChange={uploadLogo} />
            <Button type="button" variant="secondary" disabled={busy || logoBusy} onClick={() => logoInputRef.current?.click()}>{logoBusy ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />}{hasLogoPreview ? t('workspace.identity.replace') : t('workspace.identity.upload')}</Button>
          </div>
        </div>
      </div>
      <footer><button type="button" onClick={onBack} disabled={busy || logoBusy}>{t('workspace.identity.back')}</button><Button type="submit" disabled={busy || logoBusy || !valid}>{busy ? <LoaderCircle className="spin" size={14} /> : <ArrowRight size={14} />}{t('workspace.identity.saveContinue')}</Button></footer>
    </form>
  </div>;
}
