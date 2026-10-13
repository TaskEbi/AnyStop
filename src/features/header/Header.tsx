import { useState } from 'react';
import { updateSettings } from '../../data/actions';
import { clearExamples, hasExamples } from '../../data/seed';
import { data, liveItems } from '../../data/store';
import { setFilters, setView, toast, ui } from '../../data/ui';
import { PALETTES, type Theme, type ViewName } from '../../data/types';
import { useStore } from '../../lib/createStore';
import { plural } from '../../lib/format';
import { Icon, type IconName } from '../../ui/Icon';
import { InlineConfirm } from '../../ui/InlineConfirm';
import { PALETTE_INFO } from '../../ui/labels';
import { QuickAddBar } from '../capture/QuickAddBar';
import { surprise } from '../../app/surprise';
import './header.css';

const VIEWS: { id: ViewName; label: string; icon: IconName; ready: boolean }[] = [
  { id: 'shelves', label: 'Shelves', icon: 'shelves', ready: true },
  { id: 'collage', label: 'Collage', icon: 'collage', ready: true },
  { id: 'map', label: 'String Map', icon: 'map', ready: true },
  { id: 'mind', label: 'Mind Map 3D', icon: 'orbit', ready: true },
];

function MuseumName() {
  const name = useStore(data, (s) => s.settings.museum_name);
  const count = useStore(data, (s) => liveItems(s.items).length);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  return (
    <div className="museum-name">
      {editing ? (
        <input
          className="museum-name__input hand"
          value={draft}
          maxLength={60}
          autoFocus
          aria-label="Museum name"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft.trim() && draft.trim() !== name) updateSettings({ museum_name: draft.trim() });
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setDraft(name);
              setEditing(false);
            }
          }}
        />
      ) : (
        <h1>
          <button
            type="button"
            className="museum-name__button hand"
            title="Rename the museum"
            onClick={() => {
              setDraft(name);
              setEditing(true);
            }}
          >
            {name}
          </button>
        </h1>
      )}
      <p className="museum-name__sub type">A cabinet of {plural(count, 'curiosity', 'curiosities')}</p>
    </div>
  );
}

function SyncBadge() {
  const sync = useStore(data, (s) => s.sync);
  const text =
    sync.status === 'local'
      ? 'Local only'
      : sync.status === 'syncing'
        ? 'Syncing…'
        : sync.status === 'offline'
          ? sync.pending
            ? `Offline · ${sync.pending} waiting`
            : 'Offline'
          : sync.status === 'error'
            ? 'Sync problem'
            : sync.pending
              ? `${sync.pending} waiting`
              : 'Synced';
  const title =
    sync.status === 'local'
      ? 'No Supabase project configured: everything is kept in this browser only.'
      : (sync.error ?? text);
  return (
    <span className={`sync-badge sync-badge--${sync.status} type`} title={title} role="status">
      <Icon name={sync.status === 'offline' || sync.status === 'local' ? 'offline' : 'cloud'} size={15} />
      <span className="sync-badge__text">{text}</span>
    </span>
  );
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const THEMES: { id: Theme; label: string }[] = [
  { id: 'system', label: 'Follow system' },
  { id: 'light', label: 'Daylight' },
  { id: 'dark', label: 'Cabinet at night' },
];

/** Colour scheme swatches: each shows the daylight desk, the night desk, a slip of paper and the thread. */
function PalettePicker() {
  const palette = useStore(data, (s) => s.settings.palette);
  return (
    <div className="menu__group" role="radiogroup" aria-label="Colours">
      <span className="menu__label type">Colours</span>
      <div className="palettes">
        {PALETTES.map((p) => {
          const c = PALETTE_INFO[p];
          return (
            <button key={p} type="button" role="radio" aria-checked={palette === p} className="palette" onClick={() => updateSettings({ palette: p })}>
              <span
                className="palette__swatch"
                aria-hidden="true"
                style={{ background: `linear-gradient(135deg, ${c.desk} 0 55%, ${c.night} 55%)` }}
              >
                <span className="palette__paper" style={{ background: c.paper }}>
                  <span className="palette__thread" style={{ background: c.thread }} />
                </span>
              </span>
              <span className="palette__name">{c.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Menu() {
  const theme = useStore(data, (s) => s.settings.theme);
  const examples = useStore(data, (s) => (s.items.size ? hasExamples() : false));
  return (
    <>
      <button type="button" className="btn btn--ghost btn--icon" popoverTarget="main-menu" aria-label="Menu">
        <Icon name="menu" />
      </button>
      <div id="main-menu" popover="auto" className="menu">
        <button type="button" className="menu__item" onClick={() => ui.set({ commandOpen: true })} popoverTarget="main-menu" popoverTargetAction="hide">
          <Icon name="search" size={15} /> Jump to… <kbd className="menu__kbd type">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
        <button type="button" className="menu__item" onClick={() => ui.set({ roomsOpen: true })} popoverTarget="main-menu" popoverTargetAction="hide">
          Manage rooms
        </button>
        <div className="menu__group" role="radiogroup" aria-label="Theme">
          <span className="menu__label type">Lighting</span>
          {THEMES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} className="menu__item" onClick={() => updateSettings({ theme: t.id })}>
              <Icon name={t.id === 'dark' ? 'moon' : 'sun'} size={15} /> {t.label}
            </button>
          ))}
        </div>
        <PalettePicker />
        <button type="button" className="menu__item" onClick={() => ui.set({ backOfficeOpen: true })} popoverTarget="main-menu" popoverTargetAction="hide">
          Back office: bookmarklet, phone app, export
        </button>
        {examples && (
          <div className="menu__group">
            <span className="menu__label type">Example exhibits</span>
            <InlineConfirm
              label="Clear examples"
              className="menu__item"
              message="Remove all example items?"
              confirmLabel="Clear"
              onConfirm={() => {
                clearExamples();
                toast('Examples cleared');
              }}
            />
          </div>
        )}
        <p className="menu__keys type">
          N add · / search · R wander · Esc close · 1 2 3 4 views · ← → step through exhibits
        </p>
      </div>
    </>
  );
}

export function Header({ filterCount }: { filterCount: number }) {
  const view = useStore(ui, (s) => s.view);
  const q = useStore(ui, (s) => s.filters.q);

  return (
    <header className="app-header">
      <div className="app-header__top">
        <MuseumName />
        <nav className="view-tabs" aria-label="Views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className="view-tab"
              aria-current={view === v.id ? 'page' : undefined}
              disabled={!v.ready}
              title={v.ready ? undefined : 'Opening in a later phase'}
              onClick={() => setView(v.id)}
            >
              <Icon name={v.icon} size={16} />
              <span>{v.label}</span>
            </button>
          ))}
        </nav>
        <div className="app-header__tools">
          <SyncBadge />
          <Menu />
        </div>
      </div>
      <div className="app-header__bar">
        <QuickAddBar />
        <div className="search">
          <Icon name="search" size={17} />
          <input
            id="search"
            className="search__input"
            type="search"
            value={q}
            onChange={(e) => setFilters({ q: e.target.value })}
            placeholder="Search the cabinet"
            aria-label="Search the cabinet (press /)"
            autoComplete="off"
          />
        </div>
        <button type="button" className="btn surprise" onClick={surprise} title="Surprise me (R)">
          <Icon name="dice" size={17} /> <span className="surprise__text">Surprise me</span>
        </button>
        <button type="button" className="btn filter-toggle" onClick={() => ui.set({ filterSheetOpen: true })}>
          <Icon name="filter" size={16} /> Filters{filterCount > 0 && <span className="filter-toggle__n">{filterCount}</span>}
        </button>
      </div>
    </header>
  );
}
