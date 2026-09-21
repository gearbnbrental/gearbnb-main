import { describe, expect, it } from 'vitest';
import type { BookableGearKind } from '../types/gearbnb';
import { orderGearKinds } from './gearOrder';

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
});
