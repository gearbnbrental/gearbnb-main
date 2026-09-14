import type { BookableAddOn, BookableGearKind } from '../types/gearbnb';
import { fetchGearCatalogFromRms, type RmsCatalogAddOn, type RmsCatalogGearKind } from '../utils/rmsApi';

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
