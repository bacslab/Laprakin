import { useCallback, useState } from 'react';
import { FileCog, RefreshCw } from 'lucide-react';
import { api } from '../../../api';
import { Button } from '../../../components/Button';
import { useI18n } from '../../../i18n/context';
import { AdminRouteState, useAdminRouteResource } from './shared';

export default function RetentionRoute({ setNotice }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => ({ ready: true }), []);
  const resource = useAdminRouteResource(load);
  const run = async () => {
    setBusy(true);
    try {
      const data = await api('/admin/retention/run', { method: 'POST', body: {} });
      setNotice(t('admin.console.retention.done', { documents: data.deletedDocuments || 0, objects: data.deletedObjects || 0 }));
      await resource.reload();
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  return <AdminRouteState resource={resource}>{() => <section className="admin-content admin-retention-page"><div className="admin-panel admin-wide retention-panel"><FileCog size={24}/><h2>{t('admin.console.retention.title')}</h2><p>{t('admin.console.retention.description')}</p><Button onClick={run} disabled={busy}><RefreshCw size={14}/>{t('admin.console.retention.run')}</Button></div></section>}</AdminRouteState>;
}
