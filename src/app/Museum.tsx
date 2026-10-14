import { useDeferredValue, useEffect, useMemo } from 'react';
import { activeFilterCount, applyFilters, facetCounts } from '../data/filter';
import { seedExamples } from '../data/seed';
import { allTags, closeSession, data, liveItems, liveRooms, openSession } from '../data/store';
import { startSync, type SyncHandle } from '../data/sync';
import { ui } from '../data/ui';
import { useStore } from '../lib/createStore';
import { supabase } from '../lib/supabase';
import { AddSheet } from '../features/capture/AddSheet';
import { DetailDrawer } from '../features/drawer/DetailDrawer';
import { Filters } from '../features/filters/Filters';
import { Header } from '../features/header/Header';
import { RoomsManager } from '../features/rooms/RoomsManager';
import { ShelvesView } from '../features/shelves/ShelvesView';
import { StringMap } from '../features/map/StringMap';
import { MindMap } from '../features/mind/MindMap';
import { Collage } from '../features/collage/Collage';
import { Sheet } from '../ui/Sheet';
import { Toasts } from '../ui/Toasts';
import { ExamplesNotice } from './ExamplesNotice';
import { useShortcuts } from './useShortcuts';
import { useTheme } from './useTheme';
import { useCapture } from './useCapture';
import { takeShare } from './share';
import { enrichBacklog } from '../data/enrich';
import { BackOffice } from '../features/backoffice/BackOffice';
import { CommandPalette } from '../features/command/CommandPalette';
import { DailyLog } from '../features/daily-log/DailyLog';
import { EntrySheet } from '../features/daily-log/EntrySheet';
import { TopicsSheet } from '../features/daily-log/TopicsSheet';
import { PasswordSheet } from '../features/auth/PasswordSheet';

/** First visit to an empty cabinet: lay out the examples (only once). */
function maybeSeed() {
  const st = data.get();
  if (!st.settings.examples_seeded && st.items.size === 0 && st.rooms.size === 0) seedExamples();
}

/** Open the local copy, start syncing, and keep both alive while mounted. */
function useSession(cloud: boolean) {
  useEffect(() => {
    let handle: SyncHandle | null = null;
    let cancelled = false;
    void (async () => {
      await openSession({ cloud, onLocalChange: () => handle?.request() });
      if (cancelled) return;
      if (cloud && supabase) {
        handle = startSync(supabase);
        await handle.firstPull;
        // Only seed after a successful pull, so an offline first launch can't duplicate examples.
        if (!cancelled && data.get().sync.status === 'idle') maybeSeed();
      } else {
        maybeSeed();
      }
      if (cancelled) return;
      await takeShare(() => handle?.flush() ?? Promise.resolve());
      void enrichBacklog();
    })();
    const onOnline = () => void enrichBacklog();
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      handle?.stop();
      closeSession();
    };
  }, [cloud]);
}

export function Museum({ cloud }: { cloud: boolean }) {
  useSession(cloud);
  useShortcuts();
  useTheme();
  const dragging = useCapture();

  const ready = useStore(data, (s) => s.ready);
  const itemsMap = useStore(data, (s) => s.items);
  const roomsMap = useStore(data, (s) => s.rooms);
  const filters = useDeferredValue(useStore(ui, (s) => s.filters));
  const view = useStore(ui, (s) => s.view);
  const sheet = useStore(ui, (s) => s.sheet);
  const openItemId = useStore(ui, (s) => s.openItemId);
  const roomsOpen = useStore(ui, (s) => s.roomsOpen);
  const filterSheetOpen = useStore(ui, (s) => s.filterSheetOpen);
  const backOfficeOpen = useStore(ui, (s) => s.backOfficeOpen);
  const commandOpen = useStore(ui, (s) => s.commandOpen);
  const section = useStore(ui, (s) => s.section);
  const logTopicsOpen = useStore(ui, (s) => s.logTopicsOpen);
  const logSheet = useStore(ui, (s) => s.logSheet);
  const passwordOpen = useStore(ui, (s) => s.passwordOpen);

  const items = liveItems(itemsMap);
  const rooms = liveRooms(roomsMap);
  const tags = allTags(itemsMap);
  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const visible = useMemo(() => applyFilters(items, filters, roomById), [items, filters, roomById]);
  const sequence = useMemo(() => visible.map((i) => i.id), [visible]);
  const counts = useMemo(() => facetCounts(items, filters, roomById), [items, filters, roomById]);
  const filterCount = activeFilterCount(filters);

  if (!ready) return <p className="loading hand">Opening the cabinet…</p>;

  const shared = (
    <>
      {commandOpen && <CommandPalette />}
      {passwordOpen && <PasswordSheet />}
      <Toasts />
    </>
  );

  // The Daily Log replaces the cabinet's body; the cabinet's view and filters wait in `ui` for its return.
  if (section === 'log') {
    return (
      <div className="app">
        <Header filterCount={filterCount} />
        <DailyLog />
        {logTopicsOpen && <TopicsSheet />}
        {logSheet && <EntrySheet key={logSheet.editId ?? `new:${logSheet.date ?? ''}`} editId={logSheet.editId} date={logSheet.date} />}
        {shared}
      </div>
    );
  }

  const filtersPanel = <Filters counts={counts} rooms={rooms} tags={tags} />;

  return (
    <div className="app">
      <Header filterCount={filterCount} />
      <div className="app__body">
        <aside className="sidebar" aria-label="Filters">
          {filtersPanel}
        </aside>
        <main className="app__main" id="main">
          {view === 'shelves' && <ExamplesNotice />}
          {view === 'shelves' && <ShelvesView items={visible} rooms={roomById} total={items.length} />}
          {view === 'collage' && <Collage items={visible} rooms={roomById} />}
          {view === 'map' && <StringMap items={visible} rooms={roomById} />}
          {view === 'mind' && <MindMap items={visible} rooms={roomById} />}
        </main>
      </div>

      {filterSheetOpen && (
        <Sheet title="Filters" variant="bottom" onClose={() => ui.set({ filterSheetOpen: false })}>
          {filtersPanel}
        </Sheet>
      )}
      {roomsOpen && <RoomsManager />}
      {backOfficeOpen && <BackOffice />}
      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <p className="drop-overlay__label hand">Drop it in the cabinet</p>
        </div>
      )}
      {openItemId && <DetailDrawer id={openItemId} sequence={sequence} />}
      {sheet && <AddSheet key={sheet.editId ?? 'new'} draft={sheet.draft} editId={sheet.editId} file={sheet.file} />}
      {shared}
    </div>
  );
}
