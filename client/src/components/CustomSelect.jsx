import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export function CustomSelect({ value, onChange, options, className = '', disabled = false, ariaLabel = 'Pilih opsi' }) {
  const [open, setOpen] = useState(false);
  const current = options.find((item) => item.value === value) || options[0];
  return <div className={`select-menu ${className}`}>
    <button type="button" className="select-trigger" disabled={disabled} aria-label={ariaLabel} aria-expanded={open} onClick={() => setOpen(!open)}>
      <span>{current?.label || 'Pilih'}</span><ChevronDown size={14} />
    </button>
    {open && <div className="select-options">{options.map((item) => <button key={item.value} type="button" className={item.value === value ? 'selected' : ''} onClick={() => { onChange(item.value); setOpen(false); }}><span>{item.label}</span>{item.value === value && <Check size={13} />}</button>)}</div>}
  </div>;
}

export default CustomSelect;
