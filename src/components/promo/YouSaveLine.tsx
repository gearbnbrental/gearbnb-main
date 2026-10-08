import { PROMO_COPY } from '../../config/promoCopy';
import { formatCentavos } from '../../utils/promo';
import { CheckIcon } from '../icons';

/** "✓ You save ₱X (15%)" on a discounted gear or package card. On a narrow phone card it wraps
 *  before "(15%)" (never inside the amount), with the check mark staying on the first line. */
export default function YouSaveLine({ centavos, percent, className = '' }: { centavos: number; percent: string | null; className?: string }) {
  if (centavos <= 0) return null;
  return (
    <p className={`flex items-start gap-1 font-bold text-accent ${className}`}>
      <CheckIcon className="mt-[0.15em] h-3.5 w-3.5 shrink-0 stroke-[3]" />
      <span>
        <span className="whitespace-nowrap">{PROMO_COPY.youSave(formatCentavos(centavos), null)}</span>
        {percent && <span className="whitespace-nowrap"> ({percent})</span>}
      </span>
    </p>
  );
}
