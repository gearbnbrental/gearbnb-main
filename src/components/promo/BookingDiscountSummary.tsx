import { PROMO_COPY } from '../../config/promoCopy';
import { formatCentavos } from '../../utils/promo';
import type { RmsBookingDiscount, RmsRentalFee } from '../../utils/rmsApi';

/**
 * "You saved ₱X (label)" on a booking, with the rental fee before and after, straight from the
 * RMS. `rentalFee.dueCentavos` is already after the discount and is never recomputed here.
 * Renders nothing for a booking without a discount (or an older RMS response).
 */
export default function BookingDiscountSummary({
  discount,
  rentalFee,
}: {
  discount: RmsBookingDiscount | null | undefined;
  rentalFee: Pick<RmsRentalFee, 'dueCentavos' | 'beforeDiscountCentavos' | 'discountCentavos'>;
}) {
  if (!discount || discount.savedCentavos <= 0) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-brand-forest/30 bg-brand-forest/10 px-3 py-2.5 text-sm">
      <p className="font-semibold text-accent">
        {PROMO_COPY.savedOnBooking(formatCentavos(discount.savedCentavos), discount.label)}
      </p>
      {rentalFee.beforeDiscountCentavos !== undefined && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-ink-muted">Before discount</dt>
          <dd className="text-right text-ink">{formatCentavos(rentalFee.beforeDiscountCentavos)}</dd>
          <dt className="text-ink-muted">Discount</dt>
          <dd className="text-right text-accent">&minus;{formatCentavos(rentalFee.discountCentavos ?? discount.savedCentavos)}</dd>
          <dt className="text-ink-muted">After discount</dt>
          <dd className="text-right font-medium text-ink">{formatCentavos(rentalFee.dueCentavos)}</dd>
        </dl>
      )}
    </div>
  );
}
