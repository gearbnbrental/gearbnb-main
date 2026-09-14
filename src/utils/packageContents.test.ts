import { describe, expect, it } from 'vitest';
import { getPackageContentItems, parsePackageContentsFromText, parseQuantityPrefix } from './packageContents';

describe('parseQuantityPrefix', () => {
  it('extracts an explicit leading quantity', () => {
    expect(parseQuantityPrefix('2x Black Moon Chair')).toEqual({ quantity: 2, name: 'Black Moon Chair' });
  });

  it('accepts the × character too', () => {
    expect(parseQuantityPrefix('3× Inflatable Pillow')).toEqual({ quantity: 3, name: 'Inflatable Pillow' });
  });

  it('defaults to quantity 1 when there is no leading marker', () => {
    expect(parseQuantityPrefix('4-Person Blackdog Vinyl Tent (incl. groundsheet)')).toEqual({
      quantity: 1,
      name: '4-Person Blackdog Vinyl Tent (incl. groundsheet)',
    });
  });
});

describe('parsePackageContentsFromText', () => {
  it('splits a run-on inclusions paragraph into individual items', () => {
    const text =
      '1x 4 Person Blackdog Vinyl Tent 1x Groundsheet 1x Camping Fan 1x Black King-sized Inflatable Bed ' +
      '1x Black Large Camping Table 2x Black Moon Chair 3x Black Inflatable Pillows 1x Black Bedsheet 1x Camping Hammer';
    expect(parsePackageContentsFromText(text)).toEqual([
      { quantity: 1, name: '4 Person Blackdog Vinyl Tent' },
      { quantity: 1, name: 'Groundsheet' },
      { quantity: 1, name: 'Camping Fan' },
      { quantity: 1, name: 'Black King-sized Inflatable Bed' },
      { quantity: 1, name: 'Black Large Camping Table' },
      { quantity: 2, name: 'Black Moon Chair' },
      { quantity: 3, name: 'Black Inflatable Pillows' },
      { quantity: 1, name: 'Black Bedsheet' },
      { quantity: 1, name: 'Camping Hammer' },
    ]);
  });

  it('leaves an ordinary marketing description alone (no repeated quantity markers)', () => {
    expect(
      parsePackageContentsFromText('3–4 Pax Casual Glamper Set — built for clear-sky camping with comfort.'),
    ).toEqual([]);
  });

  it('leaves a description with only one incidental number alone', () => {
    expect(parsePackageContentsFromText('Sleeps up to 4 people comfortably.')).toEqual([]);
  });

  it('returns an empty array for an empty description', () => {
    expect(parsePackageContentsFromText('')).toEqual([]);
    expect(parsePackageContentsFromText('   ')).toEqual([]);
  });
});

describe('getPackageContentItems', () => {
  it('prefers the structured includedItems array when it is populated', () => {
    const kit = {
      includedItems: ['1x Tent', '2x Chair'],
      description: 'This text is ignored because includedItems already has entries.',
    };
    expect(getPackageContentItems(kit)).toEqual([
      { quantity: 1, name: 'Tent' },
      { quantity: 2, name: 'Chair' },
    ]);
  });

  it('falls back to parsing description when includedItems is empty and the text looks like a list', () => {
    const kit = { includedItems: [], description: '1x Tent 2x Chair 1x Table' };
    expect(getPackageContentItems(kit)).toEqual([
      { quantity: 1, name: 'Tent' },
      { quantity: 2, name: 'Chair' },
      { quantity: 1, name: 'Table' },
    ]);
  });

  it('returns an empty array when includedItems is empty and description is ordinary prose', () => {
    const kit = { includedItems: [], description: 'A cozy 2-person camping set.' };
    expect(getPackageContentItems(kit)).toEqual([]);
  });
});
