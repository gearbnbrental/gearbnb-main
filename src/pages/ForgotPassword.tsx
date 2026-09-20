import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const INPUT_CLASS =
  'h-11 rounded-lg border border-line px-3 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20';

/** Client-side "Resend" cooldown — UX pacing only; Supabase enforces the real rate limit
 *  server-side regardless of what this timer shows. */
const RESEND_COOLDOWN_MS = 60_000;

/** Always the same wording regardless of whether the email actually has an account — see
 *  AuthContext.requestPasswordReset's own doc comment (Supabase's resetPasswordForEmail already
 *  resolves the same way either way; this mirrors that anti-enumeration behavior in the UI). */
const GENERIC_SENT_MESSAGE = 'If an account is associated with this email, a password reset link has been sent.';

/**
 * Forgot Password — this page's only job is REQUESTING a reset email; it never itself sets a new
 * password. `src/pages/ResetPassword.tsx` (the `redirectTo` target of `requestPasswordReset`
 * below) is the single dedicated landing page for "a recovery session now exists, choose a new
 * password" — reached only by clicking the link in that email, which Supabase attaches recovery
 * tokens to. That click fires the Supabase `PASSWORD_RECOVERY` event, which `AuthContext` picks up
 * and ResetPassword.tsx renders its form off of; this page has no code-entry alternative to that —
 * the emailed link is the only way back in.
 */
export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();

  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);

  async function sendResetEmail() {
    await requestPasswordReset(email.trim());
    setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
  }

  async function handleEmailSubmit() {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setSubmitting(true);
    await sendResetEmail();
    setSubmitting(false);
    // Always advances regardless of whether the email actually has an account — see
    // GENERIC_SENT_MESSAGE's own comment (the actual anti-enumeration mitigation).
    setSent(true);
  }

  async function handleResend() {
    if (Date.now() < resendAvailableAt) return;
    setError(null);
    setSubmitting(true);
    await sendResetEmail();
    setSubmitting(false);
  }

  const resendCountdown = Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));

  // Same reasoning as Login.tsx's identical wrapper — vertical centering only from `sm` up.
  return (
    <div className="flex justify-center px-5 py-8 sm:min-h-[calc(100vh-80px)] sm:items-center sm:px-6">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
        <div className="flex flex-col gap-4 p-6 sm:p-8">
          {!sent ? (
            <>
              <div className="flex flex-col gap-1 text-center">
                <h1 className="font-serif text-xl font-semibold text-ink">Forgot Password</h1>
                <p className="text-sm text-ink-muted">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>
              {error && (
                <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
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
                type="button"
                onClick={handleEmailSubmit}
                disabled={submitting}
                className="h-11 w-full rounded-lg bg-brand-forest px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Sending…' : 'Send Reset Link'}
              </button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1 text-center">
                <h1 className="font-serif text-xl font-semibold text-ink">Check Your Email</h1>
                <p className="text-sm text-ink-muted">{GENERIC_SENT_MESSAGE}</p>
              </div>
              {error && (
                <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                  {error}
                </p>
              )}
              <p className="text-center text-xs text-ink-faint">
                Didn't get the email?{' '}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={submitting || resendCountdown > 0}
                  className="font-medium text-accent underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:no-underline"
                >
                  {resendCountdown > 0 ? `Resend link (0:${String(resendCountdown).padStart(2, '0')})` : 'Resend link'}
                </button>
              </p>
            </>
          )}

          <p className="text-center text-xs text-ink-faint">
            <Link to="/login" className="font-medium text-accent underline underline-offset-2">
              Back to Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
