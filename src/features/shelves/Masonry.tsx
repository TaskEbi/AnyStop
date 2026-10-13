import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { data } from '../../data/store';
import type { Design, Item } from '../../data/types';
import { estimateCardHeight as estimate } from '../../lib/cardSize';
import { useStore } from '../../lib/createStore';

/** Minimum column width and gap for each design theme: Archive packs tight, Gallery leaves room. */
const GRID: Record<Design, { min: number; gap: number }> = {
  cabinet: { min: 230, gap: 28 },
  gallery: { min: 260, gap: 32 },
  zine: { min: 240, gap: 26 },
  archive: { min: 200, gap: 16 },
  soft: { min: 240, gap: 24 },
};
const MIN_COL_NARROW = 150;

/** Masonry grid: items fill the shortest column, so the top row still reads newest-first. */
export function Masonry({ items, render }: { items: Item[]; render: (item: Item, index: number) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const grid = GRID[useStore(data, (s) => s.settings.design)] ?? GRID.cabinet;
  const gap = grid.gap;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns = useMemo(() => {
    if (!width) return [];
    const min = width < 520 ? Math.min(MIN_COL_NARROW, grid.min) : grid.min;
    const n = Math.max(1, Math.floor((width + gap) / (min + gap)));
    const colWidth = (width - gap * (n - 1)) / n;
    const cols: { items: [Item, number][]; h: number }[] = Array.from({ length: n }, () => ({ items: [], h: 0 }));
    items.forEach((item, i) => {
      let target = cols[0];
      for (const c of cols) if (c.h < target.h - 40) target = c;
      target.items.push([item, i]);
      target.h += estimate(item, colWidth) + gap;
    });
    return cols;
  }, [items, width, grid.min, gap]);

  return (
    <div ref={ref} className="masonry" style={{ gap }}>
      {columns.map((col, c) => (
        <div key={c} className="masonry__col" style={{ gap: gap + 6 }}>
          {col.items.map(([item, i]) => render(item, i))}
        </div>
      ))}
    </div>
  );
}
