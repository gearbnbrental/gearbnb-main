import { describe, expect, it } from 'vitest';
import { evaluateBasketPromo, type BasketPromoState } from './promo';
import { decideCheckoutSaving, rentalFeeAfterDiscount } from './promoDisplay';
import { PROMO_FIXTURES } from './promoFixtures';
import type { RmsPromoQuote } from './rmsApi';

const promo = PROMO_FIXTURES.percent;
const pickup = '2099-10-20T02:00:00.000Z';
const unlocked = evaluateBasketPromo(promo, true, [{ scopeKey: 'TENT', unitPriceCentavos: 140000, quantity: 1 }], pickup, 0);
const below = evaluateBasketPromo(promo, true, [{ scopeKey: 'TENT', unitPriceCentavos: 50000, quantity: 1 }], pickup, 0);

function quote(overrides: Partial<RmsPromoQuote>): { status: 'success'; quote: RmsPromoQuote } {
  return {
    status: 'success',
    quote: {
      applied: true,
      reason: null,
      eligibility: 'ELIGIBLE',
      offerLabel: '15% off',
      rentalFeeCentavos: 140000,
      addOnTotalCentavos: 0,
      subtotalCentavos: 140000,
      discountCentavos: 21000,
      totalAfterDiscountCentavos: 119000,
      remainingToQualifyCentavos: null,
      ...overrides,
    },
  };
}

describe('decideCheckoutSaving', () => {
  it('uses the quote amount when it applied for an eligible customer, or a promo for everyone', () => {
    expect(decideCheckoutSaving(unlocked, quote({}))).toMatchObject({ kind: 'confirmed', centavos: 21000, label: '15% off' });
    expect(decideCheckoutSaving(unlocked, quote({ eligibility: 'NOT_REQUIRED' }))).toMatchObject({ kind: 'confirmed' });
  });

  it('the quote wins over the browse-time math', () => {
    expect(decideCheckoutSaving(unlocked, quote({ discountCentavos: 20000 }))).toMatchObject({ centavos: 20000 });
  });

  it('asks a signed-out visitor to sign in to confirm', () => {
    expect(decideCheckoutSaving(unlocked, quote({ eligibility: 'SIGN_IN_TO_CONFIRM' }))).toMatchObject({ kind: 'sign-in', centavos: 21000 });
  });

  it('never asks a signed-in customer to sign in again: shows the RMS amount as an estimate', () => {
    expect(decideCheckoutSaving(unlocked, quote({ eligibility: 'SIGN_IN_TO_CONFIRM' }), true)).toMatchObject({
      kind: 'estimate',
      centavos: 21000,
    });
  });

  it('says how much more to add when the minimum is not met', () => {
    expect(
      decideCheckoutSaving(below, quote({ applied: false, reason: 'MIN_SPEND_NOT_MET', discountCentavos: 0, remainingToQualifyCentavos: 50000 })),
    ).toEqual({ kind: 'below-minimum', remainingCentavos: 50000 });
  });

  it.each(['NOT_FIRST_TIME', 'NO_PROMO', 'NOT_IN_SCOPE', 'OUTSIDE_TRIP_WINDOW'] as const)('shows nothing for %s', (reason) => {
    expect(decideCheckoutSaving(unlocked, quote({ applied: false, reason, discountCentavos: 0 }))).toEqual({ kind: 'none' });
  });

  it('never shows a saving for a returning renter, even if the quote somehow applied', () => {
    expect(decideCheckoutSaving(unlocked, quote({ eligibility: 'NOT_ELIGIBLE' }))).toEqual({ kind: 'none' });
  });

  it('on a failed quote (429, 503, timeout) falls back to a labelled estimate only when unlocked', () => {
    expect(decideCheckoutSaving(unlocked, { status: 'error' })).toMatchObject({ kind: 'estimate', centavos: 21000 });
    expect(decideCheckoutSaving(below, { status: 'error' })).toEqual({ kind: 'none' });
    const hidden: BasketPromoState = { kind: 'hidden' };
    expect(decideCheckoutSaving(hidden, { status: 'error' })).toEqual({ kind: 'none' });
  });

  it('claims nothing while the quote is still loading', () => {
    expect(decideCheckoutSaving(unlocked, { status: 'loading' })).toEqual({ kind: 'none' });
  });
});

describe('rentalFeeAfterDiscount', () => {
  it('takes the discount off the rental fee only, never below zero', () => {
    expect(rentalFeeAfterDiscount(1400, unlocked)).toBe(1190);
    expect(rentalFeeAfterDiscount(1400, below)).toBe(1400);
    expect(rentalFeeAfterDiscount(100, unlocked)).toBe(0);
  });
});
