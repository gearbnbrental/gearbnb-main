import { describe, expect, it } from 'vitest';
import type { BookableAddOn, BookableGearKind, PackageComponent } from '../types/gearbnb';
import { matchComponentToGearKind } from './packageComponents';

const component = (category: string, brand: string, model: string | null, overrides: Partial<PackageComponent> = {}): PackageComponent => ({
  category,
  brand,
  model,
  name: model,
  quantity: 1,
  availableCount: 1,
  ...overrides,
});

const kind = (category: string, brand: string, model: string, overrides: Partial<BookableGearKind> = {}): BookableGearKind =>
  ({
    category,
    brand,
    model,
    name: `${brand} ${model}`.trim(),
    compatibleAddOns: [],
    ...overrides,
  }) as BookableGearKind;

const addOn = (category: string, brand: string, model: string, overrides: Partial<BookableAddOn> = {}): BookableAddOn =>
  ({ category, brand, model, name: `${brand} ${model}`.trim(), role: 'x', ...overrides }) as BookableAddOn;

describe('matchComponentToGearKind', () => {
  it('matches a component to a top-level browsable gear kind by category+brand+model', () => {
    const tent = kind('Tent', 'Naturehike', 'Village 13 Lite');
    const result = matchComponentToGearKind(component('Tent', 'Naturehike', 'Village 13 Lite'), [tent]);
    expect(result).toBe(tent);
  });

  it("finds a component that's only reachable as another kind's compatible add-on (e.g. a hammer paired to a tent)", () => {
    const hammer = addOn('Other Gear Essentials', 'Blackdog', 'Camping Hammer');
    const tent = kind('Tent', 'Naturehike', 'Village 13 Lite', { compatibleAddOns: [hammer] });
    const result = matchComponentToGearKind(component('Other Gear Essentials', 'Blackdog', 'Camping Hammer'), [tent]);
    expect(result?.name).toBe('Blackdog Camping Hammer');
    expect(result?.category).toBe('Other Gear Essentials');
  });

  it('returns undefined for a component with no product page anywhere (e.g. a Groundsheet or Peg)', () => {
    const tent = kind('Tent', 'Vidalido', 'Vicore Villa Cabin Style');
    const result = matchComponentToGearKind(component('Other Gear Essentials', 'Vidalido', 'Vicore Groundsheet'), [tent]);
    expect(result).toBeUndefined();
  });

  it('treats a null model as its own distinct key, never a wildcard', () => {
    const kindWithModel = kind('Cooking', 'Gazlite', 'LPG Can');
    const result = matchComponentToGearKind(component('Cooking', 'Gazlite', null), [kindWithModel]);
    expect(result).toBeUndefined();
  });
});
