import { useEffect, useRef } from 'react';
import { ChevronRight, HelpCircle, LogOut, Megaphone, Settings2, Sliders, Sparkles, UserRound } from 'lucide-react';
import { useApp } from '../../../state/ui-context';

function userInitials(user) {
  const source = String(user?.fullName || user?.email || 'Laprakin').trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase().slice(0, 2) || 'L';
}

export default function AccountPopover({ onOpen, onLogout, onClose, showUpgrade = true }) {
  const { user } = useApp();
  const ref = useRef(null);
  useEffect(() => {
    const closeOutside = (event) => { if (!ref.current || ref.current.contains(event.target)) return; onClose?.(); };
    window.addEventListener('mousedown', closeOutside);
    return () => window.removeEventListener('mousedown', closeOutside);
  }, [onClose]);
  return <div ref={ref} className="account-popover account-popover-fixed" onMouseDown={(event) => event.stopPropagation()}><div className="account-popover-head"><span className="account-popover-avatar" aria-hidden="true">{userInitials(user)}</span><div><b>{user?.fullName || 'Akun Laprakin'}</b><small>Workspace pribadi</small></div></div><div className="account-popover-divider" />{showUpgrade && <button onClick={() => onOpen('billing')}><Sparkles size={15} />Upgrade plan<ChevronRight size={14} /></button>}<button onClick={() => onOpen('settings-referral')}><Megaphone size={15} />Referral<ChevronRight size={14} /></button><button onClick={() => onOpen('settings-personalization')}><Sliders size={15} />Personalisasi</button><button onClick={() => onOpen('settings-academic')}><UserRound size={15} />Jurusan & prodi</button><button onClick={() => onOpen('settings-general')}><Settings2 size={15} />Settings</button><div className="account-popover-divider" /><button onClick={() => onOpen('help')}><HelpCircle size={15} />Help<ChevronRight size={14} /></button><button className="logout-item" onClick={onLogout}><LogOut size={15} />Log out<ChevronRight size={14} /></button></div>;
}
