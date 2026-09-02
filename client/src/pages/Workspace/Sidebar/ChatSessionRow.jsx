import { useEffect, useRef, useState } from 'react';
import { Archive, ChevronRight, FolderOpen, MoreHorizontal, Pencil, Pin, PinOff, Plus, Trash2 } from 'lucide-react';
import { normalizedCourseKey } from '../../../lib/academic';
import { useApp } from '../../../state/ui-context';

export function SessionGroup({ group, items, activeId, page, onOpen, renamingId, setRenamingId, onRename, draggingSession, setDraggingSession, onDropSession, onDropGroup, folders = [], onPin, onMove, onArchive, onDelete }) {
  if (!items.length) return null;
  const isUngrouped = group === 'Belum dikelompokkan';
  const hideGroupLabel = group === 'Disematkan';
  return <section className={`session-group ${hideGroupLabel ? 'pinned-group' : ''} ${isUngrouped ? 'ungrouped-group' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggingSession) onDropGroup(draggingSession); setDraggingSession(null); }}>{!isUngrouped && !hideGroupLabel && <div className="session-group-label"><span>{group}</span><small>{items.length}</small></div>}{items.map((item) => <ChatSessionRow key={item.id} item={item} active={activeId === item.id && page === 'chat'} onOpen={onOpen} editing={renamingId === item.id} setEditing={setRenamingId} onRename={onRename} draggingSession={draggingSession} onDragStart={setDraggingSession} onDropSession={onDropSession} folders={folders} onPin={onPin} onMove={onMove} onArchive={onArchive} onDelete={onDelete} />)}</section>;
}

export function ChatSessionRow({ item, active, onOpen, editing, setEditing, onRename, draggingSession, onDragStart, onDropSession, folders, onPin, onMove, onArchive, onDelete }) {
  const { showDialog } = useApp();
  const [title, setTitle] = useState(item.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const renameInputRef = useRef(null);
  useEffect(() => setTitle(item.title), [item.title]);
  useEffect(() => {
    if (!editing) return undefined;
    const frame = window.requestAnimationFrame(() => renameInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [editing]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOutside = (event) => {
      if (event.target.closest?.('.session-menu, .session-menu-trigger')) return;
      setMenuOpen(false);
      setMoveOpen(false);
    };
    window.addEventListener('mousedown', closeOutside);
    return () => window.removeEventListener('mousedown', closeOutside);
  }, [menuOpen]);
  useEffect(() => {
    const closeOtherMenu = (event) => {
      if (event.detail?.id !== item.id) {
        setMenuOpen(false);
        setMoveOpen(false);
      }
    };
    window.addEventListener('laprakin:session-menu-open', closeOtherMenu);
    return () => window.removeEventListener('laprakin:session-menu-open', closeOtherMenu);
  }, [item.id]);
  useEffect(() => {
    if (!menuOpen) return;
    const trigger = document.activeElement?.classList?.contains('session-menu-trigger') ? document.activeElement : null;
    const menu = trigger?.closest('.session-row')?.querySelector('.session-menu');
    if (trigger && menu) {
      const rect = trigger.getBoundingClientRect();
      const sidebarRight = trigger.closest('.left-sidebar')?.getBoundingClientRect().right || 0;
      menu.style.setProperty('--session-menu-top', `${Math.max(8, Math.min(rect.top - 10, window.innerHeight - 232))}px`);
      menu.style.setProperty('--session-menu-left', `${Math.max(8, Math.min(Math.max(rect.right + 8, sidebarRight + 6), window.innerWidth - 206))}px`);
    }
    window.dispatchEvent(new CustomEvent('laprakin:session-menu-open', { detail: { id: item.id } }));
  }, [menuOpen, item.id]);
  const submit = (event) => { event.preventDefault(); onRename(item.id, title); };
  const chooseFolder = async (folder) => { await onMove(item, folder); setMenuOpen(false); setMoveOpen(false); };
  const createFolder = async () => { const folder = await showDialog({ kind: 'prompt', title: 'Folder baru', message: 'Masukkan nama folder untuk mengelompokkan chat.', placeholder: 'Contoh: Modul 5 Firewall', confirmLabel: 'Buat folder' }); if (folder?.trim()) chooseFolder(folder.trim().slice(0, 100)); };
  return <article className={`session-row ${active ? 'active' : ''}`} draggable={!editing} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; onDragStart(item); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); if (draggingSession && draggingSession.id !== item.id) onDropSession?.(draggingSession, item); }}><div className="session-open" role="button" aria-label={item.title || 'Chat baru'} tabIndex={0} onClick={() => !editing && onOpen(item.id)} onKeyDown={(event) => { if (!editing && (event.key === 'Enter' || event.key === ' ')) onOpen(item.id); }} title={item.title}>{editing ? <form onSubmit={submit} onClick={(event) => event.stopPropagation()}><input ref={renameInputRef} aria-label="Nama chat" value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setEditing(null); }} onBlur={() => onRename(item.id, title)} /></form> : <span>{item.title || 'Chat baru'}</span>}</div><div className="session-row-actions"><button className="session-menu-trigger" type="button" title="Menu chat" aria-label="Menu chat" onClick={(event) => { event.stopPropagation(); setMenuOpen((open) => !open); setMoveOpen(false); }}><MoreHorizontal size={15}/></button>{menuOpen && <div className="session-menu" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => { setEditing(item.id); setMenuOpen(false); }}><Pencil size={14}/><span>Ubah nama</span></button><div className="session-menu-folder"><button type="button" onClick={() => setMoveOpen((open) => !open)}><FolderOpen size={14}/><span>Pindahkan ke folder</span><ChevronRight size={13}/></button>{moveOpen && <div className="session-submenu">{folders.filter((folder) => normalizedCourseKey(folder) !== normalizedCourseKey(item.course_group)).map((folder) => <button key={folder} type="button" onClick={() => chooseFolder(folder)}>{folder}</button>)}<button type="button" className="new-folder-action" onClick={createFolder}><Plus size={13}/>Folder baru</button></div>}</div><button type="button" onClick={() => { onPin(item, !item.isPinned); setMenuOpen(false); }}>{item.isPinned ? <PinOff size={14}/> : <Pin size={14}/>}<span>{item.isPinned ? 'Lepas pin' : 'Pin chat'}</span></button><button type="button" onClick={() => { onArchive(item); setMenuOpen(false); }}><Archive size={14}/><span>Arsip</span></button><button type="button" className="delete-action" onClick={async () => { setMenuOpen(false); const confirmed = await showDialog({ kind: 'confirm', title: 'Hapus chat?', message: `Chat “${item.title || 'Chat baru'}” akan dihapus permanen dan tidak dapat dipulihkan.`, confirmLabel: 'Hapus', destructive: true }); if (confirmed) await onDelete(item); }}><Trash2 size={14}/><span>Hapus</span></button></div>}</div></article>;
}

