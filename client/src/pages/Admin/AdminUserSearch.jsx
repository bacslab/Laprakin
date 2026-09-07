import { Search, X } from '../../icons';

export default function AdminUserSearch({ value = '', onChange, label = 'Cari user', placeholder = 'Cari user' }) {
  return <div className="admin-user-search" role="search">
    <Search size={15} aria-hidden="true" />
    <input type="search" aria-label={label} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    {value && <button type="button" aria-label={`Hapus ${label.toLocaleLowerCase('id-ID')}`} onClick={() => onChange('')}><X size={13} aria-hidden="true" /></button>}
  </div>;
}

