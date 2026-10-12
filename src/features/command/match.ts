/**
 * Score how well a query matches some text: whole-word starts beat substrings,
 * substrings beat scattered letters, and earlier matches beat later ones.
 * Every query word must match. Null means no match.
 */
export function matchScore(text: string, query: string): number | null {
  const hay = text.toLowerCase();
  let total = 0;
  for (const word of query.toLowerCase().split(/\s+/).filter(Boolean)) {
    const at = hay.indexOf(word);
    if (at >= 0) {
      const wordStart = at === 0 || /[\s#\-–—:(/'"“]/.test(hay[at - 1]);
      total += (wordStart ? 100 : 60) - Math.min(30, at / 4);
      continue;
    }
    // Letters in order, e.g. "kob" → "Kind of Blue".
    let i = 0;
    let gaps = 0;
    for (const ch of word) {
      const next = hay.indexOf(ch, i);
      if (next < 0) return null;
      gaps += next - i;
      i = next + 1;
    }
    total += Math.max(5, 40 - gaps);
  }
  return total;
}

/** The best `limit` entries for a query, best first (ties keep their original order). */
export function rankMatches<T>(entries: T[], query: string, text: (e: T) => string, limit: number): T[] {
  const scored: { e: T; s: number; i: number }[] = [];
  entries.forEach((e, i) => {
    const s = matchScore(text(e), query);
    if (s !== null) scored.push({ e, s, i });
  });
  return scored
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.e);
}
