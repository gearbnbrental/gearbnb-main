import { describe, expect, it } from 'vitest';
import { packageSpecificFaq } from './packageFaq';

describe('packageSpecificFaq', () => {
  it.each(['The Nomad Kit', 'The Stargazer Kit', 'The Base Camper Kit', 'The Traveler Kit'])('has 3 entries for %s', (name) => {
    expect(packageSpecificFaq(name)).toHaveLength(3);
  });
  it('shares one set across color editions', () => {
    expect(packageSpecificFaq('The Base Camper Kit (BLACK)')).toBe(packageSpecificFaq('The Base Camper Kit (KHAKI)'));
  });
  it('returns none for an unknown package', () => {
    expect(packageSpecificFaq('Mystery Kit')).toEqual([]);
  });
});
