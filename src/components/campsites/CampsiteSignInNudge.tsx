import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePromo } from '../../context/PromoContext';
import { NUDGE_SNOOZE_MS, countCampsiteView, dismissNudge, nudgeDismissedAt, shouldShowCampsiteNudge } from '../../utils/campsiteContact';
import { formatPromoOffer, isPromoBookable } from '../../utils/promo';

/**
 * A small, dismissible card for signed-out campers who have looked at a few campsites. It never
 * covers the page (search engines rank pages lower for pop-ups that hide the content), and once
 * closed it stays away for a week (NUDGE_SNOOZE_MS).
 */
export default function CampsiteSignInNudge({ slug }: { slug: string }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { promo, audience, nowMs } = usePromo();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (loading) return;
    const views = countCampsiteView(slug);
    setShow(shouldShowCampsiteNudge({ signedIn: !!user, views, dismissedAt: nudgeDismissedAt(), now: Date.now() }));
  }, [slug, user, loading]);

  if (!show) return null;
  const rentalOffer =
    promo && audience && isPromoBookable(promo, nowMs)
      ? ` and get ${formatPromoOffer(promo)} off your ${audience === 'everyone' ? '' : 'first '}gear rental`
      : '';
  const close = () => {
    dismissNudge(Date.now());
    setShow(false);
  };

  return (
    <div
      role="complementary"
      aria-label="Sign in"
      className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-xl sm:bottom-6"
    >
      <div className="flex flex-1 flex-col gap-2">
        <p className="text-sm font-semibold text-ink">Planning a camping trip?</p>
        <p className="text-sm text-ink-muted">Sign in to review the campsites you visit{rentalOffer}.</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/login', { state: { from: pathname, mode: 'login', reason: 'Sign in to review campsites.' } })}
            className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-semibold text-white hover:bg-brand-forest-dark"
          >
            Sign in
          </button>
          <button type="button" onClick={close} className="text-sm font-medium text-ink-muted hover:text-ink">
            Not now
          </button>
        </div>
      </div>
      <button type="button" onClick={close} aria-label={`Close for ${NUDGE_SNOOZE_MS / 86_400_000} days`} className="-mr-1 -mt-1 rounded-full p-1 text-lg leading-none text-ink-muted hover:bg-surface-strong hover:text-ink">
        ×
      </button>
    </div>
  );
}
