import { describe, expect, it } from 'vitest';
import { fitDescription } from '../config/productMeta';
import { findBySlug, gearPath, gearSlug, packagePath, packageSlug, slugify } from './productSlug';

describe('product slugs', () => {
  it('drops "The" and the color edition from package names', () => {
    expect(packageSlug({ name: 'The Stargazer Kit' })).toBe('stargazer-kit');
    expect(packageSlug({ name: 'The Base Camper Kit (KHAKI)' })).toBe('base-camper-kit');
    expect(packagePath({ name: 'The Nomad Kit' })).toBe('/catalog/camping-packages/nomad-kit');
  });

  it('uses the name customers see for gear', () => {
    expect(gearSlug({ name: 'Mountainhiker King-Sized High Bed (40cm) (Black)' })).toBe('mountainhiker-king-sized-high-bed');
    expect(gearPath({ name: 'Mobi Garden Backpacking Tent' })).toBe('/catalog/build-your-own/mobi-garden-backpacking-tent');
  });

  it('keeps only letters and numbers', () => {
    expect(slugify('Coleman 2-in-1 Lantern & Fan!')).toBe('coleman-2-in-1-lantern-and-fan');
    expect(slugify('Piñas Cooler')).toBe('pinas-cooler');
  });

  it('finds a product by its slug', () => {
    const kits = [{ name: 'The Nomad Kit' }, { name: 'The Stargazer Kit' }];
    expect(findBySlug(kits, 'stargazer-kit', packageSlug)).toBe(kits[1]);
    expect(findBySlug(kits, 'missing', packageSlug)).toBeNull();
    expect(findBySlug(kits, undefined, packageSlug)).toBeNull();
  });
});

describe('product page descriptions', () => {
  it('keeps whole sentences that fit', () => {
    expect(fitDescription(['Rent the Kermit Chair for ₱145.', 'Best for picnics.', 'Pick up in Las Piñas.'])).toBe(
      'Rent the Kermit Chair for ₱145. Best for picnics. Pick up in Las Piñas.',
    );
  });

  it('cuts a long sentence at a word and stays within 160 characters', () => {
    const result = fitDescription([
      'Rent the Blackdog Pop-up Vinyl Tent for ₱1,600 for 48 hours or ₱1,800 for 72 hours.',
      'Best for couples, small families, or weekend trips where you want a fast setup with no fuss at all.',
      'Pick up in Las Piñas City or book Grab delivery.',
    ]);
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result).toMatch(/^Rent the Blackdog .* Best for couples, .*\w…$/);
  });
});
