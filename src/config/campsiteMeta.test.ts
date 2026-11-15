import { describe, expect, it } from 'vitest';
import { SAMPLE_CAMPSITES } from '../data/campsiteSamples';
import type { Campsite } from '../types/campsite';
import { provinceGroups } from '../utils/campsites';
import { campsitePageMeta, campsitesListJsonLd, provincePageMeta } from './campsiteMeta';
import { PAGE_META } from './pageMeta';

const [riverside, mountain] = SAMPLE_CAMPSITES as [Campsite, Campsite];

type Node = Record<string, unknown> & { '@type': string };
const graph = (jsonLd: object | undefined) => (jsonLd as { '@graph': Node[] })['@graph'];
const node = (jsonLd: object | undefined, type: string) => graph(jsonLd).find((entry) => entry['@type'] === type);

describe('campsite page schema', () => {
  const meta = campsitePageMeta(riverside, true);

  it('describes a Campground with its address, location and confirmed amenities', () => {
    const campground = node(meta.jsonLd, 'Campground')!;
    expect(campground.url).toBe('https://gearbnbrental.com/campsites/sample-riverside-campsite-tanay-rizal');
    expect(campground.address).toMatchObject({ addressLocality: 'Tanay', addressRegion: 'Rizal', addressCountry: 'PH' });
    expect(campground.geo).toMatchObject({ latitude: 14.53, longitude: 121.36 });
    expect(campground.priceRange).toBe('₱150 per person');
    expect(campground.amenityFeature).toEqual(
      expect.arrayContaining([
        { '@type': 'LocationFeatureSpecification', name: 'Restroom', value: true },
        { '@type': 'LocationFeatureSpecification', name: 'Smart / TNT cell signal', value: 'Strong' },
      ]),
    );
  });

  it('adds ratings and reviews only when there are reviews', () => {
    expect(node(meta.jsonLd, 'Campground')!.aggregateRating).toMatchObject({ ratingValue: 4.5, reviewCount: 2 });
    expect(node(campsitePageMeta(mountain, true).jsonLd, 'Campground')!.aggregateRating).toBeUndefined();
  });

  it('includes the FAQ, the checked date and a breadcrumb through the province page when it exists', () => {
    expect((node(meta.jsonLd, 'FAQPage')!.mainEntity as unknown[]).length).toBeGreaterThan(5);
    expect(node(meta.jsonLd, 'WebPage')!.dateModified).toBe('2026-11-01');
    const crumbs = (withPage: boolean) =>
      (node(campsitePageMeta(riverside, withPage).jsonLd, 'BreadcrumbList')!.itemListElement as { name: string }[]).map((step) => step.name);
    expect(crumbs(true)).toEqual(['Home', 'Find A Campsite', 'Rizal', 'Sample Riverside Campsite']);
    expect(crumbs(false)).toEqual(['Home', 'Find A Campsite', 'Sample Riverside Campsite']);
  });

  it('keeps titles and descriptions within search result limits', () => {
    expect(meta.title).toBe('Sample Riverside Campsite: Campsite in Tanay, Rizal | GearBnB');
    for (const campsite of SAMPLE_CAMPSITES) {
      const { description } = campsitePageMeta(campsite, false);
      expect(description.length).toBeLessThanOrEqual(160);
      expect(description).toBe(description.trim());
    }
    expect(PAGE_META.campsites.description.length).toBeLessThanOrEqual(160);
  });
});

describe('directory and province schema', () => {
  it('lists every campsite', () => {
    const list = node(campsitesListJsonLd(SAMPLE_CAMPSITES), 'ItemList')!;
    expect(list.numberOfItems).toBe(4);
  });

  it('builds a province page with its list, breadcrumb and FAQ', () => {
    const [rizal] = provinceGroups(SAMPLE_CAMPSITES, { withPagesOnly: true });
    const meta = provincePageMeta(rizal!);
    expect(meta.title).toBe('Camping Sites in Rizal | GearBnB');
    expect(graph(meta.jsonLd).map((entry) => entry['@type'])).toEqual(['CollectionPage', 'ItemList', 'BreadcrumbList', 'FAQPage']);
  });
});
