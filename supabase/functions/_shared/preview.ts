// Link-preview core: fetch a URL server-side and pull out title, creator, description,
// thumbnail, site name and favicon. Pure TypeScript with no runtime imports, so the same
// file runs in the Supabase Edge Function (Deno) and the Vite dev server (Node).

export interface PreviewResult {
  ok: boolean;
  title?: string;
  creator?: string;
  site_name?: string;
  description?: string;
  thumbnail?: string;
  favicon?: string;
  embed?: { provider: string; src: string; aspect?: number };
  error?: string;
}

const UA = 'Mozilla/5.0 (compatible; CurioCabinet/1.0; link preview)';
const TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 700_000;
const MAX_REDIRECTS = 5;

// ─── safety: only public http(s) hosts ──────────────────────────────────────

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (!host.includes('.') && !host.includes(':')) return true; // bare intranet names
  if (isPrivateIPv4(host)) return true;
  if (host.includes(':')) {
    // IPv6 literal
    return host === '::1' || host === '::' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host) || host.startsWith('::ffff:');
  }
  return false;
}

/** Optional DNS check (Deno.resolveDns in the edge function) so a public name can't point inward. */
export type Resolver = (host: string) => Promise<string[]>;

async function assertPublic(url: URL, resolve?: Resolver) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http(s) links');
  if (url.port && !['80', '443', '8080', '8443'].includes(url.port)) throw new Error('Port not allowed');
  if (isPrivateHost(url.hostname)) throw new Error('Private address');
  if (resolve) {
    const ips = await resolve(url.hostname).catch(() => []);
    if (ips.some((ip) => isPrivateHost(ip))) throw new Error('Private address');
  }
}

async function safeFetch(input: string, init: RequestInit, resolve?: Resolver): Promise<Response> {
  let url = new URL(input);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url, resolve);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        ...init,
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'user-agent': UA, 'accept-language': 'en;q=0.9,*;q=0.5', ...(init.headers ?? {}) },
      });
      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc) {
        url = new URL(loc, url);
        continue;
      }
      return res;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('Too many redirects');
}

async function getJson<T>(url: string, resolve?: Resolver): Promise<T | null> {
  try {
    const res = await safeFetch(url, { headers: { accept: 'application/json' } }, resolve);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Read at most `max` bytes of a body as text. */
async function readCapped(res: Response, max: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < max) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.length;
  }
  void reader.cancel().catch(() => {});
  const all = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    all.set(c.subarray(0, Math.min(c.length, size - off)), off);
    off += c.length;
  }
  const charset = /charset=([\w-]+)/i.exec(res.headers.get('content-type') ?? '')?.[1] ?? 'utf-8';
  try {
    return new TextDecoder(charset).decode(all);
  } catch {
    return new TextDecoder().decode(all);
  }
}

// ─── HTML parsing (just the <head> bits we need) ───────────────────────────

export function decodeEntities(s: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => named[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
  }
  return out;
}

export function parseHtml(html: string, base: URL): PreviewResult {
  const head = html.slice(0, html.search(/<body[\s>]/i) > 0 ? html.search(/<body[\s>]/i) : html.length);
  const meta = new Map<string, string[]>();
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content) meta.set(key, [...(meta.get(key) ?? []), decodeEntities(a.content)]);
  }
  const first = (...keys: string[]) => {
    for (const k of keys) {
      const v = meta.get(k)?.[0];
      if (v) return v;
    }
    return undefined;
  };
  const abs = (u?: string) => {
    if (!u) return undefined;
    try {
      const r = new URL(u, base);
      return r.protocol === 'https:' || r.protocol === 'http:' ? r.href : undefined;
    } catch {
      return undefined;
    }
  };

  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  const authors = meta.get('citation_author') ?? [];
  const creator =
    authors.length > 2
      ? `${authors[0].split(',')[0]} et al.`
      : authors.length
        ? authors.join(', ')
        : first('author', 'article:author', 'twitter:creator', 'parsely-author', 'dc.creator');

  let icon: string | undefined;
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const rel = (a.rel ?? '').toLowerCase();
    if (a.href && /(^|\s)(icon|shortcut icon|apple-touch-icon)(\s|$)/.test(rel)) {
      icon = a.href;
      if (rel.includes('apple-touch-icon')) break;
    }
  }

  const video = first('og:video:secure_url', 'og:video:url', 'og:video');
  const embed = video && /bandcamp\.com\/EmbeddedPlayer/i.test(video) ? { provider: 'bandcamp', src: abs(video)!, aspect: 1 } : undefined;

  return {
    ok: true,
    title: first('citation_title', 'og:title', 'twitter:title') ?? (titleTag ? decodeEntities(titleTag) : undefined),
    creator: creator && !/^https?:/.test(creator) ? creator : undefined,
    site_name: first('og:site_name', 'application-name', 'citation_journal_title') ?? base.hostname.replace(/^www\./, ''),
    description: first('og:description', 'twitter:description', 'description', 'citation_abstract')?.slice(0, 500),
    thumbnail: abs(first('og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src')),
    favicon: abs(icon ?? '/favicon.ico'),
    embed,
  };
}

// ─── special cases with better sources than the page itself ────────────────

interface OEmbed {
  title?: string;
  author_name?: string;
  provider_name?: string;
  thumbnail_url?: string;
}

const OEMBED: [RegExp, (u: string) => string][] = [
  [/(^|\.)(youtube\.com|youtu\.be)$/, (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`],
  [/(^|\.)vimeo\.com$/, (u) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u)}`],
  [/(^|\.)spotify\.com$/, (u) => `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}`],
  [/(^|\.)soundcloud\.com$/, (u) => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(u)}`],
  [/(^|\.)tiktok\.com$/, (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`],
];

async function viaOEmbed(url: URL, resolve?: Resolver): Promise<PreviewResult | null> {
  const hit = OEMBED.find(([re]) => re.test(url.hostname));
  if (!hit) return null;
  const o = await getJson<OEmbed>(hit[1](url.href), resolve);
  if (!o?.title) return null;
  return {
    ok: true,
    title: o.title,
    creator: o.author_name,
    site_name: o.provider_name,
    thumbnail: o.thumbnail_url,
    favicon: `https://${url.hostname}/favicon.ico`,
  };
}

interface Crossref {
  message?: {
    title?: string[];
    author?: { given?: string; family?: string; name?: string }[];
    'container-title'?: string[];
    publisher?: string;
    abstract?: string;
  };
}

async function viaCrossref(url: URL, resolve?: Resolver): Promise<PreviewResult | null> {
  const doi = decodeURIComponent(url.pathname + url.search).match(/(10\.\d{4,9}\/[^\s"<>]+)/)?.[1];
  if (!doi || !/(^|\.)doi\.org$/.test(url.hostname)) return null;
  const r = await getJson<Crossref>(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, resolve);
  const m = r?.message;
  if (!m?.title?.[0]) return null;
  const names = (m.author ?? []).map((a) => a.name ?? [a.given, a.family].filter(Boolean).join(' ')).filter(Boolean);
  return {
    ok: true,
    title: decodeEntities(m.title[0]),
    creator: names.length > 2 ? `${names[0]} et al.` : names.join(', ') || undefined,
    site_name: m['container-title']?.[0] ?? m.publisher,
    description: m.abstract ? decodeEntities(m.abstract.replace(/<[^>]+>/g, ' ')).slice(0, 500) : undefined,
  };
}

interface WikiSummary {
  title?: string;
  extract?: string;
  thumbnail?: { source: string };
}

async function viaWikipedia(url: URL, resolve?: Resolver): Promise<PreviewResult | null> {
  const m = url.hostname.match(/^([a-z-]+)\.(?:m\.)?wikipedia\.org$/);
  const page = url.pathname.match(/^\/wiki\/(.+)$/)?.[1];
  if (!m || !page) return null;
  const s = await getJson<WikiSummary>(`https://${m[1]}.wikipedia.org/api/rest_v1/page/summary/${page}`, resolve);
  if (!s?.title) return null;
  return {
    ok: true,
    title: s.title,
    site_name: 'Wikipedia',
    description: s.extract?.slice(0, 500),
    thumbnail: s.thumbnail?.source,
    favicon: 'https://en.wikipedia.org/static/favicon/wikipedia.ico',
  };
}

// ─── entry point ────────────────────────────────────────────────────────────

export async function fetchPreview(raw: string, resolve?: Resolver): Promise<PreviewResult> {
  let url: URL;
  try {
    url = new URL(raw);
    await assertPublic(url, resolve);
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'Bad URL' };
  }

  for (const special of [viaOEmbed, viaCrossref, viaWikipedia]) {
    const r = await special(url, resolve).catch(() => null);
    if (!r) continue;
    // Spotify's oEmbed has no artist; its page description starts with it ("Miles Davis · album · 1959").
    if (!r.creator && /(^|\.)spotify\.com$/.test(url.hostname)) {
      const page = await fetchPage(url, resolve).catch(() => null);
      const desc = page?.description;
      if (desc?.includes(' · ')) Object.assign(r, { creator: desc.split(' · ')[0], description: desc });
    }
    return r;
  }

  try {
    return await fetchPage(url, resolve);
  } catch (e) {
    return { ok: false, error: (e as Error).name === 'AbortError' ? 'Timed out' : (e as Error).message };
  }
}

async function fetchPage(url: URL, resolve?: Resolver): Promise<PreviewResult> {
  const res = await safeFetch(url.href, { headers: { accept: 'text/html,application/xhtml+xml,*/*;q=0.8' } }, resolve);
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  const type = res.headers.get('content-type') ?? '';
  const site_name = url.hostname.replace(/^www\./, '');
  if (type.startsWith('image/')) {
    void res.body?.cancel();
    return { ok: true, thumbnail: url.href, site_name };
  }
  if (type.includes('pdf')) {
    void res.body?.cancel();
    return { ok: true, site_name };
  }
  if (!type.includes('html') && !type.includes('xml')) {
    void res.body?.cancel();
    return { ok: false, error: `Unsupported content (${type || 'unknown'})` };
  }
  return parseHtml(await readCapped(res, MAX_HTML_BYTES), new URL(res.url || url.href));
}
