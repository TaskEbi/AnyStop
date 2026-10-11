import { createItem, createRoom, tie, updateSettings, type ItemDraft } from './actions';
import { commit, data, liveConnections, liveRooms } from './store';
import type { RoomColor } from './types';

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

type Example = ItemDraft & { key: string; room: string; age: number };

const ROOMS: { key: string; name: string; color: RoomColor; description: string }[] = [
  { key: 'space', name: 'Space', color: 'blue', description: 'Scale, distance and the view from far away.' },
  { key: 'jazz', name: 'Jazz', color: 'mustard', description: 'Records, ideas and the people behind them.' },
  { key: 'design', name: 'Design', color: 'sage', description: 'Objects made with care.' },
  { key: 'minds', name: 'Minds & Machines', color: 'lavender', description: 'Information, computation, thinking.' },
];

// Oldest first, so accession numbers follow the order they were "acquired".
const EXAMPLES: Example[] = [
  {
    key: 'shannon', room: 'minds', age: 365 * 2, kind: 'paper',
    title: 'A Mathematical Theory of Communication', creator: 'Claude E. Shannon',
    url: 'https://doi.org/10.1002/j.1538-7305.1948.tb01338.x',
    note: 'Where "information" became something you could measure.',
    tags: ['information', 'classics'], status: 'up_next',
    preview: { site_name: 'Bell System Technical Journal', description: 'Bell System Technical Journal, 1948.' },
  },
  {
    key: 'marble', room: 'space', age: 365, kind: 'photo',
    title: 'The Blue Marble', creator: 'Apollo 17 crew',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/The_Earth_seen_from_Apollo_17.jpg/500px-The_Earth_seen_from_Apollo_17.jpg',
    note: 'Taken 7 December 1972, about 29,000 km out.', tags: ['earth', 'scale'],
    preview: { site_name: 'Wikimedia Commons' },
  },
  {
    key: 'powers', room: 'space', age: 200, kind: 'video',
    title: 'Powers of Ten (1977)', creator: 'Charles & Ray Eames',
    url: 'https://www.youtube.com/watch?v=0fKBhvDjuy0',
    note: 'Nine minutes, forty orders of magnitude. The best zoom ever made.',
    tags: ['scale', 'eames', 'classics'], status: 'done',
    preview: { site_name: 'YouTube', thumbnail: 'https://i.ytimg.com/vi/0fKBhvDjuy0/hqdefault.jpg' },
  },
  {
    key: 'rams', room: 'design', age: 150, kind: 'link',
    title: "Dieter Rams: ten principles for good design", creator: 'Vitsœ',
    url: 'https://www.vitsoe.com/gb/about/good-design',
    note: 'Innovative, useful, aesthetic, understandable, unobtrusive, honest, long-lasting, thorough, environmentally friendly, as little design as possible.',
    tags: ['rams', 'principles'],
    preview: { site_name: 'Vitsœ', description: 'Good design is as little design as possible.' },
  },
  {
    key: 'kob', room: 'jazz', age: 120, kind: 'music',
    title: 'Kind of Blue', creator: 'Miles Davis',
    url: 'https://open.spotify.com/album/1weenld61qoidwYuZ1GESA',
    note: 'Recorded in two sessions in 1959. Mostly first takes.',
    tags: ['modal', 'classics'], status: 'up_next', favourite: true,
    preview: { site_name: 'Spotify', thumbnail: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02387a29c90de3b2398c29c34f' },
  },
  {
    key: 'modal', room: 'jazz', age: 118, kind: 'note',
    title: 'Modal jazz, in one breath',
    body: 'Improvise over a scale instead of a run of chord changes. "So What" is just D Dorian for 16 bars, up a half step to E♭ for 8, then back.',
    tags: ['modal'],
  },
  {
    key: 'less', room: 'design', age: 90, kind: 'quote',
    title: 'Less, but better.', body: 'Less, but better.', creator: 'Dieter Rams',
    note: '"Weniger, aber besser." Fewer things, each one done properly.', tags: ['rams'], favourite: true,
  },
  {
    key: 'paledot', room: 'space', age: 60, kind: 'article',
    title: 'Pale Blue Dot', creator: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Pale_Blue_Dot',
    note: 'Voyager 1 turned round on 14 Feb 1990, 6 billion km out, and took one last look.',
    tags: ['voyager', 'sagan', 'scale'],
    preview: {
      site_name: 'Wikipedia',
      description: 'Pale Blue Dot is a photograph of Earth taken on February 14, 1990, by the Voyager 1 space probe from a record distance of about 6 billion kilometers.',
    },
  },
  {
    key: 'sagan', room: 'space', age: 59, kind: 'quote',
    title: 'Look again at that dot.',
    body: "Look again at that dot. That's here. That's home. That's us.",
    creator: 'Carl Sagan, Pale Blue Dot (1994)', tags: ['sagan', 'voyager'], favourite: true,
  },
  {
    key: 'bluenote', room: 'jazz', age: 30, kind: 'link',
    title: 'Blue Note Records', url: 'https://www.bluenote.com/',
    note: 'The label, and those Reid Miles covers.', tags: ['labels', 'design'],
    preview: { site_name: 'Blue Note Records' },
  },
  {
    key: 'attention', room: 'minds', age: 14, kind: 'paper',
    title: 'Attention Is All You Need', creator: 'Vaswani et al.',
    url: 'https://arxiv.org/abs/1706.03762',
    note: 'The transformer paper. Eight pages that rearranged a field.', tags: ['ai', 'classics'], status: 'in_progress',
    preview: { site_name: 'arXiv', description: 'Proposes the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.' },
  },
  {
    key: 'golden', room: '', age: 2, kind: 'note',
    title: 'Look up the Golden Record track list',
    body: 'Look up the Voyager Golden Record track list. Is there jazz on it? (Louis Armstrong?)',
    tags: ['voyager'], status: 'up_next',
  },
];

const STRINGS: [string, string, string][] = [
  ['powers', 'paledot', 'same idea: scale'],
  ['sagan', 'paledot', 'from'],
  ['paledot', 'marble', 'see also'],
  ['less', 'rams', 'said by'],
  ['powers', 'rams', 'kindred designers'],
  ['modal', 'kob', 'explains'],
  ['golden', 'paledot', 'Voyager 1'],
  ['shannon', 'attention', 'builds on'],
];

/** Fill an empty cabinet with ~12 clearly marked examples across 4 rooms. */
export function seedExamples() {
  const roomIds: Record<string, string> = {};
  for (const r of ROOMS) {
    roomIds[r.key] = createRoom(r.name, r.color, { description: r.description, is_example: true }).id;
  }
  const itemIds: Record<string, string> = {};
  for (const { key, room, age, ...draft } of EXAMPLES) {
    itemIds[key] = createItem({ ...draft, room_id: roomIds[room] ?? null, is_example: true, created_at: daysAgo(age) }).id;
  }
  for (const [a, b, label] of STRINGS) tie(itemIds[a], itemIds[b], label, { is_example: true });
  updateSettings({ examples_seeded: true });
}

export function hasExamples(): boolean {
  for (const i of data.get().items.values()) if (i.is_example && !i.deleted_at) return true;
  return false;
}

/**
 * Remove example items and their strings. Example rooms go too, unless I've put
 * my own things in them, in which case they stay and become ordinary rooms.
 */
export function clearExamples() {
  const st = data.get();
  const t = new Date().toISOString();
  const items = [...st.items.values()].filter((i) => i.is_example && !i.deleted_at);
  const gone = new Set(items.map((i) => i.id));
  const strings = liveConnections(st.connections).filter((c) => c.is_example || gone.has(c.item_a) || gone.has(c.item_b));
  const rooms = liveRooms(st.rooms).filter((r) => r.is_example);
  const roomInUse = (id: string) => [...st.items.values()].some((i) => i.room_id === id && !i.deleted_at && !gone.has(i.id));

  commit('connections', strings.map((c) => ({ ...c, deleted_at: t, updated_at: t })));
  commit('items', items.map((i) => ({ ...i, deleted_at: t, updated_at: t })));
  commit(
    'rooms',
    rooms.map((r) => (roomInUse(r.id) ? { ...r, is_example: false, updated_at: t } : { ...r, deleted_at: t, updated_at: t })),
  );
}
