import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, FileText, FolderKanban, FolderOpen, MessageCircle, MoreHorizontal, Pin, PinOff, Plus, Search, Send } from 'lucide-react';
import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';
import { formatDate } from '../../lib/formatters';

export function DocumentLibrary({ documents, onRefresh, onOpen }) { const [query, setQuery] = useState(''); const visible = documents.filter((doc) => `${doc.title} ${doc.course_name} ${doc.module_title}`.toLowerCase().includes(query.toLowerCase())); return <section className="library-page"><header><div><h1>Dokumen</h1><p>Laprak yang dibuat dari percakapanmu.</p></div><button onClick={onRefresh}>Refresh</button></header><label className="search-field"><FolderOpen size={15} /><input aria-label="Cari dokumen" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari judul, mata kuliah, atau modul" /></label><div className="library-list">{visible.length ? visible.map((doc) => <article key={doc.id}><div><span className="doc-file"><FileText size={16} /></span><div><b>{doc.title}</b><small>{doc.course_name || 'Mata kuliah belum diisi'} · {doc.status === 'generated' ? 'Dokumen siap diperiksa' : 'Dokumen sedang dibuat'}</small></div></div><button onClick={() => onOpen(doc)}>Buka chat <ArrowRight size={13} /></button></article>) : <div className="empty-library"><FolderOpen size={22} /><b>Belum ada dokumen.</b><p>Buat chat laprak, lalu pilih “Buat laprak” saat konteksnya sudah cukup.</p></div>}</div></section>; }

export function ProjectsPage({ projects, selectedProject, documents, onOpenProject, onBack, onCreate, onNewChat, onOpenSession, onPinProject, onNotice }) {
  const [query, setQuery] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [tab, setTab] = useState('chats');
  const visibleProjects = projects.filter((project) => project.name.toLowerCase().includes(query.trim().toLowerCase()));
  const activeProject = projects.find((project) => project.name === selectedProject);
  useEffect(() => { setDraftTitle(''); setTab('chats'); }, [selectedProject]);

  if (selectedProject && activeProject) {
    const projectDocumentIds = new Set(activeProject.items.map((item) => item.document_id).filter(Boolean));
    const sources = documents.filter((doc) => projectDocumentIds.has(doc.id) || doc.course_name === activeProject.name);
    const startProjectChat = async (event) => {
      event.preventDefault();
      const session = await onNewChat(activeProject.name, draftTitle);
      if (session) setDraftTitle('');
    };
    return <section className="projects-page project-detail-page">
      <header className="project-detail-header">
        <button type="button" className="project-back" onClick={onBack} aria-label="Kembali ke Projects"><ArrowLeft size={17} /></button>
        <div className="project-title-wrap"><span className="project-title-icon"><FolderKanban size={19} /></span><div><h1>{activeProject.name}</h1><small>{activeProject.count} chat · Project pribadi</small></div></div>
        <div className="project-detail-actions"><IconButton label={activeProject.isPinned ? 'Lepas pin project' : 'Pin project'} onClick={() => onPinProject(activeProject, !activeProject.isPinned)}>{activeProject.isPinned ? <PinOff size={17}/> : <Pin size={17}/>}</IconButton><Button variant="secondary" onClick={() => onNotice('Project ini masih bersifat pribadi.')}>Bagikan</Button><IconButton label="Menu project" onClick={() => onNotice('Pengaturan project akan segera tersedia.')}><MoreHorizontal size={17} /></IconButton></div>
      </header>
      <form className="project-new-chat" onSubmit={startProjectChat}>
        <Plus size={18} />
         <input aria-label="Judul chat baru" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder={`Chat baru di ${activeProject.name}`} />
        <button type="submit" aria-label="Buat chat"><Send size={16} /></button>
      </form>
      <nav className="project-tabs" aria-label="Navigasi project"><button className={tab === 'chats' ? 'active' : ''} type="button" onClick={() => setTab('chats')}>Chats</button><button className={tab === 'sources' ? 'active' : ''} type="button" onClick={() => setTab('sources')}>Sumber</button></nav>
      {tab === 'chats' ? <div className="project-chat-list">{activeProject.items.length ? activeProject.items.map((session) => <button key={session.id} type="button" onClick={() => onOpenSession(session.id)}><span className="project-chat-avatar">{session.title?.slice(0, 1).toUpperCase() || 'L'}</span><div><b>{session.title || 'Chat baru'}</b><small>{session.document_id ? 'Dokumen kerja tersambung' : 'Percakapan project'} · {formatDate(session.updated_at || session.updatedAt || session.created_at || session.createdAt)}</small></div><ArrowRight size={15} /></button>) : <div className="project-empty"><MessageCircle size={22}/><b>Belum ada chat di project ini.</b><p>Buat chat pertama untuk mulai mengumpulkan bahan dan menyusun laprak.</p></div>}</div> : <div className="project-source-list">{sources.length ? sources.map((doc) => <article key={doc.id}><span><FileText size={16}/></span><div><b>{doc.title}</b><small>{doc.course_name || activeProject.name} · {doc.status || 'draft'}</small></div></article>) : <div className="project-empty"><FileText size={22}/><b>Belum ada sumber dalam project ini.</b><p>Dokumen kerja dari chat project akan muncul di sini.</p></div>}</div>}
    </section>;
  }

  return <section className="projects-page projects-index-page">
    <header className="projects-header"><div><h1>Projects</h1><p>Kelompokkan chat dan dokumen praktikum dalam satu ruang kerja.</p></div><div className="projects-head-actions"><label className="project-search"><Search size={15}/><input aria-label="Cari project" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari project" /></label><Button onClick={onCreate}><Plus size={15}/>Project baru</Button></div></header>
    <nav className="projects-filter" aria-label="Filter project"><button className="active" type="button">Semua</button><button type="button" onClick={() => onNotice('Semua project di halaman ini dibuat oleh akunmu.')}>Dibuat oleh kamu</button><button type="button" onClick={() => onNotice('Belum ada project yang dibagikan kepadamu.')}>Dibagikan dengan kamu</button></nav>
    <div className="projects-table-head"><span>Nama</span><span>Diubah</span><span aria-hidden="true" /></div>
    <div className="projects-table">{visibleProjects.length ? visibleProjects.map((project) => <article key={project.name} className="project-row"><button type="button" className="project-row-open" onClick={() => onOpenProject(project.name)}><span className="project-row-icon"><FolderKanban size={18}/></span><span className="project-row-copy"><b>{project.name}</b><small>{project.count} chat</small></span><span className="project-row-date">{formatDate(project.updatedAt)}</span></button><button type="button" className={`project-pin-button ${project.isPinned ? 'active' : ''}`} onClick={() => onPinProject(project, !project.isPinned)} aria-label={project.isPinned ? `Lepas pin ${project.name}` : `Pin ${project.name}`} title={project.isPinned ? 'Lepas pin project' : 'Pin project'}>{project.isPinned ? <PinOff size={16}/> : <Pin size={16}/>}</button></article>) : <div className="projects-empty"><FolderKanban size={26}/><b>Belum ada project.</b><p>Buat project pertamamu untuk mengelompokkan chat dan dokumen.</p><Button onClick={onCreate}><Plus size={14}/>Project baru</Button></div>}</div>
  </section>;
}
