import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { STICKY_FOOTER_ROUTES } from './FloatingHelp';

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5V4.5m0 0-6 6m6-6 6 6" />
    </svg>
  );
}

/** How far down the page (in pixels) before the button appears — roughly one viewport's worth of
 *  scrolling, so it only ever shows up on pages actually long enough to need it; a short page
 *  (About, Login, an empty Cart) never scrolls this far and the button simply never appears there,
 *  no per-page allowlist required. */
const SHOW_AFTER_PX = 480;

/**
 * Sitewide "back to top" button (mounted once in App.tsx, same as FloatingHelp) — appears once the
 * customer has actually scrolled down a meaningful amount, and stacks directly above FloatingHelp
 * in the same bottom-right corner (never beside/overlapping it, and lifted clear of the same
 * sticky footer bars on the same routes — see STICKY_FOOTER_ROUTES) rather than introducing a
 * second floating-button position convention.
 */
export default function BackToTop() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  const lifted = STICKY_FOOTER_ROUTES.has(location.pathname);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    }
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // A stale "visible" from a long previous page would otherwise render this floating over a page
  // the customer just landed on at the top of — recheck immediately on every navigation rather
  // than waiting for the next scroll event (which may never come on a short page).
  useEffect(() => {
    setVisible(window.scrollY > SHOW_AFTER_PX);
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className={`fixed right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink-muted shadow-lg transition-colors hover:bg-surface-strong hover:text-ink sm:right-6 ${
        lifted ? 'bottom-[10.25rem]' : 'bottom-[5.5rem] sm:bottom-[5.75rem]'
      }`}
    >
      <ArrowUpIcon className="h-5 w-5" />
    </button>
  );
}
