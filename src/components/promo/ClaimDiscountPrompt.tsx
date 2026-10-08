import { Link, useLocation } from 'react-router-dom';
import { PROMO_COPY } from '../../config/promoCopy';

/** "Create a free account to claim it" for a signed-out visitor, opening the sign-up form and
 *  coming back to this page afterwards. */
export default function ClaimDiscountPrompt({ className = '' }: { className?: string }) {
  const { pathname } = useLocation();
  return (
    <p className={className}>
      <Link
        to="/login"
        state={{ from: pathname, mode: 'signup', reason: PROMO_COPY.claimReason }}
        onClick={(e) => e.stopPropagation()}
        className="font-semibold underline underline-offset-2"
      >
        {PROMO_COPY.claimLink}
      </Link>
    </p>
  );
}
