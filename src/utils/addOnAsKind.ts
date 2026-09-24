import type { BookableAddOn, BookableGearKind } from '../types/gearbnb';

/**
 * Display-only adapter: lets the "View Details" popup built for a gear kind (GearDetailsDialog)
 * also show a compatible add-on's own details (e.g. "Vidalido Extra Canopy Poles"), without a
 * second, near-duplicate dialog component. Never used for the add-on's real cart/booking identity
 * — the caller still reads/writes the add-on's own quantity and onChange handler directly; this
 * only reshapes its DISPLAY fields into the same shape GearDetailsDialog already knows how to
 * render. An add-on has no free accessories and no add-ons of its own, so those are
 * honest empty defaults, never fabricated.
 */
export function addOnAsGearKind(addOn: BookableAddOn): BookableGearKind {
  return {
    category: addOn.category,
    brand: addOn.brand,
    model: addOn.model,
    name: addOn.name,
    pricing: addOn.pricing,
    extraPerDayPrice: addOn.extraPerDayPrice,
    quantity: addOn.maxQuantity,
    availableCount: addOn.availableCount,
    canSelect: addOn.availableCount > 0,
    imageUrl: addOn.imageUrl ?? null,
    freeAccessories: [],
    compatibleAddOns: [],
    ...(addOn.description ? { description: addOn.description } : {}),
    ...(addOn.images && addOn.images.length > 0 ? { images: addOn.images } : {}),
  };
}
