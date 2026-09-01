import { useChat } from '../../state/chat-context';

export function ChatSurface({ children, render }) {
  const chat = useChat();
  if (render) return render(chat);
  return children || null;
}

export default ChatSurface;
