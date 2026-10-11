import type { ItemDraft } from '../../data/actions';
import { detect, paperRef } from '../../lib/detectKind';
import { titleFromUrl } from '../../lib/titleFromUrl';

/** Turn pasted text into an item draft: kind, URL, a guessed title, quote/note text. */
export function draftFromText(text: string): ItemDraft {
  const d = detect(text);
  const title = d.title || (d.url ? (paperRef(d.url) ?? titleFromUrl(d.url)) : '');
  return { kind: d.kind, url: d.url, title, body: d.body, creator: d.creator };
}

/** Make sure a draft has a title before saving. */
export function withTitle(draft: ItemDraft): ItemDraft {
  if (draft.title?.trim()) return { ...draft, title: draft.title.trim() };
  if (draft.url) return { ...draft, title: paperRef(draft.url) ?? titleFromUrl(draft.url) };
  if (draft.body) return { ...draft, title: draft.body.trim().split('\n')[0].slice(0, 60) };
  return { ...draft, title: 'Untitled' };
}
