import { useState, type CSSProperties, type FormEvent } from 'react';
import { setGoal } from '../../data/logActions';
import { toast } from '../../data/ui';
import { formatMinutes, parseDuration, splitMinutes } from './duration';
import { goalFor, goalProgress, topLevel } from './stats';
import { topicColour, useGoals, useTopics } from './useLog';
import { MAX_GOAL_MINUTES } from './validate';

function GoalEditor({ topicId, current, monday, onClose }: { topicId: string; current: number | null; monday: string; onClose: () => void }) {
  const start = current ? splitMinutes(current) : { hours: '', minutes: '' };
  const [hours, setHours] = useState(start.hours);
  const [minutes, setMinutes] = useState(start.minutes || '');
  const [error, setError] = useState<string | null>(null);

  function save(e: FormEvent) {
    e.preventDefault();
    const parsed = parseDuration(hours, minutes, MAX_GOAL_MINUTES);
    if ('error' in parsed) return setError(parsed.error === 'Enter how long, at least 1 minute.' ? 'A goal needs some time in it.' : parsed.error);
    const problem = setGoal(topicId, parsed.minutes, monday);
    if (problem) return setError(problem);
    onClose();
  }

  return (
    <form className="goal-editor" onSubmit={save}>
      <label className="duration-field">
        <input className="input" inputMode="numeric" pattern="[0-9]*" placeholder="0" value={hours} maxLength={3} aria-label="Goal hours" onChange={(e) => setHours(e.target.value.replace(/\D/g, ''))} autoFocus />
        <span>hr</span>
      </label>
      <label className="duration-field">
        <input className="input" inputMode="numeric" pattern="[0-9]*" placeholder="0" value={minutes} maxLength={2} aria-label="Goal minutes" onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} />
        <span>min</span>
      </label>
      <span className="goal-editor__per type">a week</span>
      <button type="submit" className="btn btn--primary btn--small">
        Save
      </button>
      <button type="button" className="btn btn--small" onClick={onClose}>
        Cancel
      </button>
      {error && (
        <p className="entry-form__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

/**
 * Weekly goals for the week starting `monday`: actual / target, %, time to go (or extra).
 * Goals can only be changed on the current week; a change carries forward to later weeks
 * and never rewrites earlier ones.
 */
export function GoalCards({ monday, editable, minutesByTopic }: { monday: string; editable: boolean; minutesByTopic: Map<string, number> }) {
  const topics = useTopics();
  const goals = useGoals();
  const [editing, setEditing] = useState<string | null>(null);

  // Active topics, plus archived ones that have time this week (shown with a label, no goal).
  const shown = topLevel(topics.values()).filter((t) => !t.archived_at || (minutesByTopic.get(t.id) ?? 0) > 0);
  if (!shown.length) return <p className="log-quiet">Add topics to set weekly goals.</p>;

  return (
    <ul className="goal-cards">
      {shown.map((t) => {
        const actual = minutesByTopic.get(t.id) ?? 0;
        const target = t.archived_at ? null : goalFor(goals.values(), t.id, monday);
        const p = target ? goalProgress(actual, target) : null;
        return (
          <li key={t.id} className={`goal-card ${p?.reached ? 'is-reached' : ''}`} style={{ '--c': topicColour(topics, t.id) } as CSSProperties}>
            <div className="goal-card__head">
              <span className="goal-card__name">
                <span className="topic-bars__swatch" aria-hidden="true" />
                {t.name}
                {t.archived_at && <span className="topic-chip__tag">archived</span>}
              </span>
              {p && <span className="goal-card__pct type">{p.pct}%</span>}
            </div>
            {p && target ? (
              <>
                <div
                  className="goal-card__track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(100, p.pct)}
                  aria-valuetext={`${formatMinutes(actual)} of ${formatMinutes(target)}, ${p.pct}%`}
                  aria-label={`${t.name} weekly goal`}
                >
                  <span className="goal-card__fill" style={{ width: `${p.fill * 100}%` }} />
                </div>
                <p className="goal-card__text">
                  <span>
                    <strong>{formatMinutes(actual)}</strong> / {formatMinutes(target)}
                  </span>
                  <span className="goal-card__left">
                    {p.reached ? (p.extra ? `Goal reached · ${formatMinutes(p.extra)} extra` : 'Goal reached') : `${formatMinutes(p.remaining)} to go`}
                  </span>
                </p>
              </>
            ) : (
              <p className="goal-card__text">
                <span>
                  <strong>{formatMinutes(actual)}</strong> this week
                </span>
                {!t.archived_at && <span className="goal-card__left">No goal</span>}
              </p>
            )}
            {editable && !t.archived_at && (
              editing === t.id ? (
                <GoalEditor topicId={t.id} current={target} monday={monday} onClose={() => setEditing(null)} />
              ) : (
                <div className="goal-card__tools">
                  <button type="button" className="btn btn--small btn--ghost" onClick={() => setEditing(t.id)}>
                    {target ? 'Change goal' : 'Set a weekly goal'}
                  </button>
                  {target && (
                    <button
                      type="button"
                      className="btn btn--small btn--ghost"
                      onClick={() => {
                        setGoal(t.id, null, monday);
                        toast(`Goal removed for ${t.name}`, { label: 'Undo', run: () => setGoal(t.id, target, monday) });
                      }}
                    >
                      Remove goal
                    </button>
                  )}
                </div>
              )
            )}
          </li>
        );
      })}
    </ul>
  );
}
