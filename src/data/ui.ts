import { createStore } from '../lib/createStore';
import { EMPTY_FILTERS, type Filters } from './filter';
import type { ItemDraft } from './actions';
import type { ViewName } from './types';

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

export interface UiState {
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
  toasts: Toast[];
}

export const ui = createStore<UiState>({
  view: 'shelves',
  filters: EMPTY_FILTERS,
  openItemId: null,
  sheet: null,
  roomsOpen: false,
  filterSheetOpen: false,
  backOfficeOpen: false,
  toasts: [],
});

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
