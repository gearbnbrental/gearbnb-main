import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PasswordInput from '../components/PasswordInput';
import { useAuth } from '../context/AuthContext';
import { isPasswordValid, MIN_PASSWORD_LENGTH } from '../utils/passwordPolicy';

/**
 * Supabase reports a dead recovery link by redirecting back here with its reason in the URL
 * *fragment* (e.g. `#error=access_denied&error_code=otp_expired&error_description=...`) rather than
 * by establishing a session. Nothing reads that fragment on its own, so without this the customer
 * lands on a blank/loading page with no hint that the link they just clicked was the problem.
 * Returns a friendly reason, or null when the URL carries no error at all.
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
    return 'This password reset link is invalid or has expired. Please request a new one.';
  }
  return 'This password reset link is invalid or has expired. Please request a new one.';
}

/** Strips the auth fragment/query from the address bar once it has been read — those parameters
 *  are single-use, and leaving them in place means a refresh (or a shared/bookmarked URL) replays
 *  the same stale error, or re-attempts to consume an already-used code. Never touches the path
 *  itself. */
function clearAuthParamsFromUrl(): void {
  window.history.replaceState(null, '', window.location.pathname);
}

/** How long to wait for Supabase's client to process the URL and fire PASSWORD_RECOVERY before
 *  concluding the link is dead — covers the normal case (near-instant) without leaving a customer
 *  staring at a spinner forever if the link genuinely doesn't carry a valid recovery session (e.g.
 *  the customer navigated here directly, with nothing in the URL at all). */
const RECOVERY_DETECTION_TIMEOUT_MS = 4000;

/**
 * The dedicated landing page for a customer arriving with an authorized password recovery
 * session: clicking the link in Supabase's recovery email (tokens arrive in the URL, detected
 * automatically by supabase-js — see AuthContext's onAuthStateChange), which fires the Supabase
 * PASSWORD_RECOVERY event. This page only ever reacts to `passwordRecoveryActive` (see
 * AuthContext), the one authority for "is this customer actually authorized to set a new password
 * right now." A customer who lands here with no valid recovery session (a dead link, or just
 * navigating here directly) sees an explicit error and a way back to request a new one — never a
 * silent redirect elsewhere, and never a form that looks available but can't actually succeed.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const { passwordRecoveryActive, resetPassword } = useAuth();

  const [linkError, setLinkError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Runs once on arrival: a link that Supabase rejected never fires PASSWORD_RECOVERY, so this is
  // the only signal that the customer clicked an expired/used link rather than simply navigating
  // here themselves (or arriving via a just-verified code, which carries no URL params at all).
  useEffect(() => {
    const readError = readRecoveryLinkError();
    if (!readError) return;
    setLinkError(readError);
    clearAuthParamsFromUrl();
  }, []);

  // Covers the "navigated here directly, no recovery session at all" case — see
  // RECOVERY_DETECTION_TIMEOUT_MS's own comment. Cleared/made moot the instant
  // passwordRecoveryActive actually becomes true, since the timeout's only job is deciding
  // whether to show the fallback error, and the render below already prioritizes the real form
  // over it once recovery is genuinely active.
  useEffect(() => {
    if (passwordRecoveryActive) return;
    const timer = setTimeout(() => setTimedOut(true), RECOVERY_DETECTION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [passwordRecoveryActive]);

  async function handleSubmit() {
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
    // The actual, authoritative call — only ever reachable once Supabase has confirmed a genuine
    // recovery session exists (resetPassword itself re-checks this via getSession()). Success is
    // shown only after this resolves with no error, never optimistically beforehand.
    const result = await resetPassword(newPassword);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex justify-center px-5 py-8 sm:min-h-[calc(100vh-80px)] sm:items-center sm:px-6">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-xl sm:p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="font-serif text-xl font-semibold text-ink">Your password has been reset successfully.</h1>
            <p className="text-sm text-ink-muted">
              You've been signed out everywhere for your security. Please log in again with your new password.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="h-11 rounded-lg bg-brand-forest px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
            >
              Go to Log In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // A dead link (explicit Supabase error) or a timed-out wait for one that never arrived — either
  // way, no recovery session exists, so the form below must never render. Never a silent redirect
  // to another page: the customer gets a clear reason and the one correct next step.
  if (!passwordRecoveryActive && (linkError || timedOut)) {
    return (
      <div className="flex justify-center px-5 py-8 sm:min-h-[calc(100vh-80px)] sm:items-center sm:px-6">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-xl sm:p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="font-serif text-xl font-semibold text-ink">Reset Link Invalid</h1>
            <p className="text-sm text-ink-muted">
              {linkError ?? 'This password reset link is invalid or has expired. Please request a new one.'}
            </p>
            <Link
              to="/forgot-password"
              className="h-11 flex items-center justify-center rounded-lg bg-brand-forest px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
            >
              Request a New Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!passwordRecoveryActive) {
    // Brief window before Supabase's client has processed the URL (or before timedOut fires) —
    // deliberately quiet rather than a branded spinner, since this is normally on screen for a
    // fraction of a second.
    return <div className="min-h-[calc(100vh-80px)]" aria-hidden="true" />;
  }

  return (
    <div className="flex justify-center px-5 py-8 sm:min-h-[calc(100vh-80px)] sm:items-center sm:px-6">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
        <div className="flex flex-col gap-4 p-6 sm:p-8">
          <div className="flex flex-col gap-1 text-center">
            <h1 className="font-serif text-xl font-semibold text-ink">Reset Password</h1>
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
            <span className="text-sm font-medium text-ink">Confirm Password</span>
            <PasswordInput
              value={confirmNewPassword}
              onChange={setConfirmNewPassword}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
            />
          </label>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="h-11 w-full rounded-lg bg-brand-forest px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Updating…' : 'Reset Password'}
          </button>
        </div>
      </div>
    </div>
  );
}
