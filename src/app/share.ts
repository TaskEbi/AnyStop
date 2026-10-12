import { createItem, findByUrl } from '../data/actions';
import { enrich } from '../data/enrich';
import { data } from '../data/store';
import { openAddSheet, toast, ui } from '../data/ui';
import { draftFromText, withTitle } from '../features/capture/draft';

/**
 * Handles /share, reached from the phone's share sheet (via the service worker)
 * or from the desktop bookmarklet (?save=1 saves straight away, then closes the popup).
 */
export async function takeShare(waitForSync: () => Promise<void>): Promise<void> {
  if (location.pathname !== '/share') return;
  const q = new URLSearchParams(location.search);
  history.replaceState(null, '', '/');

  const text = q.get('text') ?? '';
  const url = q.get('url') || text.match(/https?:\/\/\S+/)?.[0] || '';
  let draft = draftFromText(url || text || q.get('title') || '');
  const title = q.get('title');
  if (title && url && draft.kind !== 'quote' && draft.kind !== 'note') draft = { ...draft, title };

  let file: File | null = null;
  if (q.get('photo') && 'caches' in window) {
    const cache = await caches.open('curio-share');
    const res = await cache.match('/shared-photo');
    if (res) {
      const blob = await res.blob();
      file = new File([blob], decodeURIComponent(res.headers.get('x-name') ?? 'shared photo'), { type: blob.type });
      await cache.delete('/shared-photo');
      draft = { kind: 'photo', title: title ?? '' };
    }
  }

  const twin = file ? undefined : findByUrl(draft.url);
  if (twin) {
    ui.set({ openItemId: twin.id });
    toast(`Already in the cabinet: ${twin.title}`);
    if (window.opener && q.get('save')) setTimeout(() => window.close(), 1500);
    return;
  }

  if (q.get('save') && !file && (url || text)) {
    const item = createItem(withTitle(draft));
    if (item.url) void enrich(item.id);
    toast(`Saved to ${data.get().settings.museum_name}: ${item.title}`, { label: 'Open', run: () => ui.set({ openItemId: item.id }) });
    // Bookmarklet popup: give sync a moment to send it, then close.
    if (window.opener) {
      await waitForSync();
      setTimeout(() => window.close(), 900);
    }
    return;
  }
  if (file || url || text) openAddSheet(draft, file);
}

/** One-click "save this page" link to drag to the bookmarks bar. */
export function bookmarkletHref(): string {
  const code = `(()=>{const w=window.open('${location.origin}/share?save=1&url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title),'curio','width=440,height=360');if(!w)location.href='${location.origin}/share?url='+encodeURIComponent(location.href)})()`;
  return `javascript:${encodeURIComponent(code)}`;
}
