import { useState } from 'react';
import { download, exportCollection, importCollection } from '../../data/backup';
import { data } from '../../data/store';
import { toast, ui } from '../../data/ui';
import { useStore } from '../../lib/createStore';
import { plural } from '../../lib/format';
import { bookmarkletHref } from '../../app/share';
import { Sheet } from '../../ui/Sheet';
import './backoffice.css';

function Bookmarklet() {
  const name = useStore(data, (s) => s.settings.museum_name);
  return (
    <section className="office__section">
      <h3 className="office__heading hand">Bookmarklet</h3>
      <p>Drag this tag to your bookmarks bar. Clicking it on any page saves that page to the cabinet in one go.</p>
      <p className="office__bookmarklet">
        <a
          className="office__tag"
          // React blocks javascript: hrefs in JSX, so set it directly on the element.
          ref={(el) => el?.setAttribute('href', bookmarkletHref())}
          onClick={(e) => {
            e.preventDefault();
            toast('Drag it to your bookmarks bar instead of clicking it here');
          }}
        >
          + {name}
        </a>
      </p>
    </section>
  );
}

function PhoneApp() {
  return (
    <section className="office__section">
      <h3 className="office__heading hand">On your phone</h3>
      <ul className="office__list">
        <li>
          <strong>Android (Chrome):</strong> open the cabinet, choose <em>Install app</em> from the ⋮ menu. It then appears in every
          app's <em>Share</em> sheet, so links and photos go straight into the add sheet.
        </li>
        <li>
          <strong>iPhone (Safari):</strong> tap Share → <em>Add to Home Screen</em>. iOS doesn't let web apps join the share sheet,
          so copy a link and paste it into the Acquire bar: it saves with one tap.
        </li>
      </ul>
    </section>
  );
}

function Backups() {
  const counts = useStore(data, (s) => s.items.size + s.log_entries.size + s.log_topics.size);
  const [busy, setBusy] = useState<string | null>(null);

  async function doExport() {
    setBusy('Packing…');
    try {
      const blob = await exportCollection((n, total) => setBusy(`Packing photos ${n}/${total}…`));
      download(blob, `curio-cabinet-${new Date().toISOString().slice(0, 10)}.zip`);
      toast('Export downloaded');
    } catch (e) {
      toast(`Export failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function doImport(file: File) {
    setBusy('Unpacking…');
    try {
      const r = await importCollection(file);
      const log = r.logEntries || r.logTopics ? `, ${plural(r.logEntries, 'log entry', 'log entries')}` : '';
      toast(`Imported ${plural(r.items, 'exhibit')}, ${plural(r.rooms, 'room')}, ${plural(r.connections, 'string')}, ${plural(r.photos, 'photo')}${log}`);
    } catch (e) {
      toast(`Import failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="office__section">
      <h3 className="office__heading hand">Safety net</h3>
      <p>
        Export everything (exhibits, rooms, strings, settings, your Daily Log and a folder of photos) as one zip. Importing it later merges by id, so it
        restores rather than duplicates.
      </p>
      <div className="office__actions">
        <button type="button" className="btn btn--primary" onClick={doExport} disabled={!!busy || !counts}>
          Export collection
        </button>
        <label className="btn">
          <input
            type="file"
            accept=".zip,.json,application/zip,application/json"
            className="visually-hidden"
            disabled={!!busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void doImport(f);
            }}
          />
          Import…
        </label>
        {busy && <span className="office__busy type">{busy}</span>}
      </div>
    </section>
  );
}

/** Tools that aren't part of everyday browsing. */
export function BackOffice() {
  return (
    <Sheet title="The back office" onClose={() => ui.set({ backOfficeOpen: false })}>
      <Bookmarklet />
      <PhoneApp />
      <Backups />
    </Sheet>
  );
}
