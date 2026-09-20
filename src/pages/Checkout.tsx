import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthRequiredMessage from '../components/AuthRequiredMessage';
import BackLink from '../components/BackLink';
import { PaymentInstructionsSection } from '../components/checkout/DepositProofUpload';
import TripDetailsForm from '../components/checkout/TripDetailsForm';
import VerificationUpload from '../components/checkout/VerificationUpload';
import PaymentBreakdown from '../components/checkout/PaymentBreakdown';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/format';
import type { RmsBookingResult } from '../utils/rmsApi';

export default function Checkout() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [submittedBooking, setSubmittedBooking] = useState<RmsBookingResult | null>(null);

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
    // A booking with no computed deposit yet is a Build Your Own submission — RMS always starts
    // those at ₱0 until an admin manually reviews and sets the real amount (see PaymentBreakdown's
    // isByoOnly / requirement 13). There's nothing to pay or upload yet in that case.
    const depositNotYetDetermined = submittedBooking.depositCentavos <= 0;

    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-10 sm:gap-8 sm:px-6 sm:py-16">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-serif text-xl font-semibold text-ink">Booking Request Submitted</h1>
          <p className="text-sm font-semibold text-accent">Booking #{submittedBooking.bookingNumber}</p>
          <p className="text-sm text-ink-muted">Your booking request has been submitted and is awaiting review.</p>
        </div>

        {depositNotYetDetermined ? (
          <div className="flex flex-col gap-3 text-center">
            <h2 className="font-serif text-lg font-semibold text-ink">Security Deposit: To Be Determined</h2>
            <p className="text-sm text-ink-muted">
              GearBnB will review your selections and let you know the required security deposit soon. Check My
              Bookings for updates — there's nothing to pay yet.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 text-center">
              <h2 className="font-serif text-lg font-semibold text-ink">Security Deposit Required</h2>
              <p className="text-sm text-ink-muted">
                To secure your rental, please pay the security deposit below and upload your proof of payment from
                My Bookings.
              </p>
              <p className="text-3xl font-bold text-ink">{formatCurrency(submittedBooking.depositCentavos / 100)}</p>
            </div>

            {/* Instructions only here — uploading proof requires the booking's confirmed record,
             * which this screen doesn't have yet (only bookingNumber is returned on creation).
             * The upload step itself lives on My Bookings, where the real booking record is fetched. */}
            <PaymentInstructionsSection />
          </>
        )}

        <button
          type="button"
          onClick={() => navigate('/my-bookings')}
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
