import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthRequiredMessage from '../components/AuthRequiredMessage';
import FilterPill from '../components/FilterPill';
import AdditionalChargeProofDialog from '../components/checkout/AdditionalChargeProofDialog';
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
  RMS_NOT_CONFIGURED_CODE,
  RmsApiError,
  type RmsAdditionalCharge,
  type RmsDamageReport,
  type RmsMyBooking,
  type RmsRentalFee,
  type RmsReturnSettlement,
  type RmsVerificationDocumentKind,
} from '../utils/rmsApi';
import { formatCurrency } from '../utils/format';
import { BUSINESS_TIME_ZONE } from '../utils/duration';
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

/**
 * Genuinely final RMS booking statuses (confirmed against the RMS's own `BookingStatus` enum in
 * prisma/schema.prisma) — once a booking reaches one of these two, RMS has no further transition
 * for it and no customer action is ever applicable again. Deliberately NOT the same set as
 * PAST_STATUSES above: that one is purely a display grouping for "Booking History" and also
 * includes RETURNED, but RETURNED sits between the rental period and COMPLETED — a booking can
 * still have a legitimately payable rental fee or additional charge awaiting review while
 * RETURNED, so it must stay actionable and is deliberately excluded here. Used to gate every
 * customer-facing action (payment-proof submission, verification-document resubmission, action
 * banners, outstanding-payment counts) — never to hide historical information, which must remain
 * visible regardless of status; see isTerminalBooking's own call sites.
 */
export const TERMINAL_BOOKING_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

/** How a failed initial bookings load is presented. Only rmsFetch's own client-side missing-URL error
 *  is "not_configured" — a genuine RMS HTTP 500 (or 502/503/504, 429, etc.) is an ordinary,
 *  retryable "error". A 401 here has already been ruled out as "no Customer row yet" by
 *  fetchMyBookingsFromRms, so it means the session itself is no longer valid. */
export function classifyMyBookingsLoadError(err: unknown): 'not_configured' | 'session_expired' | 'error' {
  if (err instanceof RmsApiError) {
    if (err.code === RMS_NOT_CONFIGURED_CODE) return 'not_configured';
    if (err.status === 401) return 'session_expired';
  }
  return 'error';
}

export function isTerminalBooking(booking: RmsMyBooking): boolean {
  return TERMINAL_BOOKING_STATUSES.has(booking.status);
}

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

/** Overrides for the RMS status values whose auto-generated label reads as internal/technical
 *  rather than a plain customer instruction — never a new status, just friendlier wording for an
 *  existing one. AWAITING_PAYMENT's auto label ("Awaiting Payment") is accurate but passive —
 *  "Payment Required" states the actual next step the customer needs to take. PENDING_FOR_INSPECTION
 *  is deliberately NOT listed here — its badge needs one of two different labels depending on
 *  whether RMS recorded a return issue, which a plain per-status lookup can't express; see
 *  getBookingStatusLabel below, which handles that one status specially and falls back to this map
 *  (then formatStatusLabel's plain auto-generated label) for every other status. */
const BOOKING_STATUS_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: 'Payment Required',
};

/**
 * Whether this booking currently has money the customer still needs to pay — the security deposit
 * (not yet verified, and genuinely owed rather than "To Be Determined" — see the isByoBooking-style
 * reasoning already used elsewhere on this page for that distinction) or an outstanding rental-fee
 * balance. Every field read here is the RMS's own already-returned figure; nothing is computed or
 * estimated. Powers the "Payment" tab below — a filtered VIEW over the same booking list already
 * fetched, never a second data source or a second payment system.
 */
export function hasOutstandingPayment(booking: RmsMyBooking): boolean {
  // A terminal booking (COMPLETED/CANCELLED) never counts here, even if its own figures would
  // otherwise math out to "owed" — see isTerminalBooking's own doc comment. This tab/badge means
  // "you can act on this," and no payment action is ever offered for a terminal booking anymore
  // (the actual historical figures still show inside the booking card itself, unaffected by this).
  if (isTerminalBooking(booking)) return false;
  // An APPROVED proof whose net verified amount is now 0 (or any recorded retained/refunded amount)
  // means the deposit WAS collected and has since been refunded or applied to a return issue (RMS's
  // net paidDeposit = collected − returned − forfeited) — never "still owed". A deposit that is
  // merely short because an add-on raised the requirement still has verifiedCentavos > 0 and stays owed.
  const depositSettled =
    (booking.securityDeposit.proofStatus === 'APPROVED' && booking.securityDeposit.verifiedCentavos <= 0) ||
    (booking.securityDeposit.retainedCentavos ?? 0) > 0 ||
    (booking.securityDeposit.refundedCentavos ?? 0) > 0;
  const depositOwed =
    !booking.securityDeposit.verified && booking.securityDeposit.requiredCentavos > 0 && !depositSettled;
  const rentalFeeOwed = booking.rentalFee ? booking.rentalFee.outstandingCentavos > 0 : false;
  return depositOwed || rentalFeeOwed;
}

/** How many past bookings are rendered at once. The RMS's GET /api/customer/bookings returns the
 *  customer's full list in one response (it exposes no paging parameters), so this pages through
 *  what was already fetched rather than issuing extra requests — it keeps a long history from
 *  rendering hundreds of cards at once, which is the cost that actually shows up for the customer. */
const HISTORY_PAGE_SIZE = 5;

/** Booking-history status filter value meaning "don't filter". Every other selectable value is a
 *  real RMS status taken from PAST_STATUSES — no booking state is invented here, and the options
 *  are derived at render time from the statuses this customer actually has, so a chip that would
 *  match nothing never appears (and a future PAST_STATUSES entry shows up on its own). */
const HISTORY_FILTER_ALL = 'ALL';

/** Below this many past bookings, a search box is more clutter than help — the whole list is
 *  already on screen in one or two glances, and the status chips alone cover narrowing it. */
const HISTORY_SEARCH_MIN = 4;

/** Client-side only, over the bookings this page already fetched: the RMS's
 *  GET /api/customer/bookings returns the customer's full list in one response and exposes no
 *  search parameters, so adding a backend endpoint for what is at most a few dozen already-loaded
 *  rows would be a far larger change than the problem warrants. Matches the booking reference or
 *  any line item's name (package, Build Your Own gear, or add-on). */
function matchesHistoryQuery(booking: RmsMyBooking, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (booking.bookingNumber.toLowerCase().includes(needle)) return true;
  return [...booking.packages, ...booking.gears, ...booking.addOns].some((item) =>
    item.name.toLowerCase().includes(needle),
  );
}

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
  return date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: BUSINESS_TIME_ZONE });
}

/** Date without the time-of-day — used in the collapsed card summary, where the exact pickup hour
 *  is detail the customer has just chosen to hide. The full timestamp is still shown in the
 *  expanded Dates section via formatDateTime. */
function formatDateOnly(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: BUSINESS_TIME_ZONE });
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

export function getNextStep(booking: RmsMyBooking): NextStep {
  const detailsTargetId = `booking-details-${booking.bookingId}`;

  // These three checks each imply an action the customer can still take (replace a document,
  // resubmit a rejected proof) — never applicable once the booking is terminal (COMPLETED/
  // CANCELLED; see isTerminalBooking's own doc comment), even if the underlying document/proof
  // genuinely IS in a REJECTED/CORRECTION_REQUIRED state (e.g. a booking that was cancelled while
  // a proof was still under dispute). Skipping straight to the switch below for a terminal booking
  // is what lets its own neutral COMPLETED/CANCELLED case (which already existed) actually apply.
  if (!isTerminalBooking(booking)) {
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
  }

  switch (booking.status) {
    case 'PENDING_REVIEW':
    case 'AWAITING_CUSTOMER_RESPONSE':
      return { tone: 'info', message: "We're reviewing your verification documents — we'll notify you once they're approved." };
    case 'PENDING_FOR_INSPECTION': {
      // Driven by RMS's own returnCondition (see getReturnOutcome) — matches getBookingStatusLabel.
      const outcome = getReturnOutcome(booking);
      if (outcome === 'issue' || outcome === 'issue_resolved') {
        // The inspection panel only exists when a DamageReport was recorded — a missing/lost-only
        // issue has none, so the CTA is only offered when its target actually renders.
        const hasInspectionPanel = (booking.damageReports?.length ?? 0) > 0;
        return {
          tone: 'warning',
          message:
            outcome === 'issue'
              ? 'An issue was found during the return inspection. Please check your booking for updates.'
              : 'An issue was found during the return inspection and has been resolved.',
          ...(hasInspectionPanel
            ? { cta: { label: 'View inspection details', targetId: `gear-inspection-${booking.bookingId}` } }
            : {}),
        };
      }
      if (outcome === 'cleared') {
        return { tone: 'info', message: 'Your returned gear passed inspection. GearBnB will complete your booking shortly.' };
      }
      return {
        tone: 'info',
        message: "Your returned gear is currently being inspected by GearBnB. We'll notify you once the inspection is complete.",
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
    case 'RETURNED': {
      // The final recorded return condition stays visible on a finished booking.
      const outcome = getReturnOutcome(booking);
      if (outcome === 'issue') {
        return { tone: 'neutral', message: 'Trip completed — an issue was recorded during the return inspection.' };
      }
      if (outcome === 'issue_resolved') {
        return { tone: 'neutral', message: 'Trip completed — an issue was recorded during the return inspection and has been resolved.' };
      }
      return { tone: 'neutral', message: 'Trip completed — thanks for booking with GearBnB!' };
    }
    case 'CANCELLED':
      return { tone: 'neutral', message: 'This booking was cancelled.' };
    default:
      return { tone: 'neutral', message: '' };
  }
}

export type ReturnOutcome = 'none' | 'inspecting' | 'cleared' | 'issue' | 'issue_resolved';

/**
 * Customer-facing reading of the RMS's own `returnCondition` (derived server-side by
 * deriveReturnCondition in domain/returnCondition.ts — NOT_RETURNED / UNDER_INSPECTION / CLEAN /
 * ISSUE_UNRESOLVED / ISSUE_RESOLVED). Unlike `damageReports`, it also covers Missing/Lost items,
 * which have no DamageReport row. A cancelled booking never has a return, so it is always 'none'.
 * When the field is absent (older RMS response) it falls back to the previous damageReports-based
 * reading for a booking that is under inspection, and otherwise 'none' — never invented.
 */
export function getReturnOutcome(booking: RmsMyBooking): ReturnOutcome {
  if (booking.status === 'CANCELLED') return 'none';
  switch (booking.returnCondition) {
    case 'UNDER_INSPECTION':
      return 'inspecting';
    case 'CLEAN':
      return 'cleared';
    case 'ISSUE_UNRESOLVED':
      return 'issue';
    case 'ISSUE_RESOLVED':
      return 'issue_resolved';
    case 'NOT_RETURNED':
      return 'none';
    default:
      if (booking.status === 'PENDING_FOR_INSPECTION') {
        return (booking.damageReports?.length ?? 0) > 0 ? 'issue' : 'inspecting';
      }
      return 'none';
  }
}

/**
 * The booking card's own status pill — plain BOOKING_STATUS_LABELS lookup for every status except
 * PENDING_FOR_INSPECTION, whose label follows the RMS's own returnCondition (see getReturnOutcome,
 * kept in sync with getNextStep). Once RMS marks the booking Completed/Returned,
 * BOOKING_STATUS_LABELS's own fallback (formatStatusLabel) renders "Completed" / "Returned".
 */
export function getBookingStatusLabel(booking: RmsMyBooking): string {
  if (booking.status === 'PENDING_FOR_INSPECTION') {
    switch (getReturnOutcome(booking)) {
      case 'issue':
        return 'Return Issue Found';
      case 'issue_resolved':
        return 'Return Issue Resolved';
      case 'cleared':
        return 'Return Cleared';
      default:
        return 'Return Under Inspection';
    }
  }
  return BOOKING_STATUS_LABELS[booking.status] ?? formatStatusLabel(booking.status);
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
 * Controlled by the parent BookingCard (rather than owning its own state) so a "jump to details"
 * CTA elsewhere on the card can force this open before scrolling to something inside it — see
 * BookingCard's own jumpTo. Current/upcoming bookings still start open (the client's requirement:
 * a customer must never have to click just to see their own booking's details); past bookings
 * start closed so Booking History reads as a compact list rather than a second copy of the active
 * section — see BookingCard's `defaultOpen`. Collapsing swaps the detail for `collapsedSummary` —
 * the short "booking reference / dates / kit / balance" line — so a collapsed card genuinely
 * becomes short instead of merely dropping its last few panels.
 */
function DetailsToggle({
  open,
  onToggle,
  collapsedSummary,
  panelId,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  collapsedSummary: ReactNode;
  /** Ties the button to the region it controls via aria-controls, and gives the expanded content a
   *  real anchor other parts of the page (e.g. the Gear Inspection alert) can scroll straight to. */
  panelId: string;
  children: ReactNode;
}) {
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
        onClick={onToggle}
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

/** The short form of a booking's DEEPER detail once its card is collapsed — just the two figures
 *  customers come back to check (the outstanding balance and payment status) and a
 *  gear-inspection flag when there is one. Rental dates, booking type and fulfillment are
 *  deliberately NOT repeated here — they live in the always-visible TripSummaryStrip above this,
 *  in both the collapsed and expanded state, so collapsing a card never hides them. Every value is
 *  read straight off the RMS response (`rentalFee` is the server's own computed object); nothing
 *  here is recalculated in the browser. This is what Booking History now shows by default for each
 *  past booking (see BookingCard's `defaultOpen`), so a payment status here — not just a balance
 *  that's usually already ₱0 for a finished booking — is what actually tells a customer how that
 *  booking was settled without expanding it. */
function CollapsedSummary({ booking }: { booking: RmsMyBooking }) {
  const { rentalFee } = booking;
  if (!rentalFee && !(booking.damageReports && booking.damageReports.length > 0)) return null;

  const paymentStatusLabel = rentalFee
    ? (RENTAL_FEE_STATUS_LABELS[rentalFee.status] ?? formatStatusLabel(rentalFee.status))
    : null;

  return (
    // min-w-0 + break-words on every value: a long note or a narrow 375px phone must wrap inside
    // the card rather than force the whole page to scroll sideways.
    <dl className="flex flex-col gap-1.5 border-t border-line-soft pt-3 text-sm">
      {rentalFee && (
        <>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <dt className="text-ink-muted">Balance:</dt>
            <dd className="font-semibold text-ink">{formatCurrency(rentalFee.outstandingCentavos / 100)}</dd>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <dt className="text-ink-muted">Payment Status:</dt>
            <dd className="font-medium text-ink">{paymentStatusLabel}</dd>
          </div>
        </>
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
 * What the booking actually contains, grouped by what each line genuinely IS rather than flattened
 * into a single list. A package is a predefined bundle; Build Your Own gear is individually chosen;
 * add-ons are separate optional extras rented on top of either. Merging all three (as this card
 * previously did) makes an add-on read as though it were part of the package's own contents —
 * exactly the relationship the customer needs to be able to tell apart when checking what they
 * paid for. Groups with nothing in them are omitted rather than rendered as empty headings.
 */
/**
 * True for a package booking that also has extra rentable inventory attached beyond the package
 * itself. The RMS returns a package's own optional add-ons as `gears` (BookingGear rows) — see
 * RentalLineItems' own comment just below on why `gears` means "this package's optional add-ons"
 * once a package is present, never "Build Your Own gear" — because PaymentBreakdown's package
 * submission branch only ever sends them as `bookingGears`, never through the separate `addOns`
 * field (that one is reserved for add-ons attached to BYO gear). Checking `addOns` alone here
 * previously meant this was always false for a real package + add-ons booking — e.g. #GB-2026-0916-04
 * (The Stargazer Kit + Blackpongo Bed/Generic Camping Chair/Multi-Brand Cooking/Gazlite Cooking),
 * whose extras all arrive via `gears`, not `addOns` — so the pending-add-on-deposit notice never
 * appeared for it. `addOns` is still checked too, defensively, so this can never miss a real add-on
 * regardless of which of the RMS's two fields it happens to land in. Always false for a BYO-only
 * booking (no packages at all), which already has its own separate "To Be Determined" story.
 */
function hasPackageAddOns(booking: RmsMyBooking): boolean {
  return booking.packages.length > 0 && (booking.gears.length > 0 || booking.addOns.length > 0);
}

function RentalLineItems({ booking }: { booking: RmsMyBooking }) {
  // The RMS returns extra rentable inventory as BookingGear rows either way, so `gears` means two
  // different things depending on the booking: the whole rental on a Build Your Own booking, or
  // the optional extras added on top of a package. Labelled accordingly rather than always calling
  // them "Build Your Own Gear", which would misdescribe a package booking's add-ons.
  const isPackageBooking = booking.packages.length > 0;
  const groups: { label: string; items: { name: string; quantity: number }[]; additional: boolean }[] = [
    { label: 'Package', items: booking.packages, additional: false },
    {
      label: isPackageBooking ? 'Optional Add-ons' : 'Build Your Own Gear',
      items: booking.gears,
      additional: isPackageBooking,
    },
    // Labelled the same way as the group above: a package booking's real "Add-ons" (compatible
    // extras attached to the package itself) stays "Add-ons", but a BYO booking's own extras
    // (attached to a specific piece of BYO gear — see byoAddOns) previously showed the literal
    // "Add-ons" heading too, sitting right under "Build Your Own Gear" as if this booking somehow
    // had two separate add-on concepts. "Additional Gear" keeps the same "these are extra, not the
    // base selection" meaning (still gets the "+" prefix via `additional: true`) without repeating
    // a heading that reads as package-specific terminology on a booking that has no package at all.
    { label: isPackageBooking ? 'Add-ons' : 'Additional Gear', items: booking.addOns, additional: true },
  ].filter((group) => group.items.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-line-soft pt-3">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{group.label}</p>
          <ul className="flex flex-col gap-1 text-sm text-ink-muted">
            {group.items.map((item, index) => (
              <li key={`${item.name}-${index}`} className="break-words">
                {/* Marks these as additional rentals rather than package contents. Decorative only:
                    the group's own heading above already carries the same meaning for screen
                    readers, so this would otherwise just be read out as stray punctuation. */}
                {group.additional && <span aria-hidden="true">+ </span>}
                {item.quantity > 1 ? `${item.quantity}× ` : ''}
                {item.name}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
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
    <div className="flex flex-col gap-2 rounded-xl bg-surface-muted p-2.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
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
  readOnly,
}: {
  bookingId: string;
  rentalFee: RmsRentalFee;
  onRentalFeeProofSubmitted: () => void;
  /** True once the parent booking has reached a terminal status (COMPLETED/CANCELLED) — forwarded
   *  straight to RentalFeeProofUpload; see that component's own doc comment on its `readOnly` prop. */
  readOnly: boolean;
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
        readOnly={readOnly}
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
 * Which of the charge's own RMS-reported fields (status + paymentProof.status) currently governs
 * what's shown for it — never a new status invented here, just a plain read of the fields already
 * on RmsAdditionalCharge. PAID/WAIVED/REVERSED are all terminal, non-payable outcomes; PENDING is
 * the only status a payment action ever applies to, and even then only while paymentProof.status
 * isn't already PENDING_REVIEW/APPROVED (which would mean a submission is already in flight or
 * already accepted). paymentProof is its own nested object on the real RMS response (NOT a flat
 * proofStatus field — see RmsAdditionalCharge's own doc comment), so it's read as
 * `charge.paymentProof?.status`, never `charge.proofStatus`.
 */
export type ChargeProofState = 'paid' | 'waived' | 'reversed' | 'payable' | 'pending_review' | 'approved' | 'rejected';

export function getChargeProofState(charge: RmsAdditionalCharge): ChargeProofState {
  if (charge.status === 'PAID') return 'paid';
  if (charge.status === 'WAIVED') return 'waived';
  if (charge.status === 'REVERSED') return 'reversed';
  if (charge.paymentProof?.status === 'PENDING_REVIEW') return 'pending_review';
  if (charge.paymentProof?.status === 'APPROVED') return 'approved';
  if (charge.paymentProof?.status === 'REJECTED') return 'rejected';
  return 'payable';
}

/**
 * The customer's itemised additional-charge statement — one line per charge, exactly as staff
 * recorded it during the gear inspection, so a rental that had a damaged item, a missing item, a
 * late return and an extension shows four separate lines rather than one lump sum. Each PENDING
 * charge with no proof already under review/approved gets its own "Pay Additional Charge" action —
 * a charge is its own independent payment-proof workflow (see AdditionalChargeProofDialog), since
 * a booking can have more than one outstanding charge at once.
 *
 * Every figure comes from the RMS response: the per-line amounts and the outstanding total are both
 * server-derived, and nothing is added up in the browser. The charge's own `amountCentavos` is
 * already RMS's final "what remains payable" figure (see ReturnSettlementPanel's own doc comment
 * on why a covered damage's excess, not its raw issue amount, is what shows up here) — this panel
 * never recomputes it against a deposit or any other figure.
 */
function AdditionalChargesPanel({
  bookingId,
  charges,
  totalCentavos,
  outstandingCentavos,
  onChargeProofSubmitted,
  readOnly,
}: {
  bookingId: string;
  charges: RmsAdditionalCharge[];
  /** Sum of every line actually shown above — matches "Total Additional Charges" literally, so it
   *  always reconciles with the individual lines a customer can see and add up themselves. */
  totalCentavos: number;
  /** What's still unpaid — only shown as its own line when it differs from the total, i.e. when at
   *  least one charge is already marked Paid; otherwise it would just repeat the total. */
  outstandingCentavos: number;
  /** Called with the specific charge's id once RMS has accepted a proof for it — lets the parent
   *  optimistically flip that one charge's local proofStatus to "pending" without a full refetch. */
  onChargeProofSubmitted: (chargeId: string) => void;
  /** True once the parent booking has reached a terminal status (COMPLETED/CANCELLED) — suppresses
   *  the "Pay Additional Charge"/"Submit New Proof" action for every charge while leaving every
   *  status line (Paid/Waived/Reversed/Pending Payment/Under Review/Approved/Rejected + reviewNote)
   *  exactly as it already renders, since that's historical information, not an action. */
  readOnly: boolean;
}) {
  // Collapsed by default UNLESS at least one charge actually needs the customer's attention
  // (payable, or a rejected proof that needs replacing) — a customer with something to pay
  // shouldn't have to know to click "View charges" first to find the action. Never auto-expands
  // for this reason once the booking is read-only: there is no action left to surface.
  const [showItemized, setShowItemized] = useState(
    () => !readOnly && charges.some((c) => ['payable', 'rejected'].includes(getChargeProofState(c))),
  );
  // Which charge the payment-proof dialog is currently open for, if any — owned right here
  // (rather than drilled further up through BookingCard/MyBookings) since it's purely this
  // panel's own transient UI state; only the eventual "proof submitted" outcome needs to bubble
  // up, for the same optimistic-update pattern onDepositProofSubmitted/onRentalFeeProofSubmitted
  // already use one level up.
  const [payingCharge, setPayingCharge] = useState<RmsAdditionalCharge | null>(null);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-muted p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Additional Charges</h3>
        <span className="text-sm font-bold text-ink">
          {formatCurrency((outstandingCentavos > 0 ? outstandingCentavos : totalCentavos) / 100)}
          {outstandingCentavos > 0 && <span className="ml-1 text-xs font-medium text-ink-muted">outstanding</span>}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setShowItemized((prev) => !prev)}
        aria-expanded={showItemized}
        className="flex items-center gap-1 self-start text-xs font-semibold text-accent underline-offset-2 hover:underline"
      >
        {showItemized ? 'Hide charges' : 'View charges'}
        <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 transition-transform ${showItemized ? 'rotate-180' : ''}`} />
      </button>

      {showItemized && (
        <>
          <ol className="flex flex-col gap-2 border-t border-line-soft pt-3">
            {charges.map((c, index) => {
              const state = getChargeProofState(c);
              return (
                <li key={c.chargeNumber} className="flex flex-col gap-1.5 border-b border-line-soft pb-3 last:border-b-0 last:pb-0">
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

                  {state === 'paid' && <p className="text-xs font-medium text-accent">Paid</p>}
                  {state === 'waived' && <p className="text-xs font-medium text-ink-muted">Waived</p>}
                  {state === 'reversed' && <p className="text-xs font-medium text-ink-muted">Reversed</p>}
                  {state === 'payable' && (
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Pending Payment</p>
                  )}
                  {state === 'pending_review' && (
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Payment Proof Under Review</p>
                  )}
                  {state === 'approved' && <p className="text-xs font-medium text-accent">Payment Approved</p>}
                  {state === 'rejected' && (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-medium text-red-600 dark:text-red-400">Payment Proof Rejected</p>
                      {c.paymentProof?.reviewNote && <p className="text-xs text-ink-muted">{c.paymentProof.reviewNote}</p>}
                    </div>
                  )}

                  {/* Gated on the RMS-reported canSubmitPaymentProof hint (falling back to the same
                      payable/rejected derivation above for an older RMS response that predates the
                      field) rather than only the locally-derived state, so Main defers to RMS's own
                      "is a submission currently allowed" answer wherever it's actually provided.
                      Also gated on !readOnly — once the booking itself is terminal (COMPLETED/
                      CANCELLED), no new charge proof is ever submittable regardless of the charge's
                      own state. */}
                  {!readOnly && (state === 'payable' || state === 'rejected') && (c.canSubmitPaymentProof ?? true) && (
                    <button
                      type="button"
                      onClick={() => setPayingCharge(c)}
                      className="mt-0.5 self-start rounded-lg bg-brand-forest px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
                    >
                      {state === 'rejected' ? 'Submit New Proof' : 'Pay Additional Charge'}
                    </button>
                  )}
                </li>
              );
            })}
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
        </>
      )}

      {outstandingCentavos > 0 && (
        <p className="text-sm text-ink-muted">These charges are separate from your rental fee and security deposit.</p>
      )}

      {payingCharge && (
        <AdditionalChargeProofDialog
          bookingId={bookingId}
          charge={payingCharge}
          onClose={() => setPayingCharge(null)}
          onProofSubmitted={() => onChargeProofSubmitted(payingCharge.id)}
        />
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
 * The financial OUTCOME of a return-inspection issue — GearInspectionPanel above (when present)
 * says WHAT was found; this says what happened to the security deposit as a result, and whether
 * anything is still owed. Every figure here is the RMS's own already-settled `returnSettlement`
 * object (see RmsReturnSettlement's own doc comment) — nothing is computed, reconstructed, or
 * cross-checked here from DamageReport/AdditionalCharge/Payment records. Rendered only when RMS
 * has actually run a settlement; a clean return (`returnSettlement === null`) never reaches this
 * component at all (see its call site), so there is no risk of a false return-issue section.
 *
 * `excessChargeCentavos`/`balanceDueCentavos` are described here as context for what the security
 * deposit did and didn't cover — never as a second, independent "amount owed" alongside whatever
 * AdditionalChargesPanel already lists. When this booking also has real `additionalCharges`
 * entries, a short note below the figures makes explicit that it's the same amount, not a second
 * one, so a customer reading both sections never adds them together.
 */
function ReturnSettlementPanel({
  settlement,
  hasAdditionalCharges,
}: {
  settlement: RmsReturnSettlement;
  hasAdditionalCharges: boolean;
}) {
  const isFullyCovered = settlement.excessChargeCentavos <= 0 && settlement.balanceDueCentavos <= 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-400/50 dark:bg-amber-400/10 sm:p-5">
      <div className="flex items-center gap-2">
        <ShieldCheckIcon className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
          Return Settlement
        </h3>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-amber-800/80 dark:text-amber-300/80">Return Issue</dt>
        <dd className="text-right font-medium text-amber-900 dark:text-amber-200">
          {formatCurrency(settlement.issueAmountCentavos / 100)}
        </dd>

        <dt className="text-amber-800/80 dark:text-amber-300/80">Covered by Security Deposit</dt>
        <dd className="text-right font-medium text-amber-900 dark:text-amber-200">
          {formatCurrency(settlement.depositAppliedCentavos / 100)}
        </dd>

        <dt className="text-amber-800/80 dark:text-amber-300/80">Security Deposit Retained</dt>
        <dd className="text-right font-medium text-amber-900 dark:text-amber-200">
          {formatCurrency(settlement.depositAppliedCentavos / 100)}
        </dd>

        <dt className="text-amber-800/80 dark:text-amber-300/80">Security Deposit Refunded</dt>
        <dd className="text-right font-medium text-amber-900 dark:text-amber-200">
          {formatCurrency(settlement.refundCentavos / 100)}
        </dd>
      </dl>

      <div className="flex items-center justify-between border-t border-amber-300/60 pt-2.5 dark:border-amber-400/30">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {isFullyCovered ? 'No Additional Balance Due' : 'Additional Amount Due — Return Issue'}
        </p>
        {!isFullyCovered && (
          <p className="text-base font-bold text-amber-900 dark:text-amber-200">
            {formatCurrency(settlement.balanceDueCentavos / 100)}
          </p>
        )}
      </div>

      {/* Only shown when there's a real excess AND a real Additional Charges entry to point to —
          never asserts a relationship that isn't actually there. Reworded, never duplicated: the
          amount itself is only ever shown once, in AdditionalChargesPanel further down this card. */}
      {!isFullyCovered && hasAdditionalCharges && (
        <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
          This is the same amount shown in Additional Charges below — the remaining return-issue
          amount after your security deposit was applied, not a second, separate charge.
        </p>
      )}
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
  onAdditionalChargeProofSubmitted,
  onVerificationResubmitted,
  highlighted,
  defaultOpen,
}: {
  booking: RmsMyBooking;
  onDepositProofSubmitted: () => void;
  /** Separate from onDepositProofSubmitted — updates rentalFee.proofStatus, never
   *  securityDeposit.proofStatus, so submitting one proof can never optimistically flip the
   *  other's displayed status. */
  onRentalFeeProofSubmitted: () => void;
  /** Separate again — updates only the one specific charge (by id) whose proof was just
   *  submitted, never the deposit's or rental fee's own proofStatus. */
  onAdditionalChargeProofSubmitted: (chargeId: string) => void;
  onVerificationResubmitted: (kind: RmsVerificationDocumentKind) => void;
  /** True when this is the booking named by the "Make Your Payment" email CTA's ?booking= query
   * param (see MyBookings' top-level component) — forces the details section open on first render
   * and scrolls this card into view, so the customer lands directly on their payment area instead
   * of a collapsed card they'd have to find and expand themselves. */
  highlighted?: boolean;
  /** Whether the details panel starts open — true for current/upcoming bookings (the client's
   *  requirement below), false for past/completed ones so Booking History reads as a compact list
   *  rather than a second copy of the active section. The top-level component always passes true
   *  here when `highlighted`, regardless of past/current, so the email CTA still lands the
   *  customer on an open card. */
  defaultOpen: boolean;
}) {
  const statusStyle = STATUS_STYLES[booking.status] ?? 'bg-surface-strong text-ink-muted';
  const nextStep = getNextStep(booking);
  const [detailsOpen, setDetailsOpen] = useState(defaultOpen);
  const panelId = `booking-details-${booking.bookingId}`;

  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlighted) cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Only ever needs to happen once, right after this specific card mounts as the highlighted
    // one — never re-triggered by unrelated re-renders (e.g. a status refresh) that leave
    // `highlighted` unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared by the next-step banner's CTA and the Quick Actions row below — both only ever target an
  // id inside the details panel (or the panel itself). Those ids don't exist in the DOM while the
  // panel is collapsed (see DetailsToggle), which past bookings now start as by default — so this
  // opens the panel first, then waits a couple of frames for it to actually mount before scrolling.
  // Harmless when the panel was already open: the target is already there, just found a frame late.
  function jumpTo(targetId: string) {
    setDetailsOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = document.getElementById(targetId) ?? cardRef.current;
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  return (
    <div
      ref={cardRef}
      id={`booking-${booking.bookingNumber}`}
      className={`flex flex-col gap-2.5 rounded-2xl border bg-surface p-3.5 shadow-sm sm:gap-3 sm:p-5 ${highlighted ? 'border-brand-forest ring-2 ring-brand-forest/30' : 'border-line'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-ink-faint">Booking</p>
          <p className="break-all font-semibold text-ink">#{booking.bookingNumber}</p>
        </div>
        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusStyle}`}>
          {getBookingStatusLabel(booking)}
        </span>
      </div>

      <TripSummaryStrip booking={booking} />

      {nextStep.message && (
        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 sm:py-2.5 ${TONE_STYLES[nextStep.tone]}`}>
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

      {/* Current/upcoming bookings start open — the client's requirement is that a customer sees
          their booking's detail without clicking anything. Past bookings start closed (see
          `defaultOpen`) so Booking History reads as a compact list. Everything below the headline
          (dates, items, payment, verification, gear inspection) lives inside the toggle, so "Hide
          Details" produces a genuinely short card rather than one that merely drops its last panel.
          The status badge and the Next Action banner above stay visible in both states: they are
          the two things a customer must not have to expand a card to discover. */}
      <DetailsToggle
        open={detailsOpen}
        onToggle={() => setDetailsOpen((prev) => !prev)}
        panelId={panelId}
        collapsedSummary={<CollapsedSummary booking={booking} />}
      >
        {/* Main column (booking/payment/progress/verification detail) + a right-hand column of
            quick actions and shortcuts, matching the card, spacing, and icon-header language of
            the client's reference — but scoped to just this ONE booking, so (unlike the page-level
            sidebar this project tried and removed earlier) the right column can never end up
            referring to a different booking than the one on screen next to it. Single column on
            anything narrower than lg, right column stacking below the main content. */}
        <div className="grid gap-3.5 border-t border-line-soft pt-3 sm:gap-4 lg:grid-cols-[1fr_17rem] lg:items-start lg:gap-5">
          <div className="flex min-w-0 flex-col gap-3.5 sm:gap-4">
            {/* Exact pickup/return time-of-day — the headline date range already lives in the
                always-visible TripSummaryStrip above; this is the finer detail a customer has just
                chosen to hide when the card is collapsed. */}
            <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-3.5 sm:gap-3 sm:p-4">
              <SectionHeader icon={GearPlaceholderIcon} title="Rental Details" subtitle="Your gear rental information" />
              <div className="grid grid-cols-1 gap-2.5 rounded-lg bg-surface-muted p-2.5 sm:grid-cols-3 sm:gap-3 sm:p-3">
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

              <RentalLineItems booking={booking} />
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
                "omit rather than show empty" convention the Rental Fee card below already uses.
                Also omitted once the booking has moved into/past the return-inspection stage
                (PENDING_FOR_INSPECTION/COMPLETED/RETURNED/CANCELLED) — that stage is genuinely over
                by then, and its own "Verification Documents" heading sitting on the card right next
                to the return/inspection status was reading as if verification were still an active,
                current-stage concern. Still shown regardless of stage if a document genuinely needs
                a correction, so the historical detail stays visible — but never with an active
                replace form once the booking is terminal (COMPLETED/CANCELLED; see the `readOnly`
                prop below and isTerminalBooking's own doc comment): a booking that was cancelled or
                completed while a document was still under dispute must keep showing that history
                without offering a resubmission that can no longer lead anywhere. */}
            {booking.verificationDocuments.length > 0 &&
              (!['PENDING_FOR_INSPECTION', 'COMPLETED', 'RETURNED', 'CANCELLED'].includes(booking.status) ||
                booking.verificationDocuments.some((doc) => doc.status === 'CORRECTION_REQUIRED')) && (
                <VerificationDocumentsReview
                  bookingId={booking.bookingId}
                  documents={booking.verificationDocuments}
                  onResubmitted={(kind) => onVerificationResubmitted(kind)}
                  readOnly={isTerminalBooking(booking)}
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
              addOnDepositCentavos={booking.securityDeposit.addOnDepositCentavos}
              isByoBooking={booking.packages.length === 0}
              hasPackageAddOns={hasPackageAddOns(booking)}
              onProofSubmitted={onDepositProofSubmitted}
              readOnly={isTerminalBooking(booking)}
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
                readOnly={isTerminalBooking(booking)}
              />
            )}

            {/* Post-rental gear condition — a separate concept from Verification above (that's the
                customer's own ID documents; this is the returned EQUIPMENT). Omitted entirely when
                nothing was flagged, which is the common case. */}
            {booking.damageReports && booking.damageReports.length > 0 && (
              <GearInspectionPanel bookingId={booking.bookingId} reports={booking.damageReports} />
            )}

            {/* What happened to the deposit as a result of the issue above — a clean return
                (`returnSettlement` null/undefined, e.g. an older RMS response predating this
                field) never renders this section; see ReturnSettlementPanel's own doc comment. */}
            {booking.returnSettlement && (
              <ReturnSettlementPanel
                settlement={booking.returnSettlement}
                hasAdditionalCharges={Boolean(booking.additionalCharges && booking.additionalCharges.length > 0)}
              />
            )}

            {/* The money side of that inspection, kept as its own section: the panel above says what
                was found, this one says what is owed for it. Omitted entirely when nothing was
                charged, which is the common case. */}
            {booking.additionalCharges && booking.additionalCharges.length > 0 && (
              <AdditionalChargesPanel
                bookingId={booking.bookingId}
                charges={booking.additionalCharges}
                totalCentavos={booking.additionalChargesTotalCentavos ?? 0}
                outstandingCentavos={booking.additionalChargesOutstandingCentavos ?? 0}
                onChargeProofSubmitted={onAdditionalChargeProofSubmitted}
                readOnly={isTerminalBooking(booking)}
              />
            )}
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
            {booking.damageReports && booking.damageReports.length > 0 && (
              <InspectionShortcut bookingId={booking.bookingId} onJumpTo={jumpTo} />
            )}
            <QuickActions booking={booking} onJumpTo={jumpTo} />
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
      className={`flex flex-col gap-0.5 rounded-xl border p-2.5 sm:p-3 ${
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
 * Page-level rollup of every booking that currently needs the customer's attention — never a
 * second source of truth: each row is just this same booking's own getNextStep result (the exact
 * tone/message already shown inline on that booking's own card), surfaced once above the booking
 * list so a customer with several bookings doesn't have to open each card to find out what's
 * actionable (danger and warning tones only — an info/success/neutral next-step is "in progress,"
 * not something the customer needs to do anything about). "View" scrolls to that booking's own
 * card, where the same message and its own CTA (if any) are already rendered — this panel never
 * duplicates the action itself, only where to find it. Renders a quiet all-clear state instead of
 * an empty section when nothing needs action.
 */
function ActionRequiredPanel({
  bookings,
  onJumpToBooking,
}: {
  bookings: RmsMyBooking[];
  onJumpToBooking: (bookingNumber: string) => void;
}) {
  const items = bookings
    .map((booking) => ({ booking, nextStep: getNextStep(booking) }))
    .filter(({ nextStep }) => nextStep.tone === 'danger' || nextStep.tone === 'warning');

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-brand-forest/30 bg-brand-forest/10 px-4 py-3 text-sm font-medium text-accent">
        <CheckCircleIcon className="h-4 w-4 shrink-0" />
        You're all caught up.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border-2 border-red-300 bg-red-50 p-3.5 dark:border-red-500/40 dark:bg-red-500/10 sm:gap-3 sm:p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-red-800 dark:text-red-300">
        <AlertTriangleIcon className="h-4 w-4 shrink-0" />
        Action Required ({items.length})
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map(({ booking, nextStep }) => (
          <li
            key={booking.bookingId}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-lg bg-surface px-3 py-2 shadow-sm sm:gap-y-2 sm:py-2.5"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-faint">#{booking.bookingNumber}</p>
              <p className="text-sm text-ink">{nextStep.message}</p>
            </div>
            <button
              type="button"
              onClick={() => onJumpToBooking(booking.bookingNumber)}
              className="shrink-0 rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-surface-strong"
            >
              View →
            </button>
          </li>
        ))}
      </ul>
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
  // See the shared hasPackageAddOns' own doc comment (above RentalLineItems) for why this checks
  // `gears` as well as `addOns` — the customer website never computes an add-on's own deposit;
  // `securityDeposit.requiredCentavos` is always the RMS's own authoritative figure exactly as
  // returned, whether that's still just the package's own configured deposit or one an admin
  // already increased after reviewing the add-ons. This flag only controls whether the wording
  // clarifies that possibility — it never changes the number itself.
  const bookingHasPackageAddOns = hasPackageAddOns(booking);
  // The add-on portion of `requiredCentavos`, decided by staff after reviewing the specific
  // add-ons — see RmsSecurityDeposit.addOnDepositCentavos' own doc comment. `null`/`undefined`
  // (an older RMS response, or staff simply haven't decided yet) keeps the existing "To Be
  // Determined" row; `0` means staff decided no additional deposit is needed, so the row is
  // omitted entirely rather than showing a pointless "₱0" line; a positive amount is when the
  // full Base/Add-on/Total breakdown below actually applies.
  const addOnDepositCentavos = securityDeposit.addOnDepositCentavos;
  const hasDeterminedAddOnDeposit =
    bookingHasPackageAddOns && typeof addOnDepositCentavos === 'number' && addOnDepositCentavos > 0;
  const addOnDepositStillPending = bookingHasPackageAddOns && (addOnDepositCentavos === null || addOnDepositCentavos === undefined);
  // Never a second, independently-computed figure — the RMS's own `requiredCentavos` is always
  // the authoritative total; this is just that same total minus the add-on portion it already
  // includes, purely so the breakdown below can show what the package's own deposit was before
  // add-ons. Only meaningful (and only rendered) when hasDeterminedAddOnDeposit is true.
  const baseDepositCentavos = hasDeterminedAddOnDeposit
    ? securityDeposit.requiredCentavos - addOnDepositCentavos
    : securityDeposit.requiredCentavos;
  // Shown through this same compact deposit summary regardless of returnSettlement — a clean
  // return can still carry a real refund via these fields alone (see RmsSecurityDeposit's own
  // doc comment), and ReturnSettlementPanel further down this card only ever renders when RMS
  // has an actual settlement object, so this is the one place a clean-return refund is visible.
  // Omitted when both are absent/zero — an older RMS response, or a booking that hasn't reached
  // a return outcome yet, never shows a false "₱0 retained" line.
  const depositRetainedCentavos = securityDeposit.retainedCentavos ?? 0;
  const depositRefundedCentavos = securityDeposit.refundedCentavos ?? 0;
  const hasDepositSettlementInfo = depositRetainedCentavos > 0 || depositRefundedCentavos > 0;
  const hasBalanceDue = rentalFee && rentalFee.outstandingCentavos > 0;
  // Collapsed by default: the full breakdown (amount paid, payment/deposit status text) is
  // secondary once the headline Balance figure and the two summary lines below are visible —
  // showing all of it immediately, inside a card that's already behind its own "Details" toggle,
  // was a second full data dump on top of the first tap. This is a plain local expand, not a
  // second navigation level: everything here was already part of the same open Details panel.
  const [showFullBreakdown, setShowFullBreakdown] = useState(false);

  const paymentStatusLabel = rentalFee ? (RENTAL_FEE_STATUS_LABELS[rentalFee.status] ?? formatStatusLabel(rentalFee.status)) : null;

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-3.5 sm:gap-3 sm:p-4">
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

      {/* Always-visible compact summary — the two figures a customer needs at a glance, without
          the fuller breakdown below. */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-ink-muted">Rental Fee</dt>
        <dd className="text-right font-medium text-ink">
          {rentalFee ? formatCurrency(rentalFee.dueCentavos / 100) : formatCurrency(booking.rentalFeeCentavos / 100)}
        </dd>

        {hasDeterminedAddOnDeposit ? (
          // Base/Add-on/Total breakdown — only once staff have actually set a positive add-on
          // deposit (see hasDeterminedAddOnDeposit above). Base and Add-on are never independent
          // charges; they're the same one refundable security deposit split into its two parts,
          // which is why Total is the figure carried everywhere else on this card (Balance,
          // DepositProofUpload's own headline, etc.) — never Base alone.
          <>
            <dt className="text-ink-muted">Base Security Deposit</dt>
            <dd className="text-right font-medium text-ink">{formatCurrency(baseDepositCentavos / 100)}</dd>

            <dt className="text-ink-muted">Additional Add-on Deposit</dt>
            <dd className="text-right font-medium text-ink">{formatCurrency(addOnDepositCentavos / 100)}</dd>

            <dt className="font-semibold text-ink">
              Total Security Deposit
              {!depositPending && <span className="font-normal text-ink-faint"> (refundable)</span>}
            </dt>
            <dd className="text-right font-semibold text-ink">
              {formatCurrency(securityDeposit.requiredCentavos / 100)}
            </dd>
          </>
        ) : (
          <>
            <dt className="text-ink-muted">
              {bookingHasPackageAddOns ? 'Package Security Deposit' : 'Security Deposit'}
              {!depositPending && <span className="text-ink-faint"> (refundable)</span>}
            </dt>
            <dd className="text-right font-medium text-ink">
              {depositPending ? 'To Be Determined' : formatCurrency(securityDeposit.requiredCentavos / 100)}
            </dd>

            {/* Its own row, not folded into the package deposit above — never a second real figure
                (there's nothing to add up yet: "To Be Determined" is a status, not an amount), just
                making explicit that GearBnB staff may still add to the Package Security Deposit
                shown above once they've reviewed these specific add-ons. Omitted entirely once
                staff decide either way (see hasDeterminedAddOnDeposit's own branch above, and
                addOnDepositStillPending's own comment). See DepositProofUpload's matching notice,
                shown further down this same card, for the fuller explanation. */}
            {addOnDepositStillPending && (
              <>
                <dt className="text-ink-muted">Additional Add-on Deposit</dt>
                <dd className="text-right font-medium text-ink">To Be Determined</dd>
              </>
            )}
          </>
        )}

        {/* Post-return outcome for the deposit itself — see hasDepositSettlementInfo's own
            comment above for why this reads straight off securityDeposit rather than
            returnSettlement. Retained is only shown when positive (a fully-refunded deposit has
            nothing to retain); Refunded is shown whenever present so a ₱0 refund after a total
            loss is still stated plainly rather than silently omitted. */}
        {hasDepositSettlementInfo && (
          <>
            {depositRetainedCentavos > 0 && (
              <>
                <dt className="text-ink-muted">Security Deposit Retained</dt>
                <dd className="text-right font-medium text-ink">{formatCurrency(depositRetainedCentavos / 100)}</dd>
              </>
            )}
            <dt className="text-ink-muted">Security Deposit Refunded</dt>
            <dd className="text-right font-medium text-ink">{formatCurrency(depositRefundedCentavos / 100)}</dd>
          </>
        )}
      </dl>

      {/* The breakdown/"To Be Determined" row above already makes the add-on deposit's status
          explicit; the fuller explanation lives once, in DepositProofUpload's matching notice
          further down this same card's Booking Details, rather than being repeated here too. */}

      <button
        type="button"
        onClick={() => setShowFullBreakdown((prev) => !prev)}
        aria-expanded={showFullBreakdown}
        className="flex items-center gap-1 self-start text-xs font-semibold text-accent underline-offset-2 hover:underline"
      >
        {showFullBreakdown ? 'Hide payment details' : 'Show payment details'}
        <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 transition-transform ${showFullBreakdown ? 'rotate-180' : ''}`} />
      </button>

      {showFullBreakdown && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-line-soft pt-3 text-sm">
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
      )}
    </div>
  );
}

function BookingCardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
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
  // The top-level category tabs (Part 4) — "Current" is the default landing view. `showPast`
  // below is kept as a derived alias (not its own state) so every existing `{showPast && ...}`
  // gate further down in this file (the search/filter/pagination controls, the card list itself)
  // keeps working completely unchanged; only what CONTROLS it moved from a standalone toggle
  // button to this tab bar.
  const [activeTab, setActiveTab] = useState<'current' | 'payment' | 'history'>('current');
  const showPast = activeTab === 'history';
  const [historyPageSize, setHistoryPageSize] = useState(HISTORY_PAGE_SIZE);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>(HISTORY_FILTER_ALL);
  const [historyQuery, setHistoryQuery] = useState('');

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

        const failure = classifyMyBookingsLoadError(err);
        if (failure === 'not_configured') {
          // VITE_RMS_API_URL is missing — never a genuine RMS 500.
          setState({ kind: 'not_configured' });
          return;
        }
        if (failure === 'session_expired') {
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

  // Same optimistic pattern as handleProofSubmitted/handleRentalFeeProofSubmitted, but scoped to
  // one specific charge (by id) within the booking's additionalCharges array — a booking can have
  // more than one outstanding charge, each with its own independent proof, so only the charge the
  // customer just submitted a proof for flips to PENDING_REVIEW; every other charge on this same
  // booking is left completely untouched.
  function handleAdditionalChargeProofSubmitted(bookingId: string, chargeId: string) {
    setState((prev) => {
      if (prev.kind !== 'ready') return prev;
      return {
        kind: 'ready',
        bookings: prev.bookings.map((booking) =>
          booking.bookingId === bookingId && booking.additionalCharges
            ? {
                ...booking,
                additionalCharges: booking.additionalCharges.map((charge) =>
                  charge.id === chargeId
                    ? {
                        ...charge,
                        // Optimistic only — the real amount/method/reviewNote come back on the next
                        // actual refetch. uploadedAt is a placeholder ("now"); nothing here reads it
                        // while status is PENDING_REVIEW (only `rejected`'s reviewNote is displayed).
                        paymentProof: {
                          status: 'PENDING_REVIEW',
                          method: charge.paymentProof?.method ?? 'OTHER',
                          amountClaimedCentavos: charge.paymentProof?.amountClaimedCentavos ?? null,
                          uploadedAt: new Date().toISOString(),
                          reviewNote: null,
                        },
                        canSubmitPaymentProof: false,
                      }
                    : charge,
                ),
              }
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
    if (!isPast) return;
    setActiveTab('history');
    // Any active filter/search is cleared too, or the card the email CTA is pointing at could be
    // filtered straight back out of the list it was just expanded to reveal.
    setHistoryStatusFilter(HISTORY_FILTER_ALL);
    setHistoryQuery('');
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
  // The "Payment" tab's own filtered view — see hasOutstandingPayment's own doc comment. Computed
  // over every booking (not just activeBookings): a customer must never lose sight of a genuinely
  // outstanding balance just because the booking itself happens to already be in a past status.
  const paymentBookings = bookings.filter(hasOutstandingPayment);
  // Only the statuses this customer actually has among their past bookings become chips, derived
  // from PAST_STATUSES itself (the single source of truth for what counts as history) rather than
  // a second hardcoded list that could drift from it.
  const historyStatusOptions = [...PAST_STATUSES].filter((status) =>
    pastBookings.some((booking) => booking.status === status),
  );
  const filteredPastBookings = pastBookings.filter(
    (booking) =>
      (historyStatusFilter === HISTORY_FILTER_ALL || booking.status === historyStatusFilter) &&
      matchesHistoryQuery(booking, historyQuery),
  );
  const visiblePastBookings = filteredPastBookings.slice(0, historyPageSize);
  const showHistoryControls = historyStatusOptions.length > 1 || pastBookings.length >= HISTORY_SEARCH_MIN;

  // Both reset paging: after narrowing the list, a "Show more" the customer expanded for a
  // different filter would otherwise silently carry over and reveal more rows than this one has.
  function handleHistoryFilterChange(next: string) {
    setHistoryStatusFilter(next);
    setHistoryPageSize(HISTORY_PAGE_SIZE);
  }

  function handleHistoryQueryChange(next: string) {
    setHistoryQuery(next);
    setHistoryPageSize(HISTORY_PAGE_SIZE);
  }

  function clearHistoryFilters() {
    handleHistoryFilterChange(HISTORY_FILTER_ALL);
    setHistoryQuery('');
  }

  // Scrolls to a booking's card from the page-level Action Required panel. Expands the Booking
  // History section first when the target booking lives there — it's collapsed by default (see
  // showPast's initial state) — so the card actually exists on the page before scrolling to it.
  // The card's own detailsOpen state is a separate concern handled entirely inside BookingCard
  // (see its jumpTo): this only needs to get the CARD itself on screen, since the next-step
  // message and its own CTA are already visible on a card regardless of whether it's expanded.
  function handleJumpToBooking(bookingNumber: string) {
    const isPast = pastBookings.some((booking) => booking.bookingNumber === bookingNumber);
    // The Action Required panel stays visible regardless of which tab is active (see its own
    // render call below), so its "View" target might currently be on a hidden tab — every
    // non-past booking always renders under "Current" (Payment is an additional filtered view
    // layered on top of it, never the only place a booking appears), so that split alone is
    // enough to always land on the right tab. Same reasoning as the highlighted-booking effect
    // above for clearing any active History filter/search that could keep the target out of view.
    setActiveTab(isPast ? 'history' : 'current');
    if (isPast) {
      clearHistoryFilters();
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(`booking-${bookingNumber}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  return (
    // max-w-6xl (72rem/1152px) — enough room for the sidebar + booking-list layout below to feel
    // comfortable at 1280/1440/1920 desktop widths without stretching either column into an
    // unreadably long line length; the old max-w-2xl (42rem/672px) was the "too narrow for desktop"
    // the client originally flagged, and a single centered column that wide would have looked just
    // as awkward as too-narrow once a real two-column layout was in play.
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 pb-36 pt-6 sm:gap-6 sm:px-6 sm:pb-10 sm:pt-10">
      <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
        <div className="flex flex-col gap-1 sm:gap-1.5">
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
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-muted shadow-sm transition-colors hover:bg-surface-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-60 sm:px-3 sm:py-1.5"
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

      {state.kind === 'ready' && bookings.length > 0 && (
        <ActionRequiredPanel bookings={bookings} onJumpToBooking={handleJumpToBooking} />
      )}

      {/* Category tabs (Part 4) — a filtered VIEW over the one already-fetched booking list, never
          a second fetch or a second data source. "Current" covers every active booking regardless
          of payment state; "Payment" is a narrower, overlapping view for exactly the bookings that
          currently need money from the customer; "History" is the existing past-bookings section,
          now switched to by this tab instead of its own separate collapse button. flex-wrap (not
          horizontal scroll) — three short labels fit comfortably even at 320px, and a customer is
          less likely to miss a wrapped second pill than an undiscovered horizontal swipe. */}
      {state.kind === 'ready' && bookings.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Booking categories">
          <FilterPill selected={activeTab === 'current'} onClick={() => setActiveTab('current')}>
            Current ({activeBookings.length})
          </FilterPill>
          <FilterPill selected={activeTab === 'payment'} onClick={() => setActiveTab('payment')}>
            Payment{paymentBookings.length > 0 ? ` (${paymentBookings.length})` : ''}
          </FilterPill>
          <FilterPill selected={activeTab === 'history'} onClick={() => setActiveTab('history')}>
            History ({pastBookings.length})
          </FilterPill>
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
          {/* Each tab renders its own self-contained content below — never more than one at a
              time, so a customer scanning the page only ever sees the category they actually
              chose. */}
          {activeTab === 'current' && (
            <>
              {/* Three clearly separated groups — what's happening now, what's booked next, and
                  what's finished — so a customer never has to read a status badge to work out
                  which of their bookings is the live one. A group with nothing in it is omitted
                  rather than shown as an empty heading; the single "no active bookings" line
                  covers the case where both of the live groups are empty. */}
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
                      onAdditionalChargeProofSubmitted={(chargeId) =>
                        handleAdditionalChargeProofSubmitted(booking.bookingId, chargeId)
                      }
                      onVerificationResubmitted={(kind) => handleVerificationResubmitted(booking.bookingId, kind)}
                      highlighted={booking.bookingNumber === highlightedBookingNumber}
                      defaultOpen
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
                      onAdditionalChargeProofSubmitted={(chargeId) =>
                        handleAdditionalChargeProofSubmitted(booking.bookingId, chargeId)
                      }
                      onVerificationResubmitted={(kind) => handleVerificationResubmitted(booking.bookingId, kind)}
                      highlighted={booking.bookingNumber === highlightedBookingNumber}
                      defaultOpen
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* "Payment" tab — a filtered view over the same bookings, never a second payment
              system or a recomputed figure; every amount shown lives on the card itself, sourced
              straight from the RMS's own securityDeposit/rentalFee fields exactly as everywhere
              else on this page. */}
          {activeTab === 'payment' && (
            <>
              {paymentBookings.length === 0 ? (
                <p className="rounded-xl border border-line bg-surface-muted p-6 text-center text-sm text-ink-muted">
                  Nothing pending — you're all paid up.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {paymentBookings.map((booking) => (
                    <BookingCard
                      key={booking.bookingId}
                      booking={booking}
                      onDepositProofSubmitted={() => handleProofSubmitted(booking.bookingId)}
                      onRentalFeeProofSubmitted={() => handleRentalFeeProofSubmitted(booking.bookingId)}
                      onAdditionalChargeProofSubmitted={(chargeId) =>
                        handleAdditionalChargeProofSubmitted(booking.bookingId, chargeId)
                      }
                      onVerificationResubmitted={(kind) => handleVerificationResubmitted(booking.bookingId, kind)}
                      highlighted={booking.bookingNumber === highlightedBookingNumber}
                      defaultOpen
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'history' && pastBookings.length === 0 && (
            <p className="rounded-xl border border-line bg-surface-muted p-6 text-center text-sm text-ink-muted">
              No booking history yet. Your completed or past rentals will appear here.
            </p>
          )}

          {activeTab === 'history' && pastBookings.length > 0 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                  Booking History ({pastBookings.length})
                </h2>

                {/* Narrowing controls appear only once there's genuinely something to narrow — a
                    customer with two finished bookings gets the plain list, not a filter bar. */}
                {showPast && showHistoryControls && (
                  <div className="flex flex-col gap-2.5">
                    {historyStatusOptions.length > 1 && (
                      // Scrolls horizontally instead of wrapping, so on a narrow phone the row stays
                      // one line rather than growing into a block that pushes the cards down.
                      <div
                        role="group"
                        aria-label="Filter booking history by status"
                        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5"
                      >
                        {[HISTORY_FILTER_ALL, ...historyStatusOptions].map((option) => {
                          const active = historyStatusFilter === option;
                          const count =
                            option === HISTORY_FILTER_ALL
                              ? pastBookings.length
                              : pastBookings.filter((booking) => booking.status === option).length;
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => handleHistoryFilterChange(option)}
                              aria-pressed={active}
                              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                                active
                                  ? 'bg-brand-forest text-white'
                                  : 'bg-surface-strong text-ink-muted hover:bg-line hover:text-ink'
                              }`}
                            >
                              {option === HISTORY_FILTER_ALL
                                ? 'All'
                                : (BOOKING_STATUS_LABELS[option] ?? formatStatusLabel(option))}{' '}
                              ({count})
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {pastBookings.length >= HISTORY_SEARCH_MIN && (
                      <label className="block">
                        <span className="sr-only">Search booking history</span>
                        <input
                          type="search"
                          value={historyQuery}
                          onChange={(e) => handleHistoryQueryChange(e.target.value)}
                          placeholder="Search booking history"
                          className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink shadow-sm outline-none transition-colors [&::-webkit-search-cancel-button]:appearance-none focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20 sm:max-w-xs"
                        />
                      </label>
                    )}
                  </div>
                )}

                {showPast && filteredPastBookings.length === 0 && (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-line bg-surface-muted p-6 text-center">
                    <p className="text-sm text-ink-muted">No past bookings match your search or filter.</p>
                    <button
                      type="button"
                      onClick={clearHistoryFilters}
                      className="text-sm font-semibold text-accent underline underline-offset-2"
                    >
                      Clear filters
                    </button>
                  </div>
                )}

                {showPast &&
                  visiblePastBookings.map((booking) => (
                    <BookingCard
                      key={booking.bookingId}
                      booking={booking}
                      onDepositProofSubmitted={() => handleProofSubmitted(booking.bookingId)}
                      onRentalFeeProofSubmitted={() => handleRentalFeeProofSubmitted(booking.bookingId)}
                      onAdditionalChargeProofSubmitted={(chargeId) =>
                        handleAdditionalChargeProofSubmitted(booking.bookingId, chargeId)
                      }
                      onVerificationResubmitted={(kind) => handleVerificationResubmitted(booking.bookingId, kind)}
                      highlighted={booking.bookingNumber === highlightedBookingNumber}
                      defaultOpen={booking.bookingNumber === highlightedBookingNumber}
                    />
                  ))}

                {showPast && visiblePastBookings.length < filteredPastBookings.length && (
                  <button
                    type="button"
                    onClick={() => setHistoryPageSize((size) => size + HISTORY_PAGE_SIZE)}
                    className="self-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-surface-strong"
                  >
                    Show more ({filteredPastBookings.length - visiblePastBookings.length} remaining)
                  </button>
                )}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
