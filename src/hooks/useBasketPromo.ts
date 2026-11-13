import { useMemo } from 'react';
import { usePromo } from '../context/PromoContext';
import { useRental } from '../context/RentalContext';
import { evaluateBasketPromo, type BasketPromoState } from '../utils/promo';
import { promoLinesForCart, promoPickupAt } from '../utils/promoCart';

/**
 * The promo state for what's currently checked for checkout, recomputed whenever the cart, the
 * dates, the duration or the promo itself changes, so every screen shows the same numbers.
 */
export function useBasketPromo(): BasketPromoState {
  const { promo, eligibleForYou, audience, nowMs } = usePromo();
  const { cart } = useRental();
  return useMemo(() => {
    if (!promo || !audience) return { kind: 'hidden' };
    return evaluateBasketPromo(promo, eligibleForYou, promoLinesForCart(cart), promoPickupAt(cart.tripDetails), nowMs);
  }, [promo, eligibleForYou, audience, nowMs, cart]);
}
