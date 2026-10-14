// Dev-only helpers (window.curioDev) for the 1,000-item performance check.
import { commit, data, liveConnections, liveItems, liveRooms } from '../data/store';
import { KINDS, ROOM_COLORS, type Connection, type Item, type LogEntry, type Room } from '../data/types';
import { addDays } from '../features/daily-log/dates';
import { logToday } from '../data/logActions';
import { uuid } from '../lib/random';

const TAG = 'perf-test';
const WORDS = 'atlas lantern quiet orbit paper river cobalt signal meadow ember glass harbour cipher velvet north drift echo saffron granite hollow'.split(' ');
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

function fake(n = 1000, strings = 300) {
  const t = new Date().toISOString();
  const rooms: Room[] = Array.from({ length: 6 }, (_, i) => ({
    id: uuid(), name: `Perf wing ${i + 1}`, color: ROOM_COLORS[i], description: null, sort_order: 100 + i,
    is_example: false, created_at: t, updated_at: t, deleted_at: null,
  }));
  const allRooms = [...liveRooms(data.get().rooms), ...rooms];
  const items: Item[] = Array.from({ length: n }, (_, i) => {
    const kind = pick(KINDS);
    const title = `${pick(WORDS)} ${pick(WORDS)} ${pick(WORDS)}`.replace(/^./, (c) => c.toUpperCase());
    const created = new Date(Date.now() - Math.random() * 3 * 365 * 86_400_000).toISOString();
    return {
      id: uuid(), kind, title, url: kind === 'quote' || kind === 'note' ? null : `https://example.com/${i}`,
      creator: Math.random() < 0.6 ? `${pick(WORDS)} ${pick(WORDS)}` : null,
      body: kind === 'quote' || kind === 'note' ? `${title}. ${pick(WORDS)} ${pick(WORDS)} ${pick(WORDS)} ${pick(WORDS)}.` : null,
      note: null, room_id: Math.random() < 0.9 ? pick(allRooms).id : null, tags: [TAG, pick(WORDS)],
      status: pick(['none', 'none', 'up_next', 'in_progress', 'done'] as const), favourite: Math.random() < 0.1,
      image_path: null, preview: { fetched_at: t, ok: false }, accession_no: 10_000 + i, collage_pos: null, is_example: false,
      created_at: created, updated_at: t, last_opened_at: null, deleted_at: null,
    };
  });
  const conns: Connection[] = [];
  const seen = new Set<string>();
  while (conns.length < strings) {
    const [a, b] = [pick(items).id, pick(items).id].sort();
    if (a === b || seen.has(a + b)) continue;
    seen.add(a + b);
    conns.push({ id: uuid(), item_a: a, item_b: b, label: Math.random() < 0.4 ? pick(WORDS) : null, is_example: false, created_at: t, updated_at: t, deleted_at: null });
  }
  commit('rooms', rooms);
  commit('items', items);
  commit('connections', conns);
  return { items: items.length, rooms: rooms.length, connections: conns.length };
}

function clearFake() {
  const st = data.get();
  const t = new Date().toISOString();
  const items = liveItems(st.items).filter((i) => i.tags.includes(TAG));
  const ids = new Set(items.map((i) => i.id));
  commit('connections', liveConnections(st.connections).filter((c) => ids.has(c.item_a) || ids.has(c.item_b)).map((c) => ({ ...c, deleted_at: t, updated_at: t })));
  commit('items', items.map((i) => ({ ...i, deleted_at: t, updated_at: t })));
  commit('rooms', liveRooms(st.rooms).filter((r) => r.name.startsWith('Perf wing')).map((r) => ({ ...r, deleted_at: t, updated_at: t })));
  return { removed: items.length };
}

/** Months of made-up Daily Log entries over the existing topics, to look at the charts with. */
function fakeLog(days = 180) {
  const st = data.get();
  const tops = [...st.log_topics.values()].filter((t) => !t.parent_id && !t.archived_at && !t.deleted_at);
  const today = logToday();
  const t = new Date().toISOString();
  const entries: LogEntry[] = [];
  for (let d = 0; d < days; d++) {
    const date = addDays(today, -d);
    for (const topic of tops) {
      if (Math.random() < 0.45) continue;
      const subs = [...st.log_topics.values()].filter((s) => s.parent_id === topic.id && !s.archived_at);
      entries.push({
        id: uuid(), date, topic_id: topic.id, subcategory_id: subs.length && Math.random() < 0.7 ? pick(subs).id : null,
        minutes: 15 * (1 + Math.floor(Math.random() * 6)), note: null, created_at: t, updated_at: t, deleted_at: null,
      });
    }
  }
  commit('log_entries', entries);
  return { entries: entries.length };
}

(window as unknown as { curioDev: unknown }).curioDev = { fake, clearFake, fakeLog };
