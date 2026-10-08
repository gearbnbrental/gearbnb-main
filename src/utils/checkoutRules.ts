import type { CartState } from '../types/gearbnb';

/**
 * Why the items checked for checkout can't go through as one online booking, or null when they
 * can. Shared by the Cart (which stops the customer before they start filling in checkout) and the
 * checkout itself (the final guard), so the two can never disagree. `cart` must already be
 * narrowed to what's checked (filterCartToSelection). Nothing is removed for the customer: they
 * uncheck or remove the item themselves, and anything unchecked stays in the cart.
 *
 * A booking is either one Package (optionally with extra gear added to it) or a Build Your Own
 * selection, never both: the RMS accepts one or the other per booking.
 */
export function checkoutBlocker(cart: Pick<CartState, 'selectedKits' | 'selectedItems' | 'byoGears' | 'kitExtras'>): string | null {
  const hasPackage = cart.selectedKits.length > 0;
  const hasByoGear = cart.byoGears.length > 0;
  const hasKitExtras = Object.values(cart.kitExtras).some((ids) => ids.length > 0);

  if (cart.selectedItems.length > 0) {
    return "Some gear in your cart was added the old way and can't be booked online. Please remove it, or add it again through Build Your Own.";
  }
  if (hasPackage && hasByoGear) {
    return 'A booking can be a Package or Build Your Own, not both. Uncheck one to continue, the other stays in your cart so you can book it separately.';
  }
  if (cart.selectedKits.length > 1) {
    return 'You can book one package at a time. Uncheck the extra package to continue, it stays in your cart for another booking.';
  }
  if (hasPackage && hasKitExtras) {
    return "Package extras added the old way can't be booked online yet. Please remove them, or message us and we'll add them to your booking.";
  }
  return null;
}
