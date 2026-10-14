import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { formatMinutes, shortMinutes } from './duration';
import { heatLevel } from './stats';

/**
 * Hand-built SVG charts in the cabinet's inks. Bars are capped at 24px with a 4px rounded
 * top and a 2px paper gap between stacked segments; gridlines are hairlines. Text always
 * wears ink tokens, never a topic colour. Every mark has a hover/focus readout, and each
 * chart has a table of the same numbers underneath.
 */

export interface Column {
  key: string;
  /** Under the axis (may be blank to thin out crowded labels). */
  tick: string;
  /** Tooltip heading, e.g. "Mon 13 Oct". */
  title: string;
  segments: { id: string; minutes: number }[];
  /** Days still to come: drawn as an empty slot. */
  future?: boolean;
}

interface Series {
  colourOf: (id: string) => string;
  nameOf: (id: string) => string;
}

/** How a chart reads its numbers: durations by default, or e.g. a score with fixed ticks. */
export interface Scale {
  /** Fixed gridlines; otherwise clean time steps up to the tallest bar. */
  ticks?: number[];
  /** Axis ticks and table cells: "1h 30m". */
  short: (n: number) => string;
  /** Readouts: "1 hr 30 min". */
  long: (n: number) => string;
}
export const MINUTES: Scale = { short: shortMinutes, long: formatMinutes };

const H = 210;
const PAD = { top: 12, right: 6, bottom: 26, left: 40 };
const GAP = 2;
const RADIUS = 4;

/** Clean tick steps in minutes: 15m, 30m, 1h, 2h… */
function niceTicks(max: number): number[] {
  const steps = [15, 30, 60, 120, 180, 240, 300, 600, 900, 1200, 1800, 3000, 6000];
  const step = steps.find((s) => max / s <= 4) ?? Math.ceil(max / 4 / 600) * 600;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const out: number[] = [];
  for (let v = 0; v <= top; v += step) out.push(v);
  return out;
}

/** A bar segment; only the topmost one gets the rounded data end. */
function segmentPath(x: number, y: number, w: number, h: number, rounded: boolean): string {
  const r = rounded ? Math.min(RADIUS, w / 2, h) : 0;
  return `M${x},${y + h}V${y + r}${r ? `Q${x},${y} ${x + r},${y}` : ''}H${x + w - r}${r ? `Q${x + w},${y} ${x + w},${y + r}` : ''}V${y + h}Z`;
}

/** The element's real width, so the SVG draws at 1:1 and its text stays readable on a phone. */
function useWidth(ref: RefObject<HTMLElement | null>, fallback: number): number {
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => el.clientWidth && setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

export function ColumnChart({ columns, series, label, scale = MINUTES }: { columns: Column[]; series: Series; label: string; scale?: Scale }) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const W = useWidth(box, 640);
  const totals = columns.map((c) => c.segments.reduce((n, s) => n + s.minutes, 0));
  const ticks = scale.ticks ?? niceTicks(Math.max(30, ...totals));
  const top = ticks[ticks.length - 1];
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / columns.length;
  const barW = Math.min(24, Math.max(4, band * 0.62));
  const y = (m: number) => PAD.top + plotH - (m / top) * plotH;

  const active = hover != null ? columns[hover] : null;
  const activeTotal = hover != null ? totals[hover] : 0;
  // Near either edge the readout hangs inward so it never spills off the card.
  const tipAt = hover != null ? (PAD.left + band * hover + band / 2) / W : 0;
  const tipShift = tipAt < 0.2 ? '-12%' : tipAt > 0.8 ? '-88%' : '-50%';

  return (
    <div className="chart" ref={box} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="chart__svg" role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart__grid" />
            <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="chart__tick">
              {t === 0 ? '0' : scale.short(t)}
            </text>
          </g>
        ))}
        {columns.map((c, i) => {
          const cx = PAD.left + band * i + band / 2;
          const x = cx - barW / 2;
          let base = y(0);
          const drawn = c.segments.filter((s) => s.minutes > 0);
          return (
            <g
              key={c.key}
              className={`chart__col ${hover === i ? 'is-hover' : ''} ${c.future ? 'is-future' : ''}`}
              tabIndex={0}
              role="img"
              aria-label={`${c.title}: ${totals[i] ? scale.long(totals[i]) : 'nothing logged'}`}
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            >
              <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH + PAD.bottom} className="chart__hit" />
              {drawn.map((s, k) => {
                const h = (s.minutes / top) * plotH;
                const isTop = k === drawn.length - 1;
                // The 2px paper gap sits on top of every segment except the last.
                const hh = Math.max(1, isTop ? h : h - GAP);
                const yy = base - h + (isTop ? 0 : GAP);
                base -= h;
                return <path key={s.id} d={segmentPath(x, yy, barW, hh, isTop)} style={{ fill: series.colourOf(s.id) }} />;
              })}
              {c.tick && (
                <text x={cx} y={H - 8} textAnchor="middle" className="chart__tick">
                  {c.tick}
                </text>
              )}
            </g>
          );
        })}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} className="chart__axis" />
      </svg>
      {active && (
        <div
          className="chart__tip"
          style={{ left: `${tipAt * 100}%`, translate: `${tipShift} 0` }}
          role="status"
        >
          <span className="chart__tip-title type">{active.title}</span>
          <strong className="chart__tip-total">{activeTotal ? scale.long(activeTotal) : 'Nothing logged'}</strong>
          {active.segments
            .filter((s) => s.minutes > 0)
            .sort((a, b) => b.minutes - a.minutes)
            .map((s) => (
              <span key={s.id} className="chart__tip-row">
                <span className="chart__key" style={{ background: series.colourOf(s.id) }} aria-hidden="true" />
                <strong>{scale.long(s.minutes)}</strong> {series.nameOf(s.id)}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

/** Legend: always shown for two or more series, in the same order as the stack. */
export function Legend({ ids, series }: { ids: string[]; series: Series }) {
  if (ids.length < 2) return null;
  return (
    <ul className="chart-legend" aria-label="Legend">
      {ids.map((id) => (
        <li key={id}>
          <span className="chart__key chart__key--box" style={{ background: series.colourOf(id) }} aria-hidden="true" />
          {series.nameOf(id)}
        </li>
      ))}
    </ul>
  );
}

/** The numbers behind a column chart, for anyone who'd rather read than hover. */
export function ChartTable({ columns, ids, series, caption, scale = MINUTES }: { columns: Column[]; ids: string[]; series: Series; caption: string; scale?: Scale }) {
  return (
    <details className="chart-table">
      <summary className="type">Show as a table</summary>
      <div className="chart-table__scroll">
        <table>
          <caption className="visually-hidden">{caption}</caption>
          <thead>
            <tr>
              <th scope="col">When</th>
              {ids.map((id) => (
                <th key={id} scope="col">
                  {series.nameOf(id)}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {columns
              .filter((c) => !c.future)
              .map((c) => {
                const by = new Map(c.segments.map((s) => [s.id, s.minutes]));
                const total = c.segments.reduce((n, s) => n + s.minutes, 0);
                return (
                  <tr key={c.key}>
                    <th scope="row">{c.title}</th>
                    {ids.map((id) => (
                      <td key={id}>{by.get(id) ? scale.short(by.get(id)!) : '–'}</td>
                    ))}
                    <td>{total ? scale.short(total) : '–'}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export interface HeatDay {
  date: string;
  minutes: number;
  title: string;
  future: boolean;
}

/** Calendar heatmap: one column per week (Monday on top), one ink, darker = more time. */
export function Heatmap({ weeks, label }: { weeks: HeatDay[][]; label: string }) {
  const [hover, setHover] = useState<HeatDay | null>(null);
  const max = Math.max(0, ...weeks.flat().map((d) => d.minutes));
  return (
    <div className="heatmap" onPointerLeave={() => setHover(null)}>
      <div className="heatmap__grid" role="img" aria-label={label} style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((week, w) => (
          <div key={w} className="heatmap__week">
            {week.map((d) => (
              <span
                key={d.date}
                className={`heatmap__cell heat-${d.future ? 'future' : heatLevel(d.minutes, max)}`}
                onPointerEnter={() => setHover(d)}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="heatmap__foot">
        <span className="heatmap__readout type" aria-live="polite">
          {hover ? `${hover.title}: ${hover.minutes ? formatMinutes(hover.minutes) : 'nothing logged'}` : 'Point at a day to see it'}
        </span>
        <span className="heatmap__scale type" aria-hidden="true">
          Less
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className={`heatmap__cell heat-${l}`} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
