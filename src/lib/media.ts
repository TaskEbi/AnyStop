import type { Item } from '../data/types';
import { youtubeId } from './detectKind';

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|svg|bmp)(\?|#|$)/i;

/** The picture to show on a card: uploaded photo, the image URL itself, a preview thumbnail, or a derived one. */
export function imageFor(item: Item): string | null {
  // Uploaded photos (image_path) are resolved to signed URLs once storage arrives in phase 2.
  if (item.kind === 'photo' && item.url && IMAGE_EXT.test(item.url)) return item.url;
  if (item.preview?.thumbnail) return item.preview.thumbnail;
  const yt = youtubeId(item.url);
  if (yt) return `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
  return null;
}
