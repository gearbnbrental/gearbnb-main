import { describe, expect, it } from 'vitest';
import type { BookableGearKind, PackageComponent, PackageKit } from '../types/gearbnb';
import { cartStockUses, componentsForCartKit, subtractStock } from './packageStock';

const base = { pricing: { '48h': 0, '72h': 0 }, extraPerDayPrice: 0, quantity: 1, canSelect: true, imageUrl: null, freeAccessories: [], compatibleAddOns: [] };
const kind = (category: string, brand: string, model: string, availableCount: number, extra: Partial<BookableGearKind> = {}): BookableGearKind => ({
  ...base,
  category,
  brand,
  model,
  name: `${brand} ${model}`.trim(),
  availableCount,
  ...extra,
});
const comp = (category: string, brand: string, model: string, quantity: number, color: string | null = null): PackageComponent => ({
  category,
  brand,
  model,
  name: model,
  color,
  quantity,
  availableCount: 9,
});

describe('subtractStock', () => {
  const tent = kind('Tent', 'Mobi Garden', 'Backpacking Tent', 1);

  it('takes a package unit off the total, leaving 0 and unselectable (the Nomad Kit case)', () => {
    const [result] = subtractStock([tent], [{ category: 'Tent', brand: 'Mobi Garden', model: 'Backpacking Tent', quantity: 1 }]);
    expect(result.availableCount).toBe(0);
    expect(result.canSelect).toBe(false);
  });
  it('never goes below 0 and leaves unrelated kinds untouched', () => {
    const fan = kind('Fan', '', 'Tri-Pod Camping Fan', 3);
    const out = subtractStock([tent, fan], [{ category: 'Tent', brand: 'Mobi Garden', model: 'Backpacking Tent', quantity: 5 }]);
    expect(out[0].availableCount).toBe(0);
    expect(out[1]).toBe(fan);
  });
  it('treats Generic and blank brand as the same', () => {
    const chair = kind('Camping Chair', '', 'Moon Chair', 12);
    expect(subtractStock([chair], [{ category: 'Camping Chair', brand: 'Generic', model: 'Moon Chair', quantity: 4 }])[0].availableCount).toBe(8);
  });
  const twoColor = kind('Tent', 'Vidalido', 'Vicore Villa Cabin Style', 4, {
    variants: [
      { color: 'Black', imageUrl: null, quantity: 2, availableCount: 2, canSelect: true },
      { color: 'Khaki', imageUrl: null, quantity: 2, availableCount: 2, canSelect: true },
    ],
  });
  it('a colored use takes from that variant and from the total', () => {
    const [out] = subtractStock([twoColor], [{ category: 'Tent', brand: 'Vidalido', model: 'Vicore Villa Cabin Style', color: 'khaki', quantity: 1 }]);
    expect(out.availableCount).toBe(3);
    expect(out.variants?.find((v) => v.color === 'Khaki')?.availableCount).toBe(1);
    expect(out.variants?.find((v) => v.color === 'Black')?.availableCount).toBe(2);
  });
  it('an uncolored use on a multi-color kind only touches the total', () => {
    const [out] = subtractStock([twoColor], [{ category: 'Tent', brand: 'Vidalido', model: 'Vicore Villa Cabin Style', quantity: 1 }]);
    expect(out.availableCount).toBe(3);
    expect(out.variants?.map((v) => v.availableCount)).toEqual([2, 2]);
  });
  it('a used-up variant can no longer be selected', () => {
    const [out] = subtractStock([twoColor], [{ category: 'Tent', brand: 'Vidalido', model: 'Vicore Villa Cabin Style', color: 'Black', quantity: 2 }]);
    expect(out.variants?.find((v) => v.color === 'Black')?.canSelect).toBe(false);
    expect(out.canSelect).toBe(true);
  });
});

describe('cartStockUses', () => {
  const nomad = { id: 'k1', components: [comp('Tent', 'Mobi Garden', 'Backpacking Tent', 1)] } as unknown as PackageKit;
  const catalogNomad = { id: 'k1', components: [comp('Tent', 'Mobi Garden', 'Backpacking Tent', 1), comp('Camping Chair', '', 'Ultra-light Chair', 2)] } as unknown as PackageKit;

  it('prefers the catalog\'s own component list, and an edition\'s over the kit\'s', () => {
    expect(componentsForCartKit([catalogNomad], nomad)).toHaveLength(2);
    const withEdition = {
      id: 'k2',
      components: [comp('Tent', 'A', 'A', 1)],
      editions: [{ id: 'k2-khaki', components: [comp('Tent', 'B', 'B', 2)] }],
    } as unknown as PackageKit;
    expect(componentsForCartKit([withEdition], { id: 'k2-khaki' })[0].brand).toBe('B');
  });
  it('counts each package copy, Build Your Own lines and their add-ons', () => {
    const uses = cartStockUses([catalogNomad], {
      selectedKits: [nomad, nomad],
      byoGears: [{ ...kind('Fan', '', 'Tri-Pod Camping Fan', 3), quantity: 1 }],
      byoAddOns: { x: [{ category: 'Other Gear Essentials', brand: 'Blackdog', model: 'Camping Hammer', quantity: 1 } as never] },
    });
    expect(uses.filter((u) => u.model === 'Backpacking Tent')).toHaveLength(2);
    expect(uses.some((u) => u.model === 'Tri-Pod Camping Fan')).toBe(true);
    expect(uses.some((u) => u.model === 'Camping Hammer')).toBe(true);
  });
});
