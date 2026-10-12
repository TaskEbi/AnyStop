import type { CSSProperties } from 'react';
import { data, liveConnections } from '../../data/store';
import { setFilters, setView, ui } from '../../data/ui';
import { useStore } from '../../lib/createStore';
import { accession, plural } from '../../lib/format';
import { Icon } from '../../ui/Icon';
import { KIND_LABEL, tapeVar } from '../../ui/labels';
import type { Space, SpaceNode } from './space';

interface Props {
  node: SpaceNode;
  space: Space;
  touring: boolean;
  onGo: (id: string) => void;
  onOpen: (id: string) => void;
  onClose: () => void;
}

/** The selected star's museum label, with its strings to follow. */
export function Placard({ node, space, touring, onGo, onOpen, onClose }: Props) {
  const item = useStore(data, (s) => (node.room ? undefined : s.items.get(node.id)));
  const connections = useStore(data, (s) => liveConnections(s.connections));
  const roomNode = space.byId.get(node.group);

  const threads = node.room
    ? []
    : connections
        .filter((c) => c.item_a === node.id || c.item_b === node.id)
        .map((c) => ({ id: c.item_a === node.id ? c.item_b : c.item_a, label: c.label }))
        .filter((t) => space.byId.has(t.id));

  return (
    <aside className={`mind-placard ${touring ? 'is-touring' : ''}`} aria-label={`Selected: ${node.label}`} style={{ '--tape': tapeVar(node.color === 'none' ? null : node.color) } as CSSProperties}>
      <button type="button" className="mind-placard__close btn btn--ghost btn--icon" onClick={onClose} aria-label="Clear selection">
        <Icon name="close" size={16} />
      </button>
      <p className="mind-placard__kind type">
        {node.room
          ? `Room · ${plural(node.count ?? 0, 'exhibit')}`
          : `${item ? KIND_LABEL[item.kind] : 'Exhibit'} · ${accession(item?.accession_no ?? null)} · ${roomNode?.label ?? 'Unsorted'}`}
        {touring && ' · on tour'}
      </p>
      <h3 className="mind-placard__title">{node.label}</h3>
      {item?.creator && <p className="mind-placard__creator">{item.creator}</p>}

      {!node.room && (
        <div className="mind-placard__threads">
          {threads.length ? (
            <>
              <p className="mind-placard__label type">Follow a string</p>
              <ul>
                {threads.slice(0, 6).map((t) => (
                  <li key={t.id}>
                    <button type="button" className="mind-placard__thread" onClick={() => onGo(t.id)}>
                      <span className="mind-placard__knot" aria-hidden="true" />
                      <span className="mind-placard__to">{space.byId.get(t.id)!.label}</span>
                      {t.label && <em className="type">{t.label}</em>}
                    </button>
                  </li>
                ))}
              </ul>
              {threads.length > 6 && <p className="mind-placard__more type">and {threads.length - 6} more</p>}
            </>
          ) : (
            <p className="mind-placard__none">No strings yet.</p>
          )}
        </div>
      )}

      <div className="mind-placard__actions">
        {node.room ? (
          <button
            type="button"
            className="btn btn--small"
            onClick={() => {
              setFilters({ room: node.id.slice('room:'.length) || 'unsorted' });
              setView('shelves');
            }}
          >
            Show on shelves
          </button>
        ) : (
          <>
            <button type="button" className="btn btn--small btn--primary" onClick={() => onOpen(node.id)}>
              Open exhibit
            </button>
            <button type="button" className="btn btn--small" onClick={() => ui.set({ tying: { from: node.id }, openItemId: null })}>
              Tie from here
            </button>
            {roomNode && (
              <button type="button" className="btn btn--small btn--ghost" onClick={() => onGo(roomNode.id)}>
                Back to {roomNode.label}
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
