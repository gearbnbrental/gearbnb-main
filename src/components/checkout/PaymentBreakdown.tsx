import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ConfirmDialog from '../ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import {
  byoGearKey,
  calculateByoAddOnsFee,
  calculateByoGearsFee,
  calculatePackageAddOnsFee,
  filterCartToSelection,
  getGearKindPrice,
  getItemPrice,
  getKitPrice,
  isVerificationComplete,
  useRental,
} from '../../context/RentalContext';
import { REQUIRED_VERIFICATION_DOCUMENTS } from '../../context/RentalContext';
import { toAvailabilityTimestamp, toTimestamp } from '../../utils/duration';
import { formatCurrency } from '../../utils/format';
import {
  classifyBookingSubmitError,
  ensureFreshSession,
  VERIFICATION_KIND_MAP,
  submitBookingToRms,
  toRmsBrand,
  type RmsAvailabilityIssue,
  type RmsAvailabilityRequest,
  type RmsAvailabilityResult,
  type RmsBookingGearLine,
  type RmsBookingResult,
  type RmsPendingTurnoverNotice,
} from '../../utils/rmsApi';
import { clearAvailabilityCache, requestAvailabilityCheck, useAvailabilityCheck } from '../../hooks/useAvailabilityCheck';
import { cleanGearName } from '../../utils/gearName';
import { describeAvailabilityIssue } from '../../utils/availabilityIssue';

function formatDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  // dateStr is a plain yyyy-mm-dd calendar date, parsed as UTC midnight — formatted in UTC so it
  // never shifts a day in a browser west of UTC.
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/**
 * `crypto.randomUUID()` is restricted to secure contexts (HTTPS, or localhost) by every major
 * browser, even though `crypto` itself is always defined. A customer reached over plain HTTP —
 * e.g. a phone on the LAN dev server's IP address, which is neither HTTPS nor localhost — hits
 * `crypto.randomUUID is not a function` here, and since this ran inside `useRef`'s initializer it
 * threw on this component's very first render: an uncaught exception on every Checkout visit, not
 * a flaky one a retry could fix. `crypto.getRandomValues()` carries no such secure-context
 * restriction, so it's used to build a spec-compliant (RFC 4122) v4 UUID whenever the shortcut
 * isn't available. This id becomes RMS's idempotency key below, so both branches still have to
 * come from a cryptographically secure random source — never `Math.random()`.
 */
function generateIdempotencyKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

interface SummaryCardProps {
  variant: 'primary' | 'secondary';
  eyebrow: string;
  title: string;
  /** Null renders "To be determined" instead of a peso amount — for the Build Your Own deposit,
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
  /** Null renders "—" — for a cost that isn't ₱0, just not charged by GearBnB (e.g. a customer's
   *  own Grab booking), so it's never shown as if GearBnB confirmed a ₱0.00 price for it. */
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
      <span className="self-start text-right text-ink">{feeAmount === null ? '—' : formatCurrency(feeAmount)}</span>
      <span className="self-start text-right text-ink-muted">
        {depositAmount === null ? '—' : formatCurrency(depositAmount)}
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
  // Scoped to only what's checked for checkout on the Cart page — an unchecked package or BYO
  // item saved for later must never appear in the itemized breakdown or the booking submission.
  const selectedCart = filterCartToSelection(cart);
  const {
    selectedKits,
    selectedItems,
    kitExtras,
    packageAddOns,
    itemExtras,
    byoGears,
    byoAddOns,
    tripDetails,
    verificationDocs,
  } = selectedCart;

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Generated once per mount and reused across retries of the same attempt — this is what makes
  // a double-click or a retried network request idempotent on the RMS side, rather than creating
  // a second booking. A genuinely new checkout (new page load) gets a fresh key.
  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey());

  const isDelivery = tripDetails.fulfillmentType === 'delivery';

  const hasPackage = selectedKits.length > 0;
  const hasByoGear = byoGears.length > 0;
  // A pure-BYO cart never has a computed deposit — RMS starts every Build Your Own booking at
  // ₱0 and an admin sets the real amount manually after review (see requirement 13's workflow).
  // Showing "₱0" unqualified would read as "no deposit required," which isn't true.
  const isByoOnly = hasByoGear && !hasPackage;
  // Whether the selected package has any extra rentable inventory attached on top of it — the
  // customer website never computes THIS deposit; a GearBnB staff member decides, after reviewing
  // the specific add-ons, whether anything beyond the package's own deposit (shown below, already
  // an RMS-authoritative figure) is required. Requiring `hasPackage` means this can never be true
  // for a BYO-only cart, which already has its own separate "To Be Determined" story via
  // `isByoOnly` above. Mirrors `hasAnyKitExtras`' own Object.values(...).some(...) pattern just
  // above it — `packageAddOns` here is already `selectedCart.packageAddOns`, scoped by
  // filterCartToSelection to only the checked selection, so this can never react to an unchecked
  // kit's add-ons sitting elsewhere in the cart.
  const hasPackageAddOns = hasPackage && Object.values(packageAddOns).some((gears) => gears.length > 0);

  const hasSelection = hasPackage || hasByoGear || selectedItems.length > 0;
  const formattedStartDate = formatDate(tripDetails.startDate);

  // A booking is either a package (optionally carrying extra rentable inventory, which the RMS now
  // validates, prices and reserves when sent as bookingGears[] alongside packageCode) or a Build
  // Your Own selection — never a package plus a separate BYO cart, which remain two distinct
  // customer flows. Note this guard reads `byoGears` specifically: extra inventory attached to a
  // package lives in `packageAddOns` and is submitted as that package's own bookingGears below, so
  // it is never caught here. More than one package and the old individual-gear (pre-BYO) cart slot
  // remain unsupported — none of these are silently dropped: submission is blocked with an
  // explicit reason instead, per instruction not to discard checkout data quietly.
  const hasAnyKitExtras = Object.values(kitExtras).some((ids) => ids.length > 0);
  const unsupportedReason =
    selectedItems.length > 0
      ? "Individual gear added the old way isn't supported through online checkout, please remove it from your cart, or use Build Your Own instead."
      : hasPackage && hasByoGear
        ? 'Please choose either a Package or Build Your Own for this booking, not both. Remove one before submitting.'
        : selectedKits.length > 1
          ? 'Only one package can be booked per online submission right now, please remove extra packages from your cart.'
          : hasPackage && hasAnyKitExtras
            ? "Package add-ons aren't yet supported through online checkout, please remove them from your cart, or contact us directly to add them to your booking."
            : null;

  /** RMS-confirmed availability for the customer's actual current checkout selection — never
   *  trusted from whatever the catalog page last saw, since a package/gear can be reserved by
   *  someone else at any point after it was added to this cart (see PathACatalog/PathBCatalog's
   *  own identical `RmsAvailabilityState` pattern, reused here rather than inventing a second
   *  shape). 'idle' covers "nothing to check yet" (no dates, or an empty cart) so the UI never
   *  claims a false "available" before the customer has even chosen dates. 'error' is deliberately
   *  distinct from 'unavailable': a network/RMS hiccup while checking is not the same claim as "RMS
   *  confirmed this is taken," and conflating the two would misdescribe a connectivity problem as
   *  an inventory one. */
  type CheckoutAvailabilityState =
    | { status: 'idle' }
    | { status: 'checking' }
    | { status: 'available' }
    /** RMS's own `available: true` (the dates are fine) but `currentlyReservable: false` — enough
     *  date-free stock exists, but not enough of it is in RMS's AVAILABLE inventory status right
     *  now (e.g. mid-cleaning/maintenance), so RMS's own final reservation would still reject this
     *  exact selection if submitted this instant. Never the same as 'unavailable' below — the
     *  dates themselves are genuinely fine, and RMS may still let this same selection through
     *  once the affected equipment is actually turned over — but the customer must not be told
     *  this is simply ready to book. */
    | { status: 'pending_turnover'; pendingTurnover: RmsPendingTurnoverNotice[] }
    | { status: 'unavailable'; issues: RmsAvailabilityIssue[] }
    | { status: 'error' };

  /** Turns one RMS availability response into the local UI state above — shared by the background
   *  check and the fresh submit-time check (validateAndConfirm) so the `available`/
   *  `currentlyReservable`/`pendingTurnover` → UI-state derivation can never drift between the two,
   *  per RMS's own field meanings (see RmsAvailabilityResult's own doc comment): `available` is
   *  the date-availability answer, `currentlyReservable` is the separate "is there currently
   *  enough AVAILABLE-status stock" answer, and this never conflates the two. `currentlyReservable`
   *  is optional on the RMS type (an older RMS response predating this field won't send it) —
   *  missing is treated as "no extra signal," i.e. the same 'available' outcome this check already
   *  produced before the field existed, never silently assumed true OR used to invent a block that
   *  RMS itself never actually reported. */
  function resolveCheckoutAvailability(result: RmsAvailabilityResult): CheckoutAvailabilityState {
    if (!result.available) return { status: 'unavailable', issues: result.issues };
    if (result.currentlyReservable === false) {
      return { status: 'pending_turnover', pendingTurnover: result.pendingTurnover ?? [] };
    }
    return { status: 'available' };
  }

  const pickupDateOnly = tripDetails.startDate;
  const returnDateOnly = tripDetails.returnDate;

  // Extra rentable inventory attached to the selected package (mirrors performSubmit's own package
  // branch below) — never `addOns`, which is reserved for gear attached to a BYO selection; this is
  // the exact same category/brand/model/quantity mapping performSubmit uses for the real
  // submission, so what gets checked here is what would actually be booked.
  const checkoutBookingGears: RmsBookingGearLine[] = hasPackage
    ? (packageAddOns[selectedKits[0]?.id ?? ''] ?? []).map((gear) => ({
        category: gear.category,
        brand: toRmsBrand(gear.brand),
        model: gear.model,
        quantity: gear.quantity,
      }))
    : byoGears.map((gear) => ({
        category: gear.category,
        brand: toRmsBrand(gear.brand),
        model: gear.model,
        quantity: gear.quantity,
        ...(gear.color ? { color: gear.color } : {}),
      }));
  const checkoutAddOns: RmsBookingGearLine[] = hasPackage
    ? []
    : byoGears.flatMap((gear) =>
        (byoAddOns[byoGearKey(gear)] ?? []).map(
          (addOn): RmsBookingGearLine => ({
            category: addOn.category,
            brand: toRmsBrand(addOn.brand),
            model: addOn.model,
            quantity: addOn.quantity,
          }),
        ),
      );
  const checkoutPackageCode = hasPackage ? selectedKits[0]?.packageNumber : undefined;

  // Request object for the shared useAvailabilityCheck hook — null (nothing to check) whenever
  // there's no selection or no dates yet, mirroring this section's previous early-return exactly.
  // toAvailabilityTimestamp, not toTimestamp: this can run before Trip Details' own Preferred Time
  // field has a value (e.g. the moment Checkout is first reached), and must keep working exactly
  // as before in that case — see toAvailabilityTimestamp's own doc comment.
  const backgroundAvailabilityRequest: RmsAvailabilityRequest | null =
    hasSelection && pickupDateOnly && returnDateOnly
      ? (() => {
          const pickupAt = toAvailabilityTimestamp(pickupDateOnly, tripDetails.preferredTime);
          const returnAt = toAvailabilityTimestamp(returnDateOnly, tripDetails.preferredTime);
          if (!pickupAt || !returnAt) return null;
          return {
            pickupAt,
            returnAt,
            packageCode: checkoutPackageCode,
            bookingGears: checkoutBookingGears.length > 0 ? checkoutBookingGears : undefined,
            addOns: checkoutAddOns.length > 0 ? checkoutAddOns : undefined,
          };
        })()
      : null;

  // Re-checks the customer's actual current selection against RMS's live inventory the moment
  // Checkout is reached, and again any time the selection materially changes — most importantly
  // whenever Trip Details' own Start/Return Date fields change (this page lets a customer edit
  // dates independently of whatever preset they picked on the catalog page), so a stale "was
  // available when I added it to my cart" result can never be treated as still valid. The actual
  // debounce/abort/cache/timeout/retry-coordination lifecycle now lives in the shared
  // useAvailabilityCheck hook (see its own doc comment for why this used to be duplicated,
  // slightly differently, on this page, PathACatalog, and PathBCatalog).
  const backgroundAvailability = useAvailabilityCheck(backgroundAvailabilityRequest);

  const [checkoutAvailability, setCheckoutAvailability] = useState<CheckoutAvailabilityState>({ status: 'idle' });

  useEffect(() => {
    switch (backgroundAvailability.status) {
      case 'idle':
        setCheckoutAvailability({ status: 'idle' });
        return;
      case 'checking':
        setCheckoutAvailability({ status: 'checking' });
        return;
      case 'success':
        if (backgroundAvailability.result) {
          setCheckoutAvailability(resolveCheckoutAvailability(backgroundAvailability.result));
        }
        return;
      case 'error':
      case 'rate_limited':
      case 'timeout':
        // This page never had distinct rate-limited or timed-out messages — all three collapse
        // into the same recoverable 'error' state it's always shown, with the same "Try Again"
        // action (see the render block below) rather than a silent, unrecoverable dead end.
        // Listing every case explicitly (no `default`) keeps this exhaustive, so a future status
        // added to the shared hook fails the typecheck here instead of silently leaving this page
        // stuck on "Checking availability…".
        setCheckoutAvailability({ status: 'error' });
        return;
    }
  }, [backgroundAvailability.status, backgroundAvailability.result]);

  /**
   * Runs every pre-submission check and, only once all of them pass, opens the confirmation
   * dialog — submitting a booking creates a real, permanent record (see requirement to confirm
   * before it), so nothing here actually calls the RMS yet. performSubmit (below) is what the
   * dialog's own Confirm button runs.
   *
   * The availability check at the end is a FRESH, awaited call — never a read of the background
   * `checkoutAvailability` state, which is debounced and can sit unchanged (and therefore
   * arbitrarily stale) for as long as the customer spends uploading verification documents,
   * filling in contact details, and reviewing the payment breakdown before ever clicking Submit.
   * This reuses the exact same 'checking'/'unavailable' UI states and the submit button's
   * existing disabled logic, so the customer sees the identical on-page notice either way — it's
   * only the trigger (a fresh request now, not a stale cached answer) that changes. The RMS's own
   * independent check inside performSubmit's POST /api/customer/bookings — including its 409
   * handling — is untouched and remains the final, authoritative word regardless of what this
   * check finds.
   */
  async function validateAndConfirm() {
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
    // and an explicit save of that section. Artifact-agnostic by design — it never inspects what
    // kind of file fills a slot.
    if (!isVerificationComplete(verificationDocs, isByoOnly)) {
      setSubmitError(
        isByoOnly
          ? 'Please complete the Identity Verification section above, all documents, contact details, Terms & Conditions acceptance, and BYO Rental Agreement acceptance are required, then save that section before confirming.'
          : 'Please complete the Identity Verification section above, all documents, contact details, and Terms & Conditions acceptance are required, then save that section before confirming.',
      );
      return;
    }
    // Defensive: a kit can only reach the cart while in stock, but stock status can change
    // after it was added (e.g. a stale tab) — never let an out-of-stock item through to booking.
    // The catalog's out-of-stock flag only means "none free RIGHT NOW", so it must not block a
    // booking whose dates are already chosen: the fresh, date-specific availability check right below
    // decides those, and is the authoritative one. The flag still guards when there are no dates.
    const hasTripDates = Boolean(tripDetails.startDate && tripDetails.returnDate);
    const outOfStockName = hasTripDates ? undefined : selectedKits.find((kit) => kit.isOutOfStock)?.name;
    if (outOfStockName) {
      setSubmitError(`${outOfStockName} just went out of stock and was removed from availability, please remove it from your cart and try again.`);
      return;
    }
    // A second click while a fresh check from the first is still in flight is a no-op, not a
    // second concurrent request — mirrors the submit button's own disabled-while-'checking' state
    // below, but as the real gate (see this function's own doc comment on why that button state
    // alone isn't trusted as the only guard).
    if (checkoutAvailability.status === 'checking') return;

    // The real, final-word-before-submission availability check — see this function's own doc
    // comment above for why this is a fresh request, never a read of the (possibly stale)
    // checkoutAvailability state left over from the background debounced check. Uses the exact
    // same payload construction (packageCode/bookingGears/addOns) the background check and the
    // final booking submission both already use, and the same strict toTimestamp pickupAt/
    // returnAt performSubmit is about to send moments later — never toAvailabilityTimestamp's
    // midnight fallback, since a real preferred time is already guaranteed non-empty by this
    // point (see the pickupAt/returnAt check above).
    setCheckoutAvailability({ status: 'checking' });
    let freshResult: RmsAvailabilityResult;
    try {
      // Same shared coordinator (concurrency cap, in-flight dedup, rate-limit cooldown, bounded
      // timeout) the background check above goes through — never a second, uncoordinated way to
      // reach the availability endpoint. Bypasses that hook's own per-signature cache
      // deliberately: this is the one place a cached "was available a moment ago" answer must
      // never substitute for asking again right now.
      freshResult = await requestAvailabilityCheck({
        pickupAt,
        returnAt,
        packageCode: checkoutPackageCode,
        bookingGears: checkoutBookingGears.length > 0 ? checkoutBookingGears : undefined,
        addOns: checkoutAddOns.length > 0 ? checkoutAddOns : undefined,
      });
    } catch {
      // Never silently proceeds to a real booking submission when availability couldn't actually
      // be confirmed — the customer can simply click Submit again to retry.
      setCheckoutAvailability({ status: 'error' });
      setSubmitError("We couldn't confirm availability right now. Please try again.");
      return;
    }

    // Same resolveCheckoutAvailability derivation the background check already uses — this fresh
    // response's own currentlyReservable/pendingTurnover are what decide the final outcome here,
    // never a value carried over from an earlier, possibly-stale background check. (If the
    // background hook's own independent in-flight check happens to resolve moments after this and
    // re-fires the effect above, it will display its own equally-genuine, RMS-confirmed answer —
    // never a stale or fabricated one either way.)
    const resolved = resolveCheckoutAvailability(freshResult);
    setCheckoutAvailability(resolved);

    if (resolved.status === 'unavailable') {
      setSubmitError('Some selected items are no longer available for these dates. Please review your selection.');
      return;
    }
    if (resolved.status === 'pending_turnover') {
      // Dates are fine (available: true) but RMS doesn't currently have enough AVAILABLE-status
      // stock to actually reserve this — never the same message as 'unavailable' above, and never
      // opens the confirmation dialog or reaches performSubmit's POST /api/customer/bookings.
      setSubmitError(
        `Some selected equipment is currently being prepared and can't be reserved yet: ${resolved.pendingTurnover
          .map((item) => item.name)
          .join(', ')}. Please try again shortly.`,
      );
      return;
    }

    setShowSubmitConfirm(true);
  }

  async function performSubmit() {
    const pickupAt = toTimestamp(tripDetails.startDate, tripDetails.preferredTime);
    const returnAt = toTimestamp(tripDetails.returnDate, tripDetails.preferredTime);
    // Both are already known-valid — validateAndConfirm only reaches setShowSubmitConfirm(true)
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
      // Conditions" PDF vs. the standalone "BYO Rental Agreement" PDF — neither an addendum to the
      // other) — a package booking sends only termsAccepted, a BYO booking sends only
      // byoAgreementAccepted, matching customerPortalBookingSchema's own refines server-side. The
      // submission gate above (isVerificationComplete) already required whichever one applies to
      // reach this point, so these read straight from that same already-verified checkbox state
      // rather than being hardcoded true. The RMS generates and records the authoritative
      // termsAcceptedAt/termsVersion/byoAgreementAcceptedAt/byoAgreementVersion itself; nothing
      // here invents a version or a timestamp.
      termsAccepted: !isByoOnly && verificationDocs.termsAccepted ? (true as const) : undefined,
      byoAgreementAccepted: isByoOnly && verificationDocs.byoAgreementAccepted ? (true as const) : undefined,
    };

    // Estimates only, either way — the RMS always recomputes the authoritative amounts itself
    // (from the package's own price fields, or from each selected gear kind's own price fields
    // for Build Your Own) before writing the booking; these are never trusted server-side.
    const booking = hasPackage
      ? {
          ...baseBooking,
          packageCode: selectedKits[0].packageNumber,
          // Extra rentable inventory the customer added on top of this package — sent as ordinary
          // bookingGears, exactly as a Build Your Own selection would be, so the RMS validates,
          // prices and reserves each line as real inventory. Never sent through `addOns`, which is
          // reserved for the package's own GearPairing-configured add-ons and would reject these.
          bookingGears: (packageAddOns[selectedKits[0].id] ?? []).map(
            (gear): RmsBookingGearLine => ({
              category: gear.category,
              brand: toRmsBrand(gear.brand),
              model: gear.model,
              quantity: gear.quantity,
            }),
          ),
          estimatedRentalFeeCentavos: Math.round(
            (getKitPrice(selectedKits[0], tripDetails) + calculatePackageAddOnsFee(selectedCart)) * 100,
          ),
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
              ...(gear.color ? { color: gear.color } : {}),
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
          // Build Your Own never computes or sends a deposit — see requirement 13. RMS itself
          // always writes depositCentavos = 0 for a BYO booking regardless of what's sent here;
          // an admin sets the real amount manually after review.
          estimatedDepositCentavos: 0,
        };

    // Dev-only timing (Change 15) — measures exactly where the time between clicking "Submit
    // Booking Request" and the final UI update actually goes, per the requested "submit click →
    // session prep → RMS POST start → RMS POST response → final UI state" breakdown. Never logs
    // tokens, passwords, or verification data — only elapsed milliseconds and, in the one existing
    // identity line below, the already-visible user id/email.
    const tSubmitClick = import.meta.env.DEV ? performance.now() : 0;
    setSubmitting(true);
    try {
      await ensureFreshSession();
      const tSessionReady = import.meta.env.DEV ? performance.now() : 0;
      if (import.meta.env.DEV) {
        console.log(`[timing] session/token prep: ${(tSessionReady - tSubmitClick).toFixed(0)}ms`);
      }

      const tRmsPostStart = import.meta.env.DEV ? performance.now() : 0;
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
      const tRmsPostDone = import.meta.env.DEV ? performance.now() : 0;
      setShowSubmitConfirm(false);
      onSubmit?.(result);
      if (import.meta.env.DEV) {
        const tFinalUiState = performance.now();
        console.log(
          `[timing] RMS POST /api/customer/bookings: ${(tRmsPostDone - tRmsPostStart).toFixed(0)}ms` +
            ` | final UI update: ${(tFinalUiState - tRmsPostDone).toFixed(0)}ms` +
            ` | total (click → done): ${(tFinalUiState - tSubmitClick).toFixed(0)}ms`,
        );
      }
    } catch (err) {
      // Closes the dialog so the page's own error banner (rendered below the submit button,
      // otherwise hidden behind the modal overlay) is visible again — the customer can then fix
      // whatever's wrong and re-open the confirmation once ready to retry. Never reaches
      // onSubmit?.(result) above, so this can never claim a booking succeeded when it didn't.
      setShowSubmitConfirm(false);
      // 409 specifically means RMS's own final, authoritative check (immediately before writing
      // the booking) found the requested inventory no longer available — the exact race this
      // whole checkout-time availability check exists to catch early, but RMS is still the one
      // that gets the final word at the actual moment of creation. describeRmsError would otherwise
      // surface RMS's own raw error text here, which is written for this one specific case as a
      // generic "conflict" string, not customer-facing copy — this replaces it with the same plain
      // message the checkout-time check itself already uses, so a customer sees one consistent
      // explanation regardless of which stage caught the conflict. Also refreshes this page's own
      // availability state to 'unavailable' (no itemized issues — RMS's 409 body doesn't include
      // them) so the same on-page notice and "Return to Cart" action reappear, guiding the customer
      // to the plain fix (adjust their selection) rather than just a dismissible error line.
      // No automatic retry anywhere on this path (booking creation is state-changing, and the RMS
      // defines no retryable condition for it). See classifyBookingSubmitError for the three
      // different meanings of 409; Retry-After is only sent on 429 and is not acted on here.
      const failure = classifyBookingSubmitError(err);
      if (failure.kind === 'inventory_conflict') {
        clearAvailabilityCache();
        setCheckoutAvailability({ status: 'unavailable', issues: [] });
        setSubmitError('Some of the selected items are no longer available for these dates. Please review your selection.');
      } else if (failure.kind === 'duplicate') {
        setSubmitError(
          `You already have a booking request for the same items and dates${failure.bookingNumber ? ` (${failure.bookingNumber})` : ''}. Please check My Bookings instead of submitting another request.`,
        );
      } else {
        setSubmitError(failure.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-5 sm:gap-8 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-xl font-semibold text-ink">Payment Breakdown</h1>
        <p className="text-sm text-ink-muted">Review your split payment before submitting your booking request.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard
          variant="primary"
          eyebrow="Due Today"
          title={hasPackageAddOns ? 'Package Security Deposit' : 'Security Deposit Total'}
          amount={isByoOnly ? null : totals.dueToday}
          description={
            isByoOnly
              ? 'GearBnB will determine your security deposit after reviewing your Build Your Own selections.'
              : hasPackageAddOns
                ? 'Refundable deposit to lock in your reservation. Your final deposit isn’t set yet, see the notice below.'
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

              {/* Listed as their own lines, never folded into the package's price — the customer
                  must be able to see package price + add-on prices = rental subtotal. */}
              {selectedKits.flatMap((kit) =>
                (packageAddOns[kit.id] ?? []).map((gear) => (
                  <BreakdownRow
                    key={`${kit.id}::${byoGearKey(gear)}`}
                    label={cleanGearName(gear.name, { keepColor: true })}
                    sublabel={`Add-on${gear.quantity > 1 ? ` · ${gear.quantity}×` : ''}`}
                    feeAmount={getGearKindPrice(gear, tripDetails) * gear.quantity}
                    depositAmount={null}
                  />
                )),
              )}

              {selectedItems.map((item) => (
                <BreakdownRow
                  key={item.id}
                  label={cleanGearName(item.name, { keepColor: true })}
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
                      label={cleanGearName(addOn.name, { keepColor: true })}
                      sublabel={`${cleanGearName(item.name, { keepColor: true })} add-on`}
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
                    label={cleanGearName(gear.name, { keepColor: true })}
                    sublabel={`Build Your Own${gear.quantity > 1 ? ` · ${gear.quantity}×` : ''}`}
                    feeAmount={getGearKindPrice(gear, tripDetails) * gear.quantity}
                    depositAmount={null}
                  />
                );
              })}

              {byoGears.flatMap((gear) =>
                (byoAddOns[byoGearKey(gear)] ?? []).map((addOn) => (
                  <BreakdownRow
                    key={`${byoGearKey(gear)}::${byoGearKey(addOn)}`}
                    label={cleanGearName(addOn.name, { keepColor: true })}
                    sublabel={`${cleanGearName(gear.name, { keepColor: true })} add-on${addOn.quantity > 1 ? ` · ${addOn.quantity}×` : ''}`}
                    feeAmount={getGearKindPrice(addOn, tripDetails) * addOn.quantity}
                    depositAmount={null}
                  />
                )),
              )}

              <BreakdownRow
                label={isDelivery ? 'Grab' : 'Pickup'}
                sublabel={
                  isDelivery
                    ? 'GearBnB does not charge or arrange this, you book and pay for your own Grab.'
                    : 'No fee for in-store pickup'
                }
                feeAmount={isDelivery ? null : 0}
                depositAmount={null}
              />
            </div>

            <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink-muted">
                  {hasPackageAddOns ? 'Package Security Deposit' : 'Security Deposit Subtotal'}
                </span>
                <span className="font-semibold text-ink">
                  {isByoOnly ? 'To Be Determined' : formatCurrency(totals.dueToday)}
                </span>
              </div>
              {/* Never a second real figure to add to the line above — "To Be Determined" is a
                  status, not an amount, so there is nothing here for a customer (or this code) to
                  add up. See hasPackageAddOns' own comment for why the customer website never
                  computes this. */}
              {hasPackageAddOns && (
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink-muted">Additional Add-on Deposit</span>
                  <span className="font-semibold text-ink">To Be Determined</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink-muted">Rental Fee Subtotal</span>
                <span className="font-semibold text-ink">{formatCurrency(totals.dueBeforeStart)}</span>
              </div>
            </div>

            {/* Visible here, before the submit button below, so the customer reads this before —
                never after — confirming the booking. Amber (not red) — this isn't an error the
                customer needs to fix, just a heads-up about what happens next. */}
            {hasPackageAddOns && (
              <p
                role="note"
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300"
              >
                <span className="font-semibold">Security deposit is not yet final.</span> Additional
                deposit requirements for selected add-ons will be reviewed and confirmed by GearBnB
                staff after your booking is submitted.
              </p>
            )}
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
                ? `${formattedStartDate} – ${formatDate(tripDetails.returnDate)}`
                : 'Not yet set'}
              {totals.rentalDurationDays > 0 && ` · ${totals.rentalDurationDays}-day`}
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
              {isVerificationComplete(verificationDocs, isByoOnly) ? 'Complete' : 'Incomplete, see above'}
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

      {/* RMS-confirmed availability for the actual current selection — see checkoutAvailability's
          own doc comment above. Visible here, above every other pre-submit notice and the submit
          button itself, so it's read before the customer ever tries to confirm, not just after a
          rejection. Never rendered while 'idle' (no dates yet) — Trip Details' own required-field
          messaging below already covers that case. */}
      {hasSelection && checkoutAvailability.status !== 'idle' && (
        <div
          role={checkoutAvailability.status === 'unavailable' ? 'alert' : 'status'}
          className={`flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-sm ${
            checkoutAvailability.status === 'available'
              ? 'border-brand-forest/30 bg-brand-forest/10 text-accent'
              : checkoutAvailability.status === 'unavailable'
                ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400'
                : checkoutAvailability.status === 'pending_turnover' || checkoutAvailability.status === 'error'
                  ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300'
                  : 'border-line-soft bg-surface-muted text-ink-muted'
          }`}
        >
          <p aria-busy={checkoutAvailability.status === 'checking'}>
            {checkoutAvailability.status === 'checking' && 'Checking availability…'}
            {checkoutAvailability.status === 'available' && 'Your selected items are available for these dates.'}
            {/* Deliberately distinct from 'unavailable' below — the dates themselves are fine
                (available: true); this equipment just isn't in RMS's own AVAILABLE inventory
                status yet (see CheckoutAvailabilityState's own doc comment), so it's framed as
                "being prepared," never as "unavailable for these dates." */}
            {checkoutAvailability.status === 'pending_turnover' && 'Some equipment is currently being prepared.'}
            {checkoutAvailability.status === 'unavailable' &&
              'Some selected items are no longer available for these dates. Please review your selection.'}
            {checkoutAvailability.status === 'error' &&
              "We couldn't confirm availability right now. You can try again, or continue reviewing your booking below, we'll check again when you submit."}
          </p>

          {/* Identifies the specific affected item(s) whenever RMS's response includes them — a
              409 caught only at final submission (see performSubmit's own catch block) never has
              this detail, so the plain message above still stands on its own without it. */}
          {checkoutAvailability.status === 'unavailable' && checkoutAvailability.issues.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {checkoutAvailability.issues.map((issue) => (
                <li key={issue.name} className="break-words">
                  {describeAvailabilityIssue(issue)}
                  {issue.requested > 0 && ` (you asked for ${issue.requested})`}
                </li>
              ))}
            </ul>
          )}

          {/* Same RMS-provided display names as the 'unavailable' list above — never an inventory
              id, QR code, or other internal detail (see RmsPendingTurnoverNotice's own doc
              comment). */}
          {checkoutAvailability.status === 'pending_turnover' && checkoutAvailability.pendingTurnover.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {checkoutAvailability.pendingTurnover.map((item) => (
                <li key={item.name} className="break-words">
                  {cleanGearName(item.name, { keepColor: true })}, {item.currentlyReservableCount} of {item.requested} currently reservable
                </li>
              ))}
            </ul>
          )}

          {checkoutAvailability.status === 'unavailable' && (
            <button
              type="button"
              onClick={() => navigate('/cart')}
              className="self-start rounded-md border border-current px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/40 dark:hover:bg-black/20"
            >
              Return to Cart
            </button>
          )}

          {/* Never a permanent dead end: waiting alone does nothing (nothing auto-retries this
              background check on a timer), so a real action is required to actually ask RMS
              again — the same escape hatch PathACatalog/PathBCatalog's own availability checks
              already give a customer stuck on this status. */}
          {checkoutAvailability.status === 'error' && (
            <button
              type="button"
              onClick={backgroundAvailability.retry}
              className="self-start rounded-md border border-current px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/40 dark:hover:bg-black/20"
            >
              Try Again
            </button>
          )}
        </div>
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
        disabled={!hasSelection || submitting || checkoutAvailability.status === 'checking'}
        className="w-full rounded-lg bg-brand-forest px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:cursor-not-allowed disabled:bg-surface-strong"
      >
        {submitting ? 'Submitting…' : checkoutAvailability.status === 'checking' ? 'Checking availability…' : 'Submit Booking Request →'}
      </button>

      <ConfirmDialog
        open={showSubmitConfirm}
        title="Submit this booking request?"
        message="This creates a real booking request with GearBnB, you won't be able to edit your selections here once submitted."
        confirmLabel="Submit Booking Request"
        onCancel={() => setShowSubmitConfirm(false)}
        onConfirm={performSubmit}
      />
    </div>
  );
}
