import { supabase } from '../supabase';
import type { IndividualItem, KitEdition, PackageKit } from '../types/gearbnb';
import { mockIndividualItems, mockPackages } from './mockData';

/** Raw shape of a row in the `packages` table (RMS Prisma schema, only the columns we use). */
interface PackageRow {
  id: string;
  packageNumber: string;
  name: string;
  description: string | null;
  price48hCentavos: number | null;
  price72hCentavos: number | null;
  /** Admin-configured rate charged per day beyond the 72h tier — see PackageKit.extraPerDayPrice.
   *  Null/0 means no rate has been configured yet (never a reason to invent one here). */
  extraPerDayCentavos: number | null;
  depositCentavos: number;
  /** Storage path (within the public "inventory-photos" bucket) of this package's admin-uploaded
   * image, or null when none has been set yet — see resolvePackageImageUrl. */
  imageStoragePath: string | null;
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

const centavosToPesos = (centavos: number) => centavos / 100;

/**
 * Real `packages.description` rows have carried raw internal notes straight through to
 * customers (e.g. "Note: the flyer's 6-person tent has no product photo yet..."). That text
 * has to be fixed at the source in the admin database — this is just a defensive filter so an
 * admin typo doesn't ship to the live site, stripping sentences that read as internal remarks.
 * This sanitizes the row's own value; it never pulls in text from anywhere else.
 */
const INTERNAL_NOTE_PATTERN = /^(note|internal|todo|fixme|dev note|staff note|admin note)\s*:/i;

function sanitizeDescription(description: string): string {
  return description
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !INTERNAL_NOTE_PATTERN.test(sentence.trim()))
    .join(' ')
    .trim();
}

/**
 * Client rule: the internal brand value "Generic" must never appear on the customer-facing site
 * (e.g. real row name "Generic Big Cooking Set" → display "Big Cooking Set"). This strips it from
 * the row's own name string — it does not look up or borrow a name from anywhere else. If the
 * real schema actually stores brand as its own column separate from name, this regex is the
 * wrong fix; see the audit notes handed back to the client for that open question.
 */
function stripGenericBrand(name: string): string {
  return name.replace(/^generic\s+/i, '').trim();
}

/**
 * Resolves a package's admin-uploaded image to a real, publicly-fetchable URL, using the same
 * public "inventory-photos" bucket the RMS's own gear-image flow already uses (see
 * fetchBookableGearCatalog's imageUrl, sourced server-side from the same bucket) — never a new
 * bucket, and getPublicUrl needs no auth since the bucket is already public. Returns '' (not a
 * fabricated placeholder path) when there's no path to resolve, matching the "empty string → the
 * UI's own placeholder icon" convention every image-bearing component here already follows
 * (Cart's Thumbnail, PackageCard, GearDetailsModal — all check `!displayImage` themselves).
 */
function resolvePackageImageUrl(imageStoragePath: string | null): string {
  if (!imageStoragePath) return '';
  return supabase.storage.from('inventory-photos').getPublicUrl(imageStoragePath).data.publicUrl;
}

/**
 * Splits a Package row's name into a shared base name and an optional edition label, so rows like
 * "Traveler Kit - Khaki" or "Traveler Kit (Khaki)" group into one displayed kit with two editions.
 * Both separator conventions are accepted since the admin side's naming has used either at
 * different times. This only ever reads the real row's own name — it never merges in a second
 * data source. Rows without a recognized separator are treated as a single kit, no edition toggle.
 */
function parseKitNameAndEdition(name: string): { baseName: string; editionLabel: string | null } {
  const parenMatch = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) return { baseName: parenMatch[1].trim(), editionLabel: parenMatch[2].trim() };

  const dashMatch = name.match(/^(.*?)\s+[-–—]\s+(.+)$/);
  if (dashMatch) return { baseName: dashMatch[1].trim(), editionLabel: dashMatch[2].trim() };

  return { baseName: name.trim(), editionLabel: null };
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
    const editions: KitEdition[] | undefined = hasEditions
      ? entries.map(({ row, editionLabel }, index) => ({
          id: row.id,
          label: editionLabel ?? `Option ${index + 1}`,
          // Each edition is its own real Package row (see packageNumber's own comment above), so
          // it's resolved from that specific row's own imageStoragePath — never borrowed from the
          // primary/first entry, since a Black and a Khaki edition can have different photos.
          imageUrl: resolvePackageImageUrl(row.imageStoragePath),
          packageNumber: row.packageNumber,
        }))
      : undefined;

    return {
      id: primary.id,
      packageNumber: primary.packageNumber,
      name: stripGenericBrand(baseName),
      description: sanitizeDescription(primary.description ?? ''),
      depositAmount: centavosToPesos(primary.depositCentavos),
      pricing: {
        '48h': centavosToPesos(primary.price48hCentavos ?? 0),
        '72h': centavosToPesos(primary.price72hCentavos ?? primary.price48hCentavos ?? 0),
      },
      extraPerDayPrice: centavosToPesos(primary.extraPerDayCentavos ?? 0),
      // includedItems, paxRange, capacity, extras, and isOutOfStock have no columns/relations on
      // the real `packages` table yet (see audit notes). Left as honest empty/neutral defaults —
      // deliberately NOT backfilled from mock data by name-matching, since that would silently
      // fabricate inventory truth (e.g. stock status) the admin database doesn't actually assert.
      includedItems: [],
      paxRange: '',
      capacity: 0,
      imageUrl: resolvePackageImageUrl(primary.imageStoragePath),
      editions,
      extras: [],
      isOutOfStock: false,
    } satisfies PackageKit;
  });
}

function mapGearRow(row: RentableGearRow): IndividualItem {
  return {
    id: row.id,
    name: stripGenericBrand(row.name),
    category: row.category,
    pricing: {
      '48h': centavosToPesos(row.price48hCentavos),
      '72h': centavosToPesos(row.price72hCentavos),
    },
    depositAmount: centavosToPesos(row.depositCentavos),
    // imageUrl, isOutOfStock, includedAccessories, and paidAddOns have no columns/relations on
    // the real `rentable_gears` table yet (see audit notes). Left as honest empty/neutral
    // defaults, not backfilled from mock data by name-matching — same reasoning as packages above.
    imageUrl: '',
    isOutOfStock: false,
    includedAccessories: [],
    paidAddOns: [],
  };
}

export async function fetchCatalogPackages(): Promise<PackageKit[]> {
  const { data, error } = await supabase
    .from('packages')
    .select(
      'id,packageNumber,name,description,price48hCentavos,price72hCentavos,extraPerDayCentavos,depositCentavos,imageStoragePath',
    )
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
