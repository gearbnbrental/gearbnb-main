import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { consumeOAuthReturnPath, useAuth } from '../context/AuthContext';
import { CheckCircleIcon } from '../components/icons';
import ConfirmDialog from '../components/ConfirmDialog';
import PasswordInput from '../components/PasswordInput';
import PhoneNumberInput from '../components/PhoneNumberInput';
import { useFailedAttempts } from '../hooks/useFailedAttempts';
import { isAllowedRegistrationEmail, REGISTRATION_EMAIL_ERROR } from '../utils/email';
import {
  evaluatePasswordRequirements,
  getPasswordStrength,
  isPasswordValid,
  MIN_PASSWORD_LENGTH,
  type PasswordRequirement,
  type PasswordStrength,
} from '../utils/passwordPolicy';
import { isValidPhoneNumber, normalizePhoneNumber } from '../utils/phone';

type Mode = 'login' | 'signup';

/** Client-side "Resend email" cooldown — UX pacing only; Supabase enforces the real rate limit
 *  server-side regardless of what this timer shows. */
const RESEND_COOLDOWN_MS = 60_000;

const INPUT_CLASS =
  'h-11 rounded-lg border border-line px-3 text-sm text-ink shadow-sm outline-none transition-colors focus:border-brand-forest focus:ring-2 focus:ring-brand-forest/20';

function CircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  empty: '',
  weak: 'Weak',
  acceptable: 'Acceptable',
  strong: 'Strong',
};

const STRENGTH_TEXT_COLOR: Record<PasswordStrength, string> = {
  empty: '',
  weak: 'text-red-600 dark:text-red-400',
  acceptable: 'text-amber-700 dark:text-amber-300',
  strong: 'text-accent',
};

const STRENGTH_BAR_COLOR: Record<PasswordStrength, string> = {
  empty: 'bg-line',
  weak: 'bg-red-500',
  acceptable: 'bg-amber-500',
  strong: 'bg-brand-forest',
};

/** How many of the 4 strength-bar segments are filled for a given strength — purely visual,
 * derived from the same evaluatePasswordRequirements/getPasswordStrength this app already uses
 * elsewhere, never a second scoring system. */
const STRENGTH_BAR_SEGMENTS_FILLED: Record<PasswordStrength, number> = {
  empty: 0,
  weak: 1,
  acceptable: 3,
  strong: 4,
};

/** Compact, always-visible replacement for the old full checklist block — a 4-segment strength
 * meter plus a one-word label. Shown only once the customer has started typing a password. */
function PasswordStrengthBar({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  if (strength === 'empty') return null;

  const filled = STRENGTH_BAR_SEGMENTS_FILLED[strength];

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 gap-1" role="img" aria-label={`Password strength: ${STRENGTH_LABEL[strength]}`}>
        {Array.from({ length: 4 }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              index < filled ? STRENGTH_BAR_COLOR[strength] : 'bg-line'
            }`}
          />
        ))}
      </div>
      <span className={`shrink-0 text-xs font-medium ${STRENGTH_TEXT_COLOR[strength]}`}>
        {STRENGTH_LABEL[strength]}
      </span>
    </div>
  );
}

function RequirementRow({ requirement }: { requirement: PasswordRequirement }) {
  return (
    <li className={`flex items-center gap-2 text-xs ${requirement.met ? 'text-accent' : 'text-ink-faint'}`}>
      {requirement.met ? (
        <CheckCircleIcon className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <CircleIcon className="h-3.5 w-3.5 shrink-0" />
      )}
      <span>{requirement.label}</span>
    </li>
  );
}

/**
 * Floating hint panel — replaces the old permanently-inline checklist. Only rendered while the
 * password field is focused (see the `passwordFocused` state in Login below), and absolutely
 * positioned so it overlays the space below the field instead of pushing the rest of the form
 * down. Only "Required" (the real Supabase-enforced minimum length) can ever block submission;
 * everything under "Recommended" is strength guidance only — see passwordPolicy.ts.
 */
function PasswordRequirementsHint({ password }: { password: string }) {
  const requirements = evaluatePasswordRequirements(password);
  const requiredItems = requirements.filter((r) => r.required);
  const recommendedItems = requirements.filter((r) => !r.required);

  return (
    <div className="absolute inset-x-0 top-full z-20 mt-1.5 flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-3 shadow-lg">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Required</span>
        <ul className="flex flex-col gap-1">
          {requiredItems.map((requirement) => (
            <RequirementRow key={requirement.key} requirement={requirement} />
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
          Recommended for a stronger password
        </span>
        <ul className="flex flex-col gap-1">
          {recommendedItems.map((requirement) => (
            <RequirementRow key={requirement.key} requirement={requirement} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.39l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

/** Shared outer shell — centers a single elevated card vertically and horizontally in the
 * viewport (accounting for the sticky navbar above it), and gives it the same desktop two-column
 * split (a hero image beside the content) whether that content is the auth form or the
 * already-signed-in state, so the page never jumps between two different layouts. */
function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-5 py-8 sm:px-6">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
        {children}
      </div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { from?: string; mode?: Mode; reason?: string } | null;
  const redirectTo = locationState?.from ?? '/';
  // Set by AuthRequiredMessage (and any other auth-gated action) so the customer always sees why
  // they landed on this page instead of the one they wanted — never a bare, unexplained redirect.
  const authReason = locationState?.reason ?? null;
  const { user, needsEmailVerification, signUp, signIn, signInWithGoogle, signOut, resendEmailConfirmation } =
    useAuth();

  const [mode, setMode] = useState<Mode>(locationState?.mode ?? 'login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // True between "Sign Up" submit and the customer actually confirming — see performSignup.
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  // Set to the submitted email the moment signUp() reports Supabase requires email confirmation —
  // shows the "check your inbox" screen instead of the ordinary form until they come back with a
  // confirmed session (or explicitly go back). No session exists yet at this point.
  const [pendingEmailConfirmation, setPendingEmailConfirmation] = useState<string | null>(null);
  // Resend is disabled until this timestamp — a real client-side cooldown UX on top of (never a
  // replacement for) Supabase's own server-side rate limiting.
  const [emailResendAvailableAt, setEmailResendAvailableAt] = useState(0);
  const [emailResendCountdown, setEmailResendCountdown] = useState(0);
  const [emailResendSubmitting, setEmailResendSubmitting] = useState(false);
  const [emailResendMessage, setEmailResendMessage] = useState<string | null>(null);

  // Separate keys so a mistyped login password never paces out the signup form. UX pacing only —
  // Supabase's own server-side rate limiting is the real protection (see the hook's doc comment).
  const loginAttempts = useFailedAttempts('gearbnb-login-attempts');
  const signupAttempts = useFailedAttempts('gearbnb-signup-attempts');
  const { lockoutRemainingSeconds, registerFailedAttempt, clearFailedAttempts } =
    mode === 'login' ? loginAttempts : signupAttempts;

  // Live "Resend email (0:42)" countdown — shared by both the pre-session "check your inbox"
  // screen and the (rare, defensive) post-session needsEmailVerification screen below, so a
  // customer can't spam either resend button. Ticks only while one of those screens is actually
  // showing, so no timer runs in the background the rest of the time this component is mounted.
  useEffect(() => {
    if (!pendingEmailConfirmation && !needsEmailVerification) return;
    const tick = () => setEmailResendCountdown(Math.max(0, Math.ceil((emailResendAvailableAt - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [pendingEmailConfirmation, needsEmailVerification, emailResendAvailableAt]);

  // A session landing (e.g. the customer confirmed their email in another tab and this one's
  // storage-backed session picks it up) means there's no more "pending" (no-session) email screen
  // to show — needsEmailVerification above takes over instead if the session itself still isn't
  // confirmed, otherwise the customer proceeds straight into the app.
  useEffect(() => {
    if (user) setPendingEmailConfirmation(null);
  }, [user]);

  // Runs once the session actually lands — covers both a fresh Google sign-in (which always
  // redirects back to /login itself; see AuthContext.signInWithGoogle) and, harmlessly, a normal
  // return visit to an already-authenticated session. consumeOAuthReturnPath only returns a value
  // when signInWithGoogle actually stashed one, so a customer who just visits /login directly
  // while already signed in still sees the ordinary "You're Logged In" screen below, unchanged.
  useEffect(() => {
    if (!user) return;
    const returnPath = consumeOAuthReturnPath();
    if (returnPath) navigate(returnPath, { replace: true });
  }, [user, navigate]);

  // Live, on every keystroke — neither waits for the field to lose focus, matching the "while
  // typing" behavior the rest of the password guide already follows.
  const passwordsMatch = mode === 'signup' && confirmPassword.length > 0 && password === confirmPassword;
  const passwordMismatch = mode === 'signup' && confirmPassword.length > 0 && password !== confirmPassword;
  const passwordStrength = getPasswordStrength(password);

  async function handleGoogleClick() {
    setFormError(null);
    setGoogleSubmitting(true);
    // On success this navigates the whole page away to Google and back — there's no local state
    // to update here for that case. Only a failure (e.g. the provider isn't enabled yet) returns.
    const result = await signInWithGoogle(redirectTo);
    if (result.error) {
      setFormError(result.error);
      setGoogleSubmitting(false);
    }
  }

  function handleModeSwitch(nextMode: Mode) {
    setMode(nextMode);
    setFormError(null);
    setConfirmPassword('');
    setShowSignupConfirm(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (lockoutRemainingSeconds > 0) {
      setFormError(`Too many failed attempts. Please wait ${lockoutRemainingSeconds}s before trying again.`);
      return;
    }

    if (mode === 'signup') {
      // Gmail-only, enforced before the Supabase call. AuthContext.signUp re-checks this
      // independently so the rule holds even if some other caller skips this form (see its own
      // comment) — a Google sign-in never passes through either check.
      if (!isAllowedRegistrationEmail(email)) {
        setFormError(REGISTRATION_EMAIL_ERROR);
        return;
      }
      // Contact information only, not an authentication factor — GearBnB still needs a real
      // Philippine mobile number to reach the renter, so this is still validated/normalized
      // client-side before the account is created.
      if (!isValidPhoneNumber(phone)) {
        setFormError('Enter a valid Philippine mobile number.');
        return;
      }
      // Blocked before the Supabase call even happens — matches the actual enforced policy
      // (see passwordPolicy.ts) rather than inventing a stricter client-only rule.
      if (!isPasswordValid(password)) {
        setFormError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }
      if (password !== confirmPassword) {
        setFormError('Passwords do not match.');
        return;
      }
      // The account isn't created yet — this only reveals the confirmation step below, which
      // shows exactly what was entered (name/email/phone, never the password) and requires an
      // explicit "Create Account" click before performSignup actually calls Supabase.
      setShowSignupConfirm(true);
      return;
    }

    setSubmitting(true);
    const result = await signIn(email, password);
    if (result.error) {
      setFormError(result.error);
      registerFailedAttempt();
    } else {
      clearFailedAttempts();
      navigate(redirectTo);
    }
    setSubmitting(false);
  }

  async function performSignup() {
    setFormError(null);
    setSubmitting(true);

    // Already validated by handleSubmit before this step was ever reachable. Phone is contact
    // information only here — signUp stores it as account metadata, nothing more; it never
    // triggers any verification step of its own (see signUp's own doc comment in AuthContext).
    const normalizedPhone = normalizePhoneNumber(phone)!;
    const result = await signUp(email, password, fullName, normalizedPhone);
    setShowSignupConfirm(false);
    if (result.error) {
      setFormError(result.error);
      // Only counted here, never for the client-side validation failures in handleSubmit — a
      // mistyped email format or a too-short password is the customer correcting themselves, not
      // a failed registration attempt, and must not pace them out.
      registerFailedAttempt();
    } else if (result.needsEmailConfirmation) {
      clearFailedAttempts();
      // No session exists yet — Supabase won't issue one until this email is confirmed. The
      // "check your inbox" screen below picks this up and takes over from here.
      setPendingEmailConfirmation(email);
      setEmailResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
      setPassword('');
      setConfirmPassword('');
    } else {
      // A session was issued immediately (this project's "Confirm email" setting is currently
      // off) — the account is fully usable right away, nothing further required.
      navigate(redirectTo);
    }

    setSubmitting(false);
  }

  // Shared by both the pre-session "check your inbox" screen (pendingEmailConfirmation) and the
  // defensive post-session needsEmailVerification screen below — same action, different source
  // for which email to resend to.
  async function handleResendEmailConfirmation(targetEmail: string | undefined) {
    if (!targetEmail || Date.now() < emailResendAvailableAt) return;
    setEmailResendMessage(null);
    setEmailResendSubmitting(true);
    const result = await resendEmailConfirmation(targetEmail);
    setEmailResendSubmitting(false);
    if (result.error) {
      setEmailResendMessage(result.error);
      return;
    }
    setEmailResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
    setEmailResendMessage('Confirmation email resent — check your inbox.');
  }

  // Shown the moment signUp() reports Supabase requires email confirmation — no session exists
  // yet (checked before every other branch below, all of which assume `user` might be set).
  if (pendingEmailConfirmation) {
    return (
      <AuthPageShell>
        <div className="flex flex-col gap-4 p-6 sm:p-8">
          <div className="flex flex-col gap-1 text-center">
            <h1 className="font-serif text-xl font-semibold text-ink">Verify your email address</h1>
            <p className="text-sm text-ink-muted">
              We sent a confirmation link to <span className="font-medium text-ink">{pendingEmailConfirmation}</span>.
              Open it to confirm your email, then come back here to log in.
            </p>
          </div>

          {emailResendMessage && (
            <p className="rounded-lg border border-brand-forest/30 bg-brand-forest/10 px-3 py-2 text-sm text-accent">
              {emailResendMessage}
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleResendEmailConfirmation(pendingEmailConfirmation ?? undefined)}
            disabled={emailResendSubmitting || emailResendCountdown > 0}
            className="h-11 w-full rounded-lg bg-brand-forest px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {emailResendSubmitting
              ? 'Sending…'
              : emailResendCountdown > 0
                ? `Resend email (0:${String(emailResendCountdown).padStart(2, '0')})`
                : 'Resend confirmation email'}
          </button>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setPendingEmailConfirmation(null);
                setMode('login');
              }}
              className="font-medium text-ink-muted underline underline-offset-2"
            >
              Back to Log In
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingEmailConfirmation(null);
                setMode('signup');
              }}
              className="font-medium text-ink-muted underline underline-offset-2"
            >
              Wrong email?
            </button>
          </div>
        </div>
      </AuthPageShell>
    );
  }

  // Defensive backstop — see needsEmailVerification's own doc comment on the interface. Reachable
  // only for a session whose email is somehow still unconfirmed (a fresh signup normally never
  // gets a session at all until confirmed, so this is not the everyday path). Checked BEFORE the
  // plain "You're Logged In" branch below, since it already has a real session and would
  // otherwise short-circuit straight past this.
  if (needsEmailVerification && user?.email) {
    return (
      <AuthPageShell>
        <div className="flex flex-col gap-4 p-6 sm:p-8">
          <div className="flex flex-col gap-1 text-center">
            <h1 className="font-serif text-xl font-semibold text-ink">Verify your email address</h1>
            <p className="text-sm text-ink-muted">
              Please confirm <span className="font-medium text-ink">{user.email}</span> before continuing — check
              your inbox for the confirmation link, or request a new one below.
            </p>
          </div>

          {emailResendMessage && (
            <p className="rounded-lg border border-brand-forest/30 bg-brand-forest/10 px-3 py-2 text-sm text-accent">
              {emailResendMessage}
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleResendEmailConfirmation(user.email)}
            disabled={emailResendSubmitting || emailResendCountdown > 0}
            className="h-11 w-full rounded-lg bg-brand-forest px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {emailResendSubmitting
              ? 'Sending…'
              : emailResendCountdown > 0
                ? `Resend email (0:${String(emailResendCountdown).padStart(2, '0')})`
                : 'Resend confirmation email'}
          </button>

          <button
            type="button"
            onClick={() => void signOut()}
            className="text-center text-xs font-medium text-ink-muted underline underline-offset-2"
          >
            Log Out
          </button>
        </div>
      </AuthPageShell>
    );
  }

  if (user) {
    return (
      <AuthPageShell>
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center sm:p-10">
          <h1 className="font-serif text-xl font-semibold text-ink">You're Logged In</h1>
          <p className="text-sm text-ink-muted">Signed in as {user.email}</p>
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="h-11 rounded-lg border border-line bg-surface px-6 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-strong"
          >
            Log Out
          </button>

          <ConfirmDialog
            open={showLogoutConfirm}
            title="Log out of your account?"
            message="You will need to sign in again to access your account."
            confirmLabel="Log Out"
            destructive
            onCancel={() => setShowLogoutConfirm(false)}
            onConfirm={async () => {
              await signOut();
              setShowLogoutConfirm(false);
            }}
          />
        </div>
      </AuthPageShell>
    );
  }

  // Confirmation step before the account is actually created — shows only what was entered
  // (name/email), NEVER the password, per requirement. The account isn't created until "Create
  // Account" below explicitly calls performSignup.
  if (showSignupConfirm) {
    return (
      <AuthPageShell>
        <div className="flex flex-col gap-4 p-6 sm:p-8">
          <div className="flex flex-col gap-1 text-center">
            <h1 className="font-serif text-xl font-semibold text-ink">Create your GearBnB account?</h1>
            <p className="text-sm text-ink-muted">Please review your details before we create your account.</p>
          </div>

          <dl className="flex flex-col gap-2 rounded-lg border border-line bg-surface-muted p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-muted">Name</dt>
              <dd className="truncate font-medium text-ink">{fullName}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-muted">Email</dt>
              <dd className="truncate font-medium text-ink">{email}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-muted">Mobile Number</dt>
              <dd className="truncate font-medium text-ink">{phone}</dd>
            </div>
          </dl>

          {formError && (
            <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
              {formError}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setShowSignupConfirm(false)}
              disabled={submitting}
              className="h-11 flex-1 rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={performSignup}
              disabled={submitting}
              className="h-11 flex-1 rounded-lg bg-brand-forest px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <div className="flex flex-col gap-4 p-6 sm:p-8">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="font-serif text-xl font-semibold text-ink">
            {mode === 'login' ? 'Log In' : 'Create an Account'}
          </h1>
          <p className="text-sm text-ink-muted">
            {mode === 'login' ? 'Welcome back to GearBnB.' : 'Sign up to track your bookings faster.'}
          </p>
        </div>

        {authReason && (
          <p className="rounded-lg border border-brand-forest/30 bg-brand-forest/10 px-3 py-2 text-sm text-accent">
            {authReason}
          </p>
        )}

        <div className="inline-flex w-full rounded-lg border border-line bg-surface-muted p-1">
          <button
            type="button"
            onClick={() => handleModeSwitch('login')}
            aria-pressed={mode === 'login'}
            className={`flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === 'login' ? 'bg-brand-forest text-white shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('signup')}
            aria-pressed={mode === 'signup'}
            className={`flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === 'signup' ? 'bg-brand-forest text-white shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Sign Up
          </button>
        </div>

        {formError && (
          <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            {formError}
          </p>
        )}

        <button
          type="button"
          onClick={handleGoogleClick}
          disabled={googleSubmitting || submitting}
          className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleIcon className="h-4.5 w-4.5" />
          {googleSubmitting ? 'Connecting…' : 'Continue with Google'}
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">or</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {mode === 'signup' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Full Name</span>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Juan Dela Cruz"
                className={INPUT_CLASS}
              />
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Email Address</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={INPUT_CLASS}
            />
          </label>

          {mode === 'signup' && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Mobile Number</span>
              <PhoneNumberInput value={phone} onChange={setPhone} autoComplete="tel" />
            </div>
          )}

          <label className="relative flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">Password</span>
              {mode === 'login' && (
                <Link to="/forgot-password" className="text-xs font-medium text-accent underline underline-offset-2">
                  Forgot password?
                </Link>
              )}
            </div>
            <PasswordInput
              value={password}
              onChange={setPassword}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={MIN_PASSWORD_LENGTH}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
            {/* Compact, always-visible strength meter — replaces the old full-height checklist. */}
            {mode === 'signup' && <PasswordStrengthBar password={password} />}
            {/* Detailed requirements only surface as a floating hint while the field is actively
             * focused, and only while there's still something to satisfy — never permanently
             * inline, and never shown once the password is already strong. */}
            {mode === 'signup' && passwordFocused && passwordStrength !== 'strong' && (
              <PasswordRequirementsHint password={password} />
            )}
          </label>

          {mode === 'signup' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Confirm Password</span>
              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                invalid={passwordMismatch}
              />
              {passwordMismatch && (
                <span className="text-xs font-medium text-red-600 dark:text-red-400">Passwords do not match.</span>
              )}
              {passwordsMatch && (
                <span className="flex items-center gap-1 text-xs font-medium text-accent">
                  <CheckCircleIcon className="h-3.5 w-3.5 shrink-0" />
                  Passwords match
                </span>
              )}
            </label>
          )}

          {lockoutRemainingSeconds > 0 && (
            <p
              role="alert"
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300"
            >
              Too many failed attempts. Please wait {lockoutRemainingSeconds}s before trying again.
            </p>
          )}

          <button
            type="submit"
            disabled={
              submitting ||
              googleSubmitting ||
              lockoutRemainingSeconds > 0 ||
              (mode === 'signup' && (!isPasswordValid(password) || password !== confirmPassword))
            }
            className="mt-1 h-11 w-full rounded-lg bg-brand-forest px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Sign Up'}
          </button>
        </form>

        <p className="text-center text-xs text-ink-faint">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => handleModeSwitch('signup')}
                className="font-medium text-accent underline underline-offset-2"
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => handleModeSwitch('login')}
                className="font-medium text-accent underline underline-offset-2"
              >
                Log in
              </button>
            </>
          )}
        </p>

        <p className="text-center text-xs text-ink-faint">
          Just want to look around first?{' '}
          <button
            type="button"
            onClick={() => navigate('/catalog')}
            className="font-medium text-accent underline underline-offset-2"
          >
            Browse the catalog
          </button>
          .
        </p>
      </div>
    </AuthPageShell>
  );
}
