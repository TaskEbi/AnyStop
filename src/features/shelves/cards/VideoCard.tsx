import type { CardBodyProps } from '../Card';
import { useItemImage } from '../../../lib/media';
import { CardImage, CardMeta } from './parts';

/** A frame of film: dark strip, sprocket holes, the thumbnail and a play mark. */
export function VideoCard({ item, room }: CardBodyProps) {
  const src = useItemImage(item);
  return (
    <div className="film">
      <div className="film__frame">
        <CardImage src={src} className="film__img" fallback={<span className="film__blank" />} />
        <span className="film__play" aria-hidden="true" />
      </div>
      <div className="film__caption">
        <h3 className="card-title">{item.title || 'Untitled video'}</h3>
        {item.creator && <p className="film__creator">{item.creator}</p>}
        <CardMeta item={item} room={room} />
      </div>
    </div>
  );
}
