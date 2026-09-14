import { useNavigate } from 'react-router-dom';

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
      />
    </svg>
  );
}

interface AuthRequiredMessageProps {
  /** Friendly explanation of why this action needs an account — always shown, never a bare
   *  redirect, so the customer knows why they landed here instead of the page they wanted. */
  message?: string;
  /** Path to return to once the customer actually signs in/up — passed through to Login.tsx via
   *  route state, reusing the exact same `from` mechanism every other auth-gated action already
   *  uses (see AuthContext/Login.tsx), never a second redirect system. */
  redirectPath: string;
}

/**
 * The one shared "you need an account for this" gate, used in place of page content wherever a
 * guest reaches an action that requires an authenticated customer (checkout, my bookings, ...).
 * Always a clear, friendly explanation plus both [Log In] and [Sign Up] — never a silent redirect
 * and never just a hidden/disabled button. Both buttons go to the existing /login page (which
 * already supports both modes via its own tab switcher) — this is not a second auth system, just
 * a clearly-labeled entry point into the one that already exists.
 */
export default function AuthRequiredMessage({
  message = 'Please log in or create an account to continue.',
  redirectPath,
}: AuthRequiredMessageProps) {
  const navigate = useNavigate();

  function goToLogin(mode: 'login' | 'signup') {
    navigate('/login', { state: { from: redirectPath, mode, reason: message } });
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-5 py-16 text-center sm:px-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-forest text-white">
        <LockIcon className="h-7 w-7" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-serif text-xl font-semibold text-ink">Account Required</h1>
        <p className="text-sm text-ink-muted">{message}</p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => goToLogin('login')}
          className="rounded-lg bg-brand-forest px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
        >
          Log In
        </button>
        <button
          type="button"
          onClick={() => goToLogin('signup')}
          className="rounded-lg border border-brand-forest bg-brand-forest/10 px-6 py-3 text-sm font-semibold text-accent transition-colors hover:bg-brand-forest/15"
        >
          Sign Up
        </button>
      </div>
    </div>
  );
}
