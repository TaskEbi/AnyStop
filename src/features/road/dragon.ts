/**
 * DragonCode link: reads the read-only training summary DragonCode serves at /api/road (its docs/road-to-ioi-link.md)
 * with the key from DragonCode's Settings. The last good copy is kept on this device so the page opens offline.
 */
import { createStore } from '../../lib/createStore';

export interface DragonSummary {
  version: 1;
  generatedAt: string;
  timezone: string;
  today: string;
  mockOpen: boolean;
  days: { date: string; minutes: number; results: number; ac: number }[];
  recent: { problemId: string; title: string; url: string | null; verdict: string; helpUsed: string; minutes: number; reflection: string; date: string }[];
  upsolve: { problemId: string; title: string; url: string | null; reason: 'not_accepted' | 'in_progress' | 'resolve'; verdict: string | null; since: string }[];
  targets: { name: string; kind: string; date: string; time: string | null; timezone: string | null }[];
}

export interface DragonState {
  summary: DragonSummary | null;
  /** When the summary was fetched (ms), for "updated 3 min ago". */
  fetchedAt: number | null;
  loading: boolean;
  error: string | null;
}

const CACHE_KEY = 'curio-road-dragon';
const TIMEOUT_MS = 15_000;
/** Refetch when the page comes back after this long. */
export const STALE_MS = 2 * 60_000;

function cached(): Pick<DragonState, 'summary' | 'fetchedAt'> {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as { at: number; summary: unknown } | null;
    if (raw && isSummary(raw.summary)) return { summary: raw.summary, fetchedAt: raw.at };
  } catch {
    /* nothing cached, or storage is blocked */
  }
  return { summary: null, fetchedAt: null };
}

export const dragon = createStore<DragonState>({ ...cached(), loading: false, error: null });

const isArr = (v: unknown) => Array.isArray(v);
export function isSummary(v: unknown): v is DragonSummary {
  const s = v as DragonSummary | null;
  return !!s && s.version === 1 && typeof s.today === 'string' && isArr(s.days) && isArr(s.recent) && isArr(s.upsolve) && isArr(s.targets);
}

/** The address with no trailing slash, or null if it is not a web address this page may call. */
export function dragonBase(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Ask DragonCode for the summary. Resolves to an error message, or null when it worked. */
export async function fetchDragon(url: string, key: string): Promise<string | null> {
  const base = dragonBase(url);
  if (!base || !key.trim()) return 'Add the DragonCode address and the link key first.';
  dragon.set({ loading: true });
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  let error: string | null = null;
  try {
    const res = await fetch(`${base}/api/road`, { headers: { Authorization: `Bearer ${key.trim()}` }, signal: abort.signal, cache: 'no-store' });
    const body = (await res.json().catch(() => null)) as unknown;
    if (res.ok && isSummary(body)) {
      dragon.set({ summary: body, fetchedAt: Date.now(), error: null });
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), summary: body }));
      } catch {
        /* storage full or blocked: it still shows this time */
      }
    } else {
      const message = (body as { message?: unknown } | null)?.message;
      error =
        res.status === 401
          ? "DragonCode didn't accept the key. Copy it again from DragonCode → Settings → Road to IOI link."
          : typeof message === 'string'
            ? message
            : `DragonCode answered ${res.status}.`;
    }
  } catch {
    error = navigator.onLine ? "Couldn't reach DragonCode. Check the address, or try again in a minute." : "You're offline. Showing the last copy from DragonCode.";
  } finally {
    clearTimeout(timer);
  }
  dragon.set({ loading: false, error });
  return error;
}

/** Unlinking forgets the copy on this device too. */
export function forgetDragon() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* fine */
  }
  dragon.set({ summary: null, fetchedAt: null, loading: false, error: null });
}
