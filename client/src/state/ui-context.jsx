import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const UiContext = createContext(null);
export const AppContext = createContext(null);

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('App context belum tersedia.');
  return value;
}

export function UiProvider({ children, value = {}, actions = {} }) {
  const [localNotice, setLocalNotice] = useState(value.notice ?? null);
  const [localRoute, setLocalRoute] = useState(value.route || 'chat');
  const [localTheme, setLocalTheme] = useState(value.theme || 'system');
  const notice = value.notice ?? localNotice;
  const route = value.route ?? localRoute;
  const theme = value.theme ?? localTheme;
  const openModal = useCallback((...args) => actions.openModal?.(...args), [actions.openModal]);
  const closeModal = useCallback((...args) => actions.closeModal?.(...args), [actions.closeModal]);
  const contextValue = useMemo(() => ({
    notice,
    route,
    theme,
    openModal,
    closeModal,
    updateNotice: setLocalNotice,
    updateRoute: setLocalRoute,
    updateTheme: setLocalTheme,
  }), [closeModal, notice, openModal, route, theme]);
  return <UiContext.Provider value={contextValue}>{children}</UiContext.Provider>;
}

export function useUi() {
  const value = useContext(UiContext);
  if (!value) throw new Error('UiProvider belum tersedia.');
  return value;
}
