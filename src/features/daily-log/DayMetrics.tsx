import { useState, type FocusEvent, type KeyboardEvent } from 'react';
import { setMetric } from '../../data/logActions';
import { toast } from '../../data/ui';
import { LOG_METRICS, type LogMetric } from '../../data/types';
import { Icon, type IconName } from '../../ui/Icon';
import { tapeVar } from '../../ui/labels';
import { addDays } from './dates';
import { formatMinutes, MAX_ENTRY_MINUTES, parseDuration, splitMinutes } from './duration';
import { metricByDay, metricSummary } from './stats';
import { useMetrics } from './useLog';

export const METRICS: Record<LogMetric, { label: string; icon: IconName; colour: string; step: number; start: number }> = {
  // + on an empty sleep counter starts from a usual night rather than crawling up from 15 min.
  sleep: { label: 'Sleep', icon: 'moon', colour: tapeVar('navy'), step: 15, start: 8 * 60 },
  screen: { label: 'Screen time', icon: 'screen', colour: tapeVar('teal'), step: 15, start: 15 },
};

const AVERAGE_DAYS = 7;

/** Both fields blank when nothing is set; a set value always shows its hours, even 0. */
const toFields = (minutes: number | null) => (minutes == null ? { hours: '', minutes: '' } : { ...splitMinutes(minutes), hours: String(Math.floor(minutes / 60)) });

function Counter({ metric, date, today, value, average }: { metric: LogMetric; date: string; today: string; value: number | null; average: number | null }) {
  const info = METRICS[metric];
  const [fields, setFields] = useState(() => toFields(value));
  const [error, setError] = useState<string | null>(null);
  // Follow the stored value when it changes underneath (another day, a stepper, another device).
  const shownKey = `${date}|${value ?? ''}`;
  const [seen, setSeen] = useState(shownKey);
  if (seen !== shownKey) {
    setSeen(shownKey);
    setFields(toFields(value));
    setError(null);
  }

  const blank = !fields.hours.trim() && !fields.minutes.trim();
  const parsed = blank ? null : parseDuration(fields.hours, fields.minutes, MAX_ENTRY_MINUTES, 0);
  const typed = parsed && 'minutes' in parsed ? parsed.minutes : null;

  function store(minutes: number | null) {
    const prev = value;
    const problem = setMetric(metric, date, minutes);
    setError(problem);
    if (!problem && minutes == null && prev != null) {
      toast(`${info.label} cleared`, { label: 'Undo', run: () => setMetric(metric, date, prev) });
    }
  }

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

/** Sleep and screen time for the day on show: one number each, set rather than added up. */
export function DayMetrics({ date, today }: { date: string; today: string }) {
  const metrics = useMetrics();
  return (
    <section className="log-card metrics" aria-label="Sleep and screen time">
      {LOG_METRICS.map((metric) => {
        const week = metricByDay(metrics.values(), metric, addDays(date, -(AVERAGE_DAYS - 1)), date);
        const { average, days } = metricSummary(week);
        return <Counter key={metric} metric={metric} date={date} today={today} value={week.get(date) ?? null} average={days >= 2 ? average : null} />;
      })}
    </section>
  );
}
