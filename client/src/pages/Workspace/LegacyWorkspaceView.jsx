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
import { useResolvedReducedMotion } from '../../lib/theme';
import { useI18n } from '../../i18n/context';

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

export default function LegacyWorkspaceView({
  user, wallet, prefs, resolvedTheme, workspaceAccent, leftCollapsed, setLeftCollapsed, rightOpen,
  documentOpen, page, active, workflow, hasSubscriptionPlan, workspacePlanLabel, navigate,
  setDocumentOpen, setRightOpen, setTutorialFirstUse, setTutorialOpen, setPrefs, setModal,
  messages, attachments, documentState, activeJob, input, setInput, busy, actionBusy, attachmentKind,
  setAttachmentKind, uploadRef, send, upload, removeAttachment, updateAttachmentCategory, createDocument,
  performChatAction, contextOpen, setContextOpen, config, updateConfig, pendingLandingFiles,
  setPendingLandingFiles, pasteImagesIntoChat, addPendingFiles, aiMode, setAiMode, aiModeAccess, aiConsentData, setAiConsentData, enableExternalAiConsent, quizMode, setQuizMode,
  startDocumentQuiz, submitDocumentQuiz, editingMessage, setEditingMessageId, reviseChatMessage, reactToMessage,
  documents, loadDocuments, sessions, openSession, setNotice, projectEntries, projectParam, openProject,
  createProject, createProjectChat, setProjectPinned, documentAction, downloadExport, restoreDocumentVersion,
  pendingConfigRequest, saveConfig, modal, refreshSession, loadSessions, identityIntake,
  completeIdentityIntake, closeTutorial, tutorialOpen, productUpdate, recordProductUpdate, closeProductUpdate,
  accountOpen, setAccountOpen, isMaxPlan, logout, closeMobileSidebar, sidebarGroupProps,
  pinnedProjects, pinnedSessions, recentGroups, recentSearchOpen, setRecentSearchOpen,
  recentSearchInputRef, recentSearchQuery, setRecentSearchQuery, groupLabel, moveSessionToGroup,
  headerSubtitle, startNewChat, setRoute,
}) {
  const { t } = useI18n();
  const reducedMotion = useResolvedReducedMotion(prefs.reducedMotion);
  const navItems = [
    { key: 'chat', label: t('workspace.chats'), icon: MessageCircle },
    { key: 'projects', label: t('workspace.shell.projects'), icon: FolderKanban },
    { key: 'documents', label: t('workspace.documents'), icon: FolderOpen },
  ];
  return <div className={`workspace ${leftCollapsed ? 'left-collapsed' : ''} ${rightOpen && page === 'chat' ? 'right-open' : ''} ${documentOpen && page === 'chat' ? 'document-open' : ''} ${resolvedTheme === 'dark' ? 'theme-dark' : ''} ${prefs.compact ? 'compact' : ''}`} data-motion={reducedMotion ? 'reduce' : 'full'} data-accent={workspaceAccent.key} data-contrast={prefs.contrast || 'default'} data-language={prefs.language || 'id'} style={{ '--workspace-orange': workspaceAccent.color, '--workspace-accent': workspaceAccent.color, '--workspace-accent-contrast': workspaceAccent.contrast, '--workspace-accent-ink': resolvedTheme === 'light' ? workspaceAccent.lightInk : workspaceAccent.color }}>
    <aside className="left-sidebar">
      <div className="sidebar-top">
        <Link to="/app" className="workspace-brand"><BrandMark /><b>Laprakin</b></Link>
        <IconButton className="sidebar-collapse-button" label={leftCollapsed ? t('workspace.shell.sidebarOpen') : t('workspace.shell.sidebarCollapse')} onClick={() => setLeftCollapsed(!leftCollapsed)}>{leftCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</IconButton>
      </div>
      <nav className="workspace-nav">{navItems.map(({ key, label, icon: Icon }) => <button key={key} className={page === key ? 'active' : ''} onClick={() => key === 'chat' ? startNewChat() : setRoute(key)} title={label}><Icon size={16} /><span>{label}</span></button>)}</nav>
      <div className="sidebar-session-scroll">
        {pinnedProjects.length || pinnedSessions.length ? <div className="pinned-session-block">
          <div className="session-section-title"><span>{t('workspace.shell.pinned')}</span></div>
          {pinnedProjects.map((project) => <button type="button" className="pinned-project-row" key={normalizedCourseKey(project.name)} onClick={() => openProject(project.name)} title={project.name}><FolderKanban size={14}/><span>{project.name}</span><small>{project.count}</small></button>)}
          <div className="session-list"><SessionGroup group={t('workspace.shell.pinned')} items={pinnedSessions} {...sidebarGroupProps} onDropGroup={(session) => moveSessionToGroup(session, groupLabel(session))} /></div>
        </div> : null}
        <div className={`session-heading ${recentSearchOpen ? 'is-searching' : ''}`}>
           {recentSearchOpen ? <label className="recent-search-field"><Search size={13}/><input ref={recentSearchInputRef} value={recentSearchQuery} onChange={(event) => setRecentSearchQuery(event.target.value)} placeholder={t('workspace.shell.searchPlaceholder')} aria-label={t('workspace.shell.searchLabel')} onKeyDown={(event) => { if (event.key === 'Escape') { setRecentSearchOpen(false); setRecentSearchQuery(''); } }} /><button type="button" aria-label={t('workspace.shell.closeSearch')} onClick={() => { setRecentSearchOpen(false); setRecentSearchQuery(''); }}><X size={12}/></button></label> : <><span>{t('workspace.shell.recents')}</span><button className="recent-search-trigger" type="button" title={t('workspace.shell.searchChats')} aria-label={t('workspace.shell.searchChats')} onClick={() => setRecentSearchOpen(true)}><Search size={13} /></button></>}
        </div>
        <div className="session-list">{recentGroups.map(([group, items]) => <SessionGroup key={normalizedCourseKey(group)} group={group} items={items} {...sidebarGroupProps} onDropGroup={(session) => moveSessionToGroup(session, group)} />)}</div>
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-support-actions">
          <button onClick={() => { closeMobileSidebar(); setModal('help'); }} title={t('workspace.shell.support')}><HelpCircle size={16} /><span>{t('workspace.shell.support')}</span></button>
          <button onClick={() => { closeMobileSidebar(); setModal('feedback'); }} title={t('workspace.shell.feedback')}><MessageCircle size={16} /><span>{t('workspace.shell.feedback')}</span></button>
          <button onClick={() => { closeMobileSidebar(); setModal('settings'); }} title={t('workspace.shell.settings')}><Settings2 size={16} /><span>{t('workspace.shell.settings')}</span></button>
        </div>
    <div className="account-row"><button onClick={() => setAccountOpen(!accountOpen)} title={t('workspace.shell.accountMenu')}><span>{userInitials(user)}</span><div><b>{user.fullName || user.email.split('@')[0]}</b><small>{t('workspace.shell.availableReports', { count: wallet?.balances?.total || 0 })}</small></div><ChevronRight size={14} /></button></div>
      </div>
    </aside>
    {accountOpen && <AccountPopover showUpgrade={!isMaxPlan} onClose={() => setAccountOpen(false)} onOpen={(target) => { closeMobileSidebar(); setAccountOpen(false); if (target === 'billing') navigate('/pricing'); else setModal(target); }} onLogout={logout} />}
    {!leftCollapsed && <button className="mobile-scrim" aria-label={t('workspace.shell.closeNavigation')} onClick={() => setLeftCollapsed(true)} />}
    <IconButton className="mobile-nav-toggle" label={t('workspace.shell.openNavigation')} onClick={() => setLeftCollapsed(false)}><Menu size={17} /></IconButton>
    <main className="workspace-main">
      {page === 'chat' && <>
        <header className="workspace-header"><div className={`header-title ${active ? '' : 'is-empty'}`}><b>{active?.title || t('workspace.shell.chatTitle')}</b><small>{headerSubtitle}</small></div>{!hasSubscriptionPlan && <button className="workspace-plan" onClick={() => navigate('/pricing')} title={t('workspace.shell.openBilling')}><span>{workspacePlanLabel}</span><i>?</i><b>{t('workspace.shell.upgrade')}</b></button>}<div className="header-actions"><button className={`header-config-button ${rightOpen ? 'active' : ''}`} aria-label={t('workspace.shell.chatConfiguration')} title={t('workspace.shell.chatConfiguration')} onClick={() => { setDocumentOpen(false); setRightOpen((value) => !value); }}><SlidersHorizontal size={15} /><span>{t('workspace.shell.configure')}</span></button><IconButton label={t('workspace.shell.openTutorial')} className="tutorial-button" onClick={() => { setTutorialFirstUse(false); setTutorialOpen(true); }}><HelpCircle size={16} /></IconButton><IconButton label={prefs.theme === 'system' ? t('workspace.shell.followSystem') : resolvedTheme === 'dark' ? t('workspace.shell.useLight') : t('workspace.shell.useDark')} className="theme-button" onClick={() => setPrefs((value) => ({ ...value, theme: value.theme === 'system' ? (resolvedTheme === 'dark' ? 'light' : 'dark') : value.theme === 'dark' ? 'light' : 'system' }))}>{prefs.theme === 'system' ? <Monitor size={16} /> : resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</IconButton><IconButton label={t('workspace.shell.notifications')} onClick={() => setModal('notifications')}><Bell size={16} /></IconButton></div></header>
        <ChatSurface active={active} messages={messages} attachments={attachments} documentState={documentState} workflow={workflow} activeJob={activeJob} user={user} input={input} setInput={setInput} busy={busy || actionBusy} attachmentKind={attachmentKind} setAttachmentKind={setAttachmentKind} uploadRef={uploadRef} send={send} upload={upload} removeAttachment={removeAttachment} updateAttachmentCategory={updateAttachmentCategory} createDocument={createDocument} onWorkflowAction={performChatAction} contextOpen={contextOpen} setContextOpen={setContextOpen} config={config} updateConfig={updateConfig} pendingFiles={pendingLandingFiles} onPasteImages={pasteImagesIntoChat} onAddPendingFiles={addPendingFiles} onRemovePending={(index) => setPendingLandingFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))} aiMode={aiMode} setAiMode={setAiMode} aiModeAccess={aiModeAccess} aiConsentData={aiConsentData} onEnableExternalAi={enableExternalAiConsent} onUpgrade={() => navigate('/pricing')} enterToSend={prefs.enterToSend !== false} onOpenDocument={() => { setRightOpen(false); setDocumentOpen(true); }} quizMode={quizMode} onCloseQuiz={() => setQuizMode(false)} onStartQuiz={startDocumentQuiz} onSubmitQuiz={submitDocumentQuiz} editingMessage={editingMessage} onEditMessage={(message) => { const editable = getEditableMessage(messages, message.id); if (!editable) return; setEditingMessageId(editable.id); }} onEditSubmit={(messageId, content) => reviseChatMessage({ messageId, mode: 'edit', content })} onCancelEdit={() => { setEditingMessageId(null); }} onRevise={reviseChatMessage} onMessageReaction={reactToMessage} />
      </>}
      {page === 'documents' && <DocumentLibrary documents={documents} onRefresh={loadDocuments} onOpen={(doc) => { const session = sessions.find((item) => item.document_id === doc.id); if (session) openSession(session.id); else setNotice(t('workspace.shell.chatNotAvailable')); }} />}
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
          <div className="right-head"><div><b>{t('workspace.shell.chatConfiguration')}</b><small>{pendingConfigRequest ? t('workspace.shell.configurationPending') : t('workspace.shell.configurationCurrent')}</small></div><IconButton label={t('workspace.shell.closeConfiguration')} onClick={() => setRightOpen(false)}><PanelRightClose size={16} /></IconButton></div>
          {(active || pendingConfigRequest?.session) ? <>
            <div className="right-body">
              {pendingConfigRequest && <div className="config-required-note"><CircleAlert size={16} /><div><b>{t('workspace.shell.requiredContext')}</b><p>{t('workspace.shell.requiredContextDescription')}</p></div></div>}
              {!pendingConfigRequest && <label>{t('workspace.shell.chatName')}<input aria-label={t('workspace.shell.chatName')} value={config.title} onChange={(event) => updateConfig({ title: event.target.value })} /></label>}
              <label>{t('workspace.shell.course')} <small>{t('workspace.shell.required')}</small><input aria-label={t('workspace.shell.course')} required value={config.configuration.courseName} onChange={(event) => updateConfig({ configuration: { courseName: event.target.value } })} placeholder="Contoh: Jaringan Komputer" /></label>
              <label>{t('workspace.shell.module')} <small>{t('workspace.shell.required')}</small><input aria-label={t('workspace.shell.module')} required value={config.configuration.moduleTitle} onChange={(event) => updateConfig({ configuration: { moduleTitle: event.target.value } })} placeholder="Contoh: Routing Protocol" /></label>
              <label>{t('workspace.shell.lecturer')} <small>{t('workspace.shell.optional')}</small><input aria-label={t('workspace.shell.lecturer')} value={config.configuration.lecturerName || ''} onChange={(event) => updateConfig({ configuration: { lecturerName: event.target.value } })} placeholder="Nama dosen" /></label>
              <label>{t('workspace.shell.lecturerNip')} <small>{t('workspace.shell.optional')}</small><input aria-label={t('workspace.shell.lecturerNip')} value={config.configuration.lecturerNip || ''} onChange={(event) => updateConfig({ configuration: { lecturerNip: event.target.value } })} placeholder="NIP jika ada" /></label>
              <label htmlFor="config-document-profile">{t('workspace.shell.structure')}<CustomSelect id="config-document-profile" ariaLabel={t('workspace.shell.structure')} value={config.configuration.documentProfile} onChange={(value) => updateConfig({ configuration: { documentProfile: value } })} options={[{ value: 'langkah', label: 'Berbasis langkah' }, { value: 'pengujian', label: 'Berbasis pengujian' }, { value: 'proyek', label: 'Berbasis proyek' }]} /></label>
              <div className="structure-choice"><button className={config.structureMode === 'guided' ? 'active' : ''} onClick={() => updateConfig({ structureMode: 'guided' })}><LayoutTemplate size={15} /><span><b>{t('workspace.shell.guidedStructure')}</b><small>{t('workspace.shell.guidedStructureDescription')}</small></span></button><button className={config.structureMode === 'custom' ? 'active' : ''} onClick={() => updateConfig({ structureMode: 'custom' })}><SlidersHorizontal size={15} /><span><b>{t('workspace.shell.customStructure')}</b><small>{t('workspace.shell.customStructureDescription')}</small></span></button></div>
               {config.structureMode === 'custom' && <label>{t('workspace.shell.customOrder')}<textarea aria-label={t('workspace.shell.customOrder')} value={config.configuration.customStructure} onChange={(event) => updateConfig({ configuration: { customStructure: event.target.value } })} placeholder={t('workspace.shell.customOrderPlaceholder')} /></label>}
               <label>{t('workspace.shell.extraInstructions')}<textarea aria-label={t('workspace.shell.extraInstructions')} value={config.configuration.instructions} onChange={(event) => updateConfig({ configuration: { instructions: event.target.value } })} placeholder={t('workspace.shell.extraInstructionsPlaceholder')} /></label>
            </div>
            <div className="right-foot"><Button onClick={saveConfig} disabled={busy}><Save size={14} />{pendingConfigRequest ? t('workspace.shell.saveAndStart') : t('workspace.shell.save')}</Button><small>{t('workspace.shell.configurationNote')}</small></div>
          </> : <div className="empty-config"><PanelRightOpen size={20} /><b>{t('workspace.shell.noActiveChat')}</b><p>{t('workspace.shell.promptToOpen')}</p></div>}
        </div>}
    </aside>}
    {SETTINGS_MODAL_TABS[modal] && <SettingsModal initialTab={SETTINGS_MODAL_TABS[modal]} onClose={() => setModal(null)} onSaved={refreshSession} onArchivedChanged={loadSessions} onOpenBilling={() => { setModal(null); navigate('/pricing'); }} onAiConsentChange={setAiConsentData} prefs={prefs} setPrefs={setPrefs} />}{modal === 'help' && <HelpModal onClose={() => setModal(null)} />}{modal === 'feedback' && <FeedbackModal onClose={() => setModal(null)} />}{modal === 'notifications' && <NotificationModal onClose={() => setModal(null)} />}{identityIntake && <IdentityIntakeModal user={user} busy={busy} onSave={completeIdentityIntake} onBack={() => setIdentityIntake(null)} />}{tutorialOpen && <WorkspaceTutorial onClose={closeTutorial} />}{productUpdate && <ProductUpdatePopup update={productUpdate} onReceipt={recordProductUpdate} onClose={closeProductUpdate} />}
  </div>;
}
