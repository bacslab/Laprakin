import { useLocation, useNavigate } from '../../router';
import {
  AlertTriangle, BellRing, ClipboardList, CreditCard, FileCog, LayoutDashboard, LogOut, Mail,
  Megaphone, MessageCircle, MessageSquareText, Moon, Shield, Sparkles, Sun,
} from 'lucide-react';
import { api } from '../../api';
import { BrandMark } from '../../components/BrandMark';
import { legacyAdminPath, legacyAdminTab } from '../../lib/admin-ai';
import { resolveTheme, useResolvedTheme } from '../../lib/theme';
import { useApp } from '../../state/ui-context';
import { useI18n } from '../../i18n/context';
import AdminLegacyRoutes from './AdminLegacyRoutes';

export default function LegacyAdminWorkspace() {
  const { user, refreshSession, setNotice, prefs, setPrefs } = useApp();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const adminTheme = useResolvedTheme(prefs.theme || 'system');
  const setAdminTheme = (next) => setPrefs((value) => ({ ...value, theme: typeof next === 'function' ? next(resolveTheme(value.theme || 'system')) : next }));
  const tabs = [
    ['overview', t('admin.console.tabs.overview'), LayoutDashboard],
    ['ai', t('admin.console.tabs.ai'), Sparkles],
    ['credits', t('admin.console.tabs.credits'), CreditCard],
    ['pricing', t('admin.console.tabs.pricing'), CreditCard],
    ['alerts', t('admin.console.tabs.alerts'), BellRing],
    ['integrations', t('admin.console.tabs.integrations'), Sparkles],
    ['updates', t('admin.console.tabs.updates'), BellRing],
    ['broadcasts', t('admin.console.tabs.broadcasts'), Mail],
    ['feedback', t('admin.console.tabs.feedback'), MessageSquareText],
    ['users', t('admin.console.tabs.users'), Shield],
    ['appeals', t('admin.console.tabs.appeals'), MessageCircle],
    ['risk', t('admin.console.tabs.risk'), AlertTriangle],
    ['cms', t('admin.console.tabs.cms'), Megaphone],
    ['audit', t('admin.console.tabs.audit'), ClipboardList],
    ['retention', t('admin.console.tabs.retention'), FileCog],
  ];
  const requestedTab = legacyAdminTab(location.pathname);
  const tab = tabs.some(([key]) => key === requestedTab && key !== 'ai') ? requestedTab : 'overview';
  const tabGroups = [
    [t('admin.console.groups.operations'), ['overview', 'ai', 'credits', 'pricing', 'alerts', 'integrations']],
    [t('admin.console.groups.content'), ['updates', 'broadcasts', 'feedback', 'cms']],
    [t('admin.console.groups.security'), ['users', 'appeals', 'risk', 'audit', 'retention']],
  ];

  return <div className={`admin-workspace ${adminTheme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
    <aside className="admin-sidebar">
      <div className="admin-brand"><BrandMark alt=""/><div><b>Laprakin</b><small>{t('admin.console.adminConsole')}</small></div></div>
      <nav>{tabGroups.map(([group, keys]) => <div className="admin-nav-group" key={group}><small>{group}</small>{keys.map((key) => {
        const [, label, Icon] = tabs.find(([tabKey]) => tabKey === key);
        const routePath = key === 'ai' ? '/admin/ai/providers' : legacyAdminPath(key);
        return <button key={key} className={tab === key ? 'active' : ''} onClick={() => navigate(routePath)} title={label}><Icon size={16}/><span>{label}</span></button>;
      })}</div>)}</nav>
      <div className="admin-sidebar-foot"><div><span>{(user.email || 'A').slice(0, 1).toUpperCase()}</span><small>{user.email}</small></div><button onClick={async () => { await api('/auth/logout', { method: 'POST', body: {} }); await refreshSession(); navigate('/'); }}><LogOut size={15}/>{t('admin.console.logout')}</button></div>
    </aside>
    <main className="admin-main">
      <header className="admin-header"><div><p>{t('admin.console.adminConsole')}</p><h1>{tabs.find(([key]) => key === tab)?.[1]}</h1></div><div className="admin-header-actions"><button className="admin-theme-toggle" onClick={() => setAdminTheme((value) => value === 'dark' ? 'light' : 'dark')} title={t('admin.console.adminTheme')} aria-label={t('admin.console.adminTheme')}>{adminTheme === 'dark' ? <Sun size={15}/> : <Moon size={15}/>}</button></div></header>
      <AdminLegacyRoutes tab={tab} setNotice={setNotice}/>
    </main>
  </div>;
}
