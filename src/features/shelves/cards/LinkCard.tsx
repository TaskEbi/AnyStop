import type { CardBodyProps } from '../Card';
import { hostOf } from '../../../lib/detectKind';
import { CardImage, CardMeta } from './parts';

/** Paper ticket stub: perforated left edge, the domain as a little postmark. */
export function LinkCard({ item, room }: CardBodyProps) {
  const domain = hostOf(item.url);
  return (
    <div className="ticket">
      <div className="ticket__stub" aria-hidden="true">
        <span className="ticket__admit">Admit one</span>
      </div>
      <div className="ticket__main">
        {domain && (
          <span className="postmark">
            <CardImage src={item.preview?.favicon ?? null} className="postmark__icon" />
            {domain}
          </span>
        )}
        <h3 className="card-title">{item.title || domain || 'Untitled link'}</h3>
        {item.preview?.description && <p className="card-desc">{item.preview.description}</p>}
        <CardMeta item={item} room={room} />
      </div>
    </div>
  );
}
