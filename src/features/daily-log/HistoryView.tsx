import { useMemo, useState } from 'react';
import { ui } from '../../data/ui';
import { Icon } from '../../ui/Icon';
import { addDays, rangeLabel, relativeDay, weekStart } from './dates';
import { formatMinutes } from './duration';
import { EntryList } from './EntryList';
import { childrenOf, inRange, sumMinutes, topLevel } from './stats';
import { useEntries, useToday, useTopics } from './useLog';
import { plural } from '../../lib/format';

/** Entries grouped by day, newest first, for a week or a custom range, filterable by topic. */
export function HistoryView() {
  const today = useToday();
  const topics = useTopics();
  const entries = useEntries();
  const [monday, setMonday] = useState(() => weekStart(today));
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [topicId, setTopicId] = useState('');
  const [subId, setSubId] = useState('');

  const thisMonday = weekStart(today);
  const from = custom?.from ?? monday;
  const to = custom?.to ?? (addDays(monday, 6) < today ? addDays(monday, 6) : today);

  const all = useMemo(() => inRange(entries.values(), from, to), [entries, from, to]);
  const shown = useMemo(
    () => all.filter((e) => (!topicId || e.topic_id === topicId) && (!subId || (subId === 'none' ? !e.subcategory_id : e.subcategory_id === subId))),
    [all, topicId, subId],
  );
  const days = useMemo(() => {
    const m = new Map<string, typeof shown>();
    for (const e of shown) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [shown]);

  // Archived topics stay in the filter while they have records.
  const used = useMemo(() => new Set([...entries.values()].filter((e) => !e.deleted_at).flatMap((e) => [e.topic_id, e.subcategory_id ?? ''])), [entries]);
  const topicOptions = topLevel(topics.values()).filter((t) => !t.archived_at || used.has(t.id));
  const subOptions = topicId ? childrenOf(topics.values(), topicId).filter((s) => !s.archived_at || used.has(s.id)) : [];
  const filtered = !!topicId;

  return (
    <div className="log-history">
      <div className="log-controls">
        {custom ? (
          <div className="range-pick">
            <label className="field">
              <span>From</span>
              <input className="input" type="date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} />
            </label>
            <label className="field">
              <span>To</span>
              <input
                className="input"
                type="date"
                value={custom.to}
                min={custom.from}
                max={today}
                onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value > today ? today : e.target.value })}
              />
            </label>
            <button type="button" className="btn btn--small" onClick={() => setCustom(null)}>
              Back to weeks
            </button>
          </div>
        ) : (
          <div className="period-nav">
            <button type="button" className="btn btn--ghost btn--icon" onClick={() => setMonday(addDays(monday, -7))} aria-label="Previous week">
              <Icon name="left" size={18} />
            </button>
            <span className="period-nav__label type" aria-live="polite">
              {monday === thisMonday ? 'This week · ' : ''}
              {rangeLabel(monday, addDays(monday, 6))}
            </span>
            <button type="button" className="btn btn--ghost btn--icon" onClick={() => setMonday(addDays(monday, 7))} disabled={monday >= thisMonday} aria-label="Next week">
              <Icon name="right" size={18} />
            </button>
            {monday !== thisMonday && (
              <button type="button" className="btn btn--small" onClick={() => setMonday(thisMonday)}>
                This week
              </button>
            )}
            <button type="button" className="btn btn--small btn--ghost" onClick={() => setCustom({ from: monday, to })}>
              <Icon name="calendar" size={15} /> Custom range
            </button>
          </div>
        )}
        <div className="log-filters">
          <label className="field">
            <span>Topic</span>
            <select
              className="select"
              value={topicId}
              onChange={(e) => {
                setTopicId(e.target.value);
                setSubId('');
              }}
            >
              <option value="">All topics</option>
              {topicOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.archived_at ? ' (archived)' : ''}
                </option>
              ))}
            </select>
          </label>
          {subOptions.length > 0 && (
            <label className="field">
              <span>Subcategory</span>
              <select className="select" value={subId} onChange={(e) => setSubId(e.target.value)}>
                <option value="">All</option>
                <option value="none">No subcategory</option>
                {subOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.archived_at ? ' (archived)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      <section className="log-card">
        <div className="history-head">
          <div className="day-total">
            <span className="field-label">{filtered ? 'Matching time' : 'Total'}</span>
            <span className="day-total__value">{formatMinutes(sumMinutes(shown))}</span>
            <span className="log-quiet type">{plural(shown.length, 'entry', 'entries')} · {rangeLabel(from, to)}</span>
          </div>
          <button type="button" className="btn" onClick={() => ui.set({ logSheet: { editId: null, date: to } })}>
            <Icon name="plus" size={16} /> Add an entry
          </button>
        </div>

        {days.length === 0 ? (
          all.length === 0 ? (
            <div className="log-empty">
              <p>Nothing logged in this period.</p>
              <button type="button" className="btn btn--primary" onClick={() => ui.set({ logSheet: { editId: null, date: to } })}>
                Add an entry
              </button>
            </div>
          ) : (
            <div className="log-empty">
              <p>No entries match this filter.</p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setTopicId('');
                  setSubId('');
                }}
              >
                Show all topics
              </button>
            </div>
          )
        ) : (
          <ol className="history-days">
            {days.map(([date, list]) => (
              <li key={date} className="history-day">
                <h3 className="history-day__head">
                  <span className="hand">{relativeDay(date, today)}</span>
                  <span className="type">{formatMinutes(sumMinutes(list))}</span>
                </h3>
                <EntryList entries={list} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
