import { useMemo } from 'react';
import type { Item } from '../../data/types';
import { ui } from '../../data/ui';
import { onThisDay } from '../../data/wander';

/** "On this day": what I acquired on this date in earlier years. */
export function OnThisDay({ items }: { items: Item[] }) {
  const found = useMemo(() => onThisDay(items).slice(0, 3), [items]);
  if (!found.length) return null;
  const year = new Date().getFullYear();
  return (
    <aside className="on-this-day" aria-label="On this day">
      <span className="on-this-day__label hand">On this day</span>
      <ul>
        {found.map((i) => {
          const ago = year - new Date(i.created_at).getFullYear();
          return (
            <li key={i.id}>
              <button type="button" onClick={() => ui.set({ openItemId: i.id })}>
                <span className="type on-this-day__when">{ago === 1 ? 'a year ago' : `${ago} years ago`}</span> {i.title}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
