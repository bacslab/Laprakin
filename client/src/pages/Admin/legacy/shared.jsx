import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, LoaderCircle } from '../../../icons';
import { Button } from '../../../components/Button';
import CustomSelect from '../../../components/CustomSelect';
import { useI18n } from '../../../i18n/context';

export const ADMIN_REFRESH_EVENT = 'admin:refresh';
export const ADMIN_RESOURCE_UPDATED_EVENT = 'admin:resource-updated';

export function useAdminRouteResource(load, { events = [] } = {}) {
  const [resource, setResource] = useState({ data: null, loading: true, error: '', lastUpdated: null });
  const reload = useCallback(async () => {
    setResource((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await load();
      const timestamp = Date.now();
      setResource({ data, loading: false, error: '', lastUpdated: timestamp });
      window.dispatchEvent(new CustomEvent(ADMIN_RESOURCE_UPDATED_EVENT, { detail: { timestamp } }));
      return data;
    } catch (error) {
      setResource((current) => ({ ...current, loading: false, error: error.message || String(error) }));
      return null;
    }
  }, [load]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    const handleRefresh = () => { reload(); };
    window.addEventListener(ADMIN_REFRESH_EVENT, handleRefresh);
    return () => window.removeEventListener(ADMIN_REFRESH_EVENT, handleRefresh);
  }, [reload]);
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
    {resource.error && <div className="admin-route-error" role="alert"><AlertTriangle size={15}/><span>{resource.error}</span><Button variant="secondary" onClick={resource.reload}>{t('admin.console.retry')}</Button></div>}
    {children(resource.data, resource)}
  </>;
}

export function AdminListControls({ query, setQuery, pageInfo, statuses = [], extra = null }) {
  const { t } = useI18n();
  const cursor = Number.parseInt(query.cursor || '0', 10) || 0;
  const showPagination = Boolean(pageInfo?.nextCursor || cursor > 0);
  const hasFilters = statuses.length > 0 || Boolean(extra);
  if (!hasFilters && !showPagination) return null;
  return <div className="admin-list-controls">
    {statuses.length > 0 && <label>{t('admin.console.list.status')}<CustomSelect ariaLabel={t('admin.console.list.status')} value={query.status} onChange={(status) => setQuery({ status })} options={statuses.map(({ value, label }) => ({ value, label }))}/></label>}
    {extra}
    {showPagination && <div className="admin-list-pagination"><button type="button" aria-label={t('admin.console.list.previous')} title={t('admin.console.list.previous')} disabled={cursor <= 0} onClick={() => setQuery({ cursor: String(Math.max(0, cursor - query.limit)) })}><ArrowLeft size={16} /></button><span aria-label={t('admin.console.list.page', { page: Math.floor(cursor / query.limit) + 1 })}>{Math.floor(cursor / query.limit) + 1}</span><button type="button" aria-label={t('admin.console.list.next')} title={t('admin.console.list.next')} disabled={!pageInfo?.nextCursor} onClick={() => setQuery({ cursor: pageInfo.nextCursor })}><ArrowRight size={16} /></button></div>}
  </div>;
}
