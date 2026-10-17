import { TODO_PRIORITIES, type Todo, type TodoPriority } from '../../data/types';
import { addDays, isDate, relativeDay } from '../daily-log/dates';

export const MAX_TODO_TITLE = 200;

export const TODO_SORTS = ['newest', 'oldest', 'priority', 'due', 'az'] as const;
export type TodoSort = (typeof TODO_SORTS)[number];

export const TODO_SORT_LABEL: Record<TodoSort, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  priority: 'Priority',
  due: 'Due date',
  az: 'A to Z',
};

export const TODO_SHOWS = ['open', 'done', 'all'] as const;
export type TodoShow = (typeof TODO_SHOWS)[number];

export const PRIORITY_LABEL: Record<TodoPriority, string> = { high: 'High', normal: 'Normal', low: 'Low' };

const rank = (p: TodoPriority) => TODO_PRIORITIES.indexOf(p);
const newestFirst = (a: Todo, b: Todo) => b.created_at.localeCompare(a.created_at);
/** Soonest first; no date goes last. */
const byDue = (a: Todo, b: Todo) => (a.due ?? '9999').localeCompare(b.due ?? '9999');

const COMPARE: Record<TodoSort, (a: Todo, b: Todo) => number> = {
  newest: newestFirst,
  oldest: (a, b) => a.created_at.localeCompare(b.created_at),
  priority: (a, b) => rank(a.priority) - rank(b.priority) || byDue(a, b) || newestFirst(a, b),
  due: (a, b) => byDue(a, b) || rank(a.priority) - rank(b.priority) || newestFirst(a, b),
  az: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || newestFirst(a, b),
};

/** What to show, in the chosen order. With everything on show, finished ones sink to the bottom. */
export function visibleTodos(todos: Iterable<Todo>, show: TodoShow, sort: TodoSort): Todo[] {
  const list = [...todos].filter((t) => !t.deleted_at && (show === 'all' || (show === 'done') === !!t.done_at));
  const cmp = COMPARE[sort];
  return list.sort((a, b) => Number(!!a.done_at) - Number(!!b.done_at) || cmp(a, b));
}

export function todoCounts(todos: Iterable<Todo>): { open: number; done: number } {
  let open = 0;
  let done = 0;
  for (const t of todos) {
    if (t.deleted_at) continue;
    if (t.done_at) done++;
    else open++;
  }
  return { open, done };
}

/** Trimmed title and a checked due date, or a message to show. */
export function checkTodo(title: string, due: string | null): { title: string; due: string | null } | { error: string } {
  const clean = title.trim().replace(/\s+/g, ' ');
  if (!clean) return { error: 'Write what you want to do.' };
  if (clean.length > MAX_TODO_TITLE) return { error: `Keep it under ${MAX_TODO_TITLE} characters.` };
  if (due && !isDate(due)) return { error: 'That due date is not a real day.' };
  return { title: clean, due: due || null };
}

export type DueTone = 'overdue' | 'soon' | 'later';

/** "Today", "Tomorrow", "Mon 20 Oct"; overdue and today's stand out. A finished item is never overdue. */
export function dueLabel(due: string, today: string, done: boolean): { text: string; tone: DueTone } {
  if (!done && due < today) return { text: `Overdue · ${relativeDay(due, today)}`, tone: 'overdue' };
  if (due === today) return { text: 'Today', tone: done ? 'later' : 'soon' };
  if (due === addDays(today, 1)) return { text: 'Tomorrow', tone: done ? 'later' : 'soon' };
  return { text: relativeDay(due, today), tone: 'later' };
}
