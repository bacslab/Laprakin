import { useEffect, useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { api } from '../api';
import { Button } from './Button';
import { useI18n } from '../i18n/context';

export const INSTITUTION_LOGO_MAX_BYTES = 5 * 1024 * 1024;

export default function InstitutionLogoField({ logoUrl = '', onChanged, setNotice }) {
  const { t } = useI18n();
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
    if (file.size > INSTITUTION_LOGO_MAX_BYTES) return setNotice(t('workspace.institutionLogo.maxSize'));
    if (file.type !== 'image/png' || !/\.png$/i.test(file.name)) return setNotice(t('workspace.institutionLogo.pngOnly'));
    const body = new FormData();
    body.append('file', file);
    setBusy(true);
    try {
      await api('/profile/institution-logo', { method: 'POST', body, form: true });
      setPreviewFailed(false);
      await onChanged?.();
      setNotice(t('workspace.institutionLogo.updated'));
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
      setNotice(t('workspace.institutionLogo.deleted'));
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  };

  return <section className="settings-group institution-logo-field">
    <div className="settings-group-heading"><b>{t('workspace.institutionLogo.title')}</b><small>{t('workspace.institutionLogo.description')}</small></div>
    <div className="institution-logo-row">
      <div className={`institution-logo-preview ${hasLogo ? '' : 'is-empty'}`}>
        {hasLogo ? <img src={logoUrl} alt="Logo institusi" onError={() => setPreviewFailed(true)} /> : null}
      </div>
      <div className="institution-logo-actions">
         <input ref={inputRef} aria-label={t('workspace.institutionLogo.uploadAria')} type="file" accept=".png,image/png" onChange={pick} hidden />
        <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Upload size={14} />{hasLogo ? t('workspace.institutionLogo.replace') : t('workspace.institutionLogo.upload')}
        </Button>
        {hasStoredLogo && <Button variant="secondary" onClick={remove} disabled={busy}><Trash2 size={14} />{t('workspace.institutionLogo.remove')}</Button>}
      </div>
    </div>
  </section>;
}
