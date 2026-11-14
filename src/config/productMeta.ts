/**
 * Title, description and schema.org data for each product page (/catalog/camping-packages/:slug,
 * /catalog/build-your-own/:slug). The app sets the title and description when the page opens; the
 * build writes all three into the page's own HTML (see src/prerender.tsx).
 */
import type { BookableGearKind, PackageKit } from '../types/gearbnb';
import { splitBestForLine } from '../utils/bestForLine';
import { cleanGearName } from '../utils/gearName';
import { BUILD_YOUR_OWN_PATH, PACKAGES_PATH, gearPath, packagePath } from '../utils/productSlug';
import { SITE_URL, type PageMeta } from './pageMeta';

const peso = (amount: number) => `₱${amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

/** "₱1,800 for 48 hours or ₱2,500 for 72 hours" */
function priceSentence(pricing: { '48h': number; '72h': number }): string {
  return `${peso(pricing['48h'])} for 48 hours or ${peso(pricing['72h'])} for 72 hours`;
}

/** The description's first line ("Best for couples...") as a sentence, when staff wrote one. */
function bestForSentence(description: string | undefined): string {
  const { lead, bestFor } = splitBestForLine(description ?? '');
  return bestFor ? `Best ${lead} ${bestFor.replace(/\.$/, '')}.` : '';
}

/** Joins the sentences into a meta description of at most `max` characters (search engines cut
 *  longer ones off): a sentence that doesn't fit whole is cut at a word, or left out when too
 *  little room is left. */
export function fitDescription(sentences: string[], max = 160): string {
  let result = '';
  for (const sentence of sentences.filter(Boolean)) {
    const next = result ? `${result} ${sentence}` : sentence;
    if (next.length <= max) {
      result = next;
      continue;
    }
    const room = max - result.length - 2; // the space before it and the "…"
    if (room >= 40) result = `${result} ${sentence.slice(0, room).replace(/[\s,;:]+\S*$/, '')}…`;
    break;
  }
  return result;
}

function offer(url: string, pricing: { '48h': number; '72h': number }, inStock: boolean) {
  const tier = (price: number, hours: number) => ({
    '@type': 'UnitPriceSpecification',
    price,
    priceCurrency: 'PHP',
    referenceQuantity: { '@type': 'QuantitativeValue', value: hours, unitCode: 'HUR' },
  });
  return {
    '@type': 'Offer',
    url,
    price: pricing['48h'],
    priceCurrency: 'PHP',
    availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
    priceSpecification: [tier(pricing['48h'], 48), tier(pricing['72h'], 72)],
    seller: { '@id': `${SITE_URL}/#business` },
  };
}

function breadcrumb(url: string, listName: string, listPath: string, name: string) {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: listName, item: SITE_URL + listPath },
      { '@type': 'ListItem', position: 3, name, item: url },
    ],
  };
}

export function packagePageMeta(kit: PackageKit): PageMeta {
  const url = SITE_URL + packagePath(kit);
  const description = fitDescription([
    `Rent ${kit.name} for ${priceSentence(kit.pricing)}.`,
    bestForSentence(kit.description),
    'Pick up in Las Piñas City or book Lalamove or Grab delivery.',
  ]);
  const images = [kit.imageUrl, ...(kit.images ?? [])].filter((src, i, all) => src && all.indexOf(src) === i);
  return {
    title: `${kit.name} Rental${kit.paxRange ? ` (${kit.paxRange})` : ''} | GearBnB`,
    description,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Product',
          '@id': `${url}#product`,
          name: kit.name,
          description: kit.description || description,
          url,
          ...(images.length ? { image: images } : {}),
          category: 'Camping package rental',
          brand: { '@type': 'Brand', name: 'GearBnB' },
          offers: offer(url, kit.pricing, !kit.isOutOfStock),
        },
        breadcrumb(url, 'Camping Packages', PACKAGES_PATH, kit.name),
      ],
    },
  };
}

export function gearPageMeta(kind: BookableGearKind): PageMeta {
  const url = SITE_URL + gearPath(kind);
  const name = cleanGearName(kind.name);
  const description = fitDescription([
    `Rent the ${name} for ${priceSentence(kind.pricing)}.`,
    bestForSentence(kind.description),
    'Pick up in Las Piñas City or book Lalamove or Grab delivery.',
  ]);
  const images = (kind.images?.length ? kind.images : kind.imageUrl ? [kind.imageUrl] : []).filter(Boolean);
  return {
    title: `${name} for Rent | GearBnB`,
    description,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Product',
          '@id': `${url}#product`,
          name,
          description: kind.description || description,
          url,
          ...(images.length ? { image: images } : {}),
          category: `${kind.category} rental`,
          ...(kind.brand ? { brand: { '@type': 'Brand', name: kind.brand } } : {}),
          offers: offer(url, kind.pricing, kind.canSelect),
        },
        breadcrumb(url, 'Build Your Own', BUILD_YOUR_OWN_PATH, name),
      ],
    },
  };
}

/** CollectionPage + ItemList for a catalog page, linking every product page. */
export function catalogJsonLd(path: string, name: string, products: { name: string; path: string; image?: string | null }[]) {
  const url = SITE_URL + path;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#webpage`,
        url,
        name,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${SITE_URL}/#business` },
        mainEntity: { '@id': `${url}#items` },
      },
      {
        '@type': 'ItemList',
        '@id': `${url}#items`,
        numberOfItems: products.length,
        itemListElement: products.map((product, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: product.name,
          url: SITE_URL + product.path,
          ...(product.image ? { image: product.image } : {}),
        })),
      },
    ],
  };
}
