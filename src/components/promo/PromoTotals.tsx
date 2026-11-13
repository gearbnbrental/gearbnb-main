import { PROMO_COPY } from '../../config/promoCopy';
import { formatCurrency } from '../../utils/format';
import { describeTripWindow, formatCentavos, formatPromoOffer, type BasketPromoState } from '../../utils/promo';
import { discountLabel, rentalFeeAfterDiscount } from '../../utils/promoDisplay';

/** "Rental Fee ₱X" for the sticky totals bars, with the normal fee struck through next to the
 *  discounted one once a discount is unlocked. */
export function BarRentalFee({ normalPesos, state }: { normalPesos: number; state: BasketPromoState }) {
  if (state.kind !== 'unlocked') return <>Rental Fee {formatCurrency(normalPesos)}</>;
  return (
    <>
      Rental Fee <s className="font-normal text-ink-faint">{formatCurrency(normalPesos)}</s>{' '}
      <span className="text-accent">{formatCentavos(Math.round(rentalFeeAfterDiscount(normalPesos, state) * 100))}</span>
    </>
  );
}

/** One short line under a totals bar: the discount once unlocked, how much more is needed, or
 *  the covered-dates note when the pickup is outside the promo's rental window. */
export function BarPromoNote({ state }: { state: BasketPromoState }) {
  if (state.kind === 'unlocked') {
    return (
      <span className="text-xs font-medium text-accent">
        {discountLabel(state)} &minus;{formatCentavos(state.computation.discountCentavos)}
      </span>
    );
  }
  if (state.kind === 'outside-window') {
    return <span className="text-xs text-ink-muted">{PROMO_COPY.outsideWindow(describeTripWindow(state.promo))}</span>;
  }
  if (state.kind === 'below-minimum' && state.computation.coveredSubtotalCentavos > 0) {
    return (
      <span className="text-xs text-ink-muted">
        {PROMO_COPY.belowMinimum(formatCentavos(state.computation.remainingToQualifyCentavos), formatPromoOffer(state.promo))}
      </span>
    );
  }
  return null;
}

/**
 * Rental-fee rows for an itemized breakdown (Cart, Checkout): the normal fee, the discount line
 * and the fee due, once a discount applies; just the normal fee otherwise. Plus the covered-dates
 * note when the pickup is outside the rental window. The deposit rows are never touched.
 */
export function PromoRentalFeeRows({
  normalPesos,
  state,
  normalLabel = 'Rental Fee Subtotal',
}: {
  normalPesos: number;
  state: BasketPromoState;
  normalLabel?: string;
}) {
  const row = 'flex items-center justify-between';
  if (state.kind !== 'unlocked') {
    return (
      <>
        <div className={row}>
          <span className="font-medium text-ink-muted">{normalLabel}</span>
          <span className="font-semibold text-ink">{formatCurrency(normalPesos)}</span>
        </div>
        {state.kind === 'outside-window' && (
          <p className="text-xs text-ink-muted">
            {PROMO_COPY.outsideWindow(describeTripWindow(state.promo))}
          </p>
        )}
      </>
    );
  }
  return (
    <>
      <div className={row}>
        <span className="font-medium text-ink-muted">{PROMO_COPY.rentalFeeBeforeDiscount}</span>
        <span className="font-semibold text-ink">{formatCurrency(normalPesos)}</span>
      </div>
      <div className={row}>
        <span className="font-medium text-accent">
          {discountLabel(state)}
        </span>
        <span className="font-semibold text-accent">&minus;{formatCentavos(state.computation.discountCentavos)}</span>
      </div>
      <div className={row}>
        <span className="font-medium text-ink-muted">{PROMO_COPY.rentalFeeAfterDiscount}</span>
        <span className="font-semibold text-ink">{formatCentavos(Math.round(rentalFeeAfterDiscount(normalPesos, state) * 100))}</span>
      </div>
    </>
  );
}
