import { describe, expect, it } from 'vitest';
import {
  computePromoDiscount,
  describePromoDates,
  describeTripWindow,
  evaluateBasketPromo,
  formatPromoOffer,
  gearUnitSavingCentavos,
  isPickupInTripWindow,
  isPromoBookable,
  normalizePromoResponse,
  packageCardPromo,
  percentDiscountForUnit,
  promoAudience,
  scopeKeyForCategory,
  type PromoLine,
} from './promo';
import { PROMO_FIXTURES } from './promoFixtures';
import type { RmsPublicPromo } from './rmsApi';

const percent = PROMO_FIXTURES.percent; // 15%, min ₱1,000, every scope
const flat = PROMO_FIXTURES.flat; // ₱300 off, min ₱1,000

function line(category: string, pesos: number, quantity = 1): PromoLine {
  return { scopeKey: category === 'Package' ? 'PACKAGES' : scopeKeyForCategory(category), unitPriceCentavos: pesos * 100, quantity };
}

describe('percent promo', () => {
  it('1. tent ₱1,250 + bed ₱700 → 29,250 off a 195,000 subtotal', () => {
    const result = computePromoDiscount(percent, [line('Tent', 1250), line('Bed', 700)]);
    expect(result.coveredSubtotalCentavos).toBe(195000);
    expect(result.discountCentavos).toBe(29250);
    expect(result.qualified).toBe(true);
  });

  it('2. chair ₱145 × 8 → 2,175 × 8 = 17,400', () => {
    expect(percentDiscountForUnit(14500, 1500, null)).toBe(2175);
    expect(computePromoDiscount(percent, [line('Camping Chair', 145, 8)]).discountCentavos).toBe(17400);
  });

  it('2. rounds half up per unit with integer math', () => {
    expect(percentDiscountForUnit(333, 1500, null)).toBe(50);
    expect(percentDiscountForUnit(10, 1500, null)).toBe(2);
    expect(percentDiscountForUnit(9, 1500, null)).toBe(1);
  });

  it('3. the minimum is measured on NORMAL prices, never the discounted total', () => {
    expect(computePromoDiscount(percent, [line('Tent', 999)])).toMatchObject({
      qualified: false,
      discountCentavos: 0,
      remainingToQualifyCentavos: 100,
    });
    // ₱1,000 qualifies even though ₱1,000 − 15% = ₱850 is under the minimum.
    expect(computePromoDiscount(percent, [line('Tent', 1000)])).toMatchObject({ qualified: true, discountCentavos: 15000 });
  });

  it('4. only covered gear counts toward the minimum and gets the discount', () => {
    const tentsOnly = PROMO_FIXTURES.tentsOnly;
    expect(computePromoDiscount(tentsOnly, [line('Tent', 800), line('Bed', 700)])).toMatchObject({
      coveredSubtotalCentavos: 80000,
      qualified: false,
      discountCentavos: 0,
    });
    expect(computePromoDiscount(tentsOnly, [line('Tent', 1200), line('Bed', 700)])).toMatchObject({
      qualified: true,
      discountCentavos: 18000,
    });
  });

  it('5. a category outside the ten is never discounted', () => {
    expect(scopeKeyForCategory('Poles')).toBeNull();
    expect(scopeKeyForCategory('Bedsheets')).toBeNull();
    const result = computePromoDiscount(percent, [line('Tent', 1000), line('Poles', 500, 4)]);
    expect(result.coveredSubtotalCentavos).toBe(100000);
    expect(result.discountCentavos).toBe(15000);
  });

  it('maps catalog category names case-insensitively', () => {
    expect(scopeKeyForCategory('camping CHAIR')).toBe('CAMPING_CHAIR');
    expect(scopeKeyForCategory(' Other Gear Essentials ')).toBe('OTHER_GEAR_ESSENTIALS');
    expect(scopeKeyForCategory('Picnic Mats')).toBe('PICNIC_MATS');
  });

  it('6. a per-unit cap: 15% capped at ₱300, two ₱3,950 tents → 30,000 × 2', () => {
    const capped: RmsPublicPromo = { ...percent, capCentavos: 30000 };
    expect(computePromoDiscount(capped, [line('Tent', 3950, 2)]).discountCentavos).toBe(60000);
  });

  it('9. a package discounts to the same total as its parts', () => {
    const whole = computePromoDiscount(percent, [line('Package', 1950)]);
    const parts = computePromoDiscount(percent, [line('Tent', 1250), line('Bed', 700)]);
    expect(whole.discountCentavos).toBe(29250);
    expect(parts.discountCentavos).toBe(whole.discountCentavos);
  });

  it('applies to the whole covered order once unlocked, not only to items added after', () => {
    const small = computePromoDiscount(percent, [line('Camping Chair', 145)]);
    expect(small.discountCentavos).toBe(0);
    const unlocked = computePromoDiscount(percent, [line('Camping Chair', 145), line('Tent', 1000)]);
    expect(unlocked.discountCentavos).toBe(2175 + 15000);
  });
});

describe('flat promo', () => {
  it('7. ₱300 off once, whatever the basket size, and nothing below the minimum', () => {
    expect(computePromoDiscount(flat, [line('Tent', 1000)]).discountCentavos).toBe(30000);
    expect(computePromoDiscount(flat, [line('Tent', 2500), line('Bed', 1250, 2)]).discountCentavos).toBe(30000);
    expect(computePromoDiscount(flat, [line('Tent', 999)]).discountCentavos).toBe(0);
  });

  it('never takes off more than the covered gear costs', () => {
    const noMinimum: RmsPublicPromo = { ...flat, minSpendCentavos: 0 };
    expect(computePromoDiscount(noMinimum, [line('Camping Chair', 145)]).discountCentavos).toBe(14500);
  });
});

describe('edge cases', () => {
  it('no NaN or negatives from empty, zero-price or bad input', () => {
    expect(computePromoDiscount(percent, [])).toMatchObject({ discountCentavos: 0, qualified: false });
    expect(computePromoDiscount({ ...percent, minSpendCentavos: 0 }, [line('Tent', 0, 3)])).toMatchObject({
      discountCentavos: 0,
      qualified: false,
    });
    const bad = computePromoDiscount(percent, [{ scopeKey: 'TENT', unitPriceCentavos: Number.NaN, quantity: -2 }]);
    expect(bad.discountCentavos).toBe(0);
    expect(bad.coveredSubtotalCentavos).toBe(0);
  });

  it('handles large baskets (quantity 50) exactly', () => {
    expect(computePromoDiscount(percent, [line('Camping Chair', 145, 50)]).discountCentavos).toBe(2175 * 50);
  });
});

describe('8. rental window (pickup date)', () => {
  const windowed = PROMO_FIXTURES.tripWindow; // trips picked up Oct 15 to Nov 30, Philippine time
  it('includes the first and last day, and excludes just outside', () => {
    expect(isPickupInTripWindow(windowed, '2099-10-14T16:00:00.000Z')).toBe(true); // Oct 15 00:00 PH
    expect(isPickupInTripWindow(windowed, '2099-11-30T15:59:59.000Z')).toBe(true); // Nov 30 23:59:59 PH
    expect(isPickupInTripWindow(windowed, '2099-11-30T16:00:00.000Z')).toBe(false); // one second after
    expect(isPickupInTripWindow(windowed, '2099-10-14T15:59:59.000Z')).toBe(false); // before the first day
  });

  it('supports one open end, and no window at all', () => {
    const fromOnly: RmsPublicPromo = { ...windowed, tripEndsAt: null };
    expect(isPickupInTripWindow(fromOnly, '2150-01-01T00:00:00.000Z')).toBe(true);
    expect(isPickupInTripWindow(fromOnly, '2099-10-01T00:00:00.000Z')).toBe(false);
    const untilOnly: RmsPublicPromo = { ...windowed, tripStartsAt: null };
    expect(isPickupInTripWindow(untilOnly, '2000-01-01T00:00:00.000Z')).toBe(true);
    expect(isPickupInTripWindow(percent, '2000-01-01T00:00:00.000Z')).toBe(true);
  });

  it('a pickup outside the window shows no discount at all', () => {
    const lines = [line('Tent', 2000)];
    expect(evaluateBasketPromo(windowed, true, lines, '2099-12-05T02:00:00.000Z', 0).kind).toBe('outside-window');
    expect(evaluateBasketPromo(windowed, true, lines, '2099-10-20T02:00:00.000Z', 0).kind).toBe('unlocked');
  });
});

describe('booking deadline and eligibility', () => {
  it('stops at the booking deadline', () => {
    const promo: RmsPublicPromo = { ...percent, endsAt: '2026-10-31T15:59:59.000Z' };
    expect(isPromoBookable(promo, Date.parse('2026-10-31T15:59:59.000Z'))).toBe(true);
    expect(isPromoBookable(promo, Date.parse('2026-10-31T16:00:00.000Z'))).toBe(false);
    expect(evaluateBasketPromo(promo, undefined, [line('Tent', 2000)], '2026-11-02T02:00:00.000Z', Date.parse('2026-11-01T00:00:00Z')).kind).toBe(
      'hidden',
    );
  });

  it('a signed-out visitor sees a first-time-only discount (to encourage signing up)', () => {
    expect(evaluateBasketPromo(percent, undefined, [line('Tent', 2000)], '2099-10-20T02:00:00.000Z', 0)).toMatchObject({
      kind: 'unlocked',
      audience: 'first-time-unconfirmed',
    });
    expect(packageCardPromo(percent, undefined, 195000, '2099-10-20T02:00:00.000Z', 0)).toMatchObject({
      kind: 'discounted',
      audience: 'first-time-unconfirmed',
    });
  });

  it('a promo the RMS made for everyone shows to signed-out visitors too', () => {
    const everyone: RmsPublicPromo = { ...percent, firstTimeRentersOnly: false };
    expect(evaluateBasketPromo(everyone, undefined, [line('Tent', 2000)], '2099-10-20T02:00:00.000Z', 0).kind).toBe('unlocked');
  });

  it('never shows anything to a returning renter', () => {
    expect(promoAudience(percent, false)).toBe('not-eligible');
    expect(evaluateBasketPromo(percent, false, [line('Tent', 2000)], '2099-10-20T02:00:00.000Z', 0).kind).toBe('hidden');
  });

  it('treats a signed-out visitor as "first-time renters", and a non-first-time promo as for everyone', () => {
    expect(promoAudience(percent, undefined)).toBe('first-time-unconfirmed');
    expect(promoAudience(percent, true)).toBe('first-time-confirmed');
    expect(promoAudience({ ...percent, firstTimeRentersOnly: false }, undefined)).toBe('everyone');
  });

  it('asks for dates before showing any discounted price', () => {
    expect(evaluateBasketPromo(percent, true, [line('Tent', 2000)], null, 0).kind).toBe('needs-dates');
    expect(evaluateBasketPromo(null, undefined, [line('Tent', 2000)], null, 0).kind).toBe('hidden');
  });
});

describe('normalizePromoResponse', () => {
  it('passes a well-formed promo through', () => {
    const response = normalizePromoResponse({ promo: PROMO_FIXTURES.tripWindow, eligibleForYou: true });
    expect(response.promo).toEqual(PROMO_FIXTURES.tripWindow);
    expect(response.eligibleForYou).toBe(true);
  });

  it('treats null and anything malformed as no promo', () => {
    expect(normalizePromoResponse({ promo: null }).promo).toBeNull();
    expect(normalizePromoResponse(null).promo).toBeNull();
    expect(normalizePromoResponse({ promo: { ...percent, discountType: 'BOGO' } }).promo).toBeNull();
    expect(normalizePromoResponse({ promo: { ...percent, percentOffBasisPoints: 15.5 } }).promo).toBeNull();
    expect(normalizePromoResponse({ promo: { ...percent, scopeKeys: 'TENT' } }).promo).toBeNull();
    expect(normalizePromoResponse({ promo: { ...percent, endsAt: 'not a date' } }).promo).toBeNull();
  });
});

describe('wording', () => {
  it('builds the offer from the promo, never hardcoded', () => {
    expect(formatPromoOffer(percent)).toBe('15%');
    expect(formatPromoOffer({ ...percent, percentOffBasisPoints: 1250 })).toBe('12.5%');
    expect(formatPromoOffer({ ...percent, percentOffBasisPoints: 1000 })).toBe('10%');
    expect(formatPromoOffer(flat)).toBe('₱300');
  });

  it('states both dates in Philippine time, never just "until"', () => {
    const promo: RmsPublicPromo = {
      ...percent,
      endsAt: '2026-10-31T15:59:59.000Z',
      tripStartsAt: '2026-10-14T16:00:00.000Z',
      tripEndsAt: '2026-11-30T15:59:59.000Z',
    };
    expect(describePromoDates(promo)).toBe('Book by Oct 31, for trips picked up Oct 15 to Nov 30.');
    expect(describeTripWindow({ ...promo, tripEndsAt: null })).toBe('trips picked up from Oct 15');
    expect(describeTripWindow({ ...promo, tripStartsAt: null })).toBe('trips picked up until Nov 30');
    expect(describePromoDates({ ...percent, tripStartsAt: promo.tripStartsAt })).toBe('Valid for trips picked up from Oct 15.');
    expect(describePromoDates(percent)).toBeNull();
    expect(describePromoDates({ ...percent, endsAt: promo.endsAt })).toBe('Book by Oct 31.');
  });
});

describe('package card', () => {
  const pickup = '2099-10-20T02:00:00.000Z';
  it('shows the discounted price once a duration is chosen, with or without a start date, at or above the minimum', () => {
    expect(packageCardPromo(percent, true, 195000, pickup, 0)).toEqual({
      kind: 'discounted',
      promo: percent,
      audience: 'first-time-confirmed',
      normalCentavos: 195000,
      nowCentavos: 165750,
    });
    expect(packageCardPromo(percent, true, null, pickup, 0)?.kind).toBe('tag');
    expect(packageCardPromo(percent, true, 195000, null, 0)?.kind).toBe('discounted'); // duration picked, no date yet
    expect(packageCardPromo(percent, true, 99900, pickup, 0)?.kind).toBe('tag');
  });

  it('a flat promo takes the flat amount off the package', () => {
    expect(packageCardPromo(flat, true, 195000, pickup, 0)).toMatchObject({ kind: 'discounted', nowCentavos: 165000 });
  });

  it('shows nothing when packages are out of scope or the visitor is a returning renter', () => {
    expect(packageCardPromo(PROMO_FIXTURES.tentsOnly, undefined, 195000, pickup, 0)).toBeNull();
    expect(packageCardPromo(percent, false, 195000, pickup, 0)).toBeNull();
    expect(packageCardPromo(null, undefined, 195000, pickup, 0)).toBeNull();
  });

  it('no strikethrough when the pickup is outside the rental window', () => {
    expect(packageCardPromo(PROMO_FIXTURES.tripWindow, true, 195000, '2099-12-10T02:00:00.000Z', 0)?.kind).toBe('tag');
  });
});

describe('gear card "You save"', () => {
  const pickup = '2099-10-20T02:00:00.000Z';
  const unlocked = evaluateBasketPromo(percent, true, [line('Tent', 1250), line('Picnic Mats', 100)], pickup, 0);
  it('per unit, only once unlocked and only for covered gear', () => {
    expect(gearUnitSavingCentavos(unlocked, 'Tent', 125000)).toBe(18750);
    expect(gearUnitSavingCentavos(unlocked, 'Poles', 20000)).toBe(0);
    const below = evaluateBasketPromo(percent, true, [line('Tent', 500)], pickup, 0);
    expect(gearUnitSavingCentavos(below, 'Tent', 50000)).toBe(0);
  });

  it('an item that meets the minimum on its own shows its discount even in an empty cart', () => {
    const empty = evaluateBasketPromo(percent, true, [], pickup, 0);
    expect(gearUnitSavingCentavos(empty, 'Tent', 100000)).toBe(15000); // exactly ₱1,000 qualifies
    expect(gearUnitSavingCentavos(empty, 'Tent', 99900)).toBe(0);
    expect(gearUnitSavingCentavos(empty, 'Poles', 200000)).toBe(0); // not covered
    const outside = evaluateBasketPromo(PROMO_FIXTURES.tripWindow, true, [], '2099-12-10T02:00:00.000Z', 0);
    expect(gearUnitSavingCentavos(outside, 'Tent', 200000)).toBe(0);
    const noDates = evaluateBasketPromo(percent, true, [], null, 0);
    expect(gearUnitSavingCentavos(noDates, 'Tent', 200000)).toBe(0);
  });

  it('none for a flat promo (it comes off the whole order once)', () => {
    const flatUnlocked = evaluateBasketPromo(flat, true, [line('Tent', 1250)], pickup, 0);
    expect(gearUnitSavingCentavos(flatUnlocked, 'Tent', 125000)).toBe(0);
  });
});

describe('the promo as the live RMS published it (Oct 2026)', () => {
  const live = normalizePromoResponse({
    promo: {
      discountType: 'PERCENT',
      percentOffBasisPoints: 1500,
      flatOffCentavos: 0,
      capCentavos: null,
      minSpendCentavos: 100000,
      firstTimeRentersOnly: true,
      termsText: 'Terms & Conditions:\n\n• Promo is valid for first-time renters only.',
      scopeKeys: ['PACKAGES', 'TENT', 'BED', 'CAMPING_CHAIR', 'CAMPING_TABLE', 'COOKING', 'COOLER', 'FAN', 'LIGHTS', 'OTHER_GEAR_ESSENTIALS', 'PICNIC_MATS'],
      endsAt: '2026-10-31T15:59:59.000Z',
      tripStartsAt: '2026-10-07T16:00:00.000Z',
      tripEndsAt: '2026-11-08T15:59:59.000Z',
    },
  }).promo!;

  it('is read as a valid promo with both dates in Philippine time', () => {
    expect(live).not.toBeNull();
    expect(describePromoDates(live)).toBe('Book by Oct 31, for trips picked up Oct 8 to Nov 8.');
  });

  it('covers a pickup on Nov 8 but not Nov 9, and stops taking bookings after Oct 31 (PH time)', () => {
    expect(isPickupInTripWindow(live, '2026-11-08T02:00:00.000Z')).toBe(true);
    expect(isPickupInTripWindow(live, '2026-11-09T02:00:00.000Z')).toBe(false);
    expect(isPromoBookable(live, Date.parse('2026-10-31T23:00:00+08:00'))).toBe(true);
    expect(isPromoBookable(live, Date.parse('2026-11-01T00:00:01+08:00'))).toBe(false);
  });
});
