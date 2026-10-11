import { useEffect, useState } from 'react';
import { data } from '../data/store';
import { openAddSheet, ui } from '../data/ui';
import { draftFromText } from '../features/capture/draft';
import type { ItemDraft } from '../data/actions';

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

/** The room I'm currently looking at, so captured things land there. */
function currentRoom(): string | null {
  const room = ui.get().filters.room;
  const r = room && room !== 'unsorted' ? data.get().rooms.get(room) : undefined;
  return r && !r.deleted_at ? r.id : null;
}

function openFor(text: string | null, file: File | null) {
  const room_id = currentRoom();
  if (file) {
    const draft: ItemDraft = { kind: 'photo', room_id };
    openAddSheet(draft, file);
  } else if (text?.trim()) {
    openAddSheet({ ...draftFromText(text.trim()), room_id });
  }
}

const imageFrom = (files: FileList | null | undefined) => [...(files ?? [])].find((f) => f.type.startsWith('image/')) ?? null;

/** First real URL in a text/uri-list (lines starting with # are comments). */
const uriList = (s: string) => s.split(/\r?\n/).find((l) => l && !l.startsWith('#')) ?? '';

/**
 * Paste anywhere (when not typing) and drag-and-drop onto the window both open
 * the add sheet pre-filled with the URL, text or image. Returns whether a drag is over the page.
 */
export function useCapture(): boolean {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let depth = 0;
    const accepts = (e: DragEvent) => {
      const types = e.dataTransfer?.types ?? [];
      return types.includes('Files') || types.includes('text/uri-list') || types.includes('text/plain');
    };
    const blocked = () => !!document.querySelector('dialog:modal') || !data.get().ready;

    function onPaste(e: ClipboardEvent) {
      if (isTyping(e.target) || blocked()) return;
      const file = imageFrom(e.clipboardData?.files);
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (!file && !text.trim()) return;
      e.preventDefault();
      openFor(text, file);
    }
    function onDragEnter(e: DragEvent) {
      if (!accepts(e) || blocked()) return;
      depth++;
      setDragging(true);
    }
    function onDragOver(e: DragEvent) {
      if (!accepts(e) || blocked()) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    }
    function onDragLeave() {
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    }
    function onDrop(e: DragEvent) {
      depth = 0;
      setDragging(false);
      if (!accepts(e) || blocked()) return;
      e.preventDefault();
      const dt = e.dataTransfer!;
      openFor(uriList(dt.getData('text/uri-list')) || dt.getData('text/plain'), imageFrom(dt.files));
    }

    window.addEventListener('paste', onPaste);
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  return dragging;
}
