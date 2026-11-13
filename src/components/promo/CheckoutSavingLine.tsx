import { Link } from 'react-router-dom';
import { PROMO_COPY } from '../../config/promoCopy';
import { formatCentavos } from '../../utils/promo';
import type { CheckoutSaving } from '../../utils/promoDisplay';
import PromoTermsLink from './PromoTerms';

/**
 * The checkout's saving box, shown right under the Due Today / Rental Fee Total cards — same look as
 * the saving box in My Bookings (title, then the rental fee before discount, the discount and the fee
 * after). Deliberately a light, compact box so the Rental Fee Total card above stays the figure that
 * stands out. See decideCheckoutSaving for when each variant shows.
 */
export default function CheckoutSavingLine({
  saving,
  catalogPath,
  normalFeeCentavos,
}: {
  saving: CheckoutSaving;
  catalogPath: string;
  /** The rental fee before any discount (the deposit is never part of this). */
  normalFeeCentavos: number;
}) {
  if (saving.kind === 'none') return null;
  if (saving.kind === 'below-minimum') {
    return (
      <p role="status" className="rounded-lg border border-line bg-surface-muted px-3 py-2.5 text-sm text-ink">
        {PROMO_COPY.addMoreToUnlock(formatCentavos(saving.remainingCentavos))}.{' '}
        <Link to={catalogPath} className="font-semibold text-accent underline underline-offset-2">
          {PROMO_COPY.backToCatalog}
        </Link>
      </p>
    );
  }
  const amount = formatCentavos(saving.centavos);
  if (saving.kind === 'sign-in') {
    return (
      <p role="status" className="rounded-lg border border-brand-forest/30 bg-brand-forest/10 px-3 py-2.5 text-sm font-semibold text-accent">
        {PROMO_COPY.youdSaveSignIn(amount)} <PromoTermsLink promo={saving.promo} className="text-xs font-medium" />
      </p>
    );
  }
  const after = Math.max(0, normalFeeCentavos - saving.centavos);
  return (
    <div role="status" className="flex flex-col gap-1.5 rounded-lg border border-brand-forest/20 bg-brand-forest/5 px-3 py-2.5 text-sm">
      <p className="font-semibold text-accent">
        {saving.kind === 'confirmed'
          ? saving.label
            ? PROMO_COPY.savedOnBooking(amount, saving.label)
            : PROMO_COPY.youSaved(amount)
          : PROMO_COPY.estimatedSaving(amount)}
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <dt className="text-ink-muted">Before discount</dt>
        <dd className="text-right text-ink">{formatCentavos(normalFeeCentavos)}</dd>
        <dt className="text-ink-muted">Discount</dt>
        <dd className="text-right text-accent">&minus;{amount}</dd>
        <dt className="text-ink-muted">After discount</dt>
        <dd className="text-right font-medium text-ink">{formatCentavos(after)}</dd>
      </dl>
      <p className="text-xs text-ink-muted">
        {saving.kind === 'estimate' && <>{PROMO_COPY.estimatedSavingNote} </>}
        <PromoTermsLink promo={saving.promo} className="text-accent" />
      </p>
    </div>
  );
}
