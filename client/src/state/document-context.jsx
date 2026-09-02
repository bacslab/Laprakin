import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const DocumentContext = createContext(null);

export function DocumentProvider({ children, value = {}, actions = {} }) {
  const [localDocumentState, setLocalDocumentState] = useState(value.documentState ?? null);
  const [localAttachments, setLocalAttachments] = useState(value.attachments || []);
  const [localActiveJob, setLocalActiveJob] = useState(value.activeJob ?? null);
  const documentState = value.documentState ?? localDocumentState;
  const attachments = value.attachments ?? localAttachments;
  const activeJob = value.activeJob ?? localActiveJob;
  const upload = useCallback((...args) => actions.upload?.(...args), [actions.upload]);
  const removeAttachment = useCallback((...args) => actions.removeAttachment?.(...args), [actions.removeAttachment]);
  const contextValue = useMemo(() => ({
    documentState,
    attachments,
    activeJob,
    upload,
    removeAttachment,
    updateDocumentState: setLocalDocumentState,
    updateAttachments: setLocalAttachments,
    updateActiveJob: setLocalActiveJob,
  }), [activeJob, attachments, documentState, removeAttachment, upload]);
  return <DocumentContext.Provider value={contextValue}>{children}</DocumentContext.Provider>;
}

export function useDocument() {
  const value = useContext(DocumentContext);
  if (!value) throw new Error('DocumentProvider belum tersedia.');
  return value;
}
