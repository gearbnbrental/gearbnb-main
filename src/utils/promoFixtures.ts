import { computePromoDiscount, evaluateBasketPromo, PACKAGES_SCOPE_KEY, type PromoLine } from './promo';
import type { RmsAvailabilityRequest, RmsPromoQuote, RmsPublicPromo, RmsPublicPromoResponse } from './rmsApi';

/**
 * Sample promos for tests and for previewing the promo UI in `vite dev` before a real promo exists
 * in the RMS. Never used by a production build (see devPromoFixture).
 */

const ALL_SCOPES = [
  PACKAGES_SCOPE_KEY,
  'TENT',
  'BED',
  'CAMPING_CHAIR',
  'CAMPING_TABLE',
  'COOKING',
  'COOLER',
  'FAN',
  'LIGHTS',
  'OTHER_GEAR_ESSENTIALS',
  'PICNIC_MATS',
];

const BASE: RmsPublicPromo = {
  discountType: 'PERCENT',
  percentOffBasisPoints: 1500,
  flatOffCentavos: 0,
  capCentavos: null,
  minSpendCentavos: 100000,
  firstTimeRentersOnly: true,
  termsText: null,
  scopeKeys: ALL_SCOPES,
  endsAt: null,
  tripStartsAt: null,
  tripEndsAt: null,
};

export const PROMO_FIXTURES = {
  percent: BASE,
  flat: { ...BASE, discountType: 'FLAT', percentOffBasisPoints: 0, flatOffCentavos: 30000 },
  bookByOnly: { ...BASE, endsAt: '2099-10-31T15:59:59.000Z' },
  tripWindow: {
    ...BASE,
    endsAt: '2099-10-31T15:59:59.000Z',
    tripStartsAt: '2099-10-14T16:00:00.000Z',
    tripEndsAt: '2099-11-30T15:59:59.000Z',
    termsText: 'One discount per customer.\nFirst rental only.',
  },
  tentsOnly: { ...BASE, scopeKeys: ['TENT'] },
  /** Booking deadline already passed: the site must look exactly as it did before promos. */
  expired: { ...BASE, endsAt: '2020-10-31T15:59:59.000Z' },
} satisfies Record<string, RmsPublicPromo>;

export type PromoFixtureName = keyof typeof PROMO_FIXTURES | 'none';
export type PromoEligibilityFixture = 'signedOut' | 'eligible' | 'notEligible';
export type PromoQuoteFixture = 'ok' | 'fail' | 'rateLimited';

export function promoResponseFixture(name: PromoFixtureName, eligibility: PromoEligibilityFixture): RmsPublicPromoResponse {
  if (name === 'none') return { promo: null };
  const promo = PROMO_FIXTURES[name];
  if (eligibility === 'signedOut' || !promo.firstTimeRentersOnly) return { promo };
  return { promo, eligibleForYou: eligibility === 'eligible' };
}

/**
 * A stand-in for the RMS's quote endpoint, answering from the same shared math. Unit prices aren't
 * in the request, so the caller supplies the priced lines it already has.
 */
export function promoQuoteFixture(
  response: RmsPublicPromoResponse,
  request: RmsAvailabilityRequest,
  lines: PromoLine[],
): RmsPromoQuote {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPriceCentavos * line.quantity, 0);
  const base = {
    offerLabel: null,
    rentalFeeCentavos: subtotal,
    addOnTotalCentavos: 0,
    subtotalCentavos: subtotal,
    discountCentavos: 0,
    totalAfterDiscountCentavos: subtotal,
    remainingToQualifyCentavos: null,
  };
  const promo = response.promo;
  if (!promo) return { ...base, applied: false, reason: 'NO_PROMO', eligibility: 'NOT_REQUIRED' };
  const eligibility = !promo.firstTimeRentersOnly
    ? ('NOT_REQUIRED' as const)
    : response.eligibleForYou === undefined
      ? ('SIGN_IN_TO_CONFIRM' as const)
      : response.eligibleForYou
        ? ('ELIGIBLE' as const)
        : ('NOT_ELIGIBLE' as const);
  const offerLabel = promo.discountType === 'PERCENT' ? `${promo.percentOffBasisPoints / 100}% off` : `₱${promo.flatOffCentavos / 100} off`;
  if (eligibility === 'NOT_ELIGIBLE') return { ...base, offerLabel, applied: false, reason: 'NOT_FIRST_TIME', eligibility };
  const state = evaluateBasketPromo(promo, true, lines, request.pickupAt, Date.now());
  if (state.kind === 'outside-window') return { ...base, offerLabel, applied: false, reason: 'OUTSIDE_TRIP_WINDOW', eligibility };
  const computation = computePromoDiscount(promo, lines);
  if (computation.coveredSubtotalCentavos === 0) return { ...base, offerLabel, applied: false, reason: 'NOT_IN_SCOPE', eligibility };
  if (!computation.qualified) {
    return {
      ...base,
      offerLabel,
      applied: false,
      reason: 'MIN_SPEND_NOT_MET',
      eligibility,
      remainingToQualifyCentavos: computation.remainingToQualifyCentavos,
    };
  }
  return {
    ...base,
    offerLabel,
    applied: true,
    reason: null,
    eligibility,
    discountCentavos: computation.discountCentavos,
    totalAfterDiscountCentavos: subtotal - computation.discountCentavos,
  };
}

const FIXTURE_NAMES: PromoFixtureName[] = ['none', 'percent', 'flat', 'bookByOnly', 'tripWindow', 'tentsOnly', 'expired'];
const STORAGE_KEY = 'gearbnb-dev-promo-fixture';

export interface DevPromoFixture {
  name: PromoFixtureName;
  eligibility: PromoEligibilityFixture;
  quote: PromoQuoteFixture;
}

/**
 * `vite dev` only: preview the promo UI without a live promo. Add `?promoFixture=percent` (or flat,
 * bookByOnly, tripWindow, tentsOnly, expired, none) to any URL; optionally `&promoEligibility=eligible (default)|
 * notEligible|signedOut` and `&promoQuote=ok|fail|rateLimited`. The choice sticks for the tab
 * (sessionStorage); `?promoFixture=off` turns it off. Always null in a production build.
 */
export function devPromoFixture(): DevPromoFixture | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('promoFixture');
    if (requested === 'off') {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (requested && (FIXTURE_NAMES as string[]).includes(requested)) {
      const fixture: DevPromoFixture = {
        name: requested as PromoFixtureName,
        eligibility: (['signedOut', 'eligible', 'notEligible'] as const).find((v) => v === params.get('promoEligibility')) ?? 'eligible',
        quote: (['ok', 'fail', 'rateLimited'] as const).find((v) => v === params.get('promoQuote')) ?? 'ok',
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fixture));
      return fixture;
    }
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as DevPromoFixture) : null;
  } catch {
    return null;
  }
}
