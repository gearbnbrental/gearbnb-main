import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabase';
import { formatCurrency } from '../../utils/format';
import { PAYMENT_METHODS } from '../../config/paymentMethods';
import { PaymentInstructionsSection } from './DepositProofUpload';
import {
  PAYMENT_PROOF_BUCKET,
  describeRmsError,
  ensureFreshSession,
  submitAdditionalChargeProof,
  type RmsAdditionalCharge,
} from '../../utils/rmsApi';

/**
 * The Additional Charge payment-proof workflow's own focused dialog — structurally the same
 * upload → Pending Review → admin-reviewed → Paid flow as DepositProofUpload/RentalFeeProofUpload
 * (same private "payment-proofs" bucket, same ProofDropzone/PaymentInstructionsSection pieces),
 * but deliberately a modal rather than an inline card (see MyBookings.tsx's own call site) and
 * deliberately non-editable on amount: unlike the deposit/rental fee, where the customer states
 * what they actually paid (a partial or over-payment is a normal thing to report), this charge's
 * `amountCentavos` is RMS's own already-settled "what remains payable" figure — see
 * ReturnSettlementPanel's own doc comment on why that number is never the raw issue amount. There
 * is no input the customer could type a different figure into; the amount shown is exactly what
 * gets sent as `amountClaimedCentavos`.
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

function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
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
            <p className="text-[11px] text-ink-faint">JPEG, PNG, WebP, or PDF — up to 10MB</p>
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

export interface AdditionalChargeProofDialogProps {
  bookingId: string;
  charge: RmsAdditionalCharge;
  onClose: () => void;
  /** Called once RMS has actually accepted the proof for review — lets the parent optimistically
   *  flip this one charge's local paymentProof.status to "pending" without a full refetch. The
   *  dialog closes itself right after via onClose; this never implies the charge is paid. */
  onProofSubmitted: () => void;
}

export default function AdditionalChargeProofDialog({
  bookingId,
  charge,
  onClose,
  onProofSubmitted,
}: AdditionalChargeProofDialogProps) {
  const { user } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [methodId, setMethodId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const methodSelectId = useId();
  const referenceFieldId = useId();

  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [submitting, onClose]);

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

    const selectedMethod = PAYMENT_METHODS.find((m) => m.id === methodId);
    if (!selectedMethod) {
      setDetailsError('Select which payment method you used.');
      return;
    }

    // The amount is never read from an input — it is always this specific charge's own
    // authoritative amountCentavos, exactly as RMS returned it (see this file's own doc comment).
    const amountCentavos = centavosFromPesosInput(String(charge.amountCentavos / 100));
    if (amountCentavos === null) return;

    setSubmitting(true);

    // Ownership-prefix convention matches DepositProofUpload/RentalFeeProofUpload/
    // VerificationUpload exactly — generated here, never typed by the customer; the bucket's own
    // RLS (keyed on this same prefix) is the real security boundary, this is UX-only. RMS
    // performs its own authoritative ownership check on top of that when the proof is submitted.
    const path = `${user.id}/${bookingId}-charge-${charge.id}-${Date.now()}-${sanitizeFileName(selectedFile.name)}`;

    // See ensureFreshSession's own comment — a session gone stale while filling out this form
    // would otherwise fail the upload silently.
    await ensureFreshSession();
    const { error: uploadError } = await supabase.storage.from(PAYMENT_PROOF_BUCKET).upload(path, selectedFile);

    if (uploadError) {
      setSubmitting(false);
      setSubmitError(`Upload failed — ${uploadError.message}`);
      return;
    }

    try {
      // Only the storage path (plus the charge's own fixed amount/method) is sent onward — the
      // raw file never goes through the booking API, and no customerId/userId is ever sent: RMS
      // derives the customer from this same authenticated request's bearer token.
      await submitAdditionalChargeProof(bookingId, {
        additionalChargeId: charge.id,
        storagePath: path,
        amountClaimedCentavos: amountCentavos,
        // additionalChargeRmsMethod, not rmsMethod — this endpoint has a real, dedicated
        // MARIBANK value on the RMS side that the Security Deposit/Rental Fee endpoints don't;
        // see paymentMethods.ts's own doc comment on the two fields. Falls back to rmsMethod for
        // any method (GCash) that has no purpose-specific override.
        method: selectedMethod.additionalChargeRmsMethod ?? selectedMethod.rmsMethod,
        referenceNumber: referenceNumber.trim() || undefined,
      });
      resetSelection();
      onProofSubmitted();
      onClose();
    } catch (err) {
      // Never closes the dialog and never calls onProofSubmitted on failure — a rejected/failed
      // request must not be able to make the charge look like it's under review when it isn't.
      // describeRmsError surfaces RMS's own customer-safe validation/authorization message (e.g.
      // "charge is no longer pending", "proof already under review") rather than a generic string.
      setSubmitError(describeRmsError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={() => !submitting && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="additional-charge-proof-title"
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-surface p-5 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="additional-charge-proof-title" className="text-lg font-semibold text-ink">
            Additional Charge
          </h2>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            aria-label="Close"
            className="rounded-full p-1 text-ink-muted hover:bg-surface-muted hover:text-ink disabled:cursor-not-allowed"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <dl className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface-muted p-3.5 text-sm">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-ink-muted">Reason</dt>
            <dd className="text-right font-medium text-ink">{charge.reason}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted">Amount Due</dt>
            {/* Never an input — see this file's own doc comment on why this figure can't be
                edited: it's RMS's own already-settled amount, not something the customer reports. */}
            <dd className="text-base font-bold text-ink">{formatCurrency(charge.amountCentavos / 100)}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-3">
          <PaymentInstructionsSection purpose="additional charge" />

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
              {/* PAYMENT_METHODS already only lists GCash and MariBank — no Cash/Maya/Bank
                  Transfer/Card/Other entries exist in that config, so no filtering is needed here
                  to satisfy the GCash/Maribank-only requirement for this charge type. */}
              {PAYMENT_METHODS.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </select>
          </label>

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
            {submitting ? 'Submitting…' : 'Submit Proof of Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
