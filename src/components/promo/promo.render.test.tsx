import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { evaluateBasketPromo, type PromoLine } from '../../utils/promo';
import { PROMO_FIXTURES } from '../../utils/promoFixtures';
import type { RmsPublicPromo } from '../../utils/rmsApi';
import BookingDiscountSummary from './BookingDiscountSummary';
import ByoPromoProgress from './ByoPromoProgress';
import CheckoutSavingLine from './CheckoutSavingLine';
import { PromoTermsContent } from './PromoTerms';
import YouSaveLine from './YouSaveLine';
import { BarPromoNote, BarRentalFee, PromoRentalFeeRows } from './PromoTotals';

function html(element: ReactElement): string {
  return renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
}
/** The rendered text only, tags stripped and whitespace collapsed. */
function text(element: ReactElement): string {
  return html(element)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\u2011/g, '-') // non-breaking hyphens read as normal ones
    .replace(/\s+/g, ' ')
    .trim();
}

const promo = PROMO_FIXTURES.percent;
const pickup = '2099-10-20T02:00:00.000Z';
const state = (lines: PromoLine[], p: RmsPublicPromo = promo, pickupAt: string | null = pickup, eligible = true) =>
  evaluateBasketPromo(p, eligible, lines, pickupAt, 0);
const tent = (pesos: number): PromoLine => ({ scopeKey: 'TENT', unitPriceCentavos: pesos * 100, quantity: 1 });

describe('Build Your Own progress bar', () => {
  it('empty cart', () => {
    expect(text(<ByoPromoProgress state={state([])} />)).toContain('Add gear below to start unlocking your 15% first-rental discount.');
  });

  it('below the minimum: how much more, the fill and the count, measured on normal prices', () => {
    const out = text(<ByoPromoProgress state={state([tent(400)])} />);
    expect(out).toContain('Add ₱600 more to unlock your 15%.');
    expect(out).toContain('₱400 of ₱1,000 minimum');
    expect(html(<ByoPromoProgress state={state([tent(400)])} />)).toContain('width:40%');
  });

  it('unlocked: the total saving', () => {
    expect(text(<ByoPromoProgress state={state([tent(1250), { scopeKey: 'BED', unitPriceCentavos: 70000, quantity: 1 }])} />)).toContain(
      "Discount unlocked, you're saving ₱292.50 on this order.",
    );
  });

  it('flat promo wording comes from the promo', () => {
    expect(text(<ByoPromoProgress state={state([tent(500)], PROMO_FIXTURES.flat)} />)).toContain('to unlock your ₱300.');
  });

  it('outside the rental window: the covered dates, no discount', () => {
    const out = text(<ByoPromoProgress state={state([tent(2000)], PROMO_FIXTURES.tripWindow, '2099-12-10T02:00:00.000Z')} />);
    expect(out).toContain('This offer covers trips picked up Oct 15 to Nov 30.');
    expect(out).not.toContain('saving');
  });

  it('renders nothing for a returning renter or with no promo', () => {
    expect(html(<ByoPromoProgress state={state([tent(2000)], promo, pickup, false)} />)).toBe('');
    expect(html(<ByoPromoProgress state={{ kind: 'hidden' }} />)).toBe('');
  });

  it('offers the terms only once the minimum is reached', () => {
    expect(text(<ByoPromoProgress state={state([tent(400)])} />)).not.toContain('See terms');
    expect(text(<ByoPromoProgress state={state([])} />)).not.toContain('See terms');
    expect(text(<ByoPromoProgress state={state([tent(1000)])} />)).toContain('See terms');
  });

  it('shows a signed-out visitor the tracker with a sign-up link to claim it', () => {
    const signedOut = html(<ByoPromoProgress state={evaluateBasketPromo(promo, undefined, [tent(400)], pickup, 0)} />);
    expect(signedOut).toContain('Add ₱600 more to unlock your 15%.');
    expect(signedOut).toContain('Create a free account to claim it');
    expect(signedOut).toContain('href="/login"');
    expect(text(<ByoPromoProgress state={state([tent(400)])} />)).not.toContain('Create a free account');
  });
});

describe('totals', () => {
  const unlocked = state([tent(1400)]);
  it('bar: struck-through normal fee next to the discounted one, plus the discount line', () => {
    const bar = html(<BarRentalFee normalPesos={1400} state={unlocked} />);
    expect(bar).toContain('<s');
    expect(text(<BarRentalFee normalPesos={1400} state={unlocked} />)).toBe('Rental Fee ₱1,400 ₱1,190');
    expect(text(<BarPromoNote state={unlocked} />)).toBe('First-rental discount −₱210');
  });

  it('bar: plain fee when nothing applies', () => {
    expect(text(<BarRentalFee normalPesos={500} state={state([tent(500)])} />)).toBe('Rental Fee ₱500');
  });

  it('breakdown rows: normal fee, discount, fee due', () => {
    const out = text(<PromoRentalFeeRows normalPesos={1400} state={unlocked} />);
    expect(out).toContain('Rental Fee (before discount) ₱1,400');
    expect(out).toContain('First-rental discount −₱210');
    expect(out).not.toContain('See terms');
    expect(out).toContain('Rental Fee Due ₱1,190');
  });

  it('a promo for everyone just says "Discount"', () => {
    const everyone = state([tent(1400)], { ...promo, firstTimeRentersOnly: false });
    expect(text(<BarPromoNote state={everyone} />)).toBe('Discount −₱210');
  });
});

describe('terms dialog content', () => {
  it('states both dates and shows the terms as plain text, line breaks kept, never HTML', () => {
    const withHtml: RmsPublicPromo = { ...PROMO_FIXTURES.tripWindow, termsText: 'Line one.\n<b>Line two</b>' };
    const out = html(<PromoTermsContent promo={withHtml} />);
    expect(out).toContain('Book by Oct 31, for trips picked up Oct 15 to Nov 30.');
    expect(out).toContain('whitespace-pre-line');
    expect(out).toContain('&lt;b&gt;Line two&lt;/b&gt;');
    expect(out).not.toContain('<b>');
  });

  it('falls back to the default terms', () => {
    expect(text(<PromoTermsContent promo={promo} />)).toContain('One discount per customer, first rental only.');
    expect(text(<PromoTermsContent promo={promo} />)).not.toContain('any trip date');
  });

});

describe('checkout saving line', () => {
  it('confirmed by the quote', () => {
    expect(text(<CheckoutSavingLine saving={{ kind: 'confirmed', centavos: 21000, label: '15% off', promo }} catalogPath="/catalog" />)).toContain(
      'You saved ₱210 on this booking (15% off)',
    );
  });

  it('estimate after a failed quote is labelled as one', () => {
    const out = text(<CheckoutSavingLine saving={{ kind: 'estimate', centavos: 21000, promo }} catalogPath="/catalog" />);
    expect(out).toContain('Estimated saving: ₱210');
    expect(out).toContain('confirmed when your booking is reviewed');
  });

  it('sign in to confirm, and add more to unlock with a link back to the catalog', () => {
    expect(text(<CheckoutSavingLine saving={{ kind: 'sign-in', centavos: 21000, promo }} catalogPath="/catalog" />)).toContain(
      "You'd save ₱210 as a first-time renter. Sign in to confirm.",
    );
    const below = html(<CheckoutSavingLine saving={{ kind: 'below-minimum', remainingCentavos: 50000 }} catalogPath="/catalog/build-your-own" />);
    expect(below).toContain('Add ₱500 more to unlock your discount');
    expect(below).toContain('href="/catalog/build-your-own"');
  });

  it('nothing at all when there is no saving', () => {
    expect(html(<CheckoutSavingLine saving={{ kind: 'none' }} catalogPath="/catalog" />)).toBe('');
  });
});

describe('My Bookings savings line', () => {
  it('shows the saving and the fee before and after, straight from the RMS', () => {
    const out = text(
      <BookingDiscountSummary
        discount={{ savedCentavos: 21000, source: 'PROMO', label: '15% off' }}
        rentalFee={{ dueCentavos: 119000, beforeDiscountCentavos: 140000, discountCentavos: 21000 }}
      />,
    );
    expect(out).toContain('You saved ₱210 (15% off)');
    expect(out).toContain('Before discount ₱1,400');
    expect(out).toContain('After discount ₱1,190');
  });

  it('nothing for a booking without a discount or an older RMS response', () => {
    expect(html(<BookingDiscountSummary discount={null} rentalFee={{ dueCentavos: 1000 }} />)).toBe('');
    expect(html(<BookingDiscountSummary discount={undefined} rentalFee={{ dueCentavos: 1000 }} />)).toBe('');
  });
});

describe('You save line', () => {
  it('shows the amount and the percent, or just the amount for a flat promo', () => {
    expect(text(<YouSaveLine centavos={18750} percent="15%" />)).toBe('You save ₱187.50 (15%)');
    expect(text(<YouSaveLine centavos={30000} percent={null} />)).toBe('You save ₱300');
    expect(html(<YouSaveLine centavos={0} percent="15%" />)).toBe('');
  });
});

describe('copy rules', () => {
  it('no em dashes in any promo wording', async () => {
    const { PROMO_COPY } = await import('../../config/promoCopy');
    for (const value of Object.values(PROMO_COPY)) {
      const sample = typeof value === 'function' ? (value as (...args: string[]) => string)('A', 'B') : value;
      expect(sample).not.toContain('—');
    }
  });
});
