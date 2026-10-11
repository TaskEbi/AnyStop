import { useState } from 'react';
import { createRoom } from '../../data/actions';
import { data, liveRooms } from '../../data/store';
import { useStore } from '../../lib/createStore';

const NEW = '__new__';

/** Room select with an inline "+ New room" that creates the room on the spot. */
export function RoomPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const rooms = useStore(data, (s) => liveRooms(s.rooms));
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  function add() {
    if (!name.trim()) return setAdding(false);
    const room = createRoom(name);
    onChange(room.id);
    setName('');
    setAdding(false);
  }

  if (adding) {
    return (
      <div className="room-picker__new">
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setAdding(false);
            }
          }}
          placeholder="Name of the new room"
          aria-label="New room name"
          autoFocus
          maxLength={80}
        />
        <button type="button" className="btn" onClick={add}>
          Add
        </button>
      </div>
    );
  }

  return (
    <select
      className="select"
      value={value && rooms.some((r) => r.id === value) ? value : ''}
      onChange={(e) => (e.target.value === NEW ? setAdding(true) : onChange(e.target.value || null))}
      aria-label="Room"
    >
      <option value="">Unsorted</option>
      {rooms.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
      <option value={NEW}>+ New room…</option>
    </select>
  );
}
