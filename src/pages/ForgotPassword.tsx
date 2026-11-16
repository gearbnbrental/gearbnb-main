import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ChevronIcon, MailIcon } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import { formatCountdown, secondsUntil } from '../utils/countdown';

const INPUT_CLASS =
  'h-11 rounded-lg border border-line px-3 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20';

/** Wait between reset emails. Supabase enforces its own limit server-side; when it asks for a
 *  different wait, that one is used instead (see passwordResetError). */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Forgot Password — this page's only job is REQUESTING a reset email; it never itself sets a new
 * password. `src/pages/ResetPassword.tsx` (the `redirectTo` target of `requestPasswordReset`
 * below) is the single dedicated landing page for "a recovery session now exists, choose a new
 * password" — reached only by clicking the link in that email, which Supabase attaches recovery
 * tokens to. That click fires the Supabase `PASSWORD_RECOVERY` event, which `AuthContext` picks up
 * and ResetPassword.tsx renders its form off of; this page has no code-entry alternative to that —
 * the emailed link is the only way back in.
 *
 * The "check your email" step always reads the same whether or not the email has an account
 * (Supabase answers the same either way): never a hint about who has an account.
 */
export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();

  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const resendCountdown = secondsUntil(resendAvailableAt, now);

  // Ticks once a second, only while the countdown is running.
  useEffect(() => {
    if (resendAvailableAt <= Date.now()) return;
    setNow(Date.now());
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= resendAvailableAt) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendAvailableAt]);

  /** Sends the email; true when it was sent. Supabase's own wait (if any) restarts the countdown. */
  async function sendResetEmail(): Promise<boolean> {
    const result = await requestPasswordReset(email.trim());
    if (result.error) {
      setError(result.error);
      if (result.retryAfterSeconds) setResendAvailableAt(Date.now() + result.retryAfterSeconds * 1000);
      return false;
    }
    setResendAvailableAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    return true;
  }

  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setSubmitting(true);
    const ok = await sendResetEmail();
    setSubmitting(false);
    if (ok) setSent(true);
  }

  async function handleResend() {
    if (resendCountdown > 0) return;
    setError(null);
    setResent(false);
    setSubmitting(true);
    const ok = await sendResetEmail();
    setSubmitting(false);
    setResent(ok);
  }

  function changeEmail() {
    setSent(false);
    setError(null);
    setResent(false);
    // Supabase's wait between reset emails is per address, so a corrected one can go right away.
    setResendAvailableAt(0);
  }

  // Same reasoning as Login.tsx's identical wrapper — vertical centering only from `sm` up.
  return (
    <div className="flex justify-center px-5 py-8 sm:min-h-[calc(100vh-80px)] sm:items-center sm:px-6">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
        {!sent ? (
          <form onSubmit={handleEmailSubmit} noValidate className="flex flex-col gap-4 p-6 sm:p-8">
            <div className="flex flex-col gap-1 text-center">
              <h1 className="font-serif text-2xl font-semibold text-ink">Forgot Password</h1>
              <p className="text-sm text-ink-muted">Enter your email address and we&rsquo;ll send you a link to reset your password.</p>
            </div>
            {error && (
              <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Email Address</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={INPUT_CLASS}
              />
            </label>
            <button
              type="submit"
              disabled={submitting || resendCountdown > 0}
              className="h-11 w-full rounded-lg bg-brand-forest px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Sending…' : resendCountdown > 0 ? `Send Reset Link (${formatCountdown(resendCountdown)})` : 'Send Reset Link'}
            </button>
            <Link to="/login" className="mx-auto flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-accent">
              <ChevronIcon direction="left" className="h-4 w-4" />
              Back to Log In
            </Link>
          </form>
        ) : (
          <div className="flex flex-col items-center gap-5 p-6 text-center sm:p-8">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-forest/10 text-brand-forest">
              <MailIcon className="h-8 w-8" />
            </span>
            <div className="flex flex-col gap-2">
              <h1 className="font-serif text-2xl font-semibold text-ink">Check your email</h1>
              <p className="text-sm text-ink-muted">If an account uses this email, we&rsquo;ve sent it a link to reset your password:</p>
              <p className="break-all rounded-lg bg-surface-muted px-3 py-2 text-sm font-semibold text-ink">{email.trim()}</p>
              <p className="text-xs text-ink-muted">It usually arrives within a minute. Check your spam or promotions folder too.</p>
            </div>

            {error && (
              <p role="alert" className="w-full rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
            {resent && !error && (
              <p role="status" className="w-full rounded-lg border border-brand-forest/20 bg-brand-forest/5 px-3 py-2 text-sm text-brand-forest-dark">
                A new link is on its way.
              </p>
            )}

            <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                onClick={handleResend}
                disabled={submitting || resendCountdown > 0}
                aria-live="polite"
                className="h-11 w-full rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-strong disabled:cursor-not-allowed disabled:text-ink-muted disabled:hover:bg-surface"
              >
                {submitting ? 'Sending…' : resendCountdown > 0 ? `Resend link in ${formatCountdown(resendCountdown)}` : 'Resend link'}
              </button>
              <button type="button" onClick={changeEmail} className="text-sm font-medium text-accent underline-offset-2 hover:underline">
                Use a different email
              </button>
            </div>

            <Link to="/login" className="flex items-center gap-1 border-t border-line pt-4 text-sm font-medium text-ink-muted hover:text-accent">
              <ChevronIcon direction="left" className="h-4 w-4" />
              Back to Log In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
