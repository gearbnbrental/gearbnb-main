import { describe, expect, it, vi } from 'vitest';
import { RmsApiError } from './rmsApi';
import {
  brandAndModel,
  brandAndModelLine,
  createShopCache,
  describeShopError,
  filterShopItems,
  formatShopPrice,
  normalizeShopItems,
  shopCategories,
  sortShopItems,
  type ShopItem,
} from './shop';

const item = (overrides: Partial<ShopItem>): ShopItem => ({
  id: 'id',
  name: 'Item',
  category: 'Tent',
  brand: '',
  model: null,
  color: null,
  condition: 'Good',
  description: null,
  priceCentavos: 100_00,
  originalPriceCentavos: null,
  images: [],
  ...overrides,
});

const tent = item({ id: 'a', name: 'Dome Tent 4P', category: 'Tent', brand: 'Coleman', model: 'Sundome', priceCentavos: 2_500_00 });
const chair = item({ id: 'b', name: 'Folding Chair', category: 'Chair', brand: 'Naturehike', model: 'YL08', priceCentavos: 650_00 });
const lamp = item({ id: 'c', name: 'Camping Lamp', category: 'Light', priceCentavos: 650_00 });
const bigTent = item({ id: 'd', name: 'Cabin Tent 8P', category: 'Tent', brand: 'Vidalido', priceCentavos: 6_000_00 });
const items = [tent, chair, lamp, bigTent];

describe('formatShopPrice', () => {
  it('shows centavos as pesos with two decimals', () => {
    expect(formatShopPrice(250000)).toBe('₱2,500.00');
    expect(formatShopPrice(99)).toBe('₱0.99');
    expect(formatShopPrice(123456789)).toBe('₱1,234,567.89');
    expect(formatShopPrice(0)).toBe('₱0.00');
  });
});

describe('brandAndModel', () => {
  it('shows no brand for generic gear', () => {
    expect(brandAndModel({ brand: 'Coleman', model: 'Sundome' })).toBe('Coleman Sundome');
    expect(brandAndModel({ brand: '', model: 'X1' })).toBe('X1');
    expect(brandAndModel({ brand: '', model: null })).toBe('');
  });

  it('is left out under a name that already says it', () => {
    expect(brandAndModelLine({ name: 'Blackdog Starchase 13x', brand: 'Blackdog', model: 'Starchase 13x' })).toBe('');
    expect(brandAndModelLine({ name: 'Dome Tent 4P', brand: 'Coleman', model: 'Sundome' })).toBe('Coleman Sundome');
  });
});

describe('normalizeShopItems', () => {
  const raw = {
    id: 'x1',
    name: 'Dome Tent',
    category: 'Tent',
    brand: 'Coleman',
    model: null,
    color: 'Green',
    condition: 'Excellent',
    description: 'Used twice.',
    priceCentavos: 250000,
    images: ['https://cdn.example.com/1.webp'],
  };

  it('keeps every field the shop shows', () => {
    expect(normalizeShopItems({ items: [raw] })).toEqual([
      { ...raw, originalPriceCentavos: null },
    ]);
  });

  it('ignores fields it does not know, and keeps a sale price only when it is higher', () => {
    const [onSale] = normalizeShopItems({ items: [{ ...raw, originalPriceCentavos: 300000, promoLabel: '11.11', internalNote: 'x' }] });
    expect(onSale.originalPriceCentavos).toBe(300000);
    expect(onSale).not.toHaveProperty('promoLabel');
    expect(onSale).not.toHaveProperty('internalNote');
    expect(normalizeShopItems({ items: [{ ...raw, originalPriceCentavos: 250000 }] })[0].originalPriceCentavos).toBeNull();
    expect(normalizeShopItems({ items: [{ ...raw, originalPriceCentavos: '300000' }] })[0].originalPriceCentavos).toBeNull();
  });

  it('drops items it cannot show instead of failing the list', () => {
    const list = normalizeShopItems({
      items: [raw, { ...raw, id: '' }, { ...raw, id: 'x2', priceCentavos: 12.5 }, { ...raw, id: 'x3', priceCentavos: -1 }, null, 'tent', { ...raw }],
    });
    expect(list.map((entry) => entry.id)).toEqual(['x1']); // the repeated x1 is dropped too
  });

  it('copes with missing optional fields and bad photo URLs', () => {
    const [bare] = normalizeShopItems({ items: [{ id: 'x4', name: 'Cooler', priceCentavos: 50000, images: ['', 'javascript:alert(1)', 42, 'https://ok.example.com/a.jpg'] }] });
    expect(bare).toMatchObject({ category: 'Other', brand: '', model: null, color: null, condition: '', description: null });
    expect(bare.images).toEqual(['https://ok.example.com/a.jpg']);
  });

  it('treats a body without an items list as an empty shop', () => {
    expect(normalizeShopItems({ items: [] })).toEqual([]);
    expect(normalizeShopItems({})).toEqual([]);
    expect(normalizeShopItems(null)).toEqual([]);
  });
});

describe('filtering and sorting', () => {
  it('lists categories A to Z with counts', () => {
    expect(shopCategories(items)).toEqual([
      { label: 'Chair', count: 1 },
      { label: 'Light', count: 1 },
      { label: 'Tent', count: 2 },
    ]);
    expect(shopCategories([])).toEqual([]);
  });

  it('filters by category', () => {
    expect(filterShopItems(items, { category: 'Tent', query: '' })).toEqual([tent, bigTent]);
    expect(filterShopItems(items, { category: '', query: '' })).toEqual(items);
  });

  it('searches name, brand and model, any case, every word', () => {
    expect(filterShopItems(items, { category: '', query: 'coleman' })).toEqual([tent]);
    expect(filterShopItems(items, { category: '', query: 'yl08' })).toEqual([chair]);
    expect(filterShopItems(items, { category: '', query: '  TENT  ' })).toEqual([tent, bigTent]);
    expect(filterShopItems(items, { category: '', query: 'tent vidalido' })).toEqual([bigTent]);
    expect(filterShopItems(items, { category: 'Chair', query: 'tent' })).toEqual([]);
  });

  it('does not search the category or description', () => {
    expect(filterShopItems(items, { category: '', query: 'light' })).toEqual([]);
  });

  it('sorts by price both ways, keeping the RMS order for equal prices', () => {
    expect(sortShopItems(items, 'price-asc').map((entry) => entry.id)).toEqual(['b', 'c', 'a', 'd']);
    expect(sortShopItems(items, 'price-desc').map((entry) => entry.id)).toEqual(['d', 'a', 'b', 'c']);
    expect(sortShopItems(items, 'featured')).toEqual(items);
  });

  it('never changes the list it was given', () => {
    const copy = [...items];
    sortShopItems(items, 'price-desc');
    expect(items).toEqual(copy);
  });
});

describe('describeShopError', () => {
  it('shows the RMS message on a 503', () => {
    const err = new RmsApiError('The shop is being updated. Please try again shortly.', 503, undefined, undefined, { code: 'SHOP_UNAVAILABLE' });
    expect(describeShopError(err)).toEqual({ message: 'The shop is being updated. Please try again shortly.' });
  });

  it('falls back to its own message when a 503 has none', () => {
    expect(describeShopError(new RmsApiError('The request could not be completed.', 503)).message).toBe(
      "We couldn't load the shop right now. Please try again in a moment.",
    );
  });

  it('waits as long as Retry-After says on a 429', () => {
    expect(describeShopError(new RmsApiError('Too many requests', 429, undefined, 12_000))).toEqual({
      message: 'The shop is busy right now. Please try again in 12 seconds.',
      retryAfterMs: 12_000,
    });
    expect(describeShopError(new RmsApiError('Too many requests', 429, undefined, 1_000)).message).toContain('in 1 second.');
    expect(describeShopError(new RmsApiError('Too many requests', 429)).retryAfterMs).toBe(30_000);
  });

  it('never shows other errors as they are', () => {
    for (const err of [new RmsApiError('Prisma P2021 table missing', 500), new TypeError('Failed to fetch'), 'boom']) {
      expect(describeShopError(err)).toEqual({ message: "We couldn't load the shop right now. Please try again in a moment." });
    }
  });

  it('has no em dashes in what customers see', () => {
    expect(describeShopError(new RmsApiError('x', 429, undefined, 5_000)).message).not.toContain('—');
    expect(describeShopError(new Error()).message).not.toContain('—');
  });
});

describe('createShopCache', () => {
  it('reuses a list for 60 seconds, then fetches again', async () => {
    let clock = 0;
    const fetchItems = vi.fn(async () => [tent]);
    const cache = createShopCache(fetchItems, 60_000, () => clock);

    expect(cache.peek()).toBeNull();
    expect(await cache.load()).toEqual([tent]);
    clock = 59_999;
    expect(cache.peek()).toEqual([tent]);
    await cache.load();
    expect(fetchItems).toHaveBeenCalledTimes(1);
    clock = 60_000;
    expect(cache.peek()).toBeNull();
    await cache.load();
    expect(fetchItems).toHaveBeenCalledTimes(2);
  });

  it('shares one request between callers asking at the same time', async () => {
    const fetchItems = vi.fn(async () => [chair]);
    const cache = createShopCache(fetchItems);
    const [first, second] = await Promise.all([cache.load(), cache.load()]);
    expect(first).toBe(second);
    expect(fetchItems).toHaveBeenCalledTimes(1);
  });

  it('keeps an empty shop like any other answer', async () => {
    const fetchItems = vi.fn(async () => []);
    const cache = createShopCache(fetchItems);
    expect(await cache.load()).toEqual([]);
    expect(cache.peek()).toEqual([]);
    await cache.load();
    expect(fetchItems).toHaveBeenCalledTimes(1);
  });

  it('never keeps a failure, so Try again asks the RMS again', async () => {
    const fetchItems = vi.fn().mockRejectedValueOnce(new RmsApiError('down', 503)).mockResolvedValueOnce([lamp]);
    const cache = createShopCache(fetchItems);
    await expect(cache.load()).rejects.toBeInstanceOf(RmsApiError);
    expect(cache.peek()).toBeNull();
    expect(await cache.load()).toEqual([lamp]);
    expect(fetchItems).toHaveBeenCalledTimes(2);
  });
});
