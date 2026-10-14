import { useMemo } from 'react';
import { ui } from '../../data/ui';
import { useStore } from '../../lib/createStore';
import { Icon } from '../../ui/Icon';
import { addDays, longDay, relativeDay } from './dates';
import { DayMetrics } from './DayMetrics';
import { formatMinutes } from './duration';
import { EntryForm } from './EntryForm';
import { EntryList } from './EntryList';
import { inRange, sumMinutes, topicTotals } from './stats';
import { TopicBars } from './TopicBars';
import { useEntries, useToday } from './useLog';

const DAY_MINUTES = 24 * 60;

/** Day navigation, sleep and screen time, the entry form, then that day's totals and entries. */
export function TodayView() {
  const today = useToday();
  const picked = useStore(ui, (s) => s.logDate);
  // A deliberately chosen past day stays put; otherwise follow the calendar (midnight included).
  const date = picked && picked < today ? picked : today;
  const setDate = (d: string) => ui.set({ logDate: d >= today ? null : d });
  const entries = useEntries();

  const dayEntries = useMemo(() => inRange(entries.values(), date, date), [entries, date]);
  const total = sumMinutes(dayEntries);
  const totals = useMemo(() => topicTotals(dayEntries), [dayEntries]);

  return (
    <div className="log-today">
      <nav className="day-nav" aria-label="Day">
        <button type="button" className="btn btn--ghost btn--icon" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          <Icon name="left" size={18} />
        </button>
        <h2 className="day-nav__label hand" aria-live="polite">
          {relativeDay(date, today)}
          <span className="day-nav__sub type">{longDay(date)}</span>
        </h2>
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={() => setDate(addDays(date, 1))}
          disabled={date >= today}
          aria-label="Next day"
        >
          <Icon name="right" size={18} />
        </button>
        {date !== today && (
          <button type="button" className="btn btn--small" onClick={() => setDate(today)}>
            Back to today
          </button>
        )}
      </nav>

      <DayMetrics date={date} today={today} />

      <section className="log-card" aria-label="Log time">
        <EntryForm today={today} date={date} onDate={setDate} stayOpen />
      </section>

      <section className="log-card" aria-labelledby="day-total">
        <div className="day-total">
          <span className="field-label" id="day-total">
            {date === today ? 'Logged today' : `Logged on ${relativeDay(date, today)}`}
          </span>
          <span className="day-total__value">{formatMinutes(total)}</span>
        </div>
        {total > DAY_MINUTES && (
          <p className="log-warning" role="status">
            That’s more than 24 hours in one day. Worth checking the entries below.
          </p>
        )}
        {totals.length > 0 ? (
          <>
            <TopicBars totals={totals} />
            <h3 className="log-subhead type">Entries</h3>
            <EntryList entries={dayEntries} />
          </>
        ) : (
          <p className="log-quiet">Nothing logged {date === today ? 'yet today' : 'on this day'}.</p>
        )}
      </section>
    </div>
  );
}
