import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, LoaderCircle, RefreshCw } from 'lucide-react';
import { Link } from '../../router';
import { api } from '../../api';
import { useI18n } from '../../i18n/context';
import './status.css';

const CHECK_LABELS = {
  database: 'Database',
  ai: 'AI provider',
  worker: 'Background worker',
};

function checkLabel(key, language) {
  if (language !== 'en') return key === 'database' ? 'Database' : key === 'ai' ? 'Provider AI' : 'Worker background';
  return CHECK_LABELS[key] || key;
}

function checkCopy(value, language) {
  const normalized = String(value || 'unknown');
  const labels = language === 'en'
    ? { ok: 'Operational', idle: 'Idle', busy: 'Busy', unavailable: 'Unavailable', not_configured: 'Not configured', unknown: 'Unknown' }
    : { ok: 'Berjalan normal', idle: 'Idle', busy: 'Sibuk', unavailable: 'Tidak tersedia', not_configured: 'Belum dikonfigurasi', unknown: 'Belum diketahui' };
  return labels[normalized] || normalized;
}

export default function StatusPage() {
  const { language, t } = useI18n();
  const [snapshot, setSnapshot] = useState(null);
  const [checkedAt, setCheckedAt] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      setSnapshot(await api('/status'));
      setCheckedAt(new Date());
      setError('');
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const nextSnapshot = await api('/status');
        if (!active) return;
        setSnapshot(nextSnapshot);
        setCheckedAt(new Date());
        setError('');
      } catch (nextError) {
        if (active) setError(nextError.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    const timer = window.setInterval(run, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const statusCopy = useMemo(() => {
    if (error && !snapshot) return { label: t('status.unreachable'), className: 'status-page-error' };
    if (snapshot?.status === 'ok') return { label: t('status.operational'), className: 'status-page-ok' };
    if (snapshot?.status === 'degraded') return { label: t('status.degraded'), className: 'status-page-degraded' };
    return { label: t('status.checking'), className: 'status-page-loading' };
  }, [error, snapshot, t]);

  const checkedLabel = checkedAt
    ? new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(checkedAt)
    : t('status.notChecked');
  const checks = Object.entries(snapshot?.checks || {});

  return <main className="status-page">
    <header className="status-page-header">
      <Link className="status-page-brand" to="/"><span aria-hidden="true">L</span><b>Laprakin</b></Link>
      <Link className="status-page-home" to="/">{t('status.backHome')}</Link>
    </header>
    <section className="status-page-shell" aria-labelledby="status-page-title">
      <div className="status-page-intro"><p>{t('status.eyebrow')}</p><h1 id="status-page-title">{t('status.title')}</h1><span>{t('status.description')}</span></div>
      <section className={`status-page-summary ${statusCopy.className}`} role="status" aria-live="polite">
        {loading ? <LoaderCircle className="status-page-icon spin" size={24} aria-hidden="true" /> : snapshot?.status === 'ok' ? <CheckCircle2 className="status-page-icon" size={24} aria-hidden="true" /> : <CircleAlert className="status-page-icon" size={24} aria-hidden="true" />}
        <div><strong>{statusCopy.label}</strong><span>{error && !snapshot ? t('status.retryHint') : t('status.summary')}</span></div>
        <button type="button" className="status-page-refresh" onClick={() => loadStatus(true)} disabled={refreshing} aria-label={t('status.refresh')} title={t('status.refresh')}><RefreshCw className={refreshing ? 'spin' : ''} size={16} /></button>
      </section>
      <div className="status-page-meta"><span>{t('status.lastChecked')}: {checkedLabel}</span>{snapshot?.version && <span>{t('status.version')} {snapshot.version}</span>}</div>
      <section className="status-page-checks" aria-labelledby="status-checks-title"><h2 id="status-checks-title">{t('status.components')}</h2>{checks.length ? checks.map(([key, value]) => <article key={key}><div><span className="status-page-check-dot" aria-hidden="true" /><b>{checkLabel(key, language)}</b></div><span className={`status-page-check-value status-${value}`}>{checkCopy(value, language)}</span></article>) : <p>{t('status.noComponents')}</p>}</section>
      <p className="status-page-footnote">{t('status.privacy')}</p>
    </section>
  </main>;
}
