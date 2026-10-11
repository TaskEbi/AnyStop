import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createItem, updateItem, type ItemDraft } from '../../data/actions';
import { allTags, data } from '../../data/store';
import { toast, ui } from '../../data/ui';
import { KINDS, STATUSES, type Kind } from '../../data/types';
import { useStore } from '../../lib/createStore';
import { detect } from '../../lib/detectKind';
import { storePhoto, useImagePath } from '../../lib/photos';
import { enrich } from '../../data/enrich';
import { Icon } from '../../ui/Icon';
import { KIND_LABEL, STATUS_LABEL } from '../../ui/labels';
import { Sheet } from '../../ui/Sheet';
import { withTitle } from './draft';
import { RoomPicker } from './RoomPicker';
import { TagInput } from './TagInput';

const CREATOR_LABEL: Record<Kind, string> = {
  link: 'Creator',
  video: 'Channel or director',
  article: 'Author',
  paper: 'Authors',
  photo: 'Photographer',
  music: 'Artist',
  quote: 'Who said it',
  note: 'Creator',
};

/** Full add / edit form. Opened by N, the + button, or "Edit" in the drawer. */
function titleFromFile(name: string): string {
  const base = name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
  return /^(img|dsc|pxl|image|photo|screenshot)?\s*\d/i.test(base) ? '' : base;
}

export function AddSheet({ draft: initial, editId, file }: { draft: ItemDraft; editId: string | null; file?: File | null }) {
  const [d, setD] = useState<ItemDraft>({ tags: [], status: 'none', favourite: false, ...initial });
  // Once I pick a kind or type a title myself, stop overwriting it from the URL.
  const [kindTouched, setKindTouched] = useState(!!editId);
  const [titleTouched, setTitleTouched] = useState(!!editId || !!initial.title);
  const tags = useStore(data, (s) => allTags(s.items));
  const set = (patch: Partial<ItemDraft>) => setD((prev) => ({ ...prev, ...patch }));
  const close = () => ui.set({ sheet: null });
  const textKind = d.kind === 'quote' || d.kind === 'note';
  const [photo, setPhoto] = useState<File | null>(file ?? null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => void (photoUrl && URL.revokeObjectURL(photoUrl)), [photoUrl]);
  const existing = useImagePath(removePhoto ? null : (d.image_path ?? null));
  const shownPhoto = photoUrl ?? existing;

  function onUrl(url: string) {
    const patch: Partial<ItemDraft> = { url };
    const det = url.trim() ? detect(url) : null;
    if (det?.url) {
      if (!kindTouched) patch.kind = det.kind;
      if (!titleTouched) patch.title = det.title;
    }
    set(patch);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    let image_path = removePhoto ? null : (d.image_path ?? null);
    if (photo) {
      try {
        image_path = await storePhoto(photo);
      } catch {
        setBusy(false);
        toast("That image couldn't be read. Try a JPEG, PNG or WebP.");
        return;
      }
    }
    const det = d.url?.trim() ? detect(d.url) : null;
    const clean = withTitle({
      ...d,
      title: d.title?.trim() || (photo && !d.url ? titleFromFile(photo.name) : d.title),
      image_path,
      url: det?.url ?? (d.url?.trim() || null),
      creator: d.creator?.trim() || null,
      body: textKind ? d.body?.trim() || null : null,
      note: d.note?.trim() || null,
    });
    if (editId) {
      const urlChanged = data.get().items.get(editId)?.url !== clean.url;
      updateItem(editId, clean);
      if (urlChanged && clean.url) void enrich(editId);
      toast('Saved');
    } else {
      const item = createItem(clean);
      if (item.url) void enrich(item.id);
      toast(`Acquired: ${item.title}`, { label: 'Open', run: () => ui.set({ openItemId: item.id }) });
    }
    close();
  }

  return (
    <Sheet
      title={editId ? 'Edit exhibit' : 'New acquisition'}
      onClose={close}
      footer={
        <>
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <button type="submit" form="add-sheet-form" className="btn btn--primary" disabled={busy}>
            {editId ? 'Save changes' : 'Add to the cabinet'}
          </button>
        </>
      }
    >
      <form id="add-sheet-form" className="add-form" onSubmit={submit}>
        <div className="field">
          <span id="kind-label">Kind</span>
          <div className="chips" role="radiogroup" aria-labelledby="kind-label">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                className="chip"
                aria-checked={d.kind === k}
                onClick={() => {
                  setKindTouched(true);
                  set({ kind: k });
                }}
              >
                <Icon name={k} size={15} /> {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>{textKind ? 'Source link (optional)' : 'Link'}</span>
          <input
            className="input"
            type="text"
            inputMode="url"
            value={d.url ?? ''}
            onChange={(e) => onUrl(e.target.value)}
            placeholder="https://…"
            autoFocus={!editId && !textKind}
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        {textKind && (
          <label className="field">
            <span>{d.kind === 'quote' ? 'The quote' : 'The note'}</span>
            <textarea
              className="textarea"
              value={d.body ?? ''}
              onChange={(e) => set({ body: e.target.value })}
              rows={d.kind === 'quote' ? 3 : 5}
              autoFocus={!editId}
            />
          </label>
        )}

        <div className="add-form__row">
          <label className="field">
            <span>Title</span>
            <input
              className="input"
              value={d.title ?? ''}
              onChange={(e) => {
                setTitleTouched(true);
                set({ title: e.target.value });
              }}
              placeholder={textKind ? 'Optional, taken from the text' : 'Filled in from the link'}
            />
          </label>
          <label className="field">
            <span>{CREATOR_LABEL[d.kind]}</span>
            <input className="input" value={d.creator ?? ''} onChange={(e) => set({ creator: e.target.value })} />
          </label>
        </div>

        <label className="field">
          <span>Why I kept this</span>
          <textarea className="textarea" value={d.note ?? ''} onChange={(e) => set({ note: e.target.value })} rows={2} />
        </label>

        <div className="field">
          <span>{d.kind === 'photo' ? 'Photo' : 'Photo or cover (optional)'}</span>
          <div className="photo-field">
            {shownPhoto && <img className="photo-field__thumb" src={shownPhoto} alt="" />}
            <label className="btn">
              <input
                type="file"
                accept="image/*"
                className="visually-hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setPhoto(f);
                    setRemovePhoto(false);
                  }
                }}
              />
              <Icon name="photo" size={16} /> {shownPhoto ? 'Replace' : 'Choose image'}
            </label>
            {shownPhoto && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setPhoto(null);
                  setRemovePhoto(true);
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="add-form__row">
          <div className="field">
            <span>Room</span>
            <RoomPicker value={d.room_id ?? null} onChange={(room_id) => set({ room_id })} />
          </div>
          <div className="field">
            <span>Tags</span>
            <TagInput value={d.tags ?? []} onChange={(t) => set({ tags: t })} suggestions={tags} />
          </div>
        </div>

        <div className="add-form__row add-form__row--status">
          <div className="field">
            <span id="status-label">Status</span>
            <div className="chips" role="radiogroup" aria-labelledby="status-label">
              {STATUSES.map((s) => (
                <button key={s} type="button" role="radio" className="chip" aria-checked={d.status === s} onClick={() => set({ status: s })}>
                  {s === 'none' ? 'None' : STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <label className="add-form__fav">
            <input type="checkbox" checked={!!d.favourite} onChange={(e) => set({ favourite: e.target.checked })} />
            <span className="add-form__star" aria-hidden="true">★</span> Favourite
          </label>
        </div>
      </form>
    </Sheet>
  );
}
