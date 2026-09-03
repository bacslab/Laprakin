import { useEffect, useState } from 'react';
import { resolveReducedMotion } from './motion-policy';

export function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(theme = 'system') {
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  return getSystemTheme();
}

export function useResolvedTheme(theme = 'system') {
  const [resolved, setResolved] = useState(() => resolveTheme(theme));
  useEffect(() => {
    const update = () => setResolved(resolveTheme(theme));
    update();
    if (theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, [theme]);
  return resolved;
}

function getSystemReducedMotion() {
  return typeof window !== 'undefined'
    && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

export function useResolvedReducedMotion(userPreference = false) {
  const [systemPreference, setSystemPreference] = useState(getSystemReducedMotion);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemPreference(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return resolveReducedMotion(userPreference, systemPreference);
}
