import { useEffect, useRef, useState } from 'react';
import { CircleAlert, Pencil, Trash2, X } from 'lucide-react';
import { useFocusReturn } from '../hooks/useFocusReturn';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { IconButton } from './IconButton';
import { useI18n } from '../i18n/context';

export function AppDialog({ dialog, onResolve }) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const dialogRef = useRef(null);
  const promptInputRef = useRef(null);
  useFocusReturn(Boolean(dialog));
  useFocusTrap(dialogRef, Boolean(dialog));
  const isPrompt = dialog?.kind === 'prompt';
  useEffect(() => { setValue(dialog?.initialValue || ''); }, [dialog]);
  useEffect(() => {
    if (!dialog || !isPrompt) return undefined;
    const frame = window.requestAnimationFrame(() => promptInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [dialog, isPrompt]);
  if (!dialog) return null;
  const close = (result) => onResolve(isPrompt && result === true ? value.trim() : result);
  return <div className="app-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(isPrompt ? null : false); }}><section ref={dialogRef} className={`app-dialog ${dialog.destructive ? 'is-danger' : ''}`} role="dialog" aria-modal="true" aria-labelledby="app-dialog-title"><div className="app-dialog-icon">{dialog.destructive ? <Trash2 size={17} /> : isPrompt ? <Pencil size={17} /> : <CircleAlert size={17} />}</div><div className="app-dialog-copy"><h2 id="app-dialog-title">{dialog.title || t('common.dialogConfirm')}</h2>{dialog.message && <p>{dialog.message}</p>}</div>{isPrompt && <form onSubmit={(event) => { event.preventDefault(); close(true); }}><input ref={promptInputRef} aria-label={dialog.title || t('common.dialogInput')} value={value} onChange={(event) => setValue(event.target.value)} placeholder={dialog.placeholder || ''} maxLength={dialog.maxLength || 100} /><div className="app-dialog-actions"><button type="button" className="app-dialog-cancel" onClick={() => close(null)}>{t('common.cancel')}</button><button type="submit" className="app-dialog-confirm">{dialog.confirmLabel || t('common.save')}</button></div></form>}{!isPrompt && <div className="app-dialog-actions"><button type="button" className="app-dialog-cancel" onClick={() => close(false)}>{t('common.cancel')}</button><button type="button" className="app-dialog-confirm" onClick={() => close(true)}>{dialog.confirmLabel || t('common.continue')}</button></div>}</section></div>;
}

export function Modal({ title, onClose, children, className = '' }) {
  const { t } = useI18n();
  const modalRef = useRef(null);
  useFocusReturn(true);
  useFocusTrap(modalRef, true);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const modal = modalRef.current;
      const firstVisibleControl = [...(modal?.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]') || [])]
        .find((element) => element.offsetParent !== null);
      (firstVisibleControl || modal)?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => { const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={modalRef} className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby="workspace-modal-title" tabIndex={-1}><header><b id="workspace-modal-title">{title}</b><IconButton label={t('common.modalClose')} onClick={onClose}><X size={16}/></IconButton></header>{children}</section></div>;
}
