import { PROMO_COPY } from '../config/promoCopy';
import {
  basketDiscountCentavos,
  formatCentavos,
  formatPromoOffer,
  gearUnitSavingCentavos,
  pesosToCentavos,
  promoPercentLabel,
  scopeKeyForCategory,
  type BasketPromoState,
} from './promo';
import type { RmsPromoQuote, RmsPublicPromo } from './rmsApi';

export function discountLabel(state: BasketPromoState): string {
  return state.kind !== 'hidden' && state.audience === 'everyone' ? PROMO_COPY.discountLineEveryone : PROMO_COPY.discountLine;
}

/** The rental fee after the basket's discount, in pesos (the normal fee when nothing applies).
 *  Never below zero. The security deposit is never part of this. */
export function rentalFeeAfterDiscount(normalPesos: number, state: BasketPromoState): number {
  return Math.max(0, pesosToCentavos(normalPesos) - basketDiscountCentavos(state)) / 100;
}

/**
 * What the checkout shows (and reports) as the booking's saving. The RMS quote is the truth when
 * it answered: only an applied quote for an eligible customer (or a promo for everyone) counts.
 * If the quote failed, the browse-time math is shown as a labelled estimate, and only when that
 * math says the discount is unlocked. While the quote is loading, nothing is claimed yet.
 */
export type CheckoutSaving =
  | { kind: 'none' }
  | { kind: 'confirmed'; centavos: number; label: string | null; promo: RmsPublicPromo }
  | { kind: 'estimate'; centavos: number; promo: RmsPublicPromo }
  | { kind: 'sign-in'; centavos: number; promo: RmsPublicPromo }
  | { kind: 'below-minimum'; remainingCentavos: number };

export function decideCheckoutSaving(
  basket: BasketPromoState,
  quote: { status: 'idle' | 'loading' | 'error' } | { status: 'success'; quote: RmsPromoQuote },
  signedIn = false,
): CheckoutSaving {
  if (basket.kind === 'hidden') return { kind: 'none' };
  if (quote.status === 'success') {
    const q = quote.quote;
    if (q.applied && q.discountCentavos > 0 && (q.eligibility === 'ELIGIBLE' || q.eligibility === 'NOT_REQUIRED')) {
      return { kind: 'confirmed', centavos: q.discountCentavos, label: q.offerLabel, promo: basket.promo };
    }
    if (q.applied && q.discountCentavos > 0 && q.eligibility === 'SIGN_IN_TO_CONFIRM') {
      // Already signed in (checkout requires it) but the RMS couldn't confirm eligibility from the
      // token, e.g. a brand-new account: never tell them to sign in again; show the RMS's amount as
      // an estimate the booking review confirms.
      return signedIn
        ? { kind: 'estimate', centavos: q.discountCentavos, promo: basket.promo }
        : { kind: 'sign-in', centavos: q.discountCentavos, promo: basket.promo };
    }
    if (!q.applied && q.reason === 'MIN_SPEND_NOT_MET' && q.remainingToQualifyCentavos) {
      return { kind: 'below-minimum', remainingCentavos: q.remainingToQualifyCentavos };
    }
    return { kind: 'none' };
  }
  if (quote.status === 'error' && basket.kind === 'unlocked') {
    return { kind: 'estimate', centavos: basket.computation.discountCentavos, promo: basket.promo };
  }
  return { kind: 'none' };
}

/** The small "15% off your order once it reaches ₱1,000" note for a gear card (Build Your Own or a
 *  package add-on), only on gear the live promo covers. */
export function gearCardPromoNote(state: BasketPromoState, category: string): string | null {
  if (state.kind === 'hidden') return null;
  const scopeKey = scopeKeyForCategory(category);
  if (!scopeKey || !state.promo.scopeKeys.includes(scopeKey)) return null;
  const offer = formatPromoOffer(state.promo);
  return state.promo.minSpendCentavos > 0
    ? PROMO_COPY.gearCardNote(offer, formatCentavos(state.promo.minSpendCentavos))
    : PROMO_COPY.gearCardNoteNoMinimum(offer);
}

/** "You save" for one unit of a gear card, at its price for the chosen duration (null before a
 *  duration is chosen): see gearUnitSavingCentavos for when it applies. */
export function gearCardPromoSaving(
  state: BasketPromoState,
  category: string,
  unitPricePesos: number | null,
): { centavos: number; percent: string | null } | null {
  if (state.kind === 'hidden' || unitPricePesos === null) return null;
  const centavos = gearUnitSavingCentavos(state, category, pesosToCentavos(unitPricePesos));
  return centavos > 0 ? { centavos, percent: promoPercentLabel(state.promo) } : null;
}
