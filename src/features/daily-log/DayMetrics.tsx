import { useState, type FocusEvent, type KeyboardEvent } from 'react';
import { setMetric } from '../../data/logActions';
import { toast } from '../../data/ui';
import type { LogMetric } from '../../data/types';
import { Icon, type IconName } from '../../ui/Icon';
import { tapeVar } from '../../ui/labels';
import { addDays } from './dates';
import { MINUTES, type Scale } from './charts';
import { formatMinutes, MAX_ENTRY_MINUTES, parseDuration, splitMinutes } from './duration';
import { metricByDay, metricSummary } from './stats';
import { useMetrics } from './useLog';
import { MAX_SLEEP_SCORE } from './validate';

export const METRICS: Record<LogMetric, { label: string; colour: string; scale: Scale }> = {
  sleep: { label: 'Sleep', colour: tapeVar('navy'), scale: MINUTES },
  sleep_score: {
    label: 'Sleep score',
    colour: tapeVar('plum'),
    scale: { ticks: [0, 25, 50, 75, 100], short: String, long: (n) => `${n} / ${MAX_SLEEP_SCORE}` },
  },
  screen: { label: 'Screen time', colour: tapeVar('teal'), scale: MINUTES },
};

type TimeMetric = Exclude<LogMetric, 'sleep_score'>;
const COUNTERS: Record<TimeMetric, { icon: IconName; step: number; start: number }> = {
  // + on an empty sleep counter starts from a usual night rather than crawling up from 15 min.
  sleep: { icon: 'moon', step: 15, start: 8 * 60 },
  screen: { icon: 'screen', step: 15, start: 15 },
};

const AVERAGE_DAYS = 7;

/** Save (or with null, clear) a day's value; clearing offers Undo. Returns a problem, if any. */
function storeMetric(metric: LogMetric, date: string, next: number | null, prev: number | null): string | null {
  const problem = setMetric(metric, date, next);
  if (!problem && next == null && prev != null) {
    toast(`${METRICS[metric].label} cleared`, { label: 'Undo', run: () => setMetric(metric, date, prev) });
  }
  return problem;
}

/** Follow the stored value when it changes underneath (another day, a stepper, another device). */
function useFollow(key: string, reset: () => void) {
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    reset();
  }
}

/** Both fields blank when nothing is set; a set value always shows its hours, even 0. */
const toFields = (minutes: number | null) => (minutes == null ? { hours: '', minutes: '' } : { ...splitMinutes(minutes), hours: String(Math.floor(minutes / 60)) });

function Counter({ metric, date, today, value, average }: { metric: TimeMetric; date: string; today: string; value: number | null; average: number | null }) {
  const info = { ...METRICS[metric], ...COUNTERS[metric] };
  const [fields, setFields] = useState(() => toFields(value));
  const [error, setError] = useState<string | null>(null);
  useFollow(`${date}|${value ?? ''}`, () => {
    setFields(toFields(value));
    setError(null);
  });

  const blank = !fields.hours.trim() && !fields.minutes.trim();
  const parsed = blank ? null : parseDuration(fields.hours, fields.minutes, MAX_ENTRY_MINUTES, 0);
  const typed = parsed && 'minutes' in parsed ? parsed.minutes : null;

  const store = (minutes: number | null) => setError(storeMetric(metric, date, minutes, value));

  function save() {
    if (blank) {
      if (value != null) store(null);
      return;
    }
    if (parsed && 'error' in parsed) return setError(parsed.error);
    if (typed !== value) store(typed);
  }

  function step(delta: number) {
    const base = typed ?? value;
    const next = base == null ? (delta > 0 ? info.start : null) : Math.min(MAX_ENTRY_MINUTES, Math.max(0, base + delta));
    if (next != null) store(next);
  }

  // Typing saves once focus leaves the counter (or on Enter), not on every keystroke.
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) save();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      setFields(toFields(value));
      setError(null);
    }
  };

  const night = date === today ? 'last night' : 'the night before';
  const current = typed ?? value;

  return (
    <div className="metric" role="group" aria-label={info.label} onBlur={onBlur}>
      <span className="metric__icon" style={{ color: info.colour }} aria-hidden="true">
        <Icon name={info.icon} size={22} />
      </span>
      <div className="metric__head">
        <div className="metric__title">
          <span className="metric__label">{info.label}</span>
          <span className="metric__sub type">
            {metric === 'sleep' ? night : date === today ? 'today' : 'that day'}
            {average != null && ` · ${AVERAGE_DAYS}-day avg ${formatMinutes(average)}`}
          </span>
        </div>
        {value != null && (
          <button type="button" className="btn btn--small btn--ghost" onClick={() => store(null)}>
            Clear
          </button>
        )}
      </div>
      <div className="metric__controls">
        <button
          type="button"
          className="btn btn--ghost btn--icon metric__step"
          onClick={() => step(-info.step)}
          disabled={current == null || current === 0}
          aria-label={`${info.label}: ${info.step} minutes less`}
        >
          <Icon name="minus" size={18} />
        </button>
        <label className="duration-field">
          <input
            className="input"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="–"
            value={fields.hours}
            maxLength={2}
            onChange={(e) => setFields({ ...fields, hours: e.target.value.replace(/[^\d]/g, '') })}
            onKeyDown={onKeyDown}
            aria-label={`${info.label} hours`}
          />
          <span>hr</span>
        </label>
        <label className="duration-field">
          <input
            className="input"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="–"
            value={fields.minutes}
            maxLength={2}
            onChange={(e) => setFields({ ...fields, minutes: e.target.value.replace(/[^\d]/g, '') })}
            onKeyDown={onKeyDown}
            aria-label={`${info.label} minutes`}
          />
          <span>min</span>
        </label>
        <button
          type="button"
          className="btn btn--ghost btn--icon metric__step"
          onClick={() => step(info.step)}
          disabled={current != null && current >= MAX_ENTRY_MINUTES}
          aria-label={`${info.label}: ${info.step} minutes more`}
        >
          <Icon name="plus" size={18} />
        </button>
      </div>
      {error && (
        <p className="entry-form__error metric__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** That night's sleep score, out of 100, under the sleep counter. */
function ScoreField({ date, value, average }: { date: string; value: number | null; average: number | null }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const [error, setError] = useState<string | null>(null);
  useFollow(`${date}|${value ?? ''}`, () => {
    setText(value == null ? '' : String(value));
    setError(null);
  });

  const store = (score: number | null) => setError(storeMetric('sleep_score', date, score, value));

  function save() {
    if (!text.trim()) {
      if (value != null) store(null);
      return;
    }
    const score = Number(text);
    if (!/^\d+$/.test(text.trim()) || score > MAX_SLEEP_SCORE) return setError(`A sleep score is a whole number from 0 to ${MAX_SLEEP_SCORE}.`);
    if (score !== value) store(score);
  }

  return (
    <div
      className="metric metric--score"
      role="group"
      aria-label="Sleep score"
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && save()}
    >
      <div className="metric__controls">
        <label className="duration-field">
          <span>Score</span>
          <input
            className="input"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="–"
            value={text}
            maxLength={3}
            onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                save();
              } else if (e.key === 'Escape') {
                setText(value == null ? '' : String(value));
                setError(null);
              }
            }}
            aria-label={`Sleep score out of ${MAX_SLEEP_SCORE}`}
          />
          <span>/ {MAX_SLEEP_SCORE}</span>
        </label>
        {value != null && (
          <button type="button" className="btn btn--small btn--ghost" onClick={() => store(null)} aria-label="Clear sleep score">
            Clear
          </button>
        )}
        {average != null && <span className="metric__sub type">{AVERAGE_DAYS}-day avg {average}</span>}
      </div>
      {error && (
        <p className="entry-form__error metric__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Sleep (with its score) and screen time for the day on show: one number each, set rather than added up. */
export function DayMetrics({ date, today }: { date: string; today: string }) {
  const metrics = useMetrics();
  const lastWeek = (metric: LogMetric) => {
    const byDay = metricByDay(metrics.values(), metric, addDays(date, -(AVERAGE_DAYS - 1)), date);
    const { average, days } = metricSummary(byDay);
    return { value: byDay.get(date) ?? null, average: days >= 2 ? average : null };
  };
  const sleep = lastWeek('sleep');
  const score = lastWeek('sleep_score');
  const screen = lastWeek('screen');
  return (
    <section className="log-card metrics" aria-label="Sleep and screen time">
      <div className="metrics__sleep">
        <Counter metric="sleep" date={date} today={today} value={sleep.value} average={sleep.average} />
        <ScoreField date={date} value={score.value} average={score.average} />
      </div>
      <Counter metric="screen" date={date} today={today} value={screen.value} average={screen.average} />
    </section>
  );
}
