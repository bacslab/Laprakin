import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from '../../router';
import {
  Activity, AlertTriangle, BellRing, ClipboardList, CreditCard, Database, FileCog, FileText,
  LayoutDashboard, LogOut, Mail, Megaphone, MessageCircle, MessageSquareText, Moon, RefreshCw, Shield,
  LoaderCircle, ShieldCheck, Sparkles, Sun, Users,
} from 'lucide-react';
import { api } from '../../api';
import { BrandMark } from '../../components/BrandMark';
import { Button } from '../../components/Button';
import { CustomSelect } from '../../components/CustomSelect';
import { FeatureUpdatesAdmin } from '../../FeatureUpdates';
import { formatBytes, formatDate } from '../../lib/formatters';
import { legacyAdminPath, legacyAdminTab } from '../../lib/admin-ai';
import { resolveTheme, useResolvedTheme } from '../../lib/theme';
import { useApp } from '../../state/ui-context';
import { useI18n } from '../../i18n/context';
import AdminAccessPanel from './AdminAccessPanel';
import AdminAppealsPanel from './AdminAppealsPanel';
import AdminBroadcastPanel from './AdminBroadcastPanel';
import AdminPricingPanel from './AdminPricingPanel';
import { AdminFeedbackPanel, AdminIntegrationsPanel, AdminLandingCmsPanel, AdminRiskPanel } from './AdminLegacyContentPanels';

export default function LegacyAdminWorkspace() {
  const { user, refreshSession, setNotice, prefs, setPrefs } = useApp();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const adminTheme = useResolvedTheme(prefs.theme || 'system');
  const setAdminTheme = (next) => setPrefs((value) => ({ ...value, theme: typeof next === 'function' ? next(resolveTheme(value.theme || 'system')) : next }));
  const tab = legacyAdminTab(location.pathname);
  const [overview, setOverview] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [audit, setAudit] = useState([]);
  const [landing, setLanding] = useState(null);
  const [aiUsage, setAiUsage] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminAlerts, setAdminAlerts] = useState([]);
  const [creditForm, setCreditForm] = useState({ audience: 'user', userId: '', amount: 1, reason: '' });
  const [integrationStatus, setIntegrationStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState({});
  const [loadedRoutes, setLoadedRoutes] = useState({});
  const [routeResource, setRouteResource] = useState({ loading: true, error: '', lastUpdated: null });
  const loadActiveRoute = useCallback(async () => {
    setRouteResource((current) => ({ ...current, loading: true, error: '' }));
    try {
      switch (tab) {
        case 'overview':
        case 'risk': {
          const data = await api('/admin/overview');
          setOverview(data);
          break;
        }
        case 'credits':
        case 'users':
        case 'broadcasts': {
          const data = await api('/admin/users?limit=100');
          setAdminUsers(data.users || []);
          break;
        }
        case 'alerts': {
          const data = await api('/admin/alerts?status=all');
          setAdminAlerts(data.alerts || []);
          break;
        }
        case 'integrations':
          setAiUsage(await api('/admin/ai/usage?days=30'));
          break;
        case 'feedback': {
          const data = await api('/admin/feedback');
          setFeedback(data.items || []);
          break;
        }
        case 'cms': {
          const data = await api('/admin/cms/landing');
          setLanding(data.landing || null);
          break;
        }
        case 'audit': {
          const data = await api('/admin/audit');
          setAudit(data.events || []);
          break;
        }
        default:
          break;
      }
      const lastUpdated = Date.now();
      setLoadedRoutes((current) => ({ ...current, [tab]: true }));
      setRouteResource({ loading: false, error: '', lastUpdated });
    } catch (error) {
      setRouteResource((current) => ({ ...current, loading: false, error: error.message || String(error) }));
    }
  }, [tab]);
  useEffect(() => { loadActiveRoute(); }, [loadActiveRoute]);
  useEffect(() => {
    const stream = new EventSource('/api/admin/events');
    const refreshOperationalData = () => {
      if (tab === 'overview' || tab === 'risk' || tab === 'alerts') loadActiveRoute();
    };
    stream.addEventListener('alert', refreshOperationalData);
    stream.addEventListener('alert-updated', refreshOperationalData);
    stream.addEventListener('credit', () => {
      if (tab === 'credits' || tab === 'users' || tab === 'broadcasts') loadActiveRoute();
    });
    return () => stream.close();
  }, [loadActiveRoute, tab]);
  const reviewRisk = async (id, status) => {
    try { await api(`/admin/risk-events/${id}`, { method: 'PUT', body: { status } }); await loadActiveRoute(); setNotice(t('admin.console.notices.riskUpdated')); } catch (error) { setNotice(error.message); }
  };
  const updateFeedback = async (id, status) => {
    try { await api(`/admin/feedback/${id}/status`, { method: 'PUT', body: { status, adminNote: '' } }); await loadActiveRoute(); } catch (error) { setNotice(error.message); }
  };
  const sendReply = async (id) => {
    const body = (reply[id] || '').trim(); if (!body) return;
    setBusy(true);
    try { await api(`/admin/feedback/${id}/reply`, { method: 'POST', body: { body } }); setReply((prev) => ({ ...prev, [id]: '' })); await loadActiveRoute(); setNotice(t('admin.console.notices.replySent')); } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const saveLanding = async () => {
    if (!landing) return;
    setBusy(true);
    try { const data = await api('/admin/cms/landing', { method: 'PUT', body: landing }); setLanding(data.landing); setNotice(t('admin.console.notices.landingPublished')); } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const runRetention = async () => { setBusy(true); try { const data = await api('/admin/retention/run', { method: 'POST', body: {} }); setNotice(t('admin.console.retention.done', { documents: data.deletedDocuments || 0, objects: data.deletedObjects || 0 })); await loadActiveRoute(); } catch (error) { setNotice(error.message); } finally { setBusy(false); } };
  const checkIntegrations = async () => {
    setBusy(true);
    try {
      const result = await api('/admin/integrations/check', { method: 'POST', body: {} });
      setIntegrationStatus(result); setNotice(t('admin.console.notices.integrationsReady'));
    } catch (error) {
      if (error.payload?.providers || error.payload?.integrations) setIntegrationStatus(error.payload);
      setNotice(t('admin.console.notices.integrationIssues'));
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
      setNotice(t('admin.console.credits.grantNotice', { count: result.recipientCount, amount: result.amount }));
      await loadActiveRoute();
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
      setNotice(t('admin.console.notices.mediaUploaded'));
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const tabs = [
    ['overview', t('admin.console.tabs.overview'), LayoutDashboard], ['ai', t('admin.console.tabs.ai'), Sparkles], ['credits', t('admin.console.tabs.credits'), CreditCard], ['pricing', t('admin.console.tabs.pricing'), CreditCard], ['alerts', t('admin.console.tabs.alerts'), BellRing], ['integrations', t('admin.console.tabs.integrations'), Sparkles], ['updates', t('admin.console.tabs.updates'), BellRing], ['broadcasts', t('admin.console.tabs.broadcasts'), Mail], ['feedback', t('admin.console.tabs.feedback'), MessageSquareText], ['users', t('admin.console.tabs.users'), Shield], ['appeals', t('admin.console.tabs.appeals'), MessageCircle], ['risk', t('admin.console.tabs.risk'), AlertTriangle], ['cms', t('admin.console.tabs.cms'), Megaphone], ['audit', t('admin.console.tabs.audit'), ClipboardList], ['retention', t('admin.console.tabs.retention'), FileCog],
  ];
  const tabGroups = [
    [t('admin.console.groups.operations'), ['overview', 'ai', 'credits', 'pricing', 'alerts', 'integrations']],
    [t('admin.console.groups.content'), ['updates', 'broadcasts', 'feedback', 'cms']],
    [t('admin.console.groups.security'), ['users', 'appeals', 'risk', 'audit', 'retention']],
  ];
  const routeHasData = Boolean(loadedRoutes[tab]);
  return <div className={`admin-workspace ${adminTheme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
    <aside className="admin-sidebar"><div className="admin-brand"><BrandMark alt=""/><div><b>Laprakin</b><small>{t('admin.console.adminConsole')}</small></div></div><nav>{tabGroups.map(([group, keys]) => <div className="admin-nav-group" key={group}><small>{group}</small>{keys.map((key) => { const [, label, Icon] = tabs.find(([tabKey]) => tabKey === key); const path = key === 'ai' ? '/admin/ai/providers' : legacyAdminPath(key); return <button key={key} className={tab === key ? 'active' : ''} onClick={() => navigate(path)} title={label}><Icon size={16} /><span>{label}</span></button>; })}</div>)}</nav><div className="admin-sidebar-foot"><div><span>{(user.email || 'A').slice(0,1).toUpperCase()}</span><small>{user.email}</small></div><button onClick={async () => { await api('/auth/logout', { method: 'POST', body: {} }); await refreshSession(); navigate('/'); }}><LogOut size={15} />{t('admin.console.logout')}</button></div></aside>
    <main className="admin-main"><header className="admin-header"><div><p>{t('admin.console.adminConsole')}</p><h1>{tabs.find(([key]) => key === tab)?.[1]}</h1>{routeResource.lastUpdated && <small>{t('admin.console.lastUpdated', { date: formatDate(routeResource.lastUpdated) })}</small>}</div><div className="admin-header-actions"><button className="admin-theme-toggle" onClick={() => setAdminTheme((value) => value === 'dark' ? 'light' : 'dark')} title={t('admin.console.adminTheme')} aria-label={t('admin.console.adminTheme')}>{adminTheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button><button className="admin-refresh" onClick={loadActiveRoute} disabled={routeResource.loading}><RefreshCw className={routeResource.loading ? 'spin' : ''} size={15} /><span>{t('admin.console.reload')}</span></button></div></header>
      {routeResource.error && routeHasData && <div className="admin-route-alert" role="alert"><span>{routeResource.error}</span><Button variant="secondary" onClick={loadActiveRoute}>{t('admin.console.retry')}</Button></div>}
      {routeResource.loading && !routeHasData ? <div className="admin-loading-state" role="status" aria-live="polite"><LoaderCircle className="spin" size={20} /><b>{t('admin.console.loadingTitle')}</b><span>{t('admin.console.loadingDescription')}</span></div> : routeResource.error && !routeHasData ? <div className="admin-loading-state" role="alert"><AlertTriangle size={20} /><b>{t('admin.console.loadFailed')}</b><span>{routeResource.error}</span><Button variant="secondary" onClick={loadActiveRoute}>{t('admin.console.retry')}</Button></div> : <>
      {tab === 'overview' && overview && <section className="admin-content"><div className="admin-privacy-note"><ShieldCheck size={17} /><div><b>{t('admin.console.privacyTitle')}</b><span>{t('admin.console.privacyDescription')}</span></div></div><div className="admin-metric-grid">{[[t('admin.console.metrics.activeUsers'),overview.stats.users,Users],[t('admin.console.metrics.activeDocuments'),overview.stats.documents,FileText],[t('admin.console.metrics.runningJobs'),overview.stats.queuedJobs,Activity],[t('admin.console.metrics.aiCalls'),overview.stats.aiCalls24h,Sparkles],[t('admin.console.metrics.aiTokens'),Number(overview.stats.aiTokens24h || 0).toLocaleString('id-ID'),Activity],[t('admin.console.metrics.aiErrors'),overview.stats.aiErrors24h,AlertTriangle],[t('admin.console.metrics.openAlerts'),overview.stats.openAdminAlerts || 0,BellRing],[t('admin.console.metrics.openFeedback'),overview.stats.openFeedback,MessageCircle],[t('admin.console.metrics.openRisk'),overview.stats.openRiskEvents,AlertTriangle],[t('admin.console.metrics.storage'),formatBytes(overview.storageBytes),Database]].map(([label,value,Icon]) => <article key={label}><Icon size={16}/><span>{label}</span><b>{value}</b></article>)}</div><div className="admin-grid"><section className="admin-panel"><div className="admin-panel-head"><h2>{t('admin.console.activity')}</h2><small>{t('admin.console.aggregateEvents')}</small></div><div className="activity-bars">{overview.dailyActivity?.length ? overview.dailyActivity.map((day) => <div key={day.day}><i style={{height:`${Math.max(8, Math.min(100, day.count * 12))}%`}} /><span>{day.day.slice(5)}</span><b>{day.count}</b></div>) : <p>{t('admin.console.noActivity')}</p>}</div></section><section className="admin-panel"><div className="admin-panel-head"><h2>{t('admin.console.recentJobs')}</h2><small>{t('admin.console.noDocumentContent')}</small></div><div className="admin-list">{overview.jobs?.length ? overview.jobs.map((job) => <article key={job.id}><div><b>{job.job_type}</b><small>{job.message || t('admin.console.processing')}</small></div><span className={`status-${job.status}`}>{job.status}</span></article>) : <p>{t('admin.console.noJobs')}</p>}</div></section></div></section>}
       {tab === 'credits' && <section className="admin-content"><div className="admin-grid"><section className="admin-panel admin-credit-panel"><div className="admin-panel-head"><h2>{t('admin.console.credits.title')}</h2><small>{t('admin.console.credits.description')}</small></div><label htmlFor="admin-credit-audience">{t('admin.console.credits.target')}<CustomSelect id="admin-credit-audience" ariaLabel={t('admin.console.credits.targetAria')} value={creditForm.audience} onChange={(audience) => setCreditForm((value) => ({ ...value, audience }))} options={[{value:'user',label:t('admin.console.credits.singleUser')},{value:'all',label:t('admin.console.credits.verifiedUsers')},{value:'paid',label:t('admin.console.credits.paidUsers')}]} /></label>{creditForm.audience === 'user' && <label htmlFor="admin-credit-user">{t('admin.console.credits.user')}<CustomSelect id="admin-credit-user" ariaLabel={t('admin.console.credits.recipientAria')} value={creditForm.userId} onChange={(userId) => setCreditForm((value) => ({ ...value, userId }))} options={[{value:'',label:t('admin.console.credits.chooseUser')},...adminUsers.map((item)=>({value:item.id,label:`${item.email} · ${t('admin.console.credits.creditsCount', { count: item.credits })}`}))]} /></label>}<label>{t('admin.console.credits.amount')}<input aria-label={t('admin.console.credits.amountAria')} type="number" min="1" max="100" value={creditForm.amount} onChange={(event) => setCreditForm((value) => ({ ...value, amount: event.target.value }))} /></label><label>{t('admin.console.credits.reason')}<input aria-label={t('admin.console.credits.reasonAria')} maxLength="160" value={creditForm.reason} placeholder={t('admin.console.credits.defaultReason')} onChange={(event) => setCreditForm((value) => ({ ...value, reason: event.target.value }))} /></label><Button onClick={grantAdminCredit} disabled={busy || (creditForm.audience === 'user' && !creditForm.userId)}><CreditCard size={14}/>{t('admin.console.credits.add')}</Button></section><section className="admin-panel"><div className="admin-panel-head"><h2>{t('admin.console.credits.recentUsers')}</h2><small>{t('admin.console.credits.accountCount', { count: adminUsers.length })}</small></div><div className="admin-list admin-user-list">{adminUsers.slice(0,30).map((item)=><article key={item.id}><div><b>{item.fullName || item.email}</b><small>{item.email} · {item.plan}</small></div><span>{t('admin.console.credits.creditsCount', { count: item.credits })}</span></article>)}</div></section></div></section>}
       {tab === 'pricing' && <AdminPricingPanel setNotice={setNotice}/>} 
       {tab === 'users' && <AdminAccessPanel users={adminUsers} setNotice={setNotice} onRefresh={loadActiveRoute}/>}
       {tab === 'appeals' && <AdminAppealsPanel setNotice={setNotice} onRefresh={loadActiveRoute}/>}
       {tab === 'broadcasts' && <AdminBroadcastPanel users={adminUsers} setNotice={setNotice}/>} 
       {tab === 'alerts' && <section className="admin-content"><div className="admin-panel admin-wide"><div className="admin-panel-head"><h2>{t('admin.console.alerts.title')}</h2><small>{t('admin.console.alerts.description')}</small></div><div className="admin-list admin-alert-list">{adminAlerts.length ? adminAlerts.map((alert)=><article key={alert.id} className={`admin-alert-${alert.severity}`}><div><b>{alert.summary}</b><small>{alert.userEmail || t('admin.console.alerts.system')} · {alert.kind}{alert.errorCode ? ` · ${alert.errorCode}` : ''} · {formatDate(alert.createdAt)}</small></div><div className="admin-actions"><span className={`status-${alert.status === 'resolved' ? 'completed' : 'failed'}`}>{alert.status}</span><button onClick={()=>updateAdminAlert(alert.id,alert.status === 'open' ? 'resolved' : 'open')}>{alert.status === 'open' ? t('admin.console.alerts.markResolved') : t('admin.console.alerts.reopen')}</button></div></article>) : <p className="empty-admin">{t('admin.console.alerts.empty')}</p>}</div></div></section>}
       {tab === 'integrations' && <AdminIntegrationsPanel aiUsage={aiUsage} integrationStatus={integrationStatus} checkIntegrations={checkIntegrations} busy={busy} />}
       {tab === 'updates' && <FeatureUpdatesAdmin setNotice={setNotice} />}
        {tab === 'feedback' && <AdminFeedbackPanel feedback={feedback} reply={reply} setReply={setReply} sendReply={sendReply} updateFeedback={updateFeedback} busy={busy} />}
        {tab === 'risk' && overview && <AdminRiskPanel events={overview.events} reviewRisk={reviewRisk} />}
        {tab === 'cms' && landing && <AdminLandingCmsPanel landing={landing} setLanding={setLanding} updateLandingMedia={updateLandingMedia} uploadLandingMedia={uploadLandingMedia} saveLanding={saveLanding} busy={busy} />}
      {tab === 'audit' && <section className="admin-content"><div className="admin-panel admin-wide"><div className="admin-panel-head"><h2>{t('admin.console.audit.title')}</h2><small>{t('admin.console.audit.description')}</small></div><div className="admin-list">{audit.map((event)=><article key={event.id}><div><b>{event.action}</b><small>{event.actorRef} · {event.targetType} · {formatDate(event.createdAt)}</small></div></article>)}</div></div></section>}
      {tab === 'retention' && <section className="admin-content"><div className="admin-panel admin-wide retention-panel"><FileCog size={24}/><h2>{t('admin.console.retention.title')}</h2><p>{t('admin.console.retention.description')}</p><Button onClick={runRetention} disabled={busy}><RefreshCw size={14}/>{t('admin.console.retention.run')}</Button></div></section>}
      </>}
    </main>
  </div>;
}
