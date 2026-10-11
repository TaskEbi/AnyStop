import { describe, expect, it } from 'vitest';
import type { Item } from './types';
import { onThisDay, pickWander, wanderWeight } from './wander';

const base: Item = {
  id: 'a', kind: 'link', title: 'A', url: null, creator: null, body: null, note: null, room_id: null, tags: [],
  status: 'none', favourite: false, image_path: null, preview: null, accession_no: 1, collage_pos: null, is_example: false,
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', last_opened_at: null, deleted_at: null,
};
const now = Date.parse('2026-10-11T12:00:00Z');

describe('wander', () => {
  it('weights Up next and long-unopened things higher', () => {
    const fresh = wanderWeight({ ...base, last_opened_at: '2026-10-11T00:00:00Z' }, now);
    const upNext = wanderWeight({ ...base, status: 'up_next', last_opened_at: '2026-10-11T00:00:00Z' }, now);
    const stale = wanderWeight({ ...base, last_opened_at: '2026-04-01T00:00:00Z' }, now);
    const done = wanderWeight({ ...base, status: 'done', last_opened_at: '2026-10-11T00:00:00Z' }, now);
    expect(upNext).toBeGreaterThan(fresh);
    expect(stale).toBeGreaterThan(fresh);
    expect(done).toBeLessThan(fresh);
  });

  it('never picks the excluded item when there is a choice', () => {
    const items = [base, { ...base, id: 'b' }];
    for (let i = 0; i < 20; i++) expect(pickWander(items, 'a')?.id).toBe('b');
  });

  it('finds things saved on this day in earlier years', () => {
    const items = [
      { ...base, id: 'old', created_at: '2024-10-11T09:00:00' },
      { ...base, id: 'today', created_at: '2026-10-11T09:00:00' },
      { ...base, id: 'other', created_at: '2025-10-12T09:00:00' },
    ];
    expect(onThisDay(items, new Date('2026-10-11T12:00:00')).map((i) => i.id)).toEqual(['old']);
  });
});
