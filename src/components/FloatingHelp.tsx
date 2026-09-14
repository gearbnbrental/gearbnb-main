import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MESSENGER_URL, TIKTOK_URL } from '../config/social';
import { ChatBubbleIcon, TikTokIcon } from './icons';

function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

/** Routes whose own sticky bottom action bar (Cart's checkout footer, the catalog pages' cart
 * summary bar) would otherwise sit directly under this widget's default bottom-right position â€”
 * on these, the widget is lifted clear of that bar instead of overlapping its buttons. Exported so
 * BackToTop.tsx â€” which stacks directly above this widget â€” lifts by the same amount on the same
 * routes, rather than maintaining a second, potentially-drifting copy of this list. */
export const STICKY_FOOTER_ROUTES = new Set(['/cart', '/catalog/path-a', '/catalog/path-b']);

/**
 * Sitewide floating "Need Help?" contact widget â€” the one general-purpose support CTA, available
 * identically before, during, and after a booking, and regardless of cart/login state (mounted
 * once in App.tsx with no dependency on any of that). A plain link-based popover, not a chat
 * widget â€” clicking Messenger/TikTok just opens that real destination in a new tab, nothing here
 * simulates or promises live chat.
 */
export default function FloatingHelp() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const liftedForStickyFooter = STICKY_FOOTER_ROUTES.has(location.pathname);

  // A panel left open across a navigation would otherwise sit, now pointing at content the
  // customer never asked to see, on top of whatever page they just moved to.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open]);

  return (
    <div
      className={`fixed right-4 z-50 sm:right-6 ${liftedForStickyFooter ? 'bottom-24 sm:bottom-24' : 'bottom-5 sm:bottom-6'}`}
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Trigger comes BEFORE the panel in DOM order (even though the panel renders visually
       * above it via `absolute bottom-full`) â€” forward-Tab from this button must reach the
       * panel's own controls next, not skip past them to whatever follows this component in the
       * document. Source order here drives tab order; CSS positioning does not. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="floating-help-panel"
        // Distinct from the panel's own "Close help panel" button below â€” two controls sharing
        // one accessible name are indistinguishable to a screen reader user navigating by name.
        aria-label={open ? 'Collapse help panel' : 'Need Help? Contact us'}
        className="flex items-center gap-2 rounded-full bg-brand-forest px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-brand-forest-dark motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        {open ? <XMarkIcon className="h-5 w-5" /> : <ChatBubbleIcon className="h-5 w-5" />}
        <span className="hidden sm:inline">{open ? 'Close' : 'Need Help?'}</span>
      </button>

      {open && (
        <div
          id="floating-help-panel"
          ref={panelRef}
          role="dialog"
          aria-label="Contact GearBnB"
          className="absolute bottom-full right-0 mb-3 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border border-line bg-surface shadow-xl"
        >
          {/* Branded header â€” dark-green fill matching the client's reference, GearBnB mark, and
           * the panel's only close control (never duplicated below). */}
          <div className="flex items-center justify-between gap-2 bg-brand-forest px-4 py-3">
            <div className="flex items-center gap-2">
              <img src="/brand_assets/GEARBNB_logo.png" alt="" className="h-6 w-6 rounded-full" />
              <span className="font-serif text-sm font-bold text-white">GearBnB</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label="Close help panel"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 hover:text-white"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-ink">Talk to us</h2>
              <p className="text-sm text-ink-muted">
                Have a question about your camping setup? We&rsquo;d be happy to help!
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <a
                href={MESSENGER_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Messenger (opens in a new tab)"
                className="flex items-center justify-center gap-2 rounded-full bg-[#0084FF] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <ChatBubbleIcon className="h-4.5 w-4.5" />
                Messenger
              </a>
              <a
                href={TIKTOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok (opens in a new tab)"
                className="flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:bg-black"
              >
                <TikTokIcon className="h-4.5 w-4.5" />
                TikTok
              </a>
            </div>

            <p className="text-xs text-ink-faint">We&rsquo;re here to help you plan your rental.</p>
          </div>
        </div>
      )}
    </div>
  );
}
