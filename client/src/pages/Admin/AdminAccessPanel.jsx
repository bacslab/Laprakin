import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Shield } from 'lucide-react';
import { api } from '../../api';
import { formatDate } from '../../lib/formatters';
import { Button } from '../../components/Button';
import { CustomSelect } from '../../components/CustomSelect';

export default function AdminAccessPanel({ users, setNotice, onRefresh }) {
  const [selectedId, setSelectedId] = useState(users[0]?.id || '');
  const [rooms, setRooms] = useState([]);
  const [restrictions, setRestrictions] = useState([]);
  const [form, setForm] = useState({ targetType: 'account', durationDays: '7', permanent: false, reason: '' });
  const [planForm, setPlanForm] = useState({ planKey: 'free', durationDays: '30' });
  const [busy, setBusy] = useState(false);
  const selected = users.find((item) => item.id === selectedId);
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
      setNotice(`Plan ${selected?.email || 'user'} berhasil diperbarui.`);
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
      setNotice('Pembatasan diterapkan dan user menerima pemberitahuan email.');
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const revokeRestriction = async (restrictionId) => {
    setBusy(true);
    try {
      await api(`/admin/users/${selectedId}/restrictions/${restrictionId}`, { method: 'DELETE' });
      await Promise.all([loadDetails(selectedId), onRefresh()]);
      setNotice('Pembatasan dicabut.');
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  return <section className="admin-content admin-access-layout">
    <section className="admin-panel admin-user-picker"><div className="admin-panel-head"><h2>User</h2><small>{users.length} akun</small></div><div className="admin-list">{users.map((item) => <button type="button" key={item.id} className={selectedId === item.id ? 'active' : ''} onClick={() => setSelectedId(item.id)}><div><b>{item.fullName || item.email}</b><small>{item.email} · {item.plan}</small></div><span>{item.restrictionCount ? `${item.restrictionCount} batasan` : `${item.roomCount} room`}</span></button>)}</div></section>
    <div className="admin-access-detail">
       <section className="admin-panel"><div className="admin-panel-head"><div><h2>{selected?.fullName || selected?.email || 'Pilih user'}</h2><small>{selected ? `${selected.messageCount} pesan · ${Number(selected.totalTokens || 0).toLocaleString('id-ID')} token` : ''}</small></div></div>{selected && <><div className="admin-plan-control"><label htmlFor="admin-plan-key">Plan akun<CustomSelect id="admin-plan-key" ariaLabel="Plan akun" value={planForm.planKey} onChange={(planKey) => setPlanForm((value) => ({ ...value, planKey }))} options={[{value:'free',label:'Gratis'},{value:'monthly',label:'Pro'},{value:'pro',label:'Max'}]} /></label>{planForm.planKey !== 'free' && <label>Masa aktif<input aria-label="Masa aktif plan" type="number" min="1" max="3650" value={planForm.durationDays} onChange={(event) => setPlanForm((value) => ({ ...value, durationDays: event.target.value }))}/><small>hari</small></label>}<Button onClick={changePlan} disabled={busy}><CreditCard size={14}/>Ubah plan</Button><span>Plan saat ini: <b>{selected.plan}</b></span></div><div className="admin-restriction-form"><label htmlFor="admin-restriction-target">Jenis pembatasan<CustomSelect id="admin-restriction-target" ariaLabel="Jenis pembatasan" value={form.targetType} onChange={(targetType) => setForm((value) => ({ ...value, targetType }))} options={[{value:'account',label:'Suspend akun'},{value:'device',label:'Blokir perangkat terkait'},{value:'ip',label:'Blokir jaringan terkait'}]} /></label><label className="admin-permanent-check"><input aria-label="Permanen" type="checkbox" checked={form.permanent} onChange={(event) => setForm((value) => ({ ...value, permanent: event.target.checked }))}/><span>Permanen</span></label>{!form.permanent && <label>Durasi hari<input aria-label="Durasi pembatasan" type="number" min="1" max="3650" value={form.durationDays} onChange={(event) => setForm((value) => ({ ...value, durationDays: event.target.value }))}/></label>}<label className="admin-form-wide">Alasan untuk user<textarea aria-label="Alasan pembatasan" maxLength="280" value={form.reason} onChange={(event) => setForm((value) => ({ ...value, reason: event.target.value }))} placeholder="Jelaskan alasan tanpa istilah teknis."/></label><Button onClick={createRestriction} disabled={busy || form.reason.trim().length < 8}><Shield size={14}/>Terapkan pembatasan</Button></div></>}</section>
      <section className="admin-panel"><div className="admin-panel-head"><h2>Pembatasan</h2><small>Target disimpan secara pseudonim</small></div><div className="admin-list">{restrictions.length ? restrictions.map((item) => <article key={item.id}><div><b>{item.targetType === 'account' ? 'Akun' : item.targetType === 'device' ? 'Perangkat' : 'Jaringan'}</b><small>{item.reason} · {item.permanent ? 'Permanen' : `hingga ${formatDate(item.expiresAt)}`}</small></div><div className="admin-actions"><span className={`status-${item.status === 'active' ? 'failed' : 'completed'}`}>{item.status}</span>{item.status === 'active' && <button type="button" onClick={() => revokeRestriction(item.id)}>Cabut</button>}</div></article>) : <p className="empty-admin">Tidak ada pembatasan.</p>}</div></section>
      <section className="admin-panel"><div className="admin-panel-head"><h2>Roomchat</h2><small>Hanya metadata pemakaian</small></div><div className="admin-list">{rooms.length ? rooms.map((room) => <article key={room.id}><div><b>{room.title}</b><small>Diperbarui {formatDate(room.updatedAt)}</small></div><span>{room.messageCount} pesan · {Number(room.totalTokens || 0).toLocaleString('id-ID')} token</span></article>) : <p className="empty-admin">Belum ada roomchat.</p>}</div></section>
    </div>
  </section>;
}
