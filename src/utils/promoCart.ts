import {
  byoGearKey,
  filterCartToSelection,
  getGearKindPrice,
  getKitPrice,
} from '../context/RentalContext';
import type { CartState } from '../types/gearbnb';
import { toAvailabilityTimestamp } from './duration';
import { PACKAGES_SCOPE_KEY, pesosToCentavos, scopeKeyForCategory, type PromoLine } from './promo';

/**
 * The promo lines for what's checked for checkout, priced for the chosen duration with the same
 * helpers the cart and checkout already use (getKitPrice/getGearKindPrice). Packages are one
 * "PACKAGES" line each; package extras, Build Your Own gear and BYO add-ons are each priced by
 * their own category. Legacy individual items and kit extras are never covered and are left out.
 */
export function promoLinesForCart(cart: CartState): PromoLine[] {
  const selected = filterCartToSelection(cart);
  const trip = selected.tripDetails;
  const gearLine = (gear: { category: string; pricing: { '48h': number; '72h': number }; extraPerDayPrice: number; quantity: number }): PromoLine => ({
    scopeKey: scopeKeyForCategory(gear.category),
    unitPriceCentavos: pesosToCentavos(getGearKindPrice(gear, trip)),
    quantity: gear.quantity,
  });

  return [
    ...selected.selectedKits.map((kit): PromoLine => ({
      scopeKey: PACKAGES_SCOPE_KEY,
      unitPriceCentavos: pesosToCentavos(getKitPrice(kit, trip)),
      quantity: 1,
    })),
    ...selected.selectedKits.flatMap((kit) => (selected.packageAddOns[kit.id] ?? []).map(gearLine)),
    ...selected.byoGears.map(gearLine),
    ...selected.byoGears.flatMap((gear) => (selected.byoAddOns[byoGearKey(gear)] ?? []).map(gearLine)),
  ];
}

/** The pickup instant the promo's rental window is checked against, or null with no start date.
 *  Same construction as the availability check and the quote (midnight until a preferred time is
 *  chosen), so the site and the RMS compare the same instant. */
export function promoPickupAt(trip: { startDate: string; preferredTime: string }): string | null {
  return trip.startDate ? toAvailabilityTimestamp(trip.startDate, trip.preferredTime) : null;
}
