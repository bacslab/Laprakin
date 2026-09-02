import { useChat } from '../../../state/chat-context';

export function WorkflowPanel({ children, render }) {
  const chat = useChat();
  if (render) return render(chat);
  return children || null;
}

export default WorkflowPanel;
