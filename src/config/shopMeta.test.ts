import { describe, expect, it } from 'vitest';
import { findShopItemBySlug, normalizeShopItems, shopItemPath, type ShopItem } from '../utils/shop';
import { schemaItemCondition, shopItemPageMeta, shopItemSummary, shopListJsonLd } from './shopMeta';

// The two live units of the same tent: one listing with a count.
const [tent] = normalizeShopItems({
  items: ['8cb24a34-df23-4c7b-99ee-8b3caf6868f5'].map((id) => ({
    id,
    listingKey: '3f9a1c0d2b7e8a41',
    quantity: 2,
    name: 'Blackdog Starchase 13x',
    category: 'Tent',
    brand: 'Blackdog',
    model: 'Starchase 13x',
    color: 'Black',
    condition: 'Brand new',
    description: null,
    priceCentavos: 1900000,
    imageUrl: null,
    images: [],
  })),
});
const chair: ShopItem = {
  ...tent,
  id: 'c-1',
  quantity: 1,
  slug: 'moon-chair-khaki-used',
  name: 'Moon Chair (Khaki) — Used',
  category: 'Chair',
  brand: '',
  model: null,
  color: null,
  condition: 'Good',
  description: 'Used on three trips.',
  priceCentavos: 95050,
  images: ['https://cdn.example.com/chair.webp'],
};
const TENT_URL = 'https://gearbnbrental.com/catalog/camping-gear-sale/blackdog-starchase-13x';

type Graph = { '@graph': Record<string, unknown>[] };
const product = (item: ShopItem) => (shopItemPageMeta(item).jsonLd as Graph)['@graph'][0] as Record<string, unknown>;

describe('shop listing addresses', () => {
  it('uses the name only, for both units of the same tent', () => {
    expect(tent).toMatchObject({ quantity: 2, slug: 'blackdog-starchase-13x' });
    expect(shopItemPath(tent)).toBe('/catalog/camping-gear-sale/blackdog-starchase-13x');
    expect(findShopItemBySlug([tent, chair], 'blackdog-starchase-13x')).toBe(tent);
  });

  it('finds nothing for an unknown or missing slug', () => {
    expect(findShopItemBySlug([tent], 'blackdog-starchase-13x-8cb24a34')).toBeUndefined();
    expect(findShopItemBySlug([tent], undefined)).toBeUndefined();
  });
});

describe('shop listing page', () => {
  it('has a title and a description within 160 characters, with the count', () => {
    const meta = shopItemPageMeta(tent);
    expect(meta.title).toBe('Blackdog Starchase 13x for Sale | GearBnB');
    expect(meta.description).toBe('Buy the Blackdog Starchase 13x, brand new, for ₱19,000.00. 2 available. Message GearBnB to buy one.');
    expect(shopItemPageMeta(chair).description).toContain('Only 1 left. Message GearBnB to buy it.');
    expect(shopItemPageMeta({ ...chair, description: 'x'.repeat(400) }).description.length).toBeLessThanOrEqual(160);
  });

  it('is a Product with an in-stock Offer in pesos and how many are left', () => {
    expect(product(tent)).toMatchObject({
      '@type': 'Product',
      '@id': `${TENT_URL}#product`,
      name: 'Blackdog Starchase 13x',
      sku: '3f9a1c0d2b7e8a41',
      category: 'Tent',
      brand: { '@type': 'Brand', name: 'Blackdog' },
      model: 'Starchase 13x',
      color: 'Black',
      itemCondition: 'https://schema.org/NewCondition',
      offers: {
        '@type': 'Offer',
        url: TENT_URL,
        price: '19000.00',
        priceCurrency: 'PHP',
        availability: 'https://schema.org/InStock',
        inventoryLevel: { '@type': 'QuantitativeValue', value: 2 },
        itemCondition: 'https://schema.org/NewCondition',
      },
    });
  });

  it('leaves out what the item does not have, and uses its own description and photos', () => {
    const json = product(chair);
    expect(json).not.toHaveProperty('brand');
    expect(json).not.toHaveProperty('model');
    expect(json).not.toHaveProperty('color');
    expect(json.description).toBe('Used on three trips.');
    expect(json.image).toEqual(['https://cdn.example.com/chair.webp']);
    expect(json.itemCondition).toBe('https://schema.org/UsedCondition');
    expect((json.offers as { price: string }).price).toBe('950.50');
    expect(product(tent)).not.toHaveProperty('image');
  });

  it('has a breadcrumb back to the shop', () => {
    const crumbs = (shopItemPageMeta(tent).jsonLd as Graph)['@graph'][1] as { itemListElement: { name: string }[] };
    expect(crumbs.itemListElement.map((step) => step.name)).toEqual(['Home', 'Camping Gear for Sale', 'Blackdog Starchase 13x']);
  });

  it('maps every condition label', () => {
    expect(schemaItemCondition('Brand new')).toBe('https://schema.org/NewCondition');
    for (const label of ['Excellent', 'Good', 'Fair']) expect(schemaItemCondition(label)).toBe('https://schema.org/UsedCondition');
    expect(schemaItemCondition('Needs repair')).toBe('https://schema.org/DamagedCondition');
    expect(schemaItemCondition('Mint')).toBeNull();
    expect(product({ ...tent, condition: 'Mint' })).not.toHaveProperty('itemCondition');
  });

  it('has a one-line summary for llms.txt', () => {
    expect(shopItemSummary(tent)).toBe('Blackdog Starchase 13x, brand new, ₱19,000.00 each, 2 available.');
    expect(shopItemSummary(chair)).toBe('Moon Chair (Khaki) — Used, used, good condition, ₱950.50, only 1 left.');
  });
});

describe('shop list schema', () => {
  it('links every listing page', () => {
    const list = (shopListJsonLd([tent, chair]) as Graph)['@graph'][1] as { numberOfItems: number; itemListElement: { url: string }[] };
    expect(list.numberOfItems).toBe(2);
    expect(list.itemListElement.map((entry) => entry.url)).toEqual([TENT_URL, 'https://gearbnbrental.com/catalog/camping-gear-sale/moon-chair-khaki-used']);
  });
});
