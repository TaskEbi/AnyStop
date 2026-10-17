import { useMemo } from 'react';
import { clearDoneTodos, restoreTodos } from '../../data/todoActions';
import { data } from '../../data/store';
import { setTodoShow, setTodoSort, toast, ui } from '../../data/ui';
import { useStore } from '../../lib/createStore';
import { plural } from '../../lib/format';
import { InlineConfirm } from '../../ui/InlineConfirm';
import { useToday } from '../daily-log/useLog';
import { TodoForm } from './TodoForm';
import { TodoList } from './TodoList';
import { TODO_SHOWS, TODO_SORTS, TODO_SORT_LABEL, todoCounts, visibleTodos, type TodoShow, type TodoSort } from './todos';
import './todo.css';

const EMPTY: Record<TodoShow, string> = {
  open: 'Nothing left to do. Add something above, or look at what you finished.',
  done: 'Nothing finished yet.',
  all: 'Nothing here yet. Add the first thing you want to do.',
};

/** The To-do section: add things you want to do, tick them off, and order the list how you like. */
export function TodoSection() {
  const todos = useStore(data, (s) => s.todos);
  const sort = useStore(ui, (s) => s.todoSort);
  const show = useStore(ui, (s) => s.todoShow);
  const today = useToday();
  const counts = useMemo(() => todoCounts(todos.values()), [todos]);
  const list = useMemo(() => visibleTodos(todos.values(), show, sort), [todos, show, sort]);

  const label = (s: TodoShow) => (s === 'open' ? `Open · ${counts.open}` : s === 'done' ? `Done · ${counts.done}` : `All · ${counts.open + counts.done}`);

  return (
    <main className="todo" id="main">
      <section className="todo-card" aria-label="To-do list">
        <h2 className="todo-card__title hand">To-do list</h2>
        <TodoForm />

        <div className="todo-controls">
          <div className="chips" role="radiogroup" aria-label="Show">
            {TODO_SHOWS.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={show === s} className="chip" onClick={() => setTodoShow(s)}>
                {label(s)}
              </button>
            ))}
          </div>
          <label className="todo-sort type">
            <span>Sort</span>
            <select className="select" value={sort} onChange={(e) => setTodoSort(e.target.value as TodoSort)}>
              {TODO_SORTS.map((s) => (
                <option key={s} value={s}>
                  {TODO_SORT_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {list.length ? <TodoList todos={list} today={today} /> : <p className="todo-empty">{EMPTY[show]}</p>}

        {counts.done > 0 && show !== 'open' && (
          <div className="todo-footer">
            <InlineConfirm
              label="Clear finished"
              className="btn btn--small"
              message={`Remove ${plural(counts.done, 'finished to-do')}?`}
              confirmLabel="Clear"
              onConfirm={() => {
                const cleared = clearDoneTodos();
                if (cleared) toast(`Cleared ${plural(cleared.ids.length, 'finished to-do')}`, { label: 'Undo', run: () => restoreTodos(cleared.ids, cleared.at) });
              }}
            />
          </div>
        )}
      </section>
    </main>
  );
}
