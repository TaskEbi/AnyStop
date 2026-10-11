import type { CardBodyProps } from '../Card';
import { imageFor } from '../../../lib/media';
import { CardImage, CardMeta } from './parts';

/** Polaroid with a handwritten caption. */
export function PhotoCard({ item, room }: CardBodyProps) {
  return (
    <div className="polaroid">
      <div className="polaroid__window">
        <CardImage src={imageFor(item)} alt={item.title} className="polaroid__img" fallback={<span className="polaroid__blank" />} />
      </div>
      <p className="polaroid__caption">{item.title || 'Untitled'}</p>
      <CardMeta item={item} room={room} />
    </div>
  );
}
