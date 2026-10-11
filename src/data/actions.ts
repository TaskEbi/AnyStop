import { uuid } from '../lib/random';
import { commit, commitSettings, data, liveConnections, liveRooms } from './store';
import { ROOM_COLORS, type Connection, type Item, type Room, type RoomColor, type Settings } from './types';

const now = () => new Date().toISOString();

export type ItemDraft = Partial<Omit<Item, 'id' | 'updated_at' | 'accession_no'>> & Pick<Item, 'kind'>;

export function normaliseTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const t of tags) {
    const tag = t.trim().replace(/^#/, '').replace(/\s+/g, ' ').toLowerCase();
    if (tag) seen.add(tag);
  }
  return [...seen];
}

/** In local-only mode numbers are handed out here; when synced the server assigns them. */
function nextLocalAccession(): number | null {
  const st = data.get();
  if (st.mode === 'synced') return null;
  let max = 0;
  for (const i of st.items.values()) max = Math.max(max, i.accession_no ?? 0);
  return max + 1;
}

export function createItem(draft: ItemDraft): Item {
  const t = now();
  const item: Item = {
    id: uuid(),
    title: '',
    url: null,
    creator: null,
    body: null,
    note: null,
    room_id: null,
    status: 'none',
    favourite: false,
    image_path: null,
    preview: null,
    collage_pos: null,
    is_example: false,
    last_opened_at: null,
    deleted_at: null,
    ...draft,
    tags: normaliseTags(draft.tags ?? []),
    accession_no: nextLocalAccession(),
    created_at: draft.created_at ?? t,
    updated_at: t,
  };
  commit('items', [item]);
  return item;
}

export function updateItem(id: string, patch: Partial<Item>) {
  const item = data.get().items.get(id);
  if (!item) return;
  const next = { ...item, ...patch, updated_at: now() };
  if (patch.tags) next.tags = normaliseTags(patch.tags);
  commit('items', [next]);
}

export function markOpened(id: string) {
  const item = data.get().items.get(id);
  if (item) commit('items', [{ ...item, last_opened_at: now(), updated_at: now() }]);
}

export function deleteItem(id: string) {
  const st = data.get();
  const item = st.items.get(id);
  if (!item) return;
  const t = now();
  const strings = liveConnections(st.connections).filter((c) => c.item_a === id || c.item_b === id);
  commit('items', [{ ...item, deleted_at: t, updated_at: t }]);
  commit('connections', strings.map((c) => ({ ...c, deleted_at: t, updated_at: t })));
}

// ─── rooms ──────────────────────────────────────────────────────────────────

/** The palette colour used least so far, so new rooms spread across the palette. */
export function nextRoomColor(): RoomColor {
  const used = liveRooms(data.get().rooms).map((r) => r.color);
  return [...ROOM_COLORS].sort((a, b) => used.filter((c) => c === a).length - used.filter((c) => c === b).length)[0];
}

export function createRoom(name: string, color: RoomColor = nextRoomColor(), extra: Partial<Room> = {}): Room {
  const rooms = liveRooms(data.get().rooms);
  const t = now();
  const room: Room = {
    id: uuid(),
    name: name.trim().slice(0, 80) || 'Untitled room',
    color,
    description: null,
    sort_order: rooms.length ? rooms[rooms.length - 1].sort_order + 1 : 1,
    is_example: false,
    created_at: t,
    updated_at: t,
    deleted_at: null,
    ...extra,
  };
  commit('rooms', [room]);
  return room;
}

export function updateRoom(id: string, patch: Partial<Room>) {
  const room = data.get().rooms.get(id);
  if (room) commit('rooms', [{ ...room, ...patch, updated_at: now() }]);
}

export function moveRoom(id: string, direction: -1 | 1) {
  const rooms = liveRooms(data.get().rooms);
  const i = rooms.findIndex((r) => r.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= rooms.length) return;
  const order = [...rooms];
  [order[i], order[j]] = [order[j], order[i]];
  const t = now();
  commit(
    'rooms',
    order.flatMap((r, k) => (r.sort_order === k + 1 ? [] : [{ ...r, sort_order: k + 1, updated_at: t }])),
  );
}

/** Deleting a room moves its items to Unsorted. */
export function deleteRoom(id: string) {
  const st = data.get();
  const room = st.rooms.get(id);
  if (!room) return;
  const t = now();
  const moved = [...st.items.values()].filter((i) => i.room_id === id).map((i) => ({ ...i, room_id: null, updated_at: t }));
  commit('items', moved);
  commit('rooms', [{ ...room, deleted_at: t, updated_at: t }]);
}

// ─── connections ────────────────────────────────────────────────────────────

/** Tie a string between two items. Each pair is stored once, smaller id first. */
export function tie(a: string, b: string, label: string | null = null, extra: Partial<Connection> = {}): Connection | null {
  if (a === b) return null;
  const [item_a, item_b] = a < b ? [a, b] : [b, a];
  const existing = [...data.get().connections.values()].find((c) => c.item_a === item_a && c.item_b === item_b);
  const t = now();
  // Re-tying a pair that was cut revives the old row (the pair is unique in the database).
  const conn: Connection = existing
    ? { ...existing, label: label ?? existing.label, deleted_at: null, updated_at: t, ...extra }
    : { id: uuid(), item_a, item_b, label, is_example: false, created_at: t, updated_at: t, deleted_at: null, ...extra };
  commit('connections', [conn]);
  return conn;
}

export function updateConnection(id: string, patch: Partial<Connection>) {
  const c = data.get().connections.get(id);
  if (c) commit('connections', [{ ...c, ...patch, updated_at: now() }]);
}

export function cut(id: string) {
  const c = data.get().connections.get(id);
  if (c) commit('connections', [{ ...c, deleted_at: now(), updated_at: now() }]);
}

// ─── settings ───────────────────────────────────────────────────────────────

export function updateSettings(patch: Partial<Omit<Settings, 'updated_at'>>) {
  commitSettings(patch);
}

// ─── collage ────────────────────────────────────────────────────────────────

/** "Tidy up": forget hand-placed collage positions so the automatic layout takes over. */
export function resetCollage(ids: string[]) {
  const st = data.get();
  const t = now();
  commit(
    'items',
    ids.flatMap((id) => {
      const i = st.items.get(id);
      return i?.collage_pos ? [{ ...i, collage_pos: null, updated_at: t }] : [];
    }),
  );
}
