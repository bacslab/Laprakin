import { useEffect, useRef, useState } from 'react';
import { ArrowRight, LoaderCircle, Upload, UserRound } from 'lucide-react';
import { api } from '../../api';
import { Button } from '../../components/Button';
import { INSTITUTION_LOGO_MAX_BYTES } from '../../components/InstitutionLogoField';
import { useApp } from '../../state/ui-context';

export default function IdentityIntakeModal({ user, onSave, onBack, busy }) {
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
