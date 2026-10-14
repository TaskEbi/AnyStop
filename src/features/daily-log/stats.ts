/**
 * Everything the Daily Log shows is derived here from the entries themselves; no running
 * totals are stored. A topic's total counts its direct entries and its subcategories'
 * entries exactly once. Archived topics still count; deleted entries never do.
 */
import type { LogEntry, LogGoal, LogTopic } from '../../data/types';
import { addDays, addMonths, daysBetween, weekStart as mondayOf } from './dates';

export const sumMinutes = (entries: LogEntry[]) => entries.reduce((n, e) => n + e.minutes, 0);

/** Live entries from `from` to `to` inclusive (dates compare as strings). */
export function inRange(entries: Iterable<LogEntry>, from: string, to: string): LogEntry[] {
  const out: LogEntry[] = [];
  for (const e of entries) if (!e.deleted_at && e.date >= from && e.date <= to) out.push(e);
  return out;
}

export interface SubTotal {
  /** null = logged against the topic itself ("No subcategory"). */
  id: string | null;
  minutes: number;
}
export interface TopicTotal {
  topicId: string;
  minutes: number;
  subs: SubTotal[];
}

/** Per top-level topic, biggest first, each with its subcategory breakdown (also biggest first). */
export function topicTotals(entries: LogEntry[]): TopicTotal[] {
  const byTopic = new Map<string, Map<string | null, number>>();
  for (const e of entries) {
    const subs = byTopic.get(e.topic_id) ?? new Map<string | null, number>();
    subs.set(e.subcategory_id, (subs.get(e.subcategory_id) ?? 0) + e.minutes);
    byTopic.set(e.topic_id, subs);
  }
  return [...byTopic.entries()]
    .map(([topicId, subs]) => ({
      topicId,
      minutes: [...subs.values()].reduce((a, b) => a + b, 0),
      subs: [...subs.entries()].map(([id, minutes]) => ({ id, minutes })).sort((a, b) => b.minutes - a.minutes),
    }))
    .sort((a, b) => b.minutes - a.minutes);
}

export interface Bucket {
  /** First day of the bucket (a day, or the 1st of a month). */
  key: string;
  minutes: number;
  byTopic: Map<string, number>;
}

function bucketise(entries: LogEntry[], keys: string[], keyOf: (date: string) => string): Bucket[] {
  const buckets = new Map(keys.map((k) => [k, { key: k, minutes: 0, byTopic: new Map<string, number>() }]));
  for (const e of entries) {
    const b = buckets.get(keyOf(e.date));
    if (!b) continue;
    b.minutes += e.minutes;
    b.byTopic.set(e.topic_id, (b.byTopic.get(e.topic_id) ?? 0) + e.minutes);
  }
  return keys.map((k) => buckets.get(k)!);
}

/** One bucket per day from `from` to `to`, empty days included. */
export function dayBuckets(entries: LogEntry[], from: string, to: string): Bucket[] {
  return bucketise(inRange(entries, from, to), daysBetween(from, to), (d) => d);
}

/** One bucket per calendar month of `year` ("2026"). */
export function monthBuckets(entries: LogEntry[], year: string): Bucket[] {
  const keys = Array.from({ length: 12 }, (_, i) => addMonths(`${year}-01-01`, i));
  return bucketise(inRange(entries, `${year}-01-01`, `${year}-12-31`), keys, (d) => `${d.slice(0, 7)}-01`);
}

/** Weekly totals for `count` weeks ending with the week starting `lastMonday`, optionally for one topic. */
export function weekBuckets(entries: LogEntry[], lastMonday: string, count: number, topicId?: string | null): Bucket[] {
  const keys = Array.from({ length: count }, (_, i) => addDays(lastMonday, -7 * (count - 1 - i)));
  const picked = inRange(entries, keys[0], addDays(lastMonday, 6)).filter((e) => !topicId || e.topic_id === topicId);
  return bucketise(picked, keys, mondayOf);
}

export interface PeriodSummary {
  total: number;
  /** Days in the period up to and including today (future days don't dilute the average). */
  elapsedDays: number;
  activeDays: number;
  average: number;
  best: { date: string; minutes: number } | null;
}

export function periodSummary(entries: LogEntry[], from: string, to: string, today: string): PeriodSummary {
  const end = to < today ? to : today;
  const days = end >= from ? dayBuckets(entries, from, end) : [];
  const total = days.reduce((n, d) => n + d.minutes, 0);
  let best: PeriodSummary['best'] = null;
  for (const d of days) if (d.minutes && (!best || d.minutes > best.minutes)) best = { date: d.key, minutes: d.minutes };
  return {
    total,
    elapsedDays: days.length,
    activeDays: days.filter((d) => d.minutes > 0).length,
    average: days.length ? Math.round(total / days.length) : 0,
    best,
  };
}

/** 0 = nothing logged, 1–4 = quarters of the busiest day in view. */
export function heatLevel(minutes: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((minutes / max) * 4))) as 1 | 2 | 3 | 4;
}

// ─── weekly goals ────────────────────────────────────────────────────────────

/**
 * The target in force for a topic in the week starting `monday`: the latest revision that
 * took effect on or before that Monday. null when there's no goal (never set, or removed).
 */
export function goalFor(goals: Iterable<LogGoal>, topicId: string, monday: string): number | null {
  let pick: LogGoal | null = null;
  for (const g of goals) {
    if (g.deleted_at || g.topic_id !== topicId || g.week_start > monday) continue;
    if (!pick || g.week_start > pick.week_start || (g.week_start === pick.week_start && g.updated_at > pick.updated_at)) pick = g;
  }
  return pick?.minutes ?? null;
}

export interface GoalProgress {
  /** True percentage, may exceed 100. */
  pct: number;
  /** Fill for the bar, capped at 1. */
  fill: number;
  remaining: number;
  extra: number;
  reached: boolean;
}

export function goalProgress(actual: number, target: number): GoalProgress {
  const pct = Math.round((actual / target) * 100);
  return {
    pct,
    fill: Math.min(1, actual / target),
    remaining: Math.max(0, target - actual),
    extra: Math.max(0, actual - target),
    reached: actual >= target,
  };
}

// ─── topics ─────────────────────────────────────────────────────────────────

/** Top-level topics in their manual order (archived ones too, unless `activeOnly`). */
export function topLevel(topics: Iterable<LogTopic>, activeOnly = false): LogTopic[] {
  return [...topics]
    .filter((t) => !t.deleted_at && !t.parent_id && (!activeOnly || !t.archived_at))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

/** A topic's subcategories in order (archived too, unless `activeOnly`). */
export function childrenOf(topics: Iterable<LogTopic>, parentId: string, activeOnly = false): LogTopic[] {
  return [...topics]
    .filter((t) => !t.deleted_at && t.parent_id === parentId && (!activeOnly || !t.archived_at))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}
