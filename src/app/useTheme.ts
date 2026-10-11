import { useEffect } from 'react';
import { data } from '../data/store';
import { useStore } from '../lib/createStore';

/** Light / dark / follow-system, applied as data-theme on <html>. */
export function useTheme() {
  const theme = useStore(data, (s) => s.settings.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      localStorage.setItem('curio-theme', theme);
    } catch {
      /* private mode: fine */
    }
  }, [theme]);
}
