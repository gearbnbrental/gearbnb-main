import type { RmsPublicPromo, RmsPublicPromoResponse } from './rmsApi';
import { formatCurrency } from './format';
import { BUSINESS_TIME_ZONE } from './duration';

/**
 * The site-wide automatic promo, mirrored from the RMS so browsing can show the same numbers the
 * server will charge. Pure functions only; every screen (catalog, cart, checkout) goes through
 * these so the math can't drift between them. The RMS stays the authority: it recomputes the real
 * discount when a booking is submitted, and the checkout quote is the final word on screen.
 *
 * All money here is integer centavos and all percentages are integer basis points, so no float
 * ever touches a discount.
 */

export const PACKAGES_SCOPE_KEY = 'PACKAGES';

/** Gear category (as the catalog names it) → the RMS's promo scope key. Anything not listed
 *  (poles, bedsheets, pillows, inflators, pegs, ropes...) is never discounted. */
export const PROMO_CATEGORY_SCOPE_KEYS: Record<string, string> = {
  tent: 'TENT',
  bed: 'BED',
  'camping chair': 'CAMPING_CHAIR',
  'camping table': 'CAMPING_TABLE',
  cooking: 'COOKING',
  cooler: 'COOLER',
  fan: 'FAN',
  lights: 'LIGHTS',
  'other gear essentials': 'OTHER_GEAR_ESSENTIALS',
  'picnic mats': 'PICNIC_MATS',
};

export function scopeKeyForCategory(category: string): string | null {
  return PROMO_CATEGORY_SCOPE_KEYS[category.trim().toLowerCase()] ?? null;
}

/** One priced line of a basket. A Package is one line with quantity 1 and scope "PACKAGES". */
export interface PromoLine {
  /** null = a kind of gear no promo can ever cover. */
  scopeKey: string | null;
  unitPriceCentavos: number;
  quantity: number;
}

export interface PromoComputation {
  /** Normal-price total of the lines this promo covers. The minimum is measured on this. */
  coveredSubtotalCentavos: number;
  qualified: boolean;
  discountCentavos: number;
  /** How much more covered gear (at normal prices) is needed to qualify; 0 once qualified. */
  remainingToQualifyCentavos: number;
}

function wholeNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Pesos (as the catalog stores prices) → centavos, rounded to the nearest centavo. */
export function pesosToCentavos(pesos: number): number {
  return Number.isFinite(pesos) && pesos > 0 ? Math.round(pesos * 100) : 0;
}

export function isLineCovered(promo: RmsPublicPromo, line: PromoLine): boolean {
  return line.scopeKey !== null && promo.scopeKeys.includes(line.scopeKey);
}

/** Percent off one unit, rounded half up with integer math, capped per unit when the promo has a
 *  cap, and never more than the unit itself costs. */
export function percentDiscountForUnit(unitPriceCentavos: number, basisPoints: number, capCentavos: number | null): number {
  const unit = wholeNonNegative(unitPriceCentavos);
  const bp = wholeNonNegative(basisPoints);
  if (unit === 0 || bp === 0) return 0;
  let discount = Math.floor((unit * bp + 5000) / 10000);
  if (capCentavos !== null) discount = Math.min(discount, wholeNonNegative(capCentavos));
  return Math.min(discount, unit);
}

/**
 * What the promo takes off a basket. The minimum spend is checked on NORMAL prices of covered
 * lines only (never on the discounted total), and once met the discount applies to every covered
 * line in the order. Does not look at dates or eligibility; see evaluatePromoForBasket for that.
 */
export function computePromoDiscount(promo: RmsPublicPromo, lines: PromoLine[]): PromoComputation {
  let coveredSubtotal = 0;
  let percentDiscount = 0;
  for (const line of lines) {
    if (!isLineCovered(promo, line)) continue;
    const unit = wholeNonNegative(line.unitPriceCentavos);
    const quantity = wholeNonNegative(line.quantity);
    coveredSubtotal += unit * quantity;
    if (promo.discountType === 'PERCENT') {
      percentDiscount += percentDiscountForUnit(unit, promo.percentOffBasisPoints, promo.capCentavos) * quantity;
    }
  }

  const minimum = wholeNonNegative(promo.minSpendCentavos);
  const qualified = coveredSubtotal > 0 && coveredSubtotal >= minimum;
  if (!qualified) {
    return {
      coveredSubtotalCentavos: coveredSubtotal,
      qualified: false,
      discountCentavos: 0,
      remainingToQualifyCentavos: Math.max(0, minimum - coveredSubtotal),
    };
  }

  const raw = promo.discountType === 'FLAT' ? wholeNonNegative(promo.flatOffCentavos) : percentDiscount;
  return {
    coveredSubtotalCentavos: coveredSubtotal,
    qualified: true,
    discountCentavos: Math.min(raw, coveredSubtotal),
    remainingToQualifyCentavos: 0,
  };
}

function parseInstant(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/** Whether a trip picked up at `pickupAtIso` is inside the promo's rental window (inclusive at
 *  both ends; a missing end is open). */
export function isPickupInTripWindow(promo: RmsPublicPromo, pickupAtIso: string): boolean {
  const pickup = Date.parse(pickupAtIso);
  if (Number.isNaN(pickup)) return false;
  const start = parseInstant(promo.tripStartsAt);
  const end = parseInstant(promo.tripEndsAt);
  return (start === null || pickup >= start) && (end === null || pickup <= end);
}

/** Whether a booking made at `nowMs` is still before the promo's booking deadline. */
export function isPromoBookable(promo: RmsPublicPromo, nowMs: number): boolean {
  const end = parseInstant(promo.endsAt);
  return end === null || nowMs <= end;
}

/** Who the promo is for, from the visitor's point of view. */
export type PromoAudience =
  /** Not first-time-only: everyone gets it. */
  | 'everyone'
  /** First-time-only and the RMS confirmed this signed-in customer qualifies. */
  | 'first-time-confirmed'
  /** First-time-only, visitor not signed in (so the RMS can't say yet). Sees the discount, with a
   *  prompt to create an account to claim it; the RMS confirms eligibility once they sign in. */
  | 'first-time-unconfirmed'
  /** A returning renter: show no discount UI at all. */
  | 'not-eligible';

export function promoAudience(promo: RmsPublicPromo, eligibleForYou: boolean | undefined): PromoAudience {
  if (eligibleForYou === false) return 'not-eligible';
  if (!promo.firstTimeRentersOnly) return 'everyone';
  return eligibleForYou === true ? 'first-time-confirmed' : 'first-time-unconfirmed';
}

function isWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function optionalInstant(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : undefined;
}

/**
 * Validates the RMS's promo response. Anything malformed is treated as "no promo", so a bad or
 * unexpected answer can only ever make the site behave exactly as it did before promos existed.
 */
export function normalizePromoResponse(raw: unknown): RmsPublicPromoResponse {
  const none: RmsPublicPromoResponse = { promo: null };
  if (!raw || typeof raw !== 'object') return none;
  const body = raw as { promo?: unknown; eligibleForYou?: unknown };
  const eligibleForYou = typeof body.eligibleForYou === 'boolean' ? body.eligibleForYou : undefined;
  const p = body.promo as Partial<Record<keyof RmsPublicPromo, unknown>> | null | undefined;
  if (!p || typeof p !== 'object') return none;

  if (p.discountType !== 'PERCENT' && p.discountType !== 'FLAT') return none;
  if (!isWholeNumber(p.percentOffBasisPoints) || !isWholeNumber(p.flatOffCentavos) || !isWholeNumber(p.minSpendCentavos)) return none;
  if (p.capCentavos !== null && p.capCentavos !== undefined && !isWholeNumber(p.capCentavos)) return none;
  if (!Array.isArray(p.scopeKeys) || !p.scopeKeys.every((key) => typeof key === 'string')) return none;
  const endsAt = optionalInstant(p.endsAt);
  const tripStartsAt = optionalInstant(p.tripStartsAt);
  const tripEndsAt = optionalInstant(p.tripEndsAt);
  if (endsAt === undefined || tripStartsAt === undefined || tripEndsAt === undefined) return none;
  if (p.discountType === 'PERCENT' && p.percentOffBasisPoints === 0) return none;
  if (p.discountType === 'FLAT' && p.flatOffCentavos === 0) return none;

  return {
    promo: {
      discountType: p.discountType,
      percentOffBasisPoints: p.percentOffBasisPoints,
      flatOffCentavos: p.flatOffCentavos,
      capCentavos: p.discountType === 'PERCENT' && isWholeNumber(p.capCentavos) ? p.capCentavos : null,
      minSpendCentavos: p.minSpendCentavos,
      firstTimeRentersOnly: p.firstTimeRentersOnly === true,
      termsText: typeof p.termsText === 'string' && p.termsText.trim() ? p.termsText : null,
      scopeKeys: p.scopeKeys as string[],
      endsAt,
      tripStartsAt,
      tripEndsAt,
    },
    eligibleForYou,
  };
}

// ---------------------------------------------------------------------------------------------
// Display helpers. Wording itself lives in src/config/promoCopy.ts.
// ---------------------------------------------------------------------------------------------

/** Pesos like the rest of the site ("₱1,250"), but with centavos kept when the amount isn't a
 *  whole peso ("₱187.50"), so a 15% saving is never rounded up into a bigger promise. */
export function formatCentavos(centavos: number): string {
  if (centavos % 100 === 0) return formatCurrency(centavos / 100);
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    centavos / 100,
  );
}

/** "15%" / "12.5%" for a percent promo, "₱300" for a flat one. */
export function formatPromoOffer(promo: RmsPublicPromo): string {
  if (promo.discountType === 'FLAT') return formatCentavos(promo.flatOffCentavos);
  // 1500 → "15%", 1250 → "12.5%", 1205 → "12.05%"
  return `${(promo.percentOffBasisPoints / 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}

/** "Oct 31" in Philippine time. */
export function formatPromoDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: BUSINESS_TIME_ZONE });
}

/** The rental window in plain words: "trips picked up Oct 15 to Nov 30", "trips picked up from
 *  Oct 15" or "trips picked up until Nov 30". Only meaningful when the promo has a rental window
 *  (an outside-window state can't happen without one). */
export function describeTripWindow(promo: RmsPublicPromo): string {
  const from = promo.tripStartsAt ? formatPromoDate(promo.tripStartsAt) : null;
  const until = promo.tripEndsAt ? formatPromoDate(promo.tripEndsAt) : null;
  if (from && until) return `trips picked up ${from} to ${until}`;
  if (from) return `trips picked up from ${from}`;
  return `trips picked up until ${until ?? ''}`.trim();
}

/** The promo's dates as the RMS set them, never ambiguous between booking and renting:
 *  "Book by Oct 31, for trips picked up Oct 15 to Nov 30.", "Book by Oct 31." (no rental window),
 *  "Valid for trips picked up Oct 15 to Nov 30." (no booking deadline). Null when the RMS set
 *  neither, so callers show their own line instead ("Terms and conditions apply."). */
export function describePromoDates(promo: RmsPublicPromo): string | null {
  const hasWindow = Boolean(promo.tripStartsAt || promo.tripEndsAt);
  const window = hasWindow ? `for ${describeTripWindow(promo)}` : null;
  if (promo.endsAt) return `Book by ${formatPromoDate(promo.endsAt)}${window ? `, ${window}` : ''}.`;
  return window ? `Valid ${window}.` : null;
}

/**
 * Everything a screen needs to decide what to show for one basket. `hidden` means show no
 * discount UI at all (no live promo, a returning renter, or past the booking deadline).
 */
export type BasketPromoState =
  | { kind: 'hidden' }
  /** No pickup date chosen yet: only the neutral offer note, never a discounted price. */
  | { kind: 'needs-dates'; promo: RmsPublicPromo; audience: PromoAudience }
  /** The chosen pickup is outside the rental window: no discount, just the covered-dates note. */
  | { kind: 'outside-window'; promo: RmsPublicPromo; audience: PromoAudience }
  | { kind: 'below-minimum'; promo: RmsPublicPromo; audience: PromoAudience; computation: PromoComputation }
  | { kind: 'unlocked'; promo: RmsPublicPromo; audience: PromoAudience; computation: PromoComputation };

export function evaluateBasketPromo(
  promo: RmsPublicPromo | null,
  eligibleForYou: boolean | undefined,
  lines: PromoLine[],
  pickupAtIso: string | null,
  nowMs: number,
): BasketPromoState {
  if (!promo || !isPromoBookable(promo, nowMs)) return { kind: 'hidden' };
  const audience = promoAudience(promo, eligibleForYou);
  // A signed-in returning renter sees normal prices only. Signed-out visitors do see the discount
  // (to encourage signing up); it disappears if they sign in as a returning renter.
  if (audience === 'not-eligible') return { kind: 'hidden' };
  if (!pickupAtIso) return { kind: 'needs-dates', promo, audience };
  if (!isPickupInTripWindow(promo, pickupAtIso)) return { kind: 'outside-window', promo, audience };
  const computation = computePromoDiscount(promo, lines);
  return computation.qualified
    ? { kind: 'unlocked', promo, audience, computation }
    : { kind: 'below-minimum', promo, audience, computation };
}

/** The discount a basket state carries (0 unless unlocked). */
export function basketDiscountCentavos(state: BasketPromoState): number {
  return state.kind === 'unlocked' ? state.computation.discountCentavos : 0;
}

/**
 * What a Package card shows. `discounted` (struck-through normal price next to the discounted one)
 * as soon as a duration is chosen (so there's a price), when PACKAGES is in scope and the
 * package's own price meets the minimum. A start date isn't needed for this: until one is picked
 * the card shows the discount up front, to entice; once a date is picked outside the promo's
 * rental window the discount goes away. `tag` is the neutral "{offer} for first-time renters"
 * note for every other case where the promo covers packages (no duration yet, below the minimum,
 * or a date outside the window).
 */
export type PackageCardPromo =
  | null
  | { kind: 'tag'; promo: RmsPublicPromo; audience: PromoAudience }
  | { kind: 'discounted'; promo: RmsPublicPromo; audience: PromoAudience; normalCentavos: number; nowCentavos: number };

export function packageCardPromo(
  promo: RmsPublicPromo | null,
  eligibleForYou: boolean | undefined,
  priceCentavos: number | null,
  pickupAtIso: string | null,
  nowMs: number,
): PackageCardPromo {
  if (!promo || !promo.scopeKeys.includes(PACKAGES_SCOPE_KEY) || !isPromoBookable(promo, nowMs)) return null;
  const audience = promoAudience(promo, eligibleForYou);
  if (audience === 'not-eligible') return null;
  if (priceCentavos === null || (pickupAtIso !== null && !isPickupInTripWindow(promo, pickupAtIso))) {
    return { kind: 'tag', promo, audience };
  }
  const computation = computePromoDiscount(promo, [{ scopeKey: PACKAGES_SCOPE_KEY, unitPriceCentavos: priceCentavos, quantity: 1 }]);
  if (!computation.qualified) return { kind: 'tag', promo, audience };
  return {
    kind: 'discounted',
    promo,
    audience,
    normalCentavos: priceCentavos,
    nowCentavos: priceCentavos - computation.discountCentavos,
  };
}

/** "15%" for a percent promo; null for a flat one (a flat amount has no percentage to show). */
export function promoPercentLabel(promo: RmsPublicPromo): string | null {
  return promo.discountType === 'PERCENT' ? formatPromoOffer(promo) : null;
}

/**
 * What one unit of a gear card saves, for the "You save ₱X (15%)" line: once the basket's
 * discount is unlocked, or straight away for an item whose own price already meets the minimum
 * (it qualifies on its own, even in an empty cart). Only for gear the promo covers, with dates
 * chosen inside the rental window, and only for a percent promo (a flat promo comes off the whole
 * order once, so no single item "saves" a share of it). 0 otherwise.
 */
export function gearUnitSavingCentavos(state: BasketPromoState, category: string, unitPriceCentavos: number): number {
  if (state.kind !== 'unlocked' && state.kind !== 'below-minimum') return 0;
  if (state.promo.discountType !== 'PERCENT') return 0;
  if (state.kind === 'below-minimum' && (unitPriceCentavos <= 0 || unitPriceCentavos < state.promo.minSpendCentavos)) return 0;
  const scopeKey = scopeKeyForCategory(category);
  if (!scopeKey || !state.promo.scopeKeys.includes(scopeKey)) return 0;
  return percentDiscountForUnit(unitPriceCentavos, state.promo.percentOffBasisPoints, state.promo.capCentavos);
}
