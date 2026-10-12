import { useEffect } from 'react';
import { data } from '../data/store';
import { openAddSheet, setView, ui } from '../data/ui';
import { surprise } from './surprise';

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** Ctrl/⌘ K jump · N add · / search · R wander · 1/2/3/4 views. Esc is handled by each dialog. */
export function useShortcuts() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Jump-to works from anywhere, even while typing.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k' && data.get().ready) {
        e.preventDefault();
        ui.set((s) => ({ ...s, commandOpen: !s.commandOpen }));
        return;
      }
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector('dialog:modal') || !data.get().ready) return;
      switch (e.key) {
        case 'n':
        case 'N':
          e.preventDefault();
          openAddSheet();
          break;
        case '/':
          e.preventDefault();
          document.getElementById('search')?.focus();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          surprise();
          break;
        case '1':
          setView('shelves');
          break;
        case '2':
          setView('collage');
          break;
        case '3':
          setView('map');
          break;
        case '4':
          setView('mind');
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
