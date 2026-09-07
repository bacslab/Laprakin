import { useState } from 'react';
import { ArrowLeft, Globe2, UploadCloud } from '../../icons';
import { collapseMessageRevisions, getMessageRevisionGroup, getRegenerationTarget } from '../../lib/chat-message-actions';
import { userGreetingName } from '../../lib/user';
import { useI18n } from '../../i18n/context';
import { SourceBar } from './AttachmentComponents';
import AttachmentPreviewModal from './AttachmentPreview';
import Composer from './Composer';
import { ThinkingRail, WorkPlanRail, WorkflowPanel } from './WorkspaceWorkflow';
import { AssistantMessageActions, ChatBriefPanel, DocumentCard, DocumentQuiz, InlineContext, InlineUserMessageEditor, MessageContent, UserMessageActions, VersionPickerModal } from './ChatComponents';

export default function ChatSurface({ active, messages, attachments, documentState, workflow, activeJob, user, input, setInput, busy, attachmentKind, setAttachmentKind, uploadRef, send, upload, createDocument, onWorkflowAction, contextOpen, setContextOpen, config, updateConfig, pendingFiles, onPasteImages, onAddPendingFiles, onRemovePending, aiMode, setAiMode, aiModeAccess, aiConsentData, onEnableExternalAi, onUpgrade, enterToSend = true, onOpenDocument, quizMode = false, onCloseQuiz, onStartQuiz, onSubmitQuiz, editingMessage, onEditMessage, onEditSubmit, onCancelEdit, onRevise, onMessageReaction }) {
  const { t } = useI18n();
  const blankChat = !active || (!messages.length && !attachments.length && !active.document_id);
  const [previewFile, setPreviewFile] = useState(null);
  const [revisionGroup, setRevisionGroup] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const greetingName = userGreetingName(user);
  const greetingClass = greetingName.length > 17 ? 'greeting-name-very-long' : greetingName.length > 12 ? 'greeting-name-long' : '';
  const visibleMessages = collapseMessageRevisions(messages
    .filter((message) => message.meta?.kind !== 'attachments'))
    .filter((message, index, items) => {
      if (!index || message.role !== 'assistant') return true;
      const previous = items[index - 1];
      return previous.role !== 'assistant' || previous.content.trim() !== message.content.trim();
    });
  const userMessages = visibleMessages.filter((message) => message.role === 'user');
  const visibleUserIds = new Set(userMessages.map((message) => message.id));
  const attachmentBuckets = new Map();
  attachments.forEach((file) => {
    let messageId = file.message_id;
    if (messageId && !visibleUserIds.has(messageId)) messageId = '';
    if (!messageId && userMessages.length) {
      const uploadedAt = new Date(file.created_at || file.createdAt || 0).getTime();
      messageId = userMessages.find((message) => new Date(message.created_at || message.createdAt || 0).getTime() >= uploadedAt)?.id
        || userMessages.at(-1)?.id;
    }
    if (!messageId) return;
    attachmentBuckets.set(messageId, [...(attachmentBuckets.get(messageId) || []), file]);
  });
  const assignedAttachmentIds = new Set(Array.from(attachmentBuckets.values()).flat().map((file) => file.id));
  const orphanAttachments = attachments.filter((file) => !assignedAttachmentIds.has(file.id));
  const documentProcessing = Boolean(active?.document_id && (documentState?.status !== 'generated' || ['queued', 'running', 'retry_queued'].includes(activeJob?.status)));
  const hasDocumentReadyMessage = visibleMessages.some((message) => message.meta?.kind === 'document_ready');
  const hasEmbeddedPlan = visibleMessages.some((message) => message.role === 'assistant' && message.meta?.workPlan?.steps?.length);
  const jobForMessage = (message) => {
    const jobId = message.meta?.jobId;
    if (!jobId) return null;
    return activeJob?.id === jobId
      ? activeJob
      : documentState?.jobs?.find((job) => job.id === jobId) || null;
  };
  const hasFileDrag = (event) => Array.from(event.dataTransfer?.types || []).includes('Files');
  return <div
    className={`chat-surface ${blankChat ? 'empty-chat' : 'has-chat'} ${dragActive ? 'chat-drop-active' : ''}`}
    onDragEnter={(event) => { if (!hasFileDrag(event)) return; event.preventDefault(); setDragActive(true); }}
    onDragOver={(event) => { if (!hasFileDrag(event)) return; event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false); }}
    onDrop={(event) => {
      if (!hasFileDrag(event)) return;
      event.preventDefault();
      setDragActive(false);
      onAddPendingFiles(Array.from(event.dataTransfer.files || []));
    }}
  >
    {dragActive && <div className="workspace-drop-hint" aria-hidden="true"><UploadCloud size={22} /><b>{t('workspace.chatSurface.dropHint')}</b><small>{t('workspace.chatSurface.dropDescription')}</small></div>}
    <div className="chat-thread">
      {quizMode && documentState ? <div className="quiz-workspace-panel"><header><div><small>{t('workspace.chatSurface.quizEyebrow')}</small><h2>{t('workspace.chatSurface.quizTitle')}</h2></div><button type="button" onClick={onCloseQuiz}><ArrowLeft size={14}/>{t('workspace.chatSurface.quizBack')}</button></header><DocumentQuiz access={documentState.quizAccess} busy={busy} onStart={onStartQuiz} onSubmit={onSubmitQuiz} /></div> : blankChat ? <div className="chat-welcome chat-welcome-minimal"><h1 className={greetingClass}>{t('workspace.chatSurface.greetingLead')} <em>{t('workspace.chatSurface.greetingAccent')}</em> {t('workspace.chatSurface.greetingTail', { name: greetingName })}</h1></div> : <div className="thread-content">
      {visibleMessages.map((message) => <div className={`message-turn message-turn-${message.role} ${editingMessage?.id === message.id ? 'is-editing' : ''}`} key={message.id}>
        {message.role === 'user' && attachmentBuckets.get(message.id)?.length ? <SourceBar compact attachments={attachmentBuckets.get(message.id)} onOpen={setPreviewFile} /> : null}
        {message.role === 'assistant' && !message.meta?.isClarification && message.meta?.workPlan?.steps?.length ? <WorkPlanRail
          plan={message.meta.workPlan}
          job={jobForMessage(message) || (message.meta?.kind === 'document_ready' ? null : activeJob)}
          documentState={documentState}
          completed={message.meta?.kind === 'document_ready'}
          startedAt={message.meta.thinkingStartedAt}
          finishedAt={message.meta.thinkingFinishedAt || message.created_at}
        /> : null}
        <article className={`message ${message.role} ${editingMessage?.id === message.id ? 'is-editing' : ''}`}>
          {message.role === 'user' && editingMessage?.id === message.id
            ? <InlineUserMessageEditor message={message} busy={busy} onCancel={onCancelEdit} onSubmit={onEditSubmit} />
            : <div><MessageContent content={message.content}/>{message.meta?.links?.length ? <div className="link-row">{message.meta.links.map((link) => <a key={link} href={link} target="_blank" rel="noreferrer"><Globe2 size={12} />{new URL(link).hostname}</a>)}</div> : null}</div>}
        </article>
        {message.role === 'user' && <UserMessageActions message={message} onEdit={onEditMessage} onOpenVersionPicker={(target) => setRevisionGroup(getMessageRevisionGroup(messages, target.id))} busy={busy} />}
        {message.role === 'assistant' && <AssistantMessageActions
          message={message}
          busy={busy}
          onRegenerate={getRegenerationTarget(visibleMessages, message.id) ? () => {
            const target = getRegenerationTarget(visibleMessages, message.id);
            onRevise?.({ messageId: target.id, mode: 'regenerate' });
          } : undefined}
          onReaction={onMessageReaction}
        />}
        {message.meta?.kind === 'document_ready' ? <DocumentCard documentState={documentState} activeJob={jobForMessage(message)} version={message.meta.documentVersion} onOpen={onOpenDocument} /> : null}
      </div>)}
      {active && workflow?.state === 'CLARIFICATION_REQUIRED' && !active.document_id && <ChatBriefPanel config={config} updateConfig={updateConfig} workflow={workflow} busy={busy} onSubmit={(payload) => onWorkflowAction('SUBMIT_CLARIFICATION', payload)} />}
      {contextOpen && <InlineContext config={config} updateConfig={updateConfig} onClose={() => setContextOpen(false)} />}
      {orphanAttachments.length > 0 && <SourceBar compact attachments={orphanAttachments} onOpen={setPreviewFile} />}
      {active?.document_id
        ? <>{documentProcessing && !hasEmbeddedPlan && <WorkPlanRail workflow={workflow} job={activeJob || documentState?.jobs?.[0] || null} documentState={documentState} />}{!documentProcessing && !hasDocumentReadyMessage && <DocumentCard documentState={documentState} activeJob={activeJob} onOpen={onOpenDocument} />}</>
        : !hasEmbeddedPlan && <WorkflowPanel workflow={workflow} busy={busy} onCreate={createDocument} onAction={onWorkflowAction} aiMode={aiMode} />}
      {busy && !active?.document_id && !['queued', 'running', 'retry_queued'].includes(activeJob?.status) && <ThinkingRail />}
    </div>}</div>
    {!quizMode && <Composer input={input} setInput={setInput} busy={busy} attachmentKind={attachmentKind} setAttachmentKind={setAttachmentKind} uploadRef={uploadRef} send={send} upload={upload} centered={blankChat} pendingFiles={pendingFiles} onPasteImages={onPasteImages} onRemovePending={onRemovePending} aiMode={aiMode} setAiMode={setAiMode} aiModeAccess={aiModeAccess} aiConsentData={aiConsentData} onEnableExternalAi={onEnableExternalAi} onUpgrade={onUpgrade} enterToSend={enterToSend} />}
    {revisionGroup && <VersionPickerModal group={revisionGroup} onClose={() => setRevisionGroup(null)} />}
    {previewFile && <AttachmentPreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
  </div>;
}
