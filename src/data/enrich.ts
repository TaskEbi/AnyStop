import type { PreviewResult } from '../../supabase/functions/_shared/preview';
import { detect } from '../lib/detectKind';
import { supabase } from '../lib/supabase';
import { updateItem } from './actions';
import { data, liveItems } from './store';
import type { Preview } from './types';

/** Ask the preview function about a URL. Null if previews aren't available or it failed. */
export async function requestPreview(url: string): Promise<PreviewResult | null> {
  try {
    if (supabase) {
      const { data: res, error } = await supabase.functions.invoke<PreviewResult>('preview', { body: { url } });
      return error ? null : res;
    }
    if (import.meta.env.DEV) {
      const res = await fetch(`/api/preview?url=${encodeURIComponent(url)}`);
      return res.ok ? ((await res.json()) as PreviewResult) : null;
    }
  } catch {
    /* offline or function unreachable */
  }
  return null;
}

const inFlight = new Set<string>();

/**
 * Fill in an item from its link: title (unless I typed my own), creator (if empty),
 * description, thumbnail, site name, favicon. Never blocks saving; failures are remembered
 * so the backlog doesn't retry forever.
 */
export async function enrich(id: string): Promise<void> {
  const item = data.get().items.get(id);
  if (!item?.url || inFlight.has(id)) return;
  inFlight.add(id);
  try {
    const r = await requestPreview(item.url);
    if (!r) return; // unreachable: try again another time
    const now = data.get().items.get(id);
    if (!now || now.deleted_at) return;

    const preview: Preview = {
      ...now.preview,
      fetched_at: new Date().toISOString(),
      ok: r.ok,
      ...(r.ok && {
        site_name: r.site_name,
        description: r.description,
        thumbnail: r.thumbnail,
        favicon: r.favicon,
        embed: r.embed,
      }),
    };
    const guessed = detect(now.url ?? '').title;
    const patch: Parameters<typeof updateItem>[1] = { preview };
    if (r.ok && r.title && (!now.title || now.title === guessed || now.title === 'Untitled')) patch.title = r.title;
    if (r.ok && r.creator && !now.creator) patch.creator = r.creator;
    updateItem(id, patch);
  } finally {
    inFlight.delete(id);
  }
}

/** Items with a link that have never had a preview (e.g. saved offline or on a device without previews). */
export async function enrichBacklog(limit = 20) {
  if (!navigator.onLine) return;
  const todo = liveItems(data.get().items)
    .filter((i) => i.url && !i.preview?.fetched_at && !i.is_example)
    .slice(0, limit);
  for (const i of todo) await enrich(i.id);
}
