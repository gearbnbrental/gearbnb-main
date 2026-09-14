import { useEffect, useState } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Styles the confirm button as a destructive/irreversible action (red) instead of the default
   *  brand action styling — use for logout, cancel booking, remove/delete, etc. */
  destructive?: boolean;
  onCancel: () => void;
  /** May be async — the dialog disables both buttons and shows a loading label on Confirm while
   *  this is in flight, so a double-click (or a slow network) can never run the action twice. The
   *  dialog itself never closes on its own; the caller decides (e.g. flip its own `open` state)
   *  once the action actually finishes, which also lets it keep the dialog open to show an error. */
  onConfirm: () => void | Promise<void>;
}

/**
 * The one shared confirmation dialog for the customer website — reused wherever an action is
 * destructive, irreversible, or otherwise consequential enough to warrant an explicit "are you
 * sure" (logout, submitting a real booking/inquiry, etc.), instead of a bespoke dialog per call
 * site. Matches the existing fixed-overlay + centered-card modal convention already established by
 * GearDetailsModal.tsx, rather than introducing a new visual pattern.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  // Fresh submitting state every time the dialog opens — a prior confirm's leftover "submitting"
  // must never carry over and disable the buttons on an unrelated later open of this same dialog.
  useEffect(() => {
    if (open) setSubmitting(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) onCancel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, submitting, onCancel]);

  if (!open) return null;

  async function handleConfirmClick() {
    // The actual double-submit guard: a second click/Enter while a confirm is already in flight
    // is a no-op, not a second call to onConfirm.
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={() => !submitting && onCancel()}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1.5">
          <h2 id="confirm-dialog-title" className="text-base font-semibold text-ink">
            {title}
          </h2>
          <p id="confirm-dialog-message" className="text-sm text-ink-muted">
            {message}
          </p>
        </div>
        <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={submitting}
            autoFocus
            className={`h-11 flex-1 rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-forest hover:bg-brand-forest-dark'
            }`}
          >
            {submitting ? 'Please wait…' : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="h-11 flex-1 rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
