import { useCallback, useMemo } from 'react';
import { Activity, Bot, History, LogOut, Moon, Network, ServerCog, Sun } from 'lucide-react';
import { api } from '../../../api';
import { BrandMark } from '../../../components/BrandMark';
import { ADMIN_AI_PATHS, adminAiAffordances, createAdminAiClient } from '../../../lib/admin-ai';
import { resolveTheme, useResolvedTheme } from '../../../lib/theme';
import { Link, useLocation, useNavigate } from '../../../router';
import { useApp } from '../../../state/ui-context';
import AdminAiRoutes from './AdminAiRoutes';
import { AdminAiProvider, AdminResource, useAdminAiCopy, useAdminResource } from './shared';

const NAV_ITEMS = [
  ['providers', ADMIN_AI_PATHS.providers, ServerCog],
  ['models', ADMIN_AI_PATHS.models, Bot],
  ['routing', ADMIN_AI_PATHS.routing, Network],
  ['health', ADMIN_AI_PATHS.health, Activity],
  ['changes', ADMIN_AI_PATHS.changes, History],
];

export default function AdminAiWorkspace({ embedded = false }) {
  const { user, refreshSession, prefs, setPrefs } = useApp();
  const t = useAdminAiCopy();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useResolvedTheme(prefs.theme || 'system');
  const client = useMemo(() => createAdminAiClient(api), []);
  const loadCapabilities = useCallback(() => client.capabilities(), [client]);
  const capabilitiesResource = useAdminResource(loadCapabilities);
  const setTheme = (next) => setPrefs((value) => ({ ...value, theme: typeof next === 'function' ? next(resolveTheme(value.theme || 'system')) : next }));
  const logout = async () => {
    await api('/auth/logout', { method: 'POST', body: {} });
    await refreshSession();
    navigate('/');
  };
  return <div className={`admin-ai-shell ${embedded ? 'admin-ai-embedded' : ''} ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
    {!embedded && <aside className="admin-ai-sidebar">
      <Link className="admin-ai-brand" to="/admin"><BrandMark alt="" /><span><b>Laprakin</b><small>{t('common.admin')}</small></span></Link>
      <nav aria-label={t('common.navigation')}>
        <p>{t('common.controlPlane')}</p>
        {NAV_ITEMS.map(([key, path, Icon]) => <Link key={key} to={path} className={location.pathname.startsWith(path) ? 'active' : ''}><Icon size={16} /><span>{t(`nav.${key}`)}</span></Link>)}
        <p>{t('common.admin')}</p>
        <Link to="/admin"><ServerCog size={16} /><span>{t('common.mainConsole')}</span></Link>
      </nav>
      <div className="admin-ai-sidebar-foot"><span>{(user?.email || 'A').slice(0, 1).toUpperCase()}</span><div><b>{user?.email}</b><small>{capabilitiesResource.data?.role || user?.role}</small></div><button type="button" onClick={logout} aria-label={t('common.logout')}><LogOut size={15} /></button></div>
    </aside>}
    <main className="admin-ai-main">
      <div className="admin-ai-topbar"><div><span className="admin-ai-environment">{embedded ? t('common.controlPlane') : t('common.productionControls')}</span><b>{embedded ? 'AI & Login' : t('common.configuration')}</b></div><button type="button" className="admin-ai-theme" onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')} aria-label={t('common.changeTheme')}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button></div>
      {embedded && <nav className="admin-ai-embedded-nav" aria-label={t('common.navigation')}>
        {NAV_ITEMS.map(([key, path, Icon]) => <Link key={key} to={path} className={location.pathname.startsWith(path) ? 'active' : ''}><Icon size={14} /><span>{t(`nav.${key}`)}</span></Link>)}
      </nav>}
      <AdminResource resource={capabilitiesResource} label={t('common.permissions')}>{(data) => <AdminAiProvider value={{ client, capabilities: data.capabilities || [], affordances: adminAiAffordances(data.capabilities || []) }}><AdminAiRoutes /></AdminAiProvider>}</AdminResource>
    </main>
  </div>;
}
