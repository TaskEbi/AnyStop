import type { LogEntry, LogTopic } from '../../data/types';
import { isDate } from './dates';
import { MAX_ENTRY_MINUTES } from './duration';

export const MAX_NOTE = 1000;
export const MAX_TOPIC_NAME = 60;
/** A week has 168 hours; a weekly goal can't ask for more. */
export const MAX_GOAL_MINUTES = 7 * 24 * 60;

export type EntryDraft = Pick<LogEntry, 'date' | 'topic_id' | 'subcategory_id' | 'minutes' | 'note'>;

/**
 * Whether an entry may be saved. New choices must be active topics/subcategories; an edit
 * may keep the archived topic or subcategory it already had.
 */
export function checkEntry(draft: EntryDraft, topics: Map<string, LogTopic>, today: string, previous?: LogEntry): string | null {
  if (!isDate(draft.date)) return 'Pick a date.';
  if (draft.date > today) return "You can't log time for a day that hasn't happened yet.";
  const topic = topics.get(draft.topic_id);
  if (!topic || topic.deleted_at || topic.parent_id) return 'Pick a topic.';
  const keptTopic = previous?.topic_id === draft.topic_id;
  if (topic.archived_at && !keptTopic) return `${topic.name} is archived; pick an active topic.`;
  if (draft.subcategory_id) {
    const sub = topics.get(draft.subcategory_id);
    if (!sub || sub.deleted_at || sub.parent_id !== draft.topic_id) return "That subcategory doesn't belong to this topic.";
    const keptSub = keptTopic && previous?.subcategory_id === draft.subcategory_id;
    if (sub.archived_at && !keptSub) return `${sub.name} is archived; pick another.`;
  }
  if (!Number.isInteger(draft.minutes) || draft.minutes < 1 || draft.minutes > MAX_ENTRY_MINUTES) return 'Enter between 1 minute and 24 hours.';
  if (draft.note && draft.note.length > MAX_NOTE) return `Keep the note under ${MAX_NOTE} characters.`;
  return null;
}

/** Trimmed name, or a message: not blank, not too long, not a duplicate (any case) of an active sibling. */
export function checkTopicName(
  name: string,
  parentId: string | null,
  topics: Iterable<LogTopic>,
  exceptId?: string,
): { name: string } | { error: string } {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) return { error: 'Give it a name.' };
  if (clean.length > MAX_TOPIC_NAME) return { error: `Keep names under ${MAX_TOPIC_NAME} characters.` };
  const key = clean.toLocaleLowerCase();
  for (const t of topics) {
    if (t.id === exceptId || t.deleted_at || t.archived_at || t.parent_id !== parentId) continue;
    if (t.name.toLocaleLowerCase() === key) return { error: `There's already ${parentId ? 'a subcategory' : 'a topic'} called ${t.name}.` };
  }
  return { name: clean };
}
