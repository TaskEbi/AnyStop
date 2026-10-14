import { useState, type CSSProperties } from 'react';
import { formatMinutes } from './duration';
import type { TopicTotal } from './stats';
import { topicColour, topicName, useTopics } from './useLog';

/**
 * One row per topic: swatch, name, a bar scaled to the biggest topic, the time and its share.
 * With `expandable`, a topic with subcategory time opens to show the breakdown
 * (direct entries appear as "No subcategory"), each counted once.
 */
export function TopicBars({ totals, expandable = false }: { totals: TopicTotal[]; expandable?: boolean }) {
  const topics = useTopics();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const max = Math.max(1, ...totals.map((t) => t.minutes));
  const sum = totals.reduce((n, t) => n + t.minutes, 0) || 1;

  return (
    <ul className="topic-bars">
      {totals.map((t) => {
        const name = topicName(topics, t.topicId);
        const archived = !!topics.get(t.topicId)?.archived_at;
        const hasSubs = t.subs.some((s) => s.id);
        const isOpen = open.has(t.topicId);
        const head = (
          <>
            <span className="topic-bars__name">
              <span className="topic-bars__swatch" aria-hidden="true" />
              {name}
              {archived && <span className="topic-chip__tag">archived</span>}
            </span>
            <span className="topic-bars__track" aria-hidden="true">
              <span className="topic-bars__fill" style={{ width: `${(t.minutes / max) * 100}%` }} />
            </span>
            <span className="topic-bars__value type">
              {formatMinutes(t.minutes)}
              <span className="topic-bars__pct"> · {Math.round((t.minutes / sum) * 100)}%</span>
            </span>
          </>
        );
        return (
          <li key={t.topicId} style={{ '--c': topicColour(topics, t.topicId) } as CSSProperties}>
            {expandable && hasSubs ? (
              <button
                type="button"
                className="topic-bars__row topic-bars__row--button"
                aria-expanded={isOpen}
                onClick={() =>
                  setOpen((s) => {
                    const next = new Set(s);
                    if (isOpen) next.delete(t.topicId);
                    else next.add(t.topicId);
                    return next;
                  })
                }
              >
                {head}
              </button>
            ) : (
              <div className="topic-bars__row">{head}</div>
            )}
            {(!expandable || isOpen) && hasSubs && (
              <ul className="topic-bars__subs">
                {t.subs.map((s) => (
                  <li key={s.id ?? 'none'} className="topic-bars__sub">
                    <span>{s.id ? topicName(topics, s.id) : 'No subcategory'}</span>
                    <span className="type">{formatMinutes(s.minutes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
