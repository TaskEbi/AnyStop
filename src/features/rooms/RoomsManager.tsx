import { useState, type CSSProperties } from 'react';
import { createRoom, deleteRoom, moveRoom, nextRoomColor, updateRoom } from '../../data/actions';
import { data, liveItems, liveRooms } from '../../data/store';
import { ui } from '../../data/ui';
import { ROOM_COLORS, type Room } from '../../data/types';
import { useStore } from '../../lib/createStore';
import { plural } from '../../lib/format';
import { Icon } from '../../ui/Icon';
import { InlineConfirm } from '../../ui/InlineConfirm';
import { COLOR_LABEL, tapeVar } from '../../ui/labels';
import { Sheet } from '../../ui/Sheet';
import './rooms.css';

function RoomRow({ room, index, total, count }: { room: Room; index: number; total: number; count: number }) {
  const [name, setName] = useState(room.name);
  const [desc, setDesc] = useState(room.description ?? '');

  return (
    <li className="room-row" style={{ '--swatch': tapeVar(room.color) } as CSSProperties}>
      <span className="room-row__tape" aria-hidden="true" />
      <div className="room-row__main">
        <input
          className="input room-row__name hand"
          value={name}
          maxLength={80}
          aria-label="Room name"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== room.name ? updateRoom(room.id, { name: name.trim() }) : setName(room.name)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <input
          className="input room-row__desc"
          value={desc}
          placeholder="A line about this wing (optional)"
          aria-label="Room description"
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => desc !== (room.description ?? '') && updateRoom(room.id, { description: desc.trim() || null })}
        />
        <div className="room-row__colors" role="radiogroup" aria-label="Colour">
          {ROOM_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={room.color === c}
              aria-label={COLOR_LABEL[c]}
              title={COLOR_LABEL[c]}
              className="room-row__color"
              style={{ '--c': tapeVar(c) } as CSSProperties}
              onClick={() => updateRoom(room.id, { color: c })}
            />
          ))}
        </div>
      </div>
      <div className="room-row__side">
        <span className="room-row__count type">{plural(count, 'exhibit')}</span>
        <div className="room-row__order">
          <button type="button" className="btn btn--ghost btn--icon" disabled={index === 0} onClick={() => moveRoom(room.id, -1)} aria-label={`Move ${room.name} up`}>
            <Icon name="up" size={16} />
          </button>
          <button type="button" className="btn btn--ghost btn--icon" disabled={index === total - 1} onClick={() => moveRoom(room.id, 1)} aria-label={`Move ${room.name} down`}>
            <Icon name="down" size={16} />
          </button>
        </div>
        <InlineConfirm
          label={<Icon name="trash" size={16} />}
          className="btn btn--ghost btn--icon"
          message={count ? `Delete? ${plural(count, 'exhibit')} move to Unsorted.` : 'Delete this room?'}
          confirmLabel="Delete"
          onConfirm={() => deleteRoom(room.id)}
        />
      </div>
    </li>
  );
}

/** Create, rename, recolour, reorder and delete rooms. */
export function RoomsManager() {
  const rooms = useStore(data, (s) => liveRooms(s.rooms));
  const items = useStore(data, (s) => liveItems(s.items));
  const [name, setName] = useState('');
  const close = () => ui.set({ roomsOpen: false });

  const counts = new Map<string, number>();
  for (const i of items) if (i.room_id) counts.set(i.room_id, (counts.get(i.room_id) ?? 0) + 1);

  return (
    <Sheet title="Rooms of the museum" onClose={close}>
      <form
        className="rooms-new"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) createRoom(name, nextRoomColor());
          setName('');
        }}
      >
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="New room, e.g. Typography" aria-label="New room name" maxLength={80} />
        <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
          <Icon name="plus" size={16} /> Add room
        </button>
      </form>
      {rooms.length === 0 ? (
        <p className="rooms-empty">No rooms yet. Rooms are the big wings of your museum: Space, Jazz, Design…</p>
      ) : (
        <ul className="rooms-list">
          {rooms.map((r, i) => (
            <RoomRow key={r.id} room={r} index={i} total={rooms.length} count={counts.get(r.id) ?? 0} />
          ))}
        </ul>
      )}
    </Sheet>
  );
}
