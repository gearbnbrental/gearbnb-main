import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const SHOW_DELAY_MS = 1000;
// "Until October 31 only" — the popup stops appearing once the promo is over (Philippine time),
// so an expired offer is never advertised even if nobody remembers to take this down.
const PROMO_ENDS_AT = new Date('2026-11-01T00:00:00+08:00');
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
 * Homepage promo popup (15% off for first-time renters). Appears 1 second after the homepage
 * opens, once per browser session; clicking the animation goes to the catalog. Closes via the ×
 * button, a click on the backdrop, or Escape.
 */
export default function PromoPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (Date.now() >= PROMO_ENDS_AT.getTime() || alreadySeenThisSession()) return;
    // Opens once BOTH the 1-second delay has passed and the animation has finished downloading,
    // so a slow connection never shows a blank or half-loaded popup — it just appears a bit later.
    let cancelled = false;
    const delay = new Promise<void>((resolve) => window.setTimeout(resolve, SHOW_DELAY_MS));
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
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="15% off for all first-time renters, until October 31 only"
        className="relative w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <Link to="/catalog" onClick={() => setOpen(false)} className="block overflow-hidden rounded-2xl shadow-2xl">
          <img
            src={PROMO_IMAGE}
            alt="15% off for all first-time renters, until October 31 only. Rent now."
            width={800}
            height={800}
            className="block h-auto w-full"
          />
        </Link>
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
