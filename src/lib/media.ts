import type { Item } from '../data/types';
import { paperRef, toUrl, youtubeId } from './detectKind';
import { useImagePath } from './photos';

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|svg|bmp)(\?|#|$)/i;

/** The picture from the web for a card: the image URL itself, a preview thumbnail, or a derived one. */
export function imageFor(item: Item): string | null {
  if (item.kind === 'photo' && item.url && IMAGE_EXT.test(item.url)) return item.url;
  if (item.preview?.thumbnail) return item.preview.thumbnail;
  const yt = youtubeId(item.url);
  if (yt) return `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
  return null;
}

/** Uploaded photo/cover first, then whatever the web gives us. */
export function useItemImage(item: Item): string | null {
  const uploaded = useImagePath(item.image_path);
  return uploaded ?? (item.image_path ? null : imageFor(item));
}

export interface Embed {
  provider: string;
  src: string;
  /** width / height, or a fixed pixel height */
  aspect?: number;
  height?: number;
}

/** A player or viewer that can live inside the drawer, if the source supports one. */
export function embedFor(item: Item): Embed | null {
  if (item.preview?.embed) return item.preview.embed;
  const u = toUrl(item.url ?? '');
  if (!u) return null;
  const host = u.hostname.replace(/^www\.|^m\./, '');

  const yt = youtubeId(u.href);
  if (yt) {
    const start = u.searchParams.get('t')?.replace(/s$/, '');
    return { provider: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${yt}${start && /^\d+$/.test(start) ? `?start=${start}` : ''}`, aspect: 16 / 9 };
  }
  const vimeo = host === 'vimeo.com' && u.pathname.match(/^\/(\d+)/)?.[1];
  if (vimeo) return { provider: 'Vimeo', src: `https://player.vimeo.com/video/${vimeo}`, aspect: 16 / 9 };

  const tiktok = host.endsWith('tiktok.com') && u.pathname.match(/\/video\/(\d+)/)?.[1];
  if (tiktok) return { provider: 'TikTok', src: `https://www.tiktok.com/embed/v2/${tiktok}`, aspect: 9 / 16 };

  const spotify = host === 'open.spotify.com' && u.pathname.match(/^(?:\/intl-[a-z-]+)?\/(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/);
  if (spotify) {
    return { provider: 'Spotify', src: `https://open.spotify.com/embed/${spotify[1]}/${spotify[2]}`, height: spotify[1] === 'track' || spotify[1] === 'episode' ? 152 : 352 };
  }
  if (host === 'soundcloud.com') {
    return { provider: 'SoundCloud', src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.href)}&visual=true&show_comments=false`, height: 300 };
  }
  if (host === 'music.apple.com') {
    return { provider: 'Apple Music', src: `https://embed.music.apple.com${u.pathname}${u.search}`, height: u.searchParams.has('i') ? 175 : 450 };
  }

  const ref = paperRef(u.href);
  if (ref?.startsWith('arXiv:')) return { provider: 'arXiv PDF', src: `https://arxiv.org/pdf/${ref.slice(6)}`, height: 640 };
  if (/\.pdf$/i.test(u.pathname)) return { provider: 'PDF', src: u.href, height: 640 };
  return null;
}
