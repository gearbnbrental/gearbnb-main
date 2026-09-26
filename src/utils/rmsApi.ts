import { supabase } from '../supabase';
import type { VerificationDocumentKey } from '../types/gearbnb';

/**
 * In `vite dev` (import.meta.env.DEV), always talk to a local/LAN RMS dev server — never the
 * production RMS configured in .env for the real deployed build. Without this, every RMS
 * integration (BYO catalog, bookings, verification, payment proofs, My Bookings, Plan an Event)
 * silently calls production while developing locally: the request either gets redirected by the
 * production proxy's login gate or blocked by its CORS allowlist (which deliberately excludes
 * localhost origins whenever NODE_ENV === "production" — see CUSTOMER_PORTAL_DEV_ORIGIN in the
 * RMS's src/proxy.ts), surfacing as "We couldn't load the Build Your Own catalog right now" with
 * no indication the request never reached a local server at all.
 *
 * Defaults to `http://localhost:3000` — the RMS dev server's default port (`next dev`,
 * unconfigured) — for the common case of both apps running on the same machine, mirroring the
 * RMS's own CUSTOMER_PORTAL_DEV_ORIGIN convention. `VITE_RMS_DEV_API_URL` overrides this for a
 * dev RMS reachable elsewhere on the LAN (a different machine, e.g. `http://192.168.x.x:3000`) —
 * deliberately a SEPARATE variable from `VITE_RMS_API_URL` (the production URL below), never
 * reused for this: `VITE_RMS_API_URL` must stay exactly what a production build expects
 * regardless of what a developer's own machine happens to be pointed at locally.
 */
const RMS_API_URL = import.meta.env.DEV
  ? ((import.meta.env.VITE_RMS_DEV_API_URL as string | undefined) ?? 'http://localhost:3000')
  : (import.meta.env.VITE_RMS_API_URL as string | undefined);

/** Matches the RMS's VerificationDocumentKind enum (prisma/schema.prisma) exactly. */
export type RmsVerificationDocumentKind = 'GOV_ID_1' | 'GOV_ID_2' | 'VERIFICATION_VIDEO' | 'PROOF_OF_BILLING';

/** Maps this site's verification slot keys to the RMS's VerificationDocumentKind enum values —
 * the two were named independently and don't share casing/wording. Single source of truth so the
 * storage-upload path and the final submission payload can never disagree with each other. */
export const VERIFICATION_KIND_MAP: Record<VerificationDocumentKey, RmsVerificationDocumentKind> = {
  idType1: 'GOV_ID_1',
  idType2: 'GOV_ID_2',
  verificationVideo: 'VERIFICATION_VIDEO',
  proofOfBilling: 'PROOF_OF_BILLING',
};

/** The private Supabase Storage bucket for identity-verification documents — see
 * docs/verification-storage-setup.sql (in the RMS repo) for its bucket/RLS setup. Never the
 * "inventory-photos" bucket the RMS's own staff tools use — that one is public. */
export const VERIFICATION_BUCKET = 'verification-documents';

/** The private Supabase Storage bucket for security-deposit payment proofs (receipts/screenshots).
 * Separate from VERIFICATION_BUCKET — different RLS setup, different retention/review workflow. */
export const PAYMENT_PROOF_BUCKET = 'payment-proofs';

/** Thrown by checkAvailability specifically when ITS OWN internal bounded timeout fired — never
 *  when the caller's own signal aborted (that's a deliberate, silent supersede, not a failure).
 *  A distinct class rather than reusing the generic AbortError DOMException so a caller can tell
 *  "this request never got an answer in time" (a real, recoverable failure worth surfacing) apart
 *  from "this request was intentionally cancelled because something newer superseded it" (never
 *  surfaced as an error) — both produce an AbortError-shaped rejection from fetch() itself, and
 *  without this they'd be indistinguishable. */
export class RmsAvailabilityTimeoutError extends Error {
  constructor() {
    super('The availability check took too long to respond.');
  }
}

/** `RmsApiError.code` set only by rmsFetch's own client-side "VITE_RMS_API_URL is missing" check —
 *  distinguishes that from a genuine HTTP 500 returned by the RMS, which never carries this code. */
export const RMS_NOT_CONFIGURED_CODE = 'RMS_NOT_CONFIGURED';

export class RmsApiError extends Error {
  status: number;
  fields?: Record<string, string[]>;
  /** Parsed from the RMS's own `Retry-After` response header (seconds, converted to ms) when
   *  present on a 429 — lets a caller back off for exactly as long as the RMS actually asked for,
   *  rather than guessing. `undefined` whenever the header is absent or unparsable; callers must
   *  fall back to their own bounded default in that case, never retry immediately. */
  retryAfterMs?: number;
  /** The RMS's own stable machine-readable `code`, present only on the few errors that define one
   *  (e.g. "DUPLICATE_BOOKING_REQUEST" on POST /api/customer/bookings) — never on the plain
   *  inventory-conflict 409. */
  code?: string;
  /** Present alongside DUPLICATE_BOOKING_REQUEST: the customer's OWN existing booking's number. */
  bookingNumber?: string;

  constructor(
    message: string,
    status: number,
    fields?: Record<string, string[]>,
    retryAfterMs?: number,
    extra?: { code?: string; bookingNumber?: string },
  ) {
    super(message);
    this.status = status;
    this.fields = fields;
    this.retryAfterMs = retryAfterMs;
    this.code = extra?.code;
    this.bookingNumber = extra?.bookingNumber;
  }
}

export type BookingSubmitFailure =
  | { kind: 'duplicate'; bookingNumber?: string }
  | { kind: 'inventory_conflict' }
  | { kind: 'other'; message: string };

/**
 * Classifies a failed POST /api/customer/bookings. The RMS uses HTTP 409 for three different
 * things (confirmed in server/bookings/service.ts): inventory no longer available (no `code`; body
 * "The following items are no longer available…"), DUPLICATE_BOOKING_REQUEST (has `code` +
 * `bookingNumber`), and a customer-identity conflict. Only the first means "adjust your
 * selection"; the others must never be reported as an availability problem. Retry-After is only
 * ever sent by the RMS on 429 (rate limit) — no 409 defines a retry interval, so none is applied.
 */
export function classifyBookingSubmitError(err: unknown): BookingSubmitFailure {
  if (err instanceof RmsApiError && err.status === 409) {
    if (err.code === 'DUPLICATE_BOOKING_REQUEST') return { kind: 'duplicate', bookingNumber: err.bookingNumber };
    if (!err.code && /no longer available/i.test(err.message)) return { kind: 'inventory_conflict' };
  }
  return { kind: 'other', message: describeRmsError(err) };
}

/**
 * The RMS's own zod validation returns a generic top-level `"Validation failed"` message plus a
 * `fields` map of the actual, customer-safe rule that failed (e.g. "Destination is required.") —
 * see customerPortalBookingSchema in the RMS. Showing only `err.message` for a 400 discards that
 * detail and always displays the same unhelpful string regardless of which rule actually failed.
 * These field messages are all plain, pre-written validation copy (never a stack trace, a Prisma
 * error, or any server-internal detail), so they're safe to surface directly to the customer.
 */
export function describeRmsError(err: unknown): string {
  if (err instanceof RmsApiError) {
    const detail = err.fields ? Object.values(err.fields).flat().join(' ') : '';
    return detail || err.message;
  }
  return 'The request could not be completed. Please try again.';
}

/** Refresh a session no later than this many milliseconds before its access token actually
 * expires — small enough to rarely trigger early, large enough to absorb a round-trip so the
 * token is never checked as valid client-side and then rejected as expired server-side. */
const TOKEN_REFRESH_MARGIN_MS = 15_000;

/**
 * Ensures the shared Supabase client's current session has an access token that isn't about to
 * expire, force-refreshing it first if needed. Explicitly checks expiry rather than trusting
 * supabase-js's background auto-refresh timer alone: that timer is throttled/paused by most
 * browsers while this tab is backgrounded, so a customer who spends a while filling out checkout
 * (uploading four verification documents, reviewing the payment breakdown, etc.) can come back to
 * a session that's technically still "logged in" client-side but carries an access token that
 * already expired.
 *
 * Exported so any direct `supabase.storage.from(...).upload(...)` call (VerificationUpload,
 * VerificationDocumentsReview, DepositProofUpload) can call this first — the Storage SDK reads
 * its Authorization header from this same shared client's current session, not from anything
 * `rmsFetch` controls, so refreshing only inside `getAccessToken` below would leave every direct
 * Storage upload just as exposed to a silent "Upload failed" from a stale token.
 */
export async function ensureFreshSession() {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  if (expiresAtMs - Date.now() > TOKEN_REFRESH_MARGIN_MS) {
    return session;
  }

  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (error || !refreshed.session) return null;
  return refreshed.session;
}

/**
 * The customer's current Supabase access token, sent as a bearer token to the RMS customer API.
 * The RMS verifies this directly against Supabase (see the RMS's src/lib/customerAuth.ts) — this
 * is the ownership mechanism, replacing the old placeholder RPC's untrusted email field. Returns
 * null when logged out; callers must treat that as "cannot proceed," never fall back to an
 * unauthenticated request. Sending a stale token would otherwise get a 401
 * `{"error":"Not authenticated"}` straight back from the RMS — indistinguishable from actually
 * being logged out.
 */
async function getAccessToken(): Promise<string | null> {
  const session = await ensureFreshSession();
  return session?.access_token ?? null;
}

interface RmsFetchOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  idempotencyKey?: string;
  /** False for the handful of RMS customer endpoints that are deliberately public (e.g. the BYO
   * gear catalog, browsable before login just like the package catalog already is). Defaults to
   * true — every other customer endpoint requires the Bearer token. */
  requireAuth?: boolean;
  /** Lets a caller genuinely cancel this specific request (e.g. its inputs went stale before the
   *  RMS answered) — forwarded straight to `fetch()`, which throws a `DOMException` named
   *  "AbortError" rather than resolving. Only ever wired up for requests a caller can actually
   *  supersede (see checkAvailability); most callers have no reason to pass this. */
  signal?: AbortSignal;
}

/**
 * Calls the authenticated RMS customer API (never the HMAC-signed /api/webhooks/bookings — that
 * endpoint authenticates a trusted server, not an end user, and its secret must never reach the
 * browser). Throws RmsApiError on any non-2xx response, with the RMS's own error message intact.
 */
async function rmsFetch<T>(path: string, options: RmsFetchOptions = {}): Promise<T> {
  if (!RMS_API_URL) {
    throw new RmsApiError('The booking system is not configured yet, please try again later.', 500, undefined, undefined, {
      code: RMS_NOT_CONFIGURED_CODE,
    });
  }

  const requireAuth = options.requireAuth ?? true;
  const token = await getAccessToken();
  if (requireAuth && !token) {
    throw new RmsApiError('You must be logged in to do this.', 401);
  }

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.idempotencyKey) headers['X-Idempotency-Key'] = options.idempotencyKey;

  const response = await fetch(`${RMS_API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // A non-JSON error body (e.g. a proxy's HTML error page) — fall through with data null.
  }

  if (!response.ok) {
    const body = (data ?? {}) as { error?: string; fields?: Record<string, string[]>; code?: string; bookingNumber?: string };
    // Only meaningful on a 429 (see RMS's own checkRateLimit) — a plain integer number of seconds
    // per the standard Retry-After header, never trusted beyond that single well-formed shape.
    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfterSeconds = retryAfterHeader !== null ? Number(retryAfterHeader) : NaN;
    const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0 ? retryAfterSeconds * 1000 : undefined;
    throw new RmsApiError(body.error ?? 'The request could not be completed.', response.status, body.fields, retryAfterMs, {
      code: typeof body.code === 'string' ? body.code : undefined,
      bookingNumber: typeof body.bookingNumber === 'string' ? body.bookingNumber : undefined,
    });
  }

  return data as T;
}

const RETRY_DELAYS_MS = [500, 1200];

/**
 * A transient failure is either: the request never reached the server at all (fetch() itself
 * rejected — DNS/connection failure, the RMS process briefly unreachable), or the RMS responded
 * but with a 5xx (its own transient server error). Anything else — 401/403 (auth/authorization,
 * retrying changes nothing), 400/422 (validation, retrying sends the same invalid request again),
 * 404 (a genuinely missing endpoint, not something a retry fixes) — is a real, final answer and
 * must never be retried.
 */
function isTransientRmsFailure(err: unknown): boolean {
  if (err instanceof RmsApiError) return err.status >= 500;
  return true; // fetch() itself threw — no HTTP response was ever received
}

/**
 * Bounded retry (max 2 retries, 3 attempts total) for read-only RMS calls only — see each caller's
 * own comment for why. Never used for a mutation: a booking submission, a payment-proof upload, or
 * any other POST that changes RMS state must fail once and let the customer decide whether to
 * resubmit, never be silently replayed by this utility (that's exactly how a duplicate booking or
 * a duplicate payment-proof record would happen). Small fixed delays between attempts, not
 * exponential backoff with jitter — this is recovering from a several-hundred-millisecond blip
 * (a brief redeploy, a cold start), not doing distributed-systems-grade backoff.
 */
async function withReadRetry<T>(attempt: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
    try {
      return await attempt();
    } catch (err) {
      lastErr = err;
      if (!isTransientRmsFailure(err) || i === RETRY_DELAYS_MS.length) throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[i]));
    }
  }
  throw lastErr;
}

/** One Build Your Own gear or add-on line in a booking submission. The RMS identifies inventory
 * by this category+brand+model triple, never by a client-side id (see BookableGearKind). */
export interface RmsBookingGearLine {
  category: string;
  brand: string;
  model: string | null;
  quantity: number;
  /** Optional color pin for a Build Your Own gear line ("Black", "Khaki"). Omitted = any color. */
  color?: string;
}

/**
 * The RMS's own gear catalog blanks a "Generic" inventory brand to an empty string for customer
 * display (see cleanBrand() in the RMS's src/server/catalog/service.ts — "never meant to reach a
 * customer"). Its booking/availability schema, however, requires a non-empty brand, and its
 * inventory lookup is keyed on the real underlying value, which is always the literal "Generic"
 * whenever the display value was blanked. Restoring it here — for any RMS-bound request, never for
 * display — is what makes a `RmsBookingGearLine.brand` conform to the existing RMS contract;
 * sending the blanked "" fails validation with "String must contain at least 1 character(s)".
 * Shared by every place that builds an `RmsBookingGearLine` (availability checks in
 * PathACatalog.tsx/PathBCatalog.tsx, and the final booking submission in PaymentBreakdown.tsx) so
 * this conversion can never drift out of sync between them again.
 */
export function toRmsBrand(brand: string): string {
  return brand.trim() === '' ? 'Generic' : brand;
}

export interface RmsBookingSubmission {
  contact: { fullName: string; phone: string };
  booking: {
    /** Package path — mutually exclusive with bookingGears (the RMS route takes packageCode
     * over bookingGears if both were somehow present, silently ignoring bookingGears; the
     * customer website must only ever send one or the other, never both). */
    packageCode?: string;
    /** Build Your Own path — omit/leave empty for a package booking. */
    bookingGears?: RmsBookingGearLine[];
    addOns?: RmsBookingGearLine[];
    destination: string;
    pickupAt: string;
    returnAt: string;
    fulfillmentType: 'PICKUP' | 'DELIVERY';
    deliveryAddress?: string;
    customerNotes?: string;
    /**
     * RMS "required-when-sent" enforcement: send `true` only when the customer actually checked
     * the Terms & Conditions checkbox (which the submission gate — isVerificationComplete — has
     * already required by the time this is built); omit entirely otherwise. Never send `false` —
     * the RMS rejects an explicit false outright. The RMS itself generates and records the
     * authoritative termsAcceptedAt/termsVersion; this site never invents or sends either.
     */
    termsAccepted?: true;
    /**
     * Same "required-when-sent" contract as termsAccepted, but only ever included for a Build
     * Your Own booking — a package booking must omit this field entirely, never send it false.
     */
    byoAgreementAccepted?: true;
    estimatedRentalFeeCentavos: number;
    estimatedDepositCentavos: number;
  };
  verificationDocuments: { kind: string; storagePath: string }[];
}

/**
 * Confirmed against the actual RMS route (src/app/api/customer/bookings/route.ts,
 * createBookingFromCustomerPortal in src/server/bookings/service.ts): this is the complete
 * response. There is deliberately NO booking id field here — only bookingNumber. The booking's
 * internal id (needed for POST /deposit-proof) is only ever exposed via GET /api/customer/bookings
 * (see RmsMyBooking.bookingId below). Do not add a bookingId field here without re-confirming
 * against the live RMS response — a prior version of this type assumed one existed and it did not.
 */
export interface RmsBookingResult {
  bookingNumber: string;
  status: string;
  rentalFeeCentavos: number;
  depositCentavos: number;
}

export function submitBookingToRms(payload: RmsBookingSubmission, idempotencyKey: string) {
  return rmsFetch<RmsBookingResult>('/api/customer/bookings', { method: 'POST', body: payload, idempotencyKey });
}

/** Status of a customer's submitted security-deposit payment proof, as reviewed by RMS staff. */
export type DepositProofStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | null;

export interface RmsSecurityDeposit {
  /** Authoritative required amount, computed by RMS from the booking's Package record. */
  requiredCentavos: number;
  /** Amount confirmed once RMS approves the proof and posts the SECURITY_DEPOSIT payment. */
  verifiedCentavos: number;
  verified: boolean;
  proofStatus: DepositProofStatus;
  reviewNote: string | null;
  /** What the customer's most recent proof claimed, in centavos — lets the UI show a plain
   * Required/Submitted/Shortfall breakdown when a proof was rejected for being short, without
   * relying on the reviewer's free-text note alone. Null only when no proof has ever been
   * submitted. Never treat this as verified/paid — it's the customer's own unreviewed claim. */
  amountClaimedCentavos: number | null;
  /** The portion of `requiredCentavos` attributable to add-ons attached on top of a package,
   * decided by GearBnB staff after reviewing the specific add-ons selected — never computed on
   * this site. `requiredCentavos` already includes this amount once staff set it; this field
   * exists only so the UI can show the add-on portion as its own line within the one refundable
   * security deposit, never as a separate charge. `null` means staff haven't decided yet (still
   * "To Be Determined"); `0` means staff decided no additional deposit is needed. Optional
   * defensively — an older RMS response (or a booking predating this field) won't have it, and
   * the UI must fall back to the existing single-figure display, never crash. */
  addOnDepositCentavos?: number | null;
  /** Amount of the collected deposit kept to cover a return-inspection issue (damage/loss) —
   * always the RMS's own already-settled figure, set once a return settlement has actually run
   * (see `RmsMyBooking.returnSettlement`). Optional defensively — an older RMS response, or a
   * booking that hasn't gone through return settlement yet, won't have it; the UI must treat a
   * missing value the same as "nothing retained," never a fabricated ₱0 settlement. */
  retainedCentavos?: number;
  /** Amount of the collected deposit actually returned to the customer, from the same return
   * settlement as `retainedCentavos` above — same optionality/defensiveness reasoning. */
  refundedCentavos?: number;
}

/**
 * The outcome of a post-rental gear-inspection settlement, once RMS has actually run one —
 * `null` for a clean return with no issue (see RmsMyBooking.returnSettlement's own comment) and
 * absent entirely on an older RMS response that predates this workflow. Every figure here is the
 * RMS's own final, authoritative settlement math (issue amount → how much of the deposit covered
 * it → any excess still owed → what's left to refund) — this site never recomputes, reconstructs,
 * or cross-checks these numbers from DamageReport/AdditionalCharge/Payment records itself.
 */
export interface RmsReturnSettlement {
  /** The raw damage/loss value the return inspection found — before any deposit is applied. */
  issueAmountCentavos: number;
  /** How much of the collected security deposit RMS applied toward the issue above. */
  depositAppliedCentavos: number;
  /** What's left of the issue once the deposit applied above didn't fully cover it — 0 when the
   * deposit alone was enough. This is the one genuinely new amount the customer may still owe for
   * the return issue; it is never the same obligation as `issueAmountCentavos` restated. */
  excessChargeCentavos: number;
  /** How much of the collected deposit RMS is returning to the customer. */
  refundCentavos: number;
  /** RMS's own final "what remains payable for this return issue" figure — never derived here
   * from excessChargeCentavos or any other field; displayed exactly as returned. */
  balanceDueCentavos: number;
}

/** Matches the RMS's DerivedPaymentStatus exactly (src/domain/paymentStatus.ts) — this is the
 * same status the RMS staff-facing booking detail derives from the payment ledger, not a value
 * computed here. */
export type RentalFeeStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED' | 'VOID';

/** Separate from the security deposit — the rental fee is due on/before the booking's pickup
 * date and is never required at booking submission. All amounts are authoritative, computed by
 * the RMS from the booking's ledger (rentalFeeCentavos + add-ons − discount, and actual payments);
 * never recompute these on this site. `dueDate` is the booking's own pickupAt — the RMS has no
 * separate due-date column, since the rental date already is the due date. */
export interface RmsRentalFee {
  dueCentavos: number;
  paidCentavos: number;
  outstandingCentavos: number;
  status: RentalFeeStatus;
  dueDate: string;
  /** Same DepositProofStatus shape as RmsSecurityDeposit.proofStatus — a separate, independent
   * cashless-payment proof workflow for the rental fee (never merged with the deposit's). Optional
   * defensively, same reasoning as `rentalFee` itself on RmsMyBooking: an older RMS response won't
   * have it. */
  proofStatus?: DepositProofStatus;
  reviewNote?: string | null;
  amountClaimedCentavos?: number | null;
}

/** Matches the RMS's VerificationDocumentStatus enum exactly (prisma/schema.prisma). */
export type VerificationDocumentReviewStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUIRED';

/** One of the four required verification documents, as reviewed by RMS staff. Never carries the
 * storagePath or a signed file URL — the customer already has their own copy of what they
 * uploaded, and this response is read-only status, not a way to re-download it. */
export interface RmsVerificationDocument {
  kind: RmsVerificationDocumentKind;
  status: VerificationDocumentReviewStatus;
  /** Staff's explanation, set when status is REJECTED or CORRECTION_REQUIRED. */
  reviewNote: string | null;
  uploadedAt: string;
  reviewedAt: string | null;
}

/** One post-rental gear-inspection finding (damage or total loss), as returned by the RMS's
 *  customer-facing bookings endpoint. Customer-facing fields only — no internal item id, no
 *  inventory number, no maintenance-record reference. `severity` mirrors the RMS's own
 *  DamageReport.severity values exactly; `TOTAL_LOSS` is the "missing/lost" case, everything else
 *  is a damage report. */
export interface RmsDamageReport {
  damageNumber: string;
  itemName: string;
  severity: 'MINOR' | 'MODERATE' | 'SEVERE' | 'TOTAL_LOSS';
  description: string;
  /** 0 when no charge has been recorded for this item (the common case — the current RMS
   *  inspection flow doesn't set this yet). Only ever the RMS's own existing figure; never
   *  computed or invented on this site, and never shown as a charge unless positive. */
  chargeCentavos: number;
  createdAt: string;
}

/** One finalised additional charge raised after the post-rental gear inspection — damage, a lost
 *  item, a late return, an extension, or another approved charge. Customer-facing fields only: the
 *  RMS deliberately withholds the internal charge id, the item's inventory number, the staff member
 *  who raised it, and any reversal note. Charges raised in error (reversed) or forgiven (waived)
 *  are never sent. */
export interface RmsAdditionalCharge {
  /** The charge's own id — used only to identify which charge a payment proof is submitted
   * against (see AdditionalChargeProofSubmission.additionalChargeId below); never displayed to
   * the customer or used to construct a storage path. Distinct from `chargeNumber` below, which
   * remains the customer-facing reference shown on screen. */
  id: string;
  chargeNumber: string;
  type: 'DAMAGE' | 'LOSS' | 'LATE_FEE' | 'EXTENSION' | 'OTHER';
  /** Null for a charge against the whole rental rather than one item. */
  itemName: string | null;
  quantity: number;
  extraDays: number | null;
  reason: string;
  amountCentavos: number;
  /** WAIVED (staff forgave the charge) and REVERSED (staff reversed it, e.g. raised in error) are
   * both terminal, non-payable states — same as PAID, no payment action is ever shown for either. */
  status: 'PENDING' | 'PAID' | 'WAIVED' | 'REVERSED';
  createdAt: string;
  /**
   * The charge's own, independent cashless-payment proof workflow — a third one, never merged with
   * the deposit's or rental fee's own (see RmsSecurityDeposit.proofStatus/RmsRentalFee.proofStatus).
   * Confirmed against the actual RMS response shape (myBookingsForCustomer in
   * src/server/customers/service.ts): unlike the deposit's and rental fee's own proof fields, this
   * one is NOT flattened onto RmsAdditionalCharge directly — it's its own nested object, `null` when
   * no proof has ever been submitted for this specific charge, `undefined` only for an older RMS
   * response predating this field entirely. Either way, the UI must fall back to the plain
   * PENDING/PAID/WAIVED/REVERSED status display, never crash.
   */
  paymentProof?: {
    status: DepositProofStatus;
    method: PaymentMethodKind;
    /** What the customer's most recent proof for this specific charge claimed, in centavos — never
     * treated as paid/verified; only an admin-confirmed review actually marks the charge PAID. */
    amountClaimedCentavos: number | null;
    uploadedAt: string;
    /** Staff's explanation, set when paymentProof.status is REJECTED. */
    reviewNote: string | null;
  } | null;
  /**
   * Display hint only (RMS re-checks everything server-side on actual submission) for whether the
   * "Pay Additional Charge" / "Submit New Proof" action should be offered — true only while the
   * charge itself is still PENDING and no proof for it is currently under review. `undefined` only
   * for an older RMS response predating this field; the UI derives the same payable/rejected check
   * itself from `status`/`paymentProof` in that case (see getChargeProofState in MyBookings.tsx).
   */
  canSubmitPaymentProof?: boolean;
}

/** Matches the RMS's ReturnCondition exactly (src/domain/returnCondition.ts) — derived server-side,
 * separate from the booking's own status. */
export type RmsReturnCondition = 'NOT_RETURNED' | 'UNDER_INSPECTION' | 'CLEAN' | 'ISSUE_UNRESOLVED' | 'ISSUE_RESOLVED';

export interface RmsMyBooking {
  bookingId: string;
  bookingNumber: string;
  status: string;
  /** Optional defensively — an older RMS response won't carry it (see getReturnOutcome). */
  returnCondition?: RmsReturnCondition;
  pickupAt: string;
  returnAt: string;
  rentalFeeCentavos: number;
  depositCentavos: number;
  securityDeposit: RmsSecurityDeposit;
  /** Optional defensively — older RMS responses (or a booking predating this field) won't have
   * it; the UI must not crash when it's absent, just omit the rental-fee section for that card. */
  rentalFee?: RmsRentalFee;
  fulfillmentType: 'PICKUP' | 'DELIVERY';
  deliveryAddress: string | null;
  packages: { name: string; quantity: number }[];
  gears: { name: string; quantity: number }[];
  addOns: { name: string; quantity: number }[];
  /** Empty for a booking that never went through document verification (e.g. staff-created) —
   * the RMS's own comment on this field confirms that's the only reliable signal for that case. */
  verificationDocuments: RmsVerificationDocument[];
  /** Post-rental gear-inspection findings — empty for the common case (nothing damaged/lost).
   * Optional defensively, same reasoning as `rentalFee`: an older RMS response won't have it. */
  damageReports?: RmsDamageReport[];
  /** Finalised additional charges. Optional defensively, same reasoning as `rentalFee`: an older
   *  RMS response won't carry it, and the UI must simply omit the section in that case. */
  additionalCharges?: RmsAdditionalCharge[];
  /** Server-derived totals — never recomputed in the browser. */
  additionalChargesOutstandingCentavos?: number;
  additionalChargesTotalCentavos?: number;
  /** The return-inspection settlement, once RMS has actually run one. `null` means RMS explicitly
   * confirms this booking had a clean return with no settlement to show (a real, meaningful
   * answer — the UI must not show a settlement section for it). `undefined` means an older RMS
   * response predating this field — treated the same as `null` (no section), never crashes, never
   * fabricates a settlement. See RmsReturnSettlement's own doc comment for the individual fields. */
  returnSettlement?: RmsReturnSettlement | null;
}

/** Read-only — safe to retry a transient failure (see withReadRetry). Never used for a mutation. */
export async function fetchMyBookingsFromRms(): Promise<{ bookings: RmsMyBooking[] }> {
  try {
    return await withReadRetry(() => rmsFetch<{ bookings: RmsMyBooking[] }>('/api/customer/bookings'));
  } catch (err) {
    // The RMS resolves the caller to a Customer row, which only exists once the account has made a
    // first booking (see getSessionCustomer in the RMS's src/lib/customerAuth.ts) — a brand-new,
    // fully authenticated account with no booking yet therefore gets the same 401 as an expired
    // session. Only when Supabase itself confirms the token is still valid is that 401 read as
    // "no bookings yet" (an empty list); a genuinely expired/revoked session still fails the check
    // below and rethrows, so the caller's "session expired" handling is unchanged. RMS still
    // enforces authentication and ownership — this only decides what Main displays.
    if (err instanceof RmsApiError && err.status === 401 && (await hasVerifiedSupabaseUser())) {
      return { bookings: [] };
    }
    throw err;
  }
}

async function hasVerifiedSupabaseUser(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getUser();
    return !error && Boolean(data.user);
  } catch {
    return false;
  }
}

/** Matches the RMS's PaymentMethod enum (prisma/schema.prisma) exactly — this is what actually
 * gets recorded against the payment proof, not a display label. `MARIBANK` is the dedicated value
 * the Additional Charge payment-proof endpoint expects for a MariBank transfer; the older
 * Security Deposit and Rental Fee proof endpoints still expect a MariBank transfer recorded as
 * `BANK_TRANSFER` (see paymentMethods.ts's own `additionalChargeRmsMethod` field for how the two
 * are kept separate from the one shared MariBank config entry). */
export type PaymentMethodKind = 'CASH' | 'GCASH' | 'MAYA' | 'BANK_TRANSFER' | 'CARD' | 'OTHER' | 'MARIBANK';

export interface DepositProofSubmission {
  storagePath: string;
  /** What the customer says they paid, in centavos — recorded for admin reference only. RMS never
   * treats this as the verified amount; only an admin-confirmed review creates the real Payment. */
  amountClaimedCentavos: number;
  method: PaymentMethodKind;
  referenceNumber?: string;
}

/**
 * Confirmed against the actual RMS route/schema (src/app/api/customer/bookings/[id]/deposit-proof
 * and securityDepositProofSchema in src/features/bookings/schemas.ts): the RMS returns the new
 * PaymentProof's own id and status, and REQUIRES amountClaimedCentavos + method in the request body
 * — storagePath alone is rejected with a 400 validation error. A prior version of this function
 * only sent storagePath and would have failed on every real submission.
 */
export interface RmsDepositProofResult {
  id: string;
  status: DepositProofStatus;
}

/**
 * Submits an already-uploaded deposit payment-proof file for RMS staff review. The file itself
 * must already be in the private "payment-proofs" bucket (see DepositProofUpload.tsx) — this call
 * never sends the raw file, only the path plus the customer's claimed amount/method. Never implies
 * verification: RMS review, not this call, decides whether the deposit is verified.
 */
export function submitDepositProof(bookingId: string, input: DepositProofSubmission) {
  return rmsFetch<RmsDepositProofResult>(`/api/customer/bookings/${bookingId}/deposit-proof`, {
    method: 'POST',
    body: input,
  });
}

/** Identical shape to DepositProofSubmission — the two are only distinguished by which endpoint
 * receives them (and therefore which PaymentProofPurpose the RMS records), never by any field on
 * this type itself. */
export type RentalFeeProofSubmission = DepositProofSubmission;
export type RmsRentalFeeProofResult = RmsDepositProofResult;

/**
 * Submits an already-uploaded rental-fee payment-proof file for RMS staff review — the cashless
 * rental-fee payment workflow (separate from, and never merged with, the security-deposit proof
 * above). Mirrors submitDepositProof exactly: the file itself must already be in the private
 * "payment-proofs" bucket (see RentalFeeProofUpload.tsx), this call never sends the raw file, and
 * RMS admin review — not this call — decides whether the rental fee is actually paid.
 */
export function submitRentalFeeProof(bookingId: string, input: RentalFeeProofSubmission) {
  return rmsFetch<RmsRentalFeeProofResult>(`/api/customer/bookings/${bookingId}/rental-fee-proof`, {
    method: 'POST',
    body: input,
  });
}

export interface AdditionalChargeProofSubmission {
  /** Which specific RmsAdditionalCharge this proof is for — a booking can have more than one
   * outstanding charge at once (damage + a late fee, for instance), each with its own independent
   * proof workflow, so this is required and always the RMS's own `RmsAdditionalCharge.id`, never
   * a client-side index or the customer-facing `chargeNumber`. */
  additionalChargeId: string;
  storagePath: string;
  /** Always that specific charge's own `amountCentavos`, sent exactly as RMS already returned it
   * — never a customer-typed figure. See AdditionalChargeProofDialog: the amount field is
   * display-only, there is no input the customer could edit this from. */
  amountClaimedCentavos: number;
  method: PaymentMethodKind;
  referenceNumber?: string;
}

export type RmsAdditionalChargeProofResult = RmsDepositProofResult;

/**
 * Submits an already-uploaded additional-charge payment-proof file for RMS staff review — a
 * third, independent cashless-payment proof workflow (separate from, and never merged with, the
 * security-deposit and rental-fee proofs above). Mirrors submitDepositProof/submitRentalFeeProof
 * exactly: the file itself must already be in the private "payment-proofs" bucket (see
 * AdditionalChargeProofDialog.tsx), this call never sends the raw file, and RMS admin review —
 * not this call — decides whether the charge is actually marked PAID. This site never creates a
 * Payment record or flips a charge's status itself.
 */
export function submitAdditionalChargeProof(bookingId: string, input: AdditionalChargeProofSubmission) {
  return rmsFetch<RmsAdditionalChargeProofResult>(`/api/customer/bookings/${bookingId}/additional-charge-proof`, {
    method: 'POST',
    body: input,
  });
}

export interface VerificationDocumentResubmission {
  /** Use VERIFICATION_KIND_MAP to derive this from a VerificationDocumentKey slot, never a
   * hand-written string literal. */
  kind: RmsVerificationDocumentKind;
  storagePath: string;
}

export interface RmsVerificationDocumentResult {
  kind: RmsVerificationDocumentKind;
  status: VerificationDocumentReviewStatus;
}

/**
 * Replaces ONE verification document already on an existing booking — only ever valid while that
 * document is CORRECTION_REQUIRED (the RMS itself enforces this; a REJECTED or APPROVED document
 * is refused). The file must already be uploaded to the private "verification-documents" bucket
 * under the customer's own id (see the resubmission upload logic that calls this) — this call
 * never sends the raw file, only the path. The RMS resets the document to PENDING_REVIEW; it can
 * never become APPROVED/REJECTED/CORRECTION_REQUIRED through this call — only staff review does
 * that, via the existing Admin review flow.
 */
export function resubmitVerificationDocument(bookingId: string, input: VerificationDocumentResubmission) {
  return rmsFetch<RmsVerificationDocumentResult>(`/api/customer/bookings/${bookingId}/verification-document`, {
    method: 'POST',
    body: input,
  });
}

/** Matches the RMS's CustomerCatalogAddOn exactly (src/server/catalog/service.ts) — a paid add-on
 * only orderable because a specific gear kind was selected, e.g. an Extra Canopy Pole Set for the
 * Vidalido Vicore Tent. `maxQuantity` is the real GearPairing-sourced cap, never hardcoded. */
export interface RmsCatalogAddOn {
  role: string;
  category: string;
  brand: string;
  model: string | null;
  name: string;
  price48hCentavos: number;
  price72hCentavos: number;
  extraPerDayCentavos: number;
  maxQuantity: number;
  availableCount: number;
  /** Free-text, staff-written description (e.g. how many poles come in one add-on); absent when
   *  nothing's been written yet. */
  description?: string | null;
  imageUrl?: string | null;
  images?: string[];
}

/** Matches the RMS's CustomerCatalogGearKind exactly. No id field — a kind is identified by its
 * category+brand+model triple, both here and in the booking submission payload. */
export interface RmsCatalogGearKind {
  category: string;
  brand: string;
  model: string | null;
  name: string;
  price48hCentavos: number;
  price72hCentavos: number;
  extraPerDayCentavos: number;
  quantity: number;
  availableCount: number;
  canSelect: boolean;
  imageUrl: string | null;
  freeAccessories: { role: string; name: string }[];
  compatibleAddOns: RmsCatalogAddOn[];
  /** Only present when this kind's units span more than one color. Prices appear on a variant only
   *  when they differ from the kind's own. */
  variants?: RmsCatalogGearVariant[];
  /** Free-text "Size / Capacity" from the RMS inventory (e.g. "6P"); null/absent when not set. */
  sizeCapacity?: string | null;
  /** The kind's color when all its units share one ("Black"/"Khaki"); absent when units span more
   *  than one color (see `variants`) or none is recorded. */
  color?: string | null;
  /** Free-text, staff-written description; present only when at least one unit has one filled in
   *  (see the RMS's own "if units disagree, omit" rule). */
  description?: string | null;
  /** Every distinct photo URL across this kind's units, in RMS order. Absent/empty when none. */
  images?: string[];
}

/** One color of a gear kind — matches the RMS's CustomerCatalogGearVariant. */
export interface RmsCatalogGearVariant {
  color: string;
  imageUrl: string | null;
  quantity: number;
  availableCount: number;
  canSelect: boolean;
  price48hCentavos?: number;
  price72hCentavos?: number;
  extraPerDayCentavos?: number;
  sizeCapacity?: string | null;
  description?: string | null;
  images?: string[];
}

/**
 * The Build Your Own gear catalog — GET /api/customer/catalog/gear, confirmed public/
 * unauthenticated in the RMS route (matches the package catalog's own pre-login browsability).
 * Never falls back to mock data on failure: unlike the package catalog (fetched directly from
 * Supabase — see supabaseCatalog.ts), a BYO catalog failure must surface as a real error state so
 * a customer never selects and submits a booking against inventory that doesn't actually exist.
 */
export function fetchGearCatalogFromRms() {
  return withReadRetry(() => rmsFetch<{ kinds: RmsCatalogGearKind[] }>('/api/customer/catalog/gear', { requireAuth: false }));
}

/** Matches the RMS's CustomerCatalogPackageComponent exactly (src/server/catalog/service.ts) — one
 * required kind within a package (e.g. "1 TENT"). `name`/`availableCount` are resolved from live
 * InventoryItem data by the same category/brand/model key as everything else in that file; `name`
 * is null on the rare component whose kind has no current live-priced inventory at all. */
export interface RmsCatalogPackageComponent {
  category: string;
  brand: string;
  model: string | null;
  name: string | null;
  color?: string | null;
  quantity: number;
  availableCount: number;
}

/**
 * Matches the RMS's CustomerCatalogPackage exactly. `price48hCentavos`/`price72hCentavos` are
 * ALREADY resolved server-side (`Package.price48hCentavos ?? Package.basePriceCentavos`, same for
 * 72h) — never null here, unlike the raw `packages` table columns supabaseCatalog.ts reads
 * directly. `canSelect` is a current-snapshot "does every required component have enough live
 * stock right now" signal — informational only; the authoritative, date-aware check is the
 * availability endpoint (useAvailabilityCheck), run again at booking creation. Never a security
 * boundary on its own — see fetchPackageCatalogFromRms's own doc comment. */
export interface RmsCatalogPackage {
  packageNumber: string;
  name: string;
  description: string | null;
  price48hCentavos: number;
  price72hCentavos: number;
  extraPerDayCentavos: number;
  depositCentavos: number;
  imageUrl: string | null;
  /** A real photo gallery for this specific package/edition — absent/empty for any package staff
   *  haven't uploaded extra photos for yet, in which case `imageUrl` alone is still the one photo
   *  shown. */
  images?: string[];
  components: RmsCatalogPackageComponent[];
  canSelect: boolean;
  compatibleAddOns: RmsCatalogAddOn[];
}

/**
 * The real package catalog's own `canSelect`/live-component-availability signal — GET
 * /api/customer/catalog/packages, confirmed public/unauthenticated in the RMS route. Main's own
 * package catalog (name, description, image, pricing) is still read directly from Supabase (see
 * supabaseCatalog.ts) rather than switched to this endpoint wholesale; this is used only to enrich
 * that data with the one signal Supabase's own `packages` table has no equivalent for — whether
 * RMS's own component-level stock currently allows the package to be selected at all. A failure
 * here is deliberately non-fatal to the catalog itself (see CatalogContext's own handling): the
 * authoritative, date-aware availability check that runs before a customer can actually submit a
 * booking (useAvailabilityCheck, then a fresh re-check at PaymentBreakdown's own submit gate) is
 * what actually protects against booking real out-of-stock inventory, so a transient failure of
 * this purely-advisory signal must never block the whole package catalog from rendering.
 */
export function fetchPackageCatalogFromRms() {
  return withReadRetry(() => rmsFetch<{ packages: RmsCatalogPackage[] }>('/api/customer/catalog/packages', { requireAuth: false }));
}

/**
 * One request answering "which packages are free for these dates?" for every package at once, from
 * the RMS's date-aware catalog (same per-kind, per-date stock the availability check uses). Only a
 * hint for showing "available" on many cards without one availability call each. `dateAware` is
 * true only when the RMS actually applied the dates, so an older RMS that ignores the parameters
 * is never mistaken for a real answer. Deliberately no automatic retry: any failure just sends the
 * caller back to the per-package check.
 */
export function fetchPackageStockForDates(window: { pickupAt: string; returnAt: string }, signal?: AbortSignal) {
  const query = new URLSearchParams({ pickupAt: window.pickupAt, returnAt: window.returnAt });
  return rmsFetch<{ packages: { packageNumber: string; canSelect: boolean }[]; dateAware?: boolean }>(
    `/api/customer/catalog/packages?${query.toString()}`,
    { requireAuth: false, signal },
  );
}

/**
 * The Build Your Own gear catalog with stock counted for specific dates ("free for the whole
 * window"), instead of "free right now". `dateAware` is true only when the RMS actually applied
 * the dates, so an older RMS that ignores the parameters is never mistaken for a real answer.
 * Advisory and display-only, and never retried automatically: on any failure the caller keeps the
 * ordinary snapshot.
 */
export function fetchGearStockForDates(window: { pickupAt: string; returnAt: string }, signal?: AbortSignal) {
  const query = new URLSearchParams({ pickupAt: window.pickupAt, returnAt: window.returnAt });
  return rmsFetch<{ kinds: RmsCatalogGearKind[]; dateAware?: boolean }>(`/api/customer/catalog/gear?${query.toString()}`, {
    requireAuth: false,
    signal,
  });
}

/** The currently RMS-configured customer-facing payment QR codes, exactly as staff last set them
 * on the RMS Settings page. `null` for a method means no QR is currently configured for it — a
 * real, meaningful "coming soon" answer, never treated as "the fetch didn't happen yet." */
export interface RmsPaymentQrConfig {
  gcash: string | null;
  maribank: string | null;
}

/** Public/unauthenticated, same reasoning as fetchGearCatalogFromRms above — a customer must be
 * able to see how to pay before (or without ever) logging in. Read-only, so safe to retry a
 * transient failure (see withReadRetry). */
export function fetchPaymentQrConfig() {
  return withReadRetry(() => rmsFetch<RmsPaymentQrConfig>('/api/customer/payment-qr', { requireAuth: false }));
}

/**
 * "Plan an Event" lead submission — never a booking. The RMS logs this as an
 * EventInquiry a staff member reviews, quotes, and (only if the customer
 * accepts) manually converts into a real booking later; nothing about this
 * call reserves gear, charges anything, or creates a Booking row.
 */
export interface RmsEventInquirySubmission {
  customerName: string;
  contactNumber: string;
  email: string;
  organization?: string;
  eventType: string;
  estimatedParticipants: number;
  eventLocation: string;
  eventStartDate: string;
  eventEndDate: string;
  requestedEquipment: string;
  specialRequests?: string;
}

export interface RmsEventInquiryResult {
  inquiryNumber: string;
}

/** Requires a logged-in customer, matching the RMS route — the UI itself must gate submission
 *  before ever calling this (see EventPlan.tsx), but this call is the actual enforcement backstop:
 *  requireAuth defaults to true, so a missing/expired session throws before the request even goes
 *  out, and the RMS independently re-verifies the token server-side regardless. */
export function submitEventInquiry(payload: RmsEventInquirySubmission) {
  return rmsFetch<RmsEventInquiryResult>('/api/customer/inquiries', {
    method: 'POST',
    body: payload,
  });
}

export interface RmsAvailabilityRequest {
  pickupAt: string;
  returnAt: string;
  /** Package path — mutually exclusive with bookingGears, same "packageCode takes priority if both
   * present" rule submitBookingToRms's payload already follows. */
  packageCode?: string;
  bookingGears?: RmsBookingGearLine[];
  addOns?: RmsBookingGearLine[];
}

export interface RmsAvailabilityIssue {
  /** Customer-safe display name only — the RMS never returns an inventory id, inventory number,
   * QR code, or storage location here. */
  name: string;
  requested: number;
  availableCount: number;
}

/** A kind with enough date-free stock to keep `available: true` (so it never appears in `issues`
 * above), but not enough of that stock is currently in the RMS's own AVAILABLE inventory status
 * right now — e.g. it's mid-cleaning/maintenance. `available` still correctly means "the dates
 * themselves are fine" (the RMS deliberately keeps allowing this, since a unit may finish
 * cleaning/maintenance before a future rental date with no fixed schedule to check it against) —
 * this is the separate, additive signal for "would RMS's own final reservation actually be able to
 * claim this right now." Same customer-safe display name as RmsAvailabilityIssue; never an
 * inventory id, QR code, or storage location. */
export interface RmsPendingTurnoverNotice {
  name: string;
  requested: number;
  currentlyReservableCount: number;
}

export interface RmsAvailabilityResult {
  /** Whether the requested dates are free of conflicting active assignments — RMS's own
   * date-availability answer. Never reinterpret this as "can be booked right now" — see
   * `currentlyReservable` below, which is the separate question that answers that. */
  available: boolean;
  issues: RmsAvailabilityIssue[];
  /** True only when every requested kind also has enough RMS-status-AVAILABLE stock right now to
   * actually be claimed if a booking were submitted this instant. Can be false even when
   * `available` is true — see RmsPendingTurnoverNotice's own doc comment. Optional defensively:
   * an older RMS response predating this field won't have it, and the UI must treat a missing
   * value as "unknown," never silently assume it's true. */
  currentlyReservable?: boolean;
  /** Empty (or absent, on an older RMS response) unless currentlyReservable is false. See
   * RmsPendingTurnoverNotice's own doc comment. */
  pendingTurnover?: RmsPendingTurnoverNotice[];
}

/** Upper bound on how long a single availability request is allowed to stay pending before this
 *  function gives up on it itself, rather than trusting the network/RMS to always answer promptly.
 *  Comfortably above the RMS's own documented worst-case pooler-contention latency for this exact
 *  query path (measured there at 500ms-5.8s under contention — see
 *  countAvailableUnitsBatch's doc comment in the RMS), so a genuinely slow-but-alive RMS still gets
 *  to answer; only a truly stuck/unreachable request is ever cut off here. Retrying (if a caller
 *  wants to) and rate-limit backoff both live at the caller/coordinator layer now, never inside
 *  this function — see useAvailabilityCheck.ts's own doc comment for why a single-retry loop
 *  embedded here couldn't prevent a fan-out of many simultaneous callers each retrying on their own. */
const AVAILABILITY_TIMEOUT_MS = 8_000;

/** Aborts if EITHER input signal aborts — manual implementation (not `AbortSignal.any`, which
 *  isn't guaranteed available in every browser this site needs to support) so `checkAvailability`
 *  can enforce its own bounded timeout without ever weakening a caller's own cancellation: an
 *  explicit caller abort (a superseded input) and an internal timeout both reach the same
 *  underlying `fetch()` the identical way. */
function combineAbortSignals(a: AbortSignal | undefined, b: AbortSignal): AbortSignal {
  if (!a) return b;
  if (a.aborted || b.aborted) return AbortSignal.abort();
  const combined = new AbortController();
  const onAbort = () => combined.abort();
  a.addEventListener('abort', onAbort, { once: true });
  b.addEventListener('abort', onAbort, { once: true });
  return combined.signal;
}

/**
 * Advisory-only availability check against the RMS's real inventory/assignment data for the
 * requested dates — this site never computes availability itself. Public/unauthenticated, same as
 * fetchGearCatalogFromRms. A "true" result here is a UX hint, never a hold: POST
 * /api/customer/bookings performs its own independent, authoritative re-check immediately before
 * creating the booking, so a stale/optimistic result from this call can never itself create an
 * overbooked reservation.
 *
 * `options.signal` lets a caller genuinely cancel this specific check once its inputs go stale
 * (see PathACatalog) — the underlying `fetch()` is actually aborted, not just ignored client-side,
 * so a superseded check stops consuming RMS capacity instead of running to completion for nothing.
 * Independently of that, this call always enforces its own bounded timeout
 * (AVAILABILITY_TIMEOUT_MS) so a hung connection can never leave a caller waiting forever even if
 * it never passes a signal of its own.
 *
 * Deliberately does NOT retry on 429/5xx itself — see useAvailabilityCheck.ts (the shared
 * coordinator every caller of this function goes through) for where retry-with-backoff now lives.
 * A retry embedded in this single-request function has no way to know about every OTHER
 * simultaneous call to it (e.g. one per visible package card), so it could only ever repeat the
 * exact fan-out that caused a 429 in the first place; only a caller with visibility across all of
 * them can safely coordinate a retry.
 */
export async function checkAvailability(
  input: RmsAvailabilityRequest,
  options?: { signal?: AbortSignal },
): Promise<RmsAvailabilityResult> {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), AVAILABILITY_TIMEOUT_MS);
  try {
    return await rmsFetch<RmsAvailabilityResult>('/api/customer/availability', {
      method: 'POST',
      body: input,
      requireAuth: false,
      signal: combineAbortSignals(options?.signal, timeoutController.signal),
    });
  } catch (err) {
    // The caller's OWN signal aborting is a deliberate, silent supersede — rethrown as-is so
    // existing "if (signal.aborted) return" guards keep working unchanged. Our OWN timeout firing,
    // while the caller never asked to cancel, is a genuine failure the caller couldn't have caused
    // or anticipated — re-thrown as a distinct type so it's never confused with the caller's own
    // intentional cancellation.
    if (!options?.signal?.aborted && timeoutController.signal.aborted) {
      throw new RmsAvailabilityTimeoutError();
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
