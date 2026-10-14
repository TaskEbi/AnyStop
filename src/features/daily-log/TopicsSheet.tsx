import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import {
  addStarterTopics,
  archiveTopic,
  createTopic,
  moveTopic,
  recolourTopic,
  renameTopic,
  restoreTopic,
  setLogTimezone,
} from '../../data/logActions';
import { data } from '../../data/store';
import { toast, ui } from '../../data/ui';
import { ROOM_COLORS, type LogTopic } from '../../data/types';
import { useStore } from '../../lib/createStore';
import { Icon } from '../../ui/Icon';
import { COLOR_LABEL, tapeVar } from '../../ui/labels';
import { Sheet } from '../../ui/Sheet';
import { timeZones, todayIn } from './dates';
import { childrenOf, topLevel } from './stats';
import { useTopics } from './useLog';

/** A name field that saves on blur/Enter and puts the old name back if the new one is refused. */
function NameField({ topic, label }: { topic: LogTopic; label: string }) {
  const [name, setName] = useState(topic.name);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="topic-name">
      <input
        className={`input ${topic.parent_id ? '' : 'hand topic-name--top'}`}
        value={name}
        maxLength={60}
        aria-label={label}
        disabled={!!topic.archived_at}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        onBlur={() => {
          const problem = renameTopic(topic.id, name);
          if (problem) {
            setError(problem);
            setName(topic.name);
          }
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      {error && (
        <span className="entry-form__error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

function AddForm({ parentId, placeholder }: { parentId: string | null; placeholder: string }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  function add(e: FormEvent) {
    e.preventDefault();
    const made = createTopic(name, parentId);
    if ('error' in made) return setError(made.error);
    setName('');
    setError(null);
  }
  return (
    <form className={`topic-add ${parentId ? 'topic-add--sub' : ''}`} onSubmit={add}>
      <input className="input" value={name} placeholder={placeholder} aria-label={placeholder} maxLength={60} onChange={(e) => setName(e.target.value)} />
      <button type="submit" className={`btn ${parentId ? 'btn--small' : 'btn--primary'}`} disabled={!name.trim()}>
        <Icon name="plus" size={15} /> Add
      </button>
      {error && (
        <span className="entry-form__error" role="alert">
          {error}
        </span>
      )}
    </form>
  );
}

function ArchiveButton({ topic }: { topic: LogTopic }) {
  if (topic.archived_at) {
    return (
      <button
        type="button"
        className="btn btn--small"
        onClick={() => {
          const problem = restoreTopic(topic.id);
          if (problem) toast(problem);
        }}
      >
        Restore
      </button>
    );
  }
  return (
    <button
      type="button"
      className="btn btn--small btn--ghost"
      onClick={() => {
        archiveTopic(topic.id);
        toast(`${topic.name} archived. Its time stays in your history.`, { label: 'Undo', run: () => restoreTopic(topic.id) });
      }}
    >
      Archive
    </button>
  );
}

function TopicCard({ topic, index, total }: { topic: LogTopic; index: number; total: number }) {
  const topics = useTopics();
  const subs = childrenOf(topics.values(), topic.id);
  const activeSubs = subs.filter((s) => !s.archived_at);
  const archivedSubs = subs.filter((s) => s.archived_at);
  const archived = !!topic.archived_at;

  return (
    <li className={`topic-card ${archived ? 'is-archived' : ''}`} style={{ '--swatch': tapeVar(topic.color) } as CSSProperties}>
      <span className="room-row__tape" aria-hidden="true" />
      <div className="topic-card__head">
        <NameField topic={topic} label="Topic name" />
        {!archived && (
          <div className="room-row__order">
            <button type="button" className="btn btn--ghost btn--icon" disabled={index === 0} onClick={() => moveTopic(topic.id, -1)} aria-label={`Move ${topic.name} up`}>
              <Icon name="up" size={16} />
            </button>
            <button type="button" className="btn btn--ghost btn--icon" disabled={index === total - 1} onClick={() => moveTopic(topic.id, 1)} aria-label={`Move ${topic.name} down`}>
              <Icon name="down" size={16} />
            </button>
          </div>
        )}
        <ArchiveButton topic={topic} />
      </div>
      {!archived && (
        <>
          <div className="room-row__colors" role="radiogroup" aria-label={`${topic.name} colour`}>
            {ROOM_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={topic.color === c}
                aria-label={COLOR_LABEL[c]}
                title={COLOR_LABEL[c]}
                className="room-row__color"
                style={{ '--c': tapeVar(c) } as CSSProperties}
                onClick={() => recolourTopic(topic.id, c)}
              />
            ))}
          </div>
          <ul className="topic-subs" aria-label={`${topic.name} subcategories`}>
            {activeSubs.map((s, i) => (
              <li key={s.id} className="topic-sub">
                <NameField topic={s} label="Subcategory name" />
                <button type="button" className="btn btn--ghost btn--icon" disabled={i === 0} onClick={() => moveTopic(s.id, -1)} aria-label={`Move ${s.name} up`}>
                  <Icon name="up" size={14} />
                </button>
                <ArchiveButton topic={s} />
              </li>
            ))}
            {archivedSubs.map((s) => (
              <li key={s.id} className="topic-sub is-archived">
                <span className="topic-sub__archived">{s.name}</span>
                <span className="topic-chip__tag">archived</span>
                <ArchiveButton topic={s} />
              </li>
            ))}
          </ul>
          <AddForm parentId={topic.id} placeholder={`Add a subcategory to ${topic.name}`} />
        </>
      )}
    </li>
  );
}

function TimezonePicker() {
  const tz = useStore(data, (s) => s.settings.log_timezone);
  const zones = useMemo(() => {
    const all = timeZones();
    return all.includes(tz) ? all : [tz, ...all];
  }, [tz]);
  return (
    <label className="field">
      <span>Time zone for “today” and weeks</span>
      <select
        className="select"
        value={tz}
        onChange={(e) => {
          setLogTimezone(e.target.value);
          toast(`Today is now ${todayIn(e.target.value)} in ${e.target.value}. Past entries keep their dates.`);
        }}
      >
        {zones.map((z) => (
          <option key={z} value={z}>
            {z.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Create, rename, recolour, reorder, archive and restore topics and their subcategories. */
export function TopicsSheet() {
  const topics = useTopics();
  const all = topLevel(topics.values());
  const active = all.filter((t) => !t.archived_at);
  const archived = all.filter((t) => t.archived_at);
  const close = () => ui.set({ logTopicsOpen: false });

  return (
    <Sheet title="Daily Log topics" onClose={close} className="log-sheet">
      <AddForm parentId={null} placeholder="New topic, e.g. Piano" />
      {active.length === 0 && (
        <div className="log-empty">
          <p>No topics yet. Start with a few:</p>
          <button type="button" className="btn" onClick={addStarterTopics}>
            Add Schoolwork, Violin and Sports
          </button>
        </div>
      )}
      <ul className="topic-cards">
        {active.map((t, i) => (
          <TopicCard key={t.id} topic={t} index={i} total={active.length} />
        ))}
      </ul>
      {archived.length > 0 && (
        <>
          <h3 className="log-subhead type">Archived</h3>
          <ul className="topic-cards">
            {archived.map((t, i) => (
              <TopicCard key={t.id} topic={t} index={i} total={archived.length} />
            ))}
          </ul>
        </>
      )}
      <div className="topics-settings">
        <TimezonePicker />
      </div>
    </Sheet>
  );
}
