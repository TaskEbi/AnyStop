import { useEffect } from 'react';
import { data } from '../data/store';
import type { Design, Palette, Theme } from '../data/types';
import { useStore } from '../lib/createStore';

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

/**
 * Put the lighting, colour scheme and design on <html>: data-theme is the choice
 * (absent = follow system), data-mode the resolved light/dark, data-palette
 * the scheme, data-design the layout style. Also used before first paint, so it
 * must not touch React.
 */
export function applyAppearance(theme: Theme, palette: Palette, design: Design) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  root.dataset.mode = theme === 'system' ? (darkQuery().matches ? 'dark' : 'light') : theme;
  root.dataset.palette = palette;
  root.dataset.design = design;
}

/** Light / dark / follow-system, the colour scheme and the design, kept in sync with settings. */
export function useTheme() {
  const theme = useStore(data, (s) => s.settings.theme);
  const palette = useStore(data, (s) => s.settings.palette);
  const design = useStore(data, (s) => s.settings.design);
  useEffect(() => {
    const apply = () => {
      applyAppearance(theme, palette, design);
      // The phone's browser chrome takes the desk colour.
      const desk = getComputedStyle(document.documentElement).getPropertyValue('--desk').trim();
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', desk));
    };
    apply();
    try {
      localStorage.setItem('curio-theme', theme);
      localStorage.setItem('curio-palette', palette);
      localStorage.setItem('curio-design', design);
    } catch {
      /* private mode: fine */
    }
    if (theme !== 'system') return;
    const mq = darkQuery();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme, palette, design]);
}
