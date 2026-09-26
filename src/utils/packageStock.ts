import type { BookableAddOnSelection, BookableGearKind, BookableGearSelection, PackageComponent, PackageKit } from '../types/gearbnb';

/** One draw on the catalog's stock: `quantity` units of a kind, in a specific color when known. */
export interface StockUse {
  category: string;
  brand: string;
  model: string | null;
  color?: string | null;
  quantity: number;
}

// The RMS blanks a "Generic" brand to "" for customers, so treat the two as the same brand.
const brandOf = (brand: string) => (brand.trim().toLowerCase() === 'generic' ? '' : brand.trim().toLowerCase());
const keyOf = (k: { category: string; brand: string; model: string | null }) =>
  `${k.category.trim().toLowerCase()}|${brandOf(k.brand)}|${(k.model ?? '').trim().toLowerCase()}`;
const sameColor = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Takes stock that is already spoken for off the catalog, so a list of extras never offers a unit
 * that a package (or another line in the cart) will use. Per kind:
 *  - the kind's total always loses every matching use;
 *  - when a use names a color and the kind has that color as a variant, that variant loses it too;
 *  - a use with no color only touches the total (with several colors it's ambiguous which one the
 *    RMS will pick, so it never guesses one, and the availability check has the final say).
 * Nothing goes below 0, and a kind or variant left at 0 can no longer be selected.
 */
export function subtractStock(kinds: readonly BookableGearKind[], uses: readonly StockUse[]): BookableGearKind[] {
  const byKind = new Map<string, StockUse[]>();
  for (const use of uses) {
    if (use.quantity <= 0) continue;
    const key = keyOf(use);
    byKind.set(key, [...(byKind.get(key) ?? []), use]);
  }
  return kinds.map((kind) => {
    const matching = byKind.get(keyOf(kind));
    if (!matching) return kind;
    const used = matching.reduce((sum, use) => sum + use.quantity, 0);
    const availableCount = Math.max(0, kind.availableCount - used);
    return {
      ...kind,
      availableCount,
      canSelect: kind.canSelect && availableCount > 0,
      ...(kind.variants
        ? {
            variants: kind.variants.map((variant) => {
              const variantUsed = matching.filter((use) => sameColor(use.color, variant.color)).reduce((sum, use) => sum + use.quantity, 0);
              if (variantUsed === 0) return variant;
              const left = Math.max(0, variant.availableCount - variantUsed);
              return { ...variant, availableCount: left, canSelect: variant.canSelect && left > 0 };
            }),
          }
        : {}),
    };
  });
}

/** A cart package's real components: looked up in the catalog by the cart kit's id (a color
 *  edition's own list when the id is an edition's), since the cart's copy can carry the base kit's. */
export function componentsForCartKit(catalogKits: readonly PackageKit[], cartKit: { id: string; components?: PackageComponent[] }): PackageComponent[] {
  for (const kit of catalogKits) {
    if (kit.id === cartKit.id) return kit.components ?? [];
    for (const edition of kit.editions ?? []) if (edition.id === cartKit.id) return edition.components ?? kit.components ?? [];
  }
  return cartKit.components ?? [];
}

/**
 * Everything already drawing on stock in the cart: each package's components (once per copy of that
 * package in the cart), plus any Build Your Own gear lines and their add-ons, which come out of the
 * same inventory. `exceptKitAddOns` is left out on purpose: the extras list being shown IS that
 * selection, and a row must not subtract its own quantity from itself.
 */
export function cartStockUses(
  catalogKits: readonly PackageKit[],
  cart: { selectedKits: readonly PackageKit[]; byoGears: readonly BookableGearSelection[]; byoAddOns: Record<string, readonly BookableAddOnSelection[]> },
): StockUse[] {
  const uses: StockUse[] = [];
  for (const cartKit of cart.selectedKits) {
    for (const component of componentsForCartKit(catalogKits, cartKit)) {
      uses.push({ category: component.category, brand: component.brand, model: component.model, color: component.color, quantity: component.quantity });
    }
  }
  for (const gear of cart.byoGears) {
    uses.push({ category: gear.category, brand: gear.brand, model: gear.model, color: gear.color, quantity: gear.quantity });
  }
  for (const addOns of Object.values(cart.byoAddOns)) {
    for (const addOn of addOns) uses.push({ category: addOn.category, brand: addOn.brand, model: addOn.model, quantity: addOn.quantity });
  }
  return uses;
}
