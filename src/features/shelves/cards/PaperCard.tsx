import type { CardBodyProps } from '../Card';
import { paperRef } from '../../../lib/detectKind';
import { CardMeta } from './parts';

/** Ruled index card with the arXiv id or DOI typed in the corner. */
export function PaperCard({ item, room }: CardBodyProps) {
  const ref = paperRef(item.url);
  return (
    <div className="index-card">
      <div className="index-card__head">
        {ref && <span className="index-card__ref">{ref}</span>}
        <h3 className="card-title">{item.title || 'Untitled paper'}</h3>
      </div>
      <div className="index-card__lines">
        {item.creator && <p className="index-card__creator">{item.creator}</p>}
        {(item.note || item.preview?.description) && <p className="index-card__note">{item.note || item.preview?.description}</p>}
      </div>
      <CardMeta item={item} room={room} />
    </div>
  );
}
