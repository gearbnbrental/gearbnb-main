/**
 * Title, description and schema.org data for each shop item's own page (/catalog/camping-gear-sale/:slug), so Google
 * and AI tools can read every piece for sale as a Product with an Offer. The app sets the title and
 * description when the page opens; the build writes all three into the page's own HTML (see
 * src/prerender.tsx). Everything comes from the RMS item: nothing here is invented.
 */
import { availableText, brandAndModelLine, conditionPhrase, conditionTone, formatShopPrice, shopItemPath, SHOP_PATH, type ShopItem } from '../utils/shop';
import { SITE_URL, type PageMeta } from './pageMeta';
import { breadcrumbJsonLd, catalogJsonLd, fitDescription } from './productMeta';

/** schema.org itemCondition for the RMS's condition label; null for a label it doesn't know. */
export function schemaItemCondition(condition: string): string | null {
  switch (conditionTone(condition)) {
    case 'new':
      return 'https://schema.org/NewCondition';
    case 'good':
    case 'fair':
      return 'https://schema.org/UsedCondition';
    case 'repair':
      return 'https://schema.org/DamagedCondition';
    default:
      return null;
  }
}

/** "Blackdog Starchase 13x, brand new, ₱19,000.00 each, 2 available." / "..., ₱950.00, only 1 left." */
export function shopItemSummary(item: ShopItem): string {
  const line = brandAndModelLine(item);
  const price = formatShopPrice(item.priceCentavos);
  const count = item.quantity > 1 ? ` each, ${availableText(item)}` : ', only 1 left';
  return `${item.name}${line ? ` (${line})` : ''}, ${conditionPhrase(item.condition)}, ${price}${count}.`;
}

export function shopItemPageMeta(item: ShopItem): PageMeta {
  const url = SITE_URL + shopItemPath(item);
  const price = formatShopPrice(item.priceCentavos);
  const description = fitDescription([
    `Buy the ${item.name}, ${conditionPhrase(item.condition)}, for ${price}.`,
    item.description ?? '',
    item.quantity > 1 ? `${availableText(item)}. Message GearBnB to buy one.` : `${availableText(item)}. Message GearBnB to buy it.`,
  ]);
  const condition = schemaItemCondition(item.condition);
  return {
    title: `${item.name} for Sale | GearBnB`,
    description,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Product',
          '@id': `${url}#product`,
          name: item.name,
          description: item.description || description,
          url,
          sku: item.id,
          category: item.category,
          ...(item.images.length ? { image: item.images } : {}),
          ...(item.brand ? { brand: { '@type': 'Brand', name: item.brand } } : {}),
          ...(item.model ? { model: item.model } : {}),
          ...(item.color ? { color: item.color } : {}),
          ...(condition ? { itemCondition: condition } : {}),
          offers: {
            '@type': 'Offer',
            url,
            price: (item.priceCentavos / 100).toFixed(2),
            priceCurrency: 'PHP',
            availability: 'https://schema.org/InStock',
            inventoryLevel: { '@type': 'QuantitativeValue', value: item.quantity },
            ...(condition ? { itemCondition: condition } : {}),
            seller: { '@id': `${SITE_URL}/#business` },
          },
        },
        breadcrumbJsonLd(url, [{ name: 'Camping Gear for Sale', path: SHOP_PATH }], item.name),
      ],
    },
  };
}

/** The shop page's CollectionPage + ItemList, linking every item's page. */
export function shopListJsonLd(items: ShopItem[]) {
  return catalogJsonLd(
    SHOP_PATH,
    'Camping Gear for Sale',
    items.map((item) => ({ name: item.name, path: shopItemPath(item), image: item.images[0] ?? null })),
  );
}
