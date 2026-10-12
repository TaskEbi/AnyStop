import { describe, expect, it } from 'vitest';
import { matchScore, rankMatches } from './match';
import { sameLinkKey } from '../../data/actions';

describe('jump-to matching', () => {
  it('needs every word, in any order', () => {
    expect(matchScore('Kind of Blue', 'blue kind')).not.toBeNull();
    expect(matchScore('Kind of Blue', 'blue train')).toBeNull();
  });
  it('accepts letters in order as a last resort', () => {
    expect(matchScore('Kind of Blue', 'kob')).not.toBeNull();
    expect(matchScore('Kind of Blue', 'bok')).toBeNull();
  });
  it('ranks word starts above inner matches and both above scattered letters', () => {
    const titles = ['Somewhere in Blueland', 'Navy blues', 'Blue Marble', 'B-l-u-e-ish'];
    expect(rankMatches(titles, 'blue', (t) => t, 10)).toEqual(['Blue Marble', 'Navy blues', 'Somewhere in Blueland', 'B-l-u-e-ish']);
  });
});

describe('same link', () => {
  it('ignores scheme, www, trailing slash, fragments and tracking', () => {
    const key = sameLinkKey('https://www.example.com/a/b/');
    expect(sameLinkKey('http://example.com/a/b')).toBe(key);
    expect(sameLinkKey('https://example.com/a/b#part')).toBe(key);
    expect(sameLinkKey('https://example.com/a/b?utm_source=x&fbclid=y')).toBe(key);
  });
  it('keeps the parts that make a different page', () => {
    expect(sameLinkKey('https://youtube.com/watch?v=abc')).not.toBe(sameLinkKey('https://youtube.com/watch?v=xyz'));
    expect(sameLinkKey('https://example.com/a')).not.toBe(sameLinkKey('https://example.com/b'));
  });
});
