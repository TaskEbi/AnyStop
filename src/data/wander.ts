import type { Item } from './types';

const DAY = 86_400_000;

/**
 * How likely an item is to be picked by "Surprise me": things marked Up next and
 * things I haven't opened in a long time come up more often.
 */
export function wanderWeight(item: Item, now = Date.now()): number {
  const status = { up_next: 4, in_progress: 2, none: 1, done: 0.5 }[item.status];
  const last = new Date(item.last_opened_at ?? item.created_at).getTime();
  const staleness = Math.min(6, Math.max(0, (now - last) / DAY / 30)); // +1 per month unopened, capped
  return status * (1 + staleness);
}

/** Weighted random pick, skipping `exclude` when there's anything else. */
export function pickWander(items: Item[], exclude: string | null, rand = Math.random): Item | null {
  const pool = items.length > 1 ? items.filter((i) => i.id !== exclude) : items;
  const total = pool.reduce((s, i) => s + wanderWeight(i), 0);
  let r = rand() * total;
  for (const i of pool) {
    r -= wanderWeight(i);
    if (r <= 0) return i;
  }
  return pool[pool.length - 1] ?? null;
}

/** Things acquired on this calendar day in earlier years, most recent year first. */
export function onThisDay(items: Item[], today = new Date()): Item[] {
  return items
    .filter((i) => {
      const d = new Date(i.created_at);
      return d.getMonth() === today.getMonth() && d.getDate() === today.getDate() && d.getFullYear() < today.getFullYear();
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
