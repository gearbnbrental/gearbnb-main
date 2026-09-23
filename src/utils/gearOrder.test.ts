import { describe, expect, it } from 'vitest';
import type { BookableGearKind, PackageKit } from '../types/gearbnb';
import { orderGearKinds, orderPackageKits, sortGearKindsWithinCategories } from './gearOrder';

const kind = (category: string, brand: string, model: string) =>
  ({ category, brand, model, name: `${brand} ${model}`.trim() }) as BookableGearKind;

const names = (kinds: BookableGearKind[]) => kinds.map((k) => k.name);

describe('orderGearKinds', () => {
  it('puts tents first in Mobi Garden > Blackdog > Vidalido > Naturehike order', () => {
    const result = orderGearKinds([
      kind('Tent', 'Naturehike', 'Village 13 Lite'),
      kind('Bed', 'Mountainhiker', 'Single Bed'),
      kind('Tent', 'Vidalido', 'Vicore Villa Cabin Style'),
      kind('Tent', 'Blackdog', 'Pop-up Vinyl Tent'),
      kind('Tent', 'Mobi Garden', 'Backpacking Tent'),
    ]);
    expect(names(result)).toEqual([
      'Mobi Garden Backpacking Tent',
      'Blackdog Pop-up Vinyl Tent',
      'Vidalido Vicore Villa Cabin Style',
      'Naturehike Village 13 Lite',
      'Mountainhiker Single Bed',
    ]);
  });

  it('orders beds Single > Double > Low King > High King, keeping other gear where it was', () => {
    const result = orderGearKinds([
      kind('Bed', 'Blackpongo', 'Double-Sized Inflatable Bed'),
      kind('Bed', 'Mountainhiker', 'King-Sized High Bed (40cm)'),
      kind('Bed', 'Mountainhiker', 'King-Sized Low Bed (20cm)'),
      kind('Camping Chair', '', 'Moon Chair'),
      kind('Bed', 'Mountainhiker', 'Single Bed'),
      kind('Bed', 'Mobi Garden', 'Double-Sized Inflatable Bed'),
    ]);
    expect(names(result)).toEqual([
      'Mountainhiker Single Bed',
      'Blackpongo Double-Sized Inflatable Bed',
      'Mobi Garden Double-Sized Inflatable Bed',
      'Moon Chair',
      'Mountainhiker King-Sized Low Bed (20cm)',
      'Mountainhiker King-Sized High Bed (40cm)',
    ]);
  });

  it('puts unlisted tent brands after the listed ones and does not mutate the input', () => {
    const input = [kind('Tent', 'Other', 'X'), kind('Tent', 'Naturehike', 'Y')];
    expect(names(orderGearKinds(input))).toEqual(['Naturehike Y', 'Other X']);
    expect(names(input)).toEqual(['Other X', 'Naturehike Y']);
  });

  it('orders Camping Chairs Ultra-light > Moon > Kermit, matched by name (brand is blank after merging), leaving other categories in their own slot', () => {
    const result = orderGearKinds([
      kind('Camping Chair', '', 'Kermit Chair'),
      kind('Camping Table', '', 'Small Table'),
      kind('Camping Chair', '', 'Moon Chair'),
      kind('Camping Chair', '', 'Ultra-light Chair'),
    ]);
    expect(names(result)).toEqual(['Ultra-light Chair', 'Small Table', 'Moon Chair', 'Kermit Chair']);
  });

  it('orders Camping Tables Small > Large > Extra-Long', () => {
    const result = orderGearKinds([
      kind('Camping Table', '', 'Extra-Long Table'),
      kind('Camping Table', '', 'Small Table'),
      kind('Camping Table', '', 'Large Table'),
    ]);
    expect(names(result)).toEqual(['Small Table', 'Large Table', 'Extra-Long Table']);
  });

  it('orders Cooking gear, telling the two Portable Stoves apart by their full name (same model text)', () => {
    const result = orderGearKinds([
      kind('Cooking', 'Gazlite', 'LPG Can'),
      kind('Cooking', 'Multi-Brand', 'Butane Can'),
      kind('Cooking', '', 'Big Cooking Set'),
      kind('Cooking', 'Gazlite', 'Portable Stove'),
      kind('Cooking', '', 'Ultra-light Portable Stove'),
    ]);
    expect(names(result)).toEqual([
      'Ultra-light Portable Stove',
      'Gazlite Portable Stove',
      'Big Cooking Set',
      'Multi-Brand Butane Can',
      'Gazlite LPG Can',
    ]);
  });
});

describe('orderPackageKits', () => {
  const kit = (name: string) => ({ name }) as PackageKit;

  it('orders Nomad > Stargazer > Base Camper > Traveler and puts unknown packages last', () => {
    const input = [kit('The Traveler Kit'), kit('The Base Camper Kit'), kit('Mystery Kit'), kit('The Stargazer Kit'), kit('The Nomad Kit')];
    expect(orderPackageKits(input).map((k) => k.name)).toEqual([
      'The Nomad Kit',
      'The Stargazer Kit',
      'The Base Camper Kit',
      'The Traveler Kit',
      'Mystery Kit',
    ]);
    expect(input[0].name).toBe('The Traveler Kit');
  });
});

describe('sortGearKindsWithinCategories', () => {
  it('sorts within each category, including Tents by brand, but never pulls Tents to the front (unlike orderGearKinds)', () => {
    const result = sortGearKindsWithinCategories([
      kind('Bed', 'Mountainhiker', 'Single Bed'),
      kind('Tent', 'Naturehike', 'Village 13 Lite'),
      kind('Bed', 'Mountainhiker', 'King-Sized High Bed (40cm)'),
      kind('Tent', 'Mobi Garden', 'Backpacking Tent'),
      kind('Camping Table', '', 'Extra-Long Table'),
      kind('Camping Table', '', 'Small Table'),
    ]);
    // Beds/Tables/Tents are each sorted within their OWN slots (Tents by brand, same as
    // orderGearKinds) — but the Tent block's two slots stay at indexes 1 and 3, never moved to the
    // very front of the whole list the way orderGearKinds does.
    expect(names(result)).toEqual([
      'Mountainhiker Single Bed',
      'Mobi Garden Backpacking Tent',
      'Mountainhiker King-Sized High Bed (40cm)',
      'Naturehike Village 13 Lite',
      'Small Table',
      'Extra-Long Table',
    ]);
  });

  it('never changes which categories exist or their first-appearance order', () => {
    const input = [kind('Cooler', '', 'Cooler A'), kind('Bed', '', 'Double-Sized Bed'), kind('Fan', '', 'Fan A')];
    const categoriesOf = (list: typeof input) => [...new Set(list.map((k) => k.category))];
    expect(categoriesOf(sortGearKindsWithinCategories(input))).toEqual(categoriesOf(input));
  });
});