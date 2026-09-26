import { describe, expect, it } from 'vitest';
import type { BookableGearKind, BookableGearSelection } from '../types/gearbnb';
import { reconcileGearLine } from './gearReconcile';

const kind = (overrides: Partial<BookableGearKind>): BookableGearKind => ({
  category: 'Tent',
  brand: 'Mobi Garden',
  model: 'Backpacking Tent',
  name: 'Mobi Garden Backpacking Tent',
  pricing: { '48h': 1, '72h': 1 },
  extraPerDayPrice: 0,
  quantity: 2,
  availableCount: 2,
  canSelect: true,
  imageUrl: null,
  freeAccessories: [],
  compatibleAddOns: [],
  ...overrides,
});
const selection = (quantity: number): BookableGearSelection => ({ ...kind({}), quantity });

describe('reconcileGearLine', () => {
  it('keeps a line that is out of stock only right now (rented today, maybe back by their dates)', () => {
    const out = reconcileGearLine(selection(1), kind({ availableCount: 0, canSelect: false }));
    expect(out?.quantity).toBe(1);
    expect(out?.availableCount).toBe(1);
  });
  it('does not cut the quantity to what is free today, only to the units that exist', () => {
    expect(reconcileGearLine(selection(2), kind({ quantity: 2, availableCount: 1 }))?.quantity).toBe(2);
    expect(reconcileGearLine(selection(5), kind({ quantity: 2, availableCount: 1 }))?.quantity).toBe(2);
  });
  it('drops a line whose product is no longer sold, or has no units at all', () => {
    expect(reconcileGearLine(selection(1), undefined)).toBeUndefined();
    expect(reconcileGearLine(selection(1), kind({ quantity: 0, availableCount: 0, canSelect: false }))).toBeUndefined();
  });
  it('refreshes everything else from the live catalog', () => {
    const out = reconcileGearLine(selection(1), kind({ pricing: { '48h': 9, '72h': 9 } }));
    expect(out?.pricing).toEqual({ '48h': 9, '72h': 9 });
  });
});
