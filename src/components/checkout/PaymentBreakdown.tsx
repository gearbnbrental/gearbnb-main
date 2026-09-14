import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ConfirmDialog from '../ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import {
  byoGearKey,
  calculateByoAddOnsFee,
  calculateByoGearsFee,
  filterCartToSelection,
  getGearKindPrice,
  getItemPrice,
  getKitPrice,
  isVerificationComplete,
  useRental,
} from '../../context/RentalContext';
import { REQUIRED_VERIFICATION_DOCUMENTS } from '../../context/RentalContext';
import { formatCurrency } from '../../utils/format';
import {
  describeRmsError,
  VERIFICATION_KIND_MAP,
  submitBookingToRms,
  type RmsBookingGearLine,
  type RmsBookingResult,
} from '../../utils/rmsApi';

/**
 * The RMS's own gear catalog blanks a "Generic" inventory brand to an empty string for customer
 * display (see cleanBrand() in the RMS's src/server/catalog/service.ts â€” "never meant to reach a
 * customer"). Its booking schema, however, requires a non-empty brand, and its inventory lookup is
 * keyed on the real underlying value, which is always the literal "Generic" whenever the display
 * value was blanked. Restoring it here â€” submission only, never display â€” is what makes the
 * payload conform to the existing RMS contract; sending the blanked "" fails validation with
 * "String must contain at least 1 character(s)".
 */
function toRmsBrand(brand: string): string {
  return brand.trim() === '' ? 'Generic' : brand;
}

/** Combines a yyyy-mm-dd date and HH:MM time into an ISO timestamp, or null if either is missing/invalid. */
function toTimestamp(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) return null;
  const date = new Date(`${dateStr}T${timeStr}:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
  /** Null renders "To be determined" instead of a peso amount â€” for the Build Your Own deposit,
   * whose real amount doesn't exist yet (see requirement 13/20). */
  amount: number | null;
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
            ? 'text-xs font-semibold uppercase tracking-wide text-white'
            : 'text-xs font-semibold uppercase tracking-wide text-ink-muted'
        }
      >
        {eyebrow}
      </span>
      <span className={isPrimary ? 'text-sm font-medium text-white' : 'text-sm font-medium text-ink-muted'}>
        {title}
      </span>
      <span className={amount === null ? 'text-xl font-bold tracking-tight' : 'text-3xl font-bold tracking-tight'}>
        {amount === null ? 'To Be Determined' : formatCurrency(amount)}
      </span>
      <p className={isPrimary ? 'text-xs text-white' : 'text-xs text-ink-muted'}>{description}</p>
    </div>
  );
}

interface BreakdownRowProps {
  label: string;
  sublabel: string;
  /** Null renders "â€”" â€” for a cost that isn't â‚±0, just not charged by GearBnB (e.g. a customer's
   *  own Grab booking), so it's never shown as if GearBnB confirmed a â‚±0.00 price for it. */
  feeAmount: number | null;
  depositAmount: number | null;
}

function BreakdownRow({ label, sublabel, feeAmount, depositAmount }: BreakdownRowProps) {
  return (
    <>
      <div className="flex flex-col">
        <span className="font-medium text-ink">{label}</span>
        <span className="text-xs text-ink-muted">{sublabel}</span>
      </div>
      <span className="self-start text-right text-ink">{feeAmount === null ? 'â€”' : formatCurrency(feeAmount)}</span>
      <span className="self-start text-right text-ink-muted">
        {depositAmount === null ? 'â€”' : formatCurrency(depositAmount)}
      </span>
    </>
  );
}

interface PaymentBreakdownProps {
  onSubmit?: (result: RmsBookingResult) => void;
}

export default function PaymentBreakdown({ onSubmit }: PaymentBreakdownProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { cart, totals } = useRental();
  // Scoped to only what's checked for checkout on the Cart page â€” an unchecked package or BYO
  // item saved for later must never appear in the itemized breakdown or the booking submission.
  const selectedCart = filterCartToSelection(cart);
  const { selectedKits, selectedItems, kitExtras, itemExtras, byoGears, byoAddOns, tripDetails, verificationDocs } =
    selectedCart;

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Generated once per mount and reused across retries of the same attempt â€” this is what makes
  // a double-click or a retried network request idempotent on the RMS side, rather than creating
  // a second booking. A genuinely new checkout (new page load) gets a fresh key.
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const isDelivery = tripDetails.fulfillmentType === 'delivery';

  const hasPackage = selectedKits.length > 0;
  const hasByoGear = byoGears.length > 0;
  // A pure-BYO cart never has a computed deposit â€” RMS starts every Build Your Own booking at
  // â‚±0 and an admin sets the real amount manually after review (see requirement 13's workflow).
  // Showing "â‚±0" unqualified would read as "no deposit required," which isn't true.
  const isByoOnly = hasByoGear && !hasPackage;

  const hasSelection = hasPackage || hasByoGear || selectedItems.length > 0;
  const formattedStartDate = formatDate(tripDetails.startDate);

  // The RMS customer API accepts either a single package OR a Build Your Own selection per
  // submission â€” never both at once (the RMS route takes packageCode over bookingGears if both
  // were somehow sent, silently ignoring the BYO selection, so this site must never send both).
  // Package add-ons, more than one package, and the old individual-gear (pre-BYO) cart slot
  // remain unsupported â€” none of these are silently dropped: submission is blocked with an
  // explicit reason instead, per instruction not to discard checkout data quietly.
  const hasAnyKitExtras = Object.values(kitExtras).some((ids) => ids.length > 0);
  const unsupportedReason =
    selectedItems.length > 0
      ? "Individual gear added the old way isn't supported through online checkout â€” please remove it from your cart, or use Build Your Own instead."
      : hasPackage && hasByoGear
        ? 'Please choose either a Package or Build Your Own for this booking â€” not both. Remove one before submitting.'
        : selectedKits.length > 1
          ? 'Only one package can be booked per online submission right now â€” please remove extra packages from your cart.'
          : hasPackage && hasAnyKitExtras
            ? "Package add-ons aren't yet supported through online checkout â€” please remove them from your cart, or contact us directly to add them to your booking."
            : null;

  /**
   * Runs every pre-submission check and, only once all of them pass, opens the confirmation
   * dialog â€” submitting a booking creates a real, permanent record (see requirement to confirm
   * before it), so nothing here actually calls the RMS yet. performSubmit (below) is what the
   * dialog's own Confirm button runs.
   */
  function validateAndConfirm() {
    if (!hasSelection) return;
    setSubmitError(null);

    if (!user) {
      navigate('/login', {
        state: {
          from: location.pathname,
          mode: 'login',
          reason: 'Please log in or create an account to submit your booking.',
        },
      });
      return;
    }

    if (unsupportedReason) {
      setSubmitError(unsupportedReason);
      return;
    }

    const pickupAt = toTimestamp(tripDetails.startDate, tripDetails.preferredTime);
    const returnAt = toTimestamp(tripDetails.returnDate, tripDetails.preferredTime);

    if (!pickupAt || !returnAt) {
      setSubmitError('Please fill in your rental start/return dates and preferred time in Trip Details.');
      return;
    }
    if (!tripDetails.destination.trim()) {
      setSubmitError('Please fill in your destination/venue in Trip Details.');
      return;
    }
    // Identity verification is a hard gate: contact details, every required document slot
    // successfully uploaded, terms (and, for a BYO booking, the BYO Rental Agreement) acceptance,
    // and an explicit save of that section. Artifact-agnostic by design â€” it never inspects what
    // kind of file fills a slot.
    if (!isVerificationComplete(verificationDocs, isByoOnly)) {
      setSubmitError(
        isByoOnly
          ? 'Please complete the Identity Verification section above â€” all documents, contact details, Terms & Conditions acceptance, and BYO Rental Agreement acceptance are required, then save that section before confirming.'
          : 'Please complete the Identity Verification section above â€” all documents, contact details, and Terms & Conditions acceptance are required, then save that section before confirming.',
      );
      return;
    }
    // Defensive: a kit can only reach the cart while in stock, but stock status can change
    // after it was added (e.g. a stale tab) â€” never let an out-of-stock item through to booking.
    const outOfStockName = selectedKits.find((kit) => kit.isOutOfStock)?.name;
    if (outOfStockName) {
      setSubmitError(`${outOfStockName} just went out of stock and was removed from availability â€” please remove it from your cart and try again.`);
      return;
    }

    setShowSubmitConfirm(true);
  }

  async function performSubmit() {
    const pickupAt = toTimestamp(tripDetails.startDate, tripDetails.preferredTime);
    const returnAt = toTimestamp(tripDetails.returnDate, tripDetails.preferredTime);
    // Both are already known-valid â€” validateAndConfirm only reaches setShowSubmitConfirm(true)
    // after checking them, and nothing between that check and this call can change tripDetails
    // (the dialog is a modal overlay; the Trip Details form behind it isn't interactive).
    if (!pickupAt || !returnAt) return;

    const baseBooking = {
      destination: tripDetails.destination.trim(),
      pickupAt,
      returnAt,
      fulfillmentType: isDelivery ? ('DELIVERY' as const) : ('PICKUP' as const),
      deliveryAddress: isDelivery ? tripDetails.deliveryAddress : undefined,
      // RMS "required-when-sent" enforcement (see RmsBookingSubmission's own comment): send `true`
      // only when actually accepted, omit otherwise, never send `false`. termsAccepted and
      // byoAgreementAccepted are two independent, mutually exclusive agreements (the Kit "Terms &
      // Conditions" PDF vs. the standalone "BYO Rental Agreement" PDF â€” neither an addendum to the
      // other) â€” a package booking sends only termsAccepted, a BYO booking sends only
      // byoAgreementAccepted, matching customerPortalBookingSchema's own refines server-side. The
      // submission gate above (isVerificationComplete) already required whichever one applies to
      // reach this point, so these read straight from that same already-verified checkbox state
      // rather than being hardcoded true. The RMS generates and records the authoritative
      // termsAcceptedAt/termsVersion/byoAgreementAcceptedAt/byoAgreementVersion itself; nothing
      // here invents a version or a timestamp.
      termsAccepted: !isByoOnly && verificationDocs.termsAccepted ? (true as const) : undefined,
      byoAgreementAccepted: isByoOnly && verificationDocs.byoAgreementAccepted ? (true as const) : undefined,
    };

    // Estimates only, either way â€” the RMS always recomputes the authoritative amounts itself
    // (from the package's own price fields, or from each selected gear kind's own price fields
    // for Build Your Own) before writing the booking; these are never trusted server-side.
    const booking = hasPackage
      ? {
          ...baseBooking,
          packageCode: selectedKits[0].packageNumber,
          estimatedRentalFeeCentavos: Math.round(getKitPrice(selectedKits[0], tripDetails) * 100),
          estimatedDepositCentavos: Math.round(selectedKits[0].depositAmount * 100),
        }
      : {
          ...baseBooking,
          bookingGears: byoGears.map(
            (gear): RmsBookingGearLine => ({
              category: gear.category,
              brand: toRmsBrand(gear.brand),
              model: gear.model,
              quantity: gear.quantity,
            }),
          ),
          addOns: byoGears.flatMap((gear) =>
            (byoAddOns[byoGearKey(gear)] ?? []).map(
              (addOn): RmsBookingGearLine => ({
                category: addOn.category,
                brand: toRmsBrand(addOn.brand),
                model: addOn.model,
                quantity: addOn.quantity,
              }),
            ),
          ),
          estimatedRentalFeeCentavos: Math.round(
            (calculateByoGearsFee(selectedCart) + calculateByoAddOnsFee(selectedCart)) * 100,
          ),
          // Build Your Own never computes or sends a deposit â€” see requirement 13. RMS itself
          // always writes depositCentavos = 0 for a BYO booking regardless of what's sent here;
          // an admin sets the real amount manually after review.
          estimatedDepositCentavos: 0,
        };

    setSubmitting(true);
    try {
      const result = await submitBookingToRms(
        {
          contact: { fullName: verificationDocs.fullName, phone: verificationDocs.phone },
          booking,
          verificationDocuments: REQUIRED_VERIFICATION_DOCUMENTS.map((key) => ({
            kind: VERIFICATION_KIND_MAP[key],
            // Safe: isVerificationComplete already required a non-null storagePath for every key.
            storagePath: verificationDocs.documents[key]!.storagePath!,
          })),
        },
        idempotencyKeyRef.current,
      );
      setShowSubmitConfirm(false);
      onSubmit?.(result);
    } catch (err) {
      // Closes the dialog so the page's own error banner (rendered below the submit button,
      // otherwise hidden behind the modal overlay) is visible again â€” the customer can then fix
      // whatever's wrong and re-open the confirmation once ready to retry.
      setShowSubmitConfirm(false);
      setSubmitError(describeRmsError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-xl font-semibold text-ink">Payment Breakdown</h1>
        <p className="text-sm text-ink-muted">Review your split payment before submitting your booking request.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard
          variant="primary"
          eyebrow="Due Today"
          title="Security Deposit Total"
          amount={isByoOnly ? null : totals.dueToday}
          description={
            isByoOnly
              ? 'GearBnB will determine your security deposit after reviewing your Build Your Own selections.'
              : 'Refundable deposit to lock in your reservation.'
          }
        />
        <SummaryCard
          variant="secondary"
          eyebrow="Due Before Rental Start Date"
          title="Rental Fee Total"
          amount={totals.dueBeforeStart}
          description={
            formattedStartDate
              ? `Pay in full before ${formattedStartDate}${
                  totals.rentalDurationDays > 0 ? ` Â· ${totals.rentalDurationDays}-day rental` : ''
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
                const selectedExtraIds = kitExtras[kit.id] ?? [];
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

              {selectedItems.flatMap((item) => {
                const selectedExtraIds = itemExtras[item.id] ?? [];
                return (item.paidAddOns ?? [])
                  .filter((addOn) => selectedExtraIds.includes(addOn.id))
                  .map((addOn) => (
                    <BreakdownRow
                      key={addOn.id}
                      label={addOn.name}
                      sublabel={`${item.name} add-on`}
                      feeAmount={addOn.price}
                      depositAmount={null}
                    />
                  ));
              })}

              {byoGears.map((gear) => {
                const key = byoGearKey(gear);
                return (
                  <BreakdownRow
                    key={key}
                    label={gear.name}
                    sublabel={`Build Your Own${gear.quantity > 1 ? ` Â· ${gear.quantity}Ã—` : ''}`}
                    feeAmount={getGearKindPrice(gear, tripDetails) * gear.quantity}
                    depositAmount={null}
                  />
                );
              })}

              {byoGears.flatMap((gear) =>
                (byoAddOns[byoGearKey(gear)] ?? []).map((addOn) => (
                  <BreakdownRow
                    key={`${byoGearKey(gear)}::${byoGearKey(addOn)}`}
                    label={addOn.name}
                    sublabel={`${gear.name} add-on${addOn.quantity > 1 ? ` Â· ${addOn.quantity}Ã—` : ''}`}
                    feeAmount={getGearKindPrice(addOn, tripDetails) * addOn.quantity}
                    depositAmount={null}
                  />
                )),
              )}

              <BreakdownRow
                label={isDelivery ? 'Grab' : 'Pickup'}
                sublabel={
                  isDelivery
                    ? 'GearBnB does not charge or arrange this â€” you book and pay for your own Grab.'
                    : 'No fee for in-store pickup'
                }
                feeAmount={isDelivery ? null : 0}
                depositAmount={null}
              />
            </div>

            <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink-muted">Security Deposit Subtotal</span>
                <span className="font-semibold text-ink">
                  {isByoOnly ? 'To Be Determined' : formatCurrency(totals.dueToday)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink-muted">Rental Fee Subtotal</span>
                <span className="font-semibold text-ink">{formatCurrency(totals.dueBeforeStart)}</span>
              </div>
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">
            Your cart is empty. Add a package or build your own to see your payment breakdown.
          </p>
        )}
      </section>

      {hasSelection && (
        <section className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Booking Summary</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-muted">Rental Dates</dt>
            <dd className="text-right font-medium text-ink">
              {formattedStartDate && formatDate(tripDetails.returnDate)
                ? `${formattedStartDate} â€“ ${formatDate(tripDetails.returnDate)}`
                : 'Not yet set'}
              {totals.rentalDurationDays > 0 && ` Â· ${totals.rentalDurationDays}-day`}
            </dd>

            <dt className="text-ink-muted">Fulfillment</dt>
            <dd className="text-right font-medium text-ink">{isDelivery ? 'Grab Delivery' : 'Self Pickup'}</dd>

            {isDelivery && (
              <>
                <dt className="text-ink-muted">Delivery Address</dt>
                <dd className="text-right font-medium text-ink">
                  {tripDetails.deliveryAddress.trim() || 'Not yet set'}
                </dd>
              </>
            )}

            <dt className="text-ink-muted">Identity Verification</dt>
            <dd className="text-right font-medium text-ink">
              {isVerificationComplete(verificationDocs, isByoOnly) ? 'Complete' : 'Incomplete â€” see above'}
            </dd>

            <dt className="text-ink-muted">Terms &amp; Conditions</dt>
            <dd className="text-right font-medium text-ink">
              {verificationDocs.termsAccepted ? 'Accepted' : 'Not yet accepted'}
            </dd>

            {isByoOnly && (
              <>
                <dt className="text-ink-muted">BYO Rental Agreement</dt>
                <dd className="text-right font-medium text-ink">
                  {verificationDocs.byoAgreementAccepted ? 'Accepted' : 'Not yet accepted'}
                </dd>
              </>
            )}
          </dl>
        </section>
      )}

      {!submitError && unsupportedReason && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
          {unsupportedReason}
        </p>
      )}

      {submitError && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {submitError}
        </p>
      )}

      <button
        type="button"
        onClick={validateAndConfirm}
        disabled={!hasSelection || submitting}
        className="w-full rounded-lg bg-brand-forest px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:cursor-not-allowed disabled:bg-surface-strong"
      >
        {submitting ? 'Submittingâ€¦' : 'Submit Booking Request â†’'}
      </button>

      <ConfirmDialog
        open={showSubmitConfirm}
        title="Submit this booking request?"
        message="This creates a real booking request with GearBnB â€” you won't be able to edit your selections here once submitted."
        confirmLabel="Submit Booking Request"
        onCancel={() => setShowSubmitConfirm(false)}
        onConfirm={performSubmit}
      />
    </div>
  );
}
