import { describe, expect, it } from 'vitest';
import { buildSpace, facingYaw, neighbourhood, nextStop, project, projector, rotate, unrotate, HOME } from './space';
import type { Connection, Item, Room } from '../../data/types';

const item = (id: string, room_id: string | null = null) => ({ id, room_id, title: id, kind: 'note', favourite: false }) as Item;
const room = { id: 'r1', name: 'Ideas', color: 'sage' } as Room;

describe('3D constellation', () => {
  it('groups visible exhibits and excludes strings with missing or deleted endpoints', () => {
    const connections = [
      { item_a: 'a', item_b: 'b' },
      { item_a: 'a', item_b: 'hidden' },
      { item_a: 'a', item_b: 'b', deleted_at: '2026-01-01' },
    ] as Connection[];
    const space = buildSpace([item('a', 'r1'), item('b', 'missing')], new Map([['r1', room]]), connections);
    expect(space.nodes.filter((n) => n.room).map((n) => n.label).sort()).toEqual(['Ideas', 'Unsorted']);
    expect(space.links.filter((l) => l.string)).toHaveLength(1);
    expect(space.links.every((l) => space.byId.has(l.a) && space.byId.has(l.b))).toBe(true);
    expect(space.strings.get('a')).toEqual(['b']);
  });

  it('keeps positions deterministic when item order changes and handles an empty collection', () => {
    const a = item('a');
    const b = item('b');
    expect(buildSpace([a, b], new Map(), []).nodes).toEqual(buildSpace([b, a], new Map(), []).nodes);
    const empty = buildSpace([], new Map(), []);
    expect(empty.nodes).toEqual([]);
    expect(empty.extent).toBe(220);
  });

  it('keeps big rooms from overlapping', () => {
    const rooms = new Map(['r1', 'r2', 'r3'].map((id) => [id, { ...room, id }]));
    const items = ['r1', 'r2', 'r3'].flatMap((r) => Array.from({ length: 300 }, (_, i) => item(`${r}-${i}`, r)));
    const centres = buildSpace(items, rooms, []).nodes.filter((n) => n.room);
    for (const c of centres) {
      for (const d of centres) {
        if (c !== d) expect(Math.hypot(c.x - d.x, c.y - d.y, c.z - d.z)).toBeGreaterThan(c.orbit! + d.orbit!);
      }
    }
  });

  it('lights up an exhibit with its room and strings, and a room with its exhibits', () => {
    const space = buildSpace([item('a', 'r1'), item('b', 'r1'), item('c')], new Map([['r1', room]]), [
      { item_a: 'a', item_b: 'c' } as Connection,
    ]);
    expect([...neighbourhood(space, 'a')].sort()).toEqual(['a', 'c', 'room:r1']);
    expect([...neighbourhood(space, 'room:r1')].sort()).toEqual(['a', 'b', 'room:r1']);
  });
});

describe('camera', () => {
  it('rotates through real depth and projects farther points smaller', () => {
    const rotated = rotate({ x: 100, y: 0, z: 0 }, Math.PI / 2, 0);
    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.z).toBeCloseTo(-100);
    const near = project({ x: 0, y: 0, z: -100 }, 0, 0, 1, 300, 800, 600);
    const far = project({ x: 0, y: 0, z: 100 }, 0, 0, 1, 300, 800, 600);
    expect(near.scale).toBeGreaterThan(far.scale);
    expect(near.x).toBe(400);
    expect(near.y).toBe(300);
  });

  it('unrotate undoes rotate', () => {
    const p = { x: 12, y: -40, z: 77 };
    const back = unrotate(rotate(p, 0.7, -0.3), 0.7, -0.3);
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
    expect(back.z).toBeCloseTo(p.z);
  });

  it('puts the target in the middle of the screen, nudged left by the drawer shift', () => {
    const target = { x: 50, y: 20, z: -30 };
    const { project: at } = projector({ ...HOME, target, shift: 100 }, 300, 800, 600);
    const p = at(target);
    expect(p.x).toBeCloseTo(300);
    expect(p.y).toBeCloseTo(300);
  });

  it('facingYaw turns a node to the near side of its room', () => {
    const centre = { x: 0, y: 0, z: 0 };
    for (const node of [{ x: 30, y: 0, z: 5 }, { x: -10, y: 4, z: 40 }, { x: 0, y: 0, z: -25 }]) {
      const yaw = facingYaw(node, centre);
      expect(rotate(node, yaw, 0).z).toBeLessThan(0);
    }
  });
});

describe('guided tour', () => {
  const space = buildSpace(
    [item('a', 'r1'), item('b', 'r1'), item('c'), item('d')],
    new Map([['r1', room]]),
    [{ item_a: 'a', item_b: 'd' } as Connection],
  );
  it('follows strings first, then stays in the room, then moves on, and ends', () => {
    const seen = new Set(['a']);
    expect(nextStop(space, 'a', seen)).toBe('d');
    seen.add('d');
    expect(nextStop(space, 'd', seen)).toBe('c');
    seen.add('c');
    expect(nextStop(space, 'c', seen)).toBe('b');
    seen.add('b');
    expect(nextStop(space, 'b', seen)).toBeNull();
  });
});
