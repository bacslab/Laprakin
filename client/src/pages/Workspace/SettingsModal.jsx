import { useEffect, useState } from 'react';
import { Archive, ArrowDownToLine, ArrowRight, BellRing, Check, CheckCircle2, CircleAlert, Copy, CreditCard, Database, FileText, FolderOpen, Keyboard, LoaderCircle, LockKeyhole, Mail, Megaphone, Moon, Monitor, RefreshCw, Search, Save, Settings2, Shield, ShieldCheck, Sliders, Sparkles, Sun, Trash2, UserRound, X } from '../../icons';
import { api, clearCsrfToken, download } from '../../api';
import { Button } from '../../components/Button';
import { CustomSelect } from '../../components/CustomSelect';
import { IconButton } from '../../components/IconButton';
import { Modal } from '../../components/Dialog';
import InstitutionLogoField from '../../components/InstitutionLogoField';
import Toggle from '../../components/Toggle';
import { localizeAiDataClasses } from '../../lib/ai-consent-labels';
import { formatBytes, formatDate } from '../../lib/formatters';
import { userGreetingName, userInitials } from '../../lib/user';
import { useResolvedTheme } from '../../lib/theme';
import { DARK_ONLY_ACCENTS, workspaceAccents } from '../../data/workspace';
import { useApp } from '../../state/ui-context';
import { useI18n } from '../../i18n/context';

const REFERRAL_STATUS_KEYS = new Set(['registered', 'pending', 'held', 'rewarded', 'rejected']);

function ReferralSettingsPane() {
  const { t } = useI18n();
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
    if (!value) return setNotice(t('workspace.settings.referral.codeUnavailableNotice'));
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? '' : current)), 2000);
    } catch {
      setNotice(t('workspace.settings.referral.manualCopy', { value }));
    }
  };

  const referrals = data?.referrals || [];
  const rewarded = referrals.filter((item) => item.status === 'rewarded').length;

  return <div className="referral-settings-pane">
    <section className="referral-code-card">
      <div className="referral-code-head"><span className="referral-code-icon"><Megaphone size={19} /></span><div><small>{t('workspace.settings.referral.codeLabel')}</small><h3>{loading && !code ? t('workspace.settings.referral.loading') : code || t('workspace.settings.referral.unavailable')}</h3></div></div>
      <div className="referral-code-actions">
        <Button variant="secondary" onClick={() => copy(code, 'code')} disabled={!code}>
          {copied === 'code' ? <><Check size={14} />{t('workspace.settings.referral.copied')}</> : <><Copy size={14} />{t('workspace.settings.referral.copyCode')}</>}
        </Button>
        <Button variant="secondary" onClick={() => copy(inviteLink, 'link')} disabled={!inviteLink}>
          {copied === 'link' ? <><Check size={14} />{t('workspace.settings.referral.copied')}</> : <><Copy size={14} />{t('workspace.settings.referral.copyLink')}</>}
        </Button>
      </div>
    </section>

    <section className="referral-terms">
      <b>{t('workspace.settings.referral.termsTitle')}</b>
      <ul>{[0, 1, 2, 3].map((index) => <li key={index}>{t(`workspace.settings.referral.terms.${index}`)}</li>)}</ul>
    </section>

    <section className="referral-list">
      <div className="referral-list-head">
        <div><b>{t('workspace.settings.referral.listTitle')}</b><small>{loading ? t('workspace.settings.referral.loading') : t('workspace.settings.referral.listSummary', { total: referrals.length, rewarded })}</small></div>
        <button type="button" onClick={load} disabled={loading}><RefreshCw size={13} />{t('workspace.settings.referral.reload')}</button>
      </div>
      {!loading && !referrals.length && <p className="referral-empty">{t('workspace.settings.referral.empty')}</p>}
      {referrals.map((item) => {
        const status = REFERRAL_STATUS_KEYS.has(item.status) ? { label: t(`workspace.settings.referral.status.${item.status}.label`), hint: t(`workspace.settings.referral.status.${item.status}.hint`) } : { label: item.status, hint: '' };
        return <article key={item.id} className="referral-row">
          <div><b>{item.email}</b><small>{status.hint || item.rejection_reason || ''}</small></div>
          <span className={`referral-status referral-status-${item.status}`}>{status.label}</span>
        </article>;
      })}
    </section>
  </div>;
}

function BillingSettingsPane({ onOpenBilling }) {
  const { t } = useI18n();
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
      <div><small>{t('workspace.settings.billing.activePlan')}</small><h3>{currentPlan.label || currentPlan.name || t('workspace.settings.billing.freePlan')}</h3><p>{t('workspace.settings.billing.overview')}</p></div>
      <Button onClick={onOpenBilling}>{t('workspace.settings.billing.manage')} <ArrowRight size={14} /></Button>
    </section>
    <div className="billing-summary-grid">
      <article><span>{t('workspace.settings.billing.creditsAvailable')}</span><b>{availableCredits}</b><small>{t('workspace.settings.billing.creditsHint')}</small></article>
      <article><span>{t('workspace.settings.billing.transactions')}</span><b>{loading ? t('workspace.settings.billing.loadingIndicator') : transactionCount}</b><small>{t('workspace.settings.billing.transactionsHint')}</small></article>
    </div>
    <section className="settings-billing-history">
      <div className="settings-billing-history-head"><div><b>{t('workspace.settings.billing.history')}</b><small>{t('workspace.settings.billing.historyHint')}</small></div><button type="button" onClick={load} disabled={loading}><RefreshCw size={13} />{t('workspace.settings.billing.reload')}</button></div>
      {loading ? <div className="settings-loading-state"><LoaderCircle className="spin" size={16} />{t('workspace.settings.billing.loading')}</div> : billing?.transactions?.length ? <div>{billing.transactions.map((item) => <article key={item.id}><span className="transaction-mark">{item.kind === 'payment' || item.kind === 'subscription' ? <CreditCard size={13} /> : <Sparkles size={13} />}</span><div><b>{item.title}</b><small>{item.detail}</small></div><div><strong>{item.amountLabel}</strong><small>{formatDate(item.createdAt)}</small></div></article>)}</div> : <div className="settings-empty-state"><CreditCard size={18} /><div><b>{t('workspace.settings.billing.emptyTitle')}</b><p>{t('workspace.settings.billing.emptyDescription')}</p></div></div>}
    </section>
  </div>;
}

function AccentPicker({ value, onChange, resolvedTheme = 'dark' }) {
  const { t } = useI18n();
  const lightMode = resolvedTheme === 'light';
  return <div className="accent-picker" role="radiogroup" aria-label={t('workspace.settings.appearance.accentLabel')}>
    {workspaceAccents.map((accent) => {
      const unavailable = lightMode && DARK_ONLY_ACCENTS.has(accent.key);
      return <button
        key={accent.key}
        type="button"
        role="radio"
        aria-label={unavailable ? t('workspace.settings.appearance.darkOnlyAria', { label: accent.label }) : accent.label}
        title={unavailable ? t('workspace.settings.appearance.darkOnlyTitle', { label: accent.label }) : accent.label}
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
  const { t } = useI18n();
  const themes = [
    { key: 'system', label: t('workspace.settings.appearance.themes.system'), icon: Monitor },
    { key: 'light', label: t('workspace.settings.appearance.themes.light'), icon: Sun },
    { key: 'dark', label: t('workspace.settings.appearance.themes.dark'), icon: Moon },
  ];
  return <div className="theme-picker" role="radiogroup" aria-label={t('workspace.settings.appearance.themeLabel')}>
    {themes.map(({ key, label, icon: Icon }) => <button key={key} type="button" role="radio" aria-label={label} title={label} aria-checked={value === key} className={value === key ? 'selected' : ''} onClick={() => onChange(key)}><Icon size={15} /></button>)}
  </div>;
}

function SettingsPaneHeader({ eyebrow, title, description }) {
  return <header className="settings-pane-header"><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p></header>;
}

export default function SettingsModal({ onClose, onSaved, onArchivedChanged, onOpenBilling, onAiConsentChange, prefs, setPrefs, initialTab = 'general' }) {
  const { t } = useI18n();
  const { user, setNotice, refreshSession, showDialog } = useApp();
  const settingsTheme = useResolvedTheme(prefs?.theme || 'system');
  const [tab, setTab] = useState(initialTab);
  const [form, setForm] = useState({ nickname: user.nickname || '', fullName: user.fullName || '', nim: user.nim || '', className: user.className || '', institutionName: user.institutionName || '', institutionLogoUrl: user.institutionLogoUrl || '', facultyName: user.facultyName || '', studyProgramName: user.studyProgramName || '', lecturerName: user.lecturerName || '', lecturerNip: user.lecturerNip || '', departmentKey: user.departmentKey || '', studyProgramKey: user.studyProgramKey || '' });
  const [storage, setStorage] = useState(null);
  const [storageBusy, setStorageBusy] = useState('');
  const [safetyStatus, setSafetyStatus] = useState(null);
  const [aiConsentData, setAiConsentData] = useState(null);
  const [aiConsentBusy, setAiConsentBusy] = useState(false);
  const [archivedChats, setArchivedChats] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [settingsQuery, setSettingsQuery] = useState('');
  const loadStorage = async () => { try { setStorage(await api('/storage/summary')); } catch { setStorage(null); } };
  const loadAiConsent = async () => {
    try {
      const data = await api('/privacy/ai-consent');
      setAiConsentData(data);
      onAiConsentChange?.(data);
      updatePrefs({ allowExternalAi: data.consent?.active === true });
    } catch { setAiConsentData(null); }
  };
  useEffect(() => { loadStorage(); loadAiConsent(); api('/safety/status').then(setSafetyStatus).catch(() => setSafetyStatus(null)); }, []);
  useEffect(() => setTab(initialTab), [initialTab]);
  const loadArchivedChats = async () => {
    setArchivedLoading(true);
    try { const data = await api('/chat/sessions/archived'); setArchivedChats(data.sessions || []); }
    catch (err) { setNotice(err.message); }
    finally { setArchivedLoading(false); }
  };
  useEffect(() => { if (tab === 'archived') loadArchivedChats(); }, [tab]);
  const updatePrefs = (patch) => setPrefs((value) => ({ ...value, ...patch }));
  const setExternalAiConsent = async (enabled) => {
    setAiConsentBusy(true);
    try {
      const manifest = aiConsentData?.manifest || await api('/ai/processor-manifest');
      const data = enabled
        ? await api('/privacy/ai-consent', { method: 'POST', body: { manifestVersion: manifest.manifestVersion, policyVersion: manifest.policyVersion, sourceSurface: 'workspace_settings' } })
        : await api('/privacy/ai-consent', { method: 'DELETE' });
      setAiConsentData(data);
      onAiConsentChange?.(data);
      updatePrefs({ allowExternalAi: data.consent?.active === true });
      setNotice(t(enabled ? 'workspace.settings.data.aiConsentGranted' : 'workspace.settings.data.aiConsentRevoked'));
    } catch (err) { setNotice(err.message); }
    finally { setAiConsentBusy(false); }
  };
  const saveNickname = async () => {
    setBusy(true);
    try {
      await api('/profile', { method: 'PUT', body: { nickname: form.nickname.trim() } });
      await onSaved();
      setNotice(form.nickname.trim() ? t('workspace.settings.personalization.nicknameSaved') : t('workspace.settings.personalization.nicknameReset'));
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };
  const saveAcademic = async () => { setBusy(true); try { await api('/profile', { method: 'PUT', body: { fullName: form.fullName, nim: form.nim, className: form.className, institutionName: form.institutionName, facultyName: form.facultyName, studyProgramName: form.studyProgramName, lecturerName: form.lecturerName, lecturerNip: form.lecturerNip, departmentKey: form.departmentKey, studyProgramKey: form.studyProgramKey } }); await onSaved(); setNotice(t('workspace.settings.academic.saved')); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
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
  const logoutAll = async () => { const confirmed = await showDialog({ kind: 'confirm', title: t('workspace.settings.data.logoutTitle'), message: t('workspace.settings.data.logoutMessage'), confirmLabel: t('workspace.settings.data.logoutConfirm') }); if (!confirmed) return; setBusy(true); try { await api('/auth/logout-all', { method: 'POST' }); clearCsrfToken(); await refreshSession(); setNotice(t('workspace.settings.data.logoutNotice')); onClose(); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const exportData = async () => { try { await download('/privacy/data-export', 'laprakin-data.json'); setNotice(t('workspace.settings.data.exportedNotice')); } catch (err) { setNotice(err.message); } };
  const deleteStorageFile = async (file) => {
    const confirmed = await showDialog({ kind: 'confirm', title: t('workspace.settings.data.deleteFileTitle'), message: t('workspace.settings.data.deleteFileMessage', { name: file.name || t('workspace.settings.data.fileFallback') }), confirmLabel: t('workspace.settings.data.deleteFileConfirm'), destructive: true });
    if (!confirmed) return;
    setStorageBusy(file.id);
    try {
      await api(`/storage/files/${file.kind}/${file.id}`, { method: 'DELETE', body: {} });
      await loadStorage();
      setNotice(t('workspace.settings.data.deletedFileNotice'));
    } catch (err) {
      setNotice(err.message);
    } finally {
      setStorageBusy('');
    }
  };
  const deleteAccount = async () => { if (deleteConfirm !== user.email) return setNotice(t('workspace.settings.data.confirmEmailNotice')); setBusy(true); try { await api('/me', { method: 'DELETE', body: { confirmation: deleteConfirm } }); clearCsrfToken(); await refreshSession(); onClose(); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const tabs = [
    { key: 'general', icon: Settings2 },
    { key: 'notifications', icon: BellRing },
    { key: 'personalization', icon: Sliders },
    { key: 'billing', icon: CreditCard },
    { key: 'referral', icon: Megaphone },
    { key: 'data', icon: Database },
    { key: 'storage', icon: FolderOpen },
    { key: 'archived', icon: Archive },
    { key: 'safety', icon: Shield },
    { key: 'security', icon: LockKeyhole },
    { key: 'academic', icon: UserRound },
    { key: 'keyboard', icon: Keyboard },
  ];
  const activeTab = tabs.find((item) => item.key === tab) || tabs[0];
  const tabCopy = (key, part) => t(`workspace.settings.tabs.${key}.${part}`);
  const visibleTabs = tabs.filter((item) => `${tabCopy(item.key, 'label')} ${tabCopy(item.key, 'title')}`.toLocaleLowerCase().includes(settingsQuery.trim().toLocaleLowerCase()));
  const Row = ({ title, description, children, className = '' }) => <div className={`settings-row ${className}`}><div><b>{title}</b>{description && <small>{description}</small>}</div>{children}</div>;
  const storagePercentage = storage?.limitBytes ? Math.min(100, Math.round((storage.usedBytes / storage.limitBytes) * 100)) : 0;
  const storageTierKey = storage?.tier === 'pro' ? 'pro' : storage?.tier === 'subscription' ? 'subscription' : storage?.tier === 'paid' ? 'paid' : 'free';

  return <Modal title={t('workspace.settings.modal.title')} onClose={onClose} className="settings-modal settings-reference settings-v2">
    <div className="settings-layout">
      <nav className="settings-side" aria-label={t('workspace.settings.modal.navigation')}>
        <div className="settings-side-head"><div><b>{t('workspace.settings.modal.title')}</b><small>{t('workspace.settings.modal.privateWorkspace')}</small></div><IconButton label={t('workspace.settings.modal.close')} className="settings-close" onClick={onClose}><X size={18} /></IconButton></div>
        <label className="settings-sidebar-search"><Search size={14}/><input value={settingsQuery} onChange={(event) => setSettingsQuery(event.target.value)} placeholder={t('workspace.settings.modal.searchPlaceholder')} aria-label={t('workspace.settings.modal.searchLabel')} />{settingsQuery && <button type="button" onClick={() => setSettingsQuery('')} aria-label={t('workspace.settings.modal.clearSearch')}><X size={12}/></button>}</label>
        <div className="settings-nav-list">{visibleTabs.map(({ key, icon: Icon }) => <button type="button" key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><Icon size={16} /><span>{tabCopy(key, 'label')}</span></button>)}</div>
        <div className="settings-account-mini"><span>{userInitials(user)}</span><div><b>{user.fullName || user.email.split('@')[0]}</b><small>{user.email}</small></div></div>
      </nav>
      <div className="settings-content">
        <SettingsPaneHeader eyebrow={tabCopy(activeTab.key, 'label')} title={tabCopy(activeTab.key, 'title')} description={tabCopy(activeTab.key, 'description')} />
         {tab === 'general' && <div className="settings-pane">
           <section className="settings-group"><div className="settings-group-heading"><b>{t('workspace.settings.general.appearance')}</b><small>{t('workspace.settings.general.changesImmediate')}</small></div><Row title={t('workspace.settings.general.theme')} className="theme-settings-row"><ThemePicker value={prefs.theme || 'system'} onChange={(value) => updatePrefs({ theme: value })} /></Row><Row title={t('workspace.settings.general.contrast')}><CustomSelect ariaLabel={t('workspace.settings.general.contrast')} value={prefs.contrast || 'default'} onChange={(value) => updatePrefs({ contrast: value })} options={[{ value: 'default', label: t('workspace.settings.general.default') }, { value: 'high', label: t('workspace.settings.general.high') }]} /></Row><Row title={t('workspace.settings.general.language')}><CustomSelect ariaLabel={t('workspace.settings.general.language')} value={prefs.language || 'id'} onChange={(value) => updatePrefs({ language: value })} options={[{ value: 'id', label: t('workspace.settings.general.indonesian') }, { value: 'en', label: t('workspace.settings.general.english') }]} /></Row></section>
          <section className="settings-group accent-settings-group"><div className="settings-group-heading"><b>{t('workspace.settings.appearance.accentLabel')}</b><small>{t('workspace.settings.appearance.accentDescription')}</small></div><AccentPicker value={prefs.accent || 'lime'} onChange={(accent) => updatePrefs({ accent })} resolvedTheme={settingsTheme} /></section>
          <Toggle checked={prefs.compact} onChange={(checked) => updatePrefs({ compact: checked })} title={t('workspace.settings.general.compact')} description={t('workspace.settings.general.compactDescription')} />
        </div>}
        {tab === 'notifications' && <div className="settings-pane"><section className="settings-group"><Toggle checked={prefs.jobNotifications !== false} onChange={(checked) => updatePrefs({ jobNotifications: checked })} title={t('workspace.settings.notifications.documents')} description={t('workspace.settings.notifications.documentsDescription')} /><Toggle checked={prefs.deadlineNotifications !== false} onChange={(checked) => updatePrefs({ deadlineNotifications: checked })} title={t('workspace.settings.notifications.deadlines')} description={t('workspace.settings.notifications.deadlinesDescription')} /><Toggle checked={prefs.productUpdates !== false} onChange={(checked) => updatePrefs({ productUpdates: checked })} title={t('workspace.settings.notifications.productUpdates')} description={t('workspace.settings.notifications.productUpdatesDescription')} /></section></div>}
         {tab === 'personalization' && <div className="settings-pane"><section className="settings-group nickname-settings"><div className="settings-group-heading"><b>{t('workspace.settings.personalization.nickname')}</b><small>{t('workspace.settings.personalization.nicknameDescription')}</small></div><div className="nickname-settings-control"><label aria-label={t('workspace.settings.personalization.greeting')}><input aria-label={t('workspace.settings.personalization.nicknameLabel')} value={form.nickname} maxLength={20} autoComplete="nickname" onChange={(event) => setForm({ ...form, nickname: event.target.value })} placeholder={userGreetingName({ ...user, nickname: '' })} /></label><small>{form.nickname.length}/20</small><Button type="button" variant="secondary" onClick={saveNickname} disabled={busy}><Save size={14}/>{t('workspace.settings.personalization.save')}</Button></div></section><section className="settings-group"><Row title={t('workspace.settings.personalization.tone')}><CustomSelect ariaLabel={t('workspace.settings.personalization.tone')} value={prefs.tone || 'formal'} onChange={(value) => updatePrefs({ tone: value })} options={[{ value: 'formal', label: t('workspace.settings.personalization.formal') }, { value: 'semi-formal', label: t('workspace.settings.personalization.semiFormal') }]} /></Row><Row title={t('workspace.settings.personalization.perspective')}><CustomSelect ariaLabel={t('workspace.settings.personalization.perspective')} value={prefs.perspective || 'saya'} onChange={(value) => updatePrefs({ perspective: value })} options={[{ value: 'saya', label: t('workspace.settings.personalization.i') }, { value: 'kita', label: t('workspace.settings.personalization.we') }, { value: 'impersonal', label: t('workspace.settings.personalization.impersonal') }]} /></Row><Row title={t('workspace.settings.personalization.structure')}><CustomSelect ariaLabel={t('workspace.settings.personalization.structure')} value={prefs.profile || 'langkah'} onChange={(value) => updatePrefs({ profile: value })} options={[{ value: 'langkah', label: t('workspace.settings.personalization.stepBased') }, { value: 'pengujian', label: t('workspace.settings.personalization.testBased') }, { value: 'proyek', label: t('workspace.settings.personalization.projectBased') }]} /></Row></section><label className="settings-textarea"><span>{t('workspace.settings.personalization.extraInstructions')}</span><small>{t('workspace.settings.personalization.extraInstructionsDescription')}</small><textarea aria-label={t('workspace.settings.personalization.extraInstructions')} value={prefs.customInstructions || ''} onChange={(event) => updatePrefs({ customInstructions: event.target.value })} placeholder={t('workspace.settings.personalization.extraInstructionsPlaceholder')} /></label></div>}
        {tab === 'billing' && <BillingSettingsPane onOpenBilling={onOpenBilling} />}
        {tab === 'referral' && <ReferralSettingsPane />}
        {tab === 'data' && <div className="settings-pane"><section className="settings-group"><Row title={t('workspace.settings.data.aiConsentTitle')} description={t('workspace.settings.data.aiConsentDescription', { data: localizeAiDataClasses(aiConsentData?.manifest?.providers?.flatMap((provider) => provider.dataClasses || []) || [], t).join(', ') || '-' })}><Toggle checked={aiConsentData?.consent?.active === true} disabled={aiConsentBusy || !aiConsentData?.manifest?.providers?.length} onChange={setExternalAiConsent} title={t('workspace.settings.data.aiConsentToggle')} description={t('workspace.settings.data.aiConsentToggleDescription')} /></Row><Row title={t('workspace.settings.data.copyTitle')} description={t('workspace.settings.data.copyDescription')}><Button variant="secondary" onClick={exportData}><ArrowDownToLine size={14}/>{t('workspace.settings.data.download')}</Button></Row></section><p className="settings-privacy-note"><ShieldCheck size={15}/>{t('workspace.settings.data.privacyNote', { version: aiConsentData?.manifest?.manifestVersion || '-' })}</p>
          {/* Hapus akun berada satu tab dengan unduh data: urutan yang benar
          adalah mengunduh salinan lebih dulu, baru menghapus. */}
          <section className="settings-danger-zone">
            <div><b>{t('workspace.settings.data.deleteTitle')}</b><p>{t('workspace.settings.data.deleteDescription')}</p></div>
            <input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} placeholder={user.email} aria-label={t('workspace.settings.data.confirmationLabel')} />
            <Button variant="danger" onClick={deleteAccount} disabled={busy || deleteConfirm !== user.email}>{t('workspace.settings.data.deleteButton')}</Button>
          </section>
        </div>}
      {tab === 'storage' && <div className="settings-pane">{storage ? <><div className="storage-overview"><div><span>{t('workspace.settings.storage.used')}</span><b>{formatBytes(storage.usedBytes)}</b><small>{t('workspace.settings.storage.of', { value: formatBytes(storage.limitBytes) })}</small></div><strong>{storagePercentage}%</strong></div><div className="storage-meter"><i><em style={{ width: `${storagePercentage}%` }} /></i></div><div className="storage-cards"><span><FolderOpen size={17}/><b>{t(`workspace.settings.storage.tier.${storageTierKey}`)}</b><small>{storage.retentionHint}</small></span><span><FileText size={17}/><b>{t('workspace.settings.storage.counted')}</b><small>{t('workspace.settings.storage.countedDescription')}</small></span></div><section className="settings-group storage-file-manager"><div className="settings-group-heading"><b>{t('workspace.settings.storage.filesTitle')}</b><small>{t('workspace.settings.storage.filesManaged', { count: storage.files?.length || 0 })}</small></div>{storage.files?.length ? <div className="storage-file-list">{storage.files.map((file) => <article key={`${file.kind}-${file.id}`}><FileText size={15}/><div><b>{file.name}</b><small>{file.sourceLabel} · {formatBytes(file.sizeBytes)} · {formatDate(file.createdAt)}</small></div><Button variant="secondary" onClick={() => deleteStorageFile(file)} disabled={Boolean(storageBusy)}>{storageBusy === file.id ? <LoaderCircle className="spin" size={14}/> : <Trash2 size={14}/>} {t('workspace.settings.storage.delete')}</Button></article>)}</div> : <div className="settings-empty-state"><FolderOpen size={18}/><div><b>{t('workspace.settings.storage.emptyTitle')}</b><p>{t('workspace.settings.storage.emptyDescription')}</p></div></div>}</section></> : <div className="settings-loading-state"><LoaderCircle className="spin" size={16}/>{t('workspace.settings.storage.loading')}</div>}<p className="settings-footnote">{t('workspace.settings.storage.footnote')}</p></div>}
        {tab === 'safety' && <div className="settings-pane safety-settings-pane">
          <section className={`safety-account-status ${safetyStatus?.hasAlert ? 'has-alert' : ''}`}>{safetyStatus ? safetyStatus.hasAlert ? <><CircleAlert size={20}/><div><b>{t('workspace.settings.safety.alertTitle')}</b><p>{t('workspace.settings.safety.alertDescription')}</p><small>{t('workspace.settings.safety.openAlerts', { count: safetyStatus.openAlerts })}</small></div></> : <><ShieldCheck size={20}/><div><b>{t('workspace.settings.safety.clearTitle')}</b><p>{t('workspace.settings.safety.clearDescription')}</p><small>{t('workspace.settings.safety.lastUpdated')}</small></div></> : <><LoaderCircle className="spin" size={18}/><div><b>{t('workspace.settings.safety.loadingTitle')}</b><p>{t('workspace.settings.safety.loadingDescription')}</p></div></>}</section>
          {safetyStatus?.hasAlert && Boolean(safetyStatus.reasons?.length) && <section className="safety-reasons-panel"><b>{t('workspace.settings.safety.reasons')}</b><ul className="safety-reason-list">{safetyStatus.reasons.map((item, index) => <li key={`${item.createdAt || ''}-${index}`}>{item.reason}</li>)}</ul></section>}
        </div>}
        {tab === 'security' && <div className="settings-pane">
          {String(user.authProvider || 'password').includes('google') && <section className="settings-group"><Row title={t('workspace.settings.security.googleConnected')} description={t('workspace.settings.security.googleDescription')}><span className="settings-connected-status"><CheckCircle2 size={14}/>{t('workspace.settings.security.active')}</span></Row></section>}
          <section className="settings-group"><div className="settings-group-heading"><b>{t(user.authProvider === 'google' ? 'workspace.settings.security.createPassword' : 'workspace.settings.security.changePassword')}</b><small>{t('workspace.settings.security.verifyDescription', { email: user.email })}</small></div><Button type="button" variant="secondary" onClick={requestPasswordChange} disabled={busy}><Mail size={14}/>{t('workspace.settings.security.sendVerification')}</Button></section>
          <section className="settings-group"><Row title={t('workspace.settings.security.allDevices')} description={t('workspace.settings.security.allDevicesDescription')}><Button variant="secondary" onClick={logoutAll} disabled={busy}>{t('workspace.settings.security.endAllSessions')}</Button></Row></section>
        </div>}
        {tab === 'archived' && <div className="settings-pane"><section className="archived-chat-settings">{archivedLoading ? <div className="settings-loading-state"><LoaderCircle className="spin" size={16}/>{t('workspace.settings.archived.loading')}</div> : archivedChats.length ? <div className="archived-chat-list">{archivedChats.map((session) => <article key={session.id}><span className="archived-chat-icon"><Archive size={16}/></span><div><b>{session.title || t('workspace.settings.archived.newChat')}</b><small>{session.course_group || t('workspace.settings.archived.uncategorized')}</small><time>{formatDate(session.archived_at || session.updated_at)}</time></div><Button type="button" variant="secondary" disabled={busy} onClick={() => restoreArchivedChat(session.id)}>{t('workspace.settings.archived.restore')}</Button></article>)}</div> : <div className="settings-empty-state"><Archive size={18}/><div><b>{t('workspace.settings.archived.emptyTitle')}</b><p>{t('workspace.settings.archived.emptyDescription')}</p></div></div>}</section></div>}
        {tab === 'academic' && <div className="settings-pane">
          <section className="settings-group academic-settings-form academic-settings-wide">
             <label><span>{t('workspace.settings.academic.fullName')}</span><input aria-label={t('workspace.settings.academic.fullName')} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder={t('workspace.settings.academic.fullNamePlaceholder')} /></label>
             <label><span>{t('workspace.settings.academic.studentId')}</span><input aria-label={t('workspace.settings.academic.studentId')} value={form.nim} onChange={(event) => setForm({ ...form, nim: event.target.value })} placeholder={t('workspace.settings.academic.studentIdPlaceholder')} /></label>
             <label><span>{t('workspace.settings.academic.class')}</span><input aria-label={t('workspace.settings.academic.class')} value={form.className} onChange={(event) => setForm({ ...form, className: event.target.value })} placeholder={t('workspace.settings.academic.classPlaceholder')} /></label>
             <label><span>{t('workspace.settings.academic.institution')}</span><input aria-label={t('workspace.settings.academic.institution')} value={form.institutionName} onChange={(event) => setForm({ ...form, institutionName: event.target.value })} placeholder={t('workspace.settings.academic.institutionPlaceholder')} /></label>
             <label><span>{t('workspace.settings.academic.faculty')}</span><input aria-label={t('workspace.settings.academic.faculty')} value={form.facultyName} onChange={(event) => setForm({ ...form, facultyName: event.target.value })} placeholder={t('workspace.settings.academic.facultyPlaceholder')} /></label>
             <label><span>{t('workspace.settings.academic.studyProgram')}</span><input aria-label={t('workspace.settings.academic.studyProgram')} value={form.studyProgramName} onChange={(event) => setForm({ ...form, studyProgramName: event.target.value })} placeholder={t('workspace.settings.academic.studyProgramPlaceholder')} /></label>
            <Button onClick={saveAcademic} disabled={busy}><Save size={14}/>{t('workspace.settings.academic.save')}</Button>
          </section>
          <InstitutionLogoField logoUrl={user.institutionLogoUrl || ''} onChanged={onSaved} setNotice={setNotice} />
        </div>}
        {tab === 'keyboard' && <div className="settings-pane"><section className="settings-group"><Toggle checked={prefs.enterToSend !== false} onChange={(checked) => updatePrefs({ enterToSend: checked })} title={t('workspace.settings.keyboard.enterToSend')} description={t('workspace.settings.keyboard.enterToSendDescription')} /><Toggle checked={prefs.reducedMotion} onChange={(checked) => updatePrefs({ reducedMotion: checked })} title={t('workspace.settings.keyboard.reduceMotion')} description={t('workspace.settings.keyboard.reduceMotionDescription')} /></section></div>}
      </div>
    </div>
  </Modal>;
}
