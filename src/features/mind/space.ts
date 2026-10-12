import type { Connection, Item, Kind, Room, RoomColor } from '../../data/types';

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface SpaceNode extends Point3 {
  id: string;
  label: string;
  color: RoomColor | 'none';
  room: boolean;
  /** Size in world units. */
  radius: number;
  /** The room node this belongs to (a room node points at itself). */
  group: string;
  kind?: Kind;
  favourite?: boolean;
  /** Room nodes: how far out their exhibits sit. */
  orbit?: number;
  /** Room nodes: how many exhibits. */
  count?: number;
}

export interface SpaceLink {
  a: string;
  b: string;
  /** A string I tied (otherwise the faint spoke from a room to its exhibit). */
  string: boolean;
  label?: string | null;
}

export interface Space {
  nodes: SpaceNode[];
  links: SpaceLink[];
  byId: Map<string, SpaceNode>;
  /** Exhibits tied to each exhibit by strings. */
  strings: Map<string, string[]>;
  /** Radius of the whole constellation. */
  extent: number;
}

const GOLDEN = 2.399963229728653; // golden angle, radians
const roomNodeId = (key: string) => `room:${key}`;

/**
 * Each room is a planet with its exhibits in a cloud around it, and the rooms
 * sit on a wide ring like an orrery. Deterministic: the same collection always
 * gives the same constellation, whatever order the items arrive in.
 */
export function buildSpace(items: Item[], rooms: Map<string, Room>, connections: Connection[]): Space {
  const groups = new Map<string, Item[]>();
  for (const key of rooms.keys()) groups.set(key, []);
  groups.set('', []);
  for (const item of items) {
    const key = item.room_id && rooms.has(item.room_id) ? item.room_id : '';
    groups.get(key)!.push(item);
  }
  const keys = [...groups.keys()].filter((k) => groups.get(k)!.length);
  const cloud = (n: number) => 60 + Math.sqrt(n) * 16;
  const widest = Math.max(0, ...keys.map((k) => cloud(groups.get(k)!.length)));
  const ring = keys.length <= 1 ? 0 : Math.max(220, (widest * 2.3) / (2 * Math.sin(Math.PI / keys.length)));

  const nodes: SpaceNode[] = [];
  const links: SpaceLink[] = [];
  keys.forEach((key, index) => {
    const room = rooms.get(key);
    const group = groups.get(key)!.sort((a, b) => a.id.localeCompare(b.id));
    const n = group.length;
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / keys.length;
    const centre = { x: Math.cos(angle) * ring, y: Math.sin(index * 2.4) * ring * 0.16, z: Math.sin(angle) * ring };
    const id = roomNodeId(key);
    const orbit = cloud(n);
    nodes.push({
      ...centre,
      id,
      label: room?.name ?? 'Unsorted',
      color: room?.color ?? 'none',
      room: true,
      radius: 15 + Math.min(10, Math.sqrt(n) * 1.5),
      group: id,
      orbit,
      count: n,
    });
    group.forEach((item, i) => {
      // Fibonacci sphere directions; bigger rooms fill out into a ball rather than a shell.
      const y = 1 - (2 * (i + 0.5)) / n;
      const flat = Math.sqrt(1 - y * y);
      const theta = i * GOLDEN + index;
      const r = n <= 12 ? orbit : orbit * (0.45 + 0.55 * Math.cbrt((i * 0.6180339887) % 1));
      nodes.push({
        id: item.id,
        label: item.title || 'Untitled',
        color: room?.color ?? 'none',
        room: false,
        radius: item.favourite ? 7.5 : 6,
        group: id,
        kind: item.kind,
        favourite: item.favourite,
        x: centre.x + Math.cos(theta) * flat * r,
        y: centre.y + y * r * 0.8,
        z: centre.z + Math.sin(theta) * flat * r,
      });
      links.push({ a: id, b: item.id, string: false });
    });
  });

  const ids = new Set(items.map((i) => i.id));
  const strings = new Map<string, string[]>();
  const add = (a: string, b: string) => {
    const list = strings.get(a);
    if (list) list.push(b);
    else strings.set(a, [b]);
  };
  for (const c of connections) {
    if (c.deleted_at || !ids.has(c.item_a) || !ids.has(c.item_b)) continue;
    links.push({ a: c.item_a, b: c.item_b, string: true, label: c.label });
    add(c.item_a, c.item_b);
    add(c.item_b, c.item_a);
  }
  const extent = Math.max(220, ...nodes.map((n) => Math.hypot(n.x, n.y, n.z) + n.radius + 30));
  return { nodes, links, byId: new Map(nodes.map((n) => [n.id, n])), strings, extent };
}

/** What lights up with a node: an exhibit's room and strings, or a room's exhibits. */
export function neighbourhood(space: Space, id: string): Set<string> {
  const node = space.byId.get(id);
  const set = new Set([id]);
  if (!node) return set;
  if (node.room) {
    for (const n of space.nodes) if (n.group === id) set.add(n.id);
  } else {
    set.add(node.group);
    for (const other of space.strings.get(id) ?? []) set.add(other);
  }
  return set;
}

// ─── camera ─────────────────────────────────────────────────────────────────

export interface Camera {
  yaw: number;
  pitch: number;
  zoom: number;
  /** The point the camera orbits around and looks at. */
  target: Point3;
  /** Screen offset (px) so a target can sit left of a drawer. */
  shift: number;
  /** Screen offset (px) so a target can sit above the placard on a phone. */
  rise: number;
}

export const HOME: Camera = { yaw: -0.5, pitch: 0.42, zoom: 1.45, target: { x: 0, y: 0, z: 0 }, shift: 0, rise: 0 };

export function rotate(p: Point3, yaw: number, pitch: number): Point3 {
  const x = p.x * Math.cos(yaw) + p.z * Math.sin(yaw);
  const z = -p.x * Math.sin(yaw) + p.z * Math.cos(yaw);
  return { x, y: p.y * Math.cos(pitch) - z * Math.sin(pitch), z: p.y * Math.sin(pitch) + z * Math.cos(pitch) };
}

/** The inverse of rotate: camera-space directions back into the world. */
export function unrotate(p: Point3, yaw: number, pitch: number): Point3 {
  const y = p.y * Math.cos(pitch) + p.z * Math.sin(pitch);
  const z1 = -p.y * Math.sin(pitch) + p.z * Math.cos(pitch);
  return { x: p.x * Math.cos(yaw) - z1 * Math.sin(yaw), y, z: p.x * Math.sin(yaw) + z1 * Math.cos(yaw) };
}

export interface Projected {
  x: number;
  y: number;
  /** Depth: negative is nearer the viewer. */
  z: number;
  /** Pixels per world unit at that depth. */
  s: number;
}

/** Perspective projection for one frame; `base` is pixels per world unit at the target's depth. */
export function projector(cam: Camera, extent: number, width: number, height: number) {
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const distance = extent * 3;
  const base = (Math.min(width, height) / (extent * 2.15)) * cam.zoom;
  const cx = width / 2 - cam.shift;
  const cyScreen = height / 2 - cam.rise;
  const t = cam.target;
  const project = (p: Point3): Projected => {
    const px = p.x - t.x;
    const py = p.y - t.y;
    const pz = p.z - t.z;
    const x = px * cy + pz * sy;
    const z1 = -px * sy + pz * cy;
    const y = py * cp - z1 * sp;
    const z = py * sp + z1 * cp;
    const s = (base * distance) / (distance + z);
    return { x: cx + x * s, y: cyScreen + y * s, z, s };
  };
  return { project, base, cx, cy: cyScreen };
}

/** Kept for the tests and anything that wants a one-off projection. */
export function project(p: Point3, yaw: number, pitch: number, zoom: number, extent: number, width: number, height: number) {
  const { x, y, z, s } = projector({ ...HOME, yaw, pitch, zoom }, extent, width, height).project(p);
  return { x, y, z, scale: s };
}

/** The yaw that turns a node's side of its room towards the viewer (so it isn't hidden behind the cloud). */
export function facingYaw(node: Point3, centre: Point3): number {
  return Math.atan2(node.x - centre.x, -(node.z - centre.z));
}

// ─── guided tour ────────────────────────────────────────────────────────────

/**
 * Next stop on a tour: follow a string to somewhere new, else stay in the room,
 * else cross to another room. Null once everything has been seen.
 */
export function nextStop(space: Space, from: string | null, seen: Set<string>, rand = Math.random): string | null {
  const fresh = (ids: string[]) => ids.filter((id) => !seen.has(id));
  const pick = (ids: string[]) => ids[Math.floor(rand() * ids.length)];
  const items = space.nodes.filter((n) => !n.room);
  if (from) {
    const tied = fresh(space.strings.get(from) ?? []);
    if (tied.length) return pick(tied);
    const group = space.byId.get(from)?.group;
    const roommates = fresh(items.filter((n) => n.group === group).map((n) => n.id));
    if (roommates.length) return pick(roommates);
  }
  const rest = fresh(items.map((n) => n.id));
  return rest.length ? pick(rest) : null;
}
