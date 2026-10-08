import { PROMO_COPY } from '../../config/promoCopy';
import { describeTripWindow, formatCentavos, formatPromoOffer, type BasketPromoState } from '../../utils/promo';
import PromoTermsLink from './PromoTerms';
import ClaimDiscountPrompt from './ClaimDiscountPrompt';

/**
 * Build Your Own's sticky "unlock your discount" bar. Tracks the NORMAL-price total of covered
 * gear in the cart against the promo's minimum; gear outside the promo's scope never counts.
 * Renders nothing when there's no promo for this visitor. Sits just under the sticky site header
 * (whose height changes at sm/lg).
 */
export default function ByoPromoProgress({ state }: { state: BasketPromoState }) {
  if (state.kind === 'hidden') return null;
  const { promo, audience } = state;
  const offer = formatPromoOffer(promo);
  const everyone = audience === 'everyone';

  let message: string;
  let fill: number | null = null;
  let detail: string | null = null;
  switch (state.kind) {
    case 'needs-dates':
      // No start date yet (the Packages page before one is picked): same invitation as an empty
      // cart, so the box reads the same on both catalog pages.
      message = everyone ? PROMO_COPY.progressEmptyEveryone(offer) : PROMO_COPY.progressEmpty(offer);
      fill = 0;
      break;
    case 'outside-window':
      message = PROMO_COPY.outsideWindow(describeTripWindow(promo));
      break;
    case 'below-minimum': {
      const { coveredSubtotalCentavos, remainingToQualifyCentavos } = state.computation;
      if (coveredSubtotalCentavos === 0) {
        message = everyone ? PROMO_COPY.progressEmptyEveryone(offer) : PROMO_COPY.progressEmpty(offer);
        fill = 0;
      } else {
        message = PROMO_COPY.progressBelow(formatCentavos(remainingToQualifyCentavos), offer);
        fill = coveredSubtotalCentavos / promo.minSpendCentavos;
        detail = PROMO_COPY.progressCount(formatCentavos(coveredSubtotalCentavos), formatCentavos(promo.minSpendCentavos));
      }
      break;
    }
    case 'unlocked':
      message = PROMO_COPY.progressUnlocked(formatCentavos(state.computation.discountCentavos));
      fill = 1;
      break;
  }
  const unlocked = state.kind === 'unlocked';

  return (
    <div
      role="status"
      className="sticky top-[49px] z-30 -mx-4 border-y border-brand-forest/20 bg-surface/95 px-4 py-2.5 backdrop-blur sm:top-[57px] sm:mx-0 sm:rounded-xl sm:border lg:top-[73px]"
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className={`text-sm font-semibold ${unlocked ? 'text-accent' : 'text-ink'}`}>{message}</p>
          <span className="flex items-baseline gap-2 text-xs text-ink-muted">
            {detail && <span>{detail}</span>}
            {/* Terms only once the discount is actually unlocked. */}
            {unlocked && <PromoTermsLink promo={promo} className="text-accent" />}
          </span>
        </div>
        {fill !== null && (
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-surface-strong"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(Math.min(1, fill) * 100)}
            aria-label="Progress toward the discount minimum"
          >
            <div className="h-full rounded-full bg-brand-forest transition-[width] duration-300" style={{ width: `${Math.min(1, fill) * 100}%` }} />
          </div>
        )}
        {audience === 'first-time-unconfirmed' && <ClaimDiscountPrompt className="text-[11px] text-ink-muted" />}
      </div>
    </div>
  );
}
