import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { photoBlob } from '../lib/photos';
import { uuid } from '../lib/random';
import { commit, commitSettings, currentSession, data, liveConnections, liveItems, liveRooms } from './store';
import { isDate } from '../features/daily-log/dates';
import type { Connection, Item, LogEntry, LogGoal, LogTopic, Room, Settings } from './types';

/** Version 2 adds the Daily Log; version 1 exports (cabinet only) still import. */
interface Backup {
  app: 'curio-cabinet';
  version: 1 | 2;
  exported_at: string;
  settings: Partial<Settings>;
  rooms: Room[];
  items: Item[];
  connections: Connection[];
  /** item id → file inside the zip */
  photos: Record<string, string>;
  log_topics?: LogTopic[];
  log_entries?: LogEntry[];
  log_goals?: LogGoal[];
}

const live = <T extends { deleted_at: string | null }>(m: Map<string, T>) => [...m.values()].filter((r) => !r.deleted_at);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;
const minutesOk = (v: unknown, max: number) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= max;

/** Keep only well-formed Daily Log records, and entries whose topic/subcategory pair holds together. */
export function validLog(b: Pick<Backup, 'log_topics' | 'log_entries' | 'log_goals'>) {
  const topics = (Array.isArray(b.log_topics) ? b.log_topics : []).filter(
    (t) => isId(t?.id) && typeof t.name === 'string' && t.name.trim() && (t.parent_id === null || isId(t.parent_id)),
  );
  const byId = new Map(topics.map((t) => [t.id, t]));
  // One level only: a subcategory's parent must itself be a top-level topic.
  const ok = topics.filter((t) => !t.parent_id || (byId.get(t.parent_id) && !byId.get(t.parent_id)!.parent_id));
  const okIds = new Map(ok.map((t) => [t.id, t]));
  const entries = (Array.isArray(b.log_entries) ? b.log_entries : []).filter((e) => {
    if (!isId(e?.id) || !isDate(e.date) || !minutesOk(e.minutes, 1440)) return false;
    const topic = okIds.get(e.topic_id);
    if (!topic || topic.parent_id) return false;
    return !e.subcategory_id || okIds.get(e.subcategory_id)?.parent_id === e.topic_id;
  });
  const goals = (Array.isArray(b.log_goals) ? b.log_goals : []).filter(
    (g) => isId(g?.id) && okIds.has(g.topic_id) && isDate(g.week_start) && (g.minutes === null || minutesOk(g.minutes, 10080)),
  );
  return { topics: ok, entries, goals };
}

const extFor = (type: string) => (type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('gif') ? 'gif' : 'jpg');

/** Everything (items, rooms, strings, settings, the Daily Log) plus a folder of photos, as one zip. */
export async function exportCollection(onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const st = data.get();
  const items = liveItems(st.items);
  const files: Zippable = {};
  const photos: Record<string, string> = {};
  const withPhotos = items.filter((i) => i.image_path);
  let done = 0;
  for (const item of withPhotos) {
    const blob = await photoBlob(item.image_path!).catch(() => null);
    onProgress?.(++done, withPhotos.length);
    if (!blob) continue;
    const name = `photos/${item.id}.${extFor(blob.type)}`;
    files[name] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
    photos[item.id] = name;
  }
  const { museum_name, default_view, theme, palette, design, log_timezone } = st.settings;
  const backup: Backup = {
    app: 'curio-cabinet',
    version: 2,
    exported_at: new Date().toISOString(),
    settings: { museum_name, default_view, theme, palette, design, log_timezone },
    rooms: liveRooms(st.rooms),
    items,
    connections: liveConnections(st.connections),
    photos,
    log_topics: live(st.log_topics),
    log_entries: live(st.log_entries),
    log_goals: live(st.log_goals),
  };
  files['curio.json'] = strToU8(JSON.stringify(backup, null, 2));
  return new Blob([zipSync(files)], { type: 'application/zip' });
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/**
 * Restore from an export (.zip, or the bare curio.json). Records are merged by id,
 * so importing into the same cabinet restores rather than duplicates.
 */
export async function importCollection(
  file: File,
): Promise<{ items: number; rooms: number; connections: number; photos: number; logEntries: number; logTopics: number }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const files = isZip ? unzipSync(bytes) : { 'curio.json': bytes };
  if (!files['curio.json']) throw new Error('No curio.json in that file');
  const backup = JSON.parse(strFromU8(files['curio.json'])) as Backup;
  if (backup.app !== 'curio-cabinet' || !Array.isArray(backup.items)) throw new Error("That doesn't look like a Curio Cabinet export");

  const s = currentSession();
  if (!s) throw new Error('Not ready');
  const t = new Date().toISOString();
  let photoCount = 0;

  const items: Item[] = [];
  for (const item of backup.items) {
    let image_path = item.image_path;
    const inZip = backup.photos?.[item.id];
    if (inZip && files[inZip]) {
      const ext = inZip.split('.').pop() ?? 'jpg';
      const blob = new Blob([files[inZip] as BlobPart], { type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
      image_path = `local:${uuid()}`;
      await s.db.putBlob(image_path, blob);
      photoCount++;
    }
    items.push({ ...item, image_path, deleted_at: null, updated_at: t });
  }
  const rooms = (backup.rooms ?? []).map((r) => ({ ...r, deleted_at: null, updated_at: t }));
  const connections = (backup.connections ?? []).map((c) => ({ ...c, deleted_at: null, updated_at: t }));

  // Older exports have no Daily Log: nothing here touches the log then.
  const log = validLog(backup);
  const revive = <T extends { deleted_at: string | null; updated_at: string }>(r: T): T => ({ ...r, deleted_at: null, updated_at: t });

  commit('rooms', rooms);
  commit('items', items);
  commit('connections', connections);
  commit('log_topics', log.topics.map(revive));
  commit('log_entries', log.entries.map((e) => revive({ ...e, note: e.note ? String(e.note).slice(0, 1000) : null })));
  commit('log_goals', log.goals.map(revive));
  if (backup.settings?.museum_name) commitSettings({ museum_name: backup.settings.museum_name, examples_seeded: true });
  if (typeof backup.settings?.log_timezone === 'string' && backup.settings.log_timezone) commitSettings({ log_timezone: backup.settings.log_timezone });
  return {
    items: items.length,
    rooms: rooms.length,
    connections: connections.length,
    photos: photoCount,
    logEntries: log.entries.length,
    logTopics: log.topics.length,
  };
}
