import { useEffect, useMemo } from 'react';
import { useResolvedTheme } from '../lib/theme';
import { useApp } from '../state/ui-context';
import { createTranslator } from './index';
import { I18nContext } from './context';

export default function I18nRuntime({ children }) {
  const { prefs } = useApp();
  const language = prefs?.language || 'id';
  const resolvedTheme = useResolvedTheme(prefs?.theme || 'system');
  const translateKey = useMemo(() => createTranslator(language), [language]);
  useEffect(() => {
    document.documentElement.lang = language === 'en' ? 'en' : 'id';
    document.body.dataset.laprakinTheme = resolvedTheme;
  }, [language, resolvedTheme]);
  return <I18nContext.Provider value={{ language, t: (value, values) => translateKey(value, values) }}>{children}</I18nContext.Provider>;
}
