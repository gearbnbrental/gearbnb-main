import { supabase } from '../supabase';
import type { RmsCatalogPackage } from '../utils/rmsApi';
import type { IndividualItem, KitEdition, PackageComponent, PackageKit } from '../types/gearbnb';

/** Raw shape of a row in the `packages` table (RMS Prisma schema, only the columns we use). */
export interface PackageRow {
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
  /** Non-nullable on the real schema (Package.basePriceCentavos) — the price this package falls
   * back to whenever price48hCentavos/price72hCentavos is null, i.e. an admin hasn't configured a
   * duration-specific override yet. See resolvePackagePricing, which mirrors the exact same
   * fallback RMS's own customer catalog endpoint applies server-side. */
  basePriceCentavos: number;
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
 * A real Package row's price48hCentavos/price72hCentavos can be null — an admin hasn't configured
 * a duration-specific override yet — in which case this falls back to the row's own
 * basePriceCentavos (never nullable on the real schema), never a fabricated ₱0. Mirrors, field for
 * field, the exact fallback RMS's own customer catalog service performs server-side
 * (`pkg.price48hCentavos ?? pkg.basePriceCentavos`, confirmed in src/server/catalog/service.ts) —
 * not a fallback invented here, just the same real RMS business rule applied to the same raw
 * columns Main reads directly from Supabase.
 */
function resolvePackagePricing(row: PackageRow): { '48h': number; '72h': number } {
  return {
    '48h': centavosToPesos(row.price48hCentavos ?? row.basePriceCentavos),
    '72h': centavosToPesos(row.price72hCentavos ?? row.basePriceCentavos),
  };
}

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

export function groupPackageRows(rows: PackageRow[]): PackageKit[] {
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
          // Each edition's OWN price/deposit — never the primary/first entry's, since two editions
          // of the same kit are independent real Package rows and RMS allows them to be priced
          // differently (see KitEdition's own doc comment). isOutOfStock starts false here, same as
          // the kit-level default below; applyPackageSelectability fills in the real per-edition
          // value from RMS's own canSelect once that fetch resolves.
          pricing: resolvePackagePricing(row),
          depositAmount: centavosToPesos(row.depositCentavos),
          extraPerDayPrice: centavosToPesos(row.extraPerDayCentavos ?? 0),
          description: sanitizeDescription(row.description ?? ''),
          isOutOfStock: false,
        }))
      : undefined;

    return {
      id: primary.id,
      packageNumber: primary.packageNumber,
      name: stripGenericBrand(baseName),
      description: sanitizeDescription(primary.description ?? ''),
      depositAmount: centavosToPesos(primary.depositCentavos),
      pricing: resolvePackagePricing(primary),
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

/**
 * RMS/Supabase is the authoritative source for the real package catalog — this never falls back
 * to mock/demo data on a failure. A failed or errored fetch throws, so the caller (CatalogContext)
 * can show a genuine loading/error/empty state instead of silently substituting fictional
 * packages a customer could select and attempt to book. An empty, successful result (the table
 * genuinely has zero active packages right now) is NOT an error — it's a legitimate real answer,
 * returned as `[]` rather than thrown.
 */
export async function fetchCatalogPackages(): Promise<PackageKit[]> {
  const { data, error } = await supabase
    .from('packages')
    .select(
      'id,packageNumber,name,description,price48hCentavos,price72hCentavos,extraPerDayCentavos,depositCentavos,basePriceCentavos,imageStoragePath',
    )
    .eq('isActive', true)
    .is('deletedAt', null);

  if (error) {
    throw new Error(`[supabaseCatalog] packages fetch failed: ${error.message}`);
  }
  if (!data || data.length === 0) return [];
  return groupPackageRows(data as PackageRow[]);
}

/** Same authoritative-only contract as fetchCatalogPackages above — see its own doc comment. */
export async function fetchCatalogItems(): Promise<IndividualItem[]> {
  const { data, error } = await supabase
    .from('rentable_gears')
    .select('id,name,category,price48hCentavos,price72hCentavos,depositCentavos')
    .eq('isActive', true)
    .is('deletedAt', null);

  if (error) {
    throw new Error(`[supabaseCatalog] rentable_gears fetch failed: ${error.message}`);
  }
  if (!data || data.length === 0) return [];
  return (data as RentableGearRow[]).map(mapGearRow);
}

/**
 * Enriches an already-built `PackageKit[]` (from fetchCatalogPackages, sourced from Supabase) with
 * the one real signal Supabase's own `packages` table has no equivalent for: RMS's own `canSelect`
 * — whether every component this package needs currently has enough live stock, from the RMS
 * catalog endpoint (GET /api/customer/catalog/packages, see RmsCatalogPackage's own doc comment).
 * Matched by `packageNumber`, the one identifier both sources share for the same real Package row —
 * both a kit's own `packageNumber` (the first/primary edition) and each of its `editions[].
 * packageNumber` are looked up independently, since two editions of the same kit can have
 * genuinely different stock (see KitEdition.isOutOfStock's own doc comment). A packageNumber RMS
 * doesn't currently report (e.g. a transient mismatch between the two sources) is left at its
 * existing value rather than guessed — this is purely additive, never a reason to mark a package
 * unselectable Main has no real signal for.
 */
export function applyPackageSelectability(kits: PackageKit[], rmsPackages: RmsCatalogPackage[]): PackageKit[] {
  const rmsPackageByNumber = new Map(rmsPackages.map((pkg) => [pkg.packageNumber, pkg]));

  // Bare pass-through — RmsCatalogPackageComponent and PackageComponent are already the exact
  // same shape; this only exists so a future field on one side doesn't silently leak onto the
  // other without a deliberate decision.
  const toPackageComponents = (components: RmsCatalogPackage['components']): PackageComponent[] =>
    components.map((c) => ({ category: c.category, brand: c.brand, model: c.model, name: c.name, color: c.color ?? null, quantity: c.quantity, availableCount: c.availableCount }));

  return kits.map((kit) => {
    const rmsPackage = rmsPackageByNumber.get(kit.packageNumber);
    return {
      ...kit,
      isOutOfStock: rmsPackage === undefined ? kit.isOutOfStock : !rmsPackage.canSelect,
      components: rmsPackage ? toPackageComponents(rmsPackage.components) : kit.components,
      images: rmsPackage?.images && rmsPackage.images.length > 0 ? rmsPackage.images : kit.images,
      editions: kit.editions?.map((edition) => {
        const rmsEdition = rmsPackageByNumber.get(edition.packageNumber);
        return {
          ...edition,
          isOutOfStock: rmsEdition === undefined ? edition.isOutOfStock : !rmsEdition.canSelect,
          components: rmsEdition ? toPackageComponents(rmsEdition.components) : edition.components,
          images: rmsEdition?.images && rmsEdition.images.length > 0 ? rmsEdition.images : edition.images,
        };
      }),
    };
  });
}
