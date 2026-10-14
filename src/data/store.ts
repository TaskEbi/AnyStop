import { createStore } from '../lib/createStore';
import { openLocalDb, type LocalDb } from './idb';
import {
  DEFAULT_SETTINGS,
  TABLES,
  type Connection,
  type Item,
  type LogEntry,
  type LogGoal,
  type LogTopic,
  type RecordOf,
  type Room,
  type Settings,
  type TableName,
} from './types';

export type SyncStatus = 'local' | 'idle' | 'syncing' | 'offline' | 'error';

export interface DataState {
  ready: boolean;
  mode: 'local' | 'synced';
  items: Map<string, Item>;
  rooms: Map<string, Room>;
  connections: Map<string, Connection>;
  log_topics: Map<string, LogTopic>;
  log_entries: Map<string, LogEntry>;
  log_goals: Map<string, LogGoal>;
  settings: Settings;
  sync: { status: SyncStatus; pending: number; error: string | null };
}

export const data = createStore<DataState>({
  ready: false,
  mode: 'local',
  items: new Map(),
  rooms: new Map(),
  connections: new Map(),
  log_topics: new Map(),
  log_entries: new Map(),
  log_goals: new Map(),
  settings: DEFAULT_SETTINGS,
  sync: { status: 'local', pending: 0, error: null },
});

// ─── outbox: which local records still need pushing ─────────────────────────

/** id → revision. A push only clears an entry if the revision hasn't moved on meanwhile. */
export type Outbox = Record<TableName, Record<string, number>> & { settings: number; rev: number };

const emptyOutbox = (): Outbox => ({
  ...(Object.fromEntries(TABLES.map((t) => [t, {}])) as Record<TableName, Record<string, number>>),
  settings: 0,
  rev: 0,
});

interface Session {
  db: LocalDb;
  cloud: boolean;
  dbName: string;
  outbox: Outbox;
  onLocalChange: () => void;
}

let session: Session | null = null;

export function currentSession(): Session | null {
  return session;
}

function countPending(o: Outbox): number {
  return TABLES.reduce((n, t) => n + Object.keys(o[t]).length, 0) + (o.settings ? 1 : 0);
}

function persistOutbox() {
  if (!session) return;
  const s = session;
  void s.db.setMeta('outbox', s.outbox);
  data.set((st) => ({ ...st, sync: { ...st.sync, pending: countPending(s.outbox) } }));
}

export function clearOutboxEntries(table: TableName | 'settings', revs: Record<string, number> | number) {
  if (!session) return;
  const o = session.outbox;
  if (table === 'settings') {
    if (o.settings === revs) o.settings = 0;
  } else {
    for (const [id, rev] of Object.entries(revs as Record<string, number>)) {
      if (o[table][id] === rev) delete o[table][id];
    }
  }
  persistOutbox();
}

// ─── writing records ────────────────────────────────────────────────────────

/** Save records changed on this device: memory now, IndexedDB + outbox right after. */
export function commit<T extends TableName>(table: T, records: RecordOf<T>[]) {
  if (!records.length) return;
  data.set((st) => {
    const next = new Map(st[table] as Map<string, RecordOf<T>>);
    for (const r of records) next.set(r.id, r);
    return { ...st, [table]: next };
  });
  if (!session) return;
  void session.db.putMany(table, records);
  const o = session.outbox;
  const dirty: Record<string, number> = o[table];
  for (const r of records) dirty[r.id] = ++o.rev;
  persistOutbox();
  session.onLocalChange();
}

export function commitSettings(patch: Partial<Settings>) {
  const settings = { ...data.get().settings, ...patch, updated_at: new Date().toISOString() };
  data.set({ settings });
  if (!session) return;
  void session.db.setMeta('settings', settings);
  session.outbox.settings = ++session.outbox.rev;
  persistOutbox();
  session.onLocalChange();
}

/**
 * Apply rows that came from the server. A record with unpushed local changes
 * keeps them (they'll win when pushed), but still picks up its accession number.
 */
export function applyRemote<T extends TableName>(table: T, rows: RecordOf<T>[]) {
  if (!rows.length || !session) return;
  const dirty = session.outbox[table];
  const stored: RecordOf<T>[] = [];
  data.set((st) => {
    const next = new Map(st[table] as Map<string, RecordOf<T>>);
    for (const row of rows) {
      const local = next.get(row.id);
      let merged: RecordOf<T> = row;
      if (local && dirty[row.id]) {
        if (table !== 'items') continue;
        const li = local as Item;
        if (li.accession_no != null) continue;
        merged = { ...li, accession_no: (row as Item).accession_no } as RecordOf<T>;
      }
      next.set(row.id, merged);
      stored.push(merged);
    }
    return { ...st, [table]: next };
  });
  void session.db.putMany(table, stored);
}

export function applyRemoteSettings(settings: Settings) {
  if (!session || session.outbox.settings) return;
  data.set({ settings });
  void session.db.setMeta('settings', settings);
}

export function setSyncState(patch: Partial<DataState['sync']>) {
  data.set((st) => ({ ...st, sync: { ...st.sync, ...patch } }));
}

// ─── session lifecycle ──────────────────────────────────────────────────────

/** Load the local copy from IndexedDB and make it the live state. */
export async function openSession(opts: { cloud: boolean; onLocalChange: () => void }) {
  const dbName = opts.cloud ? 'curio-cloud' : 'curio-local';
  const db = await openLocalDb(dbName);
  const [tables, settings, outbox] = await Promise.all([
    Promise.all(TABLES.map((t) => db.getAll<{ id: string }>(t))),
    db.getMeta<Settings>('settings'),
    db.getMeta<Outbox>('outbox'),
  ]);
  const maps = Object.fromEntries(TABLES.map((t, i) => [t, new Map(tables[i].map((r) => [r.id, r]))]));
  // Outboxes saved before the Daily Log existed lack its tables.
  session = { db, cloud: opts.cloud, dbName, outbox: { ...emptyOutbox(), ...outbox }, onLocalChange: opts.onLocalChange };
  data.set({
    ...(maps as Pick<DataState, TableName>),
    ready: true,
    mode: opts.cloud ? 'synced' : 'local',
    settings: { ...DEFAULT_SETTINGS, ...settings },
    sync: { status: opts.cloud ? 'idle' : 'local', pending: countPending(session.outbox), error: null },
  });
  return session;
}

export function closeSession(): string | null {
  if (!session) return null;
  const name = session.dbName;
  session.db.close();
  session = null;
  data.set({
    ...(Object.fromEntries(TABLES.map((t) => [t, new Map()])) as Pick<DataState, TableName>),
    ready: false,
    settings: DEFAULT_SETTINGS,
    sync: { status: 'local', pending: 0, error: null },
  });
  return name;
}

// ─── derived, memoised selectors (stable while the source map is unchanged) ─

function memo<A, R>(fn: (a: A) => R): (a: A) => R {
  let lastA: A | undefined;
  let lastR: R;
  return (a) => {
    if (a !== lastA) {
      lastA = a;
      lastR = fn(a);
    }
    return lastR;
  };
}

export const liveItems = memo((m: Map<string, Item>) => [...m.values()].filter((i) => !i.deleted_at));
export const liveRooms = memo((m: Map<string, Room>) =>
  [...m.values()].filter((r) => !r.deleted_at).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
);
export const liveConnections = memo((m: Map<string, Connection>) => [...m.values()].filter((c) => !c.deleted_at));
export const allTags = memo((m: Map<string, Item>) => {
  const counts = new Map<string, number>();
  for (const i of m.values()) if (!i.deleted_at) for (const t of i.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
});
