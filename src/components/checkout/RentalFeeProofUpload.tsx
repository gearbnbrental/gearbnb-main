import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabase';
import { formatCurrency } from '../../utils/format';
import { PAYMENT_METHODS } from '../../config/paymentMethods';
import { PaymentInstructionsSection } from './DepositProofUpload';
import {
  PAYMENT_PROOF_BUCKET,
  RmsApiError,
  ensureFreshSession,
  submitRentalFeeProof,
  type DepositProofStatus,
} from '../../utils/rmsApi';

/**
 * The rental fee's own cashless-payment + proof-upload workflow — separate from, and structurally
 * parallel to, DepositProofUpload (same private "payment-proofs" bucket, same submit → Pending
 * Review → admin-reviewed → Paid flow), but deliberately simpler: unlike the security deposit,
 * the rental fee has a genuine partially-paid state (RmsRentalFee.status), so there is no "must
 * claim the full amount or be treated as short" rule here — a partial cashless payment alongside
 * cash at pickup is expected, not an error. Reuses PaymentInstructionsSection (same real GCash/
 * MariBank QR instructions the deposit flow already shows) rather than inventing new payment
 * details.
 */

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

function PaidStatus({ paidCentavos }: { paidCentavos: number }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand-forest/30 bg-brand-forest/10 p-4">
      <CheckCircleIcon className="h-5 w-5 shrink-0 text-accent" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-accent">Rental Fee Paid ✓</p>
        <p className="text-sm text-ink-muted">
          Amount paid: <span className="font-medium text-ink">{formatCurrency(paidCentavos / 100)}</span>
        </p>
      </div>
    </div>
  );
}

function PendingStatus({ amountClaimedCentavos }: { amountClaimedCentavos: number | null }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-400/30 dark:bg-amber-400/10">
      <ClockIcon className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Payment Proof Under Review</p>
        <p className="text-sm text-amber-800/80 dark:text-amber-300/80">
          Your rental fee payment proof is currently being reviewed by GearBnB.
          {amountClaimedCentavos !== null && ` Submitted amount: ${formatCurrency(amountClaimedCentavos / 100)}.`}
        </p>
      </div>
    </div>
  );
}

function RejectedNotice({ reviewNote }: { reviewNote: string | null }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
      <AlertIcon className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">Payment Proof Rejected</p>
          <p className="text-sm text-red-700/90 dark:text-red-400/90">
            Please submit a new proof of payment.
          </p>
        </div>
        {reviewNote && <p className="text-sm text-red-700/90 dark:text-red-400/90">{reviewNote}</p>}
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
          // Same reasoning as DepositProofUpload/VerificationUpload's own dropzones: drag-and-drop
          // is a desktop-only affordance, so the full h-32 it needs there is unused height on a
          // phone.
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

export interface RentalFeeProofUploadProps {
  /** RMS booking id the proof is submitted against. */
  bookingId: string;
  /** True once the RMS's own derived payment status is PAID. */
  isPaid: boolean;
  paidCentavos: number;
  proofStatus: DepositProofStatus;
  reviewNote: string | null;
  amountClaimedCentavos: number | null;
  /** Called after the proof is uploaded and accepted by GearBnB for review — lets the parent
   * optimistically flip its local status to "pending" without a full refetch. */
  onProofSubmitted?: () => void;
  /** True once the parent booking has reached a terminal status (COMPLETED/CANCELLED) — suppresses
   * the interactive upload form while still showing whatever historical status this rental fee's
   * proof already reached (Paid/Pending Review/Rejected), since a terminal booking is read-only
   * going forward but its history must stay visible. Defaults to false so every existing caller
   * keeps its exact current behavior. */
  readOnly?: boolean;
}

export default function RentalFeeProofUpload({
  bookingId,
  isPaid,
  paidCentavos,
  proofStatus,
  reviewNote,
  amountClaimedCentavos,
  onProofSubmitted,
  readOnly = false,
}: RentalFeeProofUploadProps) {
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

  const isPending = !isPaid && proofStatus === 'PENDING_REVIEW';
  const isRejected = !isPaid && !isPending && proofStatus === 'REJECTED';
  // readOnly never changes isPaid/isPending/isRejected above — those keep rendering their own
  // read-only notice (PaidStatus/PendingStatus/RejectedNotice below) exactly as before. It only
  // suppresses the interactive form beneath them, since no new submission is ever possible once
  // the parent booking is terminal.
  const showUploadForm = !isPaid && !isPending && !readOnly;

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

    // Same ownership-prefix convention as DepositProofUpload/VerificationUpload — the bucket's own
    // RLS is the real security boundary, this prefix is UX-only.
    const path = `${user.id}/${bookingId}-rentalfee-${Date.now()}-${sanitizeFileName(selectedFile.name)}`;

    await ensureFreshSession();
    const { error: uploadError } = await supabase.storage.from(PAYMENT_PROOF_BUCKET).upload(path, selectedFile);

    if (uploadError) {
      setSubmitting(false);
      setSubmitError(`Upload failed, ${uploadError.message}`);
      return;
    }

    try {
      await submitRentalFeeProof(bookingId, {
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
    <div className="flex flex-col gap-4">
      {isPaid && <PaidStatus paidCentavos={paidCentavos} />}
      {isPending && <PendingStatus amountClaimedCentavos={amountClaimedCentavos} />}
      {/* Shown regardless of readOnly — historical fact about what happened to this proof, not an
          action; must stay visible even once the booking is terminal and no resubmission is
          offered anymore (see showUploadForm). */}
      {isRejected && <RejectedNotice reviewNote={reviewNote} />}

      {showUploadForm && (
        <>
          <PaymentInstructionsSection purpose="rental fee" />

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
                  // Always 0.00 — never the outstanding balance. Both the initial value and this
                  // placeholder must stay neutral: the customer enters what they ACTUALLY paid
                  // (a partial payment is normal), and pre-suggesting the full amount invites a
                  // claim that doesn't match their receipt. Admin review remains the authority on
                  // what was really paid regardless of what is typed here.
                  placeholder="0.00"
                  className="rounded-lg border border-line px-3 py-2.5 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
                />
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
              {submitting ? 'Submitting…' : isRejected ? 'Upload New Proof' : 'Make Your Payment'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
