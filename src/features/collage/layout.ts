import type { Item, Room } from '../../data/types';
import { estimateCardHeight } from '../../lib/cardSize';

export const CARD_W = 220;
const GAP = 34;
const PAD = 48;
const HEADER = 96;
const ROW_MAX = 2900;
const CLUSTER_GAP = 150;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Group {
  key: string; // room id or 'unsorted'
  room: Room | null;
  items: Item[];
}

/** Items grouped by room, in room order, Unsorted last. */
export function groupByRoom(items: Item[], rooms: Map<string, Room>): Group[] {
  const byKey = new Map<string, Item[]>();
  for (const i of items) {
    const key = i.room_id && rooms.has(i.room_id) ? i.room_id : 'unsorted';
    byKey.set(key, [...(byKey.get(key) ?? []), i]);
  }
  const ordered = [...rooms.values()].sort((a, b) => a.sort_order - b.sort_order);
  const groups: Group[] = ordered.filter((r) => byKey.has(r.id)).map((r) => ({ key: r.id, room: r, items: byKey.get(r.id)! }));
  if (byKey.has('unsorted')) groups.push({ key: 'unsorted', room: null, items: byKey.get('unsorted')! });
  return groups;
}

/**
 * The automatic spread: each room is a small masonry cluster, clusters flow in rows.
 * Uses estimated heights so it never shifts when real sizes are measured.
 */
export function autoLayout(groups: Group[]): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const g of groups) {
    const items = [...g.items].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const cols = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(items.length * 1.1))));
    const width = PAD * 2 + cols * CARD_W + (cols - 1) * GAP;
    if (x > 0 && x + width > ROW_MAX) {
      x = 0;
      y += rowH + CLUSTER_GAP;
      rowH = 0;
    }
    const heights = new Array(cols).fill(0);
    for (const item of items) {
      const c = heights.indexOf(Math.min(...heights));
      pos.set(item.id, { x: x + PAD + c * (CARD_W + GAP), y: y + HEADER + heights[c] });
      heights[c] += estimateCardHeight(item, CARD_W) + GAP + 8;
    }
    rowH = Math.max(rowH, HEADER + Math.max(...heights) + PAD);
    x += width + CLUSTER_GAP;
  }
  return pos;
}

/** The paper mat behind a room: wraps wherever its cards actually are. */
export function matRect(rects: Rect[]): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return { x: x0 - PAD, y: y0 - HEADER, w: x1 - x0 + PAD * 2, h: y1 - y0 + HEADER + PAD };
}

export function union(rects: Rect[]): Rect {
  if (!rects.length) return { x: 0, y: 0, w: 800, h: 600 };
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
