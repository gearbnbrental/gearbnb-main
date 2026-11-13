import type { BookableGearKind, PackageKit } from '../types/gearbnb';
import { cleanGearName } from './gearName';

/**
 * Each package and Build Your Own gear kind has its own address, e.g.
 * /catalog/camping-packages/stargazer-kit or /catalog/build-your-own/mobi-garden-backpacking-tent.
 * The slug comes from the name customers see: no leading "The", no color edition, no "(40cm)".
 * Renaming a product in the RMS changes its address.
 */
export const PACKAGES_PATH = '/catalog/camping-packages';
export const BUILD_YOUR_OWN_PATH = '/catalog/build-your-own';

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "The Base Camper Kit (KHAKI)" -> "base-camper-kit". */
export function packageSlug(kit: Pick<PackageKit, 'name'>): string {
  return slugify(kit.name.replace(/\s*\([^)]*\)\s*$/, '').replace(/^the\s+/i, ''));
}

/** "Mountainhiker King-Sized High Bed (40cm) (Black)" -> "mountainhiker-king-sized-high-bed". */
export function gearSlug(kind: Pick<BookableGearKind, 'name'>): string {
  return slugify(cleanGearName(kind.name));
}

export const packagePath = (kit: Pick<PackageKit, 'name'>) => `${PACKAGES_PATH}/${packageSlug(kit)}`;
export const gearPath = (kind: Pick<BookableGearKind, 'name'>) => `${BUILD_YOUR_OWN_PATH}/${gearSlug(kind)}`;

/** The product an address points at, or null. The first product wins if two names ever share a slug. */
export function findBySlug<T>(products: readonly T[], slug: string | undefined, slugOf: (product: T) => string): T | null {
  if (!slug) return null;
  return products.find((product) => slugOf(product) === slug) ?? null;
}
