import { useState } from 'react';
import type { Item } from '../../data/types';
import { embedFor } from '../../lib/media';

/** YouTube/Vimeo/Spotify/SoundCloud players play inline; PDFs load on request (they're heavy). */
export function EmbedPlayer({ item }: { item: Item }) {
  const embed = embedFor(item);
  const isPdf = !!embed && /PDF/.test(embed.provider);
  const [show, setShow] = useState(!isPdf);
  if (!embed) return null;
  if (!show) {
    return (
      <section className="drawer__section">
        <button type="button" className="btn" onClick={() => setShow(true)}>
          Preview the {embed.provider} here
        </button>
      </section>
    );
  }
  return (
    <section className="drawer__section">
      <div
        className="embed"
        style={embed.height ? { height: embed.height } : { aspectRatio: String(embed.aspect ?? 16 / 9), maxHeight: embed.aspect && embed.aspect < 1 ? 560 : undefined }}
      >
        <iframe
          src={embed.src}
          title={`${embed.provider} player: ${item.title}`}
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </section>
  );
}
