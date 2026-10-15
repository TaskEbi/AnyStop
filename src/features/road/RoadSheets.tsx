import { useState } from 'react';
import { addEntry, createTopic } from '../../data/logActions';
import { data } from '../../data/store';
import { DEFAULT_DRAGON_URL, type RoadStageId } from '../../data/types';
import { useStore } from '../../lib/createStore';
import { Sheet } from '../../ui/Sheet';
import { isDate, shortDay } from '../daily-log/dates';
import { formatMinutes, parseDuration } from '../daily-log/duration';
import { topLevel } from '../daily-log/stats';
import { useTopics } from '../daily-log/useLog';
import { MAX_NOTE } from '../daily-log/validate';
import { dragonBase, fetchDragon, forgetDragon, type DragonSummary } from './dragon';
import { STAGE_INFO, stageWhen } from './rules';
import { setRoad } from './setRoad';

const QUICK = [10, 25, 45, 60, 90, 120];
const SUGGESTED_TOPIC = 'Competitive programming';

/** Pick the Daily Log topic that counts as training, or make the suggested one. */
function TopicPicker({ id }: { id: string }) {
  const topics = useTopics();
  const current = useStore(data, (s) => s.settings.road.topic_id);
  const active = topLevel(topics.values(), true);
  const [error, setError] = useState<string | null>(null);
  const hasSuggested = active.some((t) => t.name.toLowerCase() === SUGGESTED_TOPIC.toLowerCase());
  return (
    <div className="road-form__group">
      <label className="field" htmlFor={id}>
        <span>Daily Log topic for training</span>
        <select id={id} className="input" value={current ?? ''} onChange={(e) => setRoad({ topic_id: e.target.value || null })}>
          <option value="">Choose a topic…</option>
          {active.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {!hasSuggested && (
        <button
          type="button"
          className="btn btn--small"
          onClick={() => {
            const made = createTopic(SUGGESTED_TOPIC);
            if ('error' in made) setError(made.error);
            else setRoad({ topic_id: made.id });
          }}
        >
          New topic: {SUGGESTED_TOPIC}
        </button>
      )}
      <p className="road-form__hint">Sessions saved on Road to IOI go into this topic, and its Daily Log entries count as training days.</p>
      {error && <p className="road-form__error">{error}</p>}
    </div>
  );
}

/** "Submit session": minutes and what clicked, saved as a Daily Log entry. */
export function SessionSheet({ today, linked, onClose, onSaved }: { today: string; linked: boolean; onClose: () => void; onSaved: (minutes: number, note: string) => void }) {
  const topicId = useStore(data, (s) => s.settings.road.topic_id);
  const topics = useTopics();
  const topic = topicId ? topics.get(topicId) : undefined;
  const usable = !!topic && !topic.deleted_at && !topic.archived_at;
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!usable) return setError('Choose the topic these sessions go into first.');
    const parsed = parseDuration(hours, minutes);
    if ('error' in parsed) return setError(parsed.error);
    setBusy(true);
    const saved = addEntry({ date: today, topic_id: topicId!, subcategory_id: null, minutes: parsed.minutes, note: note.trim() || null });
    if ('error' in saved) {
      setBusy(false);
      return setError(saved.error);
    }
    onSaved(parsed.minutes, note.trim());
  }

  return (
    <Sheet title="Submit session" onClose={onClose} variant="bottom" className="road-sheet">
      <form className="road-form" onSubmit={submit}>
        {!usable && <TopicPicker id="road-session-topic" />}
        <fieldset className="road-form__group">
          <legend className="field-label">Minutes trained</legend>
          <div className="road-dur">
            <label className="road-dur__field">
              <input id="road-hours" className="input" inputMode="numeric" pattern="[0-9]*" placeholder="0" maxLength={2} value={hours} onChange={(e) => setHours(e.target.value.replace(/\D/g, ''))} aria-label="Hours" />
              <span>hr</span>
            </label>
            <label className="road-dur__field">
              <input
                id="road-minutes"
                className="input"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                maxLength={2}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))}
                aria-label="Minutes"
                data-autofocus
              />
              <span>min</span>
            </label>
          </div>
          <div className="chips" aria-label="Quick durations">
            {QUICK.map((m) => (
              <button
                key={m}
                type="button"
                className="chip"
                aria-pressed={Number(hours || 0) * 60 + Number(minutes || 0) === m}
                onClick={() => {
                  setHours(m >= 60 ? String(Math.floor(m / 60)) : '');
                  setMinutes(String(m % 60));
                }}
              >
                {formatMinutes(m)}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="field" htmlFor="road-note">
          <span>What clicked today?</span>
          <textarea id="road-note" className="input" rows={3} maxLength={MAX_NOTE} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Saw why the greedy fails when two intervals tie." />
        </label>
        {linked && <p className="road-form__hint">Results you record in DragonCode count by themselves. Log here what you did anywhere else.</p>}
        {error && (
          <p className="road-form__error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="road-submit" disabled={busy}>
          Submit ▸
        </button>
      </form>
    </Sheet>
  );
}

/** A stage card: its date, target and reason, and once cleared, the day and the memory. */
export function StageSheet({ id, today, dragonData, onClose }: { id: RoadStageId; today: string; dragonData: DragonSummary | null; onClose: () => void }) {
  const stage = useStore(data, (s) => s.settings.road.stages[id]);
  const fromDragon = !stage.date ? stageWhen(id, stage, dragonData, today) : null;
  const [date, setDate] = useState(stage.date ?? fromDragon?.date ?? '');
  const [time, setTime] = useState(stage.time ?? fromDragon?.time ?? '');
  const [target, setTarget] = useState(stage.target);
  const [reason, setReason] = useState(stage.reason);
  const [cleared, setCleared] = useState(!!stage.cleared_on);
  const [clearedOn, setClearedOn] = useState(stage.cleared_on ?? (stage.date && stage.date <= today ? stage.date : today));
  const [memory, setMemory] = useState(stage.memory);
  const [error, setError] = useState<string | null>(null);
  const info = STAGE_INFO[id];

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (date && !isDate(date)) return setError('That date is not valid.');
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return setError('Use a time like 13:00.');
    if (cleared && (!isDate(clearedOn) || clearedOn > today)) return setError('The day you qualified is today or earlier.');
    const road = data.get().settings.road;
    setRoad({
      stages: {
        ...road.stages,
        [id]: { date: date || null, time: date && time ? time : null, target: target.trim(), reason: reason.trim(), cleared_on: cleared ? clearedOn : null, memory: cleared ? memory.trim() : stage.memory },
      },
    });
    onClose();
  }

  return (
    <Sheet title={`${info.letter} · ${info.name}`} onClose={onClose} className="road-sheet">
      <form className="road-form" onSubmit={save}>
        <div className="road-form__row">
          <label className="field" htmlFor="road-stage-date">
            <span>Contest day</span>
            <input id="road-stage-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field" htmlFor="road-stage-time">
            <span>Starts (Japan time)</span>
            <input id="road-stage-time" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} disabled={!date} />
          </label>
        </div>
        {fromDragon && <p className="road-form__hint">Filled in from your DragonCode targets. Save to keep it here.</p>}
        <label className="field" htmlFor="road-stage-target">
          <span>My target</span>
          <input id="road-stage-target" className="input" maxLength={200} value={target} onChange={(e) => setTarget(e.target.value)} placeholder={id === 'ioi' ? 'A medal' : 'Qualify with room to spare'} />
        </label>
        <label className="field" htmlFor="road-stage-reason">
          <span>Why this stage matters to me</span>
          <textarea id="road-stage-reason" className="input" rows={2} maxLength={MAX_NOTE} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <label className="road-form__check">
          <input type="checkbox" checked={cleared} onChange={(e) => setCleared(e.target.checked)} />
          <span>I qualified (stage cleared)</span>
        </label>
        {cleared && (
          <>
            <label className="field" htmlFor="road-stage-cleared">
              <span>The day I qualified</span>
              <input id="road-stage-cleared" type="date" className="input" max={today} value={clearedOn} onChange={(e) => setClearedOn(e.target.value)} />
            </label>
            <label className="field" htmlFor="road-stage-memory">
              <span>The moment, in one line</span>
              <textarea id="road-stage-memory" className="input" rows={2} maxLength={MAX_NOTE} value={memory} onChange={(e) => setMemory(e.target.value)} />
            </label>
          </>
        )}
        {stage.cleared_on && stage.memory && !cleared && <p className="road-form__hint">Unticking keeps the memory: “{stage.memory}”.</p>}
        {error && (
          <p className="road-form__error" role="alert">
            {error}
          </p>
        )}
        <div className="road-form__actions">
          <button type="submit" className="btn btn--primary">
            Save {info.short}
          </button>
          {stage.cleared_on && <span className="road-form__hint">AC · {shortDay(stage.cleared_on)}</span>}
        </div>
      </form>
    </Sheet>
  );
}

export type SetupFocus = 'why' | 'topic' | 'dragon';

/** The page's settings: my why, the training topic and the DragonCode link. */
export function SetupSheet({ focus, onClose }: { focus: SetupFocus; onClose: () => void }) {
  const road = useStore(data, (s) => s.settings.road);
  const [why, setWhy] = useState(road.why);
  const [url, setUrl] = useState(road.dragon_url || DEFAULT_DRAGON_URL);
  const [key, setKey] = useState(road.dragon_key);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  async function link(e: React.FormEvent) {
    e.preventDefault();
    const base = dragonBase(url);
    if (!base) return setStatus({ ok: false, text: 'Use the DragonCode address starting with https://' });
    if (!key.trim()) return setStatus({ ok: false, text: 'Paste the key from DragonCode → Settings → Road to IOI link.' });
    setTesting(true);
    const error = await fetchDragon(base, key.trim());
    setTesting(false);
    if (error) return setStatus({ ok: false, text: error });
    setRoad({ dragon_url: base, dragon_key: key.trim() });
    setStatus({ ok: true, text: 'Linked. Your DragonCode training now counts here.' });
  }

  return (
    <Sheet title="Road to IOI settings" onClose={onClose} className="road-sheet">
      <div className="road-form">
        <form
          className="road-form__group"
          onSubmit={(e) => {
            e.preventDefault();
            setRoad({ why: why.trim() });
            onClose();
          }}
        >
          <label className="field" htmlFor="road-why">
            <span>Why do I want this?</span>
            <textarea id="road-why" className="input" rows={2} maxLength={300} value={why} onChange={(e) => setWhy(e.target.value)} data-autofocus={focus === 'why' ? true : undefined} placeholder="One sentence, in your own words." />
          </label>
          <button type="submit" className="btn btn--primary">
            Save my why
          </button>
        </form>

        <TopicPicker id="road-topic" />

        <form className="road-form__group" onSubmit={link}>
          <h3 className="field-label">DragonCode link</h3>
          <p className="road-form__hint">
            In DragonCode, open Settings → Road to IOI link and copy the key. The page reads your days, results, reflections and upsolve queue. It can't change anything there.
          </p>
          <label className="field" htmlFor="road-dragon-url">
            <span>DragonCode address</span>
            <input id="road-dragon-url" className="input" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <label className="field" htmlFor="road-dragon-key">
            <span>Link key</span>
            <input
              id="road-dragon-key"
              className="input"
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="dc1.…"
              data-autofocus={focus === 'dragon' ? true : undefined}
            />
          </label>
          <div className="road-form__actions">
            <button type="submit" className="btn btn--primary" disabled={testing}>
              {testing ? 'Checking…' : road.dragon_key ? 'Save and check' : 'Link DragonCode'}
            </button>
            {road.dragon_key && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setRoad({ dragon_key: '' });
                  forgetDragon();
                  setKey('');
                  setStatus({ ok: true, text: 'Unlinked. The DragonCode copy on this device is gone too.' });
                }}
              >
                Unlink
              </button>
            )}
          </div>
          {status && (
            <p className={status.ok ? 'road-form__ok' : 'road-form__error'} role="status">
              {status.text}
            </p>
          )}
        </form>
      </div>
    </Sheet>
  );
}
