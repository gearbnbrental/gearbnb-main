import { describe, expect, it } from 'vitest';
import { splitBestForLine } from './bestForLine';

describe('splitBestForLine', () => {
  it('extracts a "Best for ..." first line and returns the rest separately', () => {
    expect(splitBestForLine('Best for Motocampers, Backpackers, Couples or Camping Buddies.\nA compact setup.')).toEqual({
      lead: 'for',
      bestFor: 'Motocampers, Backpackers, Couples or Camping Buddies.',
      rest: 'A compact setup.',
    });
  });

  it('is case-insensitive and accepts an optional colon', () => {
    expect(splitBestForLine('BEST FOR: Families.\nMore text.')).toEqual({ lead: 'for', bestFor: 'Families.', rest: 'More text.' });
  });

  it('treats a single-line description as the whole tagline when it starts with "Best for"', () => {
    expect(splitBestForLine('Best for Solo Campers.')).toEqual({ lead: 'for', bestFor: 'Solo Campers.', rest: '' });
  });

  it('leaves an ordinary description completely alone', () => {
    expect(splitBestForLine('A cozy 2-person camping set.')).toEqual({ lead: 'for', bestFor: null, rest: 'A cozy 2-person camping set.' });
  });

  it('only looks at the first line, never a "Best for" mention further down', () => {
    expect(splitBestForLine('A cozy set.\nBest for nothing in particular.')).toEqual({
      lead: 'for',
      bestFor: null,
      rest: 'A cozy set.\nBest for nothing in particular.',
    });
  });

  it('works the same way for a Build Your Own gear description as for a package one', () => {
    expect(splitBestForLine('Best for Solo Hikers.\nSize: 395x270x183 cm')).toEqual({
      lead: 'for',
      bestFor: 'Solo Hikers.',
      rest: 'Size: 395x270x183 cm',
    });
  });
});

describe('splitBestForLine "Best to"', () => {
  it('recognises "Best to have ..." as a tagline with lead "to"', () => {
    expect(splitBestForLine('Best to have when camping on rocky soil\nMore.')).toEqual({
      lead: 'to',
      bestFor: 'have when camping on rocky soil',
      rest: 'More.',
    });
  });
});
