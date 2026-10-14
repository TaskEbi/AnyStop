import { useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { addEntry, deleteEntry, restoreEntry, updateEntry } from '../../data/logActions';
import { toast, ui } from '../../data/ui';
import type { LogEntry } from '../../data/types';
import { Icon } from '../../ui/Icon';
import { formatMinutes, parseDuration, splitMinutes } from './duration';
import { childrenOf, topLevel } from './stats';
import { entryLabel, topicColour, useEntries, useTopics } from './useLog';
import { MAX_NOTE } from './validate';

const SHORTCUTS = [15, 30, 45, 60];
/** Clicking Save twice in quick succession must not log the session twice. */
const RESUBMIT_GUARD_MS = 800;

interface Props {
  today: string;
  /** The day being logged; Today keeps it in step with the day on show. */
  date: string;
  onDate: (date: string) => void;
  /** Editing an existing entry rather than adding one. */
  editing?: LogEntry;
  /** After saving an edit (or adding, from a sheet). */
  onDone?: () => void;
  /** Keep the form for another entry after adding (Today), or hand back (sheets). */
  stayOpen?: boolean;
}

/** Topic, optional subcategory, hours + minutes, a note: the quick manual entry. */
export function EntryForm({ today, date, onDate, editing, onDone, stayOpen = false }: Props) {
  const topics = useTopics();
  const entries = useEntries();
  const [topicId, setTopicId] = useState<string | null>(editing?.topic_id ?? null);
  const [subId, setSubId] = useState<string | null>(editing?.subcategory_id ?? null);
  const initial = editing ? splitMinutes(editing.minutes) : { hours: '', minutes: '' };
  const [hours, setHours] = useState(initial.hours);
  const [minutes, setMinutes] = useState(initial.minutes);
  const [note, setNote] = useState(editing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const lastSave = useRef(0);
  const hoursRef = useRef<HTMLInputElement>(null);

  // Most recently used topics first; the rest in their manual order.
  const lastUsed = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of entries.values()) if (!e.deleted_at && (m.get(e.topic_id) ?? '') < e.created_at) m.set(e.topic_id, e.created_at);
    return m;
  }, [entries]);
  const topicChoices = useMemo(() => {
    const active = topLevel(topics.values(), true);
    const sorted = [...active].sort((a, b) => (lastUsed.get(b.id) ?? '').localeCompare(lastUsed.get(a.id) ?? ''));
    // An edit may keep the archived topic it already has.
    const kept = editing && topics.get(editing.topic_id);
    if (kept?.archived_at) sorted.push(kept);
    return sorted;
  }, [topics, lastUsed, editing]);

  const subChoices = useMemo(() => {
    if (!topicId) return [];
    const subs = childrenOf(topics.values(), topicId, true);
    const kept = editing?.topic_id === topicId && editing.subcategory_id ? topics.get(editing.subcategory_id) : undefined;
    if (kept?.archived_at) subs.push(kept);
    return subs;
  }, [topics, topicId, editing]);

  // "Again" chips: the last few distinct topic + subcategory + duration combinations.
  const again = useMemo(() => {
    if (editing) return [];
    const seen = new Set<string>();
    const out: LogEntry[] = [];
    const recent = [...entries.values()].filter((e) => !e.deleted_at).sort((a, b) => b.created_at.localeCompare(a.created_at));
    for (const e of recent) {
      const t = topics.get(e.topic_id);
      const s = e.subcategory_id ? topics.get(e.subcategory_id) : null;
      if (!t || t.archived_at || t.deleted_at || (s && (s.archived_at || s.deleted_at))) continue;
      const key = `${e.topic_id}|${e.subcategory_id}|${e.minutes}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
      if (out.length === 4) break;
    }
    return out;
  }, [entries, topics, editing]);

  function pickTopic(id: string) {
    if (id !== topicId) setSubId(null);
    setTopicId(id);
    setError(null);
  }

  function setDuration(total: number) {
    const s = splitMinutes(total);
    setHours(s.hours);
    setMinutes(s.minutes);
    setError(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (Date.now() - lastSave.current < RESUBMIT_GUARD_MS) return;
    if (!topicId) return setError('Pick a topic.');
    const parsed = parseDuration(hours, minutes);
    if ('error' in parsed) return setError(parsed.error);
    const draft = { date, topic_id: topicId, subcategory_id: subId, minutes: parsed.minutes, note: note.trim() || null };

    if (editing) {
      const problem = updateEntry(editing.id, draft);
      if (problem) return setError(problem);
      lastSave.current = Date.now();
      toast('Entry updated');
      onDone?.();
      return;
    }
    const made = addEntry(draft);
    if ('error' in made) return setError(made.error);
    lastSave.current = Date.now();
    toast(`Logged ${entryLabel(topics, made)} · ${formatMinutes(made.minutes)}`, {
      label: 'Undo',
      run: () => {
        const t = deleteEntry(made.id);
        if (t) toast('Entry removed', { label: 'Redo', run: () => restoreEntry(made.id, t) });
      },
    });
    setError(null);
    setHours('');
    setMinutes('');
    setNote('');
    if (!stayOpen) onDone?.();
    // Ready for the next one, without popping a phone keyboard up uninvited.
    else if (window.matchMedia('(pointer: fine)').matches) hoursRef.current?.focus();
  }

  if (!topicChoices.length) {
    return (
      <div className="log-empty">
        <p>Add a topic first, like Schoolwork, Violin or Sports.</p>
        <button type="button" className="btn btn--primary" onClick={() => ui.set({ logTopicsOpen: true })}>
          <Icon name="plus" size={16} /> Set up topics
        </button>
      </div>
    );
  }

  const parsed = parseDuration(hours, minutes);
  const current = 'minutes' in parsed ? parsed.minutes : null;

  return (
    <form className="entry-form" onSubmit={submit} noValidate>
      {again.length > 0 && (
        <div className="entry-form__again" role="group" aria-label="Fill in from a recent entry">
          <span className="field-label">Again</span>
          <div className="chips">
            {again.map((e) => (
              <button
                key={e.id}
                type="button"
                className="chip topic-chip"
                style={{ '--c': topicColour(topics, e.topic_id) } as CSSProperties}
                onClick={() => {
                  setTopicId(e.topic_id);
                  setSubId(e.subcategory_id);
                  setDuration(e.minutes);
                }}
              >
                <span className="topic-chip__dot" aria-hidden="true" />
                {entryLabel(topics, e)} · {formatMinutes(e.minutes)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="entry-form__row">
        <label className="field entry-form__date">
          <span>Day</span>
          <input
            className="input"
            type="date"
            value={date}
            max={today}
            required
            onChange={(e) => {
              if (e.target.value) onDate(e.target.value > today ? today : e.target.value);
            }}
          />
        </label>
      </div>

      <fieldset className="entry-form__set">
        <legend className="field-label">Topic</legend>
        <div className="chips" role="radiogroup" aria-label="Topic">
          {topicChoices.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={topicId === t.id}
              className="chip topic-chip"
              style={{ '--c': topicColour(topics, t.id) } as CSSProperties}
              onClick={() => pickTopic(t.id)}
            >
              <span className="topic-chip__dot" aria-hidden="true" />
              {t.name}
              {t.archived_at && <span className="topic-chip__tag">archived</span>}
            </button>
          ))}
        </div>
      </fieldset>

      {subChoices.length > 0 && (
        <fieldset className="entry-form__set">
          <legend className="field-label">Subcategory (optional)</legend>
          <div className="chips" role="radiogroup" aria-label="Subcategory">
            <button type="button" role="radio" aria-checked={subId === null} className="chip" onClick={() => setSubId(null)}>
              None
            </button>
            {subChoices.map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={subId === s.id} className="chip" onClick={() => setSubId(s.id)}>
                {s.name}
                {s.archived_at && <span className="topic-chip__tag">archived</span>}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="entry-form__set">
        <legend className="field-label">How long</legend>
        <div className="entry-form__duration">
          <label className="duration-field">
            <input
              ref={hoursRef}
              className="input"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={hours}
              maxLength={2}
              onChange={(e) => setHours(e.target.value.replace(/[^\d]/g, ''))}
              aria-label="Hours"
            />
            <span>hr</span>
          </label>
          <label className="duration-field">
            <input
              className="input"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={minutes}
              maxLength={2}
              onChange={(e) => setMinutes(e.target.value.replace(/[^\d]/g, ''))}
              aria-label="Minutes"
            />
            <span>min</span>
          </label>
          <div className="chips" aria-label="Quick durations">
            {SHORTCUTS.map((m) => (
              <button key={m} type="button" className="chip" aria-pressed={current === m} onClick={() => setDuration(m)}>
                {m === 60 ? '1 hr' : `${m} min`}
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      <label className="field entry-form__note">
        <span>Note (optional)</span>
        <input
          className="input"
          value={note}
          maxLength={MAX_NOTE}
          placeholder="What you worked on"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {error && (
        <p className="entry-form__error" role="alert">
          {error}
        </p>
      )}

      <div className="entry-form__actions">
        <button type="submit" className="btn btn--primary entry-form__save">
          {editing ? 'Save changes' : current ? `Log ${formatMinutes(current)}` : 'Log it'}
        </button>
        {editing && onDone && (
          <button type="button" className="btn" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
