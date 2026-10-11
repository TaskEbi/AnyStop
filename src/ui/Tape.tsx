import type { CSSProperties } from 'react';
import { hash } from '../lib/random';
import type { RoomColor } from '../data/types';
import { tapeVar } from './labels';
import './Tape.css';

const PATTERNS = ['stripes', 'dots', 'grid', 'plain'] as const;

/** A strip of washi tape coloured by room, with a pattern picked from the seed. */
export function Tape({ color, seed, className = '' }: { color: RoomColor | null | undefined; seed: string; className?: string }) {
  const h = hash(seed);
  const pattern = PATTERNS[h % PATTERNS.length];
  const angle = ((h >> 4) % 9) - 4;
  return (
    <span
      className={`tape tape--${pattern} ${className}`}
      style={{ '--tape': tapeVar(color), '--tape-angle': `${angle}deg` } as CSSProperties}
      aria-hidden="true"
    />
  );
}
