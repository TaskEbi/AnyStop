/** To-do list changes. Every write goes through `commit`, so it is local-first and syncs. */
import { checkTodo } from '../features/todo/todos';
import { uuid } from '../lib/random';
import { commit, data } from './store';
import type { Todo, TodoPriority } from './types';

const now = () => new Date().toISOString();

export interface TodoDraft {
  title: string;
  priority: TodoPriority;
  due: string | null;
}

export function addTodo(draft: TodoDraft): Todo | { error: string } {
  const checked = checkTodo(draft.title, draft.due);
  if ('error' in checked) return checked;
  const t = now();
  const todo: Todo = { id: uuid(), ...checked, priority: draft.priority, done_at: null, created_at: t, updated_at: t, deleted_at: null };
  commit('todos', [todo]);
  return todo;
}

export function updateTodo(id: string, draft: TodoDraft): string | null {
  const prev = data.get().todos.get(id);
  if (!prev || prev.deleted_at) return 'That to-do has gone.';
  const checked = checkTodo(draft.title, draft.due);
  if ('error' in checked) return checked.error;
  commit('todos', [{ ...prev, ...checked, priority: draft.priority, updated_at: now() }]);
  return null;
}

/** Tick or untick. */
export function setTodoDone(id: string, done: boolean) {
  const prev = data.get().todos.get(id);
  if (!prev || prev.deleted_at || !!prev.done_at === done) return;
  const t = now();
  commit('todos', [{ ...prev, done_at: done ? t : null, updated_at: t }]);
}

/** Returns the deletion time, which `restoreTodo` needs for undo. */
export function deleteTodo(id: string): string | null {
  const prev = data.get().todos.get(id);
  if (!prev || prev.deleted_at) return null;
  const t = now();
  commit('todos', [{ ...prev, deleted_at: t, updated_at: t }]);
  return t;
}

export function restoreTodo(id: string, deletedAt: string) {
  const prev = data.get().todos.get(id);
  if (prev?.deleted_at === deletedAt) commit('todos', [{ ...prev, deleted_at: null, updated_at: now() }]);
}

/** Remove every finished to-do at once; returns their ids and the deletion time for undo. */
export function clearDoneTodos(): { ids: string[]; at: string } | null {
  const done = [...data.get().todos.values()].filter((t) => t.done_at && !t.deleted_at);
  if (!done.length) return null;
  const at = now();
  commit('todos', done.map((t) => ({ ...t, deleted_at: at, updated_at: at })));
  return { ids: done.map((t) => t.id), at };
}

export function restoreTodos(ids: string[], deletedAt: string) {
  const todos = data.get().todos;
  commit('todos', ids.flatMap((id) => (todos.get(id)?.deleted_at === deletedAt ? [{ ...todos.get(id)!, deleted_at: null, updated_at: now() }] : [])));
}
