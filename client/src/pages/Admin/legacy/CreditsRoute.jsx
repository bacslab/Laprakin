import { useCallback, useState } from 'react';
import { CreditCard } from '../../../icons';
import { api } from '../../../api';
import { Button } from '../../../components/Button';
import { CustomSelect } from '../../../components/CustomSelect';
import { useI18n } from '../../../i18n/context';
import AdminUserSearch from '../AdminUserSearch';
import { filterAdminUsers } from '../user-search';
import { AdminListControls, AdminRouteState, useAdminRouteResource } from './shared';
import { adminListApiPath } from './list-query';
import { useAdminListQuery } from './use-admin-list-query';

export default function CreditsRoute({ setNotice }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ audience: 'user', userId: '', amount: 1, reason: '' });
  const [busy, setBusy] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [query, setQuery] = useAdminListQuery('/admin/credits', { limit: 25 });
  const load = useCallback(() => api(adminListApiPath('/admin/users', query)), [query.q, query.cursor, query.limit]);
  const resource = useAdminRouteResource(load, { events: ['credit'] });
  const visibleUsers = filterAdminUsers(resource.data?.users || [], userSearch, form.userId);
  const grant = async () => {
    setBusy(true);
    try {
      const result = await api('/admin/credits/grant', { method: 'POST', body: { ...form, amount: Number(form.amount), idempotencyKey: `admin-credit:${crypto.randomUUID()}` } });
      setNotice(t('admin.console.credits.grantNotice', { count: result.recipientCount, amount: result.amount }));
      await resource.reload();
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  return <AdminRouteState resource={resource}>{(data) => <><AdminListControls query={query} setQuery={setQuery} pageInfo={data.pageInfo}/><section className="admin-content admin-credits-page"><div className="admin-grid"><section className="admin-panel admin-credit-panel"><div className="admin-panel-head"><h2>{t('admin.console.credits.title')}</h2><small>{t('admin.console.credits.description')}</small></div><label htmlFor="admin-credit-audience">{t('admin.console.credits.target')}<CustomSelect id="admin-credit-audience" ariaLabel={t('admin.console.credits.targetAria')} value={form.audience} onChange={(audience) => setForm((value) => ({ ...value, audience }))} options={[{ value: 'user', label: t('admin.console.credits.singleUser') }, { value: 'all', label: t('admin.console.credits.verifiedUsers') }, { value: 'paid', label: t('admin.console.credits.paidUsers') }]}/></label>{form.audience === 'user' && <><AdminUserSearch value={userSearch} onChange={setUserSearch} label={t('admin.console.list.search')} placeholder={t('admin.console.list.searchPlaceholder')} /><label htmlFor="admin-credit-user">{t('admin.console.credits.user')}<CustomSelect id="admin-credit-user" ariaLabel={t('admin.console.credits.recipientAria')} value={form.userId} onChange={(userId) => setForm((value) => ({ ...value, userId }))} options={[{ value: '', label: t('admin.console.credits.chooseUser') }, ...visibleUsers.map((item) => ({ value: item.id, label: `${item.userRef} · ${t('admin.console.credits.creditsCount', { count: item.credits })}` }))]}/></label>{!visibleUsers.length && <p className="admin-user-search-empty">{t('admin.console.list.noResults')}</p>}</>}<label>{t('admin.console.credits.amount')}<input aria-label={t('admin.console.credits.amountAria')} type="number" min="1" max="100" value={form.amount} onChange={(event) => setForm((value) => ({ ...value, amount: event.target.value }))}/></label><label>{t('admin.console.credits.reason')}<input aria-label={t('admin.console.credits.reasonAria')} maxLength="160" value={form.reason} placeholder={t('admin.console.credits.defaultReason')} onChange={(event) => setForm((value) => ({ ...value, reason: event.target.value }))}/></label><Button onClick={grant} disabled={busy || (form.audience === 'user' && !form.userId)}><CreditCard size={14}/>{t('admin.console.credits.add')}</Button></section><section className="admin-panel"><div className="admin-panel-head"><h2>{t('admin.console.credits.recentUsers')}</h2><small>{t('admin.console.credits.accountCount', { count: data.users.length })}</small></div><div className="admin-list admin-user-list">{data.users.map((item) => <article key={item.id}><div><b>{item.userRef}</b><small>{item.plan}</small></div><span>{t('admin.console.credits.creditsCount', { count: item.credits })}</span></article>)}</div></section></div></section></>}</AdminRouteState>;
}
