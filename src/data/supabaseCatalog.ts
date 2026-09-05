import { supabase } from '../supabase';
import type { Destination, IndividualItem, KitEdition, PackageKit } from '../types/gearbnb';
import { mockDestinations, mockIndividualItems, mockPackages } from './mockData';

/** Raw shape of a row in the `packages` table (RMS Prisma schema, only the columns we use). */
interface PackageRow {
  id: string;
  name: string;
  description: string | null;
  price48hCentavos: number | null;
  price72hCentavos: number | null;
  depositCentavos: number;
}

/** Raw shape of a row in the `rentable_gears` table. */
interface RentableGearRow {
  id: string;
  name: string;
  category: string;
  price48hCentavos: number;
  price72hCentavos: number;
  depositCentavos: number;
}

/** Raw shape of a row in the `destinations` table. */
interface DestinationRow {
  id: string;
  name: string;
}

const centavosToPesos = (centavos: number) => centavos / 100;

/**
 * Real product names carry business-copy framing our mock names don't (e.g. "The Nomad Kit" vs.
 * "Nomad Kit") — strip the leading article and surrounding whitespace before comparing, or every
 * name-matched lookup below silently misses on live data.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/^the\s+/, '').trim();
}

/** Kit editions/name-matched extras are the two mock-only concepts the real schema has no room for. */
const EXTRAS_BY_KIT_NAME = new Map(mockPackages.map((kit) => [normalizeName(kit.name), kit.extras ?? []]));

/**
 * Real `packages`/`rentable_gears` rows carry no image column yet, so every row fetched from
 * Supabase would otherwise render with a blank imageUrl (falling back to the gray placeholder
 * icon in the UI). Until the RMS schema stores real image URLs, match rows to our known product
 * photos by name — the same stopgap already used for extras above. Any row whose name doesn't
 * match a known product still falls back to the placeholder icon, it just won't show a photo.
 */
const KIT_BY_NAME = new Map(mockPackages.map((kit) => [normalizeName(kit.name), kit]));
const ITEM_IMAGE_BY_NAME = new Map(mockIndividualItems.map((item) => [normalizeName(item.name), item.imageUrl]));

/**
 * Real `packages.description` rows have carried raw internal notes straight through to
 * customers (e.g. "Note: the flyer's 6-person tent has no product photo yet..."). That text
 * has to be fixed at the source in the admin database — this is just a defensive filter so an
 * admin typo doesn't ship to the live site, stripping sentences that read as internal remarks.
 */
const INTERNAL_NOTE_PATTERN = /^(note|internal|todo|fixme|dev note|staff note|admin note)\s*:/i;

function sanitizeDescription(description: string): string {
  return description
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !INTERNAL_NOTE_PATTERN.test(sentence.trim()))
    .join(' ')
    .trim();
}

function stripEditionWord(label: string): string {
  return label.toLowerCase().replace(/\s*edition\s*/g, '').trim();
}

function resolveEditionImage(mockKit: PackageKit | undefined, editionLabel: string | null): string {
  if (!mockKit) return '';
  if (!editionLabel) return mockKit.imageUrl;
  const target = stripEditionWord(editionLabel);
  const matched = mockKit.editions?.find((edition) => stripEditionWord(edition.label) === target);
  return matched?.imageUrl ?? mockKit.imageUrl;
}

/**
 * Splits a Package row's name into a shared base name and an optional edition label, so rows like
 * "Traveler Kit - Khaki" / "Traveler Kit - Black" group into one displayed kit with two editions.
 * This is a naming convention the admin side needs to follow — rows without a recognized
 * separator are treated as a single kit with no edition toggle.
 */
function parseKitNameAndEdition(name: string): { baseName: string; editionLabel: string | null } {
  const match = name.match(/^(.*?)\s+[-–—]\s+(.+)$/);
  if (!match) return { baseName: name.trim(), editionLabel: null };
  return { baseName: match[1].trim(), editionLabel: match[2].trim() };
}

function groupPackageRows(rows: PackageRow[]): PackageKit[] {
  const groups = new Map<string, { baseName: string; entries: { row: PackageRow; editionLabel: string | null }[] }>();

  for (const row of rows) {
    const { baseName, editionLabel } = parseKitNameAndEdition(row.name);
    const key = baseName.toLowerCase();
    const group = groups.get(key) ?? { baseName, entries: [] };
    group.entries.push({ row, editionLabel });
    groups.set(key, group);
  }

  return Array.from(groups.values()).map(({ baseName, entries }) => {
    const primary = entries[0].row;
    const hasEditions = entries.length > 1 || entries[0].editionLabel !== null;
    const mockKit = KIT_BY_NAME.get(normalizeName(baseName));
    const editions: KitEdition[] | undefined = hasEditions
      ? entries.map(({ row, editionLabel }, index) => ({
          id: row.id,
          label: editionLabel ?? `Option ${index + 1}`,
          imageUrl: resolveEditionImage(mockKit, editionLabel),
        }))
      : undefined;

    return {
      id: primary.id,
      name: baseName,
      description: sanitizeDescription(primary.description ?? ''),
      depositAmount: centavosToPesos(primary.depositCentavos),
      pricing: {
        '48h': centavosToPesos(primary.price48hCentavos ?? 0),
        '72h': centavosToPesos(primary.price72hCentavos ?? primary.price48hCentavos ?? 0),
      },
      // Real Package rows don't carry a flat included-items list, pax range, or capacity yet
      // (that's PackageComponent, a separate relation we don't fetch yet) — enrich from the
      // name-matched mock kit, same stopgap as images/extras, so the group-size filter and
      // "what's included" checklist aren't blank for known kits.
      includedItems: mockKit?.includedItems ?? [],
      paxRange: mockKit?.paxRange ?? '',
      capacity: mockKit?.capacity ?? 0,
      imageUrl: editions?.[0]?.imageUrl ?? resolveEditionImage(mockKit, entries[0].editionLabel),
      editions,
      extras: EXTRAS_BY_KIT_NAME.get(normalizeName(baseName)) ?? [],
    } satisfies PackageKit;
  });
}

function mapGearRow(row: RentableGearRow): IndividualItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    pricing: {
      '48h': centavosToPesos(row.price48hCentavos),
      '72h': centavosToPesos(row.price72hCentavos),
    },
    depositAmount: centavosToPesos(row.depositCentavos),
    imageUrl: ITEM_IMAGE_BY_NAME.get(normalizeName(row.name)) ?? '',
  };
}

export async function fetchCatalogPackages(): Promise<PackageKit[]> {
  const { data, error } = await supabase
    .from('packages')
    .select('id,name,description,price48hCentavos,price72hCentavos,depositCentavos')
    .eq('isActive', true)
    .is('deletedAt', null);

  if (error) {
    console.warn('[supabaseCatalog] packages fetch failed, using mock fallback:', error.message);
    return mockPackages;
  }
  if (!data || data.length === 0) return mockPackages;
  return groupPackageRows(data as PackageRow[]);
}

export async function fetchCatalogItems(): Promise<IndividualItem[]> {
  const { data, error } = await supabase
    .from('rentable_gears')
    .select('id,name,category,price48hCentavos,price72hCentavos,depositCentavos')
    .eq('isActive', true)
    .is('deletedAt', null);

  if (error) {
    console.warn('[supabaseCatalog] rentable_gears fetch failed, using mock fallback:', error.message);
    return mockIndividualItems;
  }
  if (!data || data.length === 0) return mockIndividualItems;
  return (data as RentableGearRow[]).map(mapGearRow);
}

export async function fetchCatalogDestinations(): Promise<Destination[]> {
  const { data, error } = await supabase.from('destinations').select('id,name').eq('isActive', true);

  if (error) {
    console.warn('[supabaseCatalog] destinations fetch failed, using mock fallback:', error.message);
    return mockDestinations;
  }
  if (!data || data.length === 0) return mockDestinations;
  return (data as DestinationRow[]).map((row) => ({ id: row.id, name: row.name }));
}
