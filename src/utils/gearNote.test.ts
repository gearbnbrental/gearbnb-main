import { describe, expect, it } from 'vitest';
import { productNote } from './gearNote';

describe('productNote', () => {
  it('has a note for the Gazlite LPG Can only', () => {
    expect(productNote({ category: 'Cooking', brand: 'Gazlite', model: 'LPG Can' })).toContain('refillable');
    expect(productNote({ category: 'Cooking', brand: 'Gazlite', model: 'Portable Stove' })).toBeNull();
    expect(productNote({ category: 'Cooking', brand: 'Multi-Brand', model: 'Butane Can' })).toBeNull();
  });
});
