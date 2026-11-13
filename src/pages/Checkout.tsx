import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthRequiredMessage from '../components/AuthRequiredMessage';
import BackLink from '../components/BackLink';
import DepositProofUpload, { PaymentInstructionsSection } from '../components/checkout/DepositProofUpload';
import DepositCountdown from '../components/checkout/DepositCountdown';
import TripDetailsForm from '../components/checkout/TripDetailsForm';
import VerificationUpload from '../components/checkout/VerificationUpload';
import PaymentBreakdown from '../components/checkout/PaymentBreakdown';
import { useAuth } from '../context/AuthContext';
import { sameDates, selectionDates, useRental } from '../context/RentalContext';
import { formatCurrency } from '../utils/format';
import { trackInitiateCheckout } from '../utils/metaTracking';
import { PROMO_COPY } from '../config/promoCopy';
import { formatCentavos } from '../utils/promo';
import type { RmsBookingResult } from '../utils/rmsApi';

export default function Checkout() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [submittedBooking, setSubmittedBooking] = useState<RmsBookingResult | null>(null);
  // The deposit proof was uploaded from the confirmation screen (stops the countdown).
  const [proofSent, setProofSent] = useState(false);
  // "Pay Now" on the confirmation screen scrolls down to the payment details and proof upload.
  const paymentSectionRef = useRef<HTMLDivElement>(null);
  // Checkout books what's checked for ITS dates (each cart entry keeps the dates it was added for),
  // so the trip dates everything below reads are set to those, the same as the Cart page does.
  const { cart, updateTripDetails, totals } = useRental();
  const checkedDates = selectionDates(cart).dates;
  // Meta "InitiateCheckout": once per visit to this page, when a signed-in customer arrives with something checked.
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (checkoutTracked.current || authLoading || !user || submittedBooking || !checkedDates) return;
    checkoutTracked.current = true;
    trackInitiateCheckout(totals.dueBeforeStart);
  }, [authLoading, user, submittedBooking, checkedDates, totals.dueBeforeStart]);
  useEffect(() => {
    if (checkedDates && !sameDates(checkedDates, cart.tripDetails)) updateTripDetails(checkedDates);
  }, [checkedDates, cart.tripDetails, updateTripDetails]);

  // Checkout submits a real booking to the RMS, which always requires an authenticated customer
  // (see rmsFetch's requireAuth default) — gated here, before the customer invests any effort in
  // trip details/verification uploads, rather than only failing silently at the final submit.
  if (authLoading) return null;
  if (!user) {
    return (
      <AuthRequiredMessage
        redirectPath="/checkout"
        message="Please log in or create an account to continue to checkout."
      />
    );
  }

  if (submittedBooking) {
    // Only an RMS without the tiered-deposit change still creates Build Your Own bookings at ₱0
    // (staff set the amount later); nothing to pay or upload yet in that case.
    const depositNotYetDetermined = submittedBooking.depositCentavos <= 0;
    const myBookingsPath = `/my-bookings?booking=${encodeURIComponent(submittedBooking.bookingNumber)}`;

    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-10 sm:gap-8 sm:px-6 sm:py-16">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-serif text-xl font-semibold text-ink">Booking Request Submitted</h1>
          <p className="text-sm font-semibold text-accent">Booking #{submittedBooking.bookingNumber}</p>
          <p className="text-sm text-ink-muted">
            {depositNotYetDetermined
              ? 'Your booking request has been submitted and is awaiting review.'
              : 'A GearBnB staff member is now reviewing your documents.'}
          </p>
          {/* The RMS's own figure for this booking, never the site's estimate. */}
          {(submittedBooking.discountCentavos ?? 0) > 0 && (
            <p className="rounded-full bg-brand-forest/10 px-3 py-1 text-sm font-semibold text-accent">
              {PROMO_COPY.youSaved(formatCentavos(submittedBooking.discountCentavos ?? 0))}
            </p>
          )}
        </div>

        {depositNotYetDetermined ? (
          <div className="flex flex-col gap-3 text-center">
            <h2 className="font-serif text-lg font-semibold text-ink">Security Deposit: To Be Determined</h2>
            <p className="text-sm text-ink-muted">
              GearBnB will review your selections and let you know the required security deposit soon. Check My
              Bookings for updates, there's nothing to pay yet.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 text-center">
              <h2 className="font-serif text-lg font-semibold text-ink">Pay Your Security Deposit Now</h2>
              <p className="text-sm text-ink-muted">
                In the meantime, kindly pay your security deposit so we can reserve your gear as soon as your booking
                is approved.
              </p>
              <p className="text-sm text-ink-muted">
                If we can't approve your booking, your deposit is refunded in full. Once your booking is approved,
                refunds follow the rules in your rental agreement.{' '}
                {/* New tab: leaving this screen would lose the payment details and upload below. */}
                <a
                  href="/terms#deposit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent underline underline-offset-2"
                >
                  Read more about the security deposit
                </a>
              </p>
              <p className="text-3xl font-bold text-ink">{formatCurrency(submittedBooking.depositCentavos / 100)}</p>
              <button
                type="button"
                onClick={() =>
                  paymentSectionRef.current?.scrollIntoView({
                    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                    block: 'start',
                  })
                }
                className="mx-auto inline-flex min-h-11 items-center rounded-lg bg-brand-forest px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
              >
                Pay Now ↓
              </button>
            </div>

            {submittedBooking.depositDueAt && (
              <DepositCountdown
                depositDueAt={submittedBooking.depositDueAt}
                serverNow={submittedBooking.serverNow}
                proofStatus={proofSent ? 'PENDING_REVIEW' : null}
                verified={false}
              />
            )}

            {/* With the booking id (tiered-deposit RMS) the renter pays and uploads right here.
                Without it, the instructions are shown and the upload happens in My Bookings. */}
            {/* scroll-mt clears the sticky header when "Pay Now" scrolls here. */}
            <div ref={paymentSectionRef} className="flex scroll-mt-24 flex-col gap-6 sm:gap-8">
              {submittedBooking.bookingId ? (
                <DepositProofUpload
                  bookingId={submittedBooking.bookingId}
                  requiredCentavos={submittedBooking.depositCentavos}
                  verifiedCentavos={0}
                  verified={false}
                  proofStatus={proofSent ? 'PENDING_REVIEW' : null}
                  reviewNote={null}
                  amountClaimedCentavos={null}
                  addOnDepositCentavos={0}
                  isByoBooking={false}
                  hasPackageAddOns={false}
                  onProofSubmitted={() => setProofSent(true)}
                />
              ) : (
                <>
                  <PaymentInstructionsSection />
                  <p className="text-center text-sm text-ink-muted">
                    After paying, upload your proof of payment in My Bookings.
                  </p>
                </>
              )}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => navigate(depositNotYetDetermined ? '/my-bookings' : myBookingsPath)}
          className="w-full rounded-lg bg-brand-forest px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
        >
          View My Bookings
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6 sm:px-6 sm:py-8">
      {/* Only on the form itself — the post-submission confirmation above deliberately has no back
          link, since the booking already exists and returning to the cart would imply otherwise.
          Kept outside the white card below (page-level navigation, not part of the form content),
          same as every other back link on the site. */}
      <BackLink to="/cart" label="Back to Cart" />

      {/* One white "layer" behind the whole checkout flow — Trip Details, Verification, and
          Payment Breakdown together, not just one of them — same card treatment EventPlan.tsx
          already established (border/rounded/shadow on a `bg-surface` panel) applied to the
          entire form as a single piece instead of each section sitting directly on the page's
          bare background. divide-y keeps the same internal separation between sections that
          existed before, now as hairlines inside one card rather than gaps between bare sections. */}
      <div className="mt-4 flex w-full flex-col divide-y divide-line rounded-2xl border border-line bg-surface shadow-sm">
        <TripDetailsForm />
        <VerificationUpload
          onSubmit={() =>
            document.getElementById('payment-breakdown')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        />
        <div id="payment-breakdown">
          <PaymentBreakdown onSubmit={(result) => setSubmittedBooking(result)} />
        </div>
      </div>
    </div>
  );
}
