import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/useCatalog';
import { supabase } from '../../supabase';
import { formatCurrency } from '../../utils/format';
import { PAYMENT_METHODS } from '../../config/paymentMethods';
import {
  PAYMENT_PROOF_BUCKET,
  RmsApiError,
  ensureFreshSession,
  submitDepositProof,
  type DepositProofStatus,
} from '../../utils/rmsApi';

function centavosFromPesosInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const pesos = Number(trimmed);
  if (!Number.isFinite(pesos) || pesos <= 0) return null;
  return Math.round(pesos * 100);
}

const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.-]/g, '_');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v1.5A2.25 2.25 0 0 0 5.25 20.25h13.5A2.25 2.25 0 0 0 21 18v-1.5M7.5 9 12 4.5m0 0L16.5 9M12 4.5v12"
      />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M2.25 12a9.75 9.75 0 1 1 19.5 0 9.75 9.75 0 0 1-19.5 0Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53-1.471-1.47a.75.75 0 0 0-1.06 1.06l2.1 2.1a.75.75 0 0 0 1.14-.094l3.747-5.254Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M9.401 3.003c1.155-2 4.043-2 5.198 0l7.355 12.748c1.154 2-.29 4.5-2.6 4.5H4.646c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function InfoCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        d="M2.25 12a9.75 9.75 0 1 1 19.5 0 9.75 9.75 0 0 1-19.5 0ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ApprovedStatus({ verifiedCentavos, settled }: { verifiedCentavos: number; settled: boolean }) {
  // `settled`: the proof was approved, but the RMS's own net figure (collected − returned −
  // forfeited) has since dropped to zero — the deposit was refunded or applied to a return issue. Showing "Verified amount: ₱0.00" there would read as if nothing was ever paid.
  if (settled) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-brand-forest/30 bg-brand-forest/10 p-4">
        <CheckCircleIcon className="h-5 w-5 shrink-0 text-accent" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-accent">Security Deposit Received</p>
          <p className="text-sm text-ink-muted">
            Your deposit was verified. Any refund or deduction is shown in the payment summary above.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand-forest/30 bg-brand-forest/10 p-4">
      <CheckCircleIcon className="h-5 w-5 shrink-0 text-accent" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-accent">Security Deposit Verified</p>
        <p className="text-sm text-ink-muted">
          Verified amount: <span className="font-medium text-ink">{formatCurrency(verifiedCentavos / 100)}</span>
        </p>
      </div>
    </div>
  );
}

function PendingStatus({
  requiredCentavos,
  amountClaimedCentavos,
}: {
  requiredCentavos: number;
  amountClaimedCentavos: number | null;
}) {
  // Same breakdown RejectedNotice shows — a proof pending review can still be mathematically
  // short of the requirement (the reviewer just hasn't acted on it yet); showing this now, rather
  // than only after a rejection, is what makes "Submitted total matches what's required" or "this
  // is still short" visible immediately instead of a second review cycle later.
  const shortfallCentavos = amountClaimedCentavos !== null ? requiredCentavos - amountClaimedCentavos : 0;
  const isShort = shortfallCentavos > 0;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-400/30 dark:bg-amber-400/10">
      <ClockIcon className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
      <div className="flex w-full flex-col gap-2">
        <div>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Payment Proof Under Review</p>
          <p className="text-sm text-amber-800/80 dark:text-amber-300/80">
            Your security deposit payment proof is currently being reviewed by GearBnB.
          </p>
        </div>

        {amountClaimedCentavos !== null && (
          <dl className="grid grid-cols-3 gap-2 rounded-lg bg-surface/60 p-2 text-center text-xs dark:bg-black/10">
            <div>
              <dt className="text-amber-800/70 dark:text-amber-300/70">Required</dt>
              <dd className="font-semibold text-amber-800 dark:text-amber-300">{formatCurrency(requiredCentavos / 100)}</dd>
            </div>
            <div>
              <dt className="text-amber-800/70 dark:text-amber-300/70">Submitted</dt>
              <dd className="font-semibold text-amber-800 dark:text-amber-300">
                {formatCurrency(amountClaimedCentavos / 100)}
              </dd>
            </div>
            <div>
              <dt className="text-amber-800/70 dark:text-amber-300/70">Shortfall</dt>
              <dd className="font-semibold text-amber-800 dark:text-amber-300">
                {formatCurrency(Math.max(0, shortfallCentavos) / 100)}
              </dd>
            </div>
          </dl>
        )}

        {isShort && (
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
            This submitted amount is still short of the required deposit, GearBnB may ask you to upload updated
            proof showing the full amount paid.
          </p>
        )}
      </div>
    </div>
  );
}

/** Shown above the upload form only when resubmitting after a rejection — states the total
 *  required amount up front, before the customer even opens the file picker, so "upload proof of
 *  the full deposit" is the first thing they read rather than something buried in a past note. */
function ResubmissionGuidance({ requiredCentavos }: { requiredCentavos: number }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand-forest/30 bg-brand-forest/5 p-4">
      <InfoCircleIcon className="h-5 w-5 shrink-0 text-accent" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-accent">Upload Updated Payment Proof</p>
        <p className="text-sm text-ink-muted">
          Required security deposit: <span className="font-semibold text-ink">{formatCurrency(requiredCentavos / 100)}</span>
        </p>
        <p className="text-sm text-ink-muted">
          Please upload proof showing the full {formatCurrency(requiredCentavos / 100)} security deposit has been
          paid, not just the additional amount.
        </p>
      </div>
    </div>
  );
}

/**
 * A package's own security deposit is a real, admin-configured value known from booking creation
 * — the customer website never computes it, and never computes an add-on's own deposit either
 * (see DepositProofUploadProps.hasPackageAddOns). GearBnB staff decide, after reviewing the
 * specific add-ons selected, whether this booking needs anything beyond the package deposit
 * already shown above; if they do, the RMS's own `requiredCentavos` simply becomes that larger
 * number the next time this page loads — nothing here recalculates or stores a second figure.
 * Shown whenever this booking has add-ons, regardless of proof/verification status: staff can
 * revisit the add-on deposit question at any point up to pickup, not only before the customer's
 * first payment.
 */
function AddOnDepositPendingNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line-soft bg-surface-muted p-4">
      <InfoCircleIcon className="h-5 w-5 shrink-0 text-ink-muted" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-ink">Additional Add-on Deposit</p>
        <p className="text-sm font-medium text-ink-muted">To Be Determined</p>
        <p className="text-sm text-ink-muted">
          GearBnB staff will review your selected add-ons and confirm any additional deposit
          required. If one applies, it will be reflected in the Security Deposit amount above,
never a separate charge you have to track yourself.
        </p>
      </div>
    </div>
  );
}

/**
 * Shown once GearBnB staff have actually set a positive add-on deposit (see
 * DepositProofUploadProps.addOnDepositCentavos — replaces AddOnDepositPendingNotice above once
 * that happens). `baseCentavos`/`addOnCentavos` are never independently computed charges, just the
 * same one refundable `totalCentavos` (the headline figure already shown above this notice) split
 * into its two parts, so the customer can see what the add-ons themselves added without losing
 * sight of the package's own original deposit.
 */
function AddOnDepositDeterminedNotice({
  baseCentavos,
  addOnCentavos,
  totalCentavos,
}: {
  baseCentavos: number;
  addOnCentavos: number;
  totalCentavos: number;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line-soft bg-surface-muted p-4">
      <InfoCircleIcon className="h-5 w-5 shrink-0 text-ink-muted" />
      <div className="flex w-full flex-col gap-2">
        <p className="text-sm font-semibold text-ink">Security Deposit Breakdown</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink-muted">Base Security Deposit</dt>
          <dd className="text-right font-medium text-ink">{formatCurrency(baseCentavos / 100)}</dd>
          <dt className="text-ink-muted">Additional Add-on Deposit</dt>
          <dd className="text-right font-medium text-ink">{formatCurrency(addOnCentavos / 100)}</dd>
          <dt className="font-semibold text-ink">Total Security Deposit</dt>
          <dd className="text-right font-semibold text-ink">{formatCurrency(totalCentavos / 100)}</dd>
        </dl>
        <p className="text-sm text-ink-muted">
          GearBnB reviewed your selected add-ons and included their deposit in the total above, this
          is part of your one refundable security deposit, never a separate charge to pay on top of it.
        </p>
      </div>
    </div>
  );
}

function NoDepositRequiredStatus() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line-soft bg-surface-muted p-4">
      <InfoCircleIcon className="h-5 w-5 shrink-0 text-ink-muted" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-ink">No Security Deposit Required</p>
        <p className="text-sm text-ink-muted">This booking has no security deposit, so there's nothing to pay or upload.</p>
      </div>
    </div>
  );
}

function NotYetDeterminedStatus() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line-soft bg-surface-muted p-4">
      <InfoCircleIcon className="h-5 w-5 shrink-0 text-ink-muted" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-ink">Security Deposit: To Be Determined</p>
        <p className="text-sm text-ink-muted">
          GearBnB will review your selections and let you know the required security deposit soon. There's
          nothing to pay yet.
        </p>
      </div>
    </div>
  );
}

function RejectedNotice({
  reviewNote,
  requiredCentavos,
  amountClaimedCentavos,
}: {
  reviewNote: string | null;
  requiredCentavos: number;
  amountClaimedCentavos: number | null;
}) {
  // Only meaningful when the claim is genuinely short of what's required — a proof can also be
  // rejected for other reasons (unclear receipt, wrong reference, etc.) where there's no
  // shortfall to show, and this breakdown would be misleading (e.g. reading "Shortfall: ₱0").
  const shortfallCentavos =
    amountClaimedCentavos !== null ? requiredCentavos - amountClaimedCentavos : 0;
  const isShortPayment = shortfallCentavos > 0;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
      <AlertIcon className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
            Payment Proof Rejected{isShortPayment ? ', Payment Short' : ''}
          </p>
          <p className="text-sm text-red-700/90 dark:text-red-400/90">This payment proof needs correction.</p>
        </div>

        {isShortPayment && amountClaimedCentavos !== null && (
          <>
            <dl className="grid grid-cols-3 gap-2 rounded-lg bg-surface/60 p-2 text-center text-xs dark:bg-black/10">
              <div>
                <dt className="text-red-700/70 dark:text-red-400/70">Required</dt>
                <dd className="font-semibold text-red-700 dark:text-red-400">{formatCurrency(requiredCentavos / 100)}</dd>
              </div>
              <div>
                <dt className="text-red-700/70 dark:text-red-400/70">Submitted</dt>
                <dd className="font-semibold text-red-700 dark:text-red-400">{formatCurrency(amountClaimedCentavos / 100)}</dd>
              </div>
              <div>
                <dt className="text-red-700/70 dark:text-red-400/70">Shortfall</dt>
                <dd className="font-semibold text-red-700 dark:text-red-400">{formatCurrency(shortfallCentavos / 100)}</dd>
              </div>
            </dl>

            {/* Always shown, regardless of what the admin's own reviewNote below says — the
               "top-up, not total" misunderstanding this fixes came from a customer reading an
               ambiguous note and assuming a receipt for just the shortfall was enough. */}
            <p className="text-sm text-red-700/90 dark:text-red-400/90">
              Please pay the remaining {formatCurrency(shortfallCentavos / 100)}, then upload updated proof showing
              the full {formatCurrency(requiredCentavos / 100)} security deposit has been paid. The new proof should
              show the total security deposit paid so far, not only the additional payment.
            </p>
          </>
        )}

        {reviewNote && <p className="text-sm text-red-700/90 dark:text-red-400/90">{reviewNote}</p>}
      </div>
    </div>
  );
}

/** `purpose` swaps only the first step's wording (e.g. "rental fee" for RentalFeeProofUpload) —
 *  everything else, including the GCash/MariBank QR images/account details, is shared and must
 *  never diverge between the security-deposit, rental-fee, and additional-charge upload flows.
 *  Defaults to 'security deposit' so every existing caller keeps its exact original text.
 *
 *  `additionalNote`, when given, renders as its own short callout under the numbered steps —
 *  currently only DepositProofUpload passes one, and only for a package booking with add-ons
 *  attached (see its own hasPackageAddOns prop): the amount shown elsewhere on this card is the
 *  package's own deposit, and this is what stops "pay the required security deposit" from reading
 *  as a guarantee that figure is the final word once add-ons are involved. */
export function PaymentInstructionsSection({
  purpose = 'security deposit',
  additionalNote,
}: { purpose?: string; additionalNote?: string } = {}) {
  // The RMS Settings page's own currently-configured QR (GET /api/customer/payment-qr, fetched
  // once per app load by CatalogContext — see its own doc comment) is authoritative. This file's
  // local `PAYMENT_METHODS[i].qrImageUrl` is only ever a fallback for a genuine fetch failure
  // (paymentQrState === 'error') — never preferred over a successful fetch, even when that
  // fetch's own answer is "no QR configured right now" (null). That distinction matters: an admin
  // who deliberately removes a QR on the Settings page must see it disappear here too, not
  // silently keep showing this bundled placeholder image as if it were still current.
  const { paymentQr, paymentQrState } = useCatalog();

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line-soft bg-surface-muted p-4">
      <div>
        <h4 className="text-sm font-semibold text-ink">Payment Instructions</h4>
        <ol className="mt-2.5 flex flex-col gap-1.5 text-sm text-ink-muted">
          {[
            `Pay the required ${purpose} using one of the available payment methods below.`,
            'Keep your payment receipt or screenshot.',
            'Upload your proof of payment.',
            'Wait for GearBnB to verify your payment.',
          ].map((step, index) => (
            <li key={step} className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-forest/10 text-[11px] font-semibold text-accent">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {additionalNote && <p className="mt-2.5 text-xs text-ink-faint">{additionalNote}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PAYMENT_METHODS.map((method) => {
          const liveQrUrl =
            method.id === 'gcash' ? paymentQr?.gcash : method.id === 'maribank' ? paymentQr?.maribank : null;
          const qrImageUrl = paymentQrState === 'error' ? method.qrImageUrl : liveQrUrl ?? null;

          return (
            <div
              key={method.id}
              className="flex flex-col items-center gap-2 rounded-lg border border-line bg-surface p-4 text-center shadow-sm"
            >
              <span className="text-sm font-semibold text-ink">{method.name}</span>
              {qrImageUrl ? (
                <img
                  src={qrImageUrl}
                  alt={method.qrImageAlt}
                  className="h-36 w-36 rounded-lg border border-line-soft object-contain"
                />
              ) : (
                <div
                  role="img"
                  aria-label={`${method.qrImageAlt}, not yet available`}
                  className="flex h-36 w-36 items-center justify-center rounded-lg border-2 border-dashed border-line p-2 text-center text-xs text-ink-faint"
                >
                  QR code coming soon
                </div>
              )}
              {/* Account details sit directly beneath their own QR so there's no ambiguity about
                  which number belongs to which method. `break-all` keeps a long account number
                  inside its card at narrow widths instead of forcing the page to scroll. */}
              <p className="text-xs text-ink-muted">{method.accountName}</p>
              <div className="flex flex-col gap-0.5">
                <p className="text-[11px] uppercase tracking-wide text-ink-faint">{method.accountNumberLabel}</p>
                <p className="break-all text-sm font-semibold text-ink">{method.accountNumber}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ProofDropzoneProps {
  file: File | null;
  previewUrl: string | null;
  error: string | null;
  disabled: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}

function ProofDropzone({ file, previewUrl, error, disabled, onSelect, onRemove }: ProofDropzoneProps) {
  const inputId = useId();
  const [isDragActive, setIsDragActive] = useState(false);
  const hasFile = file !== null;
  const isImage = hasFile && file.type.startsWith('image/');

  function handleFiles(fileList: FileList | null) {
    const selected = fileList?.[0];
    if (selected) onSelect(selected);
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragActive(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">Upload Proof of Payment</span>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
        className={[
          // Same reasoning as VerificationUpload's own dropzones: drag-and-drop is a desktop-only
          // affordance, so the full h-32 it needs there is unused height on a phone.
          'relative flex h-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-3 text-center transition-colors sm:h-32',
          disabled ? 'cursor-wait' : 'cursor-pointer',
          error
            ? 'border-red-400 bg-red-50 dark:border-red-500 dark:bg-red-500/10'
            : hasFile
              ? 'border-brand-forest bg-brand-forest/10'
              : isDragActive
                ? 'border-brand-forest/70 bg-brand-forest/5'
                : 'border-line bg-surface-muted hover:border-brand-forest/70 hover:bg-brand-forest/5',
        ].join(' ')}
      >
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          disabled={disabled}
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
        />

        {hasFile && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onRemove();
            }}
            aria-label="Remove selected file"
            className="absolute right-2 top-2 rounded-full bg-surface p-1 text-ink-muted shadow hover:text-red-600 dark:hover:text-red-400"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}

        {hasFile ? (
          <>
            {isImage && previewUrl ? (
              <img
                src={previewUrl}
                alt="Payment proof preview"
                className="h-14 w-14 rounded-lg object-cover ring-2 ring-brand-forest"
              />
            ) : (
              <CheckCircleIcon className="h-8 w-8 text-accent" />
            )}
            <p className="max-w-full truncate px-2 text-xs text-ink-muted">
              {file.name} · {formatFileSize(file.size)}
            </p>
          </>
        ) : (
          <>
            <UploadIcon className="h-7 w-7 text-ink-faint" />
            <p className="text-xs font-medium text-ink-muted">Click or drag your receipt/screenshot to upload</p>
            <p className="text-[11px] text-ink-faint">JPEG, PNG, WebP, or PDF, up to 10MB</p>
          </>
        )}
      </label>

      {error && (
        <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export interface DepositProofUploadProps {
  /** RMS booking id the proof is submitted against. */
  bookingId: string;
  /** Authoritative required amount, in centavos, from the RMS response. Never estimated locally. */
  requiredCentavos: number;
  /** Authoritative verified amount, in centavos, from the RMS response. */
  verifiedCentavos: number;
  verified: boolean;
  proofStatus: DepositProofStatus;
  reviewNote: string | null;
  /** What the customer's most recent proof claimed, in centavos — from the RMS response. Used
   * only to show a Required/Submitted/Shortfall breakdown when a proof was rejected for being
   * short; never treated as verified/paid. Null when no proof has ever been submitted. */
  amountClaimedCentavos: number | null;
  /** The portion of `requiredCentavos` attributable to add-ons, from the RMS response — see
   * RmsSecurityDeposit.addOnDepositCentavos' own doc comment. `null`/`undefined` means GearBnB
   * staff haven't decided yet (still "To Be Determined"); `0` means staff decided no additional
   * deposit is needed. Never computed on this site. */
  addOnDepositCentavos?: number | null;
  /**
   * True for a Build Your Own booking (no package line item) — the RMS always creates these with
   * depositCentavos = 0 until an admin manually determines the real amount; a package's deposit,
   * by contrast, is a real configured value known from booking creation, even in the rare case
   * it's genuinely ₱0. `verified` alone can't tell these apart: the RMS computes
   * `verified = paidDepositCentavos >= requiredCentavos`, which is trivially true at 0 >= 0 even
   * though nothing has actually been reviewed or paid. This flag is what lets that be caught.
   */
  isByoBooking: boolean;
  /**
   * True for a package booking that also has one or more add-ons attached — never true for a BYO
   * booking (that already has its own separate "To Be Determined" story via isByoBooking above).
   * The RMS never auto-computes an add-on's own deposit; a GearBnB staff member reviews the
   * specific add-ons and decides whether anything beyond the package's own deposit is needed. This
   * flag only controls whether that possibility is explained on screen — `requiredCentavos` above
   * is always shown exactly as the RMS returns it, whether that's still just the package's own
   * configured amount or one staff already increased after review; nothing here recalculates or
   * stores a second deposit figure.
   */
  hasPackageAddOns: boolean;
  /** Called after the proof is uploaded and accepted by GearBnB for review — lets the parent
   * optimistically flip its local status to "pending" without a full refetch. */
  onProofSubmitted?: () => void;
  /** True once the parent booking has reached a terminal status (COMPLETED/CANCELLED) — suppresses
   * the interactive upload form (amount/method/reference fields, dropzone, submit button, and the
   * shortfall resubmission guidance) while still showing whatever historical status this deposit's
   * proof already reached (Approved/Pending Review/Rejected/To Be Determined), since a terminal
   * booking is read-only going forward but its history must stay visible. Defaults to false so
   * every existing caller keeps its exact current behavior. */
  readOnly?: boolean;
}

export default function DepositProofUpload({
  bookingId,
  requiredCentavos,
  verifiedCentavos,
  verified,
  proofStatus,
  reviewNote,
  amountClaimedCentavos,
  addOnDepositCentavos,
  isByoBooking,
  hasPackageAddOns,
  onProofSubmitted,
  readOnly = false,
}: DepositProofUploadProps) {
  const { user } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [amountPaid, setAmountPaid] = useState('0.00');
  const [methodId, setMethodId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const methodSelectId = useId();
  const amountFieldId = useId();
  const referenceFieldId = useId();

  const objectUrlRef = useRef<string | null>(null);

  // Build Your Own bookings start at ₱0 until an admin manually sets the real deposit after
  // review — ₱0 here never means "no deposit required." Checked before `isApproved` so the RMS's
  // own `verified = paidDepositCentavos >= requiredCentavos` (trivially true at 0 >= 0, even
  // though nothing has actually been reviewed) can never masquerade as a real approval. A
  // package's deposit is a real configured value from booking creation, so this never applies to
  // one even in the rare case it's genuinely ₱0 — that keeps showing whatever verified/paid state
  // the RMS reports, unchanged.
  const isNotYetDetermined = isByoBooking && requiredCentavos <= 0 && proofStatus === null;
  const isApproved = !isNotYetDetermined && (verified || proofStatus === 'APPROVED');
  const isPending = !isApproved && proofStatus === 'PENDING_REVIEW';
  const isRejected = !isApproved && !isPending && proofStatus === 'REJECTED';
  // Same "genuinely short, not some other rejection reason" gate RejectedNotice uses internally —
  // computed here too so the upload form above it can show the same "total, not top-up" reminder
  // before the customer even opens the file picker.
  const isRejectedForShortfall =
    isRejected && amountClaimedCentavos !== null && requiredCentavos - amountClaimedCentavos > 0;
  // readOnly never changes isApproved/isPending/isRejected/isNotYetDetermined above — those still
  // reflect this proof's real historical status and keep rendering their own read-only notice
  // (ApprovedStatus/PendingStatus/NotYetDeterminedStatus/RejectedNotice below) exactly as before.
  // It only suppresses the interactive form beneath them, since no new submission is ever possible
  // once the parent booking is terminal.
  // A package whose configured deposit is genuinely ₱0 (never a BYO booking — its ₱0 means "not yet
  // determined," handled above). The RMS treats it as already satisfied (approveBooking: 0 paid >=
  // 0 required reserves the booking directly), though its own `verified` flag stays false for
  // `requiredCentavos <= 0` — so without this the form would ask for proof of a ₱0 payment.
  const isNoDepositRequired = !isByoBooking && requiredCentavos <= 0 && proofStatus === null;
  const showUploadForm = !isApproved && !isPending && !isNotYetDetermined && !isNoDepositRequired && !readOnly;

  function resetSelection() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setSelectedFile(null);
    setPreviewUrl(null);
  }

  function handleFileSelect(file: File) {
    setSubmitError(null);

    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setFileError('Please upload a JPEG, PNG, WebP, or PDF file.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError('File must be smaller than 10MB.');
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    const nextPreview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    if (nextPreview) objectUrlRef.current = nextPreview;

    setSelectedFile(file);
    setPreviewUrl(nextPreview);
    setFileError(null);
  }

  function handleRemove() {
    resetSelection();
    setFileError(null);
    setSubmitError(null);
  }

  async function handleSubmit() {
    if (!selectedFile || submitting) return;

    if (!user) {
      setSubmitError('Please log in before uploading your payment proof.');
      return;
    }

    setDetailsError(null);
    setSubmitError(null);

    // The RMS records what the customer says they paid and how — required so staff can match the
    // proof against the actual receipt during review. This is never trusted as the verified
    // amount; only an admin-confirmed review creates the real ledgered payment.
    const amountCentavos = centavosFromPesosInput(amountPaid);
    if (amountCentavos === null) {
      setDetailsError('Enter the amount you paid.');
      return;
    }
    const selectedMethod = PAYMENT_METHODS.find((m) => m.id === methodId);
    if (!selectedMethod) {
      setDetailsError('Select which payment method you used.');
      return;
    }

    setSubmitting(true);

    // Ownership convention matches VerificationUpload: the path is always prefixed with the
    // authenticated customer's own id, matching the private bucket's folder-scoped RLS policy.
    // This is UX-only — the bucket's own RLS is the real security boundary, not this prefix.
    const path = `${user.id}/${bookingId}-${Date.now()}-${sanitizeFileName(selectedFile.name)}`;

    // See ensureFreshSession's own comment — a session gone stale while filling out the amount/
    // method fields above would otherwise fail this upload silently.
    await ensureFreshSession();
    const { error: uploadError } = await supabase.storage.from(PAYMENT_PROOF_BUCKET).upload(path, selectedFile);

    if (uploadError) {
      setSubmitting(false);
      setSubmitError(`Upload failed, ${uploadError.message}`);
      return;
    }

    try {
      // Only the storage path (plus the claimed amount/method) is sent onward — the raw file
      // never goes through the booking API.
      await submitDepositProof(bookingId, {
        storagePath: path,
        amountClaimedCentavos: amountCentavos,
        method: selectedMethod.rmsMethod,
        referenceNumber: referenceNumber.trim() || undefined,
      });
      resetSelection();
      setAmountPaid('0.00');
      setMethodId('');
      setReferenceNumber('');
      onProofSubmitted?.();
    } catch (err) {
      setSubmitError(
        err instanceof RmsApiError ? err.message : 'Could not submit your payment proof. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Security Deposit</h3>
        <p className={isNotYetDetermined ? 'text-xl font-bold text-ink' : 'text-2xl font-bold text-ink'}>
          {isNotYetDetermined ? 'To Be Determined' : formatCurrency(requiredCentavos / 100)}
        </p>
        {/* Clarifies what this figure actually is once add-ons are in the picture — never shown
            for a plain package booking (existing single-deposit presentation stays untouched) or
            a BYO booking (isNotYetDetermined already covers that story on its own). */}
        {hasPackageAddOns && !isNotYetDetermined && (
          <p className="text-xs text-ink-faint">Package security deposit</p>
        )}
      </div>

      {isApproved && <ApprovedStatus verifiedCentavos={verifiedCentavos} settled={!verified && verifiedCentavos <= 0} />}
      {isNoDepositRequired && <NoDepositRequiredStatus />}
      {isPending && (
        <PendingStatus requiredCentavos={requiredCentavos} amountClaimedCentavos={amountClaimedCentavos} />
      )}
      {isNotYetDetermined && <NotYetDeterminedStatus />}
      {/* Independent of proof/verification status above — staff can decide an add-on needs its
          own deposit at any point up to pickup, not only before the customer's first payment.
          Three states, matching addOnDepositCentavos exactly: null/undefined (staff haven't
          decided — still the pending notice), 0 (staff decided nothing extra is needed — nothing
          rendered, never a pointless "₱0" line), positive (the real breakdown, replacing the
          pending notice now that it's no longer pending). */}
      {hasPackageAddOns &&
        (addOnDepositCentavos == null ? (
          <AddOnDepositPendingNotice />
        ) : (
          addOnDepositCentavos > 0 && (
            <AddOnDepositDeterminedNotice
              baseCentavos={Math.max(0, requiredCentavos - addOnDepositCentavos)}
              addOnCentavos={addOnDepositCentavos}
              totalCentavos={requiredCentavos}
            />
          )
        ))}

      {/* Shown whenever the proof was actually rejected, regardless of readOnly — this is
          historical fact about what happened to it, not an action, and must stay visible even once
          the booking is terminal and no resubmission is offered anymore (see showUploadForm). */}
      {isRejected && (
        <RejectedNotice
          reviewNote={reviewNote}
          requiredCentavos={requiredCentavos}
          amountClaimedCentavos={amountClaimedCentavos}
        />
      )}

      {showUploadForm && (
        <>
          {/* Only for a genuine shortfall — a proof rejected for an unrelated reason (unclear
           * receipt, wrong reference) has no "total vs top-up" distinction to clarify, and
           * repeating "required: X, show the full X" here would misstate why it was rejected. */}
          {isRejected && isRejectedForShortfall && <ResubmissionGuidance requiredCentavos={requiredCentavos} />}

          <PaymentInstructionsSection
            additionalNote={
              hasPackageAddOns
                ? 'Your final security deposit will be confirmed after GearBnB staff reviews your booking and selected add-ons.'
                : undefined
            }
          />

          <div className="flex flex-col gap-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <label htmlFor={amountFieldId} className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Amount Paid</span>
                <input
                  id={amountFieldId}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  disabled={submitting}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="0.00"
                  className="rounded-lg border border-line px-3 py-2.5 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
                />
                <span className="text-xs text-ink-faint">
                  {isRejectedForShortfall
                    ? `Enter the full ${formatCurrency(requiredCentavos / 100)} security deposit paid so far, not just the new top-up payment.`
                    : 'Enter the total security deposit amount you’ve paid so far.'}
                </span>
              </label>

              <label htmlFor={methodSelectId} className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Payment Method Used</span>
                <select
                  id={methodSelectId}
                  disabled={submitting}
                  value={methodId}
                  onChange={(e) => setMethodId(e.target.value)}
                  className="rounded-lg border border-line px-3 py-2.5 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
                >
                  <option value="" disabled>
                    Select a method
                  </option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="sm:col-span-2">
                <label htmlFor={referenceFieldId} className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink">Reference Number (optional)</span>
                  <input
                    id={referenceFieldId}
                    type="text"
                    disabled={submitting}
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Transaction/reference number from your receipt"
                    className="rounded-lg border border-line px-3 py-2.5 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
                  />
                </label>
              </div>
            </div>

            {detailsError && (
              <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
                {detailsError}
              </p>
            )}

            <ProofDropzone
              file={selectedFile}
              previewUrl={previewUrl}
              error={fileError}
              disabled={submitting}
              onSelect={handleFileSelect}
              onRemove={handleRemove}
            />

            {submitError && (
              <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
                {submitError}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedFile || submitting}
              aria-busy={submitting}
              className="w-full rounded-lg bg-brand-forest px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:cursor-not-allowed disabled:bg-surface-strong"
            >
              {submitting ? 'Submitting…' : isRejected ? 'Upload New Proof' : 'Submit Proof of Payment'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
