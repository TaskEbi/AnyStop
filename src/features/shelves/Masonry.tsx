import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Item } from '../../data/types';
import { estimateCardHeight as estimate } from '../../lib/cardSize';

const MIN_COL = 230;
const MIN_COL_NARROW = 150;
const GAP = 28;

/** Masonry grid: items fill the shortest column, so the top row still reads newest-first. */
export function Masonry({ items, render }: { items: Item[]; render: (item: Item, index: number) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns = useMemo(() => {
    if (!width) return [];
    const min = width < 520 ? MIN_COL_NARROW : MIN_COL;
    const n = Math.max(1, Math.floor((width + GAP) / (min + GAP)));
    const colWidth = (width - GAP * (n - 1)) / n;
    const cols: { items: [Item, number][]; h: number }[] = Array.from({ length: n }, () => ({ items: [], h: 0 }));
    items.forEach((item, i) => {
      let target = cols[0];
      for (const c of cols) if (c.h < target.h - 40) target = c;
      target.items.push([item, i]);
      target.h += estimate(item, colWidth) + GAP;
    });
    return cols;
  }, [items, width]);

  return (
    <div ref={ref} className="masonry" style={{ gap: GAP }}>
      {columns.map((col, c) => (
        <div key={c} className="masonry__col" style={{ gap: GAP + 6 }}>
          {col.items.map(([item, i]) => render(item, i))}
        </div>
      ))}
    </div>
  );
}
