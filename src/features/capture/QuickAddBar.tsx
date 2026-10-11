import { useState, type FormEvent } from 'react';
import { createItem } from '../../data/actions';
import { data } from '../../data/store';
import { enrich } from '../../data/enrich';
import { openAddSheet, toast, ui } from '../../data/ui';
import { Icon } from '../../ui/Icon';
import { KIND_LABEL } from '../../ui/labels';
import { draftFromText, withTitle } from './draft';
import './capture.css';

/** The room currently filtered to, so things added while browsing a room land in it. */
function currentRoom(): string | null {
  const room = ui.get().filters.room;
  return room && room !== 'unsorted' && data.get().rooms.get(room) && !data.get().rooms.get(room)?.deleted_at ? room : null;
}

/** Paste anything, press Enter: it's saved straight away with a guessed kind and title. */
export function QuickAddBar() {
  const [text, setText] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) {
      openAddSheet({ kind: 'link', room_id: currentRoom() });
      return;
    }
    const item = createItem(withTitle({ ...draftFromText(value), room_id: currentRoom() }));
    setText('');
    if (item.url) void enrich(item.id);
    toast(`Acquired: ${item.title} (${KIND_LABEL[item.kind].toLowerCase()})`, {
      label: 'Open',
      run: () => ui.set({ openItemId: item.id }),
    });
  }

  function more() {
    const value = text.trim();
    openAddSheet(value ? { ...draftFromText(value), room_id: currentRoom() } : { kind: 'link', room_id: currentRoom() });
    setText('');
  }

  return (
    <form className="quick-add" onSubmit={submit} role="search" aria-label="Quick add">
      <span className="quick-add__label hand" aria-hidden="true">
        Acquire
      </span>
      <input
        className="quick-add__input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste a link, a “quote” or a thought…"
        aria-label="Paste a link, a quote or a thought, then press Enter to save"
        enterKeyHint="done"
        autoComplete="off"
        spellCheck={false}
      />
      <button type="button" className="btn btn--ghost btn--icon" onClick={more} title="Add with details (N)" aria-label="Add with details">
        <Icon name="plus" />
      </button>
    </form>
  );
}
