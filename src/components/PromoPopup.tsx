import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePromo } from '../context/PromoContext';
import { formatPromoOffer } from '../utils/promo';
import { PROMO_COPY } from '../config/promoCopy';

const SHOW_DELAY_MS = 1000;
const PROMO_IMAGE = '/images/promos/first-time-renter-15-off-v3.webp';
const SEEN_KEY = 'gearbnb-promo-first-time-15-off-seen';

function alreadySeenThisSession(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Storage blocked (private mode etc.) — worst case the popup shows again next visit.
  }
}

/**
 * Homepage promo popup. Appears only while the RMS reports a live promo this visitor can get (and
 * before its booking deadline, which usePromo already enforces), 1 second after the homepage
 * opens, once per browser session; clicking the artwork goes to the catalog. Closes via the ×
 * button, a click on the backdrop, or Escape. Disappears at once if the promo goes away (it ended,
 * or the visitor signed in as a returning renter).
 */
export default function PromoPopup() {
  const { promo } = usePromo();
  const [open, setOpen] = useState(false);
  const mountedAt = useRef(Date.now());
  const hasPromo = promo !== null;

  useEffect(() => {
    if (!hasPromo || alreadySeenThisSession()) return;
    // Opens once BOTH the 1-second delay (counted from arrival, not from when the promo answer
    // came back) has passed and the animation has finished downloading, so a slow connection
    // never shows a blank or half-loaded popup — it just appears a bit later.
    let cancelled = false;
    const remainingDelay = Math.max(0, mountedAt.current + SHOW_DELAY_MS - Date.now());
    const delay = new Promise<void>((resolve) => window.setTimeout(resolve, remainingDelay));
    const loaded = new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = PROMO_IMAGE;
    });
    Promise.all([delay, loaded])
      .then(() => {
        if (cancelled) return;
        setOpen(true);
        markSeen();
      })
      .catch(() => {
        // Image failed to load — skip the popup rather than show a broken one.
      });
    return () => {
      cancelled = true;
    };
  }, [hasPromo]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!open || !promo) return null;
  const description = `${formatPromoOffer(promo)} off${promo.firstTimeRentersOnly ? ' for first-time renters' : ''}. ${PROMO_COPY.termsApply}`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={description}
        className="relative w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <Link to="/catalog" onClick={() => setOpen(false)} className="block overflow-hidden rounded-2xl shadow-2xl">
          <img
            src={PROMO_IMAGE}
            alt={`${description} Rent now.`}
            width={800}
            height={800}
            className="block h-auto w-full"
          />
        </Link>
        <p className="mt-2 text-center text-xs text-white">
          {PROMO_COPY.termsApply}
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close promo"
          className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-xl leading-none text-ink shadow-lg transition-colors hover:bg-surface-strong"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
    </div>
  );
}
