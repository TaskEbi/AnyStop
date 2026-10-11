import { useMemo, useState } from 'react';
import { cut, tie, updateConnection } from '../../data/actions';
import { data, liveConnections, liveItems } from '../../data/store';
import { flyTo, toast } from '../../data/ui';
import type { Connection, Item } from '../../data/types';
import { useStore } from '../../lib/createStore';
import { Icon } from '../../ui/Icon';
import { KIND_LABEL } from '../../ui/labels';

const SUGGESTED_LABELS = ['same idea', 'made by', 'inspired', 'see also', 'contradicts', 'builds on'];

function StringRow({ conn, other }: { conn: Connection; other: Item }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(conn.label ?? '');
  const save = () => {
    setEditing(false);
    if ((conn.label ?? '') !== label.trim()) updateConnection(conn.id, { label: label.trim() || null });
  };
  return (
    <li className="string-row">
      {editing ? (
        <input
          className="input string-row__input"
          value={label}
          autoFocus
          maxLength={60}
          placeholder="label"
          aria-label="String label"
          list="string-labels"
          onChange={(e) => setLabel(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setLabel(conn.label ?? '');
              setEditing(false);
            }
          }}
        />
      ) : (
        <button type="button" className="string-row__label type" onClick={() => setEditing(true)} title="Edit label">
          {conn.label || 'add label'}
        </button>
      )}
      <button type="button" className="string-row__title" onClick={() => flyTo(other.id)}>
        <Icon name={other.kind} size={14} />
        <span>{other.title}</span>
      </button>
      <button type="button" className="btn btn--ghost btn--icon string-row__cut" aria-label={`Cut the string to ${other.title}`} title="Cut string" onClick={() => cut(conn.id)}>
        <Icon name="close" size={14} />
      </button>
    </li>
  );
}

function ConnectTo({ item, exclude, onDone }: { item: Item; exclude: Set<string>; onDone: () => void }) {
  const [q, setQ] = useState('');
  const [label, setLabel] = useState('');
  const items = useStore(data, (s) => liveItems(s.items));
  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return items
      .filter((i) => i.id !== item.id && !exclude.has(i.id))
      .filter((i) => {
        const h = `${i.title} ${i.creator ?? ''} ${i.tags.join(' ')}`.toLowerCase();
        return terms.every((t) => h.includes(t));
      })
      .slice(0, 6);
  }, [q, items, item.id, exclude]);

  return (
    <div className="connect-to">
      <div className="connect-to__inputs">
        <input
          className="input"
          value={q}
          autoFocus
          placeholder="Search the cabinet…"
          aria-label="Find something to tie this to"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onDone();
            }
          }}
        />
        <input className="input connect-to__label" value={label} placeholder="label (optional)" list="string-labels" aria-label="String label" maxLength={60} onChange={(e) => setLabel(e.target.value)} />
      </div>
      {results.length > 0 && (
        <ul className="connect-to__results">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="connect-to__result"
                onClick={() => {
                  tie(item.id, r.id, label.trim() || null);
                  toast(`Tied to ${r.title}`);
                  onDone();
                }}
              >
                <Icon name={r.kind} size={14} />
                <span className="connect-to__result-title">{r.title}</span>
                <span className="type connect-to__result-kind">{KIND_LABEL[r.kind]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q && !results.length && <p className="connect-to__none">Nothing matches.</p>}
    </div>
  );
}

/** Every string tied to this item, plus "Connect to…". */
export function Strings({ item }: { item: Item }) {
  const connections = useStore(data, (s) => liveConnections(s.connections));
  const items = useStore(data, (s) => s.items);
  const [connecting, setConnecting] = useState(false);
  const mine = connections.filter((c) => c.item_a === item.id || c.item_b === item.id);
  const others = new Set(mine.map((c) => (c.item_a === item.id ? c.item_b : c.item_a)));

  return (
    <section className="drawer__section">
      <div className="drawer__section-head">
        <h3 className="drawer__heading hand">Strings</h3>
        {!connecting && (
          <button type="button" className="btn btn--small" onClick={() => setConnecting(true)}>
            <Icon name="plus" size={14} /> Connect to…
          </button>
        )}
      </div>
      <datalist id="string-labels">
        {SUGGESTED_LABELS.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
      {connecting && <ConnectTo item={item} exclude={others} onDone={() => setConnecting(false)} />}
      {mine.length > 0 ? (
        <ul className="drawer__strings">
          {mine.map((c) => {
            const other = items.get(c.item_a === item.id ? c.item_b : c.item_a);
            return other && !other.deleted_at ? <StringRow key={c.id} conn={c} other={other} /> : null;
          })}
        </ul>
      ) : (
        !connecting && <p className="drawer__empty">No strings yet. Tie this to something it reminds you of.</p>
      )}
    </section>
  );
}
