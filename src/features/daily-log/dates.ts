/**
 * Calendar-date arithmetic for the Daily Log. Dates are plain "YYYY-MM-DD" strings; the
 * maths runs on UTC midnights, so no device time zone or daylight-saving change can
 * shift a logged day. Only "what is today" depends on a time zone, and that is the
 * Daily Log's own setting, not the device's.
 */

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && toIso(toMs(s)) === s;

function toMs(date: string): number {
  return Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
}

function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Today's calendar date in a time zone (falls back to the device's zone if the name is unknown). */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const fmt = (tz?: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  try {
    return fmt(timeZone);
  } catch {
    return fmt();
  }
}

export function addDays(date: string, n: number): string {
  return toIso(toMs(date) + n * DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: string): number {
  return (new Date(toMs(date)).getUTCDay() + 6) % 7;
}

/** The Monday that starts the week containing `date`. */
export function weekStart(date: string): string {
  return addDays(date, -weekdayIndex(date));
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function monthEnd(date: string): string {
  const y = +date.slice(0, 4);
  const m = +date.slice(5, 7);
  return toIso(Date.UTC(y, m, 0));
}

export function addMonths(date: string, n: number): string {
  const y = +date.slice(0, 4);
  const m = +date.slice(5, 7) - 1 + n;
  return toIso(Date.UTC(y, m, 1));
}

/** Inclusive list of dates from `from` to `to`. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let ms = toMs(from), end = toMs(to); ms <= end; ms += DAY_MS) out.push(toIso(ms));
  return out;
}

export function dayCount(from: string, to: string): number {
  return Math.round((toMs(to) - toMs(from)) / DAY_MS) + 1;
}

const parts = (date: string) => {
  const d = new Date(toMs(date));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), w: d.getUTCDay() };
};

/** "Mon 13 Oct" (with the year when it isn't `thisYear`). */
export function shortDay(date: string, thisYear?: string): string {
  const p = parts(date);
  const year = thisYear && thisYear.slice(0, 4) !== String(p.y) ? ` ${p.y}` : '';
  return `${WEEKDAYS[p.w]} ${p.d} ${MONTHS[p.m]}${year}`;
}

/** "Monday 13 October 2026" */
export function longDay(date: string): string {
  const p = parts(date);
  return `${WEEKDAYS_LONG[p.w]} ${p.d} ${MONTHS_LONG[p.m]} ${p.y}`;
}

/** "Today", "Yesterday", or "Mon 13 Oct". */
export function relativeDay(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  return shortDay(date, today);
}

export const weekdayLetter = (date: string) => WEEKDAYS[parts(date).w];
export const dayOfMonth = (date: string) => parts(date).d;
export const monthName = (date: string, long = false) => (long ? MONTHS_LONG : MONTHS)[parts(date).m];

/** "13 – 19 Oct 2026", "29 Sep – 5 Oct 2026", "29 Dec 2025 – 4 Jan 2026". */
export function rangeLabel(from: string, to: string): string {
  const a = parts(from);
  const b = parts(to);
  if (from === to) return `${b.d} ${MONTHS[b.m]} ${b.y}`;
  if (a.y !== b.y) return `${a.d} ${MONTHS[a.m]} ${a.y} – ${b.d} ${MONTHS[b.m]} ${b.y}`;
  if (a.m !== b.m) return `${a.d} ${MONTHS[a.m]} – ${b.d} ${MONTHS[b.m]} ${b.y}`;
  return `${a.d} – ${b.d} ${MONTHS[b.m]} ${b.y}`;
}

/** A few zones worth offering first; the full list follows when the browser has one. */
export function timeZones(): string[] {
  const all = (Intl as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  return all.length ? all : ['Asia/Singapore', 'UTC'];
}
