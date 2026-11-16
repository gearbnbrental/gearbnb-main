import { describe, expect, it } from 'vitest';
import { SHOP_PATH, matchesShopRedirect, normalizeShopItems, resolveShopSlug, shopRedirectRules, type ShopItem } from './shop';

const unit = (overrides: Record<string, unknown>) => ({
  id: 'u1',
  name: 'Blackdog Starchase 13x',
  category: 'Tent',
  brand: 'Blackdog',
  model: 'Starchase 13x',
  color: 'Black',
  condition: 'Brand new',
  description: null,
  priceCentavos: 1900000,
  images: [],
  quantity: 1,
  ...overrides,
});

// After the RMS change: the two tents are one listing with a new key.
const merged = normalizeShopItems({ items: [unit({ listingKey: '9d8c7b6a5f4e3d21', quantity: 2 })] });
const TENT = `${SHOP_PATH}/blackdog-starchase-13x`;

describe('shop addresses', () => {
  it('uses the clean name when only one listing has it, and shows the merged count', () => {
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ slug: 'blackdog-starchase-13x', quantity: 2 });
  });

  it('adds the start of the listingKey only when two listings share a name', () => {
    const shared = normalizeShopItems({
      items: [unit({ listingKey: 'aaaa1111bbbb2222' }), unit({ listingKey: 'cccc3333dddd4444', condition: 'Good', priceCentavos: 1500000 })],
    });
    expect(shared.map((item) => item.slug)).toEqual(['blackdog-starchase-13x-aaaa1111', 'blackdog-starchase-13x-cccc3333']);
  });
});

describe('old shop addresses', () => {
  it('sends the two old split-listing addresses to the merged listing (301)', () => {
    for (const old of ['blackdog-starchase-13x-brand-new-19000-21eed678', 'blackdog-starchase-13x-brand-new-19000-f2c3b63d']) {
      expect(resolveShopSlug(merged, old)).toEqual({ type: 'redirect', to: TENT });
    }
  });

  it('sends a stale key fragment to the current address', () => {
    expect(resolveShopSlug(merged, 'blackdog-starchase-13x-0badc0de')).toEqual({ type: 'redirect', to: TENT });
  });

  it('serves a current address as its page', () => {
    expect(resolveShopSlug(merged, 'blackdog-starchase-13x')).toMatchObject({ type: 'page' });
  });

  it('with a name shared by two listings, picks the one whose condition and price match, else the shop list', () => {
    const shared = normalizeShopItems({
      items: [unit({ listingKey: 'aaaa1111bbbb2222' }), unit({ listingKey: 'cccc3333dddd4444', condition: 'Good', priceCentavos: 1500000 })],
    });
    expect(resolveShopSlug(shared, 'blackdog-starchase-13x-good-15000-0badc0de')).toEqual({ type: 'redirect', to: `${SHOP_PATH}/blackdog-starchase-13x-cccc3333` });
    expect(resolveShopSlug(shared, 'blackdog-starchase-13x-brand-new-19000-21eed678')).toEqual({ type: 'redirect', to: `${SHOP_PATH}/blackdog-starchase-13x-aaaa1111` });
    expect(resolveShopSlug(shared, 'blackdog-starchase-13x-0badc0de')).toEqual({ type: 'redirect', to: SHOP_PATH });

    const twins = normalizeShopItems({ items: [unit({ listingKey: 'aaaa1111bbbb2222' }), unit({ listingKey: 'cccc3333dddd4444' })] });
    expect(resolveShopSlug(twins, 'blackdog-starchase-13x-brand-new-19000-21eed678')).toEqual({ type: 'redirect', to: SHOP_PATH });
  });

  it('before the RMS merge (two same-named listings), an old address keeps going to its own listing by its key', () => {
    const split = normalizeShopItems({ items: [unit({ listingKey: '21eed678aaaa0000' }), unit({ listingKey: 'f2c3b63dbbbb0000' })] });
    expect(split.map((item) => item.slug)).toEqual(['blackdog-starchase-13x-21eed678', 'blackdog-starchase-13x-f2c3b63d']);
    expect(resolveShopSlug(split, 'blackdog-starchase-13x-brand-new-19000-21eed678')).toEqual({ type: 'redirect', to: `${SHOP_PATH}/blackdog-starchase-13x-21eed678` });
    expect(resolveShopSlug(split, 'blackdog-starchase-13x-brand-new-19000-f2c3b63d')).toEqual({ type: 'redirect', to: `${SHOP_PATH}/blackdog-starchase-13x-f2c3b63d` });
  });

  it('gives a real 404 for a name no current listing has', () => {
    expect(resolveShopSlug(merged, 'coleman-sundome-4p-brand-new-5000-12345678')).toEqual({ type: 'not-found' });
    expect(resolveShopSlug(merged, 'blackdog')).toEqual({ type: 'not-found' });
    expect(resolveShopSlug([], 'blackdog-starchase-13x')).toEqual({ type: 'not-found' });
  });
});

describe('server redirect rules', () => {
  /** What the server does: a current page first, else the first rule the address matches, else 404. */
  function server(items: ShopItem[], slug: string) {
    const page = items.find((item) => item.slug === slug);
    if (page) return { type: 'page', item: page };
    const rule = shopRedirectRules(items).find((candidate) => matchesShopRedirect(slug, candidate));
    return rule ? { type: 'redirect', to: rule.to } : { type: 'not-found' };
  }

  const catalogs: ShopItem[][] = [
    merged,
    normalizeShopItems({ items: [unit({ listingKey: 'aaaa1111bbbb2222' }), unit({ listingKey: 'cccc3333dddd4444', condition: 'Good', priceCentavos: 1500000 })] }),
    normalizeShopItems({ items: [unit({ listingKey: 'aaaa1111bbbb2222' }), unit({ listingKey: 'cccc3333dddd4444' })] }),
    normalizeShopItems({ items: [unit({ listingKey: '21eed678aaaa0000' }), unit({ listingKey: 'f2c3b63dbbbb0000', condition: 'Good' })] }),
    normalizeShopItems({
      items: [
        unit({ name: 'Tent', listingKey: 'k1', condition: 'Good', priceCentavos: 10000 }),
        unit({ name: 'Tent', listingKey: 'k2', condition: 'Fair', priceCentavos: 10000 }),
        unit({ name: 'Tent Good', listingKey: 'k3' }),
        unit({ name: 'Tent Good Pole', listingKey: 'k4' }),
        unit({ name: 'Chair', listingKey: 'k5' }),
      ],
    }),
  ];
  const words = ['blackdog', 'starchase', '13x', 'brand', 'new', '19000', '15000', 'good', 'fair', '100', 'tent', 'pole', 'chair', 'aaaa1111', 'cccc3333', '0badc0de', 'k1', 'k2', '21eed678', 'f2c3b63d'];

  it('agree with resolveShopSlug for every catalog and many addresses', () => {
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const items of catalogs) {
      const addresses = [
        ...items.map((item) => item.slug),
        ...Array.from({ length: 400 }, () => Array.from({ length: 1 + Math.floor(random() * 6) }, () => words[Math.floor(random() * words.length)]).join('-')),
      ];
      for (const slug of addresses) expect(server(items, slug), slug).toEqual(resolveShopSlug(items, slug));
    }
  });

  it('never redirect a current address, and every target is a current page or the shop list', () => {
    for (const items of catalogs) {
      const pages = new Set([SHOP_PATH, ...items.map((item) => `${SHOP_PATH}/${item.slug}`)]);
      for (const rule of shopRedirectRules(items)) expect(pages.has(rule.to), rule.to).toBe(true);
      for (const item of items) expect(server(items, item.slug)).toMatchObject({ type: 'page' });
    }
  });
});
