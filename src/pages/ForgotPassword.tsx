import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PasswordInput from '../components/PasswordInput';
import { useAuth } from '../context/AuthContext';
import { isPasswordValid, MIN_PASSWORD_LENGTH } from '../utils/passwordPolicy';

/**
 * Supabase reports a dead recovery link by redirecting back here with its reason in the URL
 * *fragment* (e.g. `#error=access_denied&error_code=otp_expired&error_description=...`) rather than
 * by establishing a session. Nothing reads that fragment on its own, so without this the customer
 * lands on a plain "Forgot Password" form with no hint that the link they just clicked was the
 * problem — they retype their email and get the same dead end. Returns a friendly reason, or null
 * when the URL carries no error at all.
 */
function readRecoveryLinkError(): string | null {
  if (typeof window === 'undefined') return null;
  // Fragment first (where Supabase actually puts it), then query, so either shape is handled.
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const errorCode = hash.get('error_code') ?? query.get('error_code');
  const error = hash.get('error') ?? query.get('error');
  if (!errorCode && !error) return null;

  if (errorCode === 'otp_expired' || errorCode === 'expired_token') {
    return 'That password reset link has expired. Request a new one below.';
  }
  return 'That password reset link is invalid or has already been used. Request a new one below.';
}

/** Strips the auth fragment/query from the address bar once it has been read — those parameters
 *  are single-use, and leaving them in place means a refresh (or a shared/bookmarked URL) replays
 *  the same stale error. Never touches the path itself. */
function clearAuthParamsFromUrl(): void {
  window.history.replaceState(null, '', window.location.pathname);
}

const INPUT_CLASS =
  'h-11 rounded-lg border border-line px-3 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20';

/** Client-side "Resend" cooldown — UX pacing only; Supabase enforces the real rate limit
 *  server-side regardless of what this timer shows. */
const RESEND_COOLDOWN_MS = 60_000;

/** Always the same wording regardless of whether the email actually has an account — see
 *  AuthContext.requestPasswordReset's own doc comment (Supabase's resetPasswordForEmail already
 *  resolves the same way either way; this mirrors that anti-enumeration behavior in the UI). */
const GENERIC_SENT_MESSAGE = 'If an account is associated with this email, a password reset link has been sent.';

type Step = 'email' | 'sent' | 'done';

/**
 * Forgot Password — recovery by email, using Supabase Auth's native `resetPasswordForEmail` +
 * recovery-link flow end to end (no custom reset tokens: Supabase generates, emails, and verifies
 * the link itself). See AuthContext's requestPasswordReset/passwordRecoveryActive/resetPassword
 * for the exact calls and why each step is shaped the way it is.
 *
 * The "set a new password" step is driven directly by `passwordRecoveryActive` (true only once
 * Supabase's client has actually detected a genuine recovery link in the URL and fired its
 * PASSWORD_RECOVERY event — see AuthContext), not by this component's own local `step` state, so
 * it renders correctly however the customer arrives here: clicking the emailed link opens a fresh
 * tab/session where `step` would otherwise still be its default 'email'.
 */
export default function ForgotPassword() {
  const navigate = useNavigate();
  const { requestPasswordReset, passwordRecoveryActive, resetPassword } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);

  // Runs once on arrival: a link that Supabase rejected never fires PASSWORD_RECOVERY, so this is
  // the only signal that the customer clicked an expired/used link rather than simply navigating
  // here themselves.
  useEffect(() => {
    const linkError = readRecoveryLinkError();
    if (!linkError) return;
    setError(linkError);
    clearAuthParamsFromUrl();
  }, []);

  async function sendResetLink() {
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
    await sendResetLink();
    setSubmitting(false);
    // Always advances regardless of whether the email actually has an account — see
    // GENERIC_SENT_MESSAGE's own comment (the actual anti-enumeration mitigation).
    setStep('sent');
  }

  async function handleResend() {
    if (Date.now() < resendAvailableAt) return;
    setSubmitting(true);
    await sendResetLink();
    setSubmitting(false);
  }

  async function handlePasswordSubmit() {
    setError(null);
    if (!isPasswordValid(newPassword)) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    const result = await resetPassword(newPassword);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setStep('done');
  }

  const resendCountdown = Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-5 py-8 sm:px-6">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
        <div className="flex flex-col gap-4 p-6 sm:p-8">
          {passwordRecoveryActive && step !== 'done' ? (
            <>
              <div className="flex flex-col gap-1 text-center">
                <h1 className="font-serif text-xl font-semibold text-ink">Set a New Password</h1>
                <p className="text-sm text-ink-muted">Choose a new password for your account.</p>
              </div>
              {error && (
                <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                  {error}
                </p>
              )}
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">New Password</span>
                <PasswordInput
                  value={newPassword}
                  onChange={setNewPassword}
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Confirm New Password</span>
                <PasswordInput
                  value={confirmNewPassword}
                  onChange={setConfirmNewPassword}
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                />
              </label>
              <button
                type="button"
                onClick={handlePasswordSubmit}
                disabled={submitting}
                className="h-11 w-full rounded-lg bg-brand-forest px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Updating…' : 'Update Password'}
              </button>
            </>
          ) : (
            <>
              {step === 'email' && (
                <>
                  <div className="flex flex-col gap-1 text-center">
                    <h1 className="font-serif text-xl font-semibold text-ink">Forgot Password</h1>
                    <p className="text-sm text-ink-muted">
                      Enter the email address on your account and we'll send you a password reset link.
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
              )}

              {step === 'sent' && (
                <>
                  <div className="flex flex-col gap-1 text-center">
                    <h1 className="font-serif text-xl font-semibold text-ink">Check Your Email</h1>
                    <p className="text-sm text-ink-muted">{GENERIC_SENT_MESSAGE}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={submitting || resendCountdown > 0}
                    className="h-11 w-full rounded-lg bg-brand-forest px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting
                      ? 'Sending…'
                      : resendCountdown > 0
                        ? `Resend link (0:${String(resendCountdown).padStart(2, '0')})`
                        : 'Resend link'}
                  </button>
                </>
              )}

              {step === 'done' && (
                <div className="flex flex-col items-center gap-3 text-center">
                  <h1 className="font-serif text-xl font-semibold text-ink">Password Updated</h1>
                  <p className="text-sm text-ink-muted">
                    Your password has been changed and you've been signed out everywhere for your security. Please
                    log in again with your new password.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="h-11 rounded-lg bg-brand-forest px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
                  >
                    Go to Log In
                  </button>
                </div>
              )}

              {step !== 'done' && (
                <p className="text-center text-xs text-ink-faint">
                  <Link to="/login" className="font-medium text-accent underline underline-offset-2">
                    Back to Log In
                  </Link>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
