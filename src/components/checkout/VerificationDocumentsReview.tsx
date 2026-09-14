import { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabase';
import {
  RmsApiError,
  VERIFICATION_BUCKET,
  VERIFICATION_KIND_MAP,
  ensureFreshSession,
  resubmitVerificationDocument,
  type RmsVerificationDocument,
  type RmsVerificationDocumentKind,
  type VerificationDocumentReviewStatus,
} from '../../utils/rmsApi';
import {
  DOCUMENT_SLOTS,
  DocumentDropzone,
  MAX_FILE_SIZE_BYTES,
  isAcceptedFileType,
  sanitizeFileName,
  wrongFileTypeMessage,
} from './VerificationUpload';

const STATUS_LABELS: Record<VerificationDocumentReviewStatus, string> = {
  PENDING_REVIEW: 'Pending Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CORRECTION_REQUIRED: 'Correction Required',
};

const STATUS_BADGE_STYLES: Record<VerificationDocumentReviewStatus, string> = {
  PENDING_REVIEW: 'bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300',
  APPROVED: 'bg-brand-forest/10 text-accent',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  CORRECTION_REQUIRED: 'bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300',
};

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

interface DocumentReviewRowProps {
  bookingId: string;
  title: string;
  document: RmsVerificationDocument;
  onResubmitted: (kind: RmsVerificationDocumentKind) => void;
}

/** One verification-document slot on the My Bookings page. Read-only status display for
 * APPROVED/PENDING_REVIEW/REJECTED; a single-file replace form only when CORRECTION_REQUIRED —
 * mirroring the RMS's own rule that only that status is customer-resubmittable (see
 * resubmitVerificationDocument in the RMS's src/server/bookings/service.ts). REJECTED
 * deliberately gets no action here: the RMS has no customer resubmission path for it. */
function DocumentReviewRow({ bookingId, title, document, onResubmitted }: DocumentReviewRowProps) {
  const { user } = useAuth();
  const slot = DOCUMENT_SLOTS.find((s) => VERIFICATION_KIND_MAP[s.key] === document.kind);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justResubmitted, setJustResubmitted] = useState(false);

  const objectUrlRef = useRef<string | null>(null);
  // Bumped on every remove/replace so a slower upload that finishes after the customer already
  // removed or swapped the file can recognize it's stale and discard its own result — same
  // pattern as VerificationUpload's per-slot generation guard.
  const generationRef = useRef(0);

  function resetSelection() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setFile(null);
    setPreviewUrl(null);
    setStoragePath(null);
  }

  async function handleSelect(selected: File) {
    if (!slot) return;

    if (!isAcceptedFileType(selected, slot.accept)) {
      setFileError(wrongFileTypeMessage(slot.expectedKind));
      return;
    }
    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setFileError('File must be smaller than 8MB.');
      return;
    }
    if (!user) {
      setFileError('Please log in before uploading verification documents.');
      return;
    }

    setSubmitError(null);
    setJustResubmitted(false);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    const nextPreview = URL.createObjectURL(selected);
    objectUrlRef.current = nextPreview;

    setFile(selected);
    setPreviewUrl(nextPreview);
    setFileError(null);
    setStoragePath(null);
    setUploading(true);

    const generation = ++generationRef.current;
    // Same ownership-path convention as the original upload and the deposit-proof flow — the
    // RMS's isOwnedStoragePath check requires the first path segment to equal the authenticated
    // user's own id.
    const path = `${user.id}/${VERIFICATION_KIND_MAP[slot.key]}-${Date.now()}-${sanitizeFileName(selected.name)}`;

    // See ensureFreshSession's own comment — a session gone stale while this document sat
    // uncorrected would otherwise fail this upload silently.
    await ensureFreshSession();
    if (generationRef.current !== generation) return; // a remove/replace happened while refreshing

    const { error: uploadError } = await supabase.storage.from(VERIFICATION_BUCKET).upload(path, selected);

    if (generationRef.current !== generation) return; // a remove/replace happened meanwhile

    setUploading(false);
    if (uploadError) {
      setFileError(`Upload failed — ${uploadError.message}`);
      return;
    }
    setStoragePath(path);
  }

  function handleRemove() {
    generationRef.current += 1;
    resetSelection();
    setFileError(null);
  }

  async function handleReplace() {
    if (!storagePath || uploading || submitting || !slot) return;
    if (!user) {
      setSubmitError('Please log in before uploading verification documents.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await resubmitVerificationDocument(bookingId, { kind: document.kind, storagePath });
      resetSelection();
      setJustResubmitted(true);
      onResubmitted(document.kind);
    } catch (err) {
      setSubmitError(
        err instanceof RmsApiError ? err.message : "We couldn't upload your document. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const isCorrectionRequired = document.status === 'CORRECTION_REQUIRED';

  return (
    <div className="flex flex-col gap-2 border-t border-line-soft pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">{title}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE_STYLES[document.status]}`}>
          {STATUS_LABELS[document.status]}
        </span>
      </div>

      {justResubmitted && document.status === 'PENDING_REVIEW' && (
        <div className="flex items-start gap-2 rounded-lg bg-brand-forest/10 p-3">
          <CheckCircleIcon className="h-4 w-4 shrink-0 text-accent" />
          <p className="text-xs text-accent">
            Document resubmitted successfully. It is now pending review.
          </p>
        </div>
      )}

      {!isCorrectionRequired && document.reviewNote && (
        <p className="text-sm text-ink-muted">{document.reviewNote}</p>
      )}

      {isCorrectionRequired && slot && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/30 dark:bg-amber-400/10">
            <AlertIcon className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              {document.reviewNote || 'Please review and resubmit this document.'}
            </p>
          </div>

          <DocumentDropzone
            config={slot}
            file={file}
            previewUrl={previewUrl}
            error={fileError}
            uploading={uploading}
            uploaded={Boolean(storagePath)}
            onSelect={handleSelect}
            onRemove={handleRemove}
            hideTitle
          />

          {submitError && (
            <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
              {submitError}
            </p>
          )}

          <button
            type="button"
            onClick={handleReplace}
            disabled={!storagePath || uploading || submitting}
            aria-busy={submitting}
            className="w-full rounded-lg bg-brand-forest px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:cursor-not-allowed disabled:bg-surface-strong"
          >
            {submitting ? 'Replacing…' : uploading ? 'Uploading document…' : 'Replace Document'}
          </button>
        </div>
      )}
    </div>
  );
}

export interface VerificationDocumentsReviewProps {
  bookingId: string;
  documents: RmsVerificationDocument[];
  /** Called with the resubmitted document's kind after a successful replace, so the parent can
   * optimistically flip that one document back to PENDING_REVIEW in its local state — the same
   * pattern DepositProofUpload's onProofSubmitted already uses for the security deposit. */
  onResubmitted: (kind: RmsVerificationDocumentKind) => void;
}

/** The My Bookings "Verification Documents" section — one row per document the customer has
 * actually submitted (see RmsMyBooking.verificationDocuments; empty for a booking that predates
 * or never went through the customer-portal verification flow, in which case this renders
 * nothing). Title/order follows DOCUMENT_SLOTS, the same four slots as the original checkout
 * upload, so labels can never drift between the two flows. Collapses to a one-line "all approved"
 * summary once nothing needs the customer's attention — expandable on demand — rather than always
 * showing all four rows, which only matters while something is still pending or needs a fix. */
export default function VerificationDocumentsReview({
  bookingId,
  documents,
  onResubmitted,
}: VerificationDocumentsReviewProps) {
  const [expanded, setExpanded] = useState(false);

  if (documents.length === 0) return null;

  const rows = DOCUMENT_SLOTS.map((slot) => ({
    slot,
    document: documents.find((d) => d.kind === VERIFICATION_KIND_MAP[slot.key]),
  })).filter((row): row is { slot: (typeof DOCUMENT_SLOTS)[number]; document: RmsVerificationDocument } =>
    Boolean(row.document),
  );

  if (rows.length === 0) return null;

  const allApproved = rows.every(({ document }) => document.status === 'APPROVED');

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Verification Documents</h3>
        {allApproved && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-xs font-medium text-accent hover:underline"
          >
            {expanded ? 'Hide' : 'View'}
          </button>
        )}
      </div>

      {allApproved && !expanded ? (
        <div className="flex items-center gap-2 text-sm text-accent">
          <CheckCircleIcon className="h-4 w-4 shrink-0" />
          <span>All {rows.length} documents approved</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map(({ slot, document }) => (
            <DocumentReviewRow
              key={slot.key}
              bookingId={bookingId}
              title={slot.title}
              document={document}
              onResubmitted={onResubmitted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
