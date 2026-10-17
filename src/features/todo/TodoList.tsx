import { useState } from 'react';
import { deleteTodo, restoreTodo, setTodoDone } from '../../data/todoActions';
import { toast } from '../../data/ui';
import type { Todo } from '../../data/types';
import { Icon } from '../../ui/Icon';
import { TodoForm } from './TodoForm';
import { dueLabel, PRIORITY_LABEL } from './todos';

function remove(todo: Todo) {
  const t = deleteTodo(todo.id);
  if (t) toast(`Removed “${todo.title}”`, { label: 'Undo', run: () => restoreTodo(todo.id, t) });
}

function Row({ todo, today, editing, onEdit }: { todo: Todo; today: string; editing: boolean; onEdit: (id: string | null) => void }) {
  if (editing) {
    return (
      <li className="todo-row todo-row--editing">
        <TodoForm editing={todo} onDone={() => onEdit(null)} />
      </li>
    );
  }
  const done = !!todo.done_at;
  const due = todo.due ? dueLabel(todo.due, today, done) : null;
  return (
    <li className={`todo-row todo-row--${todo.priority}`} data-done={done || undefined}>
      <label className="todo-check">
        <input type="checkbox" checked={done} onChange={(e) => setTodoDone(todo.id, e.target.checked)} aria-label={`${todo.title}: done`} />
        <span className="todo-check__box" aria-hidden="true">
          <Icon name="check" size={14} />
        </span>
      </label>
      <div className="todo-row__main">
        <span className="todo-row__title">{todo.title}</span>
        {(due || todo.priority !== 'normal') && (
          <span className="todo-row__meta type">
            {todo.priority !== 'normal' && <span className={`todo-tag todo-tag--${todo.priority}`}>{PRIORITY_LABEL[todo.priority]}</span>}
            {due && <span className={`todo-due todo-due--${due.tone}`}>{due.text}</span>}
          </span>
        )}
      </div>
      <div className="todo-row__tools">
        <button type="button" className="btn btn--ghost btn--icon" aria-label={`Edit ${todo.title}`} onClick={() => onEdit(todo.id)}>
          <Icon name="edit" size={16} />
        </button>
        <button type="button" className="btn btn--ghost btn--icon" aria-label={`Delete ${todo.title}`} onClick={() => remove(todo)}>
          <Icon name="trash" size={16} />
        </button>
      </div>
    </li>
  );
}

export function TodoList({ todos, today }: { todos: Todo[]; today: string }) {
  const [editId, setEditId] = useState<string | null>(null);
  return (
    <ul className="todo-list">
      {todos.map((t) => (
        <Row key={t.id} todo={t} today={today} editing={editId === t.id} onEdit={setEditId} />
      ))}
    </ul>
  );
}
