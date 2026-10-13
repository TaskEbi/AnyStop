import { useEffect, useState } from 'react';
import { currentSession, data } from '../data/store';
import { updateItem } from '../data/actions';
import { supabase } from './supabase';
import { uuid } from './random';

/**
 * Photos live in IndexedDB first (image_path "local:<id>") so saving works offline,
 * then get uploaded to the Supabase bucket ("shared/<id>.webp") when synced.
 * A copy stays in IndexedDB under the remote path, so this device never re-downloads it.
 */

const MAX_EDGE = 1600;
const BUCKET = 'photos';

/** Downscale to at most 1600px and re-encode as WebP (JPEG if WebP isn't supported). */
export async function shrinkImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const toBlob = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.85));
  const webp = await toBlob('image/webp');
  if (webp && webp.type === 'image/webp') return webp;
  return (await toBlob('image/jpeg'))!;
}

/** Keep a photo on this device and return the image_path to store on the item. */
export async function storePhoto(file: Blob): Promise<string> {
  const s = currentSession();
  if (!s) throw new Error('Not ready');
  const blob = await shrinkImage(file);
  const path = `local:${uuid()}`;
  await s.db.putBlob(path, blob);
  return path;
}

/** Upload photos still only on this device, then point their items at the bucket copy. */
export async function uploadPendingPhotos(): Promise<void> {
  const s = currentSession();
  if (!s || !s.cloud || !supabase) return;
  const pending = [...data.get().items.values()].filter((i) => i.image_path?.startsWith('local:') && !i.deleted_at);
  for (const item of pending) {
    const localPath = item.image_path!;
    const blob = await s.db.getBlob(localPath);
    if (!blob) continue;
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const remote = `shared/${uuid()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(remote, blob, { contentType: blob.type, upsert: false });
    if (error) throw error;
    await s.db.putBlob(remote, blob);
    // Only swap the path if the item still points at this local photo.
    if (data.get().items.get(item.id)?.image_path === localPath) updateItem(item.id, { image_path: remote });
  }
}

const urlCache = new Map<string, Promise<string | null>>();

async function resolve(path: string): Promise<string | null> {
  const s = currentSession();
  const local = await s?.db.getBlob(path).catch(() => undefined);
  if (local) return URL.createObjectURL(local);
  if (path.startsWith('local:') || !supabase) return null;
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 6);
  return signed?.signedUrl ?? null;
}

/** A displayable URL for an image_path (object URL for local blobs, signed URL otherwise). */
export function useImagePath(path: string | null): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!path) {
      setSrc(null);
      return;
    }
    let live = true;
    let p = urlCache.get(path);
    if (!p) {
      p = resolve(path);
      urlCache.set(path, p);
      // Signed URLs expire; forget them before they do.
      setTimeout(() => urlCache.delete(path), 1000 * 60 * 60 * 5);
    }
    void p.then((u) => live && setSrc(u));
    return () => {
      live = false;
    };
  }, [path]);
  return src;
}

/** Fetch a photo blob (for export). */
export async function photoBlob(path: string): Promise<Blob | null> {
  const s = currentSession();
  const local = await s?.db.getBlob(path);
  if (local) return local;
  if (!supabase || path.startsWith('local:')) return null;
  const { data: blob } = await supabase.storage.from(BUCKET).download(path);
  return blob ?? null;
}
