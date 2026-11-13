import type { BookableGearKind, BookableGearSelection } from '../types/gearbnb';

/**
 * Refreshes one gear line in the cart against the live catalog when the catalog reloads. The line
 * is dropped only when the product is no longer sold at all, or the RMS has no units of it. It is
 * NOT dropped, or cut down, just because none is free RIGHT NOW: the catalog snapshot only knows
 * "free today", and a unit rented today may be back before the customer's dates. Whether their
 * dates work is what the date-specific availability check decides (it shows the shortage, and the
 * submit-time check enforces it), so this keeps the customer's quantity, capped at the units that
 * exist. The refreshed line's own count never reads lower than what the customer has selected.
 */
export function reconcileGearLine(selection: BookableGearSelection, fresh: BookableGearKind | undefined): BookableGearSelection | undefined {
  if (!fresh) return undefined;
  const quantity = Math.min(selection.quantity, fresh.quantity);
  if (quantity <= 0) return undefined;
  // A Build Your Own line keeps the dates it was added for (the catalog knows nothing about them).
  const dates = selection.startDate !== undefined ? { startDate: selection.startDate, returnDate: selection.returnDate } : {};
  return { ...fresh, ...dates, quantity, availableCount: Math.max(fresh.availableCount, quantity) };
}
