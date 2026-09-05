import { useState } from 'react';
import TripDetailsForm from '../components/checkout/TripDetailsForm';
import VerificationUpload from '../components/checkout/VerificationUpload';
import PaymentBreakdown from '../components/checkout/PaymentBreakdown';

export default function Checkout() {
  const [submittedBookingNumber, setSubmittedBookingNumber] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (isSubmitted) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 px-4 py-20 text-center sm:px-6">
        <h1 className="font-serif text-xl font-semibold text-ink">Booking Request Submitted</h1>
        {submittedBookingNumber && (
          <p className="text-sm font-semibold text-brand-forest">Booking #{submittedBookingNumber}</p>
        )}
        <p className="text-sm text-ink-muted">
          Your booking is now in <span className="font-semibold">Pending</span> status. We'll review your
          documents and send payment instructions shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-line">
      <TripDetailsForm />
      <VerificationUpload />
      <PaymentBreakdown
        onSubmit={(bookingNumber) => {
          setSubmittedBookingNumber(bookingNumber);
          setIsSubmitted(true);
        }}
      />
    </div>
  );
}
