import { Link } from 'react-router-dom';
import { PROMO_COPY } from '../../config/promoCopy';
import { formatCentavos } from '../../utils/promo';
import type { CheckoutSaving } from '../../utils/promoDisplay';
import PromoTermsLink from './PromoTerms';

/** The highlighted saving line above the Booking Summary — see decideCheckoutSaving. */
export default function CheckoutSavingLine({ saving, catalogPath }: { saving: CheckoutSaving; catalogPath: string }) {
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
  return (
    <div role="status" className="flex flex-col gap-0.5 rounded-lg border border-brand-forest/30 bg-brand-forest/10 px-3 py-2.5 text-sm text-accent">
      <p className="font-semibold">
        {saving.kind === 'confirmed' && PROMO_COPY.youSaved(amount)}
        {saving.kind === 'sign-in' && PROMO_COPY.youdSaveSignIn(amount)}
        {saving.kind === 'estimate' && PROMO_COPY.estimatedSaving(amount)}
        {saving.kind === 'confirmed' && saving.label && <span className="font-normal"> ({saving.label})</span>}
      </p>
      <p className="text-xs">
        {saving.kind === 'estimate' && <>{PROMO_COPY.estimatedSavingNote} </>}
        <PromoTermsLink promo={saving.promo} />
      </p>
    </div>
  );
}
