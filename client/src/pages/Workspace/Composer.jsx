import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, ClipboardList, FileText, GraduationCap, LayoutTemplate, LockKeyhole, Pencil, Plus, Send } from 'lucide-react';
import { CustomSelect } from '../../components/CustomSelect';
import { PendingAttachmentChip } from './AttachmentComponents';

function AiModeMenu({ value, onChange, access = {}, onUpgrade }) {
  const [open, setOpen] = useState(false);
  const modes = [
    { key: 'basic', label: 'Basic', description: 'Untuk laprak harian', unlock: 'Tersedia untuk semua' },
    { key: 'thinking', label: 'Thinking', description: 'Analisis lebih terarah', unlock: 'Credit Laprak atau Pro' },
    { key: 'xtrathink', label: 'XtraThink', description: 'Penalaran paling mendalam', unlock: 'Khusus Max' },
  ];
  const current = modes.find((item) => item.key === value) || modes[0];
  useEffect(() => { if (!open) return undefined; const timer = window.setTimeout(() => setOpen(false), 5000); return () => window.clearTimeout(timer); }, [open]);
  const choose = (mode) => {
    if (!access?.[mode.key]?.available) { setOpen(false); onUpgrade?.(); return; }
    onChange(mode.key); setOpen(false);
  };
  return <div className="ai-mode-menu"><button type="button" className="ai-mode-trigger" onClick={() => setOpen((item) => !item)} aria-haspopup="menu" aria-expanded={open}><span>{current.label}</span><ChevronDown size={13} /></button>{open && <div className="ai-mode-popover" role="menu">{modes.map((mode) => { const available = Boolean(access?.[mode.key]?.available); return <button type="button" key={mode.key} className={`${mode.key === value ? 'selected' : ''} ${available ? '' : 'locked'}`} role="menuitem" onClick={() => choose(mode)}><span className="ai-mode-option-copy"><b>{mode.label}</b><small>{mode.description}</small></span>{available ? (mode.key === value ? <Check size={15} /> : <ChevronRight size={15} />) : <span className="ai-mode-lock"><LockKeyhole size={13} />{mode.unlock}</span>}</button>; })}</div>}</div>;
}

function resizeComposerTextarea(textarea) {
  if (!textarea || typeof window === 'undefined') return;
  const style = window.getComputedStyle(textarea);
  const fontSize = Number.parseFloat(style.fontSize) || 13;
  const lineHeight = Number.parseFloat(style.lineHeight) || fontSize * 1.5;
  const verticalPadding = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
  const verticalBorder = (Number.parseFloat(style.borderTopWidth) || 0) + (Number.parseFloat(style.borderBottomWidth) || 0);
  const minBoxHeight = Math.ceil(lineHeight * 2 + verticalPadding + verticalBorder);
  const maxBoxHeight = Math.ceil(lineHeight * 11 + verticalPadding + verticalBorder);

  // Reset to the minimum before reading scrollHeight. This makes deletion
  // shrink the composer immediately instead of measuring its previous height.
  textarea.classList.remove('is-overflowing');
  textarea.style.overflowY = 'hidden';
  textarea.style.height = '0px';

  const requiredBoxHeight = Math.max(textarea.scrollHeight + verticalBorder, minBoxHeight);
  const overflowing = requiredBoxHeight > maxBoxHeight + 2;
  textarea.style.height = `${Math.min(Math.ceil(requiredBoxHeight), maxBoxHeight)}px`;
  textarea.classList.toggle('is-overflowing', overflowing);
  textarea.style.overflowY = overflowing ? 'auto' : 'hidden';
}

export default function Composer({ input, setInput, busy, attachmentKind, setAttachmentKind, uploadRef, send, upload, centered, pendingFiles = [], onPasteImages, onRemovePending, aiMode, setAiMode, aiModeAccess, onUpgrade, editingMessage = null, onCancelEdit }) {
  const textareaRef = useRef(null);
  const shortcutItems = [
    { key: 'laprak', label: 'Laprak', icon: FileText, prompt: 'Buatkan saya laporan praktikum berdasarkan bahan dan instruksi yang tersedia.' },
    { key: 'proposal', label: 'Proposal', icon: LayoutTemplate, prompt: 'Bantu saya menyusun proposal berdasarkan bahan dan instruksi berikut: ' },
    { key: 'makalah', label: 'Makalah', icon: GraduationCap, prompt: 'Bantu saya menyusun makalah berdasarkan bahan dan instruksi berikut: ' },
    { key: 'tugas-akhir', label: 'Tugas akhir', icon: ClipboardList, prompt: 'Bantu saya mengerjakan bagian tugas akhir berdasarkan arahan dan sumber berikut: ' },
    { key: 'jurnal', label: 'Jurnal', icon: Pencil, prompt: 'Bantu saya menyusun artikel jurnal dari data dan tujuan penelitian berikut: ' },
  ];
  const placeholder = centered ? 'Ceritakan tugas yang ingin kamu susun...' : (pendingFiles.length ? 'Tambahkan pesan untuk bahan ini...' : 'Tulis tugasmu, tempel link, atau paste gambar...');
  useLayoutEffect(() => {
    resizeComposerTextarea(textareaRef.current);
  }, [input]);
  useEffect(() => {
    const resize = () => resizeComposerTextarea(textareaRef.current);
    let measuredWidth = textareaRef.current?.getBoundingClientRect().width || 0;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width || 0;
      if (Math.abs(nextWidth - measuredWidth) < 1) return;
      measuredWidth = nextWidth;
      resize();
    });
    if (textareaRef.current) observer?.observe(textareaRef.current);
    window.addEventListener('resize', resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);
  useEffect(() => {
    if (!editingMessage) return undefined;
    setInput(editingMessage.content || '');
    const frame = window.requestAnimationFrame(() => textareaRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [editingMessage, setInput]);
  return <div className={`composer-zone ${centered ? 'composer-centered composer-claude' : ''}`}>
    {pendingFiles.length ? <div className="pending-files">{pendingFiles.map((file, index) => <PendingAttachmentChip file={file} index={index} key={`${file.name}-${index}`} onRemove={onRemovePending} />)}</div> : null}
    {editingMessage && <div className="composer-editing-banner" role="status" aria-live="polite"><span><Pencil size={13} />Mengubah pesan</span><button type="button" onClick={onCancelEdit} disabled={busy}>Batalkan</button></div>}
    <form className={`composer ${centered ? 'composer-style-reference' : ''}`} onSubmit={send}>
      <textarea ref={textareaRef} aria-label={placeholder || 'Pesan chat'} rows="2" value={input} onChange={(event) => setInput(event.target.value)} onPaste={onPasteImages} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={placeholder} />
      <div className="composer-bottom-row">
        <div className="composer-left">
          <CustomSelect className="composer-select" value={attachmentKind} onChange={setAttachmentKind} ariaLabel="Jenis bahan" options={[{ value: '', label: 'Deteksi otomatis' }, { value: 'module', label: 'Modul' }, { value: 'instruction', label: 'Instruksi' }, { value: 'practice_evidence', label: 'Bukti praktik' }, { value: 'template', label: 'Template' }, { value: 'supporting_document', label: 'Dokumen pendukung' }]} />
          <button type="button" className="attach-button" onClick={() => uploadRef.current?.click()} title="Tambah bahan"><Plus size={18} /></button>
          <input ref={uploadRef} aria-label="Lampirkan bahan" hidden type="file" multiple accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.png,.jpg,.jpeg,.webp" onChange={upload} />
        </div>
        <div className="composer-actions">
          <AiModeMenu value={aiMode} onChange={setAiMode} access={aiModeAccess} onUpgrade={onUpgrade} />
          <button className="send-button" type="submit" disabled={busy || (!input.trim() && !pendingFiles.length)} aria-label={editingMessage ? 'Simpan perubahan pesan' : 'Kirim pesan'}><Send size={17} /></button>
        </div>
      </div>
    </form>
    {centered ? <div className="composer-shortcuts" aria-label="Pilih jenis dokumen">{shortcutItems.map((item) => { const Icon = item.icon; return <button key={item.key} type="button" className="composer-shortcut" onClick={() => setInput(item.prompt)}><Icon size={14} /><span>{item.label}</span></button>; })}</div> : null}
    {!centered ? <small>Enter untuk kirim · Shift + Enter untuk baris baru · file hanya terlihat di akunmu</small> : null}
  </div>;
}
