import { Link } from '../../router';
import { normalizedCourseKey } from '../../lib/academic';
import { getEditableMessage } from '../../lib/chat-message-actions';
import { userInitials } from '../../lib/user';
import {
  Bell, ChevronRight, CircleAlert, FolderKanban, FolderOpen, HelpCircle, LayoutTemplate, Menu, MessageCircle,
  Moon, Monitor, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Save, Search, Settings2,
  SlidersHorizontal, Sun, X,
} from 'lucide-react';
import { BrandMark } from '../../components/BrandMark';
import { Button } from '../../components/Button';
import { CustomSelect } from '../../components/CustomSelect';
import { IconButton } from '../../components/IconButton';
import { ProductUpdatePopup } from '../../FeatureUpdates';
import { SessionGroup } from './Sidebar/ChatSessionRow';
import AccountPopover from './Sidebar/AccountPopover';
import { FeedbackModal, HelpModal, NotificationModal } from '../../components/WorkspaceOverlays';
import SettingsModal from './SettingsModal';
import { DocumentLibrary, ProjectsPage } from './WorkspaceCollections';
import IdentityIntakeModal from './IdentityIntakeModal';
import WorkspaceTutorial from './WorkspaceTutorial';
import DocumentSidePanel from './DocumentSidePanel';
import { loadPage } from '../../lib/load-page';

const ChatSurface = loadPage(() => import('./ChatSurface'));

const SETTINGS_MODAL_TABS = {
  settings: 'general',
  'settings-billing': 'billing',
  'settings-general': 'general',
  'settings-personalization': 'personalization',
  'settings-academic': 'academic',
  'settings-storage': 'storage',
  'settings-security': 'security',
  'settings-archived': 'archived',
  'settings-referral': 'referral',
};

const navItems = [
  { key: 'chat', label: 'Chats', icon: MessageCircle },
  { key: 'projects', label: 'Projects', icon: FolderKanban },
  { key: 'documents', label: 'Dokumen', icon: FolderOpen },
];

export default function LegacyWorkspaceView({
  user, wallet, prefs, resolvedTheme, workspaceAccent, leftCollapsed, setLeftCollapsed, rightOpen,
  documentOpen, page, active, workflow, hasSubscriptionPlan, workspacePlanLabel, navigate,
  setDocumentOpen, setRightOpen, setTutorialFirstUse, setTutorialOpen, setPrefs, setModal,
  messages, attachments, documentState, activeJob, input, setInput, busy, actionBusy, attachmentKind,
  setAttachmentKind, uploadRef, send, upload, removeAttachment, updateAttachmentCategory, createDocument,
  performChatAction, contextOpen, setContextOpen, config, updateConfig, pendingLandingFiles,
  setPendingLandingFiles, pasteImagesIntoChat, addPendingFiles, aiMode, setAiMode, aiModeAccess, quizMode, setQuizMode,
  startDocumentQuiz, submitDocumentQuiz, editingMessage, setEditingMessageId, reviseChatMessage,
  documents, loadDocuments, sessions, openSession, setNotice, projectEntries, projectParam, openProject,
  createProject, createProjectChat, setProjectPinned, documentAction, downloadExport, restoreDocumentVersion,
  pendingConfigRequest, saveConfig, modal, refreshSession, loadSessions, identityIntake,
  completeIdentityIntake, closeTutorial, tutorialOpen, productUpdate, recordProductUpdate, closeProductUpdate,
  accountOpen, setAccountOpen, isMaxPlan, logout, closeMobileSidebar, sidebarGroupProps,
  pinnedProjects, pinnedSessions, recentGroups, recentSearchOpen, setRecentSearchOpen,
  recentSearchInputRef, recentSearchQuery, setRecentSearchQuery, groupLabel, moveSessionToGroup,
  headerSubtitle,
}) {
  return <div className={`workspace ${leftCollapsed ? 'left-collapsed' : ''} ${rightOpen && page === 'chat' ? 'right-open' : ''} ${documentOpen && page === 'chat' ? 'document-open' : ''} ${resolvedTheme === 'dark' ? 'theme-dark' : ''} ${prefs.compact ? 'compact' : ''}`} data-motion={prefs.reducedMotion ? 'reduce' : 'full'} data-accent={workspaceAccent.key} data-contrast={prefs.contrast || 'default'} data-language={prefs.language || 'id'} style={{ '--workspace-orange': workspaceAccent.color, '--workspace-accent': workspaceAccent.color, '--workspace-accent-contrast': workspaceAccent.contrast, '--workspace-accent-ink': resolvedTheme === 'light' ? workspaceAccent.lightInk : workspaceAccent.color }}>
    <aside className="left-sidebar">
      <div className="sidebar-top">
        <Link to="/app" className="workspace-brand"><BrandMark /><b>Laprakin</b></Link>
        <IconButton className="sidebar-collapse-button" label={leftCollapsed ? 'Buka sidebar' : 'Minimalkan sidebar'} onClick={() => setLeftCollapsed(!leftCollapsed)}>{leftCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</IconButton>
      </div>
      <nav className="workspace-nav">{navItems.map(({ key, label, icon: Icon }) => <button key={key} className={page === key ? 'active' : ''} onClick={() => key === 'chat' ? startNewChat() : setRoute(key)} title={label}><Icon size={16} /><span>{label}</span></button>)}</nav>
      <div className="sidebar-session-scroll">
        {pinnedProjects.length || pinnedSessions.length ? <div className="pinned-session-block">
          <div className="session-section-title"><span>Pinned</span></div>
          {pinnedProjects.map((project) => <button type="button" className="pinned-project-row" key={normalizedCourseKey(project.name)} onClick={() => openProject(project.name)} title={project.name}><FolderKanban size={14}/><span>{project.name}</span><small>{project.count}</small></button>)}
          <div className="session-list"><SessionGroup group="Disematkan" items={pinnedSessions} {...sidebarGroupProps} onDropGroup={(session) => moveSessionToGroup(session, groupLabel(session))} /></div>
        </div> : null}
        <div className={`session-heading ${recentSearchOpen ? 'is-searching' : ''}`}>
           {recentSearchOpen ? <label className="recent-search-field"><Search size={13}/><input ref={recentSearchInputRef} value={recentSearchQuery} onChange={(event) => setRecentSearchQuery(event.target.value)} placeholder="Cari chat" aria-label="Cari chat terbaru" onKeyDown={(event) => { if (event.key === 'Escape') { setRecentSearchOpen(false); setRecentSearchQuery(''); } }} /><button type="button" aria-label="Tutup pencarian" onClick={() => { setRecentSearchOpen(false); setRecentSearchQuery(''); }}><X size={12}/></button></label> : <><span>Recents</span><button className="recent-search-trigger" type="button" title="Cari chat" aria-label="Cari chat" onClick={() => setRecentSearchOpen(true)}><Search size={13} /></button></>}
        </div>
        <div className="session-list">{recentGroups.map(([group, items]) => <SessionGroup key={normalizedCourseKey(group)} group={group} items={items} {...sidebarGroupProps} onDropGroup={(session) => moveSessionToGroup(session, group)} />)}</div>
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-support-actions">
          <button onClick={() => { closeMobileSidebar(); setModal('help'); }} title="Bantuan"><HelpCircle size={16} /><span>Bantuan</span></button>
          <button onClick={() => { closeMobileSidebar(); setModal('feedback'); }} title="Feedback"><MessageCircle size={16} /><span>Feedback</span></button>
          <button onClick={() => { closeMobileSidebar(); setModal('settings'); }} title="Settings"><Settings2 size={16} /><span>Settings</span></button>
        </div>
    <div className="account-row"><button onClick={() => setAccountOpen(!accountOpen)} title="Menu akun"><span>{userInitials(user)}</span><div><b>{user.fullName || user.email.split('@')[0]}</b><small>{wallet?.balances?.total || 0} laprak tersedia</small></div><ChevronRight size={14} /></button></div>
      </div>
    </aside>
    {accountOpen && <AccountPopover showUpgrade={!isMaxPlan} onClose={() => setAccountOpen(false)} onOpen={(target) => { closeMobileSidebar(); setAccountOpen(false); if (target === 'billing') navigate('/pricing'); else setModal(target); }} onLogout={logout} />}
    {!leftCollapsed && <button className="mobile-scrim" aria-label="Tutup navigasi" onClick={() => setLeftCollapsed(true)} />}
    <IconButton className="mobile-nav-toggle" label="Buka navigasi" onClick={() => setLeftCollapsed(false)}><Menu size={17} /></IconButton>
    <main className="workspace-main">
      {page === 'chat' && <>
        <header className="workspace-header"><div className={`header-title ${active ? '' : 'is-empty'}`}><b>{active?.title || 'Chat Laprakin'}</b><small>{headerSubtitle}</small></div>{!hasSubscriptionPlan && <button className="workspace-plan" onClick={() => navigate('/pricing')} title="Buka billing"><span>{workspacePlanLabel}</span><i>?</i><b>Upgrade</b></button>}<div className="header-actions"><button className={`header-config-button ${rightOpen ? 'active' : ''}`} aria-label="Konfigurasi chat" title="Konfigurasi chat" onClick={() => { setDocumentOpen(false); setRightOpen((value) => !value); }}><SlidersHorizontal size={15} /><span>Konfigurasi</span></button><IconButton label="Buka tutorial" className="tutorial-button" onClick={() => { setTutorialFirstUse(false); setTutorialOpen(true); }}><HelpCircle size={16} /></IconButton><IconButton label={prefs.theme === 'system' ? 'Tema mengikuti sistem' : resolvedTheme === 'dark' ? 'Gunakan mode terang' : 'Gunakan dark mode'} className="theme-button" onClick={() => setPrefs((value) => ({ ...value, theme: value.theme === 'system' ? (resolvedTheme === 'dark' ? 'light' : 'dark') : value.theme === 'dark' ? 'light' : 'system' }))}>{prefs.theme === 'system' ? <Monitor size={16} /> : resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</IconButton><IconButton label="Notifikasi" onClick={() => setModal('notifications')}><Bell size={16} /></IconButton></div></header>
        <ChatSurface active={active} messages={messages} attachments={attachments} documentState={documentState} workflow={workflow} activeJob={activeJob} user={user} input={input} setInput={setInput} busy={busy || actionBusy} attachmentKind={attachmentKind} setAttachmentKind={setAttachmentKind} uploadRef={uploadRef} send={send} upload={upload} removeAttachment={removeAttachment} updateAttachmentCategory={updateAttachmentCategory} createDocument={createDocument} onWorkflowAction={performChatAction} contextOpen={contextOpen} setContextOpen={setContextOpen} config={config} updateConfig={updateConfig} pendingFiles={pendingLandingFiles} onPasteImages={pasteImagesIntoChat} onAddPendingFiles={addPendingFiles} onRemovePending={(index) => setPendingLandingFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))} aiMode={aiMode} setAiMode={setAiMode} aiModeAccess={aiModeAccess} onUpgrade={() => navigate('/pricing')} onOpenDocument={() => { setRightOpen(false); setDocumentOpen(true); }} quizMode={quizMode} onCloseQuiz={() => setQuizMode(false)} onStartQuiz={startDocumentQuiz} onSubmitQuiz={submitDocumentQuiz} editingMessage={editingMessage} onEditMessage={(message) => { const editable = getEditableMessage(messages, message.id); if (!editable) return; setEditingMessageId(editable.id); setInput(editable.content || ''); }} onCancelEdit={() => { setEditingMessageId(null); setInput(''); }} onRevise={reviseChatMessage} />
      </>}
      {page === 'documents' && <DocumentLibrary documents={documents} onRefresh={loadDocuments} onOpen={(doc) => { const session = sessions.find((item) => item.document_id === doc.id); if (session) openSession(session.id); else setNotice('Dokumen ini belum memiliki ruang chat yang bisa dibuka.'); }} />}
    {page === 'projects' && <ProjectsPage
      projects={projectEntries}
      selectedProject={projectParam}
      documents={documents}
      onOpenProject={openProject}
      onBack={() => navigate('/app/projects')}
      onCreate={createProject}
      onNewChat={createProjectChat}
      onOpenSession={openSession}
      onPinProject={setProjectPinned}
      onNotice={setNotice}
    />}</main>
    {page === 'chat' && <aside className={`right-config ${documentOpen ? 'right-document' : ''}`}>
      {documentOpen
        ? <DocumentSidePanel documentState={documentState} activeJob={activeJob} workflow={workflow} busy={busy || actionBusy} user={user} onClose={() => setDocumentOpen(false)} onAction={documentAction} onDownload={downloadExport} onRestoreVersion={restoreDocumentVersion} onStartQuiz={startDocumentQuiz} onSubmitQuiz={submitDocumentQuiz} />
        : <div className="config-inner">
          <div className="right-head"><div><b>Konfigurasi chat</b><small>{pendingConfigRequest ? 'Lengkapi sebelum AI mulai bekerja.' : 'Hanya untuk laprak ini.'}</small></div><IconButton label="Tutup konfigurasi" onClick={() => setRightOpen(false)}><PanelRightClose size={16} /></IconButton></div>
          {(active || pendingConfigRequest?.session) ? <>
            <div className="right-body">
              {pendingConfigRequest && <div className="config-required-note"><CircleAlert size={16} /><div><b>Konteks wajib diisi</b><p>AI baru memproses prompt setelah mata kuliah dan materi disimpan.</p></div></div>}
              {!pendingConfigRequest && <label>Nama chat<input aria-label="Nama chat" value={config.title} onChange={(event) => updateConfig({ title: event.target.value })} /></label>}
              <label>Mata kuliah <small>wajib</small><input aria-label="Mata kuliah" required value={config.configuration.courseName} onChange={(event) => updateConfig({ configuration: { courseName: event.target.value } })} placeholder="Contoh: Jaringan Komputer" /></label>
              <label>Modul atau materi <small>wajib</small><input aria-label="Modul atau materi" required value={config.configuration.moduleTitle} onChange={(event) => updateConfig({ configuration: { moduleTitle: event.target.value } })} placeholder="Contoh: Routing Protocol" /></label>
              <label>Dosen pengampu <small>opsional</small><input aria-label="Dosen pengampu" value={config.configuration.lecturerName || ''} onChange={(event) => updateConfig({ configuration: { lecturerName: event.target.value } })} placeholder="Nama dosen" /></label>
              <label>NIP dosen <small>opsional</small><input aria-label="NIP dosen" value={config.configuration.lecturerNip || ''} onChange={(event) => updateConfig({ configuration: { lecturerNip: event.target.value } })} placeholder="NIP jika ada" /></label>
              <label htmlFor="config-document-profile">Jenis struktur<CustomSelect id="config-document-profile" ariaLabel="Jenis struktur" value={config.configuration.documentProfile} onChange={(value) => updateConfig({ configuration: { documentProfile: value } })} options={[{ value: 'langkah', label: 'Berbasis langkah' }, { value: 'pengujian', label: 'Berbasis pengujian' }, { value: 'proyek', label: 'Berbasis proyek' }]} /></label>
              <div className="structure-choice"><button className={config.structureMode === 'guided' ? 'active' : ''} onClick={() => updateConfig({ structureMode: 'guided' })}><LayoutTemplate size={15} /><span><b>Struktur prodi</b><small>Dipakai otomatis.</small></span></button><button className={config.structureMode === 'custom' ? 'active' : ''} onClick={() => updateConfig({ structureMode: 'custom' })}><SlidersHorizontal size={15} /><span><b>Struktur khusus</b><small>Hanya bila tugas berbeda.</small></span></button></div>
               {config.structureMode === 'custom' && <label>Susunan bagian<textarea aria-label="Susunan bagian" value={config.configuration.customStructure} onChange={(event) => updateConfig({ configuration: { customStructure: event.target.value } })} placeholder="Pendahuluan, hasil, pembahasan, kesimpulan" /></label>}
               <label>Instruksi tambahan<textarea aria-label="Instruksi tambahan" value={config.configuration.instructions} onChange={(event) => updateConfig({ configuration: { instructions: event.target.value } })} placeholder="Contoh: fokus ke analisis hasil." /></label>
            </div>
            <div className="right-foot"><Button onClick={saveConfig} disabled={busy}><Save size={14} />{pendingConfigRequest ? 'Simpan & mulai' : 'Simpan'}</Button><small>Mata kuliah dan materi disimpan persis dari isianmu, bukan ditebak AI.</small></div>
          </> : <div className="empty-config"><PanelRightOpen size={20} /><b>Belum ada chat aktif.</b><p>Kirim prompt untuk membuka konfigurasi awal.</p></div>}
        </div>}
    </aside>}
    {SETTINGS_MODAL_TABS[modal] && <SettingsModal initialTab={SETTINGS_MODAL_TABS[modal]} onClose={() => setModal(null)} onSaved={refreshSession} onArchivedChanged={loadSessions} onOpenBilling={() => { setModal(null); navigate('/pricing'); }} prefs={prefs} setPrefs={setPrefs} />}{modal === 'help' && <HelpModal onClose={() => setModal(null)} />}{modal === 'feedback' && <FeedbackModal onClose={() => setModal(null)} />}{modal === 'notifications' && <NotificationModal onClose={() => setModal(null)} />}{identityIntake && <IdentityIntakeModal user={user} busy={busy} onSave={completeIdentityIntake} onBack={() => setIdentityIntake(null)} />}{tutorialOpen && <WorkspaceTutorial onClose={closeTutorial} />}{productUpdate && <ProductUpdatePopup update={productUpdate} onReceipt={recordProductUpdate} onClose={closeProductUpdate} />}
  </div>;
}
