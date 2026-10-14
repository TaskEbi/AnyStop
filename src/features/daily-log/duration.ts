/** Durations are whole minutes everywhere; these turn them into words and back. */

export const MAX_ENTRY_MINUTES = 1440;

/** "1 hr 30 min", "45 min", "2 hr", "0 min". */
export function formatMinutes(total: number): string {
  const m = Math.max(0, Math.round(total));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest} min`;
  return rest ? `${h} hr ${rest} min` : `${h} hr`;
}

/** Compact, for chart labels and tiles: "1h 30m", "45m", "2h". */
export function shortMinutes(total: number): string {
  const m = Math.max(0, Math.round(total));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest}m`;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

const WHOLE = /^\s*\d+\s*$/;

/**
 * Read the hours and minutes fields. Each must be blank or a whole number; minutes 0–59;
 * the total 1 min (or `min`) – 24 hr. Returns the minutes, or a message saying what's wrong.
 */
export function parseDuration(hours: string, minutes: string, max = MAX_ENTRY_MINUTES, min = 1): { minutes: number } | { error: string } {
  const h = hours.trim() === '' ? 0 : WHOLE.test(hours) ? Number(hours) : NaN;
  const m = minutes.trim() === '' ? 0 : WHOLE.test(minutes) ? Number(minutes) : NaN;
  if (Number.isNaN(h) || Number.isNaN(m)) return { error: 'Use whole numbers for hours and minutes.' };
  if (m > 59) return { error: 'Minutes go from 0 to 59.' };
  const total = h * 60 + m;
  if (total < min) return { error: 'Enter how long, at least 1 minute.' };
  if (total > max) return { error: `That's more than ${formatMinutes(max)}.` };
  return { minutes: total };
}

/** Split minutes back into the two fields ("" for a zero hour, so the field shows its placeholder). */
export function splitMinutes(total: number): { hours: string; minutes: string } {
  const h = Math.floor(total / 60);
  return { hours: h ? String(h) : '', minutes: String(total % 60) };
}
