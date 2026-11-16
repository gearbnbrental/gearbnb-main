import { describe, expect, it, vi } from 'vitest';
import type { BookableGearKind, PackageKit } from '../types/gearbnb';
import { SAMPLE_CAMPSITES } from '../data/campsiteSamples';
import { campsiteTools, registerRentalTools, rentalTools, type CampsiteSource, type CatalogSnapshot } from './webMcp';

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
    const cleanup = registerRentalTools({ registerTool, unregisterTool }, snapshot, campsites);
    expect(registerTool).toHaveBeenCalledTimes(5);
    cleanup();
    expect(unregisterTool).toHaveBeenCalledWith('search_rental_catalog');
    expect(() => registerRentalTools(undefined, snapshot)()).not.toThrow();
  });
});

const campsites: CampsiteSource = {
  list: async () => SAMPLE_CAMPSITES,
  detail: async (slug) => SAMPLE_CAMPSITES.find((campsite) => campsite.slug === slug) ?? null,
};
const campsiteResult = async (name: string, input: Record<string, unknown>, source = campsites) =>
  (await campsiteTools(source).find((candidate) => candidate.name === name)!.execute(input)).content[0].text;

describe('WebMCP campsite tools', () => {
  it('searches the directory with filters', async () => {
    const found = JSON.parse(await campsiteResult('search_campsites', { province: 'Rizal', petFriendly: true }));
    expect(found.map((campsite: { name: string }) => campsite.name)).toEqual(['Sample Riverside Campsite']);
    expect(found[0].url).toBe('https://gearbnbrental.com/campsites/sample-riverside-campsite-tanay-rizal');
    expect(await campsiteResult('search_campsites', { query: 'nowhere' })).toContain('No campsites match');
  });

  it('returns one campsite with its facts and FAQ, or says it does not exist', async () => {
    const campsite = JSON.parse(await campsiteResult('get_campsite', { slug: 'sample-riverside-campsite-tanay-rizal' }));
    expect(campsite.details.Restroom).toBe('Yes');
    expect(campsite.faq.length).toBeGreaterThan(5);
    expect(await campsiteResult('get_campsite', { slug: 'missing' })).toContain('No campsite with slug');
  });

  it('says when the directory cannot be loaded', async () => {
    const down: CampsiteSource = { list: () => Promise.reject(new Error('offline')), detail: () => Promise.reject(new Error('offline')) };
    expect(await campsiteResult('search_campsites', {}, down)).toContain('could not be loaded');
  });
});
