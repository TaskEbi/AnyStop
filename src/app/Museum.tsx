import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { activeFilterCount, applyFilters, facetCounts } from '../data/filter';
import { seedExamples } from '../data/seed';
import { allTags, closeSession, data, liveItems, liveRooms, openSession } from '../data/store';
import { startSync, type SyncHandle } from '../data/sync';
import { ui } from '../data/ui';
import { deleteLocalDb } from '../data/idb';
import { useStore } from '../lib/createStore';
import { supabase } from '../lib/supabase';
import { AddSheet } from '../features/capture/AddSheet';
import { DetailDrawer } from '../features/drawer/DetailDrawer';
import { Filters } from '../features/filters/Filters';
import { Header } from '../features/header/Header';
import { RoomsManager } from '../features/rooms/RoomsManager';
import { ShelvesView } from '../features/shelves/ShelvesView';
import { Sheet } from '../ui/Sheet';
import { Toasts } from '../ui/Toasts';
import { ExamplesNotice } from './ExamplesNotice';
import { useShortcuts } from './useShortcuts';
import { useTheme } from './useTheme';

/** First visit to an empty cabinet: lay out the examples (only once per account). */
function maybeSeed() {
  const st = data.get();
  if (!st.settings.examples_seeded && st.items.size === 0 && st.rooms.size === 0) seedExamples();
}

/** Open this user's local copy, start syncing, and keep both alive while mounted. */
function useSession(userId: string | null) {
  const [sync, setSync] = useState<SyncHandle | null>(null);
  useEffect(() => {
    let handle: SyncHandle | null = null;
    let cancelled = false;
    void (async () => {
      await openSession({ userId, onLocalChange: () => handle?.request() });
      if (cancelled) return;
      if (userId && supabase) {
        handle = startSync(supabase, userId);
        setSync(handle);
        await handle.firstPull;
        // Only seed after a successful pull, so an offline first launch can't duplicate examples.
        if (!cancelled && data.get().sync.status === 'idle') maybeSeed();
      } else {
        maybeSeed();
      }
    })();
    return () => {
      cancelled = true;
      handle?.stop();
      closeSession();
    };
  }, [userId]);
  return sync;
}

export function Museum({ userId }: { userId: string | null }) {
  const sync = useSession(userId);
  useShortcuts();
  useTheme();

  const ready = useStore(data, (s) => s.ready);
  const itemsMap = useStore(data, (s) => s.items);
  const roomsMap = useStore(data, (s) => s.rooms);
  const filters = useDeferredValue(useStore(ui, (s) => s.filters));
  const view = useStore(ui, (s) => s.view);
  const sheet = useStore(ui, (s) => s.sheet);
  const openItemId = useStore(ui, (s) => s.openItemId);
  const roomsOpen = useStore(ui, (s) => s.roomsOpen);
  const filterSheetOpen = useStore(ui, (s) => s.filterSheetOpen);

  const items = liveItems(itemsMap);
  const rooms = liveRooms(roomsMap);
  const tags = allTags(itemsMap);
  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const visible = useMemo(() => applyFilters(items, filters, roomById), [items, filters, roomById]);
  const counts = useMemo(() => facetCounts(items, filters, roomById), [items, filters, roomById]);
  const filterCount = activeFilterCount(filters);

  async function signOut() {
    sync?.stop();
    const name = closeSession();
    if (name) await deleteLocalDb(name);
    await supabase?.auth.signOut();
  }

  if (!ready) return <p className="loading hand">Opening the cabinet…</p>;

  const filtersPanel = <Filters counts={counts} rooms={rooms} tags={tags} />;

  return (
    <div className="app">
      <Header onSignOut={userId ? signOut : undefined} filterCount={filterCount} />
      <div className="app__body">
        <aside className="sidebar" aria-label="Filters">
          {filtersPanel}
        </aside>
        <main className="app__main" id="main">
          <ExamplesNotice />
          {view === 'shelves' && <ShelvesView items={visible} rooms={roomById} total={items.length} />}
        </main>
      </div>

      {filterSheetOpen && (
        <Sheet title="Filters" variant="bottom" onClose={() => ui.set({ filterSheetOpen: false })}>
          {filtersPanel}
        </Sheet>
      )}
      {roomsOpen && <RoomsManager />}
      {openItemId && <DetailDrawer id={openItemId} />}
      {sheet && <AddSheet key={sheet.editId ?? 'new'} draft={sheet.draft} editId={sheet.editId} />}
      <Toasts />
    </div>
  );
}
