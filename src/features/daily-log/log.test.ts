import { describe, expect, it } from 'vitest';
import type { LogDayMetric, LogEntry, LogGoal, LogTopic } from '../../data/types';
import { validLog } from '../../data/backup';
import { goalId, metricId } from '../../data/logActions';
import { addDays, addMonths, daysBetween, monthEnd, rangeLabel, todayIn, weekStart } from './dates';
import { formatMinutes, parseDuration, splitMinutes } from './duration';
import {
  dayBuckets, goalFor, goalProgress, heatLevel, inRange, metricByDay, metricMonthly, metricSummary, monthBuckets, periodSummary, sumMinutes, topicTotals, weekBuckets,
} from './stats';
import { checkEntry, checkTopicName, metricMax } from './validate';

const T = '2026-10-14T00:00:00Z';
const topic = (id: string, name: string, parent_id: string | null = null, extra: Partial<LogTopic> = {}): LogTopic => ({
  id, parent_id, name, color: 'blue', sort_order: 1, archived_at: null, created_at: T, updated_at: T, deleted_at: null, ...extra,
});
let seq = 0;
const entry = (date: string, topic_id: string, minutes: number, subcategory_id: string | null = null, extra: Partial<LogEntry> = {}): LogEntry => ({
  id: `e${++seq}`, date, topic_id, subcategory_id, minutes, note: null,
  created_at: `2026-10-14T00:00:${String(seq % 60).padStart(2, '0')}Z`, updated_at: T, deleted_at: null, ...extra,
});
const goal = (topic_id: string, week_start: string, minutes: number | null, extra: Partial<LogGoal> = {}): LogGoal => ({
  id: `${topic_id}:${week_start}`, topic_id, week_start, minutes, created_at: T, updated_at: T, deleted_at: null, ...extra,
});

const metric = (date: string, kind: LogDayMetric['metric'], minutes: number, extra: Partial<LogDayMetric> = {}): LogDayMetric => ({
  id: `${kind}:${date}`, date, metric: kind, minutes, created_at: T, updated_at: T, deleted_at: null, ...extra,
});

const school = topic('school', 'Schoolwork');
const maths = topic('maths', 'Maths', 'school');
const english = topic('english', 'English', 'school');
const violin = topic('violin', 'Violin');
const sports = topic('sports', 'Sports');
const running = topic('running', 'Running', 'sports');
const topics = new Map([school, maths, english, violin, sports, running].map((t) => [t.id, t]));

describe('durations', () => {
  it('formats whole minutes', () => {
    expect(formatMinutes(90)).toBe('1 hr 30 min');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(120)).toBe('2 hr');
    expect(formatMinutes(165)).toBe('2 hr 45 min');
  });
  it('accepts hours + minutes and rejects bad input', () => {
    expect(parseDuration('1', '30')).toEqual({ minutes: 90 });
    expect(parseDuration('', '45')).toEqual({ minutes: 45 });
    expect(parseDuration('0', '0')).toHaveProperty('error');
    expect(parseDuration('', '')).toHaveProperty('error');
    expect(parseDuration('-1', '0')).toHaveProperty('error');
    expect(parseDuration('1.5', '0')).toHaveProperty('error');
    expect(parseDuration('1', '60')).toHaveProperty('error');
    expect(parseDuration('abc', '')).toHaveProperty('error');
    expect(parseDuration('24', '0')).toEqual({ minutes: 1440 });
    expect(parseDuration('24', '1')).toHaveProperty('error');
    expect(splitMinutes(75)).toEqual({ hours: '1', minutes: '15' });
  });
});

describe('dates', () => {
  it('weeks start on Monday, across month and year boundaries', () => {
    expect(weekStart('2026-10-14')).toBe('2026-10-12'); // Wednesday
    expect(weekStart('2026-10-18')).toBe('2026-10-12'); // Sunday stays in its week
    expect(weekStart('2026-10-19')).toBe('2026-10-19'); // Monday starts a new one
    expect(weekStart('2027-01-01')).toBe('2026-12-28');
    expect(weekStart('2026-03-01')).toBe('2026-02-23');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(monthEnd('2026-02-10')).toBe('2026-02-28');
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01');
    expect(daysBetween('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
    expect(rangeLabel('2026-12-28', '2027-01-03')).toBe('28 Dec 2026 – 3 Jan 2027');
  });
  it("uses Singapore's calendar date near UTC midnight", () => {
    // 16:30 UTC on the 14th is 00:30 on the 15th in Singapore.
    expect(todayIn('Asia/Singapore', new Date('2026-10-14T16:30:00Z'))).toBe('2026-10-15');
    expect(todayIn('Asia/Singapore', new Date('2026-10-14T15:59:00Z'))).toBe('2026-10-14');
    expect(todayIn('UTC', new Date('2026-10-14T16:30:00Z'))).toBe('2026-10-14');
    // New Year in Singapore while it's still the old year in UTC.
    expect(todayIn('Asia/Singapore', new Date('2026-12-31T16:05:00Z'))).toBe('2027-01-01');
  });
  it('falls back to the device zone for an unknown zone name', () => {
    expect(todayIn('Not/AZone', new Date('2026-10-14T12:00:00Z'))).toMatch(/^2026-10-1[345]$/);
  });
});

describe('totals', () => {
  const day = '2026-10-14';
  const list = [entry(day, 'school', 90, 'maths'), entry(day, 'school', 30), entry(day, 'violin', 45)];

  it('acceptance 1: day total, topic total and its breakdown, each counted once', () => {
    expect(formatMinutes(sumMinutes(list))).toBe('2 hr 45 min');
    const totals = topicTotals(list);
    const s = totals.find((t) => t.topicId === 'school')!;
    expect(formatMinutes(s.minutes)).toBe('2 hr');
    expect(s.subs).toEqual([
      { id: 'maths', minutes: 90 },
      { id: null, minutes: 30 },
    ]);
    expect(totals.reduce((n, t) => n + t.minutes, 0)).toBe(165);
  });

  it('adds repeated sessions of the same thing', () => {
    const two = [entry(day, 'violin', 30), entry(day, 'violin', 45)];
    expect(formatMinutes(topicTotals(two)[0].minutes)).toBe('1 hr 15 min');
  });

  it('ignores deleted entries and counts archived topics', () => {
    const archivedTopic = [entry(day, 'violin', 30), entry(day, 'violin', 45, null, { deleted_at: T })];
    expect(sumMinutes(inRange(archivedTopic, day, day))).toBe(30);
  });

  it('acceptance 4: Sunday entries stay in their own week', () => {
    const sunday = entry('2026-10-18', 'violin', 60);
    const monday = entry('2026-10-19', 'violin', 20);
    const weeks = weekBuckets([sunday, monday], '2026-10-19', 2);
    expect(weeks.map((w) => [w.key, w.minutes])).toEqual([
      ['2026-10-12', 60],
      ['2026-10-19', 20],
    ]);
  });

  it('includes empty days and buckets months', () => {
    const days = dayBuckets([entry('2026-10-14', 'violin', 30)], '2026-10-12', '2026-10-18');
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.minutes)).toEqual([0, 0, 30, 0, 0, 0, 0]);
    const months = monthBuckets([entry('2026-01-31', 'violin', 10), entry('2026-02-01', 'violin', 5)], '2026');
    expect(months[0].minutes).toBe(10);
    expect(months[1].minutes).toBe(5);
  });

  it('averages over the days so far, not future ones', () => {
    const s = periodSummary([entry('2026-10-12', 'violin', 60), entry('2026-10-14', 'violin', 30)], '2026-10-12', '2026-10-18', '2026-10-14');
    expect(s).toMatchObject({ total: 90, elapsedDays: 3, activeDays: 2, average: 30, best: { date: '2026-10-12', minutes: 60 } });
  });

  it('grades heat by the busiest day', () => {
    expect(heatLevel(0, 100)).toBe(0);
    expect(heatLevel(1, 100)).toBe(1);
    expect(heatLevel(100, 100)).toBe(4);
  });
});

describe('weekly goals', () => {
  it('acceptance 2: progress, goal reached and extra time', () => {
    expect(goalProgress(120, 180)).toMatchObject({ pct: 67, remaining: 60, extra: 0, reached: false });
    const over = goalProgress(240, 180);
    expect(over).toMatchObject({ pct: 133, remaining: 0, extra: 60, reached: true, fill: 1 });
  });

  it('acceptance 5: a change applies from its week on; earlier weeks keep theirs', () => {
    const goals = [goal('school', '2026-10-05', 180), goal('school', '2026-10-12', 240)];
    expect(goalFor(goals, 'school', '2026-10-05')).toBe(180);
    expect(goalFor(goals, 'school', '2026-10-12')).toBe(240);
    expect(goalFor(goals, 'school', '2026-11-02')).toBe(240); // repeats until changed
    expect(goalFor(goals, 'school', '2026-09-28')).toBeNull(); // before any goal
    const removed = [...goals, goal('school', '2026-10-19', null)];
    expect(goalFor(removed, 'school', '2026-10-19')).toBeNull();
    expect(goalFor(removed, 'school', '2026-10-12')).toBe(240);
    expect(goalFor(removed, 'violin', '2026-10-12')).toBeNull();
  });

  it('gives one goal row per topic and week', () => {
    expect(goalId('school', '2026-10-12')).toBe(goalId('school', '2026-10-12'));
    expect(goalId('school', '2026-10-12')).not.toBe(goalId('school', '2026-10-19'));
    expect(goalId('school', '2026-10-12')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('validation', () => {
  const today = '2026-10-14';
  const ok = { date: today, topic_id: 'school', subcategory_id: 'maths', minutes: 30, note: null };

  it('acceptance 7: rejects bad durations, future dates and mismatched subcategories', () => {
    expect(checkEntry(ok, topics, today)).toBeNull();
    expect(checkEntry({ ...ok, subcategory_id: null }, topics, today)).toBeNull();
    for (const minutes of [0, -5, 1.5, NaN, 1441]) expect(checkEntry({ ...ok, minutes }, topics, today)).not.toBeNull();
    expect(checkEntry({ ...ok, date: '2026-10-15' }, topics, today)).not.toBeNull();
    expect(checkEntry({ ...ok, date: '2026-02-30' }, topics, today)).not.toBeNull();
    expect(checkEntry({ ...ok, subcategory_id: 'running' }, topics, today)).not.toBeNull();
    expect(checkEntry({ ...ok, topic_id: 'maths', subcategory_id: null }, topics, today)).not.toBeNull();
    expect(checkEntry({ ...ok, topic_id: 'nope' }, topics, today)).not.toBeNull();
    expect(checkEntry({ ...ok, note: 'x'.repeat(1001) }, topics, today)).not.toBeNull();
  });

  it('acceptance 6: archived choices only for the entry that already had them', () => {
    const archived = new Map(topics);
    archived.set('maths', { ...maths, archived_at: T });
    expect(checkEntry(ok, archived, today)).not.toBeNull();
    const prev = { ...entry(today, 'school', 20, 'maths') };
    expect(checkEntry(ok, archived, today, prev)).toBeNull();
    expect(checkEntry({ ...ok, subcategory_id: null }, archived, today, prev)).toBeNull();
  });

  it('trims names and refuses blanks and duplicates among active siblings', () => {
    expect(checkTopicName('  Piano  ', null, topics.values())).toEqual({ name: 'Piano' });
    expect(checkTopicName('   ', null, topics.values())).toHaveProperty('error');
    expect(checkTopicName('violin', null, topics.values())).toHaveProperty('error');
    expect(checkTopicName('Maths', 'sports', topics.values())).toEqual({ name: 'Maths' }); // different parent
    expect(checkTopicName('Violin', null, topics.values(), 'violin')).toEqual({ name: 'Violin' }); // renaming itself
    const withArchived = [...topics.values(), topic('old', 'Piano', null, { archived_at: T })];
    expect(checkTopicName('piano', null, withArchived)).toEqual({ name: 'piano' });
  });
});

describe('sleep and screen time', () => {
  const rows = [
    metric('2026-10-12', 'sleep', 480),
    metric('2026-10-13', 'sleep', 420),
    metric('2026-10-14', 'sleep', 450),
    metric('2026-10-14', 'screen', 0),
    metric('2026-10-15', 'screen', 120),
    metric('2026-10-11', 'sleep', 600, { deleted_at: T }),
    metric('2026-09-30', 'sleep', 360),
  ];

  it('picks one metric in a range, skipping cleared days', () => {
    const sleep = metricByDay(rows, 'sleep', '2026-10-11', '2026-10-14');
    expect([...sleep.entries()].sort()).toEqual([['2026-10-12', 480], ['2026-10-13', 420], ['2026-10-14', 450]]);
    expect(metricByDay(rows, 'screen', '2026-10-12', '2026-10-14').get('2026-10-14')).toBe(0);
  });

  it('averages over the days that have a value; a logged zero counts, a blank day does not', () => {
    expect(metricSummary(metricByDay(rows, 'sleep', '2026-10-12', '2026-10-18'))).toEqual({
      days: 3, average: 450, low: { date: '2026-10-13', minutes: 420 }, high: { date: '2026-10-12', minutes: 480 },
    });
    expect(metricSummary(metricByDay(rows, 'screen', '2026-10-12', '2026-10-18')).average).toBe(60);
    expect(metricSummary(new Map())).toEqual({ days: 0, average: null, low: null, high: null });
  });

  it('gives each month its own average', () => {
    const months = metricMonthly(rows, 'sleep', '2026');
    expect(months).toHaveLength(12);
    expect(months[8]).toEqual({ key: '2026-09-01', average: 360, days: 1 });
    expect(months[9]).toEqual({ key: '2026-10-01', average: 450, days: 3 });
    expect(months[10]).toEqual({ key: '2026-11-01', average: null, days: 0 });
  });

  it('keeps sleep scores apart from sleep time, out of 100', () => {
    const scored = [...rows, metric('2026-10-14', 'sleep_score', 82), metric('2026-10-13', 'sleep_score', 74)];
    expect(metricSummary(metricByDay(scored, 'sleep_score', '2026-10-12', '2026-10-18')).average).toBe(78);
    expect(metricSummary(metricByDay(scored, 'sleep', '2026-10-12', '2026-10-18')).average).toBe(450);
    expect(metricMax('sleep_score')).toBe(100);
    expect(metricMax('sleep')).toBe(1440);
    expect(metricId('sleep_score', '2026-10-14')).not.toBe(metricId('sleep', '2026-10-14'));
  });

  it('names one row per metric per day', () => {
    expect(metricId('sleep', '2026-10-14')).toBe(metricId('sleep', '2026-10-14'));
    expect(metricId('sleep', '2026-10-14')).not.toBe(metricId('screen', '2026-10-14'));
    expect(metricId('sleep', '2026-10-14')).not.toBe(metricId('sleep', '2026-10-15'));
  });
});

describe('backup', () => {
  it('keeps well-formed Daily Log records and drops broken references', () => {
    const deep = topic('deep', 'Deep', 'maths');
    const out = validLog({
      log_topics: [school, maths, violin, deep],
      log_entries: [
        entry('2026-10-14', 'school', 30, 'maths'),
        entry('2026-10-14', 'violin', 30, 'maths'), // subcategory of another topic
        entry('2026-10-14', 'maths', 30), // a subcategory used as a topic
        entry('2026-13-01', 'violin', 30), // not a date
        entry('2026-10-14', 'violin', 0), // no time
      ],
      log_goals: [goal('school', '2026-10-12', 180), goal('ghost', '2026-10-12', 60)],
      log_metrics: [
        metric('2026-10-14', 'sleep', 450),
        metric('2026-10-14', 'screen', 0),
        metric('2026-10-14', 'steps' as LogDayMetric['metric'], 30), // not a metric
        metric('2026-10-14', 'sleep', 1441), // more than a day
        metric('2026-10-14', 'sleep', 7.5), // not whole minutes
        metric('2026-10-14', 'sleep_score', 88),
        metric('2026-10-13', 'sleep_score', 101), // over 100
      ],
    });
    expect(out.topics.map((t) => t.id)).toEqual(['school', 'maths', 'violin']);
    expect(out.entries).toHaveLength(1);
    expect(out.goals).toHaveLength(1);
    expect(out.metrics.map((m) => m.minutes)).toEqual([450, 0, 88]);
  });

  it('treats an old cabinet-only backup as having no log at all', () => {
    expect(validLog({})).toEqual({ topics: [], entries: [], goals: [], metrics: [] });
  });
});
