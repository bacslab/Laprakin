import { ChatProvider } from '../../state/chat-context';
import { DocumentProvider } from '../../state/document-context';
import { UiProvider } from '../../state/ui-context';

export function Workspace({ children, chat = {}, document = {}, ui = {} }) {
  return <UiProvider value={ui.value} actions={ui.actions}>
    <ChatProvider value={chat.value} actions={chat.actions}>
      <DocumentProvider value={document.value} actions={document.actions}>
        {children}
      </DocumentProvider>
    </ChatProvider>
  </UiProvider>;
}

export default Workspace;
