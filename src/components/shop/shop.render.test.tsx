import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { ShopItem } from '../../utils/shop';
import ShopItemCard from './ShopItemCard';
import { SHOP_EMPTY_MESSAGE, ShopEmpty, ShopError, ShopLoading, ShopNoMatches } from './ShopStates';

function html(element: ReactElement): string {
  return renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
}
/** The rendered text only, tags stripped and whitespace collapsed. */
function text(element: ReactElement): string {
  return html(element)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const tent: ShopItem = {
  id: 'item-1',
  quantity: 1,
  slug: 'dome-tent-4p',
  name: 'Dome Tent 4P',
  category: 'Tent',
  brand: 'Coleman',
  model: 'Sundome',
  color: 'Green',
  condition: 'Excellent',
  description: 'Used twice.',
  priceCentavos: 250000,
  originalPriceCentavos: null,
  images: ['https://cdn.example.com/tent-1.webp', 'https://cdn.example.com/tent-2.webp'],
};

describe('shop states', () => {
  it('loading shows a busy placeholder grid', () => {
    expect(html(<ShopLoading />)).toContain('aria-busy="true"');
  });

  it('empty says nothing is for sale', () => {
    expect(SHOP_EMPTY_MESSAGE).toBe('Nothing for sale right now, check back soon!');
    expect(text(<ShopEmpty />)).toBe(SHOP_EMPTY_MESSAGE);
  });

  it('no matches offers to clear the search', () => {
    expect(text(<ShopNoMatches onClear={() => {}} />)).toContain('Clear search and filters');
  });

  it('error shows the message and a working Try again', () => {
    const markup = html(<ShopError error={{ message: 'The shop is being updated.' }} onRetry={() => {}} />);
    expect(markup).toContain('role="alert"');
    expect(text(<ShopError error={{ message: 'The shop is being updated.' }} onRetry={() => {}} />)).toBe('The shop is being updated. Try again');
    expect(markup).not.toContain('disabled=""');
  });

  it('after a 429, Try again waits for Retry-After', () => {
    const element = <ShopError error={{ message: 'The shop is busy right now.', retryAfterMs: 12_000 }} onRetry={() => {}} />;
    expect(text(element)).toContain('Try again in 12s');
    expect(html(element)).toContain('disabled=""');
  });
});

describe('shop card', () => {
  it('shows the first photo, name, brand and model, condition and price, and links to the item', () => {
    const markup = html(<ShopItemCard item={tent} />);
    expect(markup).toContain('src="https://cdn.example.com/tent-1.webp"');
    expect(markup).not.toContain('tent-2.webp');
    expect(markup).toContain('href="/catalog/camping-gear-sale/dome-tent-4p"');
    expect(text(<ShopItemCard item={tent} />)).toBe('2 photos Tent Dome Tent 4P Coleman Sundome Excellent Only 1 left ₱2,500.00');
  });

  it('shows a placeholder when there are no photos, and no brand for generic gear', () => {
    const generic = { ...tent, brand: '', model: null, images: [] };
    expect(html(<ShopItemCard item={generic} />)).not.toContain('<img');
    expect(text(<ShopItemCard item={generic} />)).toBe('Photo coming soon Tent Dome Tent 4P Excellent Only 1 left ₱2,500.00');
  });

  it('shows how many are available, or that only 1 is left', () => {
    expect(text(<ShopItemCard item={{ ...tent, quantity: 2 }} />)).toContain('Excellent 2 available ₱2,500.00');
    expect(text(<ShopItemCard item={tent} />)).toContain('Excellent Only 1 left ₱2,500.00');
  });

  it('crosses out the price before a sale', () => {
    const onSale = { ...tent, originalPriceCentavos: 300000 };
    expect(html(<ShopItemCard item={onSale} />)).toMatch(/<s[^>]*>.*₱3,000\.00<\/s>/);
    expect(text(<ShopItemCard item={onSale} />)).toContain('Was ₱3,000.00 Now ₱2,500.00');
  });
});
