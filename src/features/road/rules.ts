/** Road to IOI: the page's rules as plain functions (dates are YYYY-MM-DD in the Daily Log time zone). */
import { hash } from '../../lib/random';
import { addDays } from '../daily-log/dates';
import { ROAD_STAGES, type LogEntry, type RoadSettings, type RoadStage, type RoadStageId } from '../../data/types';
import type { DragonSummary } from './dragon';

export const STAGE_INFO: Record<RoadStageId, { name: string; short: string; letter: string; match: RegExp }> = {
  joi1: { name: 'JOI First Round', short: '1st', letter: 'A', match: /first (qualifier|round)|1st (qualifier|round)|一次予選/i },
  joi2: { name: 'JOI Second Round', short: '2nd', letter: 'B', match: /second (qualifier|round)|2nd (qualifier|round)|二次予選/i },
  final: { name: 'JOI Final Round', short: 'Final', letter: 'C', match: /final|本選/i },
  camp: { name: 'Spring Camp', short: 'Camp', letter: 'D', match: /spring camp|春合宿/i },
  ioi: { name: 'IOI', short: 'IOI', letter: 'E', match: /(^|[^J])IOI\b/ },
};

/** JOI publishes its times in Japan time, so stage times are read in this zone. */
export const STAGE_ZONE = 'Asia/Tokyo';

export interface StageWhen {
  date: string;
  time: string | null;
  zone: string;
  /** Where the date came from: set on this page, or one of DragonCode's targets. */
  from: 'road' | 'dragon';
}

/** A stage's contest day: the one set here, otherwise a matching DragonCode target (nearest upcoming first). */
export function stageWhen(id: RoadStageId, stage: RoadStage, dragon: DragonSummary | null, today: string): StageWhen | null {
  if (stage.date) return { date: stage.date, time: stage.time, zone: STAGE_ZONE, from: 'road' };
  const matches = (dragon?.targets ?? []).filter((t) => STAGE_INFO[id].match.test(t.name)).sort((a, b) => a.date.localeCompare(b.date));
  const t = matches.find((x) => x.date >= today) ?? matches.at(-1);
  return t ? { date: t.date, time: t.time, zone: t.timezone || STAGE_ZONE, from: 'dragon' } : null;
}

/** The first stage not cleared yet (null once the IOI stage is cleared). */
export function currentStage(road: RoadSettings): RoadStageId | null {
  return ROAD_STAGES.find((id) => !road.stages[id].cleared_on) ?? null;
}

/** The instant a wall-clock time in `zone` happens (midnight when there is no time). */
export function zonedInstant(date: string, time: string | null, zone: string): number {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = (time ?? '00:00').split(':').map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const offsetAt = (ms: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
        .formatToParts(new Date(ms))
        .map((x) => [x.type, x.value]),
    );
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(ms / 60_000) * 60_000;
  };
  const first = wall - offsetAt(wall);
  return wall - offsetAt(first);
}

export function countdown(ms: number): { days: number; hours: number; minutes: number; seconds: number } {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86_400), hours: Math.floor((s % 86_400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

/** Minutes trained on each day: Daily Log entries in the Road topic (and its subcategories), plus DragonCode's sessions. */
export function trainingByDay(entries: Iterable<LogEntry>, topicId: string | null, dragon: DragonSummary | null): Map<string, number> {
  const days = new Map<string, number>();
  const add = (date: string, minutes: number) => days.set(date, (days.get(date) ?? 0) + minutes);
  if (topicId) for (const e of entries) if (!e.deleted_at && e.topic_id === topicId) add(e.date, e.minutes);
  for (const d of dragon?.days ?? []) add(d.date, Math.max(d.minutes, d.results > 0 ? 1 : 0));
  return days;
}

export type DayState = 'ac' | 'miss' | 'now';

/** The last seven days, oldest first: trained, missed, or today still open. */
export function lastSeven(trained: Map<string, number>, today: string): { date: string; state: DayState }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    const done = (trained.get(date) ?? 0) > 0;
    return { date, state: done ? 'ac' : date === today ? 'now' : 'miss' };
  });
}

/** A hard day: nothing trained today or on either of the two days before. The page leads with my why. */
export function isHardDay(trained: Map<string, number>, today: string): boolean {
  return [0, 1, 2].every((n) => !(trained.get(addDays(today, -n)) ?? 0));
}

export interface ProofNote {
  date: string;
  text: string;
  source: 'log' | 'dragon';
}

/**
 * One note from my past self: what clicked on an earlier day (at least three days ago), from a Road session or a
 * DragonCode reflection. The same note all day, a different one tomorrow.
 */
export function proofNote(entries: Iterable<LogEntry>, topicId: string | null, dragon: DragonSummary | null, today: string): ProofNote | null {
  const before = addDays(today, -3);
  const notes: ProofNote[] = [];
  if (topicId) for (const e of entries) if (!e.deleted_at && e.topic_id === topicId && e.note && e.date <= before) notes.push({ date: e.date, text: e.note, source: 'log' });
  for (const r of dragon?.recent ?? []) if (r.reflection.trim() && r.date <= before) notes.push({ date: r.date, text: r.reflection.trim(), source: 'dragon' });
  if (!notes.length) return null;
  notes.sort((a, b) => a.date.localeCompare(b.date) || a.text.localeCompare(b.text));
  return notes[hash(today) % notes.length];
}

/** Today's second problem: the top of DragonCode's upsolve queue, or the general brief. */
export function upsolveLine(dragon: DragonSummary | null): { title: string; detail: string; problemId: string | null } {
  const u = dragon?.upsolve[0];
  if (!u) return { title: "Upsolve yesterday's hardest mistake", detail: '', problemId: null };
  const detail = u.reason === 'in_progress' ? 'In progress: finish it' : u.reason === 'resolve' ? 'Re-solve it without help' : `${verdictLabel(u.verdict)}: upsolve it`;
  return { title: u.title, detail, problemId: u.problemId };
}

export function verdictLabel(v: string | null): string {
  return v === 'partial' ? 'Partial' : v === 'not_submitted' ? 'Not submitted' : (v ?? 'Open');
}

/** The season the page counts towards: the IOI stage's year, or next summer's IOI. */
export function seasonYear(road: RoadSettings, today: string): number {
  if (road.stages.ioi.date) return Number(road.stages.ioi.date.slice(0, 4));
  const [y, m] = today.split('-').map(Number);
  return m >= 9 ? y + 1 : y;
}
