import { describe, expect, it, vi } from 'vitest';
import type { BookableGearKind, PackageKit } from '../types/gearbnb';
import { registerRentalTools, rentalTools, type CatalogSnapshot } from './webMcp';

const kit = {
  id: 'k1',
  name: 'The Stargazer Kit',
  description: 'Best for Couples and Buddies\nA roomy two-person setup.',
  packageNumber: 'P1',
  depositAmount: 500,
  pricing: { '48h': 3000, '72h': 3200 },
  includedItems: ['Tent', 'Bed'],
  paxRange: '2 Pax',
  capacity: 2,
  imageUrl: '',
} as PackageKit;

const chair = {
  category: 'Camping Chair',
  brand: 'Blackdog',
  model: null,
  name: 'Kermit Chair',
  pricing: { '48h': 145, '72h': 160 },
  extraPerDayPrice: 20,
  quantity: 4,
  availableCount: 4,
  canSelect: true,
  imageUrl: null,
  freeAccessories: [],
  compatibleAddOns: [],
} as BookableGearKind;

const snapshot = (): CatalogSnapshot => ({ kits: [kit], gearKinds: [chair] });
const tool = (name: string, catalog = snapshot) => rentalTools(catalog).find((candidate) => candidate.name === name)!;
const result = async (name: string, input: Record<string, unknown>, catalog = snapshot) =>
  (await tool(name, catalog).execute(input)).content[0].text;

describe('WebMCP rental tools', () => {
  it('searches packages and gear', async () => {
    const all = JSON.parse(await result('search_rental_catalog', {}));
    expect(all.map((item: { slug: string }) => item.slug)).toEqual(['stargazer-kit', 'kermit-chair']);
    const chairs = JSON.parse(await result('search_rental_catalog', { query: 'chair', type: 'gear' }));
    expect(chairs).toHaveLength(1);
    expect(chairs[0]).toMatchObject({ name: 'Kermit Chair', url: 'https://gearbnbrental.com/catalog/build-your-own/kermit-chair' });
  });

  it('gives one item by slug', async () => {
    const details = JSON.parse(await result('get_rental_item', { slug: 'stargazer-kit' }));
    expect(details).toMatchObject({ securityDepositPhp: 500, bestFor: 'Couples and Buddies', included: ['Tent', 'Bed'] });
    expect(await result('get_rental_item', { slug: 'nope' })).toContain('No item');
  });

  it('says so while the catalog is loading', async () => {
    expect(await result('search_rental_catalog', {}, () => ({ kits: [], gearKinds: [] }))).toContain('still loading');
  });

  it('states the deposit tiers and contact details', async () => {
    const policies = await result('get_rental_policies', {});
    expect(policies).toContain('Rental total above ₱6,000: ₱1,200 deposit');
    expect(policies).toContain('+63 976 595 2432');
  });

  it('registers with registerTool and unregisters on cleanup, and does nothing without WebMCP', () => {
    const registerTool = vi.fn();
    const unregisterTool = vi.fn();
    const cleanup = registerRentalTools({ registerTool, unregisterTool }, snapshot);
    expect(registerTool).toHaveBeenCalledTimes(3);
    cleanup();
    expect(unregisterTool).toHaveBeenCalledWith('search_rental_catalog');
    expect(() => registerRentalTools(undefined, snapshot)()).not.toThrow();
  });
});
