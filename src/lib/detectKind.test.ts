import { describe, expect, it } from 'vitest';
import { detect, paperRef, youtubeId } from './detectKind';
import { titleFromUrl } from './titleFromUrl';

describe('detect', () => {
  it.each([
    ['https://www.youtube.com/watch?v=0fKBhvDjuy0', 'video'],
    ['youtu.be/0fKBhvDjuy0', 'video'],
    ['https://vimeo.com/76979871', 'video'],
    ['https://www.tiktok.com/@someone/video/123', 'video'],
    ['https://open.spotify.com/album/1weenld61qoidwYuZ1GESA', 'music'],
    ['https://music.apple.com/us/album/kind-of-blue/268443092', 'music'],
    ['https://soundcloud.com/artist/track', 'music'],
    ['https://someband.bandcamp.com/album/x', 'music'],
    ['https://arxiv.org/abs/1706.03762', 'paper'],
    ['https://doi.org/10.1038/nature14539', 'paper'],
    ['https://pubmed.ncbi.nlm.nih.gov/12345678/', 'paper'],
    ['https://www.semanticscholar.org/paper/abc', 'paper'],
    ['https://example.com/files/thesis.pdf', 'paper'],
    ['https://en.wikipedia.org/wiki/Pale_Blue_Dot', 'article'],
    ['https://someone.substack.com/p/a-post', 'article'],
    ['https://www.theguardian.com/science/2024/a-story', 'article'],
    ['https://upload.wikimedia.org/x/y/Earth.jpg', 'photo'],
    ['https://example.com/', 'link'],
    ['example.com/some/page', 'link'],
  ])('%s → %s', (input, kind) => {
    expect(detect(input).kind).toBe(kind);
  });

  it('titles paper links by their arXiv id or DOI', () => {
    expect(detect('https://arxiv.org/abs/2005.14165').title).toBe('arXiv:2005.14165');
  });

  it('turns a bare DOI or arXiv id into a paper link', () => {
    expect(detect('10.1002/j.1538-7305.1948.tb01338.x')).toMatchObject({
      kind: 'paper',
      url: 'https://doi.org/10.1002/j.1538-7305.1948.tb01338.x',
    });
    expect(detect('arXiv:1706.03762')).toMatchObject({ kind: 'paper', url: 'https://arxiv.org/abs/1706.03762' });
  });

  it('reads quoted text as a quote with attribution', () => {
    expect(detect('“Less, but better.” — Dieter Rams')).toMatchObject({
      kind: 'quote',
      body: 'Less, but better.',
      creator: 'Dieter Rams',
    });
    expect(detect('"Stay hungry"')).toMatchObject({ kind: 'quote', body: 'Stay hungry', creator: null });
  });

  it('reads other text as a note', () => {
    const d = detect('Look up the Voyager Golden Record track list');
    expect(d.kind).toBe('note');
    expect(d.body).toBe('Look up the Voyager Golden Record track list');
  });

  it('does not treat sentences with dots as URLs', () => {
    expect(detect('see e.g. this thing').kind).toBe('note');
  });
});

describe('paperRef', () => {
  it('finds arXiv ids and DOIs', () => {
    expect(paperRef('https://arxiv.org/abs/1706.03762v5')).toBe('arXiv:1706.03762');
    expect(paperRef('https://arxiv.org/pdf/1706.03762')).toBe('arXiv:1706.03762');
    expect(paperRef('https://doi.org/10.1038/nature14539')).toBe('doi:10.1038/nature14539');
    expect(paperRef('https://example.com')).toBeNull();
  });
});

describe('youtubeId', () => {
  it('handles the common URL shapes', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=0fKBhvDjuy0&t=3')).toBe('0fKBhvDjuy0');
    expect(youtubeId('https://youtu.be/0fKBhvDjuy0')).toBe('0fKBhvDjuy0');
    expect(youtubeId('https://www.youtube.com/shorts/abcdefghijk')).toBe('abcdefghijk');
    expect(youtubeId('https://vimeo.com/1')).toBeNull();
  });
});

describe('titleFromUrl', () => {
  it.each([
    ['https://en.wikipedia.org/wiki/Pale_Blue_Dot', 'Pale Blue Dot'],
    ['https://example.com/blog/my-favourite-post', 'My favourite post'],
    ['https://example.com/posts/my-post-a1b2c3d4e5f6', 'My post'],
    ['https://www.youtube.com/watch?v=0fKBhvDjuy0', 'YouTube video'],
    ['https://example.com/', 'example.com'],
    ['https://en.wikipedia.org/wiki/Caf%C3%A9_society', 'Café society'],
  ])('%s → %s', (url, title) => {
    expect(titleFromUrl(url)).toBe(title);
  });
});
