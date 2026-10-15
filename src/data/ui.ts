import { createStore } from '../lib/createStore';
import { EMPTY_FILTERS, type Filters } from './filter';
import type { ItemDraft } from './actions';
import type { ViewName } from './types';

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

export type Section = 'cabinet' | 'log' | 'road';
export type LogView = 'today' | 'history' | 'stats';

export interface UiState {
  /** The cabinet, the Daily Log or Road to IOI. Each keeps its own view and filters while another is shown. */
  section: Section;
  view: ViewName;
  filters: Filters;
  /** Item shown in the detail drawer. */
  openItemId: string | null;
  /** Add/edit sheet: a draft to start from, and the item being edited (if any). */
  sheet: { draft: ItemDraft; editId: string | null; file?: File | null } | null;
  roomsOpen: boolean;
  filterSheetOpen: boolean;
  /** Bookmarklet, install hints, export/import. */
  backOfficeOpen: boolean;
  /** The Ctrl/⌘ K jump-to palette. */
  commandOpen: boolean;
  /** Ask the current view to bring an item into view (canvas views glide to it first). */
  flight: { id: string; nonce: number } | null;
  /** Tie-a-string mode in the canvas views: the first end, once picked. */
  tying: { from: string | null } | null;
  toasts: Toast[];
  logView: LogView;
  /** The day shown on Today; null follows the current date (and rolls over at midnight). */
  logDate: string | null;
  logTopicsOpen: boolean;
  /** Entry sheet over History/Stats: edit an entry, or add one (optionally on a given day). */
  logSheet: { editId: string | null; date?: string } | null;
  passwordOpen: boolean;
}

const SECTION_KEY = 'curio-section';
const LOG_VIEW_KEY = 'curio-log-view';

function remembered<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v as T) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: fine */
  }
}

/** A link straight to a section: any-stop.vercel.app/#road. The hash is cleared so a reload follows the remembered section. */
function linkedSection(): Section | null {
  try {
    if (location.hash !== '#road') return null;
    history.replaceState(null, '', location.pathname + location.search);
    remember(SECTION_KEY, 'road');
    return 'road';
  } catch {
    return null;
  }
}

export const ui = createStore<UiState>({
  // Reopen where I left off, so the phone app can go straight back to the log. A #road link (from DragonCode) opens Road to IOI.
  section: linkedSection() ?? remembered<Section>(SECTION_KEY, ['cabinet', 'log', 'road'], 'cabinet'),
  view: 'shelves',
  filters: EMPTY_FILTERS,
  openItemId: null,
  sheet: null,
  roomsOpen: false,
  filterSheetOpen: false,
  backOfficeOpen: false,
  commandOpen: false,
  flight: null,
  tying: null,
  toasts: [],
  logView: remembered<LogView>(LOG_VIEW_KEY, ['today', 'history', 'stats'], 'today'),
  logDate: null,
  logTopicsOpen: false,
  logSheet: null,
  passwordOpen: false,
});

export function setSection(section: Section) {
  ui.set({ section, tying: null, flight: null, commandOpen: false });
  remember(SECTION_KEY, section);
}

export function setLogView(logView: LogView) {
  ui.set({ section: 'log', logView });
  remember(SECTION_KEY, 'log');
  remember(LOG_VIEW_KEY, logView);
}

export function setFilters(patch: Partial<Filters>) {
  ui.set((s) => ({ ...s, filters: { ...s.filters, ...patch } }));
}

let toastSeq = 0;
export function toast(text: string, action?: Toast['action']) {
  const t: Toast = { id: ++toastSeq, text, action };
  ui.set((s) => ({ ...s, toasts: [...s.toasts.slice(-2), t] }));
  setTimeout(() => dismissToast(t.id), action ? 6000 : 3500);
}

export function dismissToast(id: number) {
  ui.set((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }));
}

export function openAddSheet(draft: ItemDraft = { kind: 'link' }, file: File | null = null) {
  ui.set({ sheet: { draft, editId: null, file } });
}

/** Switch views, dropping per-view modes and any stale fly-to request. */
export function setView(view: ViewName) {
  ui.set({ view, tying: null, flight: null });
}

let flightSeq = 0;
/** Jump to an item: canvas views glide the camera to it and then open the drawer; Shelves just opens it. */
export function flyTo(id: string) {
  const view = ui.get().view;
  if (view === 'shelves') ui.set({ openItemId: id });
  else ui.set({ flight: { id, nonce: ++flightSeq } });
}
