import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import {
  applyRemote,
  applyRemoteSettings,
  clearOutboxEntries,
  currentSession,
  data,
  setSyncState,
} from './store';
import { DEFAULT_SETTINGS, type RecordOf, type Settings, type TableName } from './types';

/** Push order matters: rooms before the items that use them, items before strings. */
const TABLES: TableName[] = ['rooms', 'items', 'connections'];
const PAGE = 1000;
/** Re-read a few seconds before the cursor in case two writes committed out of order. */
const CURSOR_OVERLAP_MS = 5000;

/** Fields the server owns; never sent from the client. */
function toServer(table: TableName, record: object): Record<string, unknown> {
  const row: Record<string, unknown> = { ...record };
  if (table === 'items') delete row.accession_no;
  return row;
}

function fromServer<T extends TableName>(row: Record<string, unknown>): RecordOf<T> {
  const copy = { ...row };
  delete copy.owner_id;
  return copy as unknown as RecordOf<T>;
}

function isNetworkError(err: { code?: string; message?: string } | null): boolean {
  return !!err && !err.code && /fetch|network|load failed/i.test(err.message ?? '');
}

export interface SyncHandle {
  request(): void;
  stop(): void;
  /** Resolves after the first full pull (or immediately if offline). */
  firstPull: Promise<void>;
}

export function startSync(sb: SupabaseClient, userId: string): SyncHandle {
  let running = false;
  let again = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let resolveFirst!: () => void;
  const firstPull = new Promise<void>((r) => (resolveFirst = r));

  async function push(): Promise<string | null> {
    const s = currentSession();
    if (!s) return null;
    let problem: string | null = null;

    for (const table of TABLES) {
      const revs = { ...s.outbox[table] };
      const ids = Object.keys(revs);
      const map = data.get()[table];
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200).filter((id) => map.has(id));
        if (!chunk.length) continue;
        const rows = chunk.map((id) => toServer(table, map.get(id)!));
        const { data: saved, error } = await sb.from(table).upsert(rows).select();
        if (error) {
          if (isNetworkError(error)) throw error;
          // One bad row shouldn't block the rest: retry one by one, drop rows the server rejects.
          for (const row of rows) {
            const one = await sb.from(table).upsert(row).select();
            if (one.error) {
              if (isNetworkError(one.error)) throw one.error;
              console.warn('Curio: server rejected a change', table, row, one.error);
              problem = `A change couldn't be saved (${one.error.message}).`;
            } else {
              applyRemote(table, (one.data ?? []).map((r) => fromServer<typeof table>(r)));
            }
            clearOutboxEntries(table, { [row.id as string]: revs[row.id as string] });
          }
          continue;
        }
        applyRemote(table, (saved ?? []).map((r) => fromServer<typeof table>(r)));
        clearOutboxEntries(table, Object.fromEntries(chunk.map((id) => [id, revs[id]])));
      }
    }

    const settingsRev = s.outbox.settings;
    if (settingsRev) {
      const { museum_name, default_view, theme, examples_seeded } = data.get().settings;
      const { error } = await sb
        .from('settings')
        .upsert({ owner_id: userId, museum_name, default_view, theme, examples_seeded });
      if (error) {
        if (isNetworkError(error)) throw error;
        problem = `Settings couldn't be saved (${error.message}).`;
      }
      clearOutboxEntries('settings', settingsRev);
    }
    return problem;
  }

  async function pullTable<T extends TableName>(table: T) {
    const s = currentSession();
    if (!s) return;
    const cursor = await s.db.getMeta<string>(`cursor:${table}`);
    const since = cursor ? new Date(new Date(cursor).getTime() - CURSOR_OVERLAP_MS).toISOString() : null;
    let newest = cursor ?? '';
    for (let from = 0; ; from += PAGE) {
      let q = sb.from(table).select('*');
      if (since) q = q.gt('updated_at', since);
      const { data: rows, error } = await q.order('updated_at').order('id').range(from, from + PAGE - 1);
      if (error) throw error;
      applyRemote(table, rows.map((r) => fromServer<T>(r)));
      for (const r of rows) if ((r.updated_at as string) > newest) newest = r.updated_at as string;
      if (rows.length < PAGE) break;
    }
    if (newest && newest !== cursor) await s.db.setMeta(`cursor:${table}`, newest);
  }

  async function pull() {
    for (const t of TABLES) await pullTable(t);
    const { data: rows, error } = await sb.from('settings').select('*').limit(1);
    if (error) throw error;
    const r = rows[0] as Settings | undefined;
    if (r) {
      const { museum_name, default_view, theme, examples_seeded, updated_at } = r;
      applyRemoteSettings({ ...DEFAULT_SETTINGS, museum_name, default_view, theme, examples_seeded, updated_at });
    }
  }

  async function run() {
    if (stopped) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    if (!navigator.onLine) {
      setSyncState({ status: 'offline' });
      running = false;
      resolveFirst();
      return;
    }
    setSyncState({ status: 'syncing' });
    try {
      const problem = await push();
      await pull();
      setSyncState({ status: problem ? 'error' : 'idle', error: problem });
    } catch (err) {
      const offline = !navigator.onLine || isNetworkError(err as { message?: string });
      setSyncState({ status: offline ? 'offline' : 'error', error: offline ? null : String((err as Error).message ?? err) });
    } finally {
      running = false;
      resolveFirst();
      if (again && !stopped) {
        again = false;
        void run();
      }
    }
  }

  function request(delay = 400) {
    clearTimeout(timer);
    timer = setTimeout(run, delay);
  }

  const onOnline = () => request(0);
  const onOffline = () => setSyncState({ status: 'offline' });
  const onVisible = () => document.visibilityState === 'visible' && request(0);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  const interval = setInterval(() => request(0), 60_000);

  // Changes from my other devices arrive here; just pull rather than trusting payloads.
  const channel: RealtimeChannel = sb.channel(`curio-${userId}`);
  for (const table of [...TABLES, 'settings']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => request(250));
  }
  channel.subscribe();

  void run();

  return {
    request: () => request(),
    firstPull,
    stop() {
      stopped = true;
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      void sb.removeChannel(channel);
    },
  };
}
