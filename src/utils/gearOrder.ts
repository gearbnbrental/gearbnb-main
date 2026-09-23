import type { BookableGearKind, PackageKit } from '../types/gearbnb';

/** Tent display order (by brand): Mobi Garden > Blackdog > Vidalido > Naturehike. A brand not listed
 * here goes after these, in the RMS's own order. */
const TENT_BRAND_ORDER = ['mobi garden', 'blackdog', 'vidalido', 'naturehike'];

/** Bed display order, smallest to largest: Single > Double-Sized > Low King-Sized (20cm) > High
 * King-Sized (40cm). Anything unrecognised goes after these, in the RMS's own order. */
function bedRank(kind: BookableGearKind): number {
  const text = `${kind.model ?? ''} ${kind.name}`.toLowerCase();
  if (text.includes('single')) return 0;
  if (text.includes('double')) return 1;
  if (text.includes('king')) {
    if (/\b(low|20\s*cm)\b/.test(text)) return 2;
    if (/\b(high|40\s*cm)\b/.test(text)) return 3;
    return 3;
  }
  return 4;
}

function tentRank(kind: BookableGearKind): number {
  const index = TENT_BRAND_ORDER.indexOf(kind.brand.trim().toLowerCase());
  return index === -1 ? TENT_BRAND_ORDER.length : index;
}

/** Matches `keywords` (in order) against a kind's own NAME — never just its model — since brand is
 *  sometimes the only thing telling two otherwise-identically-modelled kinds apart (e.g. "Gazlite
 *  Portable Stove" vs "Ultra-light Portable Stove" share no model text at all, only their full
 *  names differ). Anything unrecognised sorts after every listed keyword, in the RMS's own order. */
function nameKeywordRank(kind: BookableGearKind, keywords: string[]): number {
  const name = kind.name.toLowerCase();
  const index = keywords.findIndex((keyword) => name.includes(keyword));
  return index === -1 ? keywords.length : index;
}

/** Camping Chair display order: Ultra-light Chair > Moon Chair > Kermit Chair. */
const CHAIR_NAME_ORDER = ['ultra-light chair', 'moon chair', 'kermit chair'];

/** Camping Table display order, smallest to largest: Small Table > Large Table > Extra-Long
 * Table. */
const TABLE_NAME_ORDER = ['small table', 'large table', 'extra-long table'];

/** Cooking display order: Ultra-light Portable Stove > Gazlite Portable Stove > Big Cooking Set >
 * Butane Can > Gazlite LPG Can. */
const COOKING_NAME_ORDER = ['ultra-light portable stove', 'gazlite portable stove', 'big cooking set', 'butane can', 'gazlite lpg can'];

/** Category-specific sort key within a category; kinds of any other category all tie (so their RMS
 * order is kept). */
function withinCategoryRank(kind: BookableGearKind): number {
  const category = kind.category.trim().toLowerCase();
  if (category === 'tent') return tentRank(kind);
  if (category === 'bed') return bedRank(kind);
  if (category === 'camping chair') return nameKeywordRank(kind, CHAIR_NAME_ORDER);
  if (category === 'camping table') return nameKeywordRank(kind, TABLE_NAME_ORDER);
  if (category === 'cooking') return nameKeywordRank(kind, COOKING_NAME_ORDER);
  return 0;
}

/**
 * Re-sorts every kind within its OWN category's existing slots — never moves a kind to a different
 * position in the category sequence itself, and never changes which categories exist or their
 * relative order (so a page's own category tabs, built from first-appearance order, are completely
 * unaffected). A category with no rank rule above (Cooler, Lights, Fan, Other Gear Essentials, ...)
 * simply ties at rank 0 for every kind in it, so `.sort` (stable, per spec) leaves the RMS's own
 * order untouched there. Shared by orderGearKinds below (the homepage/BYO catalog, which ALSO pulls
 * Tents to the very front) and, unmodified, by PathACatalog's PackageAddOnsSection — Tents there
 * stay wherever the RMS's category order already put them, only sorted among themselves.
 */
export function sortGearKindsWithinCategories(kinds: readonly BookableGearKind[]): BookableGearKind[] {
  const slotsByCategory = new Map<string, number[]>();
  kinds.forEach((kind, index) => {
    const category = kind.category.trim().toLowerCase();
    const slots = slotsByCategory.get(category);
    if (slots) slots.push(index);
    else slotsByCategory.set(category, [index]);
  });

  const ordered = [...kinds];
  for (const slots of slotsByCategory.values()) {
    const sorted = slots.map((i) => kinds[i]).sort((a, b) => withinCategoryRank(a) - withinCategoryRank(b));
    slots.forEach((slot, i) => {
      ordered[slot] = sorted[i];
    });
  }
  return ordered;
}

/**
 * Display-only ordering for the homepage and Build Your Own gear lists: Tents first (Mobi Garden >
 * Blackdog > Vidalido > Naturehike, sorted among themselves), then every other kind re-sorted
 * within its own category (see sortGearKindsWithinCategories) — Beds, Camping Chairs, Camping
 * Tables and Cooking gear each get their own real ordering there; anything else keeps the RMS's own
 * order. Never applied to the catalog itself — the cart reads the RMS order unchanged.
 */
export function orderGearKinds(kinds: readonly BookableGearKind[]): BookableGearKind[] {
  const isTent = (kind: BookableGearKind) => kind.category.trim().toLowerCase() === 'tent';
  const tents = kinds.filter(isTent).sort((a, b) => tentRank(a) - tentRank(b));
  const rest = kinds.filter((kind) => !isTent(kind));
  return [...tents, ...sortGearKindsWithinCategories(rest)];
}

/** Package display order, smallest to largest: Nomad > Stargazer > Base Camper > Traveler. Matched
 * on the package's name; anything unrecognised goes after these, in the RMS's own order. */
const PACKAGE_NAME_ORDER = ['nomad', 'stargazer', 'base camper', 'traveler'];

function packageRank(kit: PackageKit): number {
  const name = kit.name.toLowerCase();
  const index = PACKAGE_NAME_ORDER.findIndex((keyword) => name.includes(keyword));
  return index === -1 ? PACKAGE_NAME_ORDER.length : index;
}

/** Display-only package ordering (stable, does not mutate the input). Kits whose colors are
 * editions of one kit (Base Camper Black/Khaki) are already a single entry by this point. */
export function orderPackageKits(kits: readonly PackageKit[]): PackageKit[] {
  return [...kits].sort((a, b) => packageRank(a) - packageRank(b));
}
