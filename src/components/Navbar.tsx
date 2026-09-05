import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRental } from '../context/RentalContext';
import { UserIcon } from './icons';
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

export default function Navbar() {
  const { cart } = useRental();
  const { user, displayName } = useAuth();
  const cartItemCount = cart.selectedKits.length + cart.selectedItems.length;

  return (
    <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur">
      <div className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/brand_assets/GEARBNB_logo.png" alt="" className="h-12 w-12 rounded-full shadow-sm" />
            <span className="font-serif text-xl font-bold tracking-tight text-brand-forest">GearBNB</span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/"
              className="hidden rounded-md px-2 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink sm:inline-block"
            >
              Home
            </Link>

            <Link
              to="/about"
              className="hidden rounded-md px-2 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink sm:inline-block"
            >
              About
            </Link>

            {user && (
              <Link
                to="/my-bookings"
                className="hidden rounded-md px-2 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink sm:inline-block"
              >
                My Bookings
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

            <Link
              to="/login"
              className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-strong"
            >
              {user ? (
                <>
                  <UserIcon className="h-4 w-4 shrink-0" />
                  <span className="max-w-[8rem] truncate sm:max-w-[10rem]">{displayName}</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Login / Sign Up</span>
                  <span className="sm:hidden">Login</span>
                </>
              )}
            </Link>
          </nav>
        </div>
      </div>

      <div className="border-b border-line-soft bg-surface-muted">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-3 px-4 py-1.5 sm:justify-end sm:px-6">
          <SocialLinks className="flex h-6 w-6 items-center justify-center rounded-full text-ink-faint transition-colors hover:text-brand-forest" />
        </div>
      </div>
    </header>
  );
}
