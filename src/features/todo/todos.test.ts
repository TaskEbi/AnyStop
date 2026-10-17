import { describe, expect, it } from 'vitest';
import type { Todo } from '../../data/types';
import { validTodos } from '../../data/backup';
import { checkTodo, dueLabel, MAX_TODO_TITLE, todoCounts, visibleTodos } from './todos';

const T = '2026-10-17T00:00:00Z';
let seq = 0;
const todo = (title: string, extra: Partial<Todo> = {}): Todo => ({
  id: `t${++seq}`,
  title,
  priority: 'normal',
  due: null,
  done_at: null,
  created_at: `2026-10-17T00:00:${String(seq).padStart(2, '0')}Z`,
  updated_at: T,
  deleted_at: null,
  ...extra,
});
const titles = (list: Todo[]) => list.map((t) => t.title);

describe('sorting the to-do list', () => {
  const a = todo('Banana', { priority: 'low', due: '2026-10-20' });
  const b = todo('apple', { priority: 'high' });
  const c = todo('Cherry', { priority: 'normal', due: '2026-10-18' });
  const d = todo('Date', { priority: 'high', due: '2026-10-25' });
  const all = [a, b, c, d];

  it('newest and oldest follow when it was added', () => {
    expect(titles(visibleTodos(all, 'open', 'newest'))).toEqual(['Date', 'Cherry', 'apple', 'Banana']);
    expect(titles(visibleTodos(all, 'open', 'oldest'))).toEqual(['Banana', 'apple', 'Cherry', 'Date']);
  });
  it('priority puts high first, then the sooner due date, then the newer', () => {
    expect(titles(visibleTodos(all, 'open', 'priority'))).toEqual(['Date', 'apple', 'Cherry', 'Banana']);
  });
  it('due date puts the soonest first and undated last', () => {
    expect(titles(visibleTodos(all, 'open', 'due'))).toEqual(['Cherry', 'Banana', 'Date', 'apple']);
  });
  it('A to Z ignores case', () => {
    expect(titles(visibleTodos(all, 'open', 'az'))).toEqual(['apple', 'Banana', 'Cherry', 'Date']);
  });
  it('does not reorder the list it is given', () => {
    const copy = [...all];
    visibleTodos(all, 'open', 'az');
    expect(all).toEqual(copy);
  });
});

describe('filtering the to-do list', () => {
  const open1 = todo('open one');
  const done1 = todo('done one', { done_at: T });
  const gone = todo('deleted', { deleted_at: T });
  const open2 = todo('open two');
  const list = [open1, done1, gone, open2];

  it('shows open, done, or everything with finished ones at the bottom', () => {
    expect(titles(visibleTodos(list, 'open', 'oldest'))).toEqual(['open one', 'open two']);
    expect(titles(visibleTodos(list, 'done', 'oldest'))).toEqual(['done one']);
    expect(titles(visibleTodos(list, 'all', 'oldest'))).toEqual(['open one', 'open two', 'done one']);
  });
  it('never shows deleted items, and counts exclude them', () => {
    expect(visibleTodos(list, 'all', 'newest').some((t) => t.deleted_at)).toBe(false);
    expect(todoCounts(list)).toEqual({ open: 2, done: 1 });
  });
});

describe('checking a to-do', () => {
  it('trims and tidies the title', () => {
    expect(checkTodo('  buy   milk ', null)).toEqual({ title: 'buy milk', due: null });
  });
  it('rejects empty and over-long titles', () => {
    expect(checkTodo('   ', null)).toHaveProperty('error');
    expect(checkTodo('x'.repeat(MAX_TODO_TITLE + 1), null)).toHaveProperty('error');
    expect(checkTodo('x'.repeat(MAX_TODO_TITLE), null)).toHaveProperty('title');
  });
  it('accepts real dates only, and treats blank as no deadline', () => {
    expect(checkTodo('x', '2026-10-20')).toEqual({ title: 'x', due: '2026-10-20' });
    expect(checkTodo('x', '2026-02-30')).toHaveProperty('error');
    expect(checkTodo('x', 'soon')).toHaveProperty('error');
    expect(checkTodo('x', '')).toEqual({ title: 'x', due: null });
  });
});

describe('due labels', () => {
  const today = '2026-10-17';
  it('calls out today, tomorrow and overdue', () => {
    expect(dueLabel('2026-10-17', today, false)).toEqual({ text: 'Today', tone: 'soon' });
    expect(dueLabel('2026-10-18', today, false)).toEqual({ text: 'Tomorrow', tone: 'soon' });
    expect(dueLabel('2026-10-16', today, false)).toEqual({ text: 'Overdue · Yesterday', tone: 'overdue' });
    expect(dueLabel('2026-10-10', today, false)).toEqual({ text: 'Overdue · Sat 10 Oct', tone: 'overdue' });
    expect(dueLabel('2026-10-25', today, false)).toEqual({ text: 'Sun 25 Oct', tone: 'later' });
  });
  it('a finished item is never overdue or urgent', () => {
    expect(dueLabel('2026-10-10', today, true).tone).toBe('later');
    expect(dueLabel('2026-10-17', today, true).tone).toBe('later');
  });
});

describe('restoring to-dos from a backup', () => {
  it('older exports have none', () => {
    expect(validTodos({})).toEqual([]);
    expect(validTodos({ todos: 'nope' as unknown as Todo[] })).toEqual([]);
  });
  it('keeps good ones, tidies titles and drops damaged ones', () => {
    const good = todo('  tidy   me ', { due: '2026-10-20', done_at: '2026-10-16T08:00:00Z' });
    const badPriority = { ...todo('x'), priority: 'urgent' } as unknown as Todo;
    const badDue = todo('y', { due: '2026-13-40' });
    const noTitle = todo('   ');
    const badDone = todo('z', { done_at: 'yesterday' });
    const kept = validTodos({ todos: [good, badPriority, badDue, noTitle, badDone, null as unknown as Todo] });
    expect(kept.map((t) => t.title)).toEqual(['tidy me', 'z']);
    expect(kept[0]).toMatchObject({ due: '2026-10-20', done_at: '2026-10-16T08:00:00Z' });
    expect(kept[1].done_at).toBeNull();
  });
});
