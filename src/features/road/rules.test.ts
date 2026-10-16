import { describe, expect, it } from 'vitest';
import { DEFAULT_ROAD, normaliseRoad, type LogEntry } from '../../data/types';
import type { DragonSummary } from './dragon';
import { isSummary } from './dragon';
import { seasonCalendar, upcoming } from './calendar';
import {
  countdown,
  currentStage,
  daysUntil,
  gatesThisSeason,
  isHardDay,
  lastSeven,
  proofNote,
  seasonStart,
  seasonYear,
  stageWhen,
  trainingByDay,
  upsolveLine,
  zonedInstant,
} from './rules';

const TOPIC = 'topic-cp';
const entry = (date: string, minutes: number, note: string | null = null, topic_id = TOPIC): LogEntry => ({
  id: `${date}-${minutes}-${topic_id}`,
  date,
  topic_id,
  subcategory_id: null,
  minutes,
  note,
  created_at: '',
  updated_at: '',
  deleted_at: null,
});
const summary = (over: Partial<DragonSummary> = {}): DragonSummary => ({
  version: 1,
  generatedAt: '2026-10-15T00:00:00Z',
  timezone: 'Asia/Singapore',
  today: '2026-10-15',
  mockOpen: false,
  days: [],
  recent: [],
  upsolve: [],
  targets: [],
  ...over,
});

describe('normaliseRoad', () => {
  it('fills a missing or partial copy from the defaults', () => {
    expect(normaliseRoad(undefined)).toEqual(DEFAULT_ROAD);
    expect(normaliseRoad({})).toEqual(DEFAULT_ROAD);
    const r = normaliseRoad({ why: 'To stand there', stages: { ioi: { date: '2027-08-01', target: 'A medal' } } });
    expect(r.why).toBe('To stand there');
    expect(r.stages.ioi).toEqual({ date: '2027-08-01', time: null, target: 'A medal', reason: '', cleared_on: null, memory: '' });
    expect(r.stages.joi2).toEqual(DEFAULT_ROAD.stages.joi2);
    expect(r.dragon_url).toBe(DEFAULT_ROAD.dragon_url);
  });
});

describe('the clock', () => {
  it('reads stage times in Japan time', () => {
    expect(new Date(zonedInstant('2026-11-29', '13:00', 'Asia/Tokyo')).toISOString()).toBe('2026-11-29T04:00:00.000Z');
    expect(new Date(zonedInstant('2026-10-25', null, 'Asia/Tokyo')).toISOString()).toBe('2026-10-24T15:00:00.000Z');
    // A zone with summer time, on either side of the change.
    expect(new Date(zonedInstant('2027-07-01', '09:00', 'Europe/Berlin')).toISOString()).toBe('2027-07-01T07:00:00.000Z');
    expect(new Date(zonedInstant('2027-01-10', '09:00', 'Europe/Berlin')).toISOString()).toBe('2027-01-10T08:00:00.000Z');
  });

  it('splits what is left into days, hours, minutes and seconds, never below zero', () => {
    expect(countdown(((42 * 24 + 6) * 3600 + 14 * 60 + 9) * 1000)).toEqual({ days: 42, hours: 6, minutes: 14, seconds: 9 });
    expect(countdown(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});

describe('stages', () => {
  it('uses a date set on the page, otherwise a matching DragonCode target', () => {
    const road = normaliseRoad({ stages: { final: { date: null } } });
    const dragon = summary({
      targets: [
        { name: 'JOI second qualifier', kind: 'primary', date: '2026-11-29', time: '13:00', timezone: 'Asia/Tokyo' },
        { name: 'JOI Final Round (本選)', kind: 'virtual', date: '2027-02-14', time: null, timezone: null },
      ],
    });
    expect(stageWhen('joi2', road.stages.joi2, dragon, '2026-10-15')).toMatchObject({ date: '2026-11-29', from: 'road' });
    expect(stageWhen('final', road.stages.final, dragon, '2026-10-15')).toEqual({ date: '2027-02-14', time: null, zone: 'Asia/Tokyo', from: 'dragon' });
    expect(stageWhen('camp', road.stages.camp, dragon, '2026-10-15')).toMatchObject({ date: '2027-03-20', until: '2027-03-24', from: 'schedule' });
    // "JOI" never counts as the IOI stage.
    expect(stageWhen('ioi', road.stages.ioi, summary({ targets: [{ name: 'JOI qualifier', kind: 'primary', date: '2026-12-01', time: null, timezone: null }] }), '2026-10-15')).toMatchObject({ date: '2027-09-12', from: 'schedule' });
  });

  it('the current stage is the first one not cleared', () => {
    const road = normaliseRoad({});
    expect(currentStage(road)).toBe('joi1');
    road.stages.joi1.cleared_on = '2026-09-20';
    expect(currentStage(road)).toBe('joi2');
    for (const s of Object.values(road.stages)) s.cleared_on = '2027-03-01';
    expect(currentStage(road)).toBeNull();
  });

  it('counts the season towards next summer until the IOI date is set', () => {
    expect(seasonYear(DEFAULT_ROAD, '2026-10-15')).toBe(2027);
    expect(seasonYear(DEFAULT_ROAD, '2027-03-01')).toBe(2027);
    expect(seasonYear(normaliseRoad({ stages: { ioi: { date: '2028-08-10' } } }), '2026-10-15')).toBe(2028);
  });
});

describe('training days', () => {
  const today = '2026-10-15';

  it('adds the Road topic entries and DragonCode days; other topics and deleted entries do not count', () => {
    const entries = [entry('2026-10-15', 30), entry('2026-10-15', 20, null, 'violin'), { ...entry('2026-10-14', 40), deleted_at: 'x' }];
    const dragon = summary({ days: [{ date: '2026-10-15', minutes: 45, results: 1, ac: 1 }, { date: '2026-10-13', minutes: 0, results: 1, ac: 0 }] });
    const days = trainingByDay(entries, TOPIC, dragon);
    expect(days.get('2026-10-15')).toBe(75);
    expect(days.get('2026-10-14')).toBeUndefined();
    // A result with no recorded minutes still makes it a training day.
    expect(days.get('2026-10-13')).toBe(1);
  });

  it('shows the last seven days, oldest first, with today open until something is logged', () => {
    const days = new Map([
      ['2026-10-09', 30],
      ['2026-10-12', 20],
    ]);
    const week = lastSeven(days, today);
    expect(week.map((d) => d.date)).toEqual(['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']);
    expect(week.map((d) => d.state)).toEqual(['ac', 'miss', 'miss', 'ac', 'miss', 'miss', 'now']);
    expect(lastSeven(new Map([[today, 10]]), today).at(-1)!.state).toBe('ac');
  });

  it('calls it a hard day after three days with nothing', () => {
    expect(isHardDay(new Map([['2026-10-12', 30]]), today)).toBe(true);
    expect(isHardDay(new Map([['2026-10-13', 30]]), today)).toBe(false);
    expect(isHardDay(new Map([[today, 5]]), today)).toBe(false);
  });
});

describe('gates and the season calendar', () => {
  it('raises one gate for every training day since 1 September', () => {
    const days = new Map([
      ['2026-08-31', 30],
      ['2026-09-01', 20],
      ['2026-10-14', 45],
      ['2026-10-15', 10],
      ['2026-10-16', 60],
    ]);
    expect(seasonStart('2026-10-15')).toBe('2026-09-01');
    expect(seasonStart('2027-03-01')).toBe('2026-09-01');
    expect(gatesThisSeason(days, '2026-10-15')).toBe(3);
  });

  it('counts whole days to a date', () => {
    expect(daysUntil('2026-10-25', '2026-10-16')).toBe(9);
    expect(daysUntil('2026-10-16', '2026-10-16')).toBe(0);
    expect(daysUntil('2026-10-15', '2026-10-16')).toBe(-1);
  });

  it('puts my exact dates over the placeholders, keeps hidden ones aside, and drops past contests', () => {
    const road = normaliseRoad({ events: { 'noi-final': { date: '2027-03-06', time: '10:30' }, apio: { hidden: true }, junk: 'x' } });
    expect(road.events).toEqual({ 'noi-final': { date: '2027-03-06', time: '10:30', hidden: false }, apio: { date: null, time: null, hidden: true } });
    const cal = seasonCalendar(road.events);
    const noi = cal.find((c) => c.event.id === 'noi-final')!;
    expect(noi).toMatchObject({ date: '2027-03-06', time: '10:30', approx: false, mine: true });
    expect(cal.find((c) => c.event.id === 'usaco-1')).toMatchObject({ approx: true, mine: false });
    expect(cal.map((c) => c.date)).toEqual([...cal.map((c) => c.date)].sort());
    const { shown, hidden } = upcoming(cal, '2027-02-01');
    expect(hidden.map((c) => c.event.id)).toEqual(['apio']);
    expect(shown.some((c) => c.event.id === 'usaco-1')).toBe(false);
    expect(shown.some((c) => c.event.id === 'noi-final')).toBe(true);
  });
});

describe('notes and problems', () => {
  it('picks a note from at least three days ago, the same one all day', () => {
    const entries = [entry('2026-10-01', 30, 'Prefix sums clicked'), entry('2026-10-14', 30, 'Too recent')];
    const dragon = summary({ recent: [{ problemId: 'p', title: 'P', url: null, verdict: 'AC', helpUsed: 'independent', minutes: 30, reflection: 'Two pointers move together', date: '2026-10-05' }] });
    const pick = proofNote(entries, TOPIC, dragon, '2026-10-15');
    expect(['Prefix sums clicked', 'Two pointers move together']).toContain(pick!.text);
    expect(proofNote(entries, TOPIC, dragon, '2026-10-15')).toEqual(pick);
    expect(proofNote([entry('2026-10-14', 30, 'Too recent')], TOPIC, null, '2026-10-15')).toBeNull();
  });

  it('names the top of the upsolve queue, or falls back to the brief', () => {
    expect(upsolveLine(null)).toEqual({ title: "Upsolve yesterday's hardest mistake", detail: '', problemId: null });
    const dragon = summary({ upsolve: [{ problemId: 'joi.2022-yo2-t2', title: 'Carpet', url: null, reason: 'not_accepted', verdict: 'WA', since: '' }] });
    expect(upsolveLine(dragon)).toEqual({ title: 'Carpet', detail: 'WA: upsolve it', problemId: 'joi.2022-yo2-t2' });
  });

  it('accepts only a version 1 summary', () => {
    expect(isSummary(summary())).toBe(true);
    expect(isSummary({ ...summary(), version: 2 })).toBe(false);
    expect(isSummary({ version: 1 })).toBe(false);
    expect(isSummary(null)).toBe(false);
  });
});
