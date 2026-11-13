import { useEffect, useMemo, useState } from 'react';
import type { DepositProofStatus } from '../../utils/rmsApi';
import { formatDeadline } from '../../utils/clockTime';
import { clockOffsetMs, timeLeft, type CountdownUrgency } from '../../utils/depositCountdown';

interface DepositCountdownProps {
  /** RMS `depositDueAt` (ISO): the booking is cancelled automatically if still unpaid then. */
  depositDueAt: string;
  /** RMS `serverNow` from the same response, to correct a phone clock that is off. */
  serverNow?: string;
  proofStatus: DepositProofStatus;
  /** Deposit already verified: nothing to count down. */
  verified: boolean;
  /** Where "Pay security deposit" goes (an in-page anchor such as "#security-deposit-…"); no
   *  button when omitted, e.g. when the payment section is directly below. */
  payHref?: string;
}

const TONE: Record<CountdownUrgency, { box: string; clock: string }> = {
  normal: { box: 'border-brand-forest/30 bg-brand-forest/5', clock: 'text-accent' },
  soon: { box: 'border-amber-300 bg-amber-50', clock: 'text-amber-800' },
  urgent: { box: 'border-red-300 bg-red-50', clock: 'text-red-700' },
  expired: { box: 'border-red-300 bg-red-50', clock: 'text-red-700' },
};

/**
 * "Your booking stays active for 23:41:05 without a security deposit": counts down to the RMS's
 * deposit deadline (24 hours after checkout). Stops once a payment proof is uploaded (the RMS never
 * cancels a booking while its proof is waiting for review) and disappears once the deposit is
 * verified. Paying is what stops it, not staff approval, so slow document review never costs the
 * renter their booking.
 */
export default function DepositCountdown({ depositDueAt, serverNow, proofStatus, verified, payHref }: DepositCountdownProps) {
  const dueAtMs = Date.parse(depositDueAt);
  // Worked out when this response's serverNow arrives (a refetch brings a new one).
  const offsetMs = useMemo(() => clockOffsetMs(serverNow, Date.now()), [serverNow]);
  const [nowMs, setNowMs] = useState(() => Date.now() + offsetMs);
  const counting = !verified && proofStatus !== 'PENDING_REVIEW' && !Number.isNaN(dueAtMs);

  useEffect(() => {
    if (!counting) return;
    const tick = () => setNowMs(Date.now() + offsetMs);
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [counting, offsetMs]);

  if (verified || Number.isNaN(dueAtMs)) return null;

  if (proofStatus === 'PENDING_REVIEW') {
    return (
      <div className="rounded-xl border border-brand-forest/30 bg-brand-forest/5 p-4 text-sm text-ink">
        <p className="font-semibold">Payment proof received</p>
        <p className="mt-1 text-ink-muted">Your booking won't be cancelled while we check your payment.</p>
      </div>
    );
  }

  const left = timeLeft(dueAtMs, nowMs);
  const tone = TONE[left.urgency];
  const deadline = formatDeadline(new Date(dueAtMs));

  return (
    <div className={`flex flex-col gap-2 rounded-xl border p-4 text-center ${tone.box}`}>
      {left.urgency === 'expired' ? (
        <>
          <p className="text-sm font-semibold text-red-700">Time's up</p>
          <p className="text-sm text-ink">This booking is being cancelled and the gear released.</p>
        </>
      ) : (
        <>
          <p className="text-sm text-ink">Your booking stays active without a security deposit for</p>
          <p className={`font-mono text-3xl font-bold tabular-nums ${tone.clock}`} aria-hidden="true">
            {left.clock}
          </p>
          {/* Changes once a minute (no seconds), so a screen reader isn't interrupted every tick. */}
          <p className="sr-only" aria-live="polite">
            {left.spoken} left to pay your security deposit.
          </p>
          <p className="text-xs text-ink-muted">until {deadline}</p>
          <p className="text-sm text-ink">
            Pay before the timer runs out, or your booking is cancelled automatically and the gear released.
          </p>
          {payHref && (
            <a
              href={payHref}
              className="mx-auto mt-1 inline-flex min-h-11 items-center rounded-lg bg-brand-forest px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
            >
              Pay security deposit
            </a>
          )}
        </>
      )}
    </div>
  );
}
