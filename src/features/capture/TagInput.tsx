import { useId, useState, type KeyboardEvent } from 'react';
import { normaliseTags } from '../../data/actions';

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}

/** Tags as chips; Enter or comma adds, Backspace on empty removes, suggestions from existing tags. */
export function TagInput({ value, onChange, suggestions }: Props) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const id = useId();
  const q = text.trim().toLowerCase().replace(/^#/, '');
  const matches = !focused ? [] : suggestions.filter((t) => !value.includes(t) && (!q || t.includes(q))).slice(0, 8);

  const add = (raw: string) => {
    const next = normaliseTags([...value, ...raw.split(',')]);
    if (next.length !== value.length) onChange(next);
    setText('');
  };

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && q) {
      if (e.key !== 'Tab') e.preventDefault();
      add(text);
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="tag-input">
      <div className="tag-input__box">
        {value.map((t) => (
          <span key={t} className="chip tag-input__chip">
            #{t}
            <button type="button" className="tag-input__remove" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove tag ${t}`}>
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          className="tag-input__field"
          value={text}
          onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setText(e.target.value))}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (q) add(text);
          }}
          placeholder={value.length ? '' : 'Add tags…'}
          aria-label="Add a tag"
          autoComplete="off"
        />
      </div>
      {matches.length > 0 && (
        <div className="chips tag-input__suggest" aria-label="Existing tags">
          {matches.map((t) => (
            <button key={t} type="button" className="chip" onMouseDown={(e) => e.preventDefault()} onClick={() => add(t)}>
              + #{t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
