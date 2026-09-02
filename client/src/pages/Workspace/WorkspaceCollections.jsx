import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, FileText, FolderKanban, FolderOpen, MessageCircle, MoreHorizontal, Pin, PinOff, Plus, Search, Send } from 'lucide-react';
import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';
import { formatDate } from '../../lib/formatters';
import { useI18n } from '../../i18n';

export function DocumentLibrary({ documents, onRefresh, onOpen }) { const { t } = useI18n(); const [query, setQuery] = useState(''); const visible = documents.filter((doc) => `${doc.title} ${doc.course_name} ${doc.module_title}`.toLowerCase().includes(query.toLowerCase())); return <section className="library-page"><header><div><h1>{t('workspace.collections.documents.title')}</h1><p>{t('workspace.collections.documents.description')}</p></div><button onClick={onRefresh}>{t('workspace.collections.documents.refresh')}</button></header><label className="search-field"><FolderOpen size={15} /><input aria-label={t('workspace.collections.documents.searchLabel')} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('workspace.collections.documents.searchPlaceholder')} /></label><div className="library-list">{visible.length ? visible.map((doc) => <article key={doc.id}><div><span className="doc-file"><FileText size={16} /></span><div><b>{doc.title}</b><small>{doc.course_name || t('workspace.collections.documents.courseMissing')} · {doc.status === 'generated' ? t('workspace.collections.documents.ready') : t('workspace.collections.documents.generating')}</small></div></div><button onClick={() => onOpen(doc)}>{t('workspace.collections.documents.openChat')} <ArrowRight size={13} /></button></article>) : <div className="empty-library"><FolderOpen size={22} /><b>{t('workspace.collections.documents.emptyTitle')}</b><p>{t('workspace.collections.documents.emptyDescription')}</p></div>}</div></section>; }

export function ProjectsPage({ projects, selectedProject, documents, onOpenProject, onBack, onCreate, onNewChat, onOpenSession, onPinProject, onNotice }) {
  const { t } = useI18n();
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
        <button type="button" className="project-back" onClick={onBack} aria-label={t('workspace.collections.projects.back')}><ArrowLeft size={17} /></button>
        <div className="project-title-wrap"><span className="project-title-icon"><FolderKanban size={19} /></span><div><h1>{activeProject.name}</h1><small>{t('workspace.collections.projects.chatCount', { count: activeProject.count })} · {t('workspace.collections.projects.privateProject')}</small></div></div>
        <div className="project-detail-actions"><IconButton label={activeProject.isPinned ? t('workspace.collections.projects.unpinProject') : t('workspace.collections.projects.pinProject')} onClick={() => onPinProject(activeProject, !activeProject.isPinned)}>{activeProject.isPinned ? <PinOff size={17}/> : <Pin size={17}/>}</IconButton><Button variant="secondary" onClick={() => onNotice(t('workspace.collections.projects.privateNotice'))}>{t('workspace.collections.projects.share')}</Button><IconButton label={t('workspace.collections.projects.menu')} onClick={() => onNotice(t('workspace.collections.projects.settingsSoon'))}><MoreHorizontal size={17} /></IconButton></div>
      </header>
      <form className="project-new-chat" onSubmit={startProjectChat}>
        <Plus size={18} />
         <input aria-label={t('workspace.collections.projects.newChatLabel')} value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder={t('workspace.collections.projects.newChatPlaceholder', { project: activeProject.name })} />
        <button type="submit" aria-label={t('workspace.collections.projects.createChat')}><Send size={16} /></button>
      </form>
      <nav className="project-tabs" aria-label={t('workspace.collections.projects.filterLabel')}><button className={tab === 'chats' ? 'active' : ''} type="button" onClick={() => setTab('chats')}>{t('workspace.collections.projects.chats')}</button><button className={tab === 'sources' ? 'active' : ''} type="button" onClick={() => setTab('sources')}>{t('workspace.collections.projects.sources')}</button></nav>
      {tab === 'chats' ? <div className="project-chat-list">{activeProject.items.length ? activeProject.items.map((session) => <button key={session.id} type="button" onClick={() => onOpenSession(session.id)}><span className="project-chat-avatar">{session.title?.slice(0, 1).toUpperCase() || 'L'}</span><div><b>{session.title || t('workspace.defaults.chat')}</b><small>{session.document_id ? t('workspace.collections.projects.connectedDocument') : t('workspace.collections.projects.projectConversation')} · {formatDate(session.updated_at || session.updatedAt || session.created_at || session.createdAt)}</small></div><ArrowRight size={15} /></button>) : <div className="project-empty"><MessageCircle size={22}/><b>{t('workspace.collections.projects.emptyChatsTitle')}</b><p>{t('workspace.collections.projects.emptyChatsDescription')}</p></div>}</div> : <div className="project-source-list">{sources.length ? sources.map((doc) => <article key={doc.id}><span><FileText size={16}/></span><div><b>{doc.title}</b><small>{doc.course_name || activeProject.name} · {doc.status || t('workspace.collections.projects.sourceDraft')}</small></div></article>) : <div className="project-empty"><FileText size={22}/><b>{t('workspace.collections.projects.emptySourcesTitle')}</b><p>{t('workspace.collections.projects.emptySourcesDescription')}</p></div>}</div>}
    </section>;
  }

  return <section className="projects-page projects-index-page">
    <header className="projects-header"><div><h1>{t('workspace.collections.projects.indexTitle')}</h1><p>{t('workspace.collections.projects.indexDescription')}</p></div><div className="projects-head-actions"><label className="project-search"><Search size={15}/><input aria-label={t('workspace.collections.projects.searchLabel')} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('workspace.collections.projects.searchPlaceholder')} /></label><Button onClick={onCreate}><Plus size={15}/>{t('workspace.collections.projects.newProject')}</Button></div></header>
    <nav className="projects-filter" aria-label={t('workspace.collections.projects.filterLabel')}><button className="active" type="button">{t('workspace.collections.projects.all')}</button><button type="button" onClick={() => onNotice(t('workspace.collections.projects.createdNotice'))}>{t('workspace.collections.projects.createdByYou')}</button><button type="button" onClick={() => onNotice(t('workspace.collections.projects.sharedNotice'))}>{t('workspace.collections.projects.sharedWithYou')}</button></nav>
    <div className="projects-table-head"><span>{t('workspace.collections.projects.name')}</span><span>{t('workspace.collections.projects.updated')}</span><span aria-hidden="true" /></div>
    <div className="projects-table">{visibleProjects.length ? visibleProjects.map((project) => <article key={project.name} className="project-row"><button type="button" className="project-row-open" onClick={() => onOpenProject(project.name)}><span className="project-row-icon"><FolderKanban size={18}/></span><span className="project-row-copy"><b>{project.name}</b><small>{t('workspace.collections.projects.chatCount', { count: project.count })}</small></span><span className="project-row-date">{formatDate(project.updatedAt)}</span></button><button type="button" className={`project-pin-button ${project.isPinned ? 'active' : ''}`} onClick={() => onPinProject(project, !project.isPinned)} aria-label={project.isPinned ? `${t('workspace.collections.projects.unpinProject')} ${project.name}` : `${t('workspace.collections.projects.pinProject')} ${project.name}`} title={project.isPinned ? t('workspace.collections.projects.unpinProject') : t('workspace.collections.projects.pinProject')}>{project.isPinned ? <PinOff size={16}/> : <Pin size={16}/>}</button></article>) : <div className="projects-empty"><FolderKanban size={26}/><b>{t('workspace.collections.projects.emptyTitle')}</b><p>{t('workspace.collections.projects.emptyDescription')}</p><Button onClick={onCreate}><Plus size={14}/>{t('workspace.collections.projects.newProject')}</Button></div>}</div>
  </section>;
}
