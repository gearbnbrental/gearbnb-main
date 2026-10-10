import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePromo } from '../context/PromoContext';
import { formatPromoOffer } from '../utils/promo';
import { PROMO_COPY } from '../config/promoCopy';

const SHOW_DELAY_MS = 1000;
/** The animation's own background green, shown while it downloads: the animation itself opens on
 *  plain green, so the popup can appear right on time without looking empty or broken. */
const ARTWORK_BACKGROUND = '#083d1f';
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
 * opens (the artwork fills in as it downloads), once per browser session; clicking the artwork goes to the catalog. Closes via the ×
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
    // Opens 1 second after arrival (counted from when the homepage opened, not from when the promo
    // answer came back), without waiting for the 2.5MB animation to finish downloading: it starts
    // downloading now and plays in place as soon as it arrives, over its own green background.
    new Image().src = PROMO_IMAGE;
    const remainingDelay = Math.max(0, mountedAt.current + SHOW_DELAY_MS - Date.now());
    const timer = window.setTimeout(() => {
      setOpen(true);
      markSeen();
    }, remainingDelay);
    return () => window.clearTimeout(timer);
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
        <Link
          to="/catalog"
          onClick={() => setOpen(false)}
          className="block aspect-square overflow-hidden rounded-2xl shadow-2xl"
          style={{ backgroundColor: ARTWORK_BACKGROUND }}
        >
          <img
            src={PROMO_IMAGE}
            alt={`${description} Rent now.`}
            width={800}
            height={800}
            // If the artwork can't load at all, close rather than leave an empty green square.
            onError={() => setOpen(false)}
            className="block h-full w-full"
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
