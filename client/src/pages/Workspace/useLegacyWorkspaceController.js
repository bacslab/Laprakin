import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from '../../router';
import { api, apiStream, clearCsrfToken, download } from '../../api';
import { buildRevisionRequest, getEditableMessage } from '../../lib/chat-message-actions';
import { courseTokens, normalizedCourseKey } from '../../lib/academic';
import { inferPendingAttachmentKind } from '../../lib/attachments';
import { useResolvedTheme } from '../../lib/theme';
import { useApp } from '../../state/ui-context';
import {
  canonicalCourseLabel, clipboardImageFiles, courseLabelsMatch, defaultChatConfig, mergeFiles,
  preferredCourseLabel, resolveAccent, takeLandingDraft,
} from '../../lib/workspace-helpers';

export function useLegacyWorkspaceController() {
  const { user, wallet, refreshSession, setNotice, prefs, setPrefs, showDialog } = useApp();
  const resolvedTheme = useResolvedTheme(prefs.theme || 'system');
  const location = useLocation(); const navigate = useNavigate(); const uploadRef = useRef(null);
  const [sessions, setSessions] = useState([]); const [active, setActive] = useState(null); const [messages, setMessages] = useState([]); const [attachments, setAttachments] = useState([]); const [documentState, setDocumentState] = useState(null); const [workflow, setWorkflow] = useState(null); const [activeJob, setActiveJob] = useState(null);
  const [input, setInput] = useState(''); const [pendingLandingFiles, setPendingLandingFiles] = useState([]); const [busy, setBusy] = useState(false); const [actionBusy, setActionBusy] = useState(false); const [accountOpen, setAccountOpen] = useState(false); const [draggingSession, setDraggingSession] = useState(null); const [renamingId, setRenamingId] = useState(null); const [editingMessageId, setEditingMessageId] = useState(null); const [leftCollapsed, setLeftCollapsed] = useState(() => window.innerWidth < 860 || localStorage.getItem('laprakin-left-collapsed') === 'true'); const [rightOpen, setRightOpen] = useState(false); const [documentOpen, setDocumentOpen] = useState(false); const [quizMode, setQuizMode] = useState(false); const [modal, setModal] = useState(null); const [config, setConfig] = useState(defaultChatConfig); const [contextOpen, setContextOpen] = useState(false); const [attachmentKind, setAttachmentKind] = useState(''); const [documents, setDocuments] = useState([]); const [projectPins, setProjectPins] = useState([]); const [billingPlan, setBillingPlan] = useState(null); const [aiMode, setAiMode] = useState('basic'); const [aiModeAccess, setAiModeAccess] = useState({ basic: { available: true }, thinking: { available: false }, xtrathink: { available: false } }); const [recentSearchOpen, setRecentSearchOpen] = useState(false); const [recentSearchQuery, setRecentSearchQuery] = useState(''); const [identityIntake, setIdentityIntake] = useState(null); const [pendingConfigRequest, setPendingConfigRequest] = useState(null); const [tutorialOpen, setTutorialOpen] = useState(false); const [tutorialFirstUse, setTutorialFirstUse] = useState(false);
  const actionInFlightRef = useRef(false);
  const sendInFlightRef = useRef(false);
  const tutorialAutoOpenedRef = useRef(false);
  const recentSearchInputRef = useRef(null);
  const [productUpdate, setProductUpdate] = useState(null);
  const page = location.pathname.includes('/projects') ? 'projects' : location.pathname.includes('/documents') ? 'documents' : 'chat';
  const editingMessage = getEditableMessage(messages, editingMessageId);
  useEffect(() => {
    if (prefs.productUpdates === false || productUpdate) return undefined;
    let disposed = false;
    let lastActivityAt = Date.now();
    const loadPendingUpdate = async () => {
      try {
        const data = await api('/product-updates/pending');
        if (!disposed && data.update) {
          setProductUpdate(data.update);
          api(`/product-updates/${data.update.id}/receipt`, { method: 'POST', body: { action: 'seen' } }).catch(() => {});
        }
      } catch { /* product communication must never block the workspace */ }
    };
    const onActivity = () => {
      const wasIdle = Date.now() - lastActivityAt >= 5 * 60 * 1000;
      lastActivityAt = Date.now();
      if (wasIdle) loadPendingUpdate();
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') onActivity(); };
    loadPendingUpdate();
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    window.addEventListener('focus', onActivity);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('focus', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [prefs.productUpdates, productUpdate]);
  useEffect(() => {
    if (!recentSearchOpen) return undefined;
    const frame = window.requestAnimationFrame(() => recentSearchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [recentSearchOpen]);
  const projectParam = new URLSearchParams(location.search).get('project') || '';
  useEffect(() => { if (location.pathname === '/app/billing') navigate('/pricing', { replace: true }); }, [location.pathname, navigate]);
  const identityComplete = Boolean(user.fullName && user.nim && user.className && user.institutionName && user.institutionLogoUrl && (user.facultyName || user.departmentKey) && (user.studyProgramName || user.studyProgramKey));
  useEffect(() => {
    if (user.onboardingDismissed || tutorialAutoOpenedRef.current) return;
    tutorialAutoOpenedRef.current = true;
    setTutorialFirstUse(true);
    setTutorialOpen(true);
  }, [user.onboardingDismissed]);
  const updateConfig = (patch) => setConfig((value) => ({ ...value, ...patch, configuration: { ...value.configuration, ...(patch.configuration || {}) } }));
  const closeMobileSidebar = () => { if (window.innerWidth <= 700) setLeftCollapsed(true); };
  const setRoute = (next) => { closeMobileSidebar(); navigate(next === 'chat' ? '/app' : `/app/${next}`); };
  const writingPrefsConfig = (base = {}) => {
    const extraInstructions = String(prefs.customInstructions || '').trim();
    const localInstructions = String(base.instructions || '').trim();
    const instructions = extraInstructions && localInstructions
      ? localInstructions.includes(extraInstructions) ? localInstructions : `${extraInstructions}\n\n${localInstructions}`
      : extraInstructions || localInstructions;
    return {
      ...base,
      documentProfile: prefs.profile || 'langkah',
      tone: prefs.tone || 'formal',
      perspective: prefs.perspective || 'saya',
      instructions,
      allowExternalAi: prefs.allowExternalAi !== false,
    };
  };
  const createDefaultConfig = () => ({ ...defaultChatConfig, configuration: writingPrefsConfig(defaultChatConfig.configuration) });
  const sessionPayload = (base) => ({ ...base, departmentKey: user.departmentKey || '', studyProgramKey: user.studyProgramKey || '', structureMode: base.structureMode || 'guided', courseGroup: base.courseGroup || base.configuration?.courseName || 'Belum dikelompokkan' });
  const hydrate = (data) => { setActive(data.session); if (data.session?.id) localStorage.setItem('laprakin-active-chat-id', data.session.id); setMessages(data.messages || []); setAttachments(data.attachments || []); setWorkflow(data.workflow || null); const current = data.session.configuration || {}; setConfig({ title: data.session.title || 'Laprak baru', structureMode: data.session.structure_mode || 'guided', configuration: { ...defaultChatConfig.configuration, ...current } }); };
  const loadSessions = async () => {
    try {
      const data = await api('/chat/sessions');
      const nextSessions = data.sessions || [];
      setSessions(nextSessions);
      const savedId = localStorage.getItem('laprakin-active-chat-id');
      if (!active && savedId && nextSessions.some((item) => item.id === savedId)) {
        hydrate(await api(`/chat/sessions/${savedId}`));
      }
    } catch (err) { setNotice(err.message); }
  };
  const loadDocuments = async () => { try { setDocuments(await api('/documents')); } catch (err) { setNotice(err.message); } };
  const loadProjectPins = async () => { try { const data = await api('/projects/pins'); setProjectPins(data.pins || []); } catch { setProjectPins([]); } };
  const loadBillingPlan = async () => { try { const billing = await api('/billing'); setBillingPlan(billing.currentPlan || null); } catch { /* Keep the workspace available if billing is temporarily unavailable. */ } };
  const loadAiModes = async () => { try { const result = await api('/ai/modes'); const next = result.modes || {}; setAiModeAccess(next); setAiMode((current) => next[current]?.available ? current : 'basic'); } catch { setAiModeAccess({ basic: { available: true }, thinking: { available: false }, xtrathink: { available: false } }); } };
  const appendAssistantMessage = (content) => setMessages((items) => [...items, {
    id: `local-assistant-${crypto.randomUUID()}`,
    role: 'assistant',
    content: String(content || 'Permintaan belum dapat diproses. Coba jelaskan kembali perubahan yang kamu inginkan.'),
    meta: { kind: 'local_conversation_feedback' },
    created_at: new Date().toISOString(),
  }]);
  const groupLabel = (item) => canonicalCourseLabel(item.course_group || item.courseGroup || item.configuration?.courseName || 'Belum dikelompokkan');
  const groupsFromSessions = (items) => {
    const groups = [];
    [...items]
      .sort((left, right) => courseTokens(groupLabel(right)).length - courseTokens(groupLabel(left)).length)
      .forEach((item) => {
        const label = groupLabel(item);
        const matching = groups.find((group) => courseLabelsMatch(group.label, label));
        if (matching) {
          matching.label = preferredCourseLabel(matching.label, label);
          matching.items.push(item);
        } else {
          groups.push({ label, items: [item] });
        }
      });
    return Object.fromEntries(groups.map((group) => [group.label, group.items]));
  };
  const orderedSessions = useMemo(() => [...sessions].sort((a, b) =>
    new Date(b.updated_at || b.updatedAt || b.created_at || b.createdAt || 0) - new Date(a.updated_at || a.updatedAt || a.created_at || a.createdAt || 0)
  ), [sessions]);
  const visibleRecentSessions = useMemo(() => {
    const query = recentSearchQuery.trim().toLocaleLowerCase();
    if (!query) return orderedSessions;
    return orderedSessions.filter((item) => `${item.title || 'Chat baru'} ${groupLabel(item)}`.toLocaleLowerCase().includes(query));
  }, [orderedSessions, recentSearchQuery]);
  const sessionFolders = useMemo(() => Object.keys(groupsFromSessions(sessions)).filter((folder) => folder && folder !== 'Belum dikelompokkan'), [sessions]);
  const persistOrder = async (next) => {
    setSessions(next);
    try { await api('/chat/sessions/reorder', { method: 'POST', body: { items: next.map((item, index) => ({ id: item.id, courseGroup: groupLabel(item), sortPosition: index })) } }); } catch (err) { setNotice(err.message); await loadSessions(); }
  };
  const renameSession = async (id, title) => {
    const clean = title.trim().slice(0, 120); if (!clean) return setRenamingId(null);
    try { const data = await api(`/chat/sessions/${id}`, { method: 'PUT', body: { title: clean } }); setSessions((old) => old.map((item) => item.id === id ? data.session : item)); if (active?.id === id) setActive(data.session); setRenamingId(null); } catch (err) { setNotice(err.message); }
  };
  const moveSessionToGroup = async (session, targetGroup) => {
    const next = sessions.map((item) => item.id === session.id ? { ...item, course_group: targetGroup } : item);
    await persistOrder(next);
  };
  const setPinned = async (session, pinned) => {
    try {
      const data = await api(`/chat/sessions/${session.id}/pin`, { method: 'POST', body: { pinned } });
      setSessions((items) => items.map((item) => item.id === session.id ? data.session : item));
      setNotice(pinned ? 'Chat disematkan.' : 'Chat dilepas dari sematan.');
    } catch (err) { setNotice(err.message); }
  };
  const setProjectPinned = async (project, pinned) => {
    const projectKey = normalizedCourseKey(project.name);
    try {
      await api('/projects/pins', {
        method: 'POST',
        body: { projectName: project.name, projectKey, pinned },
      });
      setProjectPins((items) => pinned
        ? [...items.filter((item) => item.projectKey !== projectKey), { projectKey, projectName: project.name }]
        : items.filter((item) => item.projectKey !== projectKey));
      setNotice(pinned ? 'Project disematkan.' : 'Project dilepas dari sematan.');
    } catch (err) { setNotice(err.message); }
  };
  const archiveSession = async (session) => {
    try {
      await api(`/chat/sessions/${session.id}/archive`, { method: 'POST', body: {} });
      setSessions((items) => items.filter((item) => item.id !== session.id));
      if (active?.id === session.id) { localStorage.removeItem('laprakin-active-chat-id'); setActive(null); setMessages([]); setAttachments([]); setDocumentState(null); setWorkflow(null); setActiveJob(null); setEditingMessageId(null); setInput(''); }
      setNotice('Chat diarsipkan.');
    } catch (err) { setNotice(err.message); }
  };
  const deleteSession = async (session) => {
    try {
      await api(`/chat/sessions/${session.id}`, { method: 'DELETE' });
      setSessions((items) => items.filter((item) => item.id !== session.id));
      if (active?.id === session.id) { localStorage.removeItem('laprakin-active-chat-id'); setActive(null); setMessages([]); setAttachments([]); setDocumentState(null); setWorkflow(null); setActiveJob(null); setEditingMessageId(null); setInput(''); }
      setNotice('Chat dihapus permanen.');
    } catch (err) { setNotice(err.message); }
  };
  useEffect(() => { loadSessions(); loadDocuments(); loadProjectPins(); loadBillingPlan(); loadAiModes(); }, []);
  useEffect(() => { takeLandingDraft().then(({ prompt, files }) => { if (prompt) setInput(prompt); if (files?.length) setPendingLandingFiles(files); }); }, []);
  useEffect(() => { localStorage.setItem('laprakin-left-collapsed', String(leftCollapsed)); }, [leftCollapsed]);
  useEffect(() => {
    let disposed = false;
    let refreshTimer = null;
    if (!active?.document_id) { setDocumentState(null); setActiveJob(null); return undefined; }
    const refreshDocument = async () => {
      try {
        const data = await api(`/documents/${active.document_id}`);
        if (disposed) return;
        setDocumentState(data);
        const liveJob = data.jobs?.find((job) => ['queued', 'running', 'retry_queued'].includes(job.status));
        setActiveJob(liveJob || data.jobs?.[0] || null);
        if (data.status !== 'generated' || liveJob) refreshTimer = window.setTimeout(refreshDocument, 1000);
      } catch {
        if (!disposed) refreshTimer = window.setTimeout(refreshDocument, 2200);
      }
    };
    refreshDocument();
    return () => { disposed = true; if (refreshTimer) window.clearTimeout(refreshTimer); };
  }, [active?.document_id]);
  useEffect(() => { if (location.pathname.endsWith('/support')) { setModal('help'); navigate('/app', { replace: true }); } if (location.pathname.endsWith('/feedback')) { setModal('feedback'); navigate('/app', { replace: true }); } if (location.pathname.endsWith('/profile')) { setModal('settings'); navigate('/app', { replace: true }); } }, [location.pathname, navigate]);
  const createSession = async (openConfig = false, overrides = {}) => {
    setEditingMessageId(null);
    setInput('');
    setBusy(true);
    try {
      const fresh = createDefaultConfig();
      const payload = {
        ...fresh,
        ...overrides,
        configuration: { ...fresh.configuration, ...(overrides.configuration || {}) },
      };
      const data = await api('/chat/sessions', { method: 'POST', body: sessionPayload(payload) });
      hydrate(data);
      setSessions((old) => [data.session, ...old]);
      setRoute('chat');
      setRightOpen(openConfig);
      setDocumentOpen(false);
      setContextOpen(false);
      return data.session;
    } catch (err) {
      appendAssistantMessage(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const startNewChat = () => {
    localStorage.removeItem('laprakin-active-chat-id');
    setActive(null);
    setMessages([]);
    setAttachments([]);
    setDocumentState(null);
    setWorkflow(null);
    setActiveJob(null);
    setConfig(createDefaultConfig());
    setInput('');
    setEditingMessageId(null);
    setPendingLandingFiles([]);
    setIdentityIntake(null);
    setPendingConfigRequest(null);
    setContextOpen(false);
    setRightOpen(false);
    setDocumentOpen(false);
    if (window.innerWidth <= 700) setLeftCollapsed(true);
    setRoute('chat');
  };
  const openSession = async (id) => { setEditingMessageId(null); setInput(''); try { const data = await api(`/chat/sessions/${id}`); hydrate(data); setPendingConfigRequest(null); setRoute('chat'); setRightOpen(false); setDocumentOpen(false); setContextOpen(false); if (window.innerWidth <= 700) setLeftCollapsed(true); } catch (err) { setNotice(err.message); } };
  const saveConfig = async () => {
    const targetSession = active || pendingConfigRequest?.session;
    if (!targetSession) return;
    const courseName = String(config.configuration.courseName || '').trim();
    const moduleTitle = String(config.configuration.moduleTitle || '').trim();
    if (!courseName || !moduleTitle) {
      setNotice('Isi mata kuliah dan modul atau materi sebelum memulai chat.');
      return;
    }
    setBusy(true);
    try {
      const nextTitle = pendingConfigRequest ? moduleTitle.slice(0, 100) : config.title;
      const data = await api(`/chat/sessions/${targetSession.id}`, {
        method: 'PUT',
        body: sessionPayload({
          ...config,
          title: nextTitle,
          configuration: { ...config.configuration, courseName, moduleTitle },
          courseGroup: courseName,
        }),
      });
      setActive(data.session);
      setSessions((old) => old.map((item) => item.id === data.session.id ? data.session : item));
      const queued = pendingConfigRequest;
      setPendingConfigRequest(null);
      setRightOpen(false);
      setNotice('Konfigurasi chat disimpan.');
      if (queued?.session?.id === data.session.id) {
        const next = { ...queued, session: data.session };
        await dispatchChatMessage(next);
      }
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  };
  const dispatchChatMessage = async ({ session, content, files = [], kind = '' }) => {
    let current = session;
    let streamAssistantId = '';
    setBusy(true);
    try {
      await api(`/chat/sessions/${current.id}/processing-access`, { method: 'POST', body: {} });
      await refreshSession();
      if (files.length) current = await uploadFiles(current, files, kind, false);
      const currentConfiguration = current.configuration || config.configuration || {};
      const syncedConfig = {
        title: current.title || config.title || 'Laprak baru',
        structureMode: current.structure_mode || current.structureMode || config.structureMode || 'guided',
        configuration: writingPrefsConfig(currentConfiguration),
        courseGroup: currentConfiguration.courseName || current.course_group || 'Belum dikelompokkan',
      };
      const synced = await api(`/chat/sessions/${current.id}`, { method: 'PUT', body: sessionPayload(syncedConfig) });
      current = synced.session;
      setActive(synced.session);
      setConfig({ title: synced.session.title || 'Laprak baru', structureMode: synced.session.structure_mode || 'guided', configuration: { ...defaultChatConfig.configuration, ...(synced.session.configuration || {}) } });
      setSessions((old) => old.map((item) => item.id === synced.session.id ? synced.session : item));
      streamAssistantId = `local-assistant-${crypto.randomUUID()}`;
      setMessages((items) => [...items, {
        id: `local-user-${crypto.randomUUID()}`,
        role: 'user',
        content,
        meta: { aiMode },
        created_at: new Date().toISOString(),
      }]);
      const data = await apiStream(`/chat/sessions/${current.id}/messages`, {
        method: 'POST',
        body: { content, aiMode, allowExternalAi: prefs.allowExternalAi !== false },
        onDelta: (delta) => {
          const text = String(delta || '');
          if (!text) return;
          setMessages((items) => {
            const existing = items.findIndex((item) => item.id === streamAssistantId);
            if (existing < 0) {
              return [...items, {
                id: streamAssistantId,
                role: 'assistant',
                content: text,
                meta: { aiMode, streaming: true },
                created_at: new Date().toISOString(),
              }];
            }
            return items.map((item, index) => index === existing ? { ...item, content: `${item.content || ''}${text}` } : item);
          });
        },
      });
      hydrate(data);
      setSessions((old) => old.map((item) => item.id === data.session.id ? data.session : item));
      setInput('');
      setPendingLandingFiles([]);
      if (data.autoGenerate) await createDocument(data.session);
      return data;
    } catch (err) {
      if (current?.id) {
        try { await api(`/chat/sessions/${current.id}/processing-access`, { method: 'DELETE', body: {} }); } catch { /* reservation tetap aman bila proses sudah dimulai */ }
        await refreshSession();
      }
      if (streamAssistantId) setMessages((items) => items.filter((item) => item.id !== streamAssistantId));
      appendAssistantMessage(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const reviseChatMessage = async ({ messageId, mode, content = '' }) => {
    if (!active?.id || busy || actionBusy) return null;
    let request;
    try {
      request = buildRevisionRequest({ sessionId: active.id, messageId, mode, content });
    } catch (error) {
      setNotice(error.message);
      return null;
    }
    setBusy(true);
    try {
      const data = await api(request.path, { method: 'POST', body: request.body });
      hydrate(data);
      setSessions((old) => old.map((item) => item.id === data.session.id ? data.session : item));
      setInput('');
      setEditingMessageId(null);
      setNotice(mode === 'regenerate' ? 'Jawaban AI dibuat ulang.' : 'Pesan dan jawaban AI diperbarui.');
      return data;
    } catch (error) {
      setNotice(error.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const completeIdentityIntake = async (identity) => {
    if (!identityIntake) return;
    setBusy(true);
    try {
      await api('/profile', {
        method: 'PUT',
        body: {
          fullName: identity.fullName.trim(),
          nim: identity.nim.trim(),
          className: identity.className.trim(),
          institutionName: identity.institutionName.trim(),
          institutionLogoUrl: identity.institutionLogoUrl.trim(),
          facultyName: identity.facultyName.trim(),
          studyProgramName: identity.studyProgramName.trim(),
          departmentKey: identity.departmentKey,
          studyProgramKey: identity.studyProgramKey,
        },
      });
      const sessionUpdate = await api(`/chat/sessions/${identityIntake.session.id}`, {
        method: 'PUT',
        body: {
          departmentKey: identity.departmentKey,
          studyProgramKey: identity.studyProgramKey,
        },
      });
      await refreshSession();
      const pending = { ...identityIntake, session: sessionUpdate.session };
      setIdentityIntake(null);
      await dispatchChatMessage(pending);
    } catch (err) {
      appendAssistantMessage(err.message);
      setBusy(false);
    }
  };
  const send = async (event) => {
    event?.preventDefault();
    if (sendInFlightRef.current || busy || actionBusy || (!input.trim() && !pendingLandingFiles.length)) return;
    sendInFlightRef.current = true;
    try {
    if (editingMessageId) {
      await reviseChatMessage({ messageId: editingMessageId, mode: 'edit', content: input });
      return;
    }
    let current = active;
    const requiresConfiguration = !current;
    const landingContent = input.trim() || 'Saya sudah menambahkan bahan untuk laprak ini.';
    const landingFiles = [...pendingLandingFiles];
    if (current?.id && pendingConfigRequest?.session?.id === current.id) {
      setRightOpen(true);
      return;
    }
    if (current?.document_id && documentState?.status === 'generated') {
      const content = input.trim() || 'Gunakan bahan tambahan ini untuk memperbarui laprak.';
      setInput('');
      const files = [...pendingLandingFiles];
      setPendingLandingFiles([]);
      const optimisticId = `local-user-${crypto.randomUUID()}`;
      setMessages((items) => [...items, {
        id: optimisticId,
        role: 'user',
        content,
        meta: { kind: 'revision_request', pending: true },
        created_at: new Date().toISOString(),
      }]);
      setBusy(true);
      try {
        if (files.length) await uploadFiles(current, files, attachmentKind, false);
        const out = await api(`/documents/${current.document_id}/revise`, {
          method: 'POST',
          body: { instruction: content, aiMode },
        });
        if (out.conversation) hydrate(out.conversation);
        if (out.needsClarification || !out.jobId) return;
        setActiveJob({ id: out.jobId, type: 'generate', status: 'queued', progress: 0, message: 'Memvalidasi dan menyiapkan revisi', timeline: [] });
        const job = await waitForJob(out.jobId);
        if (job.status !== 'completed') throw new Error(job.errorMessage || job.message || 'Revisi belum berhasil diproses.');
        const nextDocument = await api(`/documents/${current.document_id}`);
        setDocumentState(nextDocument);
        setActiveJob(nextDocument.jobs?.find((item) => item.id === job.id) || job);
        hydrate(await api(`/chat/sessions/${current.id}`));
        await loadDocuments();
      } catch (err) {
        setMessages((items) => [
          ...items.filter((item) => item.id !== optimisticId),
          { id: optimisticId, role: 'user', content, meta: { kind: 'revision_request' }, created_at: new Date().toISOString() },
          { id: `local-assistant-${crypto.randomUUID()}`, role: 'assistant', content: err.message, meta: { kind: 'revision_error' }, created_at: new Date().toISOString() },
        ]);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!current) {
      try {
        const access = await api('/chat/processing-access');
        if (!access.available) {
          appendAssistantMessage('Kredit Basic kamu sudah habis. Tambah kredit sebelum memulai laprak baru.');
          return;
        }
      } catch (err) {
        appendAssistantMessage(err.message);
        return;
      }
    }
    if (!current) {
      setInput('');
      setPendingLandingFiles([]);
      current = await createSession(false);
    }
    if (!current) return;
    const content = landingContent;
    const files = landingFiles;
    setInput('');
    setPendingLandingFiles([]);
    await dispatchChatMessage({ session: current, content, files, kind: attachmentKind });
    } finally {
      sendInFlightRef.current = false;
    }
  };
  const uploadFiles = async (current, files, kind = '', finalize = true) => {
    const groups = new Map();
    files.forEach((file) => {
      const resolvedKind = kind || inferPendingAttachmentKind(file);
      groups.set(resolvedKind, [...(groups.get(resolvedKind) || []), file]);
    });
    for (const [resolvedKind, groupedFiles] of groups) {
      const form = new FormData(); form.append('kind', resolvedKind); form.append('finalize', String(finalize)); groupedFiles.forEach((file) => form.append('files', file));
      await api(`/chat/sessions/${current.id}/attachments`, { method: 'POST', body: form, form: true });
    }
    const refreshed = await api(`/chat/sessions/${current.id}`);
    hydrate(refreshed);
    if (refreshed.session.document_id) {
      const nextDocument = await api(`/documents/${refreshed.session.document_id}`);
      setDocumentState(nextDocument);
      setActiveJob(nextDocument.jobs?.[0] || null);
    }
    return refreshed.session;
  };
  const upload = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length) addPendingFiles(files);
    event.target.value = '';
  };
  const pasteImagesIntoChat = (event) => { const images = clipboardImageFiles(event); if (!images.length) return; event.preventDefault(); setPendingLandingFiles((items) => mergeFiles(items, images).slice(0, 12)); };
  const addPendingFiles = (files) => { const incoming = Array.from(files || []); if (!incoming.length) return; setPendingLandingFiles((items) => mergeFiles(items, incoming).slice(0, 12)); };
  const removeAttachment = async (id) => { if (!active) return; try { const refreshed = await api(`/chat/sessions/${active.id}/attachments/${id}`, { method: 'DELETE' }); hydrate(refreshed); if (refreshed.session.document_id) { const nextDocument = await api(`/documents/${refreshed.session.document_id}`); setDocumentState(nextDocument); setActiveJob(nextDocument.jobs?.[0] || null); } } catch (err) { setNotice(err.message); } };
  const updateAttachmentCategory = async (id, kind) => {
    if (!active) return;
    try {
      const refreshed = await api(`/chat/sessions/${active.id}/attachments/${id}`, { method: 'PATCH', body: { kind } });
      hydrate(refreshed);
      setNotice('Kategori bahan diperbarui.');
    } catch (err) { setNotice(err.message); }
  };
  const waitForJob = async (jobId) => { const started = Date.now(); while (Date.now() - started < 300000) { const job = await api(`/jobs/${jobId}`); setActiveJob(job); if (['completed', 'failed', 'canceled'].includes(job.status)) return job; await new Promise((resolve) => setTimeout(resolve, 650)); } throw new Error('Proses masih berjalan. Timeline akan tetap tersedia saat chat ini dibuka lagi.'); };
  const waitForDocumentReady = async (documentId, sessionId) => {
    const started = Date.now();
    while (Date.now() - started < 600000) {
      const nextDocument = await api(`/documents/${documentId}`);
      setDocumentState(nextDocument);
      const liveJob = nextDocument.jobs?.find((job) => ['queued', 'running', 'retry_queued'].includes(job.status));
      setActiveJob(liveJob || nextDocument.jobs?.[0] || null);
      const completedGeneration = nextDocument.jobs?.some((job) => job.type === 'generate' && job.status === 'completed');
      if (nextDocument.status === 'generated' && completedGeneration && !liveJob) {
        if (sessionId) hydrate(await api(`/chat/sessions/${sessionId}`));
        return nextDocument;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    return null;
  };
  const createDocument = async (sessionOverride = null) => {
    const targetSession = sessionOverride?.id ? sessionOverride : active;
    if (!targetSession) return;
    setBusy(true);
    try {
      const out = await api(`/chat/sessions/${targetSession.id}/document`, { method: 'POST', body: { aiMode } });
      setDocumentState(out.document);
      const queuedJob = out.document.jobs?.find((job) => job.id === out.jobId)
        || out.document.jobs?.find((job) => ['queued', 'running', 'retry_queued'].includes(job.status));
      setActiveJob(queuedJob || (out.jobId ? { id: out.jobId, type: 'analyze', status: 'queued', progress: 0, message: 'Membaca bahan', timeline: [] } : out.document.jobs?.[0] || null));
      const refreshed = await api(`/chat/sessions/${targetSession.id}`);
      hydrate(refreshed);
      await waitForDocumentReady(out.document.id, targetSession.id);
      await loadDocuments();
    } catch (err) {
      try { hydrate(await api(`/chat/sessions/${targetSession.id}`)); } catch {}
      setNotice('Dokumen tetap diproses otomatis. Kamu boleh meninggalkan chat ini dan kembali lagi nanti.');
    } finally {
      setBusy(false);
    }
  };
  const performChatAction = async (type, payload = {}) => {
    if (!active || actionInFlightRef.current) return null;
    actionInFlightRef.current = true;
    setActionBusy(true);
    try {
      const data = await api(`/chat/sessions/${active.id}/actions`, {
        method: 'POST',
        body: {
          idempotencyKey: `${type.toLowerCase()}-${crypto.randomUUID()}`,
          type,
          payload: { ...payload, aiMode },
        },
      });
      hydrate(data);
      setSessions((items) => items.map((item) => item.id === data.session.id ? data.session : item));
      if (type === 'OPEN_SOURCE_UPLOAD') {
        setAttachmentKind(payload.sourceType === 'practice_evidence' ? 'practice_evidence' : payload.sourceType || '');
        window.requestAnimationFrame(() => uploadRef.current?.click());
      }
      if (data.autoGenerate) await createDocument(data.session);
      return data;
    } catch (err) {
      appendAssistantMessage(err.message);
      return null;
    } finally {
      actionInFlightRef.current = false;
      setActionBusy(false);
    }
  };
  const closeTutorial = async () => {
    setTutorialOpen(false);
    if (!tutorialFirstUse) return;
    setTutorialFirstUse(false);
    try {
      await api('/profile/onboarding', { method: 'POST', body: { dismissed: true } });
      await refreshSession();
    } catch (err) {
      setNotice(err.message);
    }
  };
  const documentAction = async (action, payload = {}) => {
    if (!active?.document_id) return;
    // Tanpa dialog konfirmasi: pengingat memeriksa dokumen sudah tampil permanen
    // di panel dokumen, dan quiz pemahaman tetap menjadi gerbang sebelum unduh.
    setBusy(true);
    try {
      const path = action === 'analyze'
        ? `/documents/${active.document_id}/analyze`
        : action === 'generate'
          ? `/documents/${active.document_id}/generate`
          : action === 'revise'
            ? `/documents/${active.document_id}/revise`
            : `/documents/${active.document_id}/export`;
      const body = action === 'export'
        ? { confirmReviewed: true }
        : action === 'revise'
          ? { instruction: payload.instruction }
          : {};
      const out = await api(path, { method: 'POST', body });
      setActiveJob({ id: out.jobId, type: action, status: 'queued', progress: 0, message: 'Masuk antrean', timeline: [] });
      const job = await waitForJob(out.jobId);
      if (job.status !== 'completed') throw new Error(job.errorMessage || job.message || 'Proses belum berhasil.');
      const nextDocument = await api(`/documents/${active.document_id}`);
      setDocumentState(nextDocument);
      setActiveJob(nextDocument.jobs?.find((item) => item.id === job.id) || job);
      if (['generate', 'revise'].includes(action) && active?.id) hydrate(await api(`/chat/sessions/${active.id}`));
      if (action === 'analyze') appendAssistantMessage('Bahan selesai dibaca. Laprakin melanjutkan pembuatan dokumen secara otomatis.');
      if (action === 'export') setNotice('DOCX siap diunduh.');
      return true;
    } catch (err) {
      if (['generate', 'revise'].includes(action) && active?.id) {
        try { hydrate(await api(`/chat/sessions/${active.id}`)); } catch (innerErr) { appendAssistantMessage(innerErr.message || err.message); }
      } else {
        appendAssistantMessage(err.message);
      }
      return false;
    } finally { setBusy(false); }
  };
  const restoreDocumentVersion = async (versionId) => {
    if (!active?.document_id || !versionId) return false;
    const confirmed = await showDialog({
      kind: 'confirm',
      title: 'Pulihkan versi dokumen?',
      message: 'Isi saat ini akan disimpan sebagai versi baru sebelum versi pilihan dipulihkan.',
      confirmLabel: 'Pulihkan versi',
    });
    if (!confirmed) return false;
    setBusy(true);
    try {
      await api(`/documents/${active.document_id}/versions/${versionId}/restore`, { method: 'POST', body: {} });
      const nextDocument = await api(`/documents/${active.document_id}`);
      setDocumentState(nextDocument);
      return true;
    } catch (err) {
      appendAssistantMessage(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const startDocumentQuiz = async () => {
    if (!active?.document_id) return null;
    setRightOpen(false);
    setDocumentOpen(true);
    setQuizMode(true);
    setBusy(true);
    try {
      return await api(`/documents/${active.document_id}/quiz`, { method: 'POST' });
    } catch (err) {
      setNotice(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const submitDocumentQuiz = async (attemptId, answers) => {
    if (!active?.document_id) return null;
    setBusy(true);
    try {
      const result = await api(`/documents/${active.document_id}/quiz/attempts/${attemptId}`, { method: 'POST', body: { answers } });
      const nextDocument = await api(`/documents/${active.document_id}`);
      setDocumentState(nextDocument);
      setNotice(result.passed ? `Nilai ${result.score}%. Download sudah terbuka.` : `Nilai ${result.score}%. Minimal ${result.passScore}%; kamu bisa coba lagi dengan soal baru.`);
      if (result.passed) setQuizMode(false);
      return result;
    } catch (err) {
      setNotice(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  // Satu klik menuntaskan seluruh alur: buat DOCX bila belum ada, lalu unduh.
  // Sebelumnya tombol memilih export berdasarkan content_signature dokumen
  // sekarang, sedangkan fungsi ini mengambil export ready mana saja, sehingga
  // saat keduanya tidak cocok fungsi berhenti diam-diam tanpa efek apa pun.
  const downloadBusyRef = useRef(false);
  const downloadExport = async () => {
    if (downloadBusyRef.current) return;
    downloadBusyRef.current = true;
    try {
      if (!active?.document_id) throw new Error('Dokumen belum tersedia.');
      const fileName = `${String(documentState?.title || 'laprak').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'laprak'}.docx`;
      await download(`/documents/${active.document_id}/download.docx`, fileName);
    } catch (err) {
      setNotice(err.message);
    } finally {
      downloadBusyRef.current = false;
    }
  };
  const logout = async () => { try { await api('/auth/logout', { method: 'POST' }); } catch {} clearCsrfToken(); await refreshSession(); navigate('/'); };
  const projectEntries = useMemo(() => {
    const grouped = groupsFromSessions(sessions.filter((item) => groupLabel(item) !== 'Belum dikelompokkan'));
    const pinnedKeys = new Set(projectPins.map((item) => normalizedCourseKey(item.projectKey || item.projectName)));
    return Object.entries(grouped)
      .map(([name, items]) => ({
        name,
        items: [...items].sort((a, b) => new Date(b.updated_at || b.updatedAt || 0) - new Date(a.updated_at || a.updatedAt || 0)),
        count: items.length,
        isPinned: pinnedKeys.has(normalizedCourseKey(name)),
        updatedAt: items.reduce((latest, item) => {
          const value = item.updated_at || item.updatedAt || item.created_at || item.createdAt || null;
          return !latest || (value && new Date(value) > new Date(latest)) ? value : latest;
        }, null),
      }))
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }, [sessions, projectPins]);
  const openProject = (name) => { closeMobileSidebar(); navigate(`/app/projects?project=${encodeURIComponent(name)}`); };
  const createProject = async () => {
    const name = await showDialog({ kind: 'prompt', title: 'Project baru', message: 'Beri nama untuk mengelompokkan chat dan dokumen terkait.', placeholder: 'Contoh: Praktikum Jaringan', confirmLabel: 'Buat project' });
    const clean = String(name || '').trim().slice(0, 100);
    if (!clean) { if (name !== null) setNotice('Project belum diberi nama.'); return; }
    const session = await createSession(false, {
      title: 'Chat baru',
      courseGroup: clean,
      configuration: { courseName: clean },
    });
    if (session) { setNotice('Project dibuat.'); openProject(clean); }
  };
  const createProjectChat = async (projectName, title = '') => {
    const cleanTitle = String(title || '').trim().slice(0, 120) || 'Chat baru';
    const session = await createSession(false, {
      title: cleanTitle,
      courseGroup: projectName,
      configuration: { courseName: projectName },
    });
    return session;
  };
  const workspacePlanLabel = billingPlan?.key === 'pro' ? 'Max' : billingPlan?.key === 'monthly' ? 'Pro' : 'Free plan';
  const hasSubscriptionPlan = ['monthly', 'pro'].includes(billingPlan?.key);
  const isMaxPlan = billingPlan?.key === 'pro';
  const headerSubtitle = active
    ? [workflow?.courseName || active.configuration?.courseName, workflow?.practiceTopic || active.configuration?.moduleTitle].filter(Boolean).join(' · ') || 'Konteks laprak belum diisi'
    : 'Mulai dengan teks, bahan, atau link yang kamu punya.';
  const workspaceAccent = resolveAccent(prefs.accent, resolvedTheme);
  const recordProductUpdate = async (action) => {
    if (!productUpdate) return;
    try { await api(`/product-updates/${productUpdate.id}/receipt`, { method: 'POST', body: { action } }); }
    catch { /* receipt failure does not interrupt user navigation */ }
  };
  const closeProductUpdate = async (action) => {
    if (action) await recordProductUpdate(action);
    setProductUpdate(null);
  };
  const reorderSidebarSession = async (source, target) => {
    const sourceIndex = sessions.findIndex((row) => row.id === source.id);
    const targetIndex = sessions.findIndex((row) => row.id === target.id);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const reordered = [...sessions];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    await persistOrder(reordered);
  };
  const sidebarGroupProps = {
    activeId: active?.id,
    page,
    onOpen: openSession,
    renamingId,
    setRenamingId,
    onRename: renameSession,
    draggingSession,
    setDraggingSession,
    folders: sessionFolders,
    onPin: setPinned,
    onMove: moveSessionToGroup,
    onArchive: archiveSession,
    onDelete: deleteSession,
    onDropSession: reorderSidebarSession,
  };
  const pinnedProjects = projectEntries.filter((project) => project.isPinned);
  const pinnedProjectKeys = new Set(pinnedProjects.map((project) => normalizedCourseKey(project.name)));
  const pinnedSessions = visibleRecentSessions.filter((item) => item.isPinned && !pinnedProjectKeys.has(normalizedCourseKey(groupLabel(item))));
  const recentGroups = Object.entries(groupsFromSessions(visibleRecentSessions.filter((item) => !item.isPinned && !pinnedProjectKeys.has(normalizedCourseKey(groupLabel(item))))));
  return {
    user, wallet, refreshSession, setNotice, prefs, setPrefs, navigate, resolvedTheme,
    sessions, active, messages, attachments, documentState, workflow, activeJob, input, setInput,
    pendingLandingFiles, setPendingLandingFiles, busy, actionBusy, accountOpen, setAccountOpen,
    draggingSession, setDraggingSession, renamingId, setRenamingId, editingMessageId, setEditingMessageId,
    leftCollapsed, setLeftCollapsed, rightOpen, setRightOpen, documentOpen, setDocumentOpen,
    quizMode, setQuizMode, modal, setModal, config, contextOpen, setContextOpen,
    attachmentKind, setAttachmentKind, documents, projectPins, billingPlan, aiMode, setAiMode,
    aiModeAccess, recentSearchOpen, setRecentSearchOpen, recentSearchQuery, setRecentSearchQuery,
    recentSearchInputRef, identityIntake, tutorialOpen, setTutorialFirstUse, setTutorialOpen,
    productUpdate, page, editingMessage, projectParam, updateConfig, closeMobileSidebar, setRoute,
    loadSessions, loadDocuments, openSession, groupLabel, moveSessionToGroup, projectEntries,
    openProject, createProject, createProjectChat, setProjectPinned, workspacePlanLabel,
    hasSubscriptionPlan, isMaxPlan, headerSubtitle, workspaceAccent, recordProductUpdate,
    closeProductUpdate, sidebarGroupProps, pinnedProjects, pinnedSessions, recentGroups,
    startNewChat, send, upload, uploadRef, removeAttachment, updateAttachmentCategory, createDocument,
    performChatAction, pasteImagesIntoChat, addPendingFiles, startDocumentQuiz, submitDocumentQuiz,
    reviseChatMessage, documentAction, downloadExport, restoreDocumentVersion, pendingConfigRequest, saveConfig,
    completeIdentityIntake, closeTutorial, logout,
  };
}
