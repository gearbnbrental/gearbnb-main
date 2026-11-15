/**
 * Title, description and schema.org data for the Find A Campsite pages: the directory, each
 * campsite and each province. The app sets the title and description when a page opens; the build
 * writes all three into the page's own HTML (see src/prerender.tsx), which is what search engines
 * and AI assistants read. Every fact comes from the campsite's own details through
 * src/utils/campsites.ts, so the schema always says what the page says.
 */
import type { Campsite, CampsiteSummary } from '../types/campsite';
import {
  CAMPSITES_PATH,
  DETAIL_LABELS,
  NETWORKS,
  SIGNAL_LABEL,
  campsiteFaq,
  campsitePath,
  campsiteSummarySentence,
  headlineFee,
  placeName,
  provinceFaq,
  provinceIntro,
  provincePath,
  type CampsiteFaqItem,
  type ProvinceGroup,
} from '../utils/campsites';
import { SITE_URL, type PageMeta } from './pageMeta';
import { breadcrumbJsonLd, catalogJsonLd, fitDescription } from './productMeta';

export const CAMPSITES_LIST_NAME = 'Find A Campsite';

export function faqJsonLd(url: string, items: CampsiteFaqItem[]) {
  return {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    url,
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

const feature = (name: string, value: boolean | string) => ({ '@type': 'LocationFeatureSpecification', name, value });

/** The campsite's confirmed amenities as schema.org amenityFeature entries. */
export function amenityFeatures(campsite: CampsiteSummary) {
  const d = campsite.details;
  return [
    d.hasRestroom === null ? null : feature('Restroom', d.hasRestroom),
    d.hasShowers === null ? null : feature('Showers', d.hasShowers),
    d.drinkingWater === null ? null : feature('Drinking water', d.drinkingWater === 'POTABLE'),
    d.electricity === null ? null : feature('Electricity', d.electricity === 'NONE' ? false : DETAIL_LABELS.electricity[d.electricity]),
    d.parking === null ? null : feature('Parking', d.parking === 'NONE' ? false : DETAIL_LABELS.parking[d.parking]),
    d.roadAccess === null ? null : feature('Road access', DETAIL_LABELS.roadAccess[d.roadAccess]),
    d.carCamping === null ? null : feature('Car camping', d.carCamping),
    d.motoCamping === null ? null : feature('Motocamping', d.motoCamping),
    d.petPolicy === null ? null : feature('Pets allowed', d.petPolicy === 'ALLOWED' ? true : d.petPolicy === 'NOT_ALLOWED' ? false : 'Ask first'),
    d.campfire === null ? null : feature('Campfires allowed', d.campfire === 'NOT_ALLOWED' ? false : DETAIL_LABELS.campfire[d.campfire]),
    d.cookingAllowed === null ? null : feature('Cooking allowed', d.cookingAllowed),
    d.kidFriendly === null ? null : feature('Kid-friendly', d.kidFriendly),
    d.tentsOnSite === null ? null : feature('Tents available on site', d.tentsOnSite),
    ...NETWORKS.filter((network) => d[network.key] !== null).map((network) =>
      feature(`${network.brands} cell signal`, SIGNAL_LABEL[d[network.key]!]),
    ),
  ].filter((entry) => entry !== null);
}

function campgroundJsonLd(campsite: Campsite, url: string) {
  const fee = headlineFee(campsite);
  const images = campsite.photos.map((photo) => photo.url);
  const sameAs = [campsite.facebookUrl, campsite.websiteUrl].filter(Boolean);
  const reviews = campsite.reviews.slice(0, 10);
  return {
    '@type': 'Campground',
    '@id': `${url}#campground`,
    name: campsite.name,
    description: campsite.description || campsiteSummarySentence(campsite),
    url,
    ...(images.length ? { image: images } : {}),
    address: {
      '@type': 'PostalAddress',
      ...(campsite.addressLine ? { streetAddress: campsite.addressLine } : {}),
      addressLocality: campsite.cityMunicipality,
      addressRegion: campsite.province,
      addressCountry: 'PH',
    },
    geo: { '@type': 'GeoCoordinates', latitude: campsite.lat, longitude: campsite.lng },
    ...(campsite.googleMapsUrl ? { hasMap: campsite.googleMapsUrl } : {}),
    ...(campsite.phone ? { telephone: campsite.phone } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(fee.centavos === 0 ? { isAccessibleForFree: true } : fee.text ? { isAccessibleForFree: false, priceRange: fee.text } : {}),
    ...(campsite.details.petPolicy ? { petsAllowed: campsite.details.petPolicy === 'ALLOWED' } : {}),
    ...(campsite.operatingHours ? { openingHours: campsite.operatingHours } : {}),
    ...(campsite.details.activities.length ? { keywords: campsite.details.activities.join(', ') } : {}),
    amenityFeature: amenityFeatures(campsite),
    ...(campsite.rating.count > 0 && campsite.rating.average !== null
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: campsite.rating.average,
            reviewCount: campsite.rating.count,
            bestRating: 5,
            worstRating: 1,
          },
          review: reviews.map((review) => ({
            '@type': 'Review',
            author: { '@type': 'Person', name: review.displayName },
            datePublished: review.createdAt.slice(0, 10),
            reviewBody: review.body,
            reviewRating: { '@type': 'Rating', ratingValue: review.rating, bestRating: 5, worstRating: 1 },
          })),
        }
      : {}),
  };
}

/** `provinceHasPage`: the campsite's province has its own page (enough campsites), so the
 *  breadcrumb can go through it. */
export function campsitePageMeta(campsite: Campsite, provinceHasPage: boolean): PageMeta {
  const url = SITE_URL + campsitePath(campsite);
  const description = fitDescription([campsiteSummarySentence(campsite), 'Rent your camping gear from GearBnB.']);
  const faq = campsiteFaq(campsite);
  return {
    title: `${campsite.name}: Campsite in ${placeName(campsite)} | GearBnB`,
    description,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${url}#webpage`,
          url,
          name: campsite.name,
          isPartOf: { '@id': `${SITE_URL}/#website` },
          about: { '@id': `${url}#campground` },
          ...(campsite.detailsCheckedAt ? { dateModified: campsite.detailsCheckedAt } : {}),
          publisher: { '@id': `${SITE_URL}/#business` },
        },
        campgroundJsonLd(campsite, url),
        breadcrumbJsonLd(
          url,
          [
            { name: CAMPSITES_LIST_NAME, path: CAMPSITES_PATH },
            ...(provinceHasPage ? [{ name: campsite.province, path: provincePath(campsite.province) }] : []),
          ],
          campsite.name,
        ),
        faqJsonLd(url, faq),
      ],
    },
  };
}

const listItems = (campsites: readonly CampsiteSummary[]) =>
  campsites.map((campsite) => ({ name: campsite.name, path: campsitePath(campsite), image: campsite.coverPhoto?.url ?? null }));

/** The /campsites directory schema: CollectionPage + ItemList of every campsite. */
export function campsitesListJsonLd(campsites: readonly CampsiteSummary[]) {
  return catalogJsonLd(CAMPSITES_PATH, 'Campsites in the Philippines', listItems(campsites));
}

export function provincePageMeta(group: ProvinceGroup): PageMeta {
  const path = provincePath(group.province);
  const url = SITE_URL + path;
  const list = catalogJsonLd(path, `Camping Sites in ${group.province}`, listItems(group.campsites));
  return {
    title: `Camping Sites in ${group.province} | GearBnB`,
    description: fitDescription([provinceIntro(group), 'Rent your camping gear from GearBnB.']),
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        ...list['@graph'],
        breadcrumbJsonLd(url, [{ name: CAMPSITES_LIST_NAME, path: CAMPSITES_PATH }], group.province),
        faqJsonLd(url, provinceFaq(group)),
      ],
    },
  };
}
