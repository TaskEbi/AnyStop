import { useEffect, useRef, useState } from 'react';
import { deleteItem, markOpened, updateItem } from '../../data/actions';
import { allTags, data, liveConnections } from '../../data/store';
import { toast, ui } from '../../data/ui';
import { STATUSES, type Item } from '../../data/types';
import { useStore } from '../../lib/createStore';
import { hostOf } from '../../lib/detectKind';
import { accession, museumDate } from '../../lib/format';
import { Icon } from '../../ui/Icon';
import { InlineConfirm } from '../../ui/InlineConfirm';
import { KIND_LABEL, STATUS_LABEL } from '../../ui/labels';
import { Sheet } from '../../ui/Sheet';
import { RoomPicker } from '../capture/RoomPicker';
import { TagInput } from '../capture/TagInput';
import { Card } from '../shelves/Card';
import './drawer.css';

/** The "why I kept this" note, saved a moment after I stop typing. */
function NoteEditor({ item }: { item: Item }) {
  const [text, setText] = useState(item.note ?? '');
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(text);
  latest.current = text;

  // Flush on close.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if ((data.get().items.get(item.id)?.note ?? '') !== latest.current) updateItem(item.id, { note: latest.current || null });
    },
    [item.id],
  );

  return (
    <label className="field drawer__note">
      <span>
        Why I kept this <em className="drawer__saved">{saved ? 'saved' : 'saving…'}</em>
      </span>
      <textarea
        className="textarea drawer__note-text"
        value={text}
        rows={3}
        placeholder="A line for future me…"
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
          clearTimeout(timer.current);
          const value = e.target.value;
          timer.current = setTimeout(() => {
            updateItem(item.id, { note: value || null });
            setSaved(true);
          }, 600);
        }}
      />
    </label>
  );
}

function Connections({ item }: { item: Item }) {
  const connections = useStore(data, (s) => liveConnections(s.connections));
  const items = useStore(data, (s) => s.items);
  const mine = connections.filter((c) => c.item_a === item.id || c.item_b === item.id);
  if (!mine.length) return null;
  return (
    <section className="drawer__section">
      <h3 className="drawer__heading hand">Strings</h3>
      <ul className="drawer__strings">
        {mine.map((c) => {
          const other = items.get(c.item_a === item.id ? c.item_b : c.item_a);
          if (!other || other.deleted_at) return null;
          return (
            <li key={c.id}>
              <button type="button" className="drawer__string" onClick={() => ui.set({ openItemId: other.id })}>
                <span className="drawer__string-label type">{c.label || 'tied to'}</span>
                <span className="drawer__string-title">{other.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function DetailDrawer({ id }: { id: string }) {
  const item = useStore(data, (s) => s.items.get(id));
  const room = useStore(data, (s) => (item?.room_id ? s.rooms.get(item.room_id) : undefined));
  const tags = useStore(data, (s) => allTags(s.items));
  const close = () => ui.set({ openItemId: null });

  useEffect(() => {
    markOpened(id);
  }, [id]);

  useEffect(() => {
    if (!item || item.deleted_at) ui.set({ openItemId: null });
  }, [item]);

  if (!item || item.deleted_at) return null;
  const liveRoom = room && !room.deleted_at ? room : undefined;
  const domain = hostOf(item.url);

  function edit() {
    if (!item) return;
    const { kind, title, url, creator, body, note, room_id, tags, status, favourite } = item;
    ui.set({ sheet: { draft: { kind, title, url, creator, body, note, room_id, tags, status, favourite }, editId: item.id } });
  }

  return (
    <Sheet title={item.title || 'Exhibit'} variant="side" onClose={close} hideTitle className="drawer">
      <div className="drawer__visual">
        <Card item={item} room={liveRoom} tilt={0} />
      </div>

      <div className="drawer__placard">
        <p className="drawer__kind type">
          {KIND_LABEL[item.kind]} · {accession(item.accession_no)}
          {item.is_example && ' · example'}
        </p>
        {!(item.kind === 'quote' && item.body?.startsWith(item.title.replace(/…$/, ''))) && <h2 className="drawer__title">{item.title}</h2>}
        {item.creator && <p className="drawer__creator">{item.creator}</p>}
        {item.kind === 'quote' && item.body && <blockquote className="drawer__quote">{item.body}</blockquote>}
        {item.kind === 'note' && item.body && <p className="drawer__body">{item.body}</p>}
        {item.preview?.description && item.kind !== 'quote' && item.kind !== 'note' && <p className="drawer__desc">{item.preview.description}</p>}
        {item.url && (
          <a className="btn drawer__open" href={item.url} target="_blank" rel="noopener noreferrer">
            <Icon name="external" size={16} /> Open {domain || 'original'}
          </a>
        )}
        <dl className="drawer__facts type">
          <div>
            <dt>Acquired</dt>
            <dd>{museumDate(item.created_at)}</dd>
          </div>
          {domain && (
            <div>
              <dt>Source</dt>
              <dd>{domain}</dd>
            </div>
          )}
          {item.last_opened_at && (
            <div>
              <dt>Last visited</dt>
              <dd>{museumDate(item.last_opened_at)}</dd>
            </div>
          )}
        </dl>
      </div>

      <section className="drawer__section drawer__controls">
        <div className="field">
          <span id="drawer-status">Status</span>
          <div className="chips" role="radiogroup" aria-labelledby="drawer-status">
            {STATUSES.map((s) => (
              <button key={s} type="button" role="radio" className="chip" aria-checked={item.status === s} onClick={() => updateItem(item.id, { status: s })}>
                {s === 'none' ? 'None' : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="chip drawer__fav"
          aria-pressed={item.favourite}
          onClick={() => updateItem(item.id, { favourite: !item.favourite })}
        >
          <span aria-hidden="true">★</span> {item.favourite ? 'Favourite' : 'Mark favourite'}
        </button>
        <div className="field">
          <span>Room</span>
          <RoomPicker value={item.room_id} onChange={(room_id) => updateItem(item.id, { room_id })} />
        </div>
        <div className="field">
          <span>Tags</span>
          <TagInput value={item.tags} onChange={(t) => updateItem(item.id, { tags: t })} suggestions={tags} />
        </div>
        <NoteEditor key={item.id} item={item} />
      </section>

      <Connections item={item} />

      <footer className="drawer__actions">
        <button type="button" className="btn" onClick={edit}>
          <Icon name="edit" size={16} /> Edit
        </button>
        <InlineConfirm
          label={
            <>
              <Icon name="trash" size={16} /> Delete
            </>
          }
          message="Remove this from the cabinet?"
          confirmLabel="Delete"
          onConfirm={() => {
            deleteItem(item.id);
            close();
            toast(`Deaccessioned: ${item.title}`);
          }}
        />
      </footer>
    </Sheet>
  );
}
