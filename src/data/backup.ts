import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { photoBlob } from '../lib/photos';
import { uuid } from '../lib/random';
import { commit, commitSettings, currentSession, data, liveConnections, liveItems, liveRooms } from './store';
import type { Connection, Item, Room, Settings } from './types';

interface Backup {
  app: 'curio-cabinet';
  version: 1;
  exported_at: string;
  settings: Partial<Settings>;
  rooms: Room[];
  items: Item[];
  connections: Connection[];
  /** item id → file inside the zip */
  photos: Record<string, string>;
}

const extFor = (type: string) => (type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('gif') ? 'gif' : 'jpg');

/** Everything (items, rooms, strings, settings) plus a folder of photos, as one zip. */
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
  const { museum_name, default_view, theme } = st.settings;
  const backup: Backup = {
    app: 'curio-cabinet',
    version: 1,
    exported_at: new Date().toISOString(),
    settings: { museum_name, default_view, theme },
    rooms: liveRooms(st.rooms),
    items,
    connections: liveConnections(st.connections),
    photos,
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
export async function importCollection(file: File): Promise<{ items: number; rooms: number; connections: number; photos: number }> {
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

  commit('rooms', rooms);
  commit('items', items);
  commit('connections', connections);
  if (backup.settings?.museum_name) commitSettings({ museum_name: backup.settings.museum_name, examples_seeded: true });
  return { items: items.length, rooms: rooms.length, connections: connections.length, photos: photoCount };
}
