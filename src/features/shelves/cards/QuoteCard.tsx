import { useMemo } from 'react';
import type { CardBodyProps } from '../Card';
import { jitter } from '../../../lib/random';
import { CardMeta } from './parts';

/** Irregular torn-paper outline, stable for a given seed. */
function tornEdge(seed: string): string {
  const pts: string[] = [];
  const r = (i: number, max: number) => ((jitter(seed, i) + 1) / 2) * max;
  let n = 0;
  for (let x = 0; x <= 100; x += 5) pts.push(`${x}% ${r(n++, 5).toFixed(1)}px`);
  for (let y = 8; y <= 92; y += 12) pts.push(`calc(100% - ${r(n++, 3).toFixed(1)}px) ${y}%`);
  for (let x = 100; x >= 0; x -= 5) pts.push(`${x}% calc(100% - ${r(n++, 6).toFixed(1)}px)`);
  for (let y = 92; y >= 8; y -= 12) pts.push(`${r(n++, 3).toFixed(1)}px ${y}%`);
  return `polygon(${pts.join(', ')})`;
}

/** Torn paper scrap: the quote in large italic, "— Author" below. */
export function QuoteCard({ item, room }: CardBodyProps) {
  const text = item.body || item.title;
  const clip = useMemo(() => tornEdge(item.id), [item.id]);
  const size = text.length < 60 ? 'l' : text.length < 160 ? 'm' : 's';
  return (
    <div className="scrap" style={{ clipPath: clip }}>
      <blockquote className={`scrap__text scrap__text--${size}`}>{text}</blockquote>
      {item.creator && <p className="scrap__by">— {item.creator}</p>}
      <CardMeta item={item} room={room} />
    </div>
  );
}
