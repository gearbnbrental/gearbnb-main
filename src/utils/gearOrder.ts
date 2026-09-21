import type { BookableGearKind } from '../types/gearbnb';

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

/** Category-specific sort key within a category; kinds of any other category all tie (so their RMS
 * order is kept). */
function withinCategoryRank(kind: BookableGearKind): number {
  const category = kind.category.trim().toLowerCase();
  if (category === 'tent') return tentRank(kind);
  if (category === 'bed') return bedRank(kind);
  return 0;
}

/**
 * Display-only ordering for the homepage and Build Your Own gear lists: Tents first (Mobi Garden >
 * Blackdog > Vidalido > Naturehike), Beds within their category smallest to largest, everything
 * else in the RMS's own order. Stable, so kinds that tie (e.g. two Double beds, or a kind's colors)
 * never reshuffle. Never applied to the catalog itself — package add-ons and the cart read the RMS
 * order unchanged.
 */
export function orderGearKinds(kinds: readonly BookableGearKind[]): BookableGearKind[] {
  const isTent = (kind: BookableGearKind) => kind.category.trim().toLowerCase() === 'tent';
  const byRank = (a: BookableGearKind, b: BookableGearKind) => withinCategoryRank(a) - withinCategoryRank(b);
  const tents = kinds.filter(isTent).sort(byRank);
  const rest = kinds.filter((kind) => !isTent(kind));
  // Only Beds are re-sorted among the rest, and only within their own slots: every other kind (and
  // the position of the Bed block itself) stays exactly where the RMS put it.
  const bedSlots = rest.map((kind, index) => (kind.category.trim().toLowerCase() === 'bed' ? index : -1)).filter((i) => i >= 0);
  const sortedBeds = bedSlots.map((i) => rest[i]).sort(byRank);
  const ordered = [...rest];
  bedSlots.forEach((slot, i) => {
    ordered[slot] = sortedBeds[i];
  });
  return [...tents, ...ordered];
}
