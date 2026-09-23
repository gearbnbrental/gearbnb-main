import type { BookableGearKind, PackageKit } from '../types/gearbnb';

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const titleCase = (value: string) => value.trim().charAt(0).toUpperCase() + value.trim().slice(1).toLowerCase();
const uniqueSorted = (colors: string[]) =>
  Array.from(new Map(colors.filter((c) => c.trim()).map((c) => [c.trim().toLowerCase(), titleCase(c)])).values()).sort();

/** The only gear categories the Build Your Own color switch applies to (matched on the category
 * name, so "Camping Table"/"Camping Chair" count). Everything else — Cooking, Lights, Other Gear
 * Essentials... — gets no switch and is never filtered or recolored by it. */
const COLOR_FILTER_CATEGORIES = ['tent', 'bed', 'table', 'chair'];

export function supportsColorFilter(kind: Pick<BookableGearKind, 'category'>): boolean {
  const category = kind.category.trim().toLowerCase();
  return COLOR_FILTER_CATEGORIES.some((keyword) => category.includes(keyword));
}

/** Colors on offer across a list of gear kinds: every variant color plus the one color of any
 * single-color kind the RMS reported (`kindColor`). Kinds with no color info add nothing. */
export function gearColorOptions(kinds: readonly BookableGearKind[]): string[] {
  return uniqueSorted(kinds.flatMap((kind) => [...(kind.variants ?? []).map((v) => v.color), ...(kind.kindColor ? [kind.kindColor] : [])]));
}

/** Strict color filter: only gear that really comes in `color`. A multi-color kind must have that
 * color; a single-color kind must be that color. Gear whose color the RMS doesn't report at all is
 * kept (it can't be classified), so a missing color never makes a product unrentable. */
export function filterGearByColor(kinds: readonly BookableGearKind[], color: string): BookableGearKind[] {
  return kinds.filter((kind) => {
    if (kind.variants && kind.variants.length > 0) return kind.variants.some((v) => same(v.color, color));
    if (kind.kindColor) return same(kind.kindColor, color);
    return true;
  });
}

/** Colors on offer across packages: every edition label ("BLACK" -> "Black"), including a package
 * sold in only one color. A package's color comes from its RMS name, "(BLACK)" / "(KHAKI)". */
export function packageColorOptions(kits: readonly PackageKit[]): string[] {
  return uniqueSorted(kits.flatMap((kit) => (kit.editions ?? []).map((edition) => edition.label)));
}

/** Strict color filter for packages: a package with editions must have the chosen color (so the
 * Black-only Nomad and Stargazer Kits are hidden under Khaki, and the Khaki-only Traveler Kit under
 * Black). A package with no editions has no color info and is kept, so a missing color never makes
 * it unbookable. */
export function filterPackagesByColor(kits: readonly PackageKit[], color: string): PackageKit[] {
  return kits.filter((kit) => !kit.editions || kit.editions.length === 0 || kit.editions.some((e) => same(e.label, color)));
}
