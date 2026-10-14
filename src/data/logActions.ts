/** Daily Log changes: topics, entries and weekly goals. Every write goes through `commit`, so it is local-first and syncs. */
import { hash, uuid } from '../lib/random';
import { todayIn } from '../features/daily-log/dates';
import { childrenOf, topLevel } from '../features/daily-log/stats';
import { checkEntry, checkTopicName, MAX_GOAL_MINUTES, metricMax, type EntryDraft } from '../features/daily-log/validate';
import { commit, commitSettings, data } from './store';
import { ROOM_COLORS, type LogDayMetric, type LogEntry, type LogGoal, type LogMetric, type LogTopic, type RoomColor } from './types';

const now = () => new Date().toISOString();

export const logToday = () => todayIn(data.get().settings.log_timezone);

// ─── topics ─────────────────────────────────────────────────────────────────

/**
 * Topic colours are handed out in this order. The first five were picked with the palette
 * validator: neighbours stay apart (ΔE ≥ 14.9) under protan/deutan simulation, day and night.
 */
export const TOPIC_COLOR_ORDER: RoomColor[] = ['blue', 'mustard', 'plum', 'olive', 'navy', 'cherry', 'teal', 'coral', 'forest', 'magenta', 'sky', 'charcoal'];

function nextTopicColor(): RoomColor {
  const used = topLevel(data.get().log_topics.values(), true).map((t) => t.color);
  const order = [...TOPIC_COLOR_ORDER, ...ROOM_COLORS.filter((c) => !TOPIC_COLOR_ORDER.includes(c))];
  return order.find((c) => !used.includes(c)) ?? order[used.length % order.length];
}

function siblings(parentId: string | null): LogTopic[] {
  const all = data.get().log_topics.values();
  return parentId ? childrenOf(all, parentId) : topLevel(all);
}

export function createTopic(name: string, parentId: string | null = null, color?: RoomColor): LogTopic | { error: string } {
  const st = data.get();
  const checked = checkTopicName(name, parentId, st.log_topics.values());
  if ('error' in checked) return checked;
  const parent = parentId ? st.log_topics.get(parentId) : null;
  if (parentId && (!parent || parent.parent_id || parent.deleted_at)) return { error: 'Subcategories go one level deep, under a topic.' };
  const sibs = siblings(parentId);
  const t = now();
  const topic: LogTopic = {
    id: uuid(),
    parent_id: parentId,
    name: checked.name,
    color: parent?.color ?? color ?? nextTopicColor(),
    sort_order: sibs.length ? sibs[sibs.length - 1].sort_order + 1 : 1,
    archived_at: null,
    created_at: t,
    updated_at: t,
    deleted_at: null,
  };
  commit('log_topics', [topic]);
  return topic;
}

export function renameTopic(id: string, name: string): string | null {
  const st = data.get();
  const topic = st.log_topics.get(id);
  if (!topic) return null;
  const checked = checkTopicName(name, topic.parent_id, st.log_topics.values(), id);
  if ('error' in checked) return checked.error;
  if (checked.name !== topic.name) commit('log_topics', [{ ...topic, name: checked.name, updated_at: now() }]);
  return null;
}

export function recolourTopic(id: string, color: RoomColor) {
  const topic = data.get().log_topics.get(id);
  if (topic && topic.color !== color) commit('log_topics', [{ ...topic, color, updated_at: now() }]);
}

export function moveTopic(id: string, direction: -1 | 1) {
  const topic = data.get().log_topics.get(id);
  if (!topic) return;
  const order = siblings(topic.parent_id);
  const i = order.findIndex((t) => t.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  const t = now();
  commit('log_topics', order.flatMap((x, k) => (x.sort_order === k + 1 ? [] : [{ ...x, sort_order: k + 1, updated_at: t }])));
}

/** Archive: kept with all its history, but no longer offered for new entries. */
export function archiveTopic(id: string) {
  const topic = data.get().log_topics.get(id);
  if (topic && !topic.archived_at) commit('log_topics', [{ ...topic, archived_at: now(), updated_at: now() }]);
}

export function restoreTopic(id: string): string | null {
  const st = data.get();
  const topic = st.log_topics.get(id);
  if (!topic?.archived_at) return null;
  const checked = checkTopicName(topic.name, topic.parent_id, st.log_topics.values(), id);
  if ('error' in checked) return `${checked.error} Rename one of them first.`;
  commit('log_topics', [{ ...topic, archived_at: null, updated_at: now() }]);
  return null;
}

export const STARTER_TOPICS: { name: string; color: RoomColor; subs: string[] }[] = [
  { name: 'Schoolwork', color: 'blue', subs: ['Maths', 'English', 'Science'] },
  { name: 'Violin', color: 'mustard', subs: ['Scales', 'Pieces'] },
  { name: 'Sports', color: 'plum', subs: ['Running', 'Swimming'] },
];

/** Offer a starting set (skipping any that already exist). Adds no entries or goals. */
export function addStarterTopics() {
  for (const s of STARTER_TOPICS) {
    const made = createTopic(s.name, null, s.color);
    if ('error' in made) continue;
    for (const sub of s.subs) createTopic(sub, made.id);
  }
}

// ─── entries ────────────────────────────────────────────────────────────────

export function addEntry(draft: EntryDraft): LogEntry | { error: string } {
  const st = data.get();
  const error = checkEntry(draft, st.log_topics, logToday());
  if (error) return { error };
  const t = now();
  const entry: LogEntry = { id: uuid(), ...draft, note: draft.note?.trim() || null, created_at: t, updated_at: t, deleted_at: null };
  commit('log_entries', [entry]);
  return entry;
}

export function updateEntry(id: string, draft: EntryDraft): string | null {
  const st = data.get();
  const prev = st.log_entries.get(id);
  if (!prev || prev.deleted_at) return 'That entry has gone.';
  const error = checkEntry(draft, st.log_topics, logToday(), prev);
  if (error) return error;
  commit('log_entries', [{ ...prev, ...draft, note: draft.note?.trim() || null, updated_at: now() }]);
  return null;
}

/** Returns the deletion time, which `restoreEntry` needs for undo. */
export function deleteEntry(id: string): string | null {
  const entry = data.get().log_entries.get(id);
  if (!entry || entry.deleted_at) return null;
  const t = now();
  commit('log_entries', [{ ...entry, deleted_at: t, updated_at: t }]);
  return t;
}

export function restoreEntry(id: string, deletedAt: string) {
  const entry = data.get().log_entries.get(id);
  if (entry?.deleted_at === deletedAt) commit('log_entries', [{ ...entry, deleted_at: null, updated_at: now() }]);
}

// ─── weekly goals ───────────────────────────────────────────────────────────

/** A stable uuid-shaped id for a pair of keys, so every device names the same logical row alike. */
function pairId(a: string, b: string): string {
  const hex = [0, 1, 2, 3].map((i) => hash(`${a}|${b}|${i}`).toString(16).padStart(8, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * One revision per topic per week, so its id is derived from the pair: two devices editing
 * the same week's goal write the same row, and the later write wins.
 */
export const goalId = (topicId: string, weekStart: string) => pairId(topicId, weekStart);

/** Set (or with null, remove) a topic's weekly goal from the week starting `monday` onwards. */
export function setGoal(topicId: string, minutes: number | null, monday: string): string | null {
  if (minutes != null && (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_GOAL_MINUTES)) return 'A weekly goal is between 1 minute and 168 hours.';
  const id = goalId(topicId, monday);
  const existing = data.get().log_goals.get(id);
  const t = now();
  const goal: LogGoal = existing
    ? { ...existing, minutes, deleted_at: null, updated_at: t }
    : { id, topic_id: topicId, week_start: monday, minutes, created_at: t, updated_at: t, deleted_at: null };
  commit('log_goals', [goal]);
  return null;
}

// ─── sleep and screen time ──────────────────────────────────────────────────

/** One row per metric per day, named by the pair, so a second device's change replaces rather than duplicates. */
export const metricId = (metric: LogMetric, date: string) => pairId(`metric:${metric}`, date);

/** Set a day's sleep or screen time (0 – 24 hr) or sleep score (0 – 100), or clear it with null. */
export function setMetric(metric: LogMetric, date: string, minutes: number | null): string | null {
  if (date > logToday()) return "That day hasn't happened yet.";
  if (minutes != null && (!Number.isInteger(minutes) || minutes < 0 || minutes > metricMax(metric))) {
    return metric === 'sleep_score' ? 'A sleep score is a whole number from 0 to 100.' : 'Enter between 0 and 24 hours.';
  }
  const id = metricId(metric, date);
  const existing = data.get().log_metrics.get(id);
  const t = now();
  if (minutes == null) {
    if (existing && !existing.deleted_at) commit('log_metrics', [{ ...existing, deleted_at: t, updated_at: t }]);
    return null;
  }
  if (existing && !existing.deleted_at && existing.minutes === minutes) return null;
  const row: LogDayMetric = existing
    ? { ...existing, minutes, deleted_at: null, updated_at: t }
    : { id, date, metric, minutes, created_at: t, updated_at: t, deleted_at: null };
  commit('log_metrics', [row]);
  return null;
}

export function setLogTimezone(tz: string) {
  commitSettings({ log_timezone: tz });
}
