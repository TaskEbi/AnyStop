import { useEffect, useRef, useState } from 'react';
import { deleteItem, markOpened, restoreItem, updateItem } from '../../data/actions';
import { allTags, data } from '../../data/store';
import { flyTo, toast, ui } from '../../data/ui';
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
import { EmbedPlayer } from './EmbedPlayer';
import { Strings } from './Strings';
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

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

/** Step through the exhibits on show, in their current order: arrows in the drawer, or ← → / J K. */
function Stepper({ id, sequence }: { id: string; sequence: string[] }) {
  const i = sequence.indexOf(id);
  const prev = i > 0 ? sequence[i - 1] : null;
  const next = i >= 0 && i < sequence.length - 1 ? sequence[i + 1] : null;
  const go = (to: string | null) => {
    if (!to) return;
    if (ui.get().view === 'shelves') ui.set({ openItemId: to });
    else flyTo(to);
  };
  const latest = useRef({ prev, next, go });
  latest.current = { prev, next, go };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      // The 3D map uses the arrow keys to turn the sky.
      if ((e.target as HTMLElement | null)?.closest?.('.canvas-view')) return;
      const modal = document.querySelector('dialog:modal');
      if (modal && !modal.classList.contains('drawer')) return;
      const { prev: p, next: n, go: g } = latest.current;
      if (e.key === 'ArrowLeft' || e.key === 'k' || e.key === 'K') g(p);
      else if (e.key === 'ArrowRight' || e.key === 'j' || e.key === 'J') g(n);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (i < 0 || sequence.length < 2) return null;
  return (
    <span className="drawer__stepper">
      <button type="button" className="btn btn--ghost btn--icon" disabled={!prev} onClick={() => go(prev)} aria-label="Previous exhibit" title="Previous (←)">
        ‹
      </button>
      <span className="drawer__count type">
        {i + 1}/{sequence.length}
      </span>
      <button type="button" className="btn btn--ghost btn--icon" disabled={!next} onClick={() => go(next)} aria-label="Next exhibit" title="Next (→)">
        ›
      </button>
    </span>
  );
}

export function DetailDrawer({ id, sequence = [] }: { id: string; sequence?: string[] }) {
  const item = useStore(data, (s) => s.items.get(id));
  const room = useStore(data, (s) => (item?.room_id ? s.rooms.get(item.room_id) : undefined));
  const tags = useStore(data, (s) => allTags(s.items));
  const close = () => ui.set({ openItemId: null });
  const floating = useStore(ui, (s) => s.view !== 'shelves');

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
    const { kind, title, url, creator, body, note, room_id, tags, status, favourite, image_path } = item;
    ui.set({ sheet: { draft: { kind, title, url, creator, body, note, room_id, tags, status, favourite, image_path }, editId: item.id } });
  }

  return (
    <Sheet
      title={item.title || 'Exhibit'}
      variant="side"
      onClose={close}
      hideTitle
      className="drawer"
      modal={!floating}
      key={floating ? 'float' : 'modal'}
      headerTools={<Stepper id={id} sequence={sequence} />}
    >
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

      <EmbedPlayer key={item.id} item={item} />

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

      <Strings item={item} />

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
            const at = deleteItem(item.id);
            close();
            toast(`Deaccessioned: ${item.title}`, at ? { label: 'Undo', run: () => restoreItem(item.id, at) } : undefined);
          }}
        />
      </footer>
    </Sheet>
  );
}
