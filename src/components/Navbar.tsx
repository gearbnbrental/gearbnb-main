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
    { to: '/event-plan', label: 'Plan An Event' },
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

  async function handleSignOut() {
    await signOut();
    setShowLogoutConfirm(false);
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur">
      <div className="border-b border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-2 gap-y-1 px-5 py-3 sm:px-6">
          {/* shrink-0: "GearBnB" is one unbreakable word, so a tight flex row (e.g. once My
              Bookings became always-visible below) would otherwise compress this box past its own
              text's minimum width, making the text overflow its box instead of shrinking — the
              row now wraps (flex-wrap above) rather than ever letting that happen again. */}
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <img src="/brand_assets/GEARBNB_logo.png" alt="" className="h-12 w-12 rounded-full shadow-sm" />
            {/* brand-forest reads fine on this header's light-mode surface, but the same dark green
                on the dark-mode surface is low-contrast — dark:text-ink switches it to this site's
                normal near-white dark-mode text color, per the client's explicit "branding text
                should also appear white in Dark Mode" request. Footer's own "GearBnB" wordmark
                needs no equivalent change — it already sits on a constant brand-brown band in
                brand-cream (an off-white), which never dims in dark mode. */}
            <span className="font-serif text-xl font-bold tracking-tight text-brand-forest dark:text-ink">GearBnB</span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-4">
            <Link
              to="/"
              className="hidden rounded-md px-2 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink sm:inline-block"
            >
              Home
            </Link>

            <Link
              to="/about-us"
              className="hidden rounded-md px-2 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink sm:inline-block"
            >
              About Us
            </Link>

            {/* Click-to-toggle, not CSS :hover — the desktop-only affordance the client asked to
                avoid relying on for touch devices. Desktop-only (hidden below sm) because mobile
                gets its own expandable Catalog group in the drawer instead (see below). */}
            <div ref={catalogMenuRef} className="relative hidden sm:block">
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
                    to="/catalog/path-a"
                    role="menuitem"
                    onClick={() => setCatalogMenuOpen(false)}
                    className="block px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-strong"
                  >
                    Packages
                  </Link>
                  <Link
                    to="/catalog/path-b"
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
              to="/event-plan"
              className="hidden rounded-md px-2 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink sm:inline-block"
            >
              Plan An Event
            </Link>

            {user && (
              // Deliberately visible at every width, unlike Home/About above — this is the only
              // way into My Bookings, so hiding it below `sm` left mobile customers with just the
              // account pill (which routes to /login and shows "You're Logged In" once signed in,
              // not a bookings list) as their sole clickable "account" entry point. Shortened
              // label + no-wrap below `sm`, matching the Login/Sign Up pill's own responsive text
              // swap just below, so it never wraps onto the logo row.
              <Link
                to="/my-bookings"
                className="whitespace-nowrap rounded-md px-1.5 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink sm:px-2"
              >
                <span className="sm:hidden">Bookings</span>
                <span className="hidden sm:inline">My Bookings</span>
              </Link>
            )}

            <ThemeToggle />

            <Link
              to="/cart"
              aria-label={`Cart, ${cartItemCount} item${cartItemCount === 1 ? '' : 's'}`}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink"
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
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-strong sm:px-3"
                >
                  <UserIcon className="h-4 w-4 shrink-0" />
                  <span className="max-w-[8rem] truncate sm:max-w-[10rem]">{displayName}</span>
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
                className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-strong sm:px-3"
              >
                <span className="hidden sm:inline">Login / Sign Up</span>
                <span className="sm:hidden">Login</span>
              </Link>
            )}

            {/* Home/About are `hidden sm:inline-block` above — without this, a phone-width visitor
             * has no way at all to reach About (or explicitly back to Home). This toggle + the
             * drawer below are that access, scoped to exactly the widths that need it. */}
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-drawer"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink sm:hidden"
            >
              {menuOpen ? <XMarkIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </nav>
        </div>

        {menuOpen && (
          <div id="mobile-nav-drawer" className="border-t border-line-soft bg-surface sm:hidden">
            <nav className="mx-auto flex max-w-5xl flex-col gap-1 px-5 py-3">
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
                    to="/catalog/path-a"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink"
                  >
                    Packages
                  </Link>
                  <Link
                    to="/catalog/path-b"
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
            </nav>
          </div>
        )}
      </div>

      <div className="border-b border-line-soft bg-surface-muted">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-3 px-5 py-1.5 sm:justify-end sm:px-6">
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
