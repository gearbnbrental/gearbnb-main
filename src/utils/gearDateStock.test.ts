import { describe, expect, it } from 'vitest';
import type { BookableGearKind } from '../types/gearbnb';
import { applyGearDateStock } from './gearDateStock';

const base = { pricing: { '48h': 100, '72h': 150 }, extraPerDayPrice: 10, quantity: 2, imageUrl: null, freeAccessories: [] };
const kind = (model: string, availableCount: number, extra: Partial<BookableGearKind> = {}): BookableGearKind => ({
  ...base,
  category: 'Tent',
  brand: 'Mobi Garden',
  model,
  name: `Mobi Garden ${model}`,
  availableCount,
  canSelect: availableCount > 0,
  compatibleAddOns: [],
  ...extra,
});

describe('applyGearDateStock', () => {
  it('a kind out of stock right now becomes selectable when it is free for the dates', () => {
    const [out] = applyGearDateStock([kind('Backpacking Tent', 0)], [kind('Backpacking Tent', 1)]);
    expect(out.availableCount).toBe(1);
    expect(out.canSelect).toBe(true);
  });
  it('and the other way round: free now but booked for the dates', () => {
    const [out] = applyGearDateStock([kind('Backpacking Tent', 2)], [kind('Backpacking Tent', 0)]);
    expect(out.canSelect).toBe(false);
  });
  it('changes only the stock fields, never names, photos or prices', () => {
    const original = kind('Backpacking Tent', 0, { imageUrl: 'https://x/y.png', description: 'Best for solo' });
    const [out] = applyGearDateStock([original], [kind('Backpacking Tent', 1, { imageUrl: 'other', pricing: { '48h': 1, '72h': 1 } })]);
    expect(out.imageUrl).toBe('https://x/y.png');
    expect(out.pricing).toEqual({ '48h': 100, '72h': 150 });
    expect(out.description).toBe('Best for solo');
  });
  it('leaves a kind the dated catalog does not mention untouched (same reference)', () => {
    const only = kind('Backpacking Tent', 0);
    expect(applyGearDateStock([only], [kind('Something Else', 3)])[0]).toBe(only);
  });
  it('updates per-color stock and add-on counts', () => {
    const snapshot = kind('Vicore', 0, {
      variants: [
        { color: 'Black', imageUrl: null, quantity: 1, availableCount: 0, canSelect: false },
        { color: 'Khaki', imageUrl: null, quantity: 1, availableCount: 0, canSelect: false },
      ],
      compatibleAddOns: [{ role: 'Canopy Poles', category: 'Poles', brand: 'Vidalido', model: 'Extra Canopy Poles', name: 'Poles', pricing: { '48h': 1, '72h': 1 }, extraPerDayPrice: 0, maxQuantity: 2, availableCount: 0 }],
    });
    const dated = kind('Vicore', 1, {
      variants: [
        { color: 'Black', imageUrl: null, quantity: 1, availableCount: 1, canSelect: true },
        { color: 'Khaki', imageUrl: null, quantity: 1, availableCount: 0, canSelect: false },
      ],
      compatibleAddOns: [{ role: 'Canopy Poles', category: 'Poles', brand: 'Vidalido', model: 'Extra Canopy Poles', name: 'Poles', pricing: { '48h': 1, '72h': 1 }, extraPerDayPrice: 0, maxQuantity: 2, availableCount: 2 }],
    });
    const [out] = applyGearDateStock([snapshot], [dated]);
    expect(out.variants?.map((v) => [v.color, v.availableCount, v.canSelect])).toEqual([['Black', 1, true], ['Khaki', 0, false]]);
    expect(out.compatibleAddOns[0].availableCount).toBe(2);
  });
});
