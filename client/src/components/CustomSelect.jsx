import { useId, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export function CustomSelect({ value, onChange, options, className = '', disabled = false, ariaLabel = 'Pilih opsi' }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, options.findIndex((item) => item.value === value)));
  const selectId = useId();
  const currentIndex = Math.max(0, options.findIndex((item) => item.value === value));
  const current = options[currentIndex] || options[0];
  const choose = (item) => { onChange(item.value); setOpen(false); setActiveIndex(Math.max(0, options.indexOf(item))); };
  const moveActive = (nextIndex) => setActiveIndex(Math.max(0, Math.min(options.length - 1, nextIndex)));
  const handleKeyDown = (event) => {
    if (disabled || !options.length) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); moveActive(open ? activeIndex + 1 : currentIndex); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); moveActive(open ? activeIndex - 1 : currentIndex); }
    if (event.key === 'Home') { event.preventDefault(); setOpen(true); moveActive(0); }
    if (event.key === 'End') { event.preventDefault(); setOpen(true); moveActive(options.length - 1); }
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActiveIndex(currentIndex); }
    if ((event.key === 'Enter' || event.key === ' ') && open) { event.preventDefault(); choose(options[activeIndex] || current); }
  };
  return <div className={`select-menu ${className}`}>
    <button type="button" className="select-trigger" disabled={disabled} aria-label={ariaLabel} aria-expanded={open} aria-haspopup="listbox" aria-activedescendant={open && options[activeIndex] ? `${selectId}-option-${activeIndex}` : undefined} onClick={() => { setOpen(!open); setActiveIndex(currentIndex); }} onKeyDown={handleKeyDown}>
      <span>{current?.label || 'Pilih'}</span><ChevronDown size={14} />
    </button>
    {open && <div className="select-options" role="listbox" aria-label={ariaLabel}>{options.map((item, index) => <button id={`${selectId}-option-${index}`} key={item.value} type="button" role="option" aria-selected={item.value === value} className={`${item.value === value ? 'selected' : ''} ${index === activeIndex ? 'active' : ''}`} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(item)}><span>{item.label}</span>{item.value === value && <Check size={13} />}</button>)}</div>}
  </div>;
}

export default CustomSelect;
