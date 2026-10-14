import { useState } from 'react';
import { data } from '../../data/store';
import { ui } from '../../data/ui';
import { useStore } from '../../lib/createStore';
import { Sheet } from '../../ui/Sheet';
import { EntryForm } from './EntryForm';
import { useToday } from './useLog';

/** Edit an entry, or add one for any past day (from History). */
export function EntrySheet({ editId, date }: { editId: string | null; date?: string }) {
  const today = useToday();
  const editing = useStore(data, (s) => (editId ? s.log_entries.get(editId) : undefined));
  const [day, setDay] = useState(editing?.date ?? (date && date <= today ? date : today));
  const close = () => ui.set({ logSheet: null });

  if (editId && (!editing || editing.deleted_at)) {
    return (
      <Sheet title="Entry" onClose={close}>
        <p>That entry has been removed.</p>
      </Sheet>
    );
  }

  return (
    <Sheet title={editing ? 'Edit entry' : 'Add an entry'} onClose={close} className="log-sheet">
      <EntryForm today={today} date={day} onDate={setDay} editing={editing} onDone={close} />
    </Sheet>
  );
}
