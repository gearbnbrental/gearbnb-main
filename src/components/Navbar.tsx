import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRental } from '../context/RentalContext';
import ConfirmDialog from './ConfirmDialog';
import { ChevronDownIcon, UserIcon } from './icons';
import SocialLinks from './SocialLinks';
import ThemeToggle from './ThemeToggle';

function CartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 3h1.386c.51 0 .955.343 1.087.836l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 1.981-4.706 2.545-7.174.108-.474-.272-.926-.758-.926H5.106M7.5 14.25 5.106 5.336M9.75 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm9 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
      />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
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

/** Mobile-only nav links that live behind the hamburger toggle below `sm` — everything the
 * desktop row already shows inline via its own `hidden sm:inline-block` links. Kept as a single
 * list here so the drawer and the desktop row can never silently drift apart.
 *
 * Deliberately no Profile entry: the account pill's own dropdown (which renders at every width,
 * not just desktop) is the single way into Profile, so it's never reachable from two different
 * menus at the same breakpoint. Catalog/Packages/Build Your Own are rendered separately below
 * (an expandable group, not a flat link) since mobile needs its own non-hover way into the same
 * two catalog routes the desktop dropdown offers. */
function mobileNavLinks(user: unknown) {
  return [
    { to: '/', label: 'Home' },
    { to: '/about-us', label: 'About Us' },
    ...(user ? [{ to: '/my-bookings', label: 'My Bookings' }] : []),
    { to: '/plan-an-event', label: 'Plan An Event' },
  ];
}

export default function Navbar() {
  const { cart } = useRental();
  const { user, displayName, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const cartItemCount = cart.selectedKits.length + cart.selectedItems.length + cart.byoGears.length;
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [catalogMenuOpen, setCatalogMenuOpen] = useState(false);
  const [mobileCatalogOpen, setMobileCatalogOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const catalogMenuRef = useRef<HTMLDivElement>(null);

  // A stale open drawer surviving a navigation (e.g. the customer taps a link, the route changes,
  // but the panel itself never got an explicit close handler for that particular click path) would
  // otherwise sit open over the new page's content — closing on every route change is the one rule
  // that can't be missed by forgetting it on an individual link. Covers the account dropdown too,
  // so navigating to Profile from it always leaves it closed behind you.
  useEffect(() => {
    setMenuOpen(false);
    setAccountMenuOpen(false);
    setCatalogMenuOpen(false);
    setMobileCatalogOpen(false);
  }, [location.pathname]);

  // Signing out doesn't change the route, so the route-change effect above can't close the menu in
  // that case — without this, the dropdown would sit open over a now-logged-out header.
  useEffect(() => {
    if (!user) setAccountMenuOpen(false);
  }, [user]);

  // Outside-click and Escape both dismiss the dropdown, the two ways any menu is expected to close.
  // Listeners are only attached while it's actually open, so a closed menu costs nothing.
  useEffect(() => {
    if (!accountMenuOpen) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [accountMenuOpen]);

  // Same click/tap/Escape-to-close pattern as the account dropdown above — click-to-toggle (not
  // CSS :hover) so it works identically with mouse, touch, and keyboard.
  useEffect(() => {
    if (!catalogMenuOpen) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!catalogMenuRef.current?.contains(event.target as Node)) setCatalogMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setCatalogMenuOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [catalogMenuOpen]);

  // The drawer already closes on navigation; Escape is the keyboard way to dismiss it without
  // navigating, matching the account and catalog menus above.
  useEffect(() => {
    if (!menuOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  async function handleSignOut() {
    await signOut();
    setShowLogoutConfirm(false);
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur">
      <div className="border-b border-line">
        {/* Below `lg` this row is the compact mobile/tablet header: a smaller logo and tighter
            vertical padding, with every nav link behind the menu button. Measured before this
            change, the sticky header was 110px tall on a 375px phone and 150px at 768px (the
            full link row wrapped under the logo there) — up to ~18% of the viewport, on every
            page. flex-wrap stays only as a last-resort guard against overflow; at the widths this
            layout targets it no longer needs to wrap. */}
        {/* px-3 below sm (not px-4): at exactly 320px — the narrowest width this site still
            targets — the logo (~130px) and the icon/login/menu cluster (~189px) needed 319px
            combined against only 288px of content width once px-4's 32px was subtracted, and the
            row silently fell back to its flex-wrap guard, stacking into two lines. The handful of
            sm-gated reductions below (padding, logo size, wordmark size, icon buttons) recover
            exactly that shortfall so the row fits on one line at every width down to 320px,
            without touching how any of it looks from sm (640px) up. */}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-2 sm:px-6 lg:py-3">
          {/* shrink-0: "GearBnB" is one unbreakable word, so a tight flex row would otherwise
              compress this box past its own text's minimum width, making the text overflow its box
              instead of shrinking. */}
          <Link to="/" className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <img
              src="/brand_assets/GEARBNB_logo.png"
              alt=""
              className="h-8 w-8 rounded-full shadow-sm sm:h-10 sm:w-10 lg:h-12 lg:w-12"
            />
            {/* brand-forest reads fine on this header's light-mode surface, but the same dark green
                on the dark-mode surface is low-contrast — dark:text-ink switches it to this site's
                normal near-white dark-mode text color, per the client's explicit "branding text
                should also appear white in Dark Mode" request. Footer's own "GearBnB" wordmark
                needs no equivalent change — it already sits on a constant brand-brown band in
                brand-cream (an off-white), which never dims in dark mode. */}
            <span className="font-serif text-lg font-bold tracking-tight text-brand-forest dark:text-ink sm:text-xl">
              GearBnB
            </span>
          </Link>

          {/* The inline link row starts at `lg` (1024px), not `sm` (640px): between those widths the
              full row didn't fit and wrapped beneath the logo. Desktop keeps its original gap-4.
              Note the container is capped at max-w-5xl, so a wider screen gives this row no extra
              room — which is why the account name below is capped at one width everywhere rather
              than widening at xl (a 10rem name wrapped a signed-in row at 1280px and up). */}
          {/* gap-0.5 stays exactly at 320px — that width has zero horizontal slack left (see this
              row's own px-3 comment above: any wider gap there wraps the row to two lines). From
              350px up there's enough room for real breathing space between the icon cluster
              (theme toggle / cart / account / menu), which previously read as touching at every
              width above 320 too, not just the narrowest one. */}
          <nav className="flex items-center gap-0.5 min-[350px]:gap-2 sm:gap-2.5 lg:gap-4">
            <Link
              to="/"
              className="hidden rounded-md px-2 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink lg:inline-block"
            >
              Home
            </Link>

            <Link
              to="/about-us"
              className="hidden rounded-md px-2 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink lg:inline-block"
            >
              About Us
            </Link>

            {/* Click-to-toggle, not CSS :hover — the desktop-only affordance the client asked to
                avoid relying on for touch devices. Desktop-only (hidden below lg) because mobile
                gets its own expandable Catalog group in the drawer instead (see below). */}
            <div ref={catalogMenuRef} className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => setCatalogMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={catalogMenuOpen}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink"
              >
                Catalog
                <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${catalogMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {catalogMenuOpen && (
                <div
                  role="menu"
                  aria-label="Catalog"
                  className="absolute left-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
                >
                  <Link
                    to="/catalog/camping-packages"
                    role="menuitem"
                    onClick={() => setCatalogMenuOpen(false)}
                    className="block px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-strong"
                  >
                    Packages
                  </Link>
                  <Link
                    to="/catalog/build-your-own"
                    role="menuitem"
                    onClick={() => setCatalogMenuOpen(false)}
                    className="block px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-strong"
                  >
                    Build Your Own
                  </Link>
                </div>
              )}
            </div>

            <Link
              to="/plan-an-event"
              className="hidden rounded-md px-2 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink lg:inline-block"
            >
              Plan An Event
            </Link>

            {user && (
              // Inline from `lg` up only. Below that, My Bookings is the menu drawer's own entry
              // (see mobileNavLinks) — it used to also sit inline here at every width, so a
              // signed-in phone header carried it twice while squeezing a named account pill,
              // theme toggle, cart and menu button into the same row.
              <Link
                to="/my-bookings"
                className="hidden whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink lg:inline-block"
              >
                My Bookings
              </Link>
            )}

            <ThemeToggle />

            <Link
              to="/cart"
              aria-label={`Cart, ${cartItemCount} item${cartItemCount === 1 ? '' : 's'}`}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink sm:h-10 sm:w-10"
            >
              <CartIcon className="h-5 w-5" />
              {cartItemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-forest px-1 text-[10px] font-semibold text-white">
                  {cartItemCount}
                </span>
              )}
            </Link>

            {/* Signed in, the account pill becomes the menu trigger itself (replacing the separate
                top-bar Profile link that used to sit alongside it) — the customer's own name is
                the affordance, matching the "[User Name ▾] → Profile / Log out" pattern. Signed
                out it stays exactly what it was: a plain link to /login. */}
            {user ? (
              <div ref={accountMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                  // The visible name is hidden on the narrowest phones (see the span below), so the
                  // accessible name can't rely on it — this keeps the button announced as the
                  // account menu for that customer at every width.
                  aria-label={`Account menu for ${displayName}`}
                  className="flex h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-strong sm:px-3"
                >
                  <UserIcon className="h-4 w-4 shrink-0" />
                  {/* Icon-only below `sm`: on a 375px phone a truncated name was the widest thing
                      in the row and the reason it got crowded. The dropdown still opens from the
                      same button, so nothing is lost. */}
                  <span className="hidden max-w-[7rem] truncate sm:inline">{displayName}</span>
                  <ChevronDownIcon
                    className={`h-3.5 w-3.5 shrink-0 transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {accountMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Account"
                    className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
                  >
                    <Link
                      to="/profile"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                      className="block px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-strong"
                    >
                      Profile
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        // Dropdown closes first so the confirmation dialog isn't competing with an
                        // open menu (and an outside-click on the dialog can't reopen anything).
                        setAccountMenuOpen(false);
                        setShowLogoutConfirm(true);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-surface-strong"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="flex h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-strong sm:px-3"
              >
                <span className="hidden sm:inline">Login / Sign Up</span>
                <span className="sm:hidden">Login</span>
              </Link>
            )}

            {/* Every inline link above is `hidden lg:…` — this toggle and the drawer below are the
             * way to reach them at every width that hides them, so nothing is ever unreachable. */}
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-drawer"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink sm:h-10 sm:w-10 lg:hidden"
            >
              {menuOpen ? <XMarkIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </nav>
        </div>

        {menuOpen && (
          // Capped to the space below the header and scrollable on its own, so on a short
          // landscape phone the menu never runs past the bottom of the screen.
          <div
            id="mobile-nav-drawer"
            className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line-soft bg-surface lg:hidden"
          >
            <nav aria-label="Main" className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-3 sm:px-6">
              <Link to="/" className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-strong">
                Home
              </Link>
              <Link to="/about-us" className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-strong">
                About Us
              </Link>

              {/* Expandable, not a flat link — this is mobile's own non-hover way into the same
                  two catalog routes the desktop dropdown offers (see the client's explicit "use an
                  appropriate expandable menu rather than relying on desktop hover" instruction). */}
              <button
                type="button"
                onClick={() => setMobileCatalogOpen((prev) => !prev)}
                aria-expanded={mobileCatalogOpen}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-strong"
              >
                Catalog
                <ChevronDownIcon className={`h-4 w-4 transition-transform ${mobileCatalogOpen ? 'rotate-180' : ''}`} />
              </button>
              {mobileCatalogOpen && (
                <div className="flex flex-col gap-1 pl-4">
                  <Link
                    to="/catalog/camping-packages"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink"
                  >
                    Packages
                  </Link>
                  <Link
                    to="/catalog/build-your-own"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink"
                  >
                    Build Your Own
                  </Link>
                </div>
              )}

              {mobileNavLinks(user)
                .filter((link) => link.to !== '/' && link.to !== '/about-us')
                .map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-strong"
                  >
                    {link.label}
                  </Link>
                ))}

              {/* The always-on social strip below is desktop-only now, so it lives here instead
                  on smaller screens — still one tap away, without spending a permanent row of
                  sticky header height on three icons. */}
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-line-soft px-3 pt-3">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Follow us</span>
                <div className="flex items-center gap-1">
                  <SocialLinks className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-strong hover:text-accent" />
                </div>
              </div>
            </nav>
          </div>
        )}
      </div>

      <div className="hidden border-b border-line-soft bg-surface-muted lg:block">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3 px-6 py-1.5">
          <SocialLinks className="flex h-6 w-6 items-center justify-center rounded-full text-ink-faint transition-colors hover:text-accent" />
        </div>
      </div>

      {/* The same ConfirmDialog the rest of the site already uses for consequential actions —
          logging out from the header is one click away from anywhere, so it asks first. */}
      <ConfirmDialog
        open={showLogoutConfirm}
        title="Log out?"
        message="Are you sure you want to log out?"
        confirmLabel="Log Out"
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={handleSignOut}
      />
    </header>
  );
}
