import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import { useRental } from '../../context/RentalContext';
import type { VerificationDocs } from '../../types/gearbnb';

type DocumentKey = 'idType1' | 'idType2' | 'verificationVideo' | 'proofOfBilling';
type ExpectedKind = 'image' | 'video' | 'document';

interface DocumentSlotConfig {
  key: DocumentKey;
  title: string;
  helperText: string;
  accept: string;
  expectedKind: ExpectedKind;
}

const DOCUMENT_SLOTS: DocumentSlotConfig[] = [
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
      "Upload a short video holding your valid ID next to your face, clearly speaking the phrase: \"I am [Your Full Name] and today is [Date Today].\"",
    accept: 'video/mp4,video/webm,video/quicktime,.mov',
    expectedKind: 'video',
  },
  {
    key: 'proofOfBilling',
    title: 'Proof of Billing',
    helperText: 'Utility bill or statement from the last 3 months',
    accept: 'image/*,application/pdf',
    expectedKind: 'document',
  },
];

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

type DocumentFiles = Record<DocumentKey, File | null>;
type DocumentPreviews = Record<DocumentKey, string | null>;
type DocumentErrors = Record<DocumentKey, string | null>;

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

function isAcceptedFileType(file: File, accept: string): boolean {
  return accept
    .split(',')
    .map((pattern) => pattern.trim())
    .some((pattern) => {
      if (pattern.startsWith('.')) return file.name.toLowerCase().endsWith(pattern.toLowerCase());
      return pattern.endsWith('/*') ? file.type.startsWith(pattern.slice(0, -1)) : file.type === pattern;
    });
}

function wrongFileTypeMessage(expectedKind: ExpectedKind): string {
  switch (expectedKind) {
    case 'video':
      return 'Please upload a video file (MP4, WebM, or MOV) — a photo won\'t work here.';
    case 'image':
      return 'Please upload an image file.';
    default:
      return 'Unsupported file type.';
  }
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

function TextField({ label, type = 'text', value, placeholder, autoComplete, onChange }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        type={type}
        required
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-line px-3 py-2 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20"
      />
    </label>
  );
}

interface DocumentDropzoneProps {
  config: DocumentSlotConfig;
  file: File | null;
  previewUrl: string | null;
  error: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
}

function DocumentDropzone({ config, file, previewUrl, error, onSelect, onRemove }: DocumentDropzoneProps) {
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
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{config.title}</span>

      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
        className={[
          'relative flex h-36 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-3 text-center transition-colors',
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
          accept={config.accept}
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
        />

        {hasFile && (
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

        {hasFile ? (
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
              <DocumentPreviewIcon className="h-10 w-10 text-brand-forest" />
            )}
            <div className="flex items-center gap-1 text-xs font-medium text-brand-forest">
              <CheckCircleIcon className="h-4 w-4" />
              <span>Uploaded</span>
            </div>
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
  const { cart, updateVerificationDocs } = useRental();
  const { verificationDocs } = cart;

  const [files, setFiles] = useState<DocumentFiles>(EMPTY_FILES);
  const [previews, setPreviews] = useState<DocumentPreviews>(EMPTY_PREVIEWS);
  const [fileErrors, setFileErrors] = useState<DocumentErrors>(EMPTY_ERRORS);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Tracks every blob URL created for previews so they can all be released on unmount.
  const objectUrlsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const trackedUrls = objectUrlsRef.current;
    return () => {
      trackedUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function handleContactChange(
    field: keyof Pick<VerificationDocs, 'fullName' | 'phone' | 'email'>,
    value: string,
  ) {
    updateVerificationDocs({ [field]: value });
  }

  function handleDocumentSelect(config: DocumentSlotConfig, file: File) {
    const { key } = config;

    if (!isAcceptedFileType(file, config.accept)) {
      setFileErrors((prev) => ({ ...prev, [key]: wrongFileTypeMessage(config.expectedKind) }));
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileErrors((prev) => ({ ...prev, [key]: 'File must be smaller than 8MB.' }));
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
    updateVerificationDocs({ [key]: nextUrl });
  }

  function handleDocumentRemove(key: DocumentKey) {
    const previousUrl = previews[key];
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
      objectUrlsRef.current.delete(previousUrl);
    }

    setFiles((prev) => ({ ...prev, [key]: null }));
    setPreviews((prev) => ({ ...prev, [key]: null }));
    setFileErrors((prev) => ({ ...prev, [key]: null }));
    updateVerificationDocs({ [key]: '' });
  }

  const allDocumentsUploaded = DOCUMENT_SLOTS.every((slot) => files[slot.key] !== null);
  const contactInfoComplete = Boolean(
    verificationDocs.fullName.trim() && verificationDocs.phone.trim() && verificationDocs.email.trim(),
  );
  const canSubmit = allDocumentsUploaded && contactInfoComplete && agreedToTerms;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit?.();
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-xl font-semibold text-ink">Identity Verification</h1>
        <p className="text-sm text-ink-muted">
          We verify every renter before confirming a booking. This keeps gear safe for the whole GearBNB
          community.
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
              onSelect={(file) => handleDocumentSelect(slot, file)}
              onRemove={() => handleDocumentRemove(slot.key)}
            />
          ))}
        </div>
      </section>

      <label className="flex items-start gap-3 rounded-xl border border-line p-4">
        <input
          type="checkbox"
          required
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-brand-forest focus:ring-brand-forest"
        />
        <span className="text-sm text-ink-muted">
          I agree to GearBNB's{' '}
          <a href="#" className="font-medium text-brand-forest underline underline-offset-2">
            Terms and Conditions
          </a>{' '}
          and confirm that the information and documents provided above are accurate and belong to me.
        </span>
      </label>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-brand-forest px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:cursor-not-allowed disabled:bg-surface-strong"
      >
        Submit for Review
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
