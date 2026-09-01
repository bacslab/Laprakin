import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ChatContext = createContext(null);

export function ChatProvider({ children, value = {}, actions = {} }) {
  const [localMessages] = useState(value.messages || []);
  const [localInput, setLocalInput] = useState(value.input || '');
  const [localBusy] = useState(Boolean(value.busy));
  const messages = value.messages ?? localMessages;
  const input = value.input ?? localInput;
  const busy = value.busy ?? localBusy;
  const send = useCallback((...args) => actions.send?.(...args), [actions.send]);
  const revise = useCallback((...args) => actions.revise?.(...args), [actions.revise]);
  const regenerate = useCallback((...args) => actions.regenerate?.(...args), [actions.regenerate]);
  const contextValue = useMemo(() => ({
    messages,
    input,
    busy,
    send,
    revise,
    regenerate,
    onInputChange: (next) => {
      setLocalInput(typeof next === 'function' ? next(input) : next);
    },
  }), [busy, input, messages, regenerate, revise, send]);
  return <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const value = useContext(ChatContext);
  if (!value) throw new Error('ChatProvider belum tersedia.');
  return value;
}
