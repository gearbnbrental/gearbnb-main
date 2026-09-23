import type { BookableAddOn, BookableGearKind, BookableGearVariant } from '../types/gearbnb';
import {
  fetchGearCatalogFromRms,
  type RmsCatalogAddOn,
  type RmsCatalogGearKind,
  type RmsCatalogGearVariant,
} from '../utils/rmsApi';

const centavosToPesos = (centavos: number) => centavos / 100;

function mapAddOn(addOn: RmsCatalogAddOn): BookableAddOn {
  return {
    role: addOn.role,
    category: addOn.category,
    brand: addOn.brand,
    model: addOn.model,
    name: addOn.name,
    pricing: {
      '48h': centavosToPesos(addOn.price48hCentavos),
      '72h': centavosToPesos(addOn.price72hCentavos),
    },
    extraPerDayPrice: centavosToPesos(addOn.extraPerDayCentavos),
    maxQuantity: addOn.maxQuantity,
    availableCount: addOn.availableCount,
    ...(addOn.description?.trim() ? { description: addOn.description.trim() } : {}),
  };
}

function mapGearVariant(kind: RmsCatalogGearKind, variant: RmsCatalogGearVariant): BookableGearVariant {
  const hasOwnPricing = variant.price48hCentavos !== undefined || variant.price72hCentavos !== undefined;
  return {
    color: variant.color,
    imageUrl: variant.imageUrl,
    quantity: variant.quantity,
    availableCount: variant.availableCount,
    canSelect: variant.canSelect,
    // The RMS only sends a price on a variant when it differs from the kind's, so a missing tier
    // falls back to the kind's own — never a fabricated ₱0.
    ...(hasOwnPricing
      ? {
          pricing: {
            '48h': centavosToPesos(variant.price48hCentavos ?? kind.price48hCentavos),
            '72h': centavosToPesos(variant.price72hCentavos ?? kind.price72hCentavos),
          },
        }
      : {}),
    ...(variant.extraPerDayCentavos !== undefined ? { extraPerDayPrice: centavosToPesos(variant.extraPerDayCentavos) } : {}),
    ...(variant.sizeCapacity?.trim() ? { sizeCapacity: variant.sizeCapacity.trim() } : {}),
    ...(variant.description?.trim() ? { description: variant.description.trim() } : {}),
    ...(variant.images && variant.images.length > 0 ? { images: variant.images } : {}),
  };
}

function mapGearKind(kind: RmsCatalogGearKind): BookableGearKind {
  return {
    category: kind.category,
    brand: kind.brand,
    model: kind.model,
    name: kind.name,
    pricing: {
      '48h': centavosToPesos(kind.price48hCentavos),
      '72h': centavosToPesos(kind.price72hCentavos),
    },
    extraPerDayPrice: centavosToPesos(kind.extraPerDayCentavos),
    quantity: kind.quantity,
    availableCount: kind.availableCount,
    canSelect: kind.canSelect,
    imageUrl: kind.imageUrl,
    freeAccessories: kind.freeAccessories,
    compatibleAddOns: kind.compatibleAddOns.map(mapAddOn),
    ...(kind.sizeCapacity?.trim() ? { sizeCapacity: kind.sizeCapacity.trim() } : {}),
    ...(kind.color?.trim() ? { kindColor: kind.color.trim() } : {}),
    ...(kind.description?.trim() ? { description: kind.description.trim() } : {}),
    ...(kind.images && kind.images.length > 0 ? { images: kind.images } : {}),
    // Only when the RMS actually reported more than one color — an older RMS (or a single-color
    // kind) leaves this off entirely and the catalog behaves exactly as before.
    ...(kind.variants && kind.variants.length > 1
      ? { variants: kind.variants.map((variant) => mapGearVariant(kind, variant)) }
      : {}),
  };
}

/**
 * Fetches the real Build Your Own gear catalog from the RMS. Deliberately no mock fallback —
 * unlike the package catalog's Supabase fetch, a failure here must propagate so the caller can
 * show a real error state, never silently substitute fake products a customer could book against.
 */
export async function fetchBookableGearCatalog(): Promise<BookableGearKind[]> {
  const { kinds } = await fetchGearCatalogFromRms();
  return kinds.map(mapGearKind);
}
