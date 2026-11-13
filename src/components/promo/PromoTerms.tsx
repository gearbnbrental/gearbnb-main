import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PROMO_COPY } from '../../config/promoCopy';
import { describePromoDates } from '../../utils/promo';
import type { RmsPublicPromo } from '../../utils/rmsApi';

/** The promo's terms: both dates in plain words (when it has any), then the RMS's terms text as
 *  PLAIN text (line breaks kept, never rendered as HTML), or a short default when there is none. */
export function PromoTermsContent({ promo }: { promo: RmsPublicPromo }) {
  const dates = describePromoDates(promo);
  return (
    <div className="flex flex-col gap-2 text-sm text-ink-muted">
      {dates && <p className="font-medium text-ink">{dates}</p>}
      <p className="whitespace-pre-line break-words">{promo.termsText ?? PROMO_COPY.termsDefault}</p>
    </div>
  );
}

/** A small "See terms" link that opens the terms in a dialog. */
export default function PromoTermsLink({ promo, className = '' }: { promo: RmsPublicPromo; className?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    // The page behind stays put while the terms are open, so a scroll gesture moves the terms,
    // never the catalog underneath.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={`font-medium underline underline-offset-2 ${className}`}
      >
        {PROMO_COPY.seeTerms}
      </button>
      {/* Rendered at the end of <body> (a portal), not inside the link's own parent: the link
          sits in the sticky tracker, whose backdrop blur makes a `fixed` child position itself
          against the tracker instead of the screen. Height is capped to the screen and only the
          terms text scrolls; the title and Close button always stay visible. Phones get a sheet
          from the bottom (easy to reach and scroll with a thumb); wider screens a centred box. */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
            onClick={() => setOpen(false)}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="promo-terms-title"
              className="flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface text-left shadow-xl sm:max-h-[80vh] sm:max-w-lg sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="promo-terms-title" className="shrink-0 border-b border-line px-5 py-4 font-serif text-lg font-semibold text-ink">
                {PROMO_COPY.termsTitle}
              </h2>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                <PromoTermsContent promo={promo} />
              </div>
              <div className="shrink-0 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-lg bg-brand-forest px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-forest-dark sm:ml-auto sm:block sm:w-auto"
                >
                  {PROMO_COPY.termsClose}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
