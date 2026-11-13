import type { ReactNode } from 'react';
import { formatCurrency } from '../../utils/format';
import { formatCentavos, pesosToCentavos } from '../../utils/promo';
import YouSaveLine from './YouSaveLine';
import OffBadge from './OffBadge';

/**
 * The price area of a gear card, shared by Build Your Own's gear cards and the package add-on
 * cards so both always look the same: the plain price (or the 48h–72h range before a duration is
 * chosen); once the promo applies, the normal price crossed off, the discounted price and
 * "✓ You save"; then any hints, the subtotal for more than one, and the promo note. The promo
 * lines always use the same style; the card's own price and subtotal text can keep its own size
 * (priceClassName/subtotalClassName).
 */
export default function GearPriceBlock({
  pricing,
  price,
  quantity,
  promoSaving,
  promoNote,
  hints,
  priceClassName = 'text-sm font-bold leading-tight text-ink sm:text-lg',
  subtotalClassName = 'text-[10px] text-ink-muted sm:text-[11px]',
}: {
  pricing: { '48h': number; '72h': number };
  /** Per-unit price for the chosen duration; null before a duration is chosen. */
  price: number | null;
  quantity: number;
  promoSaving: { centavos: number; percent: string | null } | null;
  /** "15% off your order once it reaches ₱1,000" on covered gear before its discount shows. */
  promoNote?: string | null;
  /** Card-specific lines under the price (72h upsell, extra-day rate). */
  hints?: ReactNode;
  priceClassName?: string;
  subtotalClassName?: string;
}) {
  const discounted = promoSaving && price !== null ? pesosToCentavos(price) - promoSaving.centavos : null;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {discounted !== null && promoSaving && price !== null ? (
        <>
          {/* Same as the package cards: crossed-off price, then the discounted price with the
              "15% OFF" badge beside it; on a phone the crossed-off price takes its own line so the
              price and badge fit side by side. "You save" then needs no "(15%)". */}
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <s className="basis-full text-[11px] font-medium text-ink-faint sm:basis-auto sm:text-sm">{formatCurrency(price)}</s>
            <span className={priceClassName}>{formatCentavos(discounted)}</span>
            {promoSaving.percent && <OffBadge offer={promoSaving.percent} className="self-center" />}
          </p>
          <YouSaveLine centavos={promoSaving.centavos} percent={null} className="text-[11px] sm:text-xs" />
        </>
      ) : (
        <p className={priceClassName}>
          {price !== null
            ? formatCurrency(price)
            : pricing['48h'] === pricing['72h']
              ? formatCurrency(pricing['48h'])
              : `${formatCurrency(pricing['48h'])}–${formatCurrency(pricing['72h'])}`}
        </p>
      )}
      {hints}
      {quantity > 1 && price !== null && (
        <p className={subtotalClassName}>
          Subtotal {discounted !== null ? formatCentavos(discounted * quantity) : formatCurrency(price * quantity)}
        </p>
      )}
      {discounted === null && promoNote && <p className="text-[10px] font-medium text-accent sm:text-[11px]">{promoNote}</p>}
    </div>
  );
}
