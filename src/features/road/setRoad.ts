import { updateSettings } from '../../data/actions';
import { data } from '../../data/store';
import type { RoadSettings } from '../../data/types';

/** Change part of the Road to IOI settings (they sync with the rest of the settings). */
export function setRoad(patch: Partial<RoadSettings>) {
  updateSettings({ road: { ...data.get().settings.road, ...patch } });
}
