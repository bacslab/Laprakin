import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Shield } from 'lucide-react';
import { api } from '../../api';
import { formatDate } from '../../lib/formatters';
import { Button } from '../../components/Button';
import { CustomSelect } from '../../components/CustomSelect';
import { useI18n } from '../../i18n/context';

export default function AdminAccessPanel({ users, selectedUserId = '', onSelectUser, setNotice, onRefresh }) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState(selectedUserId || users[0]?.id || '');
  const [rooms, setRooms] = useState([]);
  const [restrictions, setRestrictions] = useState([]);
  const [form, setForm] = useState({ targetType: 'account', durationDays: '7', permanent: false, reason: '' });
  const [planForm, setPlanForm] = useState({ planKey: 'free', durationDays: '30' });
  const [busy, setBusy] = useState(false);
  const selected = users.find((item) => item.id === selectedId);
  useEffect(() => { setSelectedId(selectedUserId || users[0]?.id || ''); }, [selectedUserId, users]);
  const loadDetails = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const [roomData, restrictionData] = await Promise.all([
        api(`/admin/users/${userId}/rooms`),
        api(`/admin/users/${userId}/restrictions`),
      ]);
      setRooms(roomData.rooms || []);
      setRestrictions(restrictionData.restrictions || []);
    } catch (error) { setNotice(error.message); }
  }, [setNotice]);
  useEffect(() => { loadDetails(selectedId); }, [selectedId, loadDetails]);
  useEffect(() => {
    setPlanForm({
      planKey: ['monthly', 'pro'].includes(selected?.planKey) ? selected.planKey : 'free',
      durationDays: '30',
    });
  }, [selectedId, selected?.planKey]);
  const changePlan = async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await api(`/admin/users/${selectedId}/plan`, {
        method: 'PUT',
        body: {
          planKey: planForm.planKey,
          durationDays: Number(planForm.durationDays || 30),
        },
      });
      await onRefresh();
      setNotice(t('admin.console.access.planUpdated', { user: selected?.email || t('admin.console.access.user') }));
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const createRestriction = async () => {
    if (!selectedId || form.reason.trim().length < 8) return;
    setBusy(true);
    try {
      await api(`/admin/users/${selectedId}/restrictions`, {
        method: 'POST',
        body: {
          targetType: form.targetType,
          durationDays: form.permanent ? null : Number(form.durationDays),
          reason: form.reason,
        },
      });
      setForm((value) => ({ ...value, reason: '' }));
      await Promise.all([loadDetails(selectedId), onRefresh()]);
      setNotice(t('admin.console.access.restrictionApplied'));
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const revokeRestriction = async (restrictionId) => {
    setBusy(true);
    try {
      await api(`/admin/users/${selectedId}/restrictions/${restrictionId}`, { method: 'DELETE' });
      await Promise.all([loadDetails(selectedId), onRefresh()]);
      setNotice(t('admin.console.access.restrictionRevoked'));
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  return <section className="admin-content admin-access-layout">
    <section className="admin-panel admin-user-picker"><div className="admin-panel-head"><h2>{t('admin.console.access.user')}</h2><small>{t('admin.console.access.accountCount', { count: users.length })}</small></div><div className="admin-list">{users.map((item) => <button type="button" key={item.id} className={selectedId === item.id ? 'active' : ''} onClick={() => { setSelectedId(item.id); onSelectUser?.(item.id); }}><div><b>{item.fullName || item.email}</b><small>{item.email} · {item.plan}</small></div><span>{item.restrictionCount ? t('admin.console.access.restrictionCount', { count: item.restrictionCount }) : t('admin.console.access.roomCount', { count: item.roomCount })}</span></button>)}</div></section>
    <div className="admin-access-detail">
       <section className="admin-panel"><div className="admin-panel-head"><div><h2>{selected?.fullName || selected?.email || t('admin.console.access.chooseUser')}</h2><small>{selected ? t('admin.console.access.planDetails', { messages: selected.messageCount, tokens: Number(selected.totalTokens || 0).toLocaleString('id-ID') }) : ''}</small></div></div>{selected && <><div className="admin-plan-control"><label htmlFor="admin-plan-key">{t('admin.console.access.plan')}<CustomSelect id="admin-plan-key" ariaLabel={t('admin.console.access.planAria')} value={planForm.planKey} onChange={(planKey) => setPlanForm((value) => ({ ...value, planKey }))} options={[{value:'free',label:t('admin.console.access.free')},{value:'monthly',label:t('admin.console.access.pro')},{value:'pro',label:t('admin.console.access.max')}]} /></label>{planForm.planKey !== 'free' && <label>{t('admin.console.access.duration')}<input aria-label={t('admin.console.access.duration')} type="number" min="1" max="3650" value={planForm.durationDays} onChange={(event) => setPlanForm((value) => ({ ...value, durationDays: event.target.value }))}/><small>{t('admin.console.access.days')}</small></label>}<Button onClick={changePlan} disabled={busy}><CreditCard size={14}/>{t('admin.console.access.changePlan')}</Button><span>{t('admin.console.access.currentPlan')}: <b>{selected.plan}</b></span></div><div className="admin-restriction-form"><label htmlFor="admin-restriction-target">{t('admin.console.access.restrictionType')}<CustomSelect id="admin-restriction-target" ariaLabel={t('admin.console.access.restrictionAria')} value={form.targetType} onChange={(targetType) => setForm((value) => ({ ...value, targetType }))} options={[{value:'account',label:t('admin.console.access.suspendAccount')},{value:'device',label:t('admin.console.access.blockDevice')},{value:'ip',label:t('admin.console.access.blockNetwork')}]} /></label><label className="admin-permanent-check"><input aria-label={t('admin.console.access.permanent')} type="checkbox" checked={form.permanent} onChange={(event) => setForm((value) => ({ ...value, permanent: event.target.checked }))}/><span>{t('admin.console.access.permanent')}</span></label>{!form.permanent && <label>{t('admin.console.access.duration')}<input aria-label={t('admin.console.access.durationAria')} type="number" min="1" max="3650" value={form.durationDays} onChange={(event) => setForm((value) => ({ ...value, durationDays: event.target.value }))}/></label>}<label className="admin-form-wide">{t('admin.console.access.reason')}<textarea aria-label={t('admin.console.access.reasonAria')} maxLength="280" value={form.reason} onChange={(event) => setForm((value) => ({ ...value, reason: event.target.value }))} placeholder={t('admin.console.access.reasonPlaceholder')}/></label><Button onClick={createRestriction} disabled={busy || form.reason.trim().length < 8}><Shield size={14}/>{t('admin.console.access.apply')}</Button></div></>}</section>
      <section className="admin-panel"><div className="admin-panel-head"><h2>{t('admin.console.access.restrictions')}</h2><small>{t('admin.console.access.pseudonymous')}</small></div><div className="admin-list">{restrictions.length ? restrictions.map((item) => <article key={item.id}><div><b>{item.targetType === 'account' ? t('admin.console.access.account') : item.targetType === 'device' ? t('admin.console.access.device') : t('admin.console.access.network')}</b><small>{item.reason} · {item.permanent ? t('admin.console.access.permanentStatus') : t('admin.console.access.until', { date: formatDate(item.expiresAt) })}</small></div><div className="admin-actions"><span className={`status-${item.status === 'active' ? 'failed' : 'completed'}`}>{item.status}</span>{item.status === 'active' && <button type="button" onClick={() => revokeRestriction(item.id)}>{t('admin.console.access.revoke')}</button>}</div></article>) : <p className="empty-admin">{t('admin.console.access.noRestrictions')}</p>}</div></section>
      <section className="admin-panel"><div className="admin-panel-head"><h2>{t('admin.console.access.rooms')}</h2><small>{t('admin.console.access.usageMetadata')}</small></div><div className="admin-list">{rooms.length ? rooms.map((room) => <article key={room.id}><div><b>{room.title}</b><small>{t('admin.console.access.updated')} {formatDate(room.updatedAt)}</small></div><span>{t('admin.console.access.messagesTokens', { messages: room.messageCount, tokens: Number(room.totalTokens || 0).toLocaleString('id-ID') })}</span></article>) : <p className="empty-admin">{t('admin.console.access.noRooms')}</p>}</div></section>
    </div>
  </section>;
}
