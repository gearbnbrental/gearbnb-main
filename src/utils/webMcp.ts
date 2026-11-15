/**
 * WebMCP: read-only tools an AI agent running in the visitor's browser can call instead of
 * scraping the page (https://github.com/webmachinelearning/webmcp). Browsers without
 * `navigator.modelContext` ignore all of this. The tools only read the public catalog, rental
 * facts and the Find A Campsite directory; nothing here books, adds to the cart or reads personal
 * data.
 */
import { CAMPSITES_COMING_SOON } from '../config/features';
import { SITE_URL } from '../config/pageMeta';
import { BUSINESS_SUMMARY, CONTACT_FACTS, DEPOSIT_RULE, HOW_RENTING_WORKS, depositTierLines } from '../config/rentalFacts';
import { fetchCampsiteDetail, fetchCampsiteList } from '../data/campsites';
import type { Campsite, CampsiteSummary } from '../types/campsite';
import type { BookableGearKind, PackageKit } from '../types/gearbnb';
import {
  EMPTY_FILTERS,
  campsiteFacts,
  campsiteFaq,
  campsitePath,
  campsiteSummarySentence,
  checkedMonth,
  filterCampsites,
  headlineFee,
  placeName,
  type CampsiteFilters,
  type MustHave,
} from './campsites';
import { splitBestForLine } from './bestForLine';
import { cleanGearName } from './gearName';
import { gearPath, gearSlug, packagePath, packageSlug } from './productSlug';

interface ToolResult {
  content: { type: 'text'; text: string }[];
}

export interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: object;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ModelContext {
  registerTool?: (tool: WebMcpTool) => void;
  unregisterTool?: (name: string) => void;
  provideContext?: (context: { tools: WebMcpTool[] }) => void;
}

export interface CatalogSnapshot {
  kits: readonly PackageKit[];
  gearKinds: readonly BookableGearKind[];
}

const text = (value: unknown): ToolResult => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
});

function packageInfo(kit: PackageKit) {
  return {
    type: 'package',
    name: kit.name,
    slug: packageSlug(kit),
    url: SITE_URL + packagePath(kit),
    pricePhp: { '48h': kit.pricing['48h'], '72h': kit.pricing['72h'] },
    securityDepositPhp: kit.depositAmount,
    guests: kit.paxRange || undefined,
    bestFor: splitBestForLine(kit.description).bestFor ?? undefined,
    inStock: !kit.isOutOfStock,
  };
}

function gearInfo(kind: BookableGearKind) {
  return {
    type: 'gear',
    name: cleanGearName(kind.name),
    slug: gearSlug(kind),
    url: SITE_URL + gearPath(kind),
    category: kind.category,
    brand: kind.brand || undefined,
    pricePhp: { '48h': kind.pricing['48h'], '72h': kind.pricing['72h'] },
    extraDayPhp: kind.extraPerDayPrice || undefined,
    sizeCapacity: kind.sizeCapacity ?? undefined,
    colors: kind.variants?.map((variant) => variant.color),
    bestFor: splitBestForLine(kind.description ?? '').bestFor ?? undefined,
    inStock: kind.canSelect,
  };
}

const NOT_LOADED = 'The catalog is still loading. Try again in a few seconds.';

/** The tools, reading the catalog through `snapshot` each time they run. */
export function rentalTools(snapshot: () => CatalogSnapshot): WebMcpTool[] {
  return [
    {
      name: 'search_rental_catalog',
      description:
        'Search GearBnB camping packages and individual camping gear for rent (tents, beds, chairs, tables, coolers, fans, lights). Returns names, 48-hour and 72-hour prices in PHP, deposits for packages and each item’s page URL.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Words to match in the name, brand or category, e.g. "tent" or "cooler". Leave empty for everything.' },
          type: { type: 'string', enum: ['package', 'gear', 'any'], description: 'Packages only, individual gear only, or both (default).' },
        },
      },
      annotations: { readOnlyHint: true },
      async execute(input) {
        const { kits, gearKinds } = snapshot();
        if (kits.length === 0 && gearKinds.length === 0) return text(NOT_LOADED);
        const words = String(input.query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
        const matches = (fields: (string | undefined)[]) =>
          words.every((word) => fields.some((field) => field?.toLowerCase().includes(word)));
        const type = input.type === 'package' || input.type === 'gear' ? input.type : 'any';
        return text([
          ...(type === 'gear' ? [] : kits.filter((kit) => matches([kit.name, kit.description])).map(packageInfo)),
          ...(type === 'package' ? [] : gearKinds.filter((kind) => matches([kind.name, kind.brand, kind.category])).map(gearInfo)),
        ]);
      },
    },
    {
      name: 'get_rental_item',
      description: 'Full details of one GearBnB package or gear item: description, what is included, prices, deposit and availability.',
      inputSchema: {
        type: 'object',
        properties: { slug: { type: 'string', description: 'The item’s slug from search_rental_catalog, e.g. "stargazer-kit".' } },
        required: ['slug'],
      },
      annotations: { readOnlyHint: true },
      async execute(input) {
        const { kits, gearKinds } = snapshot();
        if (kits.length === 0 && gearKinds.length === 0) return text(NOT_LOADED);
        const slug = String(input.slug ?? '').trim().toLowerCase();
        const kit = kits.find((candidate) => packageSlug(candidate) === slug);
        if (kit) {
          return text({
            ...packageInfo(kit),
            description: kit.description,
            included: kit.components?.map((component) => `${component.quantity}× ${cleanGearName(component.name ?? component.category)}`) ?? kit.includedItems,
          });
        }
        const kind = gearKinds.find((candidate) => gearSlug(candidate) === slug);
        if (kind) {
          return text({
            ...gearInfo(kind),
            description: kind.description,
            includedFree: kind.freeAccessories.map((accessory) => accessory.name),
          });
        }
        return text(`No item with slug "${slug}". Use search_rental_catalog to find one.`);
      },
    },
    {
      name: 'get_rental_policies',
      description: 'How renting from GearBnB works: booking steps, ID verification, the security deposit tiers and deadline, payment, pickup and delivery, and contact details.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      async execute() {
        return text(
          [
            BUSINESS_SUMMARY,
            '',
            'How renting works:',
            ...HOW_RENTING_WORKS.map((line) => `- ${line}`),
            '',
            DEPOSIT_RULE,
            ...depositTierLines().map((line) => `- ${line}`),
            '',
            'Contact:',
            ...CONTACT_FACTS.map((line) => `- ${line}`),
            '',
            `Rental terms: ${SITE_URL}/terms`,
          ].join('\n'),
        );
      },
    },
  ];
}

export interface CampsiteSource {
  list: () => Promise<CampsiteSummary[]>;
  detail: (slug: string) => Promise<Campsite | null>;
}

/** The live directory, with the list loaded once per visit. */
function liveCampsites(): CampsiteSource {
  let list: Promise<CampsiteSummary[]> | null = null;
  return {
    list: () => {
      list ??= fetchCampsiteList().catch((error: unknown) => {
        list = null;
        throw error;
      });
      return list;
    },
    detail: fetchCampsiteDetail,
  };
}

function campsiteInfo(campsite: CampsiteSummary) {
  return {
    name: campsite.name,
    slug: campsite.slug,
    url: SITE_URL + campsitePath(campsite),
    place: `${placeName(campsite)}, ${campsite.region}`,
    summary: campsiteSummarySentence(campsite),
    entranceFee: headlineFee(campsite).text ?? undefined,
    driveMinutesFromLasPinas: campsite.driveMinutesFromLasPinas ?? undefined,
    terrain: campsite.details.terrain,
    activities: campsite.details.activities,
    rating: campsite.rating.count ? { average: campsite.rating.average, reviews: campsite.rating.count } : undefined,
    detailsChecked: checkedMonth(campsite.detailsCheckedAt) ?? undefined,
  };
}

const CAMPSITES_UNAVAILABLE = 'The campsite directory could not be loaded right now. Try again shortly, or see ' + SITE_URL + '/campsites.';

/** Find A Campsite tools: search the directory, and one campsite's full details. */
export function campsiteTools(source: CampsiteSource): WebMcpTool[] {
  return [
    {
      name: 'search_campsites',
      description:
        'Search campsites in the Philippines from GearBnB\'s Find A Campsite directory, by text, province, terrain, activity, amenities, cell signal or distance from Metro Manila. Returns each campsite\'s summary, entrance fee, rating and page URL.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Words to match in the name, town, province, terrain or activities.' },
          province: { type: 'string', description: 'e.g. "Rizal", "Batangas".' },
          terrain: { type: 'string', description: 'e.g. "Beach", "Mountain", "Riverside".' },
          activity: { type: 'string', description: 'e.g. "Swimming", "Hiking", "Stargazing".' },
          restroom: { type: 'boolean', description: 'Only campsites with a restroom.' },
          signal: { type: 'string', enum: ['any', 'Smart', 'Globe', 'DITO'], description: 'Only campsites with cell signal (on that network).' },
          carCamping: { type: 'boolean', description: 'Only campsites where you can park beside your tent.' },
          motoCamping: { type: 'boolean', description: 'Only campsites motorcycles can ride into.' },
          petFriendly: { type: 'boolean' },
          bonfire: { type: 'boolean', description: 'Only campsites that allow bonfires.' },
          regularCar: { type: 'boolean', description: 'Only campsites any car can reach.' },
          withinThreeHoursOfManila: { type: 'boolean' },
          maxEntranceFeePhp: { type: 'number' },
        },
      },
      annotations: { readOnlyHint: true },
      async execute(input) {
        let campsites: CampsiteSummary[];
        try {
          campsites = await source.list();
        } catch {
          return text(CAMPSITES_UNAVAILABLE);
        }
        const str = (value: unknown) => (typeof value === 'string' ? value : '');
        const signal = str(input.signal);
        const flag = (on: unknown, key: MustHave) => (on === true ? [key] : []);
        const filters: CampsiteFilters = {
          ...EMPTY_FILTERS,
          query: str(input.query),
          province: str(input.province),
          types: str(input.terrain) ? [str(input.terrain)] : [],
          activity: str(input.activity),
          mustHaves: [
            ...flag(input.restroom, 'restroom'),
            ...flag(signal === 'any', 'signal'),
            ...flag(input.carCamping, 'carCamping'),
            ...flag(input.motoCamping, 'motoCamping'),
            ...flag(input.petFriendly, 'pets'),
            ...flag(input.bonfire, 'bonfire'),
            ...flag(input.regularCar, 'anyCar'),
            ...flag(input.withinThreeHoursOfManila, 'nearManila'),
          ],
          networks: signal === 'Smart' || signal === 'Globe' || signal === 'DITO' ? [signal] : [],
          maxFee: typeof input.maxEntranceFeePhp === 'number' && input.maxEntranceFeePhp > 0 ? input.maxEntranceFeePhp : 0,
        };
        const matches = filterCampsites(campsites, filters);
        if (matches.length === 0) return text(`No campsites match. Browse them all at ${SITE_URL}/campsites.`);
        return text(matches.map(campsiteInfo));
      },
    },
    {
      name: 'get_campsite',
      description:
        'Full details of one campsite in GearBnB\'s directory: fees, cell signal by network, restroom, water, electricity, road access, pets, bonfire rules, activities, how to book, camper reviews and an FAQ.',
      inputSchema: {
        type: 'object',
        properties: { slug: { type: 'string', description: 'The campsite\'s slug from search_campsites.' } },
        required: ['slug'],
      },
      annotations: { readOnlyHint: true },
      async execute(input) {
        const slug = String(input.slug ?? '').trim().toLowerCase();
        let campsite: Campsite | null;
        try {
          campsite = await source.detail(slug);
        } catch {
          return text(CAMPSITES_UNAVAILABLE);
        }
        if (!campsite) return text(`No campsite with slug "${slug}". Use search_campsites to find one.`);
        return text({
          ...campsiteInfo(campsite),
          description: campsite.description,
          details: Object.fromEntries(campsiteFacts(campsite).map((fact) => [fact.label, fact.value])),
          houseRules: campsite.details.houseRules ?? undefined,
          bestTimeToVisit: campsite.details.bestTimeToVisit ?? undefined,
          faq: campsiteFaq(campsite),
          recentReviews: campsite.reviews.slice(0, 5).map((review) => ({ rating: review.rating, text: review.body, date: review.createdAt.slice(0, 10) })),
          note: 'GearBnB does not take campsite bookings or payments: book directly with the campsite. Rent camping gear for the trip from GearBnB.',
        });
      },
    },
  ];
}

/** Registers the tools when the browser supports WebMCP. Returns the cleanup. */
export function registerRentalTools(
  modelContext: ModelContext | undefined,
  snapshot: () => CatalogSnapshot,
  // No campsite tools until Find A Campsite launches (see config/features.ts).
  campsites: CampsiteSource | null = CAMPSITES_COMING_SOON ? null : liveCampsites(),
): () => void {
  if (!modelContext) return () => {};
  const tools = [...rentalTools(snapshot), ...(campsites ? campsiteTools(campsites) : [])];
  try {
    if (modelContext.registerTool) {
      for (const tool of tools) modelContext.registerTool(tool);
      return () => tools.forEach((tool) => modelContext.unregisterTool?.(tool.name));
    }
    modelContext.provideContext?.({ tools });
  } catch (error) {
    // An early WebMCP build with a different shape: the site works the same without the tools.
    console.warn('WebMCP tools not registered', error);
  }
  return () => {};
}
