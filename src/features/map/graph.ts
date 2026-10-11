import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';
import type { Connection, Item, Kind, Room, RoomColor } from '../../data/types';

export interface GNode extends SimulationNodeDatum {
  id: string;
  type: 'room' | 'item' | 'tag';
  label: string;
  color: RoomColor | null;
  kind?: Kind;
  favourite?: boolean;
  r: number;
}

export interface GLink extends SimulationLinkDatum<GNode> {
  id: string;
  type: 'room' | 'string' | 'tag';
  label?: string | null;
}

export const UNSORTED = 'room:unsorted';

/** Where every node was last seen, so switching views or changing data never scrambles the map. */
const remembered = new Map<string, { x: number; y: number }>();
const live = new Map<string, GNode>();

export function rememberPositions(nodes: GNode[]) {
  for (const n of nodes) if (n.x != null && n.y != null) remembered.set(n.id, { x: n.x, y: n.y });
}

/**
 * Nodes for rooms (with something visible in them), items and, optionally, tags shared by
 * two or more items. Node objects are reused across rebuilds so positions and velocities carry over.
 */
export function buildGraph(items: Item[], rooms: Map<string, Room>, connections: Connection[], withTags: boolean) {
  const nodes: GNode[] = [];
  const links: GLink[] = [];
  const reuse = (id: string, make: () => GNode, near?: { x: number; y: number }): GNode => {
    const prev = live.get(id);
    const fresh = make();
    const node = prev ? Object.assign(prev, { ...fresh, x: prev.x, y: prev.y, vx: prev.vx, vy: prev.vy }) : fresh;
    if (node.x == null) {
      const pos = remembered.get(id) ?? (near ? { x: near.x + (Math.random() - 0.5) * 80, y: near.y + (Math.random() - 0.5) * 80 } : undefined);
      if (pos) Object.assign(node, pos);
    }
    live.set(id, node);
    nodes.push(node);
    return node;
  };

  const roomCount = new Map<string, number>();
  for (const i of items) {
    const key = i.room_id && rooms.has(i.room_id) ? i.room_id : UNSORTED;
    roomCount.set(key, (roomCount.get(key) ?? 0) + 1);
  }
  const roomNodes = new Map<string, GNode>();
  let ring = 0;
  const ringCount = roomCount.size;
  for (const [key, count] of roomCount) {
    const room = key === UNSORTED ? null : rooms.get(key)!;
    const angle = (ring++ / Math.max(ringCount, 1)) * Math.PI * 2;
    const id = key === UNSORTED ? UNSORTED : `room:${key}`;
    roomNodes.set(
      key,
      reuse(id, () => ({ id, type: 'room', label: room?.name ?? 'Unsorted', color: room?.color ?? null, r: 30 + Math.sqrt(count) * 5 }), {
        x: Math.cos(angle) * 320,
        y: Math.sin(angle) * 320,
      }),
    );
  }

  const itemIds = new Set<string>();
  for (const i of items) {
    const roomNode = roomNodes.get(i.room_id && rooms.has(i.room_id) ? i.room_id : UNSORTED)!;
    reuse(i.id, () => ({ id: i.id, type: 'item', label: i.title || 'Untitled', color: roomNode.color, kind: i.kind, favourite: i.favourite, r: 9 }), roomNode as { x: number; y: number });
    itemIds.add(i.id);
    links.push({ id: `r:${i.id}`, source: i.id, target: roomNode.id, type: 'room' });
  }

  for (const c of connections) {
    if (itemIds.has(c.item_a) && itemIds.has(c.item_b)) links.push({ id: c.id, source: c.item_a, target: c.item_b, type: 'string', label: c.label });
  }

  if (withTags) {
    const byTag = new Map<string, string[]>();
    for (const i of items) for (const t of i.tags) byTag.set(t, [...(byTag.get(t) ?? []), i.id]);
    for (const [tag, ids] of byTag) {
      if (ids.length < 2) continue;
      const id = `tag:${tag}`;
      reuse(id, () => ({ id, type: 'tag', label: `#${tag}`, color: null, r: 14 }), live.get(ids[0]) as { x: number; y: number } | undefined);
      for (const itemId of ids) links.push({ id: `t:${tag}:${itemId}`, source: itemId, target: id, type: 'tag' });
    }
  }

  return { nodes, links };
}

export function bounds(nodes: GNode[]) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const n of nodes) {
    x0 = Math.min(x0, (n.x ?? 0) - n.r);
    y0 = Math.min(y0, (n.y ?? 0) - n.r);
    x1 = Math.max(x1, (n.x ?? 0) + n.r);
    y1 = Math.max(y1, (n.y ?? 0) + n.r + 18);
  }
  return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: -200, y: -200, w: 400, h: 400 };
}
