import type { CSSProperties, ReactNode } from 'react';
import { activeFilterCount, EMPTY_FILTERS, type FacetCounts, type SortKey } from '../../data/filter';
import { setFilters, ui } from '../../data/ui';
import { KINDS, type Room } from '../../data/types';
import { useStore } from '../../lib/createStore';
import { Icon } from '../../ui/Icon';
import { KIND_LABEL, STATUS_LABEL, tapeVar } from '../../ui/labels';
import './filters.css';

const SORTS: [SortKey, string][] = [
  ['newest', 'Newest'],
  ['oldest', 'Oldest'],
  ['az', 'A–Z'],
  ['opened', 'Recently opened'],
];

function Option({
  pressed,
  onClick,
  count,
  children,
  swatch,
}: {
  pressed: boolean;
  onClick: () => void;
  count?: number;
  children: ReactNode;
  swatch?: string;
}) {
  return (
    <li>
      <button
        type="button"
        className="filter-opt"
        aria-pressed={pressed}
        onClick={onClick}
        disabled={!pressed && count === 0}
        style={swatch ? ({ '--swatch': swatch } as CSSProperties) : undefined}
      >
        {swatch && <span className="filter-opt__swatch" aria-hidden="true" />}
        <span className="filter-opt__label">{children}</span>
        {count !== undefined && <span className="filter-opt__count">{count}</span>}
      </button>
    </li>
  );
}

interface Props {
  counts: FacetCounts;
  rooms: Room[];
  tags: string[];
}

/** Room, status, favourites, kind and tag filters, with counts. Used in the sidebar and the phone filter sheet. */
export function Filters({ counts, rooms, tags }: Props) {
  const f = useStore(ui, (s) => s.filters);
  const toggle = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) =>
    setFilters({ [key]: f[key] === value ? EMPTY_FILTERS[key] : value } as Partial<typeof f>);
  const visibleTags = tags.filter((t) => counts.tags.get(t) || f.tag === t).slice(0, 40);

  return (
    <div className="filters">
      <section className="filters__group">
        <div className="filters__head">
          <h3 className="filters__title hand">Rooms</h3>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => ui.set({ roomsOpen: true, filterSheetOpen: false })}>
            Manage
          </button>
        </div>
        <ul className="filters__list">
          <Option pressed={!f.room} onClick={() => setFilters({ room: null })} count={counts.all}>
            All rooms
          </Option>
          {rooms.map((r) => (
            <Option key={r.id} pressed={f.room === r.id} onClick={() => toggle('room', r.id)} count={counts.rooms.get(r.id) ?? 0} swatch={tapeVar(r.color)}>
              {r.name}
            </Option>
          ))}
          <Option pressed={f.room === 'unsorted'} onClick={() => toggle('room', 'unsorted')} count={counts.rooms.get('unsorted') ?? 0} swatch={tapeVar(null)}>
            Unsorted
          </Option>
        </ul>
      </section>

      <section className="filters__group">
        <h3 className="filters__title hand">Status</h3>
        <ul className="filters__list">
          {(['up_next', 'in_progress', 'done'] as const).map((s) => (
            <Option key={s} pressed={f.status === s} onClick={() => toggle('status', s)} count={counts.status.get(s) ?? 0}>
              {STATUS_LABEL[s]}
            </Option>
          ))}
          <Option pressed={f.favourites} onClick={() => setFilters({ favourites: !f.favourites })} count={counts.favourites}>
            <span className="filters__star" aria-hidden="true">★</span> Favourites
          </Option>
        </ul>
      </section>

      <section className="filters__group">
        <h3 className="filters__title hand">Kind</h3>
        <ul className="filters__list filters__list--kinds">
          {KINDS.map((k) => (
            <Option key={k} pressed={f.kind === k} onClick={() => toggle('kind', k)} count={counts.kinds.get(k) ?? 0}>
              <Icon name={k} size={15} /> {KIND_LABEL[k]}
            </Option>
          ))}
        </ul>
      </section>

      {visibleTags.length > 0 && (
        <section className="filters__group">
          <h3 className="filters__title hand">Tags</h3>
          <div className="chips">
            {visibleTags.map((t) => (
              <button key={t} type="button" className="chip" aria-pressed={f.tag === t} onClick={() => toggle('tag', t)}>
                #{t} <span className="filter-opt__count">{counts.tags.get(t) ?? 0}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="filters__group">
        <h3 className="filters__title hand">Sort</h3>
        <div className="chips" role="radiogroup" aria-label="Sort">
          {SORTS.map(([key, label]) => (
            <button key={key} type="button" role="radio" className="chip" aria-checked={f.sort === key} onClick={() => setFilters({ sort: key })}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {activeFilterCount(f) > 0 && (
        <button type="button" className="btn filters__clear" onClick={() => ui.set({ filters: { ...EMPTY_FILTERS, sort: f.sort } })}>
          Clear all filters
        </button>
      )}
    </div>
  );
}
