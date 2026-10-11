import { applyFilters } from '../data/filter';
import { data, liveItems, liveRooms } from '../data/store';
import { flyTo, toast, ui } from '../data/ui';
import { pickWander } from '../data/wander';

/** "Surprise me": a weighted random exhibit from what's on show (or everything, if the filters hide all). */
export function surprise() {
  const st = data.get();
  const rooms = new Map(liveRooms(st.rooms).map((r) => [r.id, r]));
  const all = liveItems(st.items);
  const shown = applyFilters(all, ui.get().filters, rooms);
  const pick = pickWander(shown.length ? shown : all, ui.get().openItemId);
  if (!pick) return toast('Nothing to wander to yet');
  flyTo(pick.id);
}
