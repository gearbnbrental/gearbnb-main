import { describe, expect, it } from 'vitest';
import type { BookableAddOn, BookableGearKind } from '../types/gearbnb';
import { buildFaqLinkTargets } from './faqLinks';

const base = { pricing: { '48h': 0, '72h': 0 }, extraPerDayPrice: 0, quantity: 1, availableCount: 1, canSelect: true, imageUrl: null, freeAccessories: [], compatibleAddOns: [] };
const kind = (category: string, brand: string, model: string, name: string, compatibleAddOns: BookableAddOn[] = []): BookableGearKind => ({
  ...base,
  category,
  brand,
  model,
  name,
  compatibleAddOns,
});
const hammer: BookableAddOn = {
  role: 'Camping Hammer',
  category: 'Other Gear Essentials',
  brand: 'Blackdog',
  model: 'Camping Hammer',
  name: 'Blackdog Camping Hammer',
  pricing: { '48h': 0, '72h': 0 },
  extraPerDayPrice: 0,
  maxQuantity: 1,
  availableCount: 1,
};

const kinds = [
  kind('Bed', 'Mountainhiker', 'King-Sized Low Bed (20cm)', 'Mountainhiker King-Sized Low Bed (20cm)'),
  kind('Tent', 'Vidalido', 'Vicore Villa Cabin Style', 'Vidalido Vicore Villa Cabin Style', [hammer]),
];

describe('buildFaqLinkTargets', () => {
  it('uses cleaned names, aliases, and add-ons, longest first', () => {
    const texts = buildFaqLinkTargets(kinds).map((t) => t.text);
    expect(texts).toContain('Mountainhiker King-Sized Low Bed');
    expect(texts).toContain('Vidalido Vicore Villa');
    expect(texts).toContain('Blackdog Camping Hammer');
    expect(texts.indexOf('Vidalido Vicore Villa Cabin Style')).toBeLessThan(texts.indexOf('Vidalido Vicore Villa'));
  });
  it('never links a product to itself', () => {
    const texts = buildFaqLinkTargets(kinds, kinds[0]).map((t) => t.text);
    expect(texts).not.toContain('Mountainhiker King-Sized Low Bed');
  });
});
