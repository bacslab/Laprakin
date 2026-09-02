import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { formatDate } from '../../lib/formatters';

export default function AdminAppealsPanel({ setNotice, onRefresh }) {
  const [appeals, setAppeals] = useState([]);
  const [replies, setReplies] = useState({});
  const [busy, setBusy] = useState(false);
  const loadAppeals = useCallback(() => api('/admin/appeals?status=all').then((data) => setAppeals(data.appeals || [])).catch((error) => setNotice(error.message)), [setNotice]);
  useEffect(() => { loadAppeals(); }, [loadAppeals]);
  const review = async (appeal, status) => {
    const reply = (replies[appeal.id] || '').trim();
    if (reply.length < 4) return;
    setBusy(true);
    try {
      await api(`/admin/appeals/${appeal.id}`, {
        method: 'PUT',
        body: { status, reply, liftRestrictions: status === 'approved' },
      });
      await Promise.all([loadAppeals(), onRefresh()]);
      setNotice(status === 'approved' ? 'Appeal disetujui dan pembatasan akun dicabut.' : 'Hasil appeal dikirim ke user.');
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  return <section className="admin-content"><div className="admin-panel admin-wide"><div className="admin-panel-head"><h2>Appeal akun</h2><small>User menerima hasil lewat email</small></div><div className="admin-list admin-appeal-list">{appeals.length ? appeals.map((appeal) => <article key={appeal.id}><div className="admin-appeal-copy"><div><b>{appeal.userName || appeal.userEmail || 'Akun tidak aktif'}</b><small>{appeal.userEmail || 'Email terlindungi'} · {formatDate(appeal.createdAt)}</small></div><p>{appeal.message}</p>{appeal.status === 'open' ? <textarea aria-label={`Balasan appeal untuk ${appeal.userEmail || 'user'}`} value={replies[appeal.id] || ''} onChange={(event) => setReplies((value) => ({ ...value, [appeal.id]: event.target.value }))} placeholder="Tulis hasil peninjauan untuk user."/> : <small className="admin-reply">{appeal.adminReply}</small>}</div><div className="admin-actions"><span className={`status-${appeal.status === 'approved' ? 'completed' : appeal.status === 'open' ? 'queued' : 'failed'}`}>{appeal.status}</span>{appeal.status === 'open' && <><button disabled={busy} onClick={() => review(appeal, 'approved')}>Setujui</button><button disabled={busy} onClick={() => review(appeal, 'rejected')}>Tolak</button></>}</div></article>) : <p className="empty-admin">Belum ada appeal.</p>}</div></div></section>;
}
