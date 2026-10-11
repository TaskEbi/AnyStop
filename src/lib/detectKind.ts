import type { Kind } from '../data/types';
import { titleFromUrl } from './titleFromUrl';

/** What we can tell about a pasted string before asking the network. */
export interface Detected {
  kind: Kind;
  url: string | null;
  title: string;
  body: string | null;
  creator: string | null;
}

const VIDEO_HOSTS = ['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'vimeo.com', 'tiktok.com', 'dailymotion.com', 'twitch.tv'];
const MUSIC_HOSTS = ['spotify.com', 'music.apple.com', 'soundcloud.com', 'bandcamp.com', 'music.youtube.com', 'tidal.com', 'deezer.com'];
const PAPER_HOSTS = [
  'arxiv.org', 'doi.org', 'pubmed.ncbi.nlm.nih.gov', 'semanticscholar.org', 'biorxiv.org', 'medrxiv.org',
  'openreview.net', 'ssrn.com', 'jstor.org', 'scholar.archive.org', 'aclanthology.org', 'proceedings.neurips.cc',
];
const ARTICLE_HOSTS = [
  'wikipedia.org', 'medium.com', 'substack.com', 'nytimes.com', 'theguardian.com', 'bbc.co.uk', 'bbc.com',
  'washingtonpost.com', 'theatlantic.com', 'newyorker.com', 'wired.com', 'economist.com', 'reuters.com',
  'apnews.com', 'npr.org', 'aeon.co', 'nautil.us', 'quantamagazine.org', 'vox.com', 'theverge.com',
  'arstechnica.com', 'ft.com', 'wsj.com', 'bloomberg.com', 'lrb.co.uk', 'nybooks.com', 'smithsonianmag.com',
  'nationalgeographic.com', 'scientificamerican.com', 'newscientist.com', 'cnn.com', 'latimes.com',
  'lemonde.fr', 'spiegel.de', 'harpers.org', 'theconversation.com', 'publicdomainreview.org',
];
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|heic|svg|bmp|tiff?)$/i;
const IMAGE_HOSTS = ['i.imgur.com', 'images.unsplash.com', 'pbs.twimg.com', 'i.redd.it'];

const DOI_RE = /\b(10\.\d{4,9}\/[^\s"<>]+)/;
const ARXIV_NEW_RE = /\b(\d{4}\.\d{4,5})(v\d+)?\b/;
const ARXIV_OLD_RE = /\b([a-z-]+(?:\.[A-Z]{2})?\/\d{7})(v\d+)?\b/;

function hostMatches(host: string, list: string[]): boolean {
  return list.some((h) => host === h || host.endsWith('.' + h));
}

/** Turn "example.com/x", "www.x.org" or "https://…" into a parsed URL, else null. */
export function toUrl(raw: string): URL | null {
  const s = raw.trim();
  if (!s || /\s/.test(s)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : /^[\w-]+(\.[\w-]+)+(:\d+)?([/?#]|$)/.test(s) ? `https://${s}` : null;
  if (!withScheme) return null;
  try {
    const u = new URL(withScheme);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

export function hostOf(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '').replace(/^m\./, '');
  } catch {
    return '';
  }
}

/** "arXiv:1706.03762" or "doi:10.1000/xyz" for paper URLs, else null. */
export function paperRef(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = toUrl(url);
  if (!u) return null;
  const host = u.hostname;
  const path = decodeURIComponent(u.pathname);
  if (hostMatches(host, ['arxiv.org'])) {
    const m = path.match(ARXIV_NEW_RE) ?? path.match(ARXIV_OLD_RE);
    if (m) return `arXiv:${m[1]}`;
  }
  const doi = (path + u.search).match(DOI_RE);
  if (doi) return `doi:${doi[1].replace(/[.,;)]+$/, '')}`;
  if (hostMatches(host, ['pubmed.ncbi.nlm.nih.gov'])) {
    const m = path.match(/\/(\d{5,9})/);
    if (m) return `PMID:${m[1]}`;
  }
  return null;
}

export function youtubeId(url: string | null | undefined): string | null {
  const u = url ? toUrl(url) : null;
  if (!u) return null;
  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
  if (hostMatches(host, ['youtube.com', 'youtube-nocookie.com'])) {
    if (u.pathname === '/watch') return u.searchParams.get('v');
    const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{6,})/);
    if (m) return m[1];
  }
  return null;
}

export function kindFromUrl(url: URL): Kind {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = url.pathname.toLowerCase();
  if (hostMatches(host, ['music.youtube.com'])) return 'music';
  if (hostMatches(host, VIDEO_HOSTS)) return 'video';
  if (hostMatches(host, MUSIC_HOSTS)) return 'music';
  if (hostMatches(host, PAPER_HOSTS) || path.endsWith('.pdf') || /\/pmc\/articles\//.test(path)) return 'paper';
  if (DOI_RE.test(decodeURIComponent(path))) return 'paper';
  if (IMAGE_EXT.test(path) || hostMatches(host, IMAGE_HOSTS)) return 'photo';
  if (hostMatches(host, ARTICLE_HOSTS)) return 'article';
  return 'link';
}

const OPEN_QUOTES = '"“„«‘\'「';
const CLOSE_QUOTES = '"”“»’\'」';

/** Split '"Some words." — Author' into its quote and attribution. */
function splitQuote(text: string): { body: string; creator: string | null } | null {
  const s = text.trim();
  if (s.length < 3 || !OPEN_QUOTES.includes(s[0])) return null;
  const m = s.match(/^(.*[”"»’'」])\s*(?:[—–-]{1,2}|~)\s*(.+)$/s);
  const quoted = m ? m[1] : s;
  const creator = m ? m[2].trim() : null;
  const last = quoted[quoted.length - 1];
  if (!CLOSE_QUOTES.includes(last)) return null;
  const body = quoted.slice(1, -1).trim();
  return body ? { body, creator } : null;
}

function firstWords(text: string, max = 60): string {
  const line = text.trim().split(/\n/)[0].replace(/\s+/g, ' ');
  if (line.length <= max) return line;
  const cut = line.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 30)) + '…';
}

/**
 * Work out what a pasted string is. URLs get a kind from their host/path,
 * bare DOIs and arXiv ids become paper links, quoted text becomes a quote and
 * anything else a note.
 */
export function detect(raw: string): Detected {
  const text = raw.trim();

  const doiOnly = text.match(/^(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/\S+)$/i);
  if (doiOnly && !/^https?:/i.test(text)) {
    const url = `https://doi.org/${doiOnly[1]}`;
    return { kind: 'paper', url, title: '', body: null, creator: null };
  }
  const arxivOnly = text.match(/^arxiv:\s*(\d{4}\.\d{4,5}(?:v\d+)?)$/i);
  if (arxivOnly) {
    const url = `https://arxiv.org/abs/${arxivOnly[1]}`;
    return { kind: 'paper', url, title: '', body: null, creator: null };
  }

  const url = toUrl(text);
  if (url) {
    const kind = kindFromUrl(url);
    const title = (kind === 'paper' && paperRef(url.href)) || titleFromUrl(url.href);
    return { kind, url: url.href, title, body: null, creator: null };
  }

  const quote = splitQuote(text);
  if (quote) return { kind: 'quote', url: null, title: firstWords(quote.body), body: quote.body, creator: quote.creator };

  return { kind: 'note', url: null, title: firstWords(text), body: text, creator: null };
}
