import type { BookableGearKind } from '../types/gearbnb';

const keyOf = (k: { category: string; brand: string; model: string | null }) =>
  `${k.category.trim().toLowerCase()}|${k.brand.trim().toLowerCase()}|${(k.model ?? '').trim().toLowerCase()}`;

/**
 * Lays date-specific stock over the ordinary catalog: for every kind the dated catalog also has,
 * only the stock fields change (how many are free, whether it can be selected, per color, and each
 * add-on's count). Everything else (names, photos, prices, descriptions) stays exactly as the
 * ordinary catalog has it. A kind the dated catalog doesn't mention is left untouched, so this can
 * only ever refine what's shown, never remove a product.
 */
export function applyGearDateStock(kinds: readonly BookableGearKind[], dated: readonly BookableGearKind[]): BookableGearKind[] {
  const datedByKey = new Map(dated.map((kind) => [keyOf(kind), kind]));
  return kinds.map((kind) => {
    const fresh = datedByKey.get(keyOf(kind));
    if (!fresh) return kind;
    const freshVariants = new Map((fresh.variants ?? []).map((variant) => [variant.color.toLowerCase(), variant]));
    const freshAddOns = new Map(fresh.compatibleAddOns.map((addOn) => [keyOf(addOn), addOn]));
    return {
      ...kind,
      availableCount: fresh.availableCount,
      canSelect: fresh.canSelect,
      ...(kind.variants
        ? {
            variants: kind.variants.map((variant) => {
              const match = freshVariants.get(variant.color.toLowerCase());
              return match ? { ...variant, availableCount: match.availableCount, canSelect: match.canSelect } : variant;
            }),
          }
        : {}),
      compatibleAddOns: kind.compatibleAddOns.map((addOn) => {
        const match = freshAddOns.get(keyOf(addOn));
        return match ? { ...addOn, availableCount: match.availableCount } : addOn;
      }),
    };
  });
}
