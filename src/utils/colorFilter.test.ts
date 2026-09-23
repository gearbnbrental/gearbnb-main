import { describe, expect, it } from 'vitest';
import type { BookableGearKind, PackageKit } from '../types/gearbnb';
import { filterGearByColor, filterPackagesByColor, gearColorOptions, packageColorOptions, supportsColorFilter } from './colorFilter';

const variant = (color: string) => ({ color, imageUrl: null, quantity: 1, availableCount: 1, canSelect: true });
const gear = (name: string, extra: Partial<BookableGearKind> = {}) => ({ name, ...extra }) as BookableGearKind;
const kit = (name: string, labels: string[] = []) =>
  ({ name, editions: labels.length ? labels.map((label) => ({ label })) : undefined }) as PackageKit;

describe('gear color filter', () => {
  const chair = gear('Moon Chair', { variants: [variant('Black'), variant('Khaki')] });
  const blackOnly = gear('Black Table', { kindColor: 'Black' });
  const khakiOnly = gear('Khaki Table', { kindColor: 'khaki' });
  const unknown = gear('Mystery Tent');

  it('offers every reported color', () => {
    expect(gearColorOptions([chair, blackOnly, khakiOnly, unknown])).toEqual(['Black', 'Khaki']);
    expect(gearColorOptions([unknown])).toEqual([]);
  });

  it('shows only the chosen color, and keeps gear whose color is unknown', () => {
    expect(filterGearByColor([chair, blackOnly, khakiOnly, unknown], 'Khaki').map((k) => k.name)).toEqual([
      'Moon Chair',
      'Khaki Table',
      'Mystery Tent',
    ]);
    expect(filterGearByColor([chair, blackOnly, khakiOnly, unknown], 'Black').map((k) => k.name)).toEqual([
      'Moon Chair',
      'Black Table',
      'Mystery Tent',
    ]);
  });
});

describe('package color filter', () => {
  const baseCamper = kit('Base Camper', ['BLACK', 'KHAKI']);
  const nomad = kit('Nomad', ['BLACK']);
  const stargazer = kit('The Stargazer Kit', ['BLACK']);
  const traveler = kit('The Traveler Kit', ['KHAKI']);
  const uncolored = kit('Mystery Kit');

  it('offers each edition color, including single-color packages', () => {
    expect(packageColorOptions([baseCamper, nomad, stargazer])).toEqual(['Black', 'Khaki']);
    expect(packageColorOptions([stargazer, uncolored])).toEqual(['Black']);
  });

  it('shows only packages in the chosen color, and keeps packages with no color info', () => {
    const all = [baseCamper, nomad, stargazer, traveler, uncolored];
    expect(filterPackagesByColor(all, 'Khaki').map((k) => k.name)).toEqual(['Base Camper', 'The Traveler Kit', 'Mystery Kit']);
    expect(filterPackagesByColor(all, 'Black').map((k) => k.name)).toEqual(['Base Camper', 'Nomad', 'The Stargazer Kit', 'Mystery Kit']);
  });
});

describe('supportsColorFilter', () => {
  it('applies to Tent, Bed, Table and Chair categories only', () => {
    for (const category of ['Tent', 'Bed', 'Camping Table', 'Camping Chair']) expect(supportsColorFilter({ category })).toBe(true);
    for (const category of ['Other Gear Essentials', 'Cooking', 'Lights', 'Cooler', 'Fan']) expect(supportsColorFilter({ category })).toBe(false);
  });
});
