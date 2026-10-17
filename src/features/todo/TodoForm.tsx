import { useRef, useState, type FormEvent } from 'react';
import { addTodo, updateTodo } from '../../data/todoActions';
import { TODO_PRIORITIES, type Todo, type TodoPriority } from '../../data/types';
import { Icon } from '../../ui/Icon';
import { MAX_TODO_TITLE, PRIORITY_LABEL } from './todos';

interface Props {
  /** Editing an existing to-do rather than adding one. */
  editing?: Todo;
  /** After saving or cancelling an edit. */
  onDone?: () => void;
}

/** One line to say what, plus a priority and an optional day. Used for adding and for editing in place. */
export function TodoForm({ editing, onDone }: Props) {
  const [title, setTitle] = useState(editing?.title ?? '');
  const [priority, setPriority] = useState<TodoPriority>(editing?.priority ?? 'normal');
  const [due, setDue] = useState(editing?.due ?? '');
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const draft = { title, priority, due: due || null };
    if (editing) {
      const problem = updateTodo(editing.id, draft);
      if (problem) return setError(problem);
      onDone?.();
      return;
    }
    const made = addTodo(draft);
    if ('error' in made) return setError(made.error);
    setError(null);
    setTitle('');
    setDue('');
    // Ready for the next one, without popping a phone keyboard up uninvited.
    if (window.matchMedia('(pointer: fine)').matches) titleRef.current?.focus();
  }

  return (
    <form className="todo-form" onSubmit={submit} noValidate onKeyDown={(e) => e.key === 'Escape' && editing && onDone?.()}>
      <input
        ref={titleRef}
        className="input todo-form__title"
        value={title}
        maxLength={MAX_TODO_TITLE}
        placeholder="Something I want to do…"
        aria-label={editing ? 'What to do' : 'Add a to-do'}
        autoFocus={!!editing}
        autoComplete="off"
        onChange={(e) => {
          setTitle(e.target.value);
          setError(null);
        }}
      />
      <div className="todo-form__row">
        <label className="field todo-form__field">
          <span>Priority</span>
          <select className="select" value={priority} onChange={(e) => setPriority(e.target.value as TodoPriority)}>
            {TODO_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="field todo-form__field">
          <span>Due (optional)</span>
          <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <div className="todo-form__actions">
          <button type="submit" className="btn btn--primary">
            {editing ? (
              'Save'
            ) : (
              <>
                <Icon name="plus" size={16} /> Add
              </>
            )}
          </button>
          {editing && (
            <button type="button" className="btn" onClick={onDone}>
              Cancel
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="todo-form__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
