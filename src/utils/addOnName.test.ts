import { describe, expect, it } from 'vitest';
import type { BookableAddOn, BookableGearKind } from '../types/gearbnb';
import { resolveAddOnDisplayName } from './addOnName';

function addOn(brand: string, category: string, name: string): BookableAddOn {
  return { role: 'ADDON', category, brand, model: name, name, pricing: { '48h': 50, '72h': 50 }, extraPerDayPrice: 0, maxQuantity: 2, availableCount: 5 };
}
function kind(addOns: BookableAddOn[]): BookableGearKind {
  return {
    category: 'Tent', brand: 'Blackdog', model: 'Tent', name: 'Blackdog Tent', pricing: { '48h': 1000, '72h': 1100 }, extraPerDayPrice: 0,
    quantity: 1, availableCount: 1, canSelect: true, imageUrl: null, freeAccessories: [], compatibleAddOns: addOns,
  };
}

describe('resolveAddOnDisplayName', () => {
  const hammer = addOn('Blackdog', 'Other Gear Essentials', 'Blackdog Camping Hammer');

  it('recovers the add-on name from a brand + category name when exactly one add-on matches', () => {
    expect(resolveAddOnDisplayName('Blackdog Other Gear Essentials', [kind([hammer]), kind([hammer])])).toBe('Blackdog Camping Hammer');
  });

  it('keeps the RMS name when two different add-ons share that brand and category', () => {
    const pegs = addOn('Blackdog', 'Other Gear Essentials', 'Blackdog Steel Pegs');
    expect(resolveAddOnDisplayName('Blackdog Other Gear Essentials', [kind([hammer, pegs])])).toBe('Blackdog Other Gear Essentials');
  });

  it('leaves a proper name, or an unknown one, untouched', () => {
    expect(resolveAddOnDisplayName('Blackdog Camping Hammer', [kind([hammer])])).toBe('Blackdog Camping Hammer');
    expect(resolveAddOnDisplayName('Vidalido Extra Canopy Pole Set', [kind([hammer])])).toBe('Vidalido Extra Canopy Pole Set');
    expect(resolveAddOnDisplayName('Blackdog Other Gear Essentials', [])).toBe('Blackdog Other Gear Essentials');
  });
});
