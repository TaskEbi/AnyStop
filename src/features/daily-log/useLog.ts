import { useEffect, useState } from 'react';
import { data } from '../../data/store';
import type { LogEntry, LogTopic } from '../../data/types';
import { useStore } from '../../lib/createStore';
import { tapeVar } from '../../ui/labels';
import { todayIn } from './dates';

/**
 * Today's date in the Daily Log time zone. Re-checked every half minute and whenever the
 * app comes back to the foreground, so leaving it open past midnight rolls over.
 */
export function useToday(): string {
  const tz = useStore(data, (s) => s.settings.log_timezone);
  const [today, setToday] = useState(() => todayIn(tz));
  useEffect(() => {
    const check = () => setToday(todayIn(tz));
    check();
    const timer = setInterval(check, 30_000);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
    };
  }, [tz]);
  return today;
}

export const useTopics = () => useStore(data, (s) => s.log_topics);
export const useEntries = () => useStore(data, (s) => s.log_entries);
export const useGoals = () => useStore(data, (s) => s.log_goals);
export const useMetrics = () => useStore(data, (s) => s.log_metrics);

/** The topic's colour as a CSS value (subcategories wear their topic's). */
export function topicColour(topics: Map<string, LogTopic>, id: string | null | undefined): string {
  const t = id ? topics.get(id) : undefined;
  const top = t?.parent_id ? topics.get(t.parent_id) : t;
  return tapeVar(top?.color ?? null);
}

export function topicName(topics: Map<string, LogTopic>, id: string | null | undefined): string {
  return (id && topics.get(id)?.name) || 'Unknown topic';
}

/** "Schoolwork › Maths", or just "Violin". */
export function entryLabel(topics: Map<string, LogTopic>, e: Pick<LogEntry, 'topic_id' | 'subcategory_id'>): string {
  const top = topicName(topics, e.topic_id);
  return e.subcategory_id ? `${top} › ${topicName(topics, e.subcategory_id)}` : top;
}
