import { useState } from 'react';
import { tie } from '../../data/actions';
import { data } from '../../data/store';
import { toast, ui } from '../../data/ui';
import { useStore } from '../../lib/createStore';

/** After picking two ends in tie mode: an optional label, then tie. */
export function TiePrompt({ a, b, onDone }: { a: string; b: string; onDone: () => void }) {
  const [label, setLabel] = useState('');
  const titleA = useStore(data, (s) => s.items.get(a)?.title ?? '');
  const titleB = useStore(data, (s) => s.items.get(b)?.title ?? '');
  return (
    <form
      className="tie-prompt"
      onSubmit={(e) => {
        e.preventDefault();
        tie(a, b, label.trim() || null);
        toast('String tied');
        ui.set({ tying: { from: null } });
        onDone();
      }}
    >
      <p className="tie-prompt__ends">
        <span>{titleA}</span>
        <span className="tie-prompt__thread" aria-hidden="true" />
        <span>{titleB}</span>
      </p>
      <div className="tie-prompt__row">
        <input
          className="input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="label, e.g. same idea (optional)"
          aria-label="String label"
          list="tie-labels"
          maxLength={60}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onDone();
            }
          }}
        />
        <datalist id="tie-labels">
          {['same idea', 'made by', 'inspired', 'see also', 'builds on', 'contradicts'].map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
        <button type="submit" className="btn btn--primary">
          Tie
        </button>
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Banner while tie mode is on. */
export function TieHint({ picked }: { picked: boolean }) {
  return (
    <p className="tie-hint type" role="status">
      {picked ? 'Now click the other end' : 'Tie a string: click the first item'}
      <button type="button" className="btn btn--small" onClick={() => ui.set({ tying: null })}>
        Done
      </button>
    </p>
  );
}
