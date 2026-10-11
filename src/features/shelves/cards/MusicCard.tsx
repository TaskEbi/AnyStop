import type { CardBodyProps } from '../Card';
import { imageFor } from '../../../lib/media';
import { CardImage, CardMeta } from './parts';

/** A record half out of its sleeve; the cover art is the record label. */
export function MusicCard({ item, room }: CardBodyProps) {
  return (
    <div className="vinyl">
      <div className="vinyl__stage">
        <div className="vinyl__record" aria-hidden="true">
          <span className="vinyl__label">
            <CardImage src={imageFor(item)} className="vinyl__art" />
          </span>
        </div>
        <div className="vinyl__sleeve">
          <h3 className="vinyl__title">{item.title || 'Untitled record'}</h3>
          {item.creator && <p className="vinyl__artist">{item.creator}</p>}
        </div>
      </div>
      <CardMeta item={item} room={room} />
    </div>
  );
}
