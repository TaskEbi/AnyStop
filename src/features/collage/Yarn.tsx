import { memo } from 'react';
import type { Connection } from '../../data/types';
import type { Rect } from './layout';

/** Where a string is pinned on a card: near the top, under the tape. */
const pinOf = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + 22 });

interface Props {
  connections: Connection[];
  rects: Map<string, Rect>;
  /** Card currently being dragged, so its strings follow it. */
  override?: { id: string; x: number; y: number } | null;
}

/** Red yarn between tied cards: sagging curves, pins at both ends, a paper tag for the label. */
function YarnImpl({ connections, rects, override }: Props) {
  const rectOf = (id: string) => {
    const r = rects.get(id);
    return r && override?.id === id ? { ...r, x: override.x, y: override.y } : r;
  };
  return (
    <svg className="yarn" aria-hidden="true">
      <defs>
        <radialGradient id="pin-head" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ff8a7a" />
          <stop offset="55%" stopColor="var(--thread)" />
          <stop offset="100%" stopColor="#5e110c" />
        </radialGradient>
      </defs>
      {connections.map((c) => {
        const ra = rectOf(c.item_a);
        const rb = rectOf(c.item_b);
        if (!ra || !rb) return null;
        const a = pinOf(ra);
        const b = pinOf(rb);
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2 + Math.min(140, 30 + d * 0.16);
        const mx = (a.x + 2 * cx + b.x) / 4;
        const my = (a.y + 2 * cy + b.y) / 4;
        const label = c.label ?? '';
        const lw = label.length * 7.4 + 16;
        return (
          <g key={c.id}>
            <path className="yarn__shadow" d={`M${a.x},${a.y + 5} Q${cx},${cy + 8} ${b.x},${b.y + 5}`} />
            <path className="yarn__thread" d={`M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`} />
            {label && (
              <g transform={`translate(${mx} ${my}) rotate(${((c.id.charCodeAt(0) % 9) - 4).toFixed(0)})`}>
                <rect className="yarn__tag" x={-lw / 2} y={-11} width={lw} height={22} rx={2} />
                <circle className="yarn__tag-hole" cx={-lw / 2 + 7} cy={0} r={2.2} />
                <text className="yarn__label" x={4} y={4} textAnchor="middle">
                  {label}
                </text>
              </g>
            )}
          </g>
        );
      })}
      {/* pins on top of every thread end */}
      {[...new Set(connections.flatMap((c) => [c.item_a, c.item_b]))].map((id) => {
        const r = rectOf(id);
        if (!r) return null;
        const p = pinOf(r);
        return (
          <g key={id}>
            <ellipse cx={p.x + 2} cy={p.y + 4} rx={6} ry={3} className="yarn__pin-shadow" />
            <circle cx={p.x} cy={p.y} r={6.5} fill="url(#pin-head)" />
          </g>
        );
      })}
    </svg>
  );
}

export const Yarn = memo(YarnImpl);
