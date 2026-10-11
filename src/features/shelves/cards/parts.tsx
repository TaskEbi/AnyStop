import { useState, type ReactNode } from 'react';
import type { Item, Room } from '../../../data/types';
import { accession } from '../../../lib/format';

/** Typewritten catalogue line: "No. 0042 · SPACE". */
export function CardMeta({ item, room, className = '' }: { item: Item; room: Room | undefined; className?: string }) {
  return (
    <p className={`card-meta ${className}`}>
      <span>{accession(item.accession_no)}</span>
      <span aria-hidden="true"> · </span>
      <span>{room?.name ?? 'Unsorted'}</span>
      {item.is_example && <span className="card-meta__example">example</span>}
    </p>
  );
}

/** Lazy image that quietly falls back to `fallback` if it fails to load. */
export function CardImage({ src, alt = '', fallback, className = '' }: { src: string | null; alt?: string; fallback?: ReactNode; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <>{fallback ?? null}</>;
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setFailed(src)}
    />
  );
}
