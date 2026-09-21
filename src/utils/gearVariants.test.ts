import { describe, expect, it } from 'vitest';
import { byoGearKey } from '../context/RentalContext';
import type { BookableGearKind } from '../types/gearbnb';
import { expandGearKinds, resolveGearVariant, sizeCapacityToShow, splitKindsByColor } from './gearVariants';

const baseKind: BookableGearKind = {
  category: 'Camping Chair',
  brand: '',
  model: 'Moon Chair',
  name: 'Moon Chair',
  pricing: { '48h': 100, '72h': 150 },
  extraPerDayPrice: 50,
  quantity: 12,
  availableCount: 10,
  canSelect: true,
  imageUrl: 'default.png',
  freeAccessories: [],
  compatibleAddOns: [],
};

const multiColor: BookableGearKind = {
  ...baseKind,
  variants: [
    { color: 'Black', imageUrl: 'black.png', quantity: 8, availableCount: 8, canSelect: true },
    { color: 'Khaki', imageUrl: null, quantity: 4, availableCount: 0, canSelect: false, pricing: { '48h': 120, '72h': 170 } },
  ],
};

describe('resolveGearVariant', () => {
  it('returns the kind untouched when no color is given or the color is unknown', () => {
    expect(resolveGearVariant(multiColor, undefined)).toBe(multiColor);
    expect(resolveGearVariant(multiColor, 'Pink')).toBe(multiColor);
    expect(resolveGearVariant(baseKind, 'Black')).toBe(baseKind);
  });

  it("applies the variant's own image, stock and name, and drops the variants list", () => {
    const black = resolveGearVariant(multiColor, 'Black');
    expect(black.color).toBe('Black');
    expect(black.name).toBe('Moon Chair (Black)');
    expect(black.imageUrl).toBe('black.png');
    expect(black.availableCount).toBe(8);
    expect(black.pricing).toEqual({ '48h': 100, '72h': 150 });
    expect(black.variants).toBeUndefined();
  });

  it("uses the variant's own price when the RMS reported one, and falls back to the kind's image", () => {
    const khaki = resolveGearVariant(multiColor, 'Khaki');
    expect(khaki.pricing).toEqual({ '48h': 120, '72h': 170 });
    expect(khaki.imageUrl).toBe('default.png');
    expect(khaki.canSelect).toBe(false);
    expect(khaki.availableCount).toBe(0);
  });
});

describe('byoGearKey with color', () => {
  it('keeps the exact old key when there is no color, and separates colors when there is', () => {
    expect(byoGearKey(baseKind)).toBe('Camping Chair||Moon Chair');
    expect(byoGearKey({ ...baseKind, color: 'Black' })).toBe('Camping Chair||Moon Chair|Black');
    expect(byoGearKey({ ...baseKind, color: 'Khaki' })).not.toBe(byoGearKey({ ...baseKind, color: 'Black' }));
  });
});

describe('expandGearKinds', () => {
  it('adds one resolved entry per color and leaves kinds without variants alone', () => {
    const expanded = expandGearKinds([baseKind, multiColor]);
    expect(expanded).toHaveLength(4);
    expect(expanded.map((k) => byoGearKey(k))).toContain('Camping Chair||Moon Chair|Khaki');
    expect(expandGearKinds([baseKind])).toEqual([baseKind]);
  });
});

describe('splitKindsByColor', () => {
  it('replaces a multi-color kind with one entry per color and leaves other kinds alone', () => {
    const result = splitKindsByColor([baseKind, multiColor]);
    expect(result.map((k) => k.name)).toEqual(['Moon Chair', 'Moon Chair (Black)', 'Moon Chair (Khaki)']);
  });
});

describe('sizeCapacity', () => {
  it("uses the variant's own size/capacity when it differs, else the kind's", () => {
    const kind: BookableGearKind = {
      ...baseKind,
      sizeCapacity: '6P',
      variants: [
        { color: 'Black', imageUrl: null, quantity: 1, availableCount: 1, canSelect: true },
        { color: 'Khaki', imageUrl: null, quantity: 1, availableCount: 1, canSelect: true, sizeCapacity: '8P' },
      ],
    };
    expect(resolveGearVariant(kind, 'Black').sizeCapacity).toBe('6P');
    expect(resolveGearVariant(kind, 'Khaki').sizeCapacity).toBe('8P');
  });
});

describe('sizeCapacityToShow', () => {
  it('shows it for Tents and Beds only, and only when there is a value', () => {
    expect(sizeCapacityToShow({ category: 'Tent', sizeCapacity: ' 6P ' })).toBe('6P');
    expect(sizeCapacityToShow({ category: 'Bed', sizeCapacity: 'King' })).toBe('King');
    expect(sizeCapacityToShow({ category: 'Camping Chair', sizeCapacity: 'Large' })).toBeNull();
    expect(sizeCapacityToShow({ category: 'Tent', sizeCapacity: '  ' })).toBeNull();
    expect(sizeCapacityToShow({ category: 'Tent' })).toBeNull();
  });
});
