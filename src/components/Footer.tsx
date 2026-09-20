import { useNavigate } from 'react-router-dom';
import { CONTACT_EMAIL, MESSENGER_URL } from '../config/social';
import { ChatBubbleIcon, MailIcon } from './icons';
import SocialLinks from './SocialLinks';

/**
 * The single site-wide footer, mounted once in App.tsx below every route. Previously this markup
 * lived only inside LandingPage.tsx, so every other page (About, catalogs, Cart, Checkout, My
 * Bookings, Profile, Terms, etc.) had no footer at all — moved here so it renders consistently
 * everywhere without duplicating the markup per page.
 *
 * Every link either navigates to a real route or scrolls to a same-page section id, matching the
 * one navigation mechanism this footer has always used (never a second pattern like a raw <a> for
 * an internal link). "How renting works" and "Adventure Bundles" only make sense as scroll targets
 * on the home page itself — clicking either from another page navigates home first, then scrolls,
 * so the link always does something sensible regardless of which page it's clicked from.
 */
export default function Footer() {
  const navigate = useNavigate();

  /** Navigates home first (if not already there) then scrolls to a section id — scrollIntoView
   *  only works once that section actually exists in the DOM, which requires being on "/" already. */
  function goToHomeSection(sectionId: string) {
    if (window.location.pathname !== '/') {
      navigate(`/#${sectionId}`);
      return;
    }
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    // Extra bottom clearance on mobile only: FloatingHelp + BackToTop are both `fixed` to the
    // viewport's bottom-right corner (see their own components), so they don't push this footer's
    // own content up the way normal document flow would — without this, the last row of links and
    // the copyright line would sit directly underneath that floating stack instead of above it.
    // Sized to clear BackToTop's own top edge (bottom-[5.5rem] + its 2.75rem height) with a small
    // buffer. Desktop keeps its original py-12 unchanged — the floating stack there is comfortably
    // clear of the wider footer already.
    <footer className="relative isolate overflow-hidden bg-brand-brown px-5 pb-36 pt-8 sm:px-6 sm:py-12">
      {/* A soft radial highlight, not a texture/pattern change — client's "soft background... make
          it stand out more" request, read as "give the footer some gentle depth rather than a
          single flat color block," not "redesign it." Same color-mix + radial-gradient idiom
          AboutUs.tsx's own SectionGlow already establishes elsewhere on the site, just tuned for
          this dark background (a warm, low-opacity olive highlight reads as a soft glow here,
          where the light-background version elsewhere on the site wouldn't). Purely decorative
          (aria-hidden, pointer-events-none): every link, text, and existing layout below is
          completely unchanged. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            'radial-gradient(60% 70% at 85% 0%, color-mix(in srgb, var(--color-brand-olive) 22%, transparent), transparent 70%)',
        }}
        aria-hidden="true"
      />
      {/* gap-6 below sm (not gap-8): stacked single-column below `sm` (unchanged — still one
          column, per design, just tighter), this is the one number controlling the space between
          the grid and the copyright row. */}
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 sm:gap-8">
        {/* gap-5 below sm (not gap-8): with five groups stacking into a single column below `sm`,
            this same value repeats FOUR times in a row (between every pair of stacked groups) —
            it was the single largest contributor to the mobile footer's height, more than the
            outer section padding or any individual group's own content. */}
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-8 lg:grid-cols-5">
          <div className="flex flex-col gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <img src="/brand_assets/GEARBNB_logo.png" alt="" className="h-7 w-7 rounded-full sm:h-8 sm:w-8" />
              <span className="font-serif text-base font-bold text-white">GearBnB</span>
            </div>
            <p className="text-sm text-white">Making camping memorable with easy and reliable rentals.</p>
          </div>

          <div className="flex flex-col gap-1.5 sm:gap-2">
            <h3 className="text-sm font-semibold text-white">Quick Links</h3>
            <button type="button" onClick={() => navigate('/catalog')} className="w-fit text-left text-sm text-white hover:opacity-80">
              Rent Gear
            </button>
            <button
              type="button"
              onClick={() => goToHomeSection('adventure-bundles')}
              className="w-fit text-left text-sm text-white hover:opacity-80"
            >
              Adventure Bundles
            </button>
            <button
              type="button"
              onClick={() => navigate('/plan-an-event')}
              className="w-fit text-left text-sm text-white hover:opacity-80"
            >
              Plan an Event
            </button>
          </div>

          <div className="flex flex-col gap-1.5 sm:gap-2">
            <h3 className="text-sm font-semibold text-white">Rental Help</h3>
            {/* Scrolls to the "How To Rent Camping Gear from GearBnB?" section (the process-steps
                section on the home page) — id retained as "how-renting-works" even though the
                section's own heading text changed, so this is the only place the id string lives. */}
            <button
              type="button"
              onClick={() => goToHomeSection('how-renting-works')}
              className="w-fit text-left text-sm text-white hover:opacity-80"
            >
              How renting works
            </button>
            {/* No standalone pricing page exists — /catalog is where real, current per-package/
             * per-item prices actually live, so it's the genuine equivalent rather than a page
             * invented just to hold this link. */}
            <button type="button" onClick={() => navigate('/catalog')} className="w-fit text-left text-sm text-white hover:opacity-80">
              Pricing &amp; Fees
            </button>
            {/* "Gear Care Tips" removed per client request, with no replacement item — the client
                does not want that link treated as a gear-care section, and this site has no
                gear-care/blog content to point it at instead. */}
          </div>

          <div className="flex flex-col gap-1.5 sm:gap-2">
            <h3 className="text-sm font-semibold text-white">Policies</h3>
            <button type="button" onClick={() => navigate('/terms')} className="w-fit text-left text-sm text-white hover:opacity-80">
              Rental Terms
            </button>
            <button type="button" onClick={() => navigate('/terms#deposit')} className="w-fit text-left text-sm text-white hover:opacity-80">
              Deposit &amp; Refunds
            </button>
            <button type="button" onClick={() => navigate('/terms-of-service')} className="w-fit text-left text-sm text-white hover:opacity-80">
              Terms of Service
            </button>
            <button type="button" onClick={() => navigate('/privacy-policy')} className="w-fit text-left text-sm text-white hover:opacity-80">
              Privacy Policy
            </button>
          </div>

          {/* Get in Touch — its own clearly-defined column (client's reference), focused on
              actual contact/support actions only. Deliberately does NOT repeat a Facebook/TikTok
              icon row here — those already have one clear home in this footer, the copyright
              row's SocialLinks icons below. Messenger is the one platform that row doesn't cover,
              so it gets its own single "Send us a message" link here instead of a duplicated row. */}
          <div className="flex min-w-0 flex-col gap-2 sm:gap-3">
            <h3 className="text-sm font-semibold text-white">Get in Touch</h3>
            {/* Renders only while CONTACT_EMAIL is actually set (see config/social.ts) — this
                is the customer-support address only, never the RMS's automated booking sender
                (admin@gearbnbrental.com), which this site never reads or displays. */}
            {CONTACT_EMAIL && (
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex min-w-0 items-center gap-2.5 text-sm text-white transition-opacity hover:opacity-80"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 sm:h-8 sm:w-8">
                  <MailIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0 break-words">{CONTACT_EMAIL}</span>
              </a>
            )}
            <a
              href={MESSENGER_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Send us a message on Messenger (opens in a new tab)"
              className="flex items-center gap-2.5 text-sm text-white transition-opacity hover:opacity-80"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 sm:h-8 sm:w-8">
                <ChatBubbleIcon className="h-4 w-4" />
              </span>
              Send us a message
            </a>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-white sm:flex-row sm:pt-6">
          <span>&copy; 2026 GearBnB. All rights reserved.</span>
          <div className="flex items-center gap-2">
            <SocialLinks className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white transition-opacity hover:opacity-80" />
          </div>
        </div>
      </div>
    </footer>
  );
}
