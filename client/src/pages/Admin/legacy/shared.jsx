import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/Button';
import { formatDate } from '../../../lib/formatters';
import { useI18n } from '../../../i18n/context';

export function useAdminRouteResource(load, { events = [] } = {}) {
  const [resource, setResource] = useState({ data: null, loading: true, error: '', lastUpdated: null });
  const reload = useCallback(async () => {
    setResource((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await load();
      setResource({ data, loading: false, error: '', lastUpdated: Date.now() });
      return data;
    } catch (error) {
      setResource((current) => ({ ...current, loading: false, error: error.message || String(error) }));
      return null;
    }
  }, [load]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (!events.length) return undefined;
    const stream = new EventSource('/api/admin/events');
    events.forEach((eventName) => stream.addEventListener(eventName, reload));
    return () => stream.close();
  }, [events.join('|'), reload]);

  return { ...resource, reload, setData: (updater) => setResource((current) => ({ ...current, data: typeof updater === 'function' ? updater(current.data) : updater, lastUpdated: Date.now() })) };
}

export function AdminRouteState({ resource, children }) {
  const { t } = useI18n();
  if (resource.loading && resource.data === null) {
    return <div className="admin-loading-state" role="status" aria-live="polite"><LoaderCircle className="spin" size={20}/><b>{t('admin.console.loadingTitle')}</b><span>{t('admin.console.loadingDescription')}</span></div>;
  }
  if (resource.error && resource.data === null) {
    return <div className="admin-loading-state" role="alert"><AlertTriangle size={20}/><b>{t('admin.console.loadFailed')}</b><span>{resource.error}</span><Button variant="secondary" onClick={resource.reload}>{t('admin.console.retry')}</Button></div>;
  }
  return <>
    <div className="admin-route-status">
      {resource.error ? <span role="alert">{resource.error}</span> : <span>{t('admin.console.lastUpdated', { date: formatDate(resource.lastUpdated) })}</span>}
      <Button variant="secondary" onClick={resource.reload} disabled={resource.loading}><RefreshCw className={resource.loading ? 'spin' : ''} size={14}/>{t('admin.console.reload')}</Button>
    </div>
    {children(resource.data, resource)}
  </>;
}

export function AdminListControls({ query, setQuery, pageInfo, statuses = [], extra = null }) {
  const { t } = useI18n();
  const cursor = Number.parseInt(query.cursor || '0', 10) || 0;
  return <div className="admin-list-controls">
    <label>{t('admin.console.list.search')}<input aria-label={t('admin.console.list.search')} type="search" value={query.q} onChange={(event) => setQuery({ q: event.target.value }, { replace: true })} placeholder={t('admin.console.list.searchPlaceholder')}/></label>
    {statuses.length > 0 && <label>{t('admin.console.list.status')}<select aria-label={t('admin.console.list.status')} value={query.status} onChange={(event) => setQuery({ status: event.target.value })}>{statuses.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>}
    {extra}
    <div className="admin-list-pagination"><button type="button" disabled={cursor <= 0} onClick={() => setQuery({ cursor: String(Math.max(0, cursor - query.limit)) })}>{t('admin.console.list.previous')}</button><span>{t('admin.console.list.page', { page: Math.floor(cursor / query.limit) + 1 })}</span><button type="button" disabled={!pageInfo?.nextCursor} onClick={() => setQuery({ cursor: pageInfo.nextCursor })}>{t('admin.console.list.next')}</button></div>
  </div>;
}
