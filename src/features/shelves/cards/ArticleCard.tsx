import type { CardBodyProps } from '../Card';
import { hostOf } from '../../../lib/detectKind';
import { museumDate } from '../../../lib/format';
import { useItemImage } from '../../../lib/media';
import { CardImage, CardMeta } from './parts';

/** Newspaper clipping with a zig-zag torn bottom edge. */
export function ArticleCard({ item, room }: CardBodyProps) {
  const masthead = item.preview?.site_name || hostOf(item.url) || 'Clipping';
  const src = useItemImage(item);
  return (
    <div className="clipping">
      <p className="clipping__masthead">
        <span>{masthead}</span>
        <span>{museumDate(item.created_at)}</span>
      </p>
      <h3 className="clipping__headline">{item.title || 'Untitled article'}</h3>
      {item.creator && <p className="clipping__byline">By {item.creator}</p>}
      <CardImage src={src} className="clipping__photo" />
      {item.preview?.description && <p className="clipping__text">{item.preview.description}</p>}
      <CardMeta item={item} room={room} />
    </div>
  );
}
