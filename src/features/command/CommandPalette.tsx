import { useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent } from 'react';
import { updateSettings } from '../../data/actions';
import { EMPTY_FILTERS } from '../../data/filter';
import { allTags, data, liveItems, liveRooms } from '../../data/store';
import { flyTo, openAddSheet, setFilters, setView, ui } from '../../data/ui';
import { PALETTES, type Kind } from '../../data/types';
import { useStore } from '../../lib/createStore';
import { accession } from '../../lib/format';
import { Icon, type IconName } from '../../ui/Icon';
import { KIND_LABEL, PALETTE_INFO } from '../../ui/labels';
import { Sheet } from '../../ui/Sheet';
import { surprise } from '../../app/surprise';
import { rankMatches } from './match';
import './command.css';

interface Entry {
  id: string;
  label: string;
  /** Extra words to match against (not shown). */
  keywords?: string;
  hint?: string;
  group: 'Exhibits' | 'Rooms' | 'Tags' | 'Go to' | 'Do';
  icon: IconName;
  run: () => void;
}

const close = () => ui.set({ commandOpen: false });

/** Ctrl/⌘ K: jump to any exhibit, room or tag, switch views, change the lighting… */
export function CommandPalette() {
  const items = useStore(data, (s) => liveItems(s.items));
  const rooms = useStore(data, (s) => liveRooms(s.rooms));
  const tags = useStore(data, (s) => allTags(s.items));
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const entries = useMemo<Entry[]>(() => {
    const roomName = new Map(rooms.map((r) => [r.id, r.name]));
    const views = [
      ['shelves', 'Shelves', 'shelves', '1'],
      ['collage', 'Collage', 'collage', '2'],
      ['map', 'String Map', 'map', '3'],
      ['mind', 'Mind Map 3D', 'orbit', '4'],
    ] as const;
    return [
      { id: 'do:add', label: 'Add an exhibit', keywords: 'new acquire save', hint: 'N', group: 'Do', icon: 'plus', run: () => openAddSheet() },
      { id: 'do:surprise', label: 'Surprise me', keywords: 'random wander', hint: 'R', group: 'Do', icon: 'dice', run: surprise },
      ...views.map(([v, label, icon, key]): Entry => ({ id: `view:${v}`, label, keywords: 'view switch', hint: key, group: 'Go to', icon, run: () => setView(v) })),
      { id: 'do:clear', label: 'Clear all filters', keywords: 'reset show everything', group: 'Do', icon: 'filter', run: () => ui.set((s) => ({ ...s, filters: { ...EMPTY_FILTERS, sort: s.filters.sort } })) },
      { id: 'do:favourites', label: 'Show favourites', keywords: 'star', group: 'Do', icon: 'star', run: () => setFilters({ favourites: true }) },
      { id: 'do:light', label: 'Lighting: daylight', keywords: 'theme light mode', group: 'Do', icon: 'sun', run: () => updateSettings({ theme: 'light' }) },
      { id: 'do:dark', label: 'Lighting: cabinet at night', keywords: 'theme dark mode', group: 'Do', icon: 'moon', run: () => updateSettings({ theme: 'dark' }) },
      { id: 'do:system', label: 'Lighting: follow system', keywords: 'theme auto', group: 'Do', icon: 'sun', run: () => updateSettings({ theme: 'system' }) },
      ...PALETTES.map((p): Entry => ({ id: `palette:${p}`, label: `Colours: ${PALETTE_INFO[p].label}`, keywords: 'palette theme scheme', group: 'Do', icon: 'collage', run: () => updateSettings({ palette: p }) })),
      { id: 'do:rooms', label: 'Manage rooms', keywords: 'rename colour reorder', group: 'Do', icon: 'shelves', run: () => ui.set({ roomsOpen: true }) },
      { id: 'do:backoffice', label: 'Back office: export, import, bookmarklet', keywords: 'backup zip phone install', group: 'Do', icon: 'menu', run: () => ui.set({ backOfficeOpen: true }) },
      ...rooms.map((r): Entry => ({ id: `room:${r.id}`, label: r.name, keywords: 'room', hint: 'room', group: 'Rooms', icon: 'shelves', run: () => setFilters({ room: r.id }) })),
      ...tags.slice(0, 200).map((t): Entry => ({ id: `tag:${t}`, label: `#${t}`, keywords: 'tag', group: 'Tags', icon: 'filter', run: () => setFilters({ tag: t }) })),
      ...items.map(
        (i): Entry => ({
          id: i.id,
          label: i.title || 'Untitled',
          keywords: [i.creator, i.tags.join(' '), i.preview?.site_name].filter(Boolean).join(' '),
          hint: `${KIND_LABEL[i.kind]} · ${i.room_id ? (roomName.get(i.room_id) ?? 'Unsorted') : 'Unsorted'} · ${accession(i.accession_no)}`,
          group: 'Exhibits',
          icon: i.kind as Kind,
          run: () => flyTo(i.id),
        }),
      ),
    ];
  }, [items, rooms, tags]);

  const results = useMemo(() => {
    if (q.trim()) return rankMatches(entries, q, (e) => `${e.label} ${e.keywords ?? ''}`, 40);
    // Nothing typed: what I opened last, then the views and actions.
    const recent = [...items]
      .filter((i) => i.last_opened_at)
      .sort((a, b) => b.last_opened_at!.localeCompare(a.last_opened_at!))
      .slice(0, 5)
      .map((i) => entries.find((e) => e.id === i.id)!)
      .filter(Boolean);
    return [...recent, ...entries.filter((e) => e.group === 'Go to' || e.group === 'Do').slice(0, 9)];
  }, [entries, items, q]);

  const current = Math.min(active, results.length - 1);

  function run(e: Entry | undefined) {
    if (!e) return;
    close();
    // Let the dialog close first so focus and the next view settle cleanly.
    requestAnimationFrame(e.run);
  }

  function onKey(e: RKeyboardEvent) {
    const move = (to: number) => {
      e.preventDefault();
      const next = (to + results.length) % Math.max(1, results.length);
      setActive(next);
      listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
    };
    if (e.key === 'ArrowDown') move(current + 1);
    else if (e.key === 'ArrowUp') move(current - 1);
    else if (e.key === 'Enter') {
      e.preventDefault();
      run(results[current]);
    }
  }

  let lastGroup = '';
  return (
    <Sheet title="Jump to…" onClose={close} hideTitle className="command">
      <div className="command__field">
        <Icon name="search" size={18} />
        <input
          className="command__input"
          value={q}
          autoFocus
          data-autofocus
          placeholder="Jump to an exhibit, room, tag or action…"
          aria-label="Jump to"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-list"
          aria-activedescendant={results[current] ? `cmd-${current}` : undefined}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
        />
        <kbd className="command__kbd type">Esc</kbd>
      </div>
      <ul id="command-list" className="command__list" role="listbox" ref={listRef}>
        {results.map((e, i) => {
          const heading = !q.trim() && i < 5 && e.group === 'Exhibits' ? 'Recently opened' : e.group;
          const show = heading !== lastGroup;
          lastGroup = heading;
          return (
            <li key={e.id} id={`cmd-${i}`} role="option" aria-selected={i === current} data-group={show ? heading : undefined}>
              <button type="button" className="command__item" tabIndex={-1} onMouseMove={() => setActive(i)} onClick={() => run(e)}>
                <Icon name={e.icon} size={16} />
                <span className="command__label">{e.label}</span>
                {e.hint && <span className="command__hint type">{e.hint}</span>}
              </button>
            </li>
          );
        })}
        {!results.length && <li className="command__empty">Nothing matches “{q}”.</li>}
      </ul>
    </Sheet>
  );
}
