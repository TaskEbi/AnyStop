import { useEffect } from 'react';
import { data } from '../data/store';
import { openAddSheet, ui } from '../data/ui';

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** N add · / search · 1 shelves. Esc is handled by each dialog. */
export function useShortcuts() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector('dialog[open]') || !data.get().ready) return;
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
        case '1':
          ui.set({ view: 'shelves' });
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
