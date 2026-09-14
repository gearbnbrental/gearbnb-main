import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthRequiredMessage from '../components/AuthRequiredMessage';
import DepositProofUpload from '../components/checkout/DepositProofUpload';
import RentalFeeProofUpload from '../components/checkout/RentalFeeProofUpload';
import VerificationDocumentsReview from '../components/checkout/VerificationDocumentsReview';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangleIcon,
  BoltIcon,
  ChatBubbleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  CreditCardIcon,
  EyeIcon,
  GearPlaceholderIcon,
  MapPinIcon,
  ShieldCheckIcon,
} from '../components/icons';
import {
  fetchMyBookingsFromRms,
  RmsApiError,
  type RmsAdditionalCharge,
  type RmsDamageReport,
  type RmsMyBooking,
  type RmsRentalFee,
  type RmsVerificationDocumentKind,
} from '../utils/rmsApi';
import { formatCurrency } from '../utils/format';
import { MESSENGER_URL } from '../config/social';

const RENTAL_FEE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  PARTIALLY_PAID: 'Partial',
  PAID: 'Paid',
  REFUNDED: 'Refunded',
  VOID: 'Void',
};

type FetchState =
  | { kind: 'loading' }
  | { kind: 'not_configured' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; bookings: RmsMyBooking[] };

/** A three-tone system, consistently applied to every status badge on this page: green means
 *  approved/complete, amber means the customer has something to review or act on, blue means
 *  in-progress/informational. CANCELLED keeps its own red — it isn't any of those three things,
 *  and folding it into amber or gray would make a dead booking look actionable or merely quiet. */
const STATUS_STYLES: Record<string, string> = {
  PENDING_REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300',
  AWAITING_CUSTOMER_RESPONSE: 'bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300',
  AWAITING_PAYMENT: 'bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300',
  PENDING_FOR_INSPECTION: 'bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300',
  RESERVED: 'bg-blue-100 text-blue-800 dark:bg-blue-400/10 dark:text-blue-300',
  READY_FOR_PICKUP: 'bg-blue-100 text-blue-800 dark:bg-blue-400/10 dark:text-blue-300',
  RENTED: 'bg-blue-100 text-blue-800 dark:bg-blue-400/10 dark:text-blue-300',
  COMPLETED: 'bg-brand-forest/10 text-accent',
  RETURNED: 'bg-brand-forest/10 text-accent',
  OVERDUE_FOR_RETURN: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
};

/** Booking statuses that no longer need the customer's attention — grouped under a collapsed
 * "Booking History" section so an active booking never has to be scrolled past to reach them. */
const PAST_STATUSES = new Set(['COMPLETED', 'RETURNED', 'CANCELLED']);

/** Bookings whose rental is physically underway right now — the gear is either out with the
 *  customer (RENTED, or RENTED-and-late via OVERDUE_FOR_RETURN) or back with us but not yet signed
 *  off (PENDING_FOR_INSPECTION). Split out from the merely upcoming ones so "what's happening now"
 *  never sits in the same undifferentiated list as "what I've booked for next month".
 *
 *  These are the RMS's own existing status values — no new booking state is invented here, and
 *  nothing is inferred from dates, which could disagree with the status the RMS considers
 *  authoritative (a booking can be RESERVED with a pickup date already past, for instance). */
const CURRENT_STATUSES = new Set(['RENTED', 'OVERDUE_FOR_RETURN', 'PENDING_FOR_INSPECTION']);

/** Statuses that mean "GearBnB is still reviewing something of yours" — used only for the summary
 *  count, and taken straight from the RMS's own status values (never a status invented here).
 *  Deliberately does NOT include PENDING_FOR_INSPECTION: that status means the customer's GEAR is
 *  being inspected after return, a completely different concept from document verification — see
 *  BOOKING_STATUS_LABELS and getNextStep's own PENDING_FOR_INSPECTION case below for the same
 *  distinction. */
const PENDING_REVIEW_STATUSES = new Set(['PENDING_REVIEW', 'AWAITING_CUSTOMER_RESPONSE']);

/** Override for the one status whose auto-generated label ("Pending For Inspection") is correct
 *  but easy to misread — spelling it out as "Gear Inspection" makes clear this is about the
 *  RETURNED EQUIPMENT being inspected, not about the customer's identity/verification documents
 *  (a completely separate workflow — see VerificationDocumentsReview). Every other status keeps
 *  formatStatusLabel's plain auto-generated label. */
const BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING_FOR_INSPECTION: 'Gear Inspection',
};

/** How many past bookings are rendered at once. The RMS's GET /api/customer/bookings returns the
 *  customer's full list in one response (it exposes no paging parameters), so this pages through
 *  what was already fetched rather than issuing extra requests — it keeps a long history from
 *  rendering hundreds of cards at once, which is the cost that actually shows up for the customer. */
const HISTORY_PAGE_SIZE = 5;

function formatStatusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Date without the time-of-day — used in the collapsed card summary, where the exact pickup hour
 *  is detail the customer has just chosen to hide. The full timestamp is still shown in the
 *  expanded Dates section via formatDateTime. */
function formatDateOnly(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(value: Date): string {
  return value.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

/** Whole-hours-aware rental duration for display only, computed directly from the booking's own
 *  authoritative pickupAt/returnAt timestamps — never a price or a pricing-tier decision (that
 *  remains solely the RMS's, via its own pickTierPrice formula). Rounds up to the nearest whole
 *  day for the common "N Day(s)" phrasing customers expect; falls back to an hour count for a
 *  same-day rental shorter than 24 hours rather than reading "0 Days". */
function formatRentalDuration(pickupAt: string, returnAt: string): string | null {
  const start = new Date(pickupAt);
  const end = new Date(returnAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;

  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  if (hours < 24) {
    const wholeHours = Math.round(hours);
    return `${wholeHours} Hour${wholeHours === 1 ? '' : 's'}`;
  }
  const days = Math.ceil(hours / 24);
  return `${days} Day${days === 1 ? '' : 's'}`;
}

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE_STYLES: Record<Tone, string> = {
  success: 'border-brand-forest/30 bg-brand-forest/10 text-accent',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300',
  danger: 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400',
  info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-300',
  neutral: 'border-line-soft bg-surface-muted text-ink-muted',
};

function ToneIcon({ tone, className }: { tone: Tone; className?: string }) {
  if (tone === 'success') return <CheckCircleIcon className={className} />;
  if (tone === 'danger' || tone === 'warning') return <AlertTriangleIcon className={className} />;
  return <ClockIcon className={className} />;
}

/**
 * The single most useful thing this page can tell a customer: what's happening with their
 * booking right now, and — when something is on them — exactly what to do about it. Computed
 * entirely from fields the RMS already returns; never a new source of truth, just a plain-English
 * summary of state this page already displays in more detail further down.
 */
interface NextStep {
  tone: Tone;
  message: string;
  /** A direct, same-card action for the customer to take — always targets an element id that's
   *  already rendered inside THIS booking's own card (verification/deposit/rental-fee section, or
   *  the Gear Inspection panel), never a different booking or a separate page section. This is what
   *  replaces the old separate "Updates From GearBnB" panel: instead of a second, disconnected copy
   *  of the same signal that a customer had to cross-reference against whichever card happened to
   *  be on screen, the action now lives with — and jumps within — the one card it's actually about. */
  cta?: { label: string; targetId: string };
}

function getNextStep(booking: RmsMyBooking): NextStep {
  const detailsTargetId = `booking-details-${booking.bookingId}`;
  const correctionCount = booking.verificationDocuments.filter((doc) => doc.status === 'CORRECTION_REQUIRED').length;
  if (correctionCount > 0) {
    return {
      tone: 'danger',
      message:
        correctionCount === 1
          ? 'Action needed — one of your verification documents needs to be replaced.'
          : `Action needed — ${correctionCount} verification documents need to be replaced.`,
      cta: { label: 'Upload replacement documents', targetId: detailsTargetId },
    };
  }
  if (booking.securityDeposit.proofStatus === 'REJECTED') {
    const { requiredCentavos, amountClaimedCentavos } = booking.securityDeposit;
    const shortfallCentavos = amountClaimedCentavos !== null ? requiredCentavos - amountClaimedCentavos : 0;
    const message =
      shortfallCentavos > 0
        ? `Your deposit payment was ${formatCurrency(shortfallCentavos / 100)} short — pay the remaining amount, then upload updated proof showing the FULL ${formatCurrency(requiredCentavos / 100)} deposit paid (not just the additional payment).`
        : 'Your deposit payment proof was rejected — please review and resubmit.';
    return { tone: 'danger', message, cta: { label: 'Resubmit deposit proof', targetId: detailsTargetId } };
  }
  if (booking.rentalFee?.proofStatus === 'REJECTED') {
    return {
      tone: 'danger',
      message: 'Your rental fee payment proof was rejected — please submit a new proof of payment.',
      cta: { label: 'Resubmit payment proof', targetId: detailsTargetId },
    };
  }

  switch (booking.status) {
    case 'PENDING_REVIEW':
    case 'AWAITING_CUSTOMER_RESPONSE':
      return { tone: 'info', message: "We're reviewing your verification documents — we'll notify you once they're approved." };
    case 'PENDING_FOR_INSPECTION': {
      const hasIssue = (booking.damageReports?.length ?? 0) > 0;
      return hasIssue
        ? {
            tone: 'warning',
            message: 'Your gear has been returned and an issue was recorded during inspection.',
            cta: { label: 'View inspection details', targetId: `gear-inspection-${booking.bookingId}` },
          }
        : {
            tone: 'info',
            message: "Your gear has been returned and is being inspected — we'll notify you once the inspection is complete.",
          };
    }
    case 'AWAITING_PAYMENT': {
      if (booking.securityDeposit.proofStatus === 'PENDING_REVIEW') {
        return { tone: 'info', message: 'Your security deposit payment proof is being reviewed.' };
      }
      const isByoBooking = booking.packages.length === 0;
      if (isByoBooking && booking.depositCentavos <= 0) {
        return { tone: 'info', message: "We're finalizing your Build Your Own security deposit amount." };
      }
      return {
        tone: 'warning',
        message: 'Pay your security deposit to reserve your gear.',
        cta: { label: 'Pay security deposit', targetId: detailsTargetId },
      };
    }
    case 'RESERVED':
      return { tone: 'success', message: "You're all set! We'll see you on your pickup date." };
    case 'READY_FOR_PICKUP':
      return { tone: 'success', message: 'Your gear is ready for pickup.' };
    case 'RENTED':
      return { tone: 'info', message: 'Enjoy your trip! Please return your gear by the return date.' };
    case 'OVERDUE_FOR_RETURN':
      return { tone: 'danger', message: 'This rental is overdue for return — please return your gear as soon as possible.' };
    case 'COMPLETED':
    case 'RETURNED':
      return { tone: 'neutral', message: 'Trip completed — thanks for booking with GearBnB!' };
    case 'CANCELLED':
      return { tone: 'neutral', message: 'This booking was cancelled.' };
    default:
      return { tone: 'neutral', message: '' };
  }
}

/**
 * A fixed, known sequence of customer-facing stages, each mapped to the real RMS status value(s)
 * that fall under it — never a separate, invented status. This only shows the booking's CURRENT
 * position in that sequence, never a claim about WHEN an earlier stage was reached: the RMS
 * response has no dated status-history to draw exact transition times from, only the current
 * `status` value, so a stepper claiming specific completion dates would be fabricating data that
 * doesn't exist. "Booking Submitted" has no status of its own — reaching this page at all means a
 * booking already exists, so it's always considered done.
 */
const PROGRESS_STAGES: { label: string; statuses: string[] }[] = [
  { label: 'Booking Submitted', statuses: [] },
  { label: 'Verification Review', statuses: ['PENDING_REVIEW', 'AWAITING_CUSTOMER_RESPONSE'] },
  { label: 'Deposit Payment', statuses: ['AWAITING_PAYMENT'] },
  { label: 'Reserved', statuses: ['RESERVED'] },
  { label: 'Ready for Pickup', statuses: ['READY_FOR_PICKUP'] },
  { label: 'Rental Period', statuses: ['RENTED', 'OVERDUE_FOR_RETURN'] },
  // A gear-condition check on the RETURNED equipment, done by staff after pickup/rental — not the
  // same "Verification Review" stage above, which is about the customer's own identity documents.
  // PENDING_FOR_INSPECTION was previously (incorrectly) grouped into that first stage; see
  // BOOKING_STATUS_LABELS and getNextStep's own comment on the same distinction.
  { label: 'Gear Inspection', statuses: ['PENDING_FOR_INSPECTION'] },
  { label: 'Completed', statuses: ['COMPLETED', 'RETURNED'] },
];

/** Vertical timeline showing where a booking currently sits in the known flow above — a stepper
 *  reads more naturally as a top-to-bottom sequence than as pills that wrap unpredictably across a
 *  narrow card, and a vertical list stays equally legible at 375px as it does on desktop, which a
 *  wrapping horizontal row does not. Omitted entirely for CANCELLED bookings (see caller) —
 *  cancellation isn't a position in this sequence, and forcing it onto the timeline would
 *  misrepresent it as "stalled" at some stage.
 *
 *  `blocked` marks the CURRENT stage as needing the customer's attention (the same danger/warning
 *  tone getNextStep already computed for this booking) rather than inventing a new status — a
 *  booking whose next stage requires customer action reads as visually distinct from one that's
 *  simply progressing normally. */
/** Icon-in-circle + title + subtitle header, used consistently across every sub-section of a
 *  booking card (Rental Details, Payment Summary, Booking Progress) so each reads as its own
 *  distinct, labeled card rather than an unbroken wall of text. `badge`, when given, is always a
 *  real status value already shown elsewhere on the page (never an invented label). */
function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  badge?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-forest/10 text-accent">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <p className="text-xs text-ink-faint">{subtitle}</p>
        </div>
      </div>
      {badge}
    </div>
  );
}

function BookingProgress({ status, blocked }: { status: string; blocked: boolean }) {
  // A status this component doesn't recognize yet (e.g. a future RMS value) falls back to the
  // first stage rather than guessing a position — never invents where an unknown status belongs.
  const currentIndex = PROGRESS_STAGES.findIndex((stage) => stage.statuses.includes(status));
  const effectiveIndex = currentIndex === -1 ? 0 : currentIndex;

  return (
    <div className="flex flex-col gap-3 border-t border-line-soft pt-3">
      <SectionHeader icon={ClockIcon} title="Booking Progress" subtitle="Track the status of your booking" />
      <ol className="flex flex-col pl-1">
        {PROGRESS_STAGES.map((stage, index) => {
          const isDone = index < effectiveIndex;
          const isCurrent = index === effectiveIndex;
          const isBlocked = isCurrent && blocked;
          const isLast = index === PROGRESS_STAGES.length - 1;

          const dotClass = isBlocked
            ? 'border-red-500 bg-red-500 text-white'
            : isCurrent
              ? 'border-brand-forest bg-brand-forest text-white'
              : isDone
                ? 'border-brand-forest/40 bg-brand-forest/10 text-accent'
                : 'border-line bg-surface text-ink-faint';
          const labelClass = isBlocked
            ? 'font-semibold text-red-700 dark:text-red-400'
            : isCurrent
              ? 'font-semibold text-ink'
              : isDone
                ? 'text-ink-muted'
                : 'text-ink-faint';

          return (
            <li key={stage.label} className="relative flex gap-3 pb-4 last:pb-0">
              {!isLast && (
                <span
                  className={`absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-px ${isDone ? 'bg-brand-forest/40' : 'bg-line'}`}
                  aria-hidden="true"
                />
              )}
              <span
                className={`z-10 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 ${dotClass}`}
              >
                {isDone ? (
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                ) : isBlocked ? (
                  <AlertTriangleIcon className="h-3 w-3" />
                ) : (
                  <span className={`h-1.5 w-1.5 rounded-full ${isCurrent ? 'bg-white' : 'bg-current'}`} />
                )}
              </span>
              <span className={`pt-0.5 text-sm ${labelClass}`}>
                {stage.label}
                {isBlocked && <span className="ml-1.5 text-xs font-medium">— action needed</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function needsAttention(booking: RmsMyBooking): boolean {
  const tone = getNextStep(booking).tone;
  return tone === 'danger' || tone === 'warning';
}

/**
 * Toggle wrapper for everything in a booking card beyond its headline summary — dates, line items,
 * payment, verification, deposit, rental fee and gear inspection.
 *
 * Open by default (the client's requirement: a customer must never have to click just to see their
 * own booking's details), with the toggle there purely so a card can be shrunk back down when
 * several bookings are on screen at once. Collapsing swaps the detail for `collapsedSummary` — the
 * short "booking reference / dates / kit / balance" line — so a collapsed card genuinely becomes
 * short instead of merely dropping its last few panels.
 */
function DetailsToggle({
  defaultOpen,
  collapsedSummary,
  panelId,
  children,
}: {
  defaultOpen: boolean;
  collapsedSummary: ReactNode;
  /** Ties the button to the region it controls via aria-controls, and gives the expanded content a
   *  real anchor other parts of the page (e.g. the Gear Inspection alert) can scroll straight to. */
  panelId: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="flex flex-col gap-3">
      {!open && collapsedSummary}
      {open && (
        <div id={panelId} className="flex scroll-mt-4 flex-col gap-3">
          {children}
        </div>
      )}
      {/* Explicit "booking details" wording (not just "Details") plus an up/down chevron whose
          direction alone already hints at the action — the label spells out the current state
          rather than leaving it to be inferred from the arrow. */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex items-center gap-1.5 self-start rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-surface-strong"
      >
        {open ? 'Hide booking details' : 'Show booking details'}
        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}

/** The short form of a booking's DEEPER detail once its card is collapsed — just the one figure
 *  customers come back to check (the outstanding balance) and a gear-inspection flag when there is
 *  one. Rental dates, booking type and fulfillment are deliberately NOT repeated here — they live
 *  in the always-visible TripSummaryStrip above this, in both the collapsed and expanded state, so
 *  collapsing a card never hides them. Every value is read straight off the RMS response
 *  (`rentalFee` is the server's own computed object); nothing here is recalculated in the browser. */
function CollapsedSummary({ booking }: { booking: RmsMyBooking }) {
  if (!booking.rentalFee && !(booking.damageReports && booking.damageReports.length > 0)) return null;

  return (
    // min-w-0 + break-words on every value: a long note or a narrow 375px phone must wrap inside
    // the card rather than force the whole page to scroll sideways.
    <dl className="flex flex-col gap-1.5 border-t border-line-soft pt-3 text-sm">
      {booking.rentalFee && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <dt className="text-ink-muted">Balance:</dt>
          <dd className="font-semibold text-ink">{formatCurrency(booking.rentalFee.outstandingCentavos / 100)}</dd>
        </div>
      )}
      {booking.damageReports && booking.damageReports.length > 0 && (
        <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <dt className="sr-only">Gear inspection</dt>
          <dd className="min-w-0 break-words font-medium">Gear Inspection Update</dd>
        </div>
      )}
    </dl>
  );
}

/**
 * Always-visible headline strip — rental dates, booking type, and fulfillment, the three things a
 * customer should never have to expand a card to see (per the client's explicit list of "must be
 * visible by default" fields). Sits above the Hide/Show Details toggle, so collapsing a card only
 * hides the deeper payment/verification/inspection detail below it, never this. A tinted box
 * (rather than plain text) so it reads as the card's own "at a glance" header, distinct from the
 * denser detail underneath.
 */
function TripSummaryStrip({ booking }: { booking: RmsMyBooking }) {
  const isByoBooking = booking.packages.length === 0;
  const duration = formatRentalDuration(booking.pickupAt, booking.returnAt);

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface-muted p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="flex items-start gap-2.5">
        <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Rental Dates</p>
          <p className="break-words text-base font-semibold text-ink">
            {formatDateOnly(booking.pickupAt)} &ndash; {formatDateOnly(booking.returnAt)}
            {duration && <span className="font-normal text-ink-muted"> &middot; {duration}</span>}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-6 sm:pl-0">
        <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink">
          {isByoBooking ? 'Build Your Own' : (booking.packages[0]?.name ?? 'Package')}
        </span>
        <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink">
          {booking.fulfillmentType === 'DELIVERY' ? 'Delivery' : 'Self Pickup'}
        </span>
      </div>
    </div>
  );
}

/** Separate, self-contained card mirroring DepositProofUpload's visual language (bordered box,
 * uppercase label, big headline amount) so Rental Fee reads as clearly distinct from — never
 * merged with — the Security Deposit card above it. All figures come straight from the RMS's
 * `rentalFee` object; nothing here is recalculated. */
function RentalFeeSummary({
  bookingId,
  rentalFee,
  onRentalFeeProofSubmitted,
}: {
  bookingId: string;
  rentalFee: RmsRentalFee;
  onRentalFeeProofSubmitted: () => void;
}) {
  const statusLabel = RENTAL_FEE_STATUS_LABELS[rentalFee.status] ?? formatStatusLabel(rentalFee.status);
  const isPaid = rentalFee.status === 'PAID';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Rental Fee</h3>
        <p className="text-2xl font-bold text-ink">{formatCurrency(rentalFee.dueCentavos / 100)}</p>
        <p className="text-xs text-ink-faint">Amount Due</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-ink-muted">Amount Paid</dt>
        <dd className="text-right font-medium text-ink">{formatCurrency(rentalFee.paidCentavos / 100)}</dd>
        <dt className="text-ink-muted">Outstanding</dt>
        <dd className="text-right font-medium text-ink">{formatCurrency(rentalFee.outstandingCentavos / 100)}</dd>
        <dt className="text-ink-muted">Payment Status</dt>
        <dd className="text-right font-medium text-ink">{statusLabel}</dd>
        <dt className="text-ink-muted">Due Date</dt>
        <dd className="text-right font-medium text-ink">{formatDateTime(rentalFee.dueDate)}</dd>
      </dl>

      <p className="text-xs text-ink-faint">
        Payable any time on or before your rental date — cash at pickup is accepted. To pay
        cashlessly, follow the payment instructions below and upload your proof of payment.
      </p>

      <RentalFeeProofUpload
        bookingId={bookingId}
        isPaid={isPaid}
        paidCentavos={rentalFee.paidCentavos}
        proofStatus={rentalFee.proofStatus ?? null}
        reviewNote={rentalFee.reviewNote ?? null}
        amountClaimedCentavos={rentalFee.amountClaimedCentavos ?? null}
        onProofSubmitted={onRentalFeeProofSubmitted}
      />
    </div>
  );
}

/** "Damaged" for any real-damage severity, "Missing / Lost" for a total loss — the only two
 *  outcomes the RMS's own inspection form can produce (see RmsDamageReport.severity). */
function gearIssueLabel(severity: RmsDamageReport['severity']): string {
  return severity === 'TOTAL_LOSS' ? 'Missing / Lost' : 'Damaged';
}

/**
 * Post-rental gear-inspection findings for one booking — the customer-facing surface for a
 * DamageReport the RMS's Complete Booking step recorded. Every field here comes straight from the
 * RMS's own customer-facing bookings response (see RmsDamageReport); `description` is shown
 * verbatim as the "customer-facing inspection message" since the RMS's inspection form has no
 * separate internal-only note field to withhold. Never shows a charge/amount — recording an item
 * as damaged or lost does not, by itself, create a payment obligation.
 */
const CHARGE_TYPE_LABELS: Record<RmsAdditionalCharge['type'], string> = {
  DAMAGE: 'Damage',
  LOSS: 'Loss / Missing',
  LATE_FEE: 'Late Fee',
  EXTENSION: 'Extension',
  OTHER: 'Other Charge',
};

/**
 * The customer's itemised additional-charge statement — one line per charge, exactly as staff
 * recorded it during the gear inspection, so a rental that had a damaged item, a missing item, a
 * late return and an extension shows four separate lines rather than one lump sum.
 *
 * Every figure comes from the RMS response: the per-line amounts and the outstanding total are both
 * server-derived, and nothing is added up in the browser. This is read-only — there is no control
 * here that submits anything, and the customer cannot alter a charge.
 */
function AdditionalChargesPanel({
  charges,
  totalCentavos,
  outstandingCentavos,
}: {
  charges: RmsAdditionalCharge[];
  /** Sum of every line actually shown above (PENDING + PAID — the only statuses the RMS ever sends
   *  to the customer) — matches "Total Additional Charges" literally, so it always reconciles with
   *  the individual lines a customer can see and add up themselves. */
  totalCentavos: number;
  /** What's still unpaid — only shown as its own line when it differs from the total, i.e. when at
   *  least one charge is already marked Paid; otherwise it would just repeat the total. */
  outstandingCentavos: number;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-muted p-4 sm:p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Additional Charges</h3>

      <ol className="flex flex-col gap-2.5">
        {charges.map((c, index) => (
          <li key={c.chargeNumber} className="flex flex-col gap-0.5 border-b border-line-soft pb-2.5 last:border-b-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-sm font-medium text-ink">
                {index + 1}. {CHARGE_TYPE_LABELS[c.type]}
              </p>
              <p className="shrink-0 text-sm font-semibold text-ink">{formatCurrency(c.amountCentavos / 100)}</p>
            </div>
            <p className="text-sm text-ink-muted">
              {c.itemName ?? 'Entire rental'}
              {c.quantity > 1 ? ` · Qty ${c.quantity}` : ''}
              {c.extraDays ? ` · ${c.extraDays} extra day${c.extraDays === 1 ? '' : 's'}` : ''}
            </p>
            <p className="text-sm text-ink-muted">{c.reason}</p>
            {c.status === 'PAID' && <p className="text-xs font-medium text-accent">Paid</p>}
          </li>
        ))}
      </ol>

      <div className="flex items-center justify-between border-t border-line pt-2.5">
        <p className="text-sm font-semibold text-ink">Total Additional Charges</p>
        <p className="text-base font-bold text-ink">{formatCurrency(totalCentavos / 100)}</p>
      </div>

      {outstandingCentavos > 0 && outstandingCentavos !== totalCentavos && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-muted">Outstanding</p>
          <p className="text-sm font-semibold text-ink">{formatCurrency(outstandingCentavos / 100)}</p>
        </div>
      )}

      {outstandingCentavos > 0 && (
        <p className="text-sm text-ink-muted">
          Please settle these charges with our team. They are separate from your rental fee and security deposit.
        </p>
      )}
    </div>
  );
}

function GearInspectionPanel({ bookingId, reports }: { bookingId: string; reports: RmsDamageReport[] }) {
  return (
    <div
      id={`gear-inspection-${bookingId}`}
      className="flex scroll-mt-4 flex-col gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-400/50 dark:bg-amber-400/10 sm:p-5"
    >
      <div className="flex items-center gap-2">
        <AlertTriangleIcon className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
          Gear Inspection — Issue Reported
        </h3>
      </div>
      <ul className="flex flex-col gap-2">
        {reports.map((report) => (
          <li key={report.damageNumber} className="rounded-lg bg-surface p-3 text-sm shadow-sm">
            <p className="font-medium text-ink">
              {report.itemName} — {gearIssueLabel(report.severity)}
            </p>
            <p className="mt-0.5 text-ink-muted">{report.description}</p>
            {/* Only rendered when the RMS has actually recorded a charge (chargeCentavos > 0) —
                never shown as "₱0", which would misrepresent an unset default as a decided
                zero-charge outcome. */}
            {report.chargeCentavos > 0 && (
              <p className="mt-1 text-sm font-semibold text-ink">Charge: {formatCurrency(report.chargeCentavos / 100)}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A titled card of real buttons for the handful of things a customer actually does with this
 * booking — never a placeholder link. "View Payment Details" just scrolls to the payment section
 * already rendered in this same card's main column (never navigates or fetches anything new);
 * "Contact Support" reuses the site's one real Messenger destination (config/social.ts), the same
 * link the global "Need Help?" widget already uses. Lives in the card's right-hand column, so —
 * unlike the page-level sidebar this replaced earlier in the project — it can only ever refer to
 * the ONE booking it's rendered next to.
 */
function QuickActions({
  booking,
  onJumpTo,
}: {
  booking: RmsMyBooking;
  onJumpTo: (targetId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <SectionHeader icon={BoltIcon} title="Quick Actions" subtitle="Need help or have questions?" />
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onJumpTo(`booking-details-${booking.bookingId}`)}
          className="flex items-center justify-between gap-2 rounded-lg bg-brand-forest px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
        >
          <span className="flex items-center gap-2">
            <EyeIcon className="h-4 w-4 shrink-0" />
            View Payment Details
          </span>
          <span aria-hidden="true">&rarr;</span>
        </button>
        <a
          href={MESSENGER_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contact Support via Messenger (opens in a new tab)"
          className="flex items-center justify-between gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-strong"
        >
          <span className="flex items-center gap-2">
            <ChatBubbleIcon className="h-4 w-4 shrink-0" />
            Contact Support
          </span>
          <span aria-hidden="true">&rarr;</span>
        </a>
      </div>
    </div>
  );
}

/** Bold, high-contrast shortcut card to the Gear Inspection findings further down this same card
 *  — only rendered when the RMS actually recorded a damage/loss report, matching the same
 *  condition GearInspectionPanel itself uses. Never a duplicate data source: this is purely a
 *  navigation shortcut to the one panel that has the real findings. */
function InspectionShortcut({ bookingId, onJumpTo }: { bookingId: string; onJumpTo: (targetId: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onJumpTo(`gear-inspection-${bookingId}`)}
      className="flex items-center gap-3 rounded-xl bg-brand-forest p-4 text-left text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
        <AlertTriangleIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">View Inspection Details</span>
        <span className="block text-xs text-white/85">Check the inspection results and gear condition.</span>
      </span>
      <span className="shrink-0" aria-hidden="true">&rarr;</span>
    </button>
  );
}

/** Compact, at-a-glance restatement of the two real charges a booking can carry — rental fee and
 *  security deposit — never summed together (the deposit is refundable and isn't rental income;
 *  see PaymentSummary's own comment on the same rule). "Total Amount" is the rental fee alone,
 *  matching what PaymentSummary already shows as "Rental Fee" a few sections over; this card exists
 *  purely so that figure is visible from the right-hand column too, without having to scroll to the
 *  main Payment Summary card. */
function PaymentBreakdown({ booking, onJumpTo }: { booking: RmsMyBooking; onJumpTo: (targetId: string) => void }) {
  const { rentalFee, securityDeposit } = booking;
  const rentalFeeCentavos = rentalFee ? rentalFee.dueCentavos : booking.rentalFeeCentavos;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <SectionHeader icon={CreditCardIcon} title="Payment Breakdown" subtitle="Rental fee and deposit" />
        <button
          type="button"
          onClick={() => onJumpTo(`booking-details-${booking.bookingId}`)}
          className="shrink-0 text-xs font-semibold text-accent hover:underline"
        >
          See details
        </button>
      </div>
      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-ink-muted">Rental Fee</dt>
          <dd className="font-medium text-ink">{formatCurrency(rentalFeeCentavos / 100)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-ink-muted">Security Deposit (refundable)</dt>
          <dd className="font-medium text-ink">{formatCurrency(securityDeposit.requiredCentavos / 100)}</dd>
        </div>
      </dl>
      <div className="flex items-center justify-between border-t border-line-soft pt-2.5">
        <p className="text-sm font-semibold text-ink">Total Amount</p>
        <p className="text-base font-bold text-ink">{formatCurrency(rentalFeeCentavos / 100)}</p>
      </div>
    </div>
  );
}

/** Quiet reassurance card, distinct in purpose from the Quick Actions button above it — that one
 *  is for a specific task, this is a general "you're not on your own" note. Links to the same real
 *  Messenger destination rather than inventing a separate contact channel. */
function NeedAssistanceCard() {
  return (
    <a
      href={MESSENGER_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Need assistance? Contact us via Messenger (opens in a new tab)"
      className="flex items-center gap-3 rounded-xl border border-brand-forest/20 bg-brand-forest/5 p-4 text-left transition-colors hover:bg-brand-forest/10"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-forest/10 text-accent">
        <ShieldCheckIcon className="h-4.5 w-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">Need Assistance?</span>
        <span className="block text-xs text-ink-muted">Our team is here to help. Feel free to reach out anytime.</span>
      </span>
      <span className="shrink-0 text-ink-faint" aria-hidden="true">&rarr;</span>
    </a>
  );
}

function BookingCard({
  booking,
  onDepositProofSubmitted,
  onRentalFeeProofSubmitted,
  onVerificationResubmitted,
  highlighted,
}: {
  booking: RmsMyBooking;
  onDepositProofSubmitted: () => void;
  /** Separate from onDepositProofSubmitted — updates rentalFee.proofStatus, never
   *  securityDeposit.proofStatus, so submitting one proof can never optimistically flip the
   *  other's displayed status. */
  onRentalFeeProofSubmitted: () => void;
  onVerificationResubmitted: (kind: RmsVerificationDocumentKind) => void;
  /** True when this is the booking named by the "Make Your Payment" email CTA's ?booking= query
   * param (see MyBookings' top-level component) — forces the details section open on first render
   * and scrolls this card into view, so the customer lands directly on their payment area instead
   * of a collapsed card they'd have to find and expand themselves. */
  highlighted?: boolean;
}) {
  const statusStyle = STATUS_STYLES[booking.status] ?? 'bg-surface-strong text-ink-muted';
  const lineItems = [...booking.packages, ...booking.gears, ...booking.addOns];
  const nextStep = getNextStep(booking);

  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlighted) cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Only ever needs to happen once, right after this specific card mounts as the highlighted
    // one — never re-triggered by unrelated re-renders (e.g. a status refresh) that leave
    // `highlighted` unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared by the next-step banner's CTA and the Quick Actions row below — both only ever target an
  // id inside THIS same card, falling back to the card's own top if that id isn't currently mounted
  // (e.g. the customer manually collapsed the details panel the target lives in).
  function jumpTo(targetId: string) {
    const target = document.getElementById(targetId) ?? cardRef.current;
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div
      ref={cardRef}
      id={`booking-${booking.bookingNumber}`}
      className={`flex flex-col gap-3 rounded-2xl border bg-surface p-5 shadow-sm ${highlighted ? 'border-brand-forest ring-2 ring-brand-forest/30' : 'border-line'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Booking</p>
          <p className="break-all font-semibold text-ink">#{booking.bookingNumber}</p>
        </div>
        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusStyle}`}>
          {BOOKING_STATUS_LABELS[booking.status] ?? formatStatusLabel(booking.status)}
        </span>
      </div>

      <TripSummaryStrip booking={booking} />

      {nextStep.message && (
        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 ${TONE_STYLES[nextStep.tone]}`}>
          <ToneIcon tone={nextStep.tone} className="h-4 w-4 shrink-0 translate-y-0.5" />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
            <p className="text-sm">{nextStep.message}</p>
            {nextStep.cta && (
              <button
                type="button"
                onClick={() => jumpTo(nextStep.cta!.targetId)}
                className="text-sm font-semibold underline underline-offset-2"
              >
                {nextStep.cta.label} →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Open by default — the client's requirement is that a customer sees their booking's detail
          without clicking anything. Everything below the headline (dates, items, payment,
          verification, gear inspection) lives inside the toggle, so "Hide Details" produces a
          genuinely short card rather than one that merely drops its last panel. The status badge
          and the Next Action banner above stay visible in both states: they are the two things a
          customer must not have to expand a card to discover. */}
      <DetailsToggle
        defaultOpen
        panelId={`booking-details-${booking.bookingId}`}
        collapsedSummary={<CollapsedSummary booking={booking} />}
      >
        {/* Main column (booking/payment/progress/verification detail) + a right-hand column of
            quick actions and shortcuts, matching the card, spacing, and icon-header language of
            the client's reference — but scoped to just this ONE booking, so (unlike the page-level
            sidebar this project tried and removed earlier) the right column can never end up
            referring to a different booking than the one on screen next to it. Single column on
            anything narrower than lg, right column stacking below the main content. */}
        <div className="grid gap-4 border-t border-line-soft pt-3 lg:grid-cols-[1fr_17rem] lg:items-start lg:gap-5">
          <div className="flex min-w-0 flex-col gap-4">
            {/* Exact pickup/return time-of-day — the headline date range already lives in the
                always-visible TripSummaryStrip above; this is the finer detail a customer has just
                chosen to hide when the card is collapsed. */}
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
              <SectionHeader icon={GearPlaceholderIcon} title="Rental Details" subtitle="Your gear rental information" />
              <div className="grid grid-cols-1 gap-3 rounded-lg bg-surface-muted p-3 sm:grid-cols-3">
                <div className="min-w-0">
                  <p className="text-xs text-ink-faint">Pickup</p>
                  <p className="break-words text-sm font-medium text-ink">{formatDateTime(booking.pickupAt)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-ink-faint">Return</p>
                  <p className="break-words text-sm font-medium text-ink">{formatDateTime(booking.returnAt)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-ink-faint">Rental Kit</p>
                  <p className="break-words text-sm font-medium text-ink">
                    {booking.packages.length === 0 ? 'Build Your Own' : (booking.packages[0]?.name ?? 'Package')}
                  </p>
                </div>
              </div>

              {booking.fulfillmentType === 'DELIVERY' && (
                <div className="flex items-start gap-2 border-t border-line-soft pt-3">
                  <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-faint">Delivery Address</p>
                    <p className="text-sm font-medium text-ink">{booking.deliveryAddress}</p>
                  </div>
                </div>
              )}

              {lineItems.length > 0 && (
                <ul className="flex flex-col gap-1 border-t border-line-soft pt-3 text-sm text-ink-muted">
                  {lineItems.map((item, index) => (
                    <li key={`${item.name}-${index}`}>
                      {item.quantity > 1 ? `${item.quantity}x ` : ''}
                      {item.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <PaymentSummary booking={booking} />
            {/* Omitted for CANCELLED — see BookingProgress's own comment on why a cancelled booking
                doesn't have a meaningful position in this sequence. */}
            {booking.status !== 'CANCELLED' && (
              <div className="rounded-xl border border-line bg-surface p-4">
                <BookingProgress status={booking.status} blocked={needsAttention(booking)} />
              </div>
            )}

            {/* Identity verification is reviewed before the security deposit in the actual admin
                workflow, so it's shown first here too. Omitted entirely (not an empty bordered box)
                when the booking never went through document verification (e.g. staff-created) — same
                "omit rather than show empty" convention the Rental Fee card below already uses. */}
            {booking.verificationDocuments.length > 0 && (
              <VerificationDocumentsReview
                bookingId={booking.bookingId}
                documents={booking.verificationDocuments}
                onResubmitted={(kind) => onVerificationResubmitted(kind)}
              />
            )}

            <DepositProofUpload
              bookingId={booking.bookingId}
              requiredCentavos={booking.securityDeposit.requiredCentavos}
              verifiedCentavos={booking.securityDeposit.verifiedCentavos}
              verified={booking.securityDeposit.verified}
              proofStatus={booking.securityDeposit.proofStatus}
              reviewNote={booking.securityDeposit.reviewNote}
              amountClaimedCentavos={booking.securityDeposit.amountClaimedCentavos}
              isByoBooking={booking.packages.length === 0}
              onProofSubmitted={onDepositProofSubmitted}
            />

            {/* Deliberately a separate card, never merged with Security Deposit above — the rental
                fee is a distinct charge with its own due date (the pickup date) and is never required
                immediately. Omitted entirely (not a zeroed-out card) when the RMS response doesn't
                include it, e.g. an older booking predating this field. */}
            {booking.rentalFee && (
              <RentalFeeSummary
                bookingId={booking.bookingId}
                rentalFee={booking.rentalFee}
                onRentalFeeProofSubmitted={onRentalFeeProofSubmitted}
              />
            )}

            {/* Post-rental gear condition — a separate concept from Verification above (that's the
                customer's own ID documents; this is the returned EQUIPMENT). Omitted entirely when
                nothing was flagged, which is the common case. */}
            {booking.damageReports && booking.damageReports.length > 0 && (
              <GearInspectionPanel bookingId={booking.bookingId} reports={booking.damageReports} />
            )}

            {/* The money side of that inspection, kept as its own section: the panel above says what
                was found, this one says what is owed for it. Omitted entirely when nothing was
                charged, which is the common case. */}
            {booking.additionalCharges && booking.additionalCharges.length > 0 && (
              <AdditionalChargesPanel
                charges={booking.additionalCharges}
                totalCentavos={booking.additionalChargesTotalCentavos ?? 0}
                outstandingCentavos={booking.additionalChargesOutstandingCentavos ?? 0}
              />
            )}
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
            {booking.damageReports && booking.damageReports.length > 0 && (
              <InspectionShortcut bookingId={booking.bookingId} onJumpTo={jumpTo} />
            )}
            <QuickActions booking={booking} onJumpTo={jumpTo} />
            <PaymentBreakdown booking={booking} onJumpTo={jumpTo} />
            <NeedAssistanceCard />
          </aside>
        </div>
      </DetailsToggle>
    </div>
  );
}

/** Compact count tile for the dashboard strip. Every figure it shows is counted from the bookings
 *  the RMS actually returned — never a placeholder or an estimate. A zero count is deliberately
 *  quieter (faint number, no border emphasis) so an empty tile recedes instead of competing for
 *  attention with the tiles that actually have something to report; a positive "Needs Action" count
 *  gets a ring (not just a colored fill) so it reads as the one tile that wants a second look
 *  without shouting over the rest of the strip. */
function SummaryTile({ label, value, tone }: { label: string; value: number; tone?: 'attention' }) {
  const isEmpty = value === 0;
  const isAttention = tone === 'attention' && value > 0;

  return (
    <div
      className={`flex flex-col gap-0.5 rounded-xl border p-3 ${
        isAttention
          ? 'border-red-300 bg-red-50 ring-1 ring-red-300 dark:border-red-500/40 dark:bg-red-500/10 dark:ring-red-500/40'
          : 'border-line bg-surface'
      }`}
    >
      <span
        className={`text-xl font-bold ${
          isAttention ? 'text-red-700 dark:text-red-400' : isEmpty ? 'text-ink-faint' : 'text-ink'
        }`}
      >
        {value}
      </span>
      <span className={`text-xs ${isEmpty && !isAttention ? 'text-ink-faint' : 'text-ink-muted'}`}>{label}</span>
    </div>
  );
}

/**
 * The money, in one place and plainly labelled. Leads with the one figure customers most often
 * open this page to check — the rental-fee balance — as a large callout matching the same "big
 * number" convention RentalFeeSummary already uses below it, instead of burying it as just another
 * row inside a dense two-column grid.
 *
 * The callout is always labelled "Balance" (its actual meaning — `rentalFee.outstandingCentavos`,
 * the RMS's own computed "what's left to pay on the rental fee" figure), never relabelled to "Fully
 * Paid" once that number hits zero: showing "Fully Paid ₱0" reads as if ₱0 were the amount paid,
 * not the amount remaining, which is exactly the confusion this used to cause. A zero balance still
 * gets its own quiet "Paid in full" confirmation — just as a small tag under the figure, not as a
 * replacement label that hides what the number is.
 *
 * The rest of the breakdown (rental fee due, amount paid, payment status, the deposit's own
 * separate status) follows underneath as a compact, plainly-labelled list. Rental fee and security
 * deposit stay visually distinct because they are not the same kind of money — the deposit is
 * refundable and is never rental income — and every figure shown is the RMS's own computed value,
 * never recomputed here.
 */
function PaymentSummary({ booking }: { booking: RmsMyBooking }) {
  const { rentalFee, securityDeposit } = booking;
  const isByoBooking = booking.packages.length === 0;
  const depositPending = isByoBooking && securityDeposit.requiredCentavos <= 0 && securityDeposit.proofStatus === null;
  const hasBalanceDue = rentalFee && rentalFee.outstandingCentavos > 0;

  const paymentStatusLabel = rentalFee ? (RENTAL_FEE_STATUS_LABELS[rentalFee.status] ?? formatStatusLabel(rentalFee.status)) : null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <SectionHeader
        icon={CreditCardIcon}
        title="Payment Summary"
        subtitle="Total amount and payment status"
        badge={
          paymentStatusLabel && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${rentalFee?.status === 'PAID' ? 'bg-brand-forest/10 text-accent' : 'bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300'}`}
            >
              {paymentStatusLabel}
            </span>
          )
        }
      />

      {/* The headline figure — a colored callout only when money is actually still owed, so a
          fully-paid booking doesn't read as if something needs attention. Always labelled
          "Balance", regardless of amount, so the number's meaning never changes with its value. */}
      {rentalFee && (
        <div
          className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
            hasBalanceDue ? 'bg-amber-50 dark:bg-amber-400/10' : 'bg-brand-forest/10'
          }`}
        >
          <div>
            <span className={`text-sm font-medium ${hasBalanceDue ? 'text-amber-800 dark:text-amber-300' : 'text-accent'}`}>
              Balance
            </span>
            {!hasBalanceDue && (
              <span className="ml-1.5 inline-flex items-center gap-1 text-xs font-medium text-accent">
                <CheckCircleIcon className="h-3 w-3" /> Paid in full
              </span>
            )}
          </div>
          <span className={`text-xl font-bold ${hasBalanceDue ? 'text-amber-800 dark:text-amber-300' : 'text-accent'}`}>
            {formatCurrency(rentalFee.outstandingCentavos / 100)}
          </span>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-ink-muted">Rental Fee</dt>
        <dd className="text-right font-medium text-ink">
          {rentalFee ? formatCurrency(rentalFee.dueCentavos / 100) : formatCurrency(booking.rentalFeeCentavos / 100)}
        </dd>

        {rentalFee && (
          <>
            <dt className="text-ink-muted">Amount Paid</dt>
            <dd className="text-right font-medium text-ink">{formatCurrency(rentalFee.paidCentavos / 100)}</dd>

            <dt className="text-ink-muted">Payment Status</dt>
            <dd className="text-right font-medium text-ink">
              {RENTAL_FEE_STATUS_LABELS[rentalFee.status] ?? formatStatusLabel(rentalFee.status)}
            </dd>
          </>
        )}

        <dt className="text-ink-muted">Security Deposit{!depositPending && <span className="text-ink-faint"> (refundable)</span>}</dt>
        <dd className="text-right font-medium text-ink">
          {depositPending ? 'To Be Determined' : formatCurrency(securityDeposit.requiredCentavos / 100)}
        </dd>

        <dt className="text-ink-muted">Deposit Status</dt>
        <dd className="text-right font-medium text-ink">
          {depositPending
            ? 'Pending'
            : securityDeposit.verified
              ? 'Verified'
              : securityDeposit.proofStatus
                ? formatStatusLabel(securityDeposit.proofStatus)
                : 'Not Yet Paid'}
        </dd>
      </dl>
    </div>
  );
}

function BookingCardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-14 rounded bg-surface-strong" />
          <div className="h-4 w-24 rounded bg-surface-strong" />
        </div>
        <div className="h-6 w-24 rounded-full bg-surface-strong" />
      </div>
      <div className="h-10 rounded-lg bg-surface-strong" />
      <div className="grid grid-cols-2 gap-3 border-t border-line-soft pt-3">
        <div className="h-8 rounded bg-surface-strong" />
        <div className="h-8 rounded bg-surface-strong" />
      </div>
    </div>
  );
}

export default function MyBookings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<FetchState>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [historyPageSize, setHistoryPageSize] = useState(HISTORY_PAGE_SIZE);

  // Named by the "Make Your Payment" email CTA's ?booking=<bookingNumber> query param (see
  // sendBookingApprovalEmails on the RMS side) — never trusted for anything but which card to
  // open/scroll to; the RMS remains the sole authority on which bookings this customer actually
  // owns (fetchMyBookingsFromRms is already scoped server-side by the authenticated customer).
  const highlightedBookingNumber = new URLSearchParams(location.search).get('booking');

  useEffect(() => {
    if (authLoading || !user) return;

    let cancelled = false;
    fetchMyBookingsFromRms()
      .then(({ bookings }) => {
        if (!cancelled) {
          setState({ kind: 'ready', bookings });
          setLastUpdatedAt(new Date());
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;

        if (err instanceof RmsApiError) {
          if (err.status === 500) {
            // The RMS API URL isn't configured yet (see VITE_RMS_API_URL) — same graceful
            // degradation the old get_my_bookings RPC had while it didn't exist server-side.
            setState({ kind: 'not_configured' });
            return;
          }
          if (err.status === 401) {
            // The session that was valid when this page loaded has since expired/been revoked —
            // an active event mid-use, not "never logged in," so this one still redirects
            // immediately rather than swapping in the inline gate below.
            navigate('/login', {
              state: {
                from: location.pathname,
                mode: 'login',
                reason: 'Your session has expired — please log in again to view your bookings.',
              },
            });
            return;
          }
        }
        console.error('[MyBookings] fetch failed:', err);
        setState({ kind: 'error', message: "We couldn't load your bookings right now. Please try again shortly." });
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, navigate, location.pathname]);

  // Optimistic, local-only update so the just-submitted booking's card reflects "under review"
  // immediately. The authoritative status still comes from the RMS on next load/refresh.
  function handleProofSubmitted(bookingId: string) {
    setState((prev) => {
      if (prev.kind !== 'ready') return prev;
      return {
        kind: 'ready',
        bookings: prev.bookings.map((booking) =>
          booking.bookingId === bookingId
            ? { ...booking, securityDeposit: { ...booking.securityDeposit, proofStatus: 'PENDING_REVIEW' } }
            : booking,
        ),
      };
    });
  }

  // Same optimistic pattern as handleProofSubmitted, but for the rental fee's own, separate proof
  // — updates rentalFee.proofStatus only, never securityDeposit.proofStatus, so the two payments'
  // displayed statuses can never cross-contaminate each other.
  function handleRentalFeeProofSubmitted(bookingId: string) {
    setState((prev) => {
      if (prev.kind !== 'ready') return prev;
      return {
        kind: 'ready',
        bookings: prev.bookings.map((booking) =>
          booking.bookingId === bookingId && booking.rentalFee
            ? { ...booking, rentalFee: { ...booking.rentalFee, proofStatus: 'PENDING_REVIEW' } }
            : booking,
        ),
      };
    });
  }

  // Same optimistic pattern as handleProofSubmitted — the RMS itself is what actually reset this
  // document to PENDING_REVIEW; this only reflects that locally so the card updates immediately
  // instead of waiting on a manual refresh, and clears the note since it described the file that
  // was just replaced. Only the resubmitted kind changes — the booking's other three documents
  // are left untouched.
  function handleVerificationResubmitted(bookingId: string, kind: RmsVerificationDocumentKind) {
    setState((prev) => {
      if (prev.kind !== 'ready') return prev;
      return {
        kind: 'ready',
        bookings: prev.bookings.map((booking) =>
          booking.bookingId === bookingId
            ? {
                ...booking,
                verificationDocuments: booking.verificationDocuments.map((doc) =>
                  doc.kind === kind ? { ...doc, status: 'PENDING_REVIEW', reviewNote: null } : doc,
                ),
              }
            : booking,
        ),
      };
    });
  }

  // A manual refresh rather than polling: deposit/document review is a manual admin process on
  // the RMS side, not something that resolves within seconds, so periodic polling would only add
  // load without giving the customer anything to see sooner. Automatic refresh instead happens
  // only on the natural "customer came back to look" signals below (tab visibility/window focus).
  //
  // refreshingRef is a synchronous lock, separate from the `refreshing` state: visibilitychange
  // and focus can both fire in the same tick when the customer switches back to this tab, and a
  // state read at that point could still see the pre-update `refreshing` value from either
  // listener. The ref is set/cleared synchronously before any await, so the second listener's
  // call always sees the lock already held and skips its own fetch.
  const refreshingRef = useRef(false);

  const refreshBookings = useCallback(async () => {
    if (!user || refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      const { bookings } = await fetchMyBookingsFromRms();
      setState({ kind: 'ready', bookings });
      setLastUpdatedAt(new Date());
    } catch (err) {
      console.error('[MyBookings] refresh failed:', err);
    } finally {
      setRefreshing(false);
      refreshingRef.current = false;
    }
  }, [user]);

  function handleRefresh() {
    void refreshBookings();
  }

  // Re-fetches the moment the customer returns to this tab — e.g. after an admin marks a
  // document CORRECTION_REQUIRED while the customer already had My Bookings open — instead of
  // requiring a manual click. Both listeners call the same guarded refreshBookings, so a
  // visibilitychange+focus pair (the common case when switching back to this tab) still only
  // fires one request.
  useEffect(() => {
    if (!user) return;

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') void refreshBookings();
    }
    function handleFocus() {
      void refreshBookings();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, refreshBookings]);

  // The email CTA's target booking could in principle be a past one (e.g. cancelled after the
  // email was sent) — the "Booking History" section is collapsed by default, so it's force-expanded
  // here or the highlighted card's own scroll-into-view effect would have nothing to find. Kept
  // above the `authLoading`/`!user` early return below (hooks can't be called conditionally),
  // reading `state` directly rather than the post-return `pastBookings` variable.
  useEffect(() => {
    if (!highlightedBookingNumber || state.kind !== 'ready') return;
    const isPast = state.bookings.some(
      (b) => b.bookingNumber === highlightedBookingNumber && PAST_STATUSES.has(b.status),
    );
    if (isPast) setShowPast(true);
  }, [highlightedBookingNumber, state]);

  if (authLoading) return null;
  if (!user) {
    return (
      <AuthRequiredMessage
        redirectPath="/my-bookings"
        message="Please log in or create an account to view your bookings."
      />
    );
  }

  const bookings = state.kind === 'ready' ? state.bookings : [];
  const activeBookings = bookings.filter((booking) => !PAST_STATUSES.has(booking.status));
  const pastBookings = bookings.filter((booking) => PAST_STATUSES.has(booking.status));
  const currentBookings = activeBookings.filter((booking) => CURRENT_STATUSES.has(booking.status));
  const upcomingBookings = activeBookings.filter((booking) => !CURRENT_STATUSES.has(booking.status));
  const attentionCount = bookings.filter(needsAttention).length;
  const pendingReviewCount = bookings.filter((booking) => PENDING_REVIEW_STATUSES.has(booking.status)).length;
  const completedCount = bookings.filter((booking) => booking.status === 'COMPLETED' || booking.status === 'RETURNED').length;
  const visiblePastBookings = pastBookings.slice(0, historyPageSize);

  return (
    // max-w-6xl (72rem/1152px) — enough room for the sidebar + booking-list layout below to feel
    // comfortable at 1280/1440/1920 desktop widths without stretching either column into an
    // unreadably long line length; the old max-w-2xl (42rem/672px) was the "too narrow for desktop"
    // the client originally flagged, and a single centered column that wide would have looked just
    // as awkward as too-narrow once a real two-column layout was in play.
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif text-xl font-semibold text-ink">My Bookings</h1>
            {attentionCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400">
                <AlertTriangleIcon className="h-3 w-3" />
                {attentionCount} need{attentionCount === 1 ? 's' : ''} attention
              </span>
            )}
          </div>
          <p className="text-sm text-ink-muted">View your current rentals, payment status, and booking history.</p>
        </div>
        {state.kind === 'ready' && (
          // A subtle inline control next to the section header, not a large floating button above
          // the page — the timestamp sits in the same control as the action that produced it,
          // instead of two separate top-right elements.
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-busy={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted shadow-sm transition-colors hover:bg-surface-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ClockIcon className={`h-3.5 w-3.5 shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : lastUpdatedAt ? `Updated ${formatTime(lastUpdatedAt)}` : 'Refresh'}
          </button>
        )}
      </div>

      {/* Full-width horizontal metrics strip directly under the title — replaces the old cramped
          2x2 grid that used to live in a narrow sidebar column. */}
      {state.kind === 'ready' && bookings.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryTile label="Current & Upcoming" value={activeBookings.length} />
          <SummaryTile label="Pending Review" value={pendingReviewCount} />
          <SummaryTile label="Needs Action" value={attentionCount} tone="attention" />
          <SummaryTile label="Completed" value={completedCount} />
        </div>
      )}

      {state.kind === 'loading' && (
        <div className="flex flex-col gap-4">
          <BookingCardSkeleton />
          <BookingCardSkeleton />
        </div>
      )}

      {state.kind === 'not_configured' && (
        <p className="rounded-xl border border-line bg-surface-muted p-6 text-center text-sm text-ink-muted">
          Booking history isn't available yet — check back soon!
        </p>
      )}

      {state.kind === 'error' && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
          <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-lg border border-red-300 bg-surface px-4 py-2 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            Try Again
          </button>
        </div>
      )}

      {state.kind === 'ready' && bookings.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface-muted p-10 text-center">
          <p className="text-sm text-ink-muted">You haven't made any bookings yet.</p>
          <button
            type="button"
            onClick={() => navigate('/catalog')}
            className="rounded-lg bg-brand-forest px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
          >
            Browse Gear
          </button>
        </div>
      )}

      {/* Single-column booking list — each card is self-contained (status, next action, and its own
          inline notices all live together), so there's no separate panel elsewhere on the page that
          a customer would need to cross-reference against whichever card is on screen. */}
      {state.kind === 'ready' && bookings.length > 0 && (
        <div className="flex flex-col gap-4">
          {/* Three clearly separated groups — what's happening now, what's booked next, and what's
              finished — so a customer never has to read a status badge to work out which of their
              bookings is the live one. A group with nothing in it is omitted rather than shown as an
              empty heading; the single "no active bookings" line covers the case where both of the
              live groups are empty. */}
          {activeBookings.length === 0 && (
            <p className="rounded-xl border border-line bg-surface-muted p-6 text-center text-sm text-ink-muted">
              No active bookings right now.
            </p>
          )}

            {currentBookings.length > 0 && (
              <div className="flex flex-col gap-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-brand-forest" aria-hidden="true" />
                  Current Rental{currentBookings.length === 1 ? '' : 's'}
                </h2>
                {currentBookings.map((booking) => (
                  <BookingCard
                    key={booking.bookingId}
                    booking={booking}
                    onDepositProofSubmitted={() => handleProofSubmitted(booking.bookingId)}
                    onRentalFeeProofSubmitted={() => handleRentalFeeProofSubmitted(booking.bookingId)}
                    onVerificationResubmitted={(kind) => handleVerificationResubmitted(booking.bookingId, kind)}
                    highlighted={booking.bookingNumber === highlightedBookingNumber}
                  />
                ))}
              </div>
            )}

            {upcomingBookings.length > 0 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                  Upcoming ({upcomingBookings.length})
                </h2>
                {upcomingBookings.map((booking) => (
                  <BookingCard
                    key={booking.bookingId}
                    booking={booking}
                    onDepositProofSubmitted={() => handleProofSubmitted(booking.bookingId)}
                    onRentalFeeProofSubmitted={() => handleRentalFeeProofSubmitted(booking.bookingId)}
                    onVerificationResubmitted={(kind) => handleVerificationResubmitted(booking.bookingId, kind)}
                    highlighted={booking.bookingNumber === highlightedBookingNumber}
                  />
                ))}
              </div>
            )}

            {pastBookings.length > 0 && (
              <div className="flex flex-col gap-4 border-t border-line-soft pt-4">
                <button
                  type="button"
                  onClick={() => setShowPast((prev) => !prev)}
                  aria-expanded={showPast}
                  className="flex items-center gap-1.5 self-start text-sm font-semibold uppercase tracking-wide text-ink-muted transition-colors hover:text-ink"
                >
                  Booking History ({pastBookings.length})
                  <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${showPast ? 'rotate-180' : ''}`} />
                </button>
                {showPast &&
                  visiblePastBookings.map((booking) => (
                    <BookingCard
                      key={booking.bookingId}
                      booking={booking}
                      onDepositProofSubmitted={() => handleProofSubmitted(booking.bookingId)}
                      onRentalFeeProofSubmitted={() => handleRentalFeeProofSubmitted(booking.bookingId)}
                      onVerificationResubmitted={(kind) => handleVerificationResubmitted(booking.bookingId, kind)}
                      highlighted={booking.bookingNumber === highlightedBookingNumber}
                    />
                  ))}

                {showPast && visiblePastBookings.length < pastBookings.length && (
                  <button
                    type="button"
                    onClick={() => setHistoryPageSize((size) => size + HISTORY_PAGE_SIZE)}
                    className="self-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-surface-strong"
                  >
                    Show more ({pastBookings.length - visiblePastBookings.length} remaining)
                  </button>
                )}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
