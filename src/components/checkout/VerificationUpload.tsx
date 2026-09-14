import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import { useAuth } from '../../context/AuthContext';
import { REQUIRED_VERIFICATION_DOCUMENTS, filterCartToSelection, useRental } from '../../context/RentalContext';
import { supabase } from '../../supabase';
import type { VerificationDocs, VerificationDocumentKey } from '../../types/gearbnb';
import { BYO_RENTAL_AGREEMENT_URL, TERMS_AND_CONDITIONS_URL } from '../../config/legalDocuments';
import { VERIFICATION_BUCKET, VERIFICATION_KIND_MAP, ensureFreshSession } from '../../utils/rmsApi';

type DocumentKey = VerificationDocumentKey;
export type ExpectedKind = 'image' | 'video' | 'document';

export interface DocumentSlotConfig {
  key: DocumentKey;
  title: string;
  helperText: string;
  accept: string;
  expectedKind: ExpectedKind;
}

/** Exported so the post-submission resubmission flow (a document under
 *  CORRECTION_REQUIRED, reviewed on the My Bookings page) shows the exact
 *  same four slots/labels/accept-types as the original upload here, instead
 *  of a second, potentially-drifting copy of this config. */
export const DOCUMENT_SLOTS: DocumentSlotConfig[] = [
  {
    key: 'idType1',
    title: 'Government ID #1',
    helperText: "Driver's License, Passport, UMID, or similar",
    accept: 'image/*',
    expectedKind: 'image',
  },
  {
    key: 'idType2',
    title: 'Government ID #2',
    helperText: 'A second, different valid government ID',
    accept: 'image/*',
    expectedKind: 'image',
  },
  {
    key: 'verificationVideo',
    title: 'Video Verification',
    helperText:
      'Record a short video holding your valid government ID, give a thumbs-up, and clearly state your full name.',
    accept: 'video/mp4,video/webm,video/quicktime,.mov',
    expectedKind: 'video',
  },
  {
    key: 'proofOfBilling',
    title: 'Proof of Billing',
    helperText: 'Accepted: Electricity bill, Rent Agreement, Water bill, or Parcel.',
    accept: 'image/*,application/pdf',
    expectedKind: 'document',
  },
];

export const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

type DocumentFiles = Record<DocumentKey, File | null>;
type DocumentPreviews = Record<DocumentKey, string | null>;
type DocumentErrors = Record<DocumentKey, string | null>;
type DocumentUploading = Record<DocumentKey, boolean>;

const EMPTY_FILES: DocumentFiles = {
  idType1: null,
  idType2: null,
  verificationVideo: null,
  proofOfBilling: null,
};

const EMPTY_PREVIEWS: DocumentPreviews = {
  idType1: null,
  idType2: null,
  verificationVideo: null,
  proofOfBilling: null,
};

const EMPTY_ERRORS: DocumentErrors = {
  idType1: null,
  idType2: null,
  verificationVideo: null,
  proofOfBilling: null,
};

const EMPTY_UPLOADING: DocumentUploading = {
  idType1: false,
  idType2: false,
  verificationVideo: false,
  proofOfBilling: false,
};

export function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.-]/g, '_');
}

export function isAcceptedFileType(file: File, accept: string): boolean {
  return accept
    .split(',')
    .map((pattern) => pattern.trim())
    .some((pattern) => {
      if (pattern.startsWith('.')) return file.name.toLowerCase().endsWith(pattern.toLowerCase());
      return pattern.endsWith('/*') ? file.type.startsWith(pattern.slice(0, -1)) : file.type === pattern;
    });
}

export function wrongFileTypeMessage(expectedKind: ExpectedKind): string {
  switch (expectedKind) {
    case 'video':
      return 'Please upload a video file (MP4, WebM, or MOV) — a photo won\'t work here.';
    case 'image':
      return 'Please upload an image file.';
    default:
      return 'Unsupported file type.';
  }
}

export function formatFileSize(bytes: number): string {
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

function DocumentPreviewIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25M9 12.75h6M9 15.75h4.5M8.25 3.75h4.836a1.125 1.125 0 0 1 .795.33l5.69 5.69a1.125 1.125 0 0 1 .329.795V19.5A2.25 2.25 0 0 1 17.625 21.75H8.25A2.25 2.25 0 0 1 6 19.5V6A2.25 2.25 0 0 1 8.25 3.75Z"
      />
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

interface TextFieldProps {
  label: string;
  type?: string;
  value: string;
  placeholder?: string;
  autoComplete?: string;
  onChange: (value: string) => void;
}

/** The red required marker. Every field it appears on is genuinely gated by this form's own
 *  `canSubmit` check — it is never decorative. `aria-hidden` because the input already carries
 *  `required`, which is what a screen reader announces; the asterisk is the visual half of that
 *  same fact, and announcing "star" alongside it would just be noise. */
function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-red-600 dark:text-red-400">
      {' '}
      *
    </span>
  );
}

function TextField({ label, type = 'text', value, placeholder, autoComplete, onChange }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">
        {label}
        <RequiredMark />
      </span>
      <input
        type={type}
        required
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-line px-3 py-2.5 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
      />
    </label>
  );
}

export interface DocumentDropzoneProps {
  config: DocumentSlotConfig;
  file: File | null;
  previewUrl: string | null;
  error: string | null;
  uploading: boolean;
  uploaded: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
  /** True when the caller already renders config.title elsewhere (e.g. VerificationDocumentsReview's
   * own row header, which needs the title next to a status badge regardless of whether this
   * dropzone is shown) — omits this component's own title line so it doesn't appear twice. */
  hideTitle?: boolean;
}

/** Exported so the post-submission resubmission flow (see
 *  VerificationDocumentsReview.tsx) renders the identical dropzone UI for
 *  replacing a single CORRECTION_REQUIRED document, instead of a second,
 *  visually-diverging copy of this control. */
export function DocumentDropzone({ config, file, previewUrl, error, uploading, uploaded, onSelect, onRemove, hideTitle }: DocumentDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputId = `doc-upload-${config.key}`;
  const hasFile = file !== null;
  const isImagePreview = hasFile && file.type.startsWith('image/');
  const isVideoPreview = hasFile && file.type.startsWith('video/');

  function handleFiles(fileList: FileList | null) {
    const selected = fileList?.[0];
    if (selected) onSelect(selected);
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragActive(false);
    if (uploading) return;
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {!hideTitle && (
        <span className="text-sm font-medium text-ink">
          {config.title}
          {/* Every slot rendered here comes from REQUIRED_VERIFICATION_DOCUMENTS, all of which
              must be uploaded before this form can be submitted — so the marker is accurate for
              each one, not blanket-applied. */}
          <RequiredMark />
        </span>
      )}

      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
        className={[
          'relative flex h-36 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-3 text-center transition-colors',
          uploading ? 'cursor-wait' : 'cursor-pointer',
          error
            ? 'border-red-400 bg-red-50 dark:border-red-500 dark:bg-red-500/10'
            : uploaded
              ? 'border-brand-forest bg-brand-forest/10'
              : isDragActive
                ? 'border-brand-forest/70 bg-brand-forest/5'
                : 'border-line bg-surface-muted hover:border-brand-forest/70 hover:bg-brand-forest/5',
        ].join(' ')}
      >
        <input
          id={inputId}
          type="file"
          accept={config.accept}
          disabled={uploading}
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
        />

        {hasFile && !uploading && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onRemove();
            }}
            aria-label={`Remove ${config.title}`}
            className="absolute right-2 top-2 rounded-full bg-surface p-1 text-ink-muted shadow hover:text-red-600 dark:hover:text-red-400"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}

        {uploading ? (
          <>
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-forest border-t-transparent" />
            <p className="text-xs font-medium text-ink-muted">Uploading…</p>
          </>
        ) : hasFile ? (
          <>
            {isImagePreview && previewUrl ? (
              <img
                src={previewUrl}
                alt={`${config.title} preview`}
                className="h-16 w-16 rounded-lg object-cover ring-2 ring-brand-forest"
              />
            ) : isVideoPreview && previewUrl ? (
              <video src={previewUrl} muted className="h-16 w-16 rounded-lg object-cover ring-2 ring-brand-forest" />
            ) : (
              <DocumentPreviewIcon className="h-10 w-10 text-accent" />
            )}
            {uploaded ? (
              <div className="flex items-center gap-1 text-xs font-medium text-accent">
                <CheckCircleIcon className="h-4 w-4" />
                <span>Uploaded</span>
              </div>
            ) : (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">Upload failed — try again</p>
            )}
            <p className="max-w-full truncate px-2 text-xs text-ink-muted">
              {file.name} · {formatFileSize(file.size)}
            </p>
          </>
        ) : (
          <>
            <UploadIcon className="h-7 w-7 text-ink-faint" />
            <p className="text-xs font-medium text-ink-muted">Click or drag file to upload</p>
          </>
        )}
      </label>

      <p className="text-xs text-ink-muted">{config.helperText}</p>
      {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

interface VerificationUploadProps {
  onSubmit?: () => void;
}

export default function VerificationUpload({ onSubmit }: VerificationUploadProps) {
  const { user } = useAuth();
  const { cart, updateVerificationDocs } = useRental();
  const { verificationDocs } = cart;
  // Scoped to only what's checked for checkout, same as PaymentBreakdown's own isByoOnly — an
  // unchecked BYO selection saved for later in the cart must never require this checkbox for a
  // checkout that's actually a package booking.
  const selectedCart = filterCartToSelection(cart);
  const isByoBooking = selectedCart.byoGears.length > 0 && selectedCart.selectedKits.length === 0;

  const [files, setFiles] = useState<DocumentFiles>(EMPTY_FILES);
  const [previews, setPreviews] = useState<DocumentPreviews>(EMPTY_PREVIEWS);
  const [fileErrors, setFileErrors] = useState<DocumentErrors>(EMPTY_ERRORS);
  const [uploading, setUploading] = useState<DocumentUploading>(EMPTY_UPLOADING);

  // Tracks every blob URL created for previews so they can all be released on unmount. Preview
  // URLs stay local to this component — they are never written to shared checkout state.
  const objectUrlsRef = useRef<Set<string>>(new Set());
  // Dispatch is stable, but the context helper is re-created each render; a ref keeps the unmount
  // cleanup on a single subscription instead of re-running whenever the cart changes.
  const updateVerificationDocsRef = useRef(updateVerificationDocs);
  updateVerificationDocsRef.current = updateVerificationDocs;

  // Bumped on every remove/replace so a slower upload that finishes after the customer already
  // removed or swapped that slot's file can recognize it's stale and discard its own result
  // instead of writing a storagePath for a file that's no longer selected.
  const uploadGenerationRef = useRef<Record<DocumentKey, number>>({
    idType1: 0,
    idType2: 0,
    verificationVideo: 0,
    proofOfBilling: 0,
  });

  useEffect(() => {
    const trackedUrls = objectUrlsRef.current;
    return () => {
      trackedUrls.forEach((url) => URL.revokeObjectURL(url));
      // The selected File objects live only in this component's state, so once it unmounts the
      // selection is genuinely gone. Clear the shared slots too, or the submission gate would
      // pass on files the page can no longer produce.
      updateVerificationDocsRef.current({
        documents: { idType1: null, idType2: null, verificationVideo: null, proofOfBilling: null },
        confirmed: false,
      });
    };
  }, []);

  function handleContactChange(
    field: keyof Pick<VerificationDocs, 'fullName' | 'phone' | 'email'>,
    value: string,
  ) {
    updateVerificationDocs({ [field]: value, confirmed: false });
  }

  async function handleDocumentSelect(config: DocumentSlotConfig, file: File) {
    const { key } = config;

    if (!isAcceptedFileType(file, config.accept)) {
      setFileErrors((prev) => ({ ...prev, [key]: wrongFileTypeMessage(config.expectedKind) }));
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileErrors((prev) => ({ ...prev, [key]: 'File must be smaller than 8MB.' }));
      return;
    }
    if (!user) {
      setFileErrors((prev) => ({ ...prev, [key]: 'Please log in before uploading verification documents.' }));
      return;
    }

    const previousUrl = previews[key];
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
      objectUrlsRef.current.delete(previousUrl);
    }

    const nextUrl = URL.createObjectURL(file);
    objectUrlsRef.current.add(nextUrl);

    setFiles((prev) => ({ ...prev, [key]: file }));
    setPreviews((prev) => ({ ...prev, [key]: nextUrl }));
    setFileErrors((prev) => ({ ...prev, [key]: null }));
    setUploading((prev) => ({ ...prev, [key]: true }));
    // Record what was selected, but with no storagePath yet — the submission gate requires a
    // real storagePath, so this slot cannot pass until the upload below actually succeeds.
    setDocumentSlot(key, { name: file.name, size: file.size, type: file.type, storagePath: null });

    const generation = ++uploadGenerationRef.current[key];
    const path = `${user.id}/${VERIFICATION_KIND_MAP[key]}-${Date.now()}-${sanitizeFileName(file.name)}`;

    // A session that went stale while this page sat idle would otherwise fail this upload
    // silently (a per-slot "Upload failed" the customer may not notice) and leave Save
    // Verification Details permanently disabled — see ensureFreshSession's own comment.
    await ensureFreshSession();
    if (uploadGenerationRef.current[key] !== generation) return; // stale by the time refresh resolved

    const { error: uploadError } = await supabase.storage.from(VERIFICATION_BUCKET).upload(path, file);

    // A remove or a newer select happened while this upload was in flight — the result no longer
    // corresponds to what's selected, so it must not be written back.
    if (uploadGenerationRef.current[key] !== generation) return;

    setUploading((prev) => ({ ...prev, [key]: false }));
    if (uploadError) {
      setFileErrors((prev) => ({ ...prev, [key]: `Upload failed — ${uploadError.message}` }));
      return;
    }
    setDocumentSlot(key, { name: file.name, size: file.size, type: file.type, storagePath: path });
  }

  function handleDocumentRemove(key: DocumentKey) {
    uploadGenerationRef.current[key] += 1; // invalidate any in-flight upload for this slot

    const previousUrl = previews[key];
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
      objectUrlsRef.current.delete(previousUrl);
    }

    setFiles((prev) => ({ ...prev, [key]: null }));
    setPreviews((prev) => ({ ...prev, [key]: null }));
    setFileErrors((prev) => ({ ...prev, [key]: null }));
    setUploading((prev) => ({ ...prev, [key]: false }));
    setDocumentSlot(key, null);
  }

  /** Any change to the documents invalidates a previous confirmation. */
  function setDocumentSlot(
    key: DocumentKey,
    meta: { name: string; size: number; type: string; storagePath: string | null } | null,
  ) {
    updateVerificationDocs({
      documents: { ...verificationDocs.documents, [key]: meta },
      confirmed: false,
    });
  }

  function handleTermsChange(accepted: boolean) {
    updateVerificationDocs({ termsAccepted: accepted, confirmed: false });
  }

  function handleByoAgreementChange(accepted: boolean) {
    updateVerificationDocs({ byoAgreementAccepted: accepted, confirmed: false });
  }

  const allDocumentsUploaded = REQUIRED_VERIFICATION_DOCUMENTS.every(
    (key) => verificationDocs.documents[key]?.storagePath,
  );
  const anyUploadInProgress = REQUIRED_VERIFICATION_DOCUMENTS.some((key) => uploading[key]);
  const contactInfoComplete = Boolean(
    verificationDocs.fullName.trim() && verificationDocs.phone.trim() && verificationDocs.email.trim(),
  );
  const agreementsAccepted = isByoBooking ? verificationDocs.byoAgreementAccepted : verificationDocs.termsAccepted;
  const canSubmit = allDocumentsUploaded && !anyUploadInProgress && contactInfoComplete && agreementsAccepted;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    updateVerificationDocs({ confirmed: true });
    onSubmit?.();
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-xl font-semibold text-ink">Identity Verification</h1>
        <p className="text-sm text-ink-muted">
          We verify every renter before confirming a booking. This keeps gear safe for the whole GearBnB
          community.
        </p>
        {/* Explains the marker once, up front, rather than leaving a bare asterisk to be guessed
            at. Not aria-hidden — unlike the individual marks, this legend is the explanation. */}
        <p className="text-xs text-ink-faint">
          <span className="font-semibold text-red-600 dark:text-red-400">*</span> Required — every field below must
          be completed before you can submit.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Contact Information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField
              label="Full Name"
              value={verificationDocs.fullName}
              placeholder="Juan Dela Cruz"
              autoComplete="name"
              onChange={(value) => handleContactChange('fullName', value)}
            />
          </div>
          <TextField
            label="Phone Number"
            type="tel"
            value={verificationDocs.phone}
            placeholder="09XX XXX XXXX"
            autoComplete="tel"
            onChange={(value) => handleContactChange('phone', value)}
          />
          <TextField
            label="Email Address"
            type="email"
            value={verificationDocs.email}
            placeholder="you@example.com"
            autoComplete="email"
            onChange={(value) => handleContactChange('email', value)}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Verification Documents</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Upload 2 valid government IDs, a short video verification, and proof of billing.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {DOCUMENT_SLOTS.map((slot) => (
            <DocumentDropzone
              key={slot.key}
              config={slot}
              file={files[slot.key]}
              previewUrl={previews[slot.key]}
              error={fileErrors[slot.key]}
              uploading={uploading[slot.key]}
              uploaded={Boolean(verificationDocs.documents[slot.key]?.storagePath)}
              onSelect={(file) => handleDocumentSelect(slot, file)}
              onRemove={() => handleDocumentRemove(slot.key)}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Required Agreements</h2>

        {/* GearBnB's Kit and Build Your Own rental agreements are two independent, standalone
         * documents — the BYO agreement is not an addendum to the Kit one, it carries its own
         * full general-terms section and its own signature block — so exactly one applies to any
         * given booking, never both, never neither. Which one shows here is the same
         * checked-for-checkout cart composition PaymentBreakdown/isVerificationComplete already
         * use (isByoBooking), never something this component decides on its own. */}
        {isByoBooking ? (
          <label className="flex items-start gap-3 rounded-xl border border-line p-4">
            <input
              type="checkbox"
              required
              checked={verificationDocs.byoAgreementAccepted}
              onChange={(e) => handleByoAgreementChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-accent focus:ring-brand-forest"
            />
            <span className="text-sm text-ink-muted">
              I have read and agree to GearBnB's{' '}
              <a
                href={BYO_RENTAL_AGREEMENT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent underline underline-offset-2"
              >
                Build Your Own Rental Agreement
              </a>{' '}
              and confirm that the information and documents provided above are accurate and belong to me.
            </span>
          </label>
        ) : (
          <label className="flex items-start gap-3 rounded-xl border border-line p-4">
            <input
              type="checkbox"
              required
              checked={verificationDocs.termsAccepted}
              onChange={(e) => handleTermsChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-accent focus:ring-brand-forest"
            />
            <span className="text-sm text-ink-muted">
              I have read and agree to GearBnB's{' '}
              <a
                href={TERMS_AND_CONDITIONS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent underline underline-offset-2"
              >
                Terms &amp; Conditions
              </a>{' '}
              and confirm that the information and documents provided above are accurate and belong to me.
            </span>
          </label>
        )}
      </section>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-brand-forest px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:cursor-not-allowed disabled:bg-surface-strong"
      >
        {anyUploadInProgress
          ? 'Uploading documents…'
          : verificationDocs.confirmed
            ? 'Verification Details Saved ✓'
            : 'Save Verification Details'}
      </button>

      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
        <InfoCircleIcon className="h-5 w-5 shrink-0" />
        <p>
          <span className="font-semibold">What happens next: </span>
          Once submitted, your booking will enter <span className="font-semibold">Pending</span> status for
          admin document review before payment instructions are sent.
        </p>
      </div>
    </form>
  );
}
