import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Clock3, Search, X } from 'lucide-react';
import { api } from '../../api';

const RECENT_KEY = 'laprakin-admin-search-recent';

function loadRecent() {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(value) ? value.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveRecent(item) {
  try {
    const next = [{ id: item.id, title: item.title, path: item.path }, ...loadRecent().filter((entry) => entry.id !== item.id)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Local storage can be unavailable in private browsing; search remains usable.
  }
}

export default function AdminGlobalSearch({ t, navigate }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [recent, setRecent] = useState(loadRecent);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open || !query.trim()) {
      setResults([]);
      setLoading(false);
      setError('');
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const payload = await api(`/admin/search?q=${encodeURIComponent(query.trim())}&limit=24`, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setResults(payload.results || []);
          setSelected(0);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) setError(requestError.message || String(requestError));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [open, query]);

  const close = () => { setOpen(false); setQuery(''); setResults([]); };
  const openResult = (item) => {
    saveRecent(item);
    setRecent(loadRecent());
    close();
    navigate(item.path);
  };
  const visible = query.trim() ? results : recent;
  const onInputKeyDown = (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setSelected((value) => Math.min(Math.max(visible.length - 1, 0), value + 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setSelected((value) => Math.max(0, value - 1)); }
    if (event.key === 'Enter' && visible[selected]) { event.preventDefault(); openResult(visible[selected]); }
  };

  return <>
    <button type="button" className="admin-global-search-trigger" onClick={() => setOpen(true)} aria-label={t('admin.console.search.open')}><Search size={14}/><span>{t('admin.console.search.placeholder')}</span><kbd>Ctrl K</kbd></button>
    {open && <div className="admin-global-search-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="admin-global-search-dialog" role="dialog" aria-modal="true" aria-label={t('admin.console.search.title')}>
        <div className="admin-global-search-input-wrap"><Search size={17}/><input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onInputKeyDown} placeholder={t('admin.console.search.inputPlaceholder')} aria-label={t('admin.console.search.inputLabel')}/><button type="button" onClick={close} aria-label={t('admin.console.search.close')}><X size={16}/></button></div>
        <div className="admin-global-search-meta">{loading ? t('admin.console.search.searching') : query.trim() ? t('admin.console.search.results', { count: results.length }) : t('admin.console.search.recent')}</div>
        {error ? <p className="admin-global-search-error" role="alert">{error}</p> : visible.length ? <div className="admin-global-search-results" role="listbox">{visible.map((item, index) => <button type="button" role="option" aria-selected={index === selected} data-score={item.score || undefined} className={index === selected ? 'active' : ''} key={item.id} onMouseEnter={() => setSelected(index)} onClick={() => openResult(item)}><span className="admin-global-search-result-icon">{query.trim() ? <ArrowRight size={14}/> : <Clock3 size={14}/>}</span><span className="admin-global-search-result-copy"><b>{item.title}</b><small>{item.subtitle || item.path}</small></span><span className="admin-global-search-result-kind">{item.kind || t('admin.console.search.recentKind')}</span></button>)}</div> : <div className="admin-global-search-empty">{query.trim() ? t('admin.console.search.noResults') : t('admin.console.search.noRecent')}</div>}
        <div className="admin-global-search-hint"><kbd>↑↓</kbd> {t('admin.console.search.navigate')} <kbd>Enter</kbd> {t('admin.console.search.openHint')} <kbd>Esc</kbd> {t('admin.console.search.closeHint')}</div>
      </div>
    </div>}
  </>;
}
