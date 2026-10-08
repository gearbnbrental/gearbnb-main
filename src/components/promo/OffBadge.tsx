import { PROMO_COPY } from '../../config/promoCopy';

/** The small green "15% OFF" badge shown beside a discounted price or product name. `offer` is
 *  "15%" / "₱300", built from the promo (see formatPromoOffer). `size="large"` is the same badge a
 *  little bigger, for the "View Details" popups. */
export default function OffBadge({
  offer,
  className = '',
  size = 'small',
}: {
  offer: string;
  className?: string;
  size?: 'small' | 'large';
}) {
  const sizing = size === 'large' ? 'rounded-md px-2 py-1 text-xs sm:text-sm' : 'rounded px-1.5 py-0.5 text-[10px] sm:text-[11px]';
  return (
    <span className={`whitespace-nowrap bg-brand-forest font-sans font-bold leading-none text-white ${sizing} ${className}`}>
      {PROMO_COPY.offBadge(offer)}
    </span>
  );
}
