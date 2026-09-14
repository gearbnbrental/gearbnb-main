import { supabase } from '../supabase';
import type { VerificationDocumentKey } from '../types/gearbnb';

/**
 * In `vite dev` (import.meta.env.DEV), always talk to the local RMS dev server — never the
 * production RMS configured in .env for the real deployed build. Without this, every RMS
 * integration (BYO catalog, bookings, verification, payment proofs, My Bookings, Plan an Event)
 * silently calls production while developing locally: the request either gets redirected by the
 * production proxy's login gate or blocked by its CORS allowlist (which deliberately excludes
 * localhost origins whenever NODE_ENV === "production" — see CUSTOMER_PORTAL_DEV_ORIGIN in the
 * RMS's src/proxy.ts), surfacing as "We couldn't load the Build Your Own catalog right now" with
 * no indication the request never reached a local server at all. Mirrors the RMS's own
 * CUSTOMER_PORTAL_DEV_ORIGIN convention (a hardcoded localhost dev value, never used in a real
 * build) rather than requiring every developer to hand-create a local env override. The RMS dev
 * server's default port (`next dev`, unconfigured) is 3000.
 */
const RMS_API_URL = import.meta.env.DEV
  ? 'http://localhost:3000'
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

export class RmsApiError extends Error {
  status: number;
  fields?: Record<string, string[]>;

  constructor(message: string, status: number, fields?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
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
}

/**
 * Calls the authenticated RMS customer API (never the HMAC-signed /api/webhooks/bookings — that
 * endpoint authenticates a trusted server, not an end user, and its secret must never reach the
 * browser). Throws RmsApiError on any non-2xx response, with the RMS's own error message intact.
 */
async function rmsFetch<T>(path: string, options: RmsFetchOptions = {}): Promise<T> {
  if (!RMS_API_URL) {
    throw new RmsApiError('The booking system is not configured yet — please try again later.', 500);
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
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // A non-JSON error body (e.g. a proxy's HTML error page) — fall through with data null.
  }

  if (!response.ok) {
    const body = (data ?? {}) as { error?: string; fields?: Record<string, string[]> };
    throw new RmsApiError(body.error ?? 'The request could not be completed.', response.status, body.fields);
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
  chargeNumber: string;
  type: 'DAMAGE' | 'LOSS' | 'LATE_FEE' | 'EXTENSION' | 'OTHER';
  /** Null for a charge against the whole rental rather than one item. */
  itemName: string | null;
  quantity: number;
  extraDays: number | null;
  reason: string;
  amountCentavos: number;
  status: 'PENDING' | 'PAID';
  createdAt: string;
}

export interface RmsMyBooking {
  bookingId: string;
  bookingNumber: string;
  status: string;
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
}

/** Read-only — safe to retry a transient failure (see withReadRetry). Never used for a mutation. */
export function fetchMyBookingsFromRms() {
  return withReadRetry(() => rmsFetch<{ bookings: RmsMyBooking[] }>('/api/customer/bookings'));
}

/** Matches the RMS's PaymentMethod enum (prisma/schema.prisma) exactly — this is what actually
 * gets recorded against the payment proof, not a display label. There is no dedicated "MariBank"
 * value; a MariBank transfer is recorded as BANK_TRANSFER (see paymentMethods.ts config mapping). */
export type PaymentMethodKind = 'CASH' | 'GCASH' | 'MAYA' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';

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
}

/**
 * The Build Your Own gear catalog — GET /api/customer/catalog/gear, confirmed public/
 * unauthenticated in the RMS route (matches the package catalog's own pre-login browsability).
 * Never falls back to mock data on failure: unlike the package catalog (fetched directly from
 * Supabase with a mock fallback), a BYO catalog failure must surface as a real error state so a
 * customer never selects and submits a booking against inventory that doesn't actually exist.
 */
export function fetchGearCatalogFromRms() {
  return withReadRetry(() => rmsFetch<{ kinds: RmsCatalogGearKind[] }>('/api/customer/catalog/gear', { requireAuth: false }));
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

export interface RmsAvailabilityResult {
  available: boolean;
  issues: RmsAvailabilityIssue[];
}

/**
 * Advisory-only availability check against the RMS's real inventory/assignment data for the
 * requested dates — this site never computes availability itself. Public/unauthenticated, same as
 * fetchGearCatalogFromRms. A "true" result here is a UX hint, never a hold: POST
 * /api/customer/bookings performs its own independent, authoritative re-check immediately before
 * creating the booking, so a stale/optimistic result from this call can never itself create an
 * overbooked reservation.
 */
export function checkAvailability(input: RmsAvailabilityRequest) {
  return rmsFetch<RmsAvailabilityResult>('/api/customer/availability', {
    method: 'POST',
    body: input,
    requireAuth: false,
  });
}
