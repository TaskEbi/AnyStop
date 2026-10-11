import { hostOf } from '../lib/detectKind';
import type { Item, Kind, Room, Status } from './types';

export type SortKey = 'newest' | 'oldest' | 'az' | 'opened';

export interface Filters {
  /** room id, 'unsorted', or null for all rooms */
  room: string | null;
  status: Exclude<Status, 'none'> | null;
  favourites: boolean;
  kind: Kind | null;
  tag: string | null;
  q: string;
  sort: SortKey;
}

export const EMPTY_FILTERS: Filters = { room: null, status: null, favourites: false, kind: null, tag: null, q: '', sort: 'newest' };

export function activeFilterCount(f: Filters): number {
  return [f.room, f.status, f.kind, f.tag].filter(Boolean).length + (f.favourites ? 1 : 0) + (f.q.trim() ? 1 : 0);
}

const fold = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** Lower-cased text a search can match against: title, creator, text, my note, tags, domain, room. */
function haystack(item: Item, roomName: string): string {
  return fold(
    [item.title, item.creator, item.body, item.note, item.tags.join(' '), hostOf(item.url), roomName, item.preview?.site_name]
      .filter(Boolean)
      .join(' \n '),
  );
}

type Facet = 'room' | 'status' | 'favourites' | 'kind' | 'tag' | 'q';

function makeMatcher(f: Filters, rooms: Map<string, Room>, skip?: Facet) {
  const terms = fold(f.q).split(/\s+/).filter(Boolean);
  const cache = new Map<string, string>();
  return (i: Item): boolean => {
    if (skip !== 'room' && f.room && (f.room === 'unsorted' ? i.room_id && rooms.has(i.room_id) : i.room_id !== f.room)) return false;
    if (skip !== 'status' && f.status && i.status !== f.status) return false;
    if (skip !== 'favourites' && f.favourites && !i.favourite) return false;
    if (skip !== 'kind' && f.kind && i.kind !== f.kind) return false;
    if (skip !== 'tag' && f.tag && !i.tags.includes(f.tag)) return false;
    if (skip !== 'q' && terms.length) {
      let h = cache.get(i.id);
      if (h === undefined) {
        h = haystack(i, (i.room_id && rooms.get(i.room_id)?.name) || 'unsorted');
        cache.set(i.id, h);
      }
      for (const t of terms) if (!h.includes(t)) return false;
    }
    return true;
  };
}

function compare(sort: SortKey) {
  switch (sort) {
    case 'oldest':
      return (a: Item, b: Item) => a.created_at.localeCompare(b.created_at);
    case 'az':
      return (a: Item, b: Item) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true });
    case 'opened':
      return (a: Item, b: Item) =>
        (b.last_opened_at ?? '').localeCompare(a.last_opened_at ?? '') || b.created_at.localeCompare(a.created_at);
    default:
      return (a: Item, b: Item) => b.created_at.localeCompare(a.created_at);
  }
}

/** `rooms` should only hold live rooms, so items in deleted rooms count as Unsorted. */
export function applyFilters(items: Item[], f: Filters, rooms: Map<string, Room>): Item[] {
  return items.filter(makeMatcher(f, rooms)).sort(compare(f.sort));
}

export interface FacetCounts {
  rooms: Map<string, number>; // room id or 'unsorted'
  status: Map<string, number>;
  kinds: Map<string, number>;
  tags: Map<string, number>;
  favourites: number;
  all: number;
}

/** Counts for each filter option, given every *other* active filter (so choices combine). */
export function facetCounts(items: Item[], f: Filters, rooms: Map<string, Room>): FacetCounts {
  const out: FacetCounts = { rooms: new Map(), status: new Map(), kinds: new Map(), tags: new Map(), favourites: 0, all: 0 };
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  const m = {
    room: makeMatcher(f, rooms, 'room'),
    status: makeMatcher(f, rooms, 'status'),
    kind: makeMatcher(f, rooms, 'kind'),
    tag: makeMatcher(f, rooms, 'tag'),
    favourites: makeMatcher(f, rooms, 'favourites'),
  };
  for (const i of items) {
    if (m.room(i)) {
      bump(out.rooms, i.room_id && rooms.has(i.room_id) ? i.room_id : 'unsorted');
      out.all++;
    }
    if (m.status(i) && i.status !== 'none') bump(out.status, i.status);
    if (m.kind(i)) bump(out.kinds, i.kind);
    if (m.tag(i)) for (const t of i.tags) bump(out.tags, t);
    if (m.favourites(i) && i.favourite) out.favourites++;
  }
  return out;
}
