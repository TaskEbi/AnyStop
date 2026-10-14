import { useMemo, useState } from 'react';
import { Icon } from '../../ui/Icon';
import { ChartTable, ColumnChart, Heatmap, Legend, type Column, type HeatDay } from './charts';
import {
  addDays,
  addMonths,
  dayOfMonth,
  monthEnd,
  monthName,
  monthStart,
  rangeLabel,
  shortDay,
  weekdayLetter,
  weekStart,
} from './dates';
import { formatMinutes } from './duration';
import { GoalCards } from './GoalCards';
import { MetricCard, useMetricPeriod } from './MetricStats';
import { dayBuckets, inRange, monthBuckets, periodSummary, topicTotals, topLevel, weekBuckets, type Bucket } from './stats';
import { TopicBars } from './TopicBars';
import { topicColour, topicName, useEntries, useToday, useTopics } from './useLog';

type Period = 'week' | 'month' | 'year';
const PERIODS: { id: Period; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];
const HEAT_WEEKS = 26;
const TREND_WEEKS = 12;

function periodRange(period: Period, anchor: string): { from: string; to: string } {
  if (period === 'week') return { from: anchor, to: addDays(anchor, 6) };
  if (period === 'month') return { from: anchor, to: monthEnd(anchor) };
  return { from: `${anchor.slice(0, 4)}-01-01`, to: `${anchor.slice(0, 4)}-12-31` };
}

function anchorFor(period: Period, today: string): string {
  if (period === 'week') return weekStart(today);
  if (period === 'month') return monthStart(today);
  return `${today.slice(0, 4)}-01-01`;
}

function step(period: Period, anchor: string, n: number): string {
  if (period === 'week') return addDays(anchor, 7 * n);
  if (period === 'month') return addMonths(anchor, n);
  return `${+anchor.slice(0, 4) + n}-01-01`;
}

function Tile({ label, value, sub, hero }: { label: string; value: string; sub?: string; hero?: boolean }) {
  return (
    <div className={`stat-tile ${hero ? 'stat-tile--hero' : ''}`}>
      <span className="stat-tile__label">{label}</span>
      <span className="stat-tile__value">{value}</span>
      {sub && <span className="stat-tile__sub type">{sub}</span>}
    </div>
  );
}

/** Totals, charts, topic breakdowns, weekly goals, sleep and screen time for a week, month or year. */
export function StatsView() {
  const today = useToday();
  const topics = useTopics();
  const entries = useEntries();
  const [period, setPeriod] = useState<Period>('week');
  const [anchor, setAnchor] = useState(() => anchorFor('week', today));
  const [trendTopic, setTrendTopic] = useState('');

  const current = anchorFor(period, today);
  const { from, to } = periodRange(period, anchor);
  const isCurrent = anchor === current;

  const sleep = useMetricPeriod('sleep', from, to).summary;
  const screen = useMetricPeriod('screen', from, to).summary;

  const inPeriod = useMemo(() => inRange(entries.values(), from, to), [entries, from, to]);
  const summary = useMemo(() => periodSummary([...entries.values()], from, to, today), [entries, from, to, today]);
  const totals = useMemo(() => topicTotals(inPeriod), [inPeriod]);

  // Stack order and legend follow the topics' own order, so a colour always sits in the same place.
  const order = useMemo(() => topLevel(topics.values()).map((t) => t.id), [topics]);
  // (A topic that hasn't synced to this device yet still gets a place, at the end.)
  const presentKey = [...order.filter((id) => totals.some((t) => t.topicId === id)), ...totals.map((t) => t.topicId).filter((id) => !order.includes(id))].join(',');
  const present = useMemo(() => (presentKey ? presentKey.split(',') : []), [presentKey]);
  const series = { colourOf: (id: string) => topicColour(topics, id), nameOf: (id: string) => topicName(topics, id) };

  const columns: Column[] = useMemo(() => {
    const toColumns = (buckets: Bucket[], tick: (b: Bucket, i: number) => string, title: (b: Bucket) => string, future: (b: Bucket) => boolean) =>
      buckets.map((b, i) => ({
        key: b.key,
        tick: tick(b, i),
        title: title(b),
        future: future(b),
        segments: present.map((id) => ({ id, minutes: b.byTopic.get(id) ?? 0 })),
      }));
    if (period === 'year') {
      return toColumns(monthBuckets([...entries.values()], from.slice(0, 4)), (b) => monthName(b.key)[0] + monthName(b.key).slice(1, 3), (b) => `${monthName(b.key, true)} ${b.key.slice(0, 4)}`, (b) => b.key > today);
    }
    const days = dayBuckets([...entries.values()], from, to);
    return toColumns(
      days,
      (b, i) => (period === 'week' ? weekdayLetter(b.key) : i === 0 || dayOfMonth(b.key) % 5 === 0 ? String(dayOfMonth(b.key)) : ''),
      (b) => shortDay(b.key, today),
      (b) => b.key > today,
    );
  }, [entries, from, to, period, present, today]);

  const heatWeeks: HeatDay[][] = useMemo(() => {
    const lastMonday = weekStart(today);
    const firstMonday = addDays(lastMonday, -7 * (HEAT_WEEKS - 1));
    const days = dayBuckets([...entries.values()], firstMonday, addDays(lastMonday, 6));
    const weeks: HeatDay[][] = [];
    days.forEach((d, i) => {
      if (i % 7 === 0) weeks.push([]);
      weeks[weeks.length - 1].push({ date: d.key, minutes: d.minutes, title: shortDay(d.key, today), future: d.key > today });
    });
    return weeks;
  }, [entries, today]);
  const heatActive = heatWeeks.flat().filter((d) => d.minutes > 0).length;

  const trend: Column[] = useMemo(() => {
    const id = trendTopic || 'all';
    return weekBuckets([...entries.values()], weekStart(today), TREND_WEEKS, trendTopic || null).map((b, i) => ({
      key: b.key,
      tick: i % 2 === (TREND_WEEKS - 1) % 2 ? `${dayOfMonth(b.key)} ${monthName(b.key)}` : '',
      title: `Week of ${shortDay(b.key, today)}`,
      segments: [{ id, minutes: b.minutes }],
    }));
  }, [entries, today, trendTopic]);
  const trendSeries = {
    colourOf: (id: string) => (id === 'all' ? 'var(--thread)' : topicColour(topics, id)),
    nameOf: (id: string) => (id === 'all' ? 'All topics' : topicName(topics, id)),
  };

  const minutesByTopic = new Map(totals.map((t) => [t.topicId, t.minutes]));
  const top = totals[0];
  const periodWord = period === 'week' ? 'week' : period === 'month' ? 'month' : 'year';
  const label =
    period === 'week'
      ? `${isCurrent ? 'This week · ' : ''}${rangeLabel(from, to)}`
      : period === 'month'
        ? `${monthName(from, true)} ${from.slice(0, 4)}`
        : from.slice(0, 4);

  return (
    <div className="log-stats">
      <div className="log-controls">
        <div className="chips" role="radiogroup" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={period === p.id}
              className="chip"
              onClick={() => {
                setPeriod(p.id);
                setAnchor(anchorFor(p.id, today));
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="period-nav">
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => setAnchor(step(period, anchor, -1))} aria-label={`Previous ${periodWord}`}>
            <Icon name="left" size={18} />
          </button>
          <span className="period-nav__label type" aria-live="polite">
            {label}
          </span>
          <button type="button" className="btn btn--ghost btn--icon" onClick={() => setAnchor(step(period, anchor, 1))} disabled={anchor >= current} aria-label={`Next ${periodWord}`}>
            <Icon name="right" size={18} />
          </button>
          {!isCurrent && (
            <button type="button" className="btn btn--small" onClick={() => setAnchor(current)}>
              This {periodWord}
            </button>
          )}
        </div>
      </div>

      <div className="stat-tiles">
        <Tile hero label={`Total this ${periodWord}`} value={formatMinutes(summary.total)} />
        <Tile label="Daily average" value={formatMinutes(summary.average)} sub={`over ${summary.elapsedDays} ${summary.elapsedDays === 1 ? 'day' : 'days'}`} />
        <Tile label="Days with time logged" value={`${summary.activeDays} / ${summary.elapsedDays}`} />
        <Tile
          label="Most time on"
          value={top ? topicName(topics, top.topicId) : '–'}
          sub={top ? formatMinutes(top.minutes) : undefined}
        />
        {summary.best && <Tile label="Biggest day" value={formatMinutes(summary.best.minutes)} sub={shortDay(summary.best.date, today)} />}
        {sleep.average != null && <Tile label="Average sleep" value={formatMinutes(sleep.average)} sub={`over ${sleep.days} ${sleep.days === 1 ? 'night' : 'nights'}`} />}
        {screen.average != null && <Tile label="Average screen time" value={formatMinutes(screen.average)} sub={`over ${screen.days} ${screen.days === 1 ? 'day' : 'days'}`} />}
      </div>

      <section className="log-card" aria-labelledby="chart-title">
        <h3 className="log-card__title hand" id="chart-title">
          {period === 'year' ? 'Month by month' : 'Day by day'}
        </h3>
        <ColumnChart columns={columns} series={series} label={`Time logged per ${period === 'year' ? 'month' : 'day'}, ${label}`} />
        <Legend ids={present} series={series} />
        <ChartTable columns={columns} ids={present} series={series} caption={`Time per ${period === 'year' ? 'month' : 'day'} by topic`} />
      </section>

      <div className="log-grid">
        <section className="log-card" aria-labelledby="topics-title">
          <h3 className="log-card__title hand" id="topics-title">
            By topic
          </h3>
          {totals.length ? <TopicBars totals={totals} expandable /> : <p className="log-quiet">Nothing logged this {periodWord}.</p>}
        </section>

        <section className="log-card" aria-labelledby="goals-title">
          <h3 className="log-card__title hand" id="goals-title">
            Weekly goals
          </h3>
          {period === 'week' ? (
            <>
              {!isCurrent && <p className="log-quiet">Goals as they were that week. Change goals on the current week.</p>}
              <GoalCards monday={from} editable={isCurrent} minutesByTopic={minutesByTopic} />
            </>
          ) : (
            <div className="log-empty">
              <p>Goals are weekly.</p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setPeriod('week');
                  setAnchor(weekStart(today));
                }}
              >
                Show this week
              </button>
            </div>
          )}
        </section>
      </div>

      <div className="log-grid">
        <MetricCard metric="sleep" period={period} from={from} to={to} today={today} />
        <MetricCard metric="screen" period={period} from={from} to={to} today={today} />
      </div>

      <section className="log-card" aria-labelledby="heat-title">
        <h3 className="log-card__title hand" id="heat-title">
          The last six months
        </h3>
        <Heatmap weeks={heatWeeks} label={`Calendar of the last ${HEAT_WEEKS} weeks: time logged on ${heatActive} days`} />
        <p className="log-quiet type">
          {heatActive} {heatActive === 1 ? 'day' : 'days'} with time logged since {shortDay(heatWeeks[0][0].date, today)}
        </p>
      </section>

      <section className="log-card" aria-labelledby="trend-title">
        <div className="log-card__bar">
          <h3 className="log-card__title hand" id="trend-title">
            Week by week
          </h3>
          <select className="select trend-select" value={trendTopic} onChange={(e) => setTrendTopic(e.target.value)} aria-label="Topic for the weekly trend">
            <option value="">All topics</option>
            {topLevel(topics.values()).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <ColumnChart columns={trend} series={trendSeries} label={`Weekly totals for the last ${TREND_WEEKS} weeks, ${trendSeries.nameOf(trendTopic || 'all')}`} />
        <ChartTable columns={trend} ids={[trendTopic || 'all']} series={trendSeries} caption="Weekly totals" />
      </section>
    </div>
  );
}
