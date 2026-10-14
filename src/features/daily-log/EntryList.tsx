import type { CSSProperties } from 'react';
import { deleteEntry, restoreEntry } from '../../data/logActions';
import { toast, ui } from '../../data/ui';
import type { LogEntry } from '../../data/types';
import { Icon } from '../../ui/Icon';
import { formatMinutes } from './duration';
import { entryLabel, topicColour, useTopics } from './useLog';

function remove(entry: LogEntry, label: string) {
  const t = deleteEntry(entry.id);
  if (t) toast(`Removed ${label} · ${formatMinutes(entry.minutes)}`, { label: 'Undo', run: () => restoreEntry(entry.id, t) });
}

/** Entries, most recently added first, each with edit and delete. */
export function EntryList({ entries }: { entries: LogEntry[] }) {
  const topics = useTopics();
  const sorted = [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <ul className="entry-list">
      {sorted.map((e) => {
        const label = entryLabel(topics, e);
        const archived = !!(topics.get(e.topic_id)?.archived_at || (e.subcategory_id && topics.get(e.subcategory_id)?.archived_at));
        return (
          <li key={e.id} className="entry-row" style={{ '--c': topicColour(topics, e.topic_id) } as CSSProperties}>
            <span className="entry-row__swatch" aria-hidden="true" />
            <div className="entry-row__main">
              <span className="entry-row__label">
                {label}
                {archived && <span className="topic-chip__tag">archived</span>}
              </span>
              {e.note && <span className="entry-row__note">{e.note}</span>}
            </div>
            <span className="entry-row__time type">{formatMinutes(e.minutes)}</span>
            <div className="entry-row__tools">
              <button type="button" className="btn btn--ghost btn--icon" aria-label={`Edit ${label}, ${formatMinutes(e.minutes)}`} onClick={() => ui.set({ logSheet: { editId: e.id } })}>
                <Icon name="edit" size={16} />
              </button>
              <button type="button" className="btn btn--ghost btn--icon" aria-label={`Delete ${label}, ${formatMinutes(e.minutes)}`} onClick={() => remove(e, label)}>
                <Icon name="trash" size={16} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
