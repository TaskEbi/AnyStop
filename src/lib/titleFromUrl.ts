const SITE_NAMES: Record<string, string> = {
  'youtube.com': 'YouTube video',
  'youtu.be': 'YouTube video',
  'vimeo.com': 'Vimeo video',
  'tiktok.com': 'TikTok video',
  'open.spotify.com': 'Spotify',
  'music.apple.com': 'Apple Music',
  'soundcloud.com': 'SoundCloud',
};

/** Path segments that never make a useful title on their own. */
const NOISE = new Set(['watch', 'index', 'index.html', 'abs', 'pdf', 'wiki', 'article', 'articles', 'p', 'post', 'posts', 'album', 'track', 'playlist', 'video', 'videos', 'status', 'amp', 'en', 'html']);

function looksLikeId(seg: string): boolean {
  return /^\d+$/.test(seg) || (/^[A-Za-z0-9_-]{8,}$/.test(seg) && /\d/.test(seg) && !/[-_]/.test(seg)) || /^[0-9a-f]{12,}$/i.test(seg);
}

function tidy(seg: string): string {
  let s = seg;
  try {
    s = decodeURIComponent(s);
  } catch {
    /* keep as-is */
  }
  s = s.replace(/\.(html?|php|aspx?|pdf|jpe?g|png|gif|webp)$/i, '');
  s = s.replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim();
  // Drop trailing hash-like ids that blogs append ("my-post-a1b2c3d4e5f6")
  s = s.replace(/\s[0-9a-f]{8,}$/i, '');
  if (s === s.toLowerCase()) s = s.charAt(0).toUpperCase() + s.slice(1);
  return s;
}

/** Best-effort readable title from a URL: `wiki/Pale_Blue_Dot` → "Pale Blue Dot". */
export function titleFromUrl(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  const host = url.hostname.replace(/^www\.|^m\./, '');
  const segments = url.pathname.split('/').filter(Boolean);

  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (NOISE.has(seg.toLowerCase()) || looksLikeId(seg)) continue;
    const t = tidy(seg);
    if (t.length >= 2 && /[a-z]/i.test(t)) return t;
  }

  const site = Object.entries(SITE_NAMES).find(([h]) => host === h || host.endsWith('.' + h));
  if (site) return site[1];
  return host;
}
