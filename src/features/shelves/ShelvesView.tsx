import { useCallback } from 'react';
import type { Item, Room } from '../../data/types';
import { activeFilterCount, EMPTY_FILTERS } from '../../data/filter';
import { openAddSheet, ui } from '../../data/ui';
import { useStore } from '../../lib/createStore';
import { Card } from './Card';
import { Masonry } from './Masonry';
import './shelves.css';

interface Props {
  items: Item[];
  rooms: Map<string, Room>;
  total: number;
}

export function ShelvesView({ items, rooms, total }: Props) {
  const filters = useStore(ui, (s) => s.filters);
  const open = useCallback((id: string) => ui.set({ openItemId: id }), []);

  if (!items.length) {
    const filtered = activeFilterCount(filters) > 0;
    return (
      <div className="shelves-empty">
        <p className="shelves-empty__placard hand">{filtered ? 'Nothing on these shelves' : 'The cabinet is empty'}</p>
        <p>{filtered ? 'No exhibits match these filters.' : 'Paste a link, a quote or a thought into the bar above to acquire your first curiosity.'}</p>
        {filtered ? (
          <button className="btn" onClick={() => ui.set({ filters: { ...EMPTY_FILTERS, sort: filters.sort } })}>
            Clear filters
          </button>
        ) : (
          <button className="btn btn--primary" onClick={() => openAddSheet()}>
            Add something
          </button>
        )}
      </div>
    );
  }

  return (
    <section className="shelves" aria-label={`Shelves, ${items.length} of ${total} exhibits`}>
      <Masonry
        items={items}
        render={(item, i) => (
          <Card key={item.id} item={item} room={item.room_id ? rooms.get(item.room_id) : undefined} index={i} onOpen={open} />
        )}
      />
    </section>
  );
}
