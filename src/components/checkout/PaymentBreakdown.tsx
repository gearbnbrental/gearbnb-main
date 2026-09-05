import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getItemPrice, getKitPrice, useRental } from '../../context/RentalContext';
import { supabase } from '../../supabase';
import { formatCurrency } from '../../utils/format';

/** Flat delivery fee placeholder — swap for real RMS-driven fulfillment pricing once defined. */
const DELIVERY_FEE = 150;

/** Combines a yyyy-mm-dd date and HH:MM time into an ISO timestamp, or null if either is missing/invalid. */
function toTimestamp(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) return null;
  const date = new Date(`${dateStr}T${timeStr}:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Maps raw Postgres/RPC error text to a customer-friendly message. */
function friendlyBookingError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid input syntax for type uuid') || normalized.includes('foreign key')) {
    return "One or more items in your cart aren't available for booking yet — our live inventory is still being set up. Please try again soon.";
  }
  return message;
}

function formatDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface SummaryCardProps {
  variant: 'primary' | 'secondary';
  eyebrow: string;
  title: string;
  amount: number;
  description: string;
}

function SummaryCard({ variant, eyebrow, title, amount, description }: SummaryCardProps) {
  const isPrimary = variant === 'primary';

  return (
    <div
      className={
        isPrimary
          ? 'flex flex-col gap-2 rounded-2xl bg-brand-forest p-5 text-white shadow-lg shadow-brand-forest/20'
          : 'flex flex-col gap-2 rounded-2xl border border-line bg-surface-muted p-5 text-ink'
      }
    >
      <span
        className={
          isPrimary
            ? 'text-xs font-semibold uppercase tracking-wide text-brand-cream'
            : 'text-xs font-semibold uppercase tracking-wide text-ink-muted'
        }
      >
        {eyebrow}
      </span>
      <span className={isPrimary ? 'text-sm font-medium text-brand-cream' : 'text-sm font-medium text-ink-muted'}>
        {title}
      </span>
      <span className="text-3xl font-bold tracking-tight">{formatCurrency(amount)}</span>
      <p className={isPrimary ? 'text-xs text-brand-cream' : 'text-xs text-ink-muted'}>{description}</p>
    </div>
  );
}

interface BreakdownRowProps {
  label: string;
  sublabel: string;
  feeAmount: number;
  depositAmount: number | null;
}

function BreakdownRow({ label, sublabel, feeAmount, depositAmount }: BreakdownRowProps) {
  return (
    <>
      <div className="flex flex-col">
        <span className="font-medium text-ink">{label}</span>
        <span className="text-xs text-ink-muted">{sublabel}</span>
      </div>
      <span className="self-start text-right text-ink">{formatCurrency(feeAmount)}</span>
      <span className="self-start text-right text-ink-muted">
        {depositAmount === null ? '—' : formatCurrency(depositAmount)}
      </span>
    </>
  );
}

interface PaymentBreakdownProps {
  onSubmit?: (bookingNumber: string | null) => void;
}

export default function PaymentBreakdown({ onSubmit }: PaymentBreakdownProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { cart, totals } = useRental();
  const { selectedKits, selectedItems, tripDetails, verificationDocs } = cart;

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isDelivery = tripDetails.fulfillmentType === 'delivery';
  const fulfillmentFee = isDelivery ? DELIVERY_FEE : 0;
  const rentalFeeTotal = totals.dueBeforeStart + fulfillmentFee;

  const hasSelection = selectedKits.length > 0 || selectedItems.length > 0;
  const formattedStartDate = formatDate(tripDetails.startDate);

  async function handleSubmit() {
    if (!hasSelection) return;
    setSubmitError(null);

    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    const pickupAt = toTimestamp(tripDetails.startDate, tripDetails.preferredTime);
    const returnAt = toTimestamp(tripDetails.returnDate, tripDetails.preferredTime);

    if (!pickupAt || !returnAt) {
      setSubmitError('Please fill in your rental start/return dates and preferred time in Trip Details.');
      return;
    }
    if (!verificationDocs.fullName || !verificationDocs.phone || !verificationDocs.email) {
      setSubmitError('Please complete your contact information in Identity Verification before confirming.');
      return;
    }

    setSubmitting(true);

    const { data, error } = await supabase.rpc('create_booking', {
      // Destination picker was removed from the checkout form — see note to admin re: whether
      // Booking.destinationId can accept null or needs a server-side default.
      p_destination_id: null,
      p_pickup_at: pickupAt,
      p_return_at: returnAt,
      p_full_name: verificationDocs.fullName,
      p_phone: verificationDocs.phone,
      p_email: verificationDocs.email,
      p_packages: selectedKits.map((kit) => ({
        package_id: kit.id,
        quantity: 1,
        unit_price_centavos: Math.round(getKitPrice(kit, tripDetails) * 100),
        unit_deposit_centavos: Math.round(kit.depositAmount * 100),
      })),
      p_gears: selectedItems.map((item) => ({
        rentable_gear_id: item.id,
        quantity: 1,
        unit_price_centavos: Math.round(getItemPrice(item, tripDetails) * 100),
        unit_deposit_centavos: Math.round(item.depositAmount * 100),
      })),
    });

    setSubmitting(false);

    if (error) {
      setSubmitError(friendlyBookingError(error.message));
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    onSubmit?.(result?.booking_number ?? null);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-xl font-semibold text-ink">Payment Breakdown</h1>
        <p className="text-sm text-ink-muted">Review your split payment before submitting your booking request.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard
          variant="primary"
          eyebrow="Due Today"
          title="Security Deposit Total"
          amount={totals.dueToday}
          description="Refundable deposit to lock in your reservation."
        />
        <SummaryCard
          variant="secondary"
          eyebrow="Due Before Rental Start Date"
          title="Rental Fee Total"
          amount={rentalFeeTotal}
          description={
            formattedStartDate
              ? `Pay in full before ${formattedStartDate}${
                  totals.rentalDurationDays > 0 ? ` · ${totals.rentalDurationDays}-day rental` : ''
                }`
              : 'Pay in full before your trip starts.'
          }
        />
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Itemized Breakdown</h2>

        {hasSelection ? (
          <>
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-3 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Item</span>
              <span className="text-right text-xs font-medium uppercase tracking-wide text-ink-faint">Rental Fee</span>
              <span className="text-right text-xs font-medium uppercase tracking-wide text-ink-faint">Deposit</span>

              {selectedKits.map((kit) => (
                <BreakdownRow
                  key={kit.id}
                  label={kit.name}
                  sublabel="Package"
                  feeAmount={getKitPrice(kit, tripDetails)}
                  depositAmount={kit.depositAmount}
                />
              ))}

              {selectedKits.flatMap((kit) => {
                const selectedExtraIds = cart.kitExtras[kit.id] ?? [];
                return (kit.extras ?? [])
                  .filter((extra) => selectedExtraIds.includes(extra.id))
                  .map((extra) => (
                    <BreakdownRow
                      key={extra.id}
                      label={extra.name}
                      sublabel={`${kit.name} add-on`}
                      feeAmount={extra.price}
                      depositAmount={null}
                    />
                  ));
              })}

              {selectedItems.map((item) => (
                <BreakdownRow
                  key={item.id}
                  label={item.name}
                  sublabel="Individual Gear"
                  feeAmount={getItemPrice(item, tripDetails)}
                  depositAmount={item.depositAmount}
                />
              ))}

              <BreakdownRow
                label={isDelivery ? 'Delivery Fee' : 'Pickup'}
                sublabel={
                  isDelivery
                    ? tripDetails.deliveryAddress || 'Delivered to your address'
                    : 'No fee for in-store pickup'
                }
                feeAmount={fulfillmentFee}
                depositAmount={null}
              />
            </div>

            <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink-muted">Security Deposit Subtotal</span>
                <span className="font-semibold text-ink">{formatCurrency(totals.dueToday)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink-muted">Rental Fee Subtotal</span>
                <span className="font-semibold text-ink">{formatCurrency(rentalFeeTotal)}</span>
              </div>
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">
            Your cart is empty. Add a package or individual gear to see your payment breakdown.
          </p>
        )}
      </section>

      {submitError && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {submitError}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!hasSelection || submitting}
        className="w-full rounded-lg bg-brand-forest px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:cursor-not-allowed disabled:bg-surface-strong"
      >
        {submitting ? 'Confirming…' : 'Confirm Rental →'}
      </button>
    </div>
  );
}
