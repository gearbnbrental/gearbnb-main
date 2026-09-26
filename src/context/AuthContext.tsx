import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '../supabase';
import { isAllowedRegistrationEmail, REGISTRATION_EMAIL_ERROR } from '../utils/email';

interface AuthResult {
  error: string | null;
  /** True when signUp succeeded but the account needs email confirmation before it can log in. */
  needsEmailConfirmation?: boolean;
}

interface AuthContextValue {
  user: User | null;
  /** First name from metadata, falling back to the email's local part, then "Account". */
  displayName: string;
  loading: boolean;
  /** True while a signed-in session's email isn't confirmed yet — derived directly from
   *  Supabase's own `email_confirmed_at`, never a custom flag. Under normal operation this is
   *  effectively unreachable for a fresh signup: when this project's "Confirm email" setting is
   *  enabled, Supabase issues no session at all until the email is confirmed (see signUp's own
   *  `needsEmailConfirmation` branch below) — there is no in-between "has a session but email
   *  unconfirmed" state for a new account. This exists as a defensive backstop for any other
   *  session that somehow lacks it (e.g. an account created before email confirmation was
   *  required), so "must be email-verified" is enforced consistently regardless of how the
   *  session was established — see Login.tsx and App.tsx's route-level guard. */
  needsEmailVerification: boolean;
  /** `phone` is required — this is customer contact information only (GearBnB needs a number to
   *  reach the renter), never an authentication factor. Stored as account metadata; nothing here
   *  sends an SMS or requires phone verification of any kind. Must already be normalized (see
   *  ../utils/phone) before calling this. */
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  /** Starts the existing Supabase Auth Google OAuth flow — this redirects the whole page to
   *  Google and back, so on success there is nothing further for the caller to do: the redirect
   *  lands back in this same app, and the `onAuthStateChange` subscription below picks up the new
   *  session the same way it already does for email/password sign-in. Only returns for the
   *  failure case (e.g. the Google provider isn't enabled for this Supabase project yet).
   *
   *  `redirectPath` is where the customer should end up once signed in (e.g. the checkout page
   *  they were on) — but the actual OAuth `redirectTo` sent to Supabase always targets `/login`
   *  itself (see OAUTH_RETURN_PATH_KEY below), never that deep path directly. Google's redirect
   *  back to this app is a full top-level browser navigation, not a client-side route change — if
   *  the production static host isn't configured to rewrite every path to index.html (a separate,
   *  outside-this-repo hosting concern), a direct navigation to a deep SPA route like `/checkout`
   *  can 404 before this app ever loads to process the returned session. `/login` is the one path
   *  guaranteed to already be reachable (it's literally the page this button is clicked from), so
   *  `redirectPath` is stashed here and consumed by Login.tsx once the session actually lands. */
  signInWithGoogle: (redirectPath?: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  /** Re-sends the signup confirmation email via Supabase's own `resend` API — never a second
   *  email system. Only meaningful for an account that signed up but hasn't confirmed its email
   *  yet; Supabase itself is the one that decides whether that's still true. */
  resendEmailConfirmation: (email: string) => Promise<AuthResult>;
  /** Forgot-password step 1: Supabase's native `resetPasswordForEmail` — sends a password-reset
   *  link if an account with that email exists. Never reveals whether one does: this is Supabase's
   *  own built-in anti-enumeration behavior for this method (it resolves the same way either way),
   *  not something this app has to fake. Never throws. */
  requestPasswordReset: (email: string) => Promise<void>;
  /** True once the customer has actually completed a genuine Supabase password-recovery step —
   *  set from the `PASSWORD_RECOVERY` auth event Supabase's client fires when it detects recovery
   *  tokens in the URL (the emailed-link flow) — never from just "a session happens to exist"
   *  (which could be an unrelated, already-logged-in session in the same browser). ResetPassword.tsx
   *  gates its actual password form behind this. */
  passwordRecoveryActive: boolean;
  /** Sets the new password for the current (recovery) session, then signs out of every session
   *  for this account via Supabase's own `scope: 'global'` sign-out — a previously-compromised
   *  session can never remain valid after a password reset. The caller should redirect to /login
   *  afterward so the customer signs back in with the new password. */
  resetPassword: (newPassword: string) => Promise<AuthResult>;
  /** Updates the signed-in customer's own display name and contact phone — plain
   *  `updateUser({data})` metadata, the same fields signUp already writes. Never touches email
   *  (see the Profile page's own comment on why email stays read-only) or password. */
  updateProfile: (fullName: string, phone: string) => Promise<AuthResult>;
  /** Changes the signed-in customer's password. Reauthenticates with `currentPassword` first via
   *  Supabase's own `signInWithPassword` — the standard Supabase-supported way to confirm "this is
   *  really you" before a sensitive change, never a custom check — and only calls
   *  `updateUser({password})` if that succeeds. Rejects with a generic "incorrect" message on
   *  failure, never distinguishing "wrong password" from any other reauth failure. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
}

/** sessionStorage (not localStorage — this only needs to survive the single OAuth round trip, not
 *  linger indefinitely) key for the path to return to after a Google sign-in lands back on
 *  /login. See signInWithGoogle's own comment and Login.tsx's consumeOAuthReturnPath usage. */
const OAUTH_RETURN_PATH_KEY = 'gearbnb-oauth-return-path';

/** The customer website's own production origin — the fallback OAuth return target, used only if
 *  the running origin somehow isn't a customer origin at all (see resolveCustomerOrigin). */
const CUSTOMER_PRODUCTION_ORIGIN = 'https://gearbnbrental.com';

/**
 * Hostnames belonging to the SEPARATE RMS/Admin application, which shares this Supabase project
 * but is never a valid destination for a *customer* sign-in. A customer who authenticates here
 * must always come back to the customer site; landing on the admin app's dashboard instead is the
 * exact regression this list exists to make structurally impossible.
 */
const RMS_ADMIN_HOSTNAMES = new Set([
  'admin.gearbnbrental.com',
  'gearbnb-rms-lxt3.vercel.app',
]);

/**
 * The origin an OAuth sign-in should return to. Deliberately derived from the *running* origin
 * (window.location.origin) rather than a hardcoded URL, so local dev (http://localhost:5177), a
 * temporary Cloudflare tunnel preview, and production (https://gearbnbrental.com) each return to
 * themselves with no per-environment configuration — a hardcoded dev URL would otherwise ship into
 * production behavior.
 *
 * Never reads a redirect target from a query parameter or any other user-supplied input: the only
 * two possible values are this app's own origin or the trusted constant above, so an attacker
 * can't turn a sign-in link into an open redirect.
 *
 * The RMS guard is a backstop, not the normal path — if this code is ever somehow served from an
 * admin hostname, sending a *customer* session there is never correct, so it falls back to the
 * customer production origin instead.
 */
function resolveCustomerOrigin(): string {
  if (typeof window === 'undefined') return CUSTOMER_PRODUCTION_ORIGIN;
  const { origin, hostname } = window.location;
  if (RMS_ADMIN_HOSTNAMES.has(hostname)) return CUSTOMER_PRODUCTION_ORIGIN;
  // The RMS dev server's own port — never where a customer sign-in started, but guarded for the
  // same reason as the hostnames above.
  if (hostname === 'localhost' && window.location.port === '3000') return CUSTOMER_PRODUCTION_ORIGIN;
  return origin;
}

/** Reads and clears the path stashed by signInWithGoogle, or null if there isn't one (e.g. the
 *  customer just visited /login directly while already signed in — not a post-OAuth landing).
 *  Exported for Login.tsx to consume once `user` becomes truthy after landing back on /login. */
export function consumeOAuthReturnPath(): string | null {
  try {
    const path = sessionStorage.getItem(OAUTH_RETURN_PATH_KEY);
    if (path) sessionStorage.removeItem(OAUTH_RETURN_PATH_KEY);
    return path;
  } catch {
    return null;
  }
}

/** How long the startup session check waits for `getUser()`'s round trip to Supabase before
 *  giving up on it — see `getUserWithTimeout` below for why this exists at all. Long enough that
 *  normal mobile latency (a few seconds on a slow connection) never trips it, short enough that a
 *  genuinely stalled request can't leave the app's `loading` flag — and every page gated on it
 *  (Checkout, Profile, My Bookings) — stuck blank for more than a few extra seconds. */
const GET_USER_TIMEOUT_MS = 8000;

/**
 * `supabase.auth.getUser()` round-trips to Supabase to validate the stored token; on a stalled
 * mobile connection that request can hang indefinitely — it never resolves *or* rejects, so a
 * plain `.catch()` around it (which only runs on rejection) does nothing to save it. `Promise.race`
 * against a plain timer is used here rather than an `AbortController`: supabase-js's `getUser()`
 * takes no abort signal, so there's nothing to cancel the underlying request with — the loser of
 * the race is simply left to resolve on its own and its result is discarded, which is harmless
 * since nothing downstream ever reads it. On a timeout this resolves to the same shape a real "no
 * verified user" answer would have, which the caller already treats as "could not confirm this
 * session" — never as authenticated.
 */
function getUserWithTimeout(): Promise<{ user: User | null; timedOut: boolean }> {
  return Promise.race([
    supabase.auth.getUser().then(({ data, error }) => ({ user: error ? null : data.user, timedOut: false })),
    new Promise<{ user: null; timedOut: true }>((resolve) => {
      setTimeout(() => resolve({ user: null, timedOut: true }), GET_USER_TIMEOUT_MS);
    }),
  ]);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getDisplayName(user: User | null): string {
  if (!user) return 'Account';

  const firstName = user.user_metadata?.first_name;
  if (typeof firstName === 'string' && firstName.trim() !== '') {
    return capitalize(firstName.trim());
  }

  // Our own signup form only collects one "Full Name" field, stored as full_name.
  const fullName = user.user_metadata?.full_name;
  if (typeof fullName === 'string' && fullName.trim() !== '') {
    return capitalize(fullName.trim().split(/\s+/)[0]);
  }

  const emailLocalPart = user.email?.split('@')[0];
  if (emailLocalPart) {
    return capitalize(emailLocalPart);
  }

  return 'Account';
}

/** Maps raw Supabase Auth error text to a customer-friendly message. Exported so Login.tsx can
 *  reuse the exact same expired/invalid-link classification for a failed email-confirmation
 *  redirect (Supabase returns the failure as `error`/`error_description` hash params on that
 *  redirect, rather than as a thrown error from a function call) instead of duplicating this
 *  pattern-matching a second time. */
export function friendlyAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) {
    return 'Incorrect email or password.';
  }
  // Supabase's own server-side rate limiting — the real brute-force protection behind this form
  // (see useFailedAttempts, whose in-browser counter is UX pacing only). Surfaced in plain terms
  // rather than as a raw 429.
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'Too many attempts. Please wait a few minutes before trying again.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Please confirm your email before logging in, check your inbox for the confirmation link.';
  }
  if (normalized.includes('already registered') || normalized.includes('already exists')) {
    // Deliberately non-committal — never states outright that this exact email has an account
    // (account-enumeration risk); a genuine account holder still gets an actionable next step.
    return "We couldn't complete this registration. If you already have an account with this email, try logging in instead.";
  }
  // Generic token/link errors — covers both an expired/invalid email confirmation link and an
  // expired/invalid password-recovery link (both go through the same kind of Supabase token).
  if (normalized.includes('token has expired') || normalized.includes('otp expired') || normalized.includes('expired')) {
    return 'That link has expired. Please request a new one.';
  }
  if (normalized.includes('invalid token') || normalized.includes('invalid otp') || normalized.includes('token is invalid')) {
    return 'That link is invalid. Please request a new one.';
  }
  // Raised by updateUser when no (or no longer valid) session backs the request — for the recovery
  // flow that always means the link is spent, so it must never surface as raw SDK text.
  if (normalized.includes('auth session missing') || normalized.includes('session not found')) {
    return 'Your password reset link has expired or is no longer valid. Please request a new one.';
  }
  // Supabase rejects reusing the current password on some projects — actionable, not an error the
  // customer should have to decode.
  if (normalized.includes('should be different from the old password')) {
    return 'Your new password must be different from your current password.';
  }
  return message;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecoveryActive, setPasswordRecoveryActive] = useState(false);
  /** Synchronous mirror of passwordRecoveryActive for the startup session check — see its use. */
  const recoveryDetectedRef = useRef(false);
  /**
   * True from the moment any REAL post-load auth change (sign-in, sign-out, a background token
   * refresh, etc. — anything except the automatic `INITIAL_SESSION` event onAuthStateChange fires
   * on registration) lands — see the listener below and the startup check's own use of this. Once
   * true, the startup check's verification of whatever session existed at PAGE LOAD must never
   * overwrite `session` again: it can take several seconds (getUser()'s round trip, up to
   * GET_USER_TIMEOUT_MS), and a customer who explicitly signs in — or out — while it's still in
   * flight would otherwise have that correct, brand-new session silently reverted back to
   * whatever stale session was sitting in storage before, with no visible error. This is exactly
   * how a customer's own explicit, correct login could end up submitting a booking under a
   * different, stale account's contact details: RentalContext's per-account cart reacts to this
   * same `user`, and reverting it would load THAT stale account's persisted cart (including its
   * verificationDocs.fullName/phone) right along with it.
   */
  const sessionUpdatedByEventRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    // getSession() only reads whatever is already in localStorage — it does NOT verify the token
    // against Supabase, so a session left over from an expired/revoked refresh token (e.g. the
    // browser was closed for weeks, or the account was signed out elsewhere) still looks "valid"
    // to it. Every other Supabase call this app makes (including plain public catalog reads —
    // see supabaseCatalog.ts) attaches that same stored access token to its request regardless,
    // so a broken-but-present session doesn't just fail auth-only features: it makes ordinary
    // public reads come back 401, which upstream code mistakes for "the table errored" and
    // silently falls back to mock catalog data — which then looks like the customer's real cart
    // items no longer exist, and permanently wipes their persisted cart on the very next save.
    // getUser() (unlike getSession()) round-trips to Supabase and actually validates the token, so
    // it's used here once at startup to catch exactly that case and sign the broken session out
    // before anything else reads it.
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (!data.session) {
        setLoading(false);
        return;
      }
      const { user: verifiedUser, timedOut } = await getUserWithTimeout();
      if (cancelled) return;
      if (timedOut) {
        // Genuinely undetermined, not "invalid" — unlike the branch below (where Supabase itself
        // authoritatively answered "this token doesn't verify"), a timeout means the check simply
        // never got an answer in time. Never sign out on this alone (that would actively destroy a
        // session that may well still be perfectly valid); just stop loading and leave `session`
        // untouched (null on a fresh load, matching the network-rejection catch below) so the app
        // renders its normal signed-out state for this load instead of staying blank forever. A
        // customer whose session really is valid simply re-verifies on their next navigation/reload.
        console.warn('[AuthContext] Session verification timed out; treating as signed out for this load.');
        setLoading(false);
        return;
      }
      if (!verifiedUser) {
        // Never sign out on top of a recovery link that landed while this check was in flight.
        // Arriving at /reset-password from a reset email with a STALE session already in
        // localStorage races these two paths: this chain starts with the old (invalid) token and
        // would resolve to "sign out", while supabase-js concurrently parses the recovery tokens
        // out of the URL and establishes a brand-new, valid recovery session. Without this guard
        // the late sign-out destroys that fresh session, and the customer gets "Auth session
        // missing" the moment they submit their new password.
        //
        // Same reasoning applies to any other real auth event (see sessionUpdatedByEventRef's own
        // comment) — a customer who explicitly signed in or out while this stale verification was
        // still in flight already has the correct, newer state; this check must not undo it.
        if (recoveryDetectedRef.current || sessionUpdatedByEventRef.current) {
          setLoading(false);
          return;
        }
        await supabase.auth.signOut();
        if (cancelled) return;
        setSession(null);
      } else if (!sessionUpdatedByEventRef.current) {
        // Guarded the same way — see sessionUpdatedByEventRef's own comment above. `data.session`
        // was captured at the very start of this chain, before getUser()'s round trip; committing
        // it here after a real sign-in/sign-out already happened in the meantime would silently
        // revert `session` back to whatever was in storage at page load.
        setSession(data.session);
      }
      setLoading(false);
    }).catch(() => {
      // getSession()/getUser()/signOut() above can reject outright on a genuine network-layer
      // failure (not an auth error — those already resolve as {error} and are handled above; this
      // is a dropped connection, a timeout, anything that throws rather than answers) — previously
      // nothing caught that, so `loading` stayed true forever and every route gated on it (e.g.
      // Checkout's `if (authLoading) return null`) rendered blank permanently. Deliberately does
      // NOT touch `session` here: it's already whatever it was before this attempt (null on a
      // fresh load), so a failed check safely resolves to "treat as signed out" without this
      // fabricating or clearing a session that was never actually confirmed either way.
      if (!cancelled) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Excludes only the automatic INITIAL_SESSION event fired on registration (which reflects
      // the exact same page-load session the startup check above is independently verifying, not
      // a genuine change) — everything else here (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED,
      // USER_UPDATED, PASSWORD_RECOVERY, ...) is a real post-load change and makes this listener's
      // own session update authoritative from here on. See sessionUpdatedByEventRef's own comment.
      if (event !== 'INITIAL_SESSION') {
        sessionUpdatedByEventRef.current = true;
      }
      setSession(newSession);
      // LATCHED deliberately: PASSWORD_RECOVERY turns it on, and only a sign-out turns it back
      // off. It must NOT be recomputed from each event as `event === 'PASSWORD_RECOVERY'`, because
      // supabase-js keeps firing other events at this same listener afterwards — TOKEN_REFRESHED
      // from the background auto-refresh timer, SIGNED_IN, a repeat INITIAL_SESSION. Any one of
      // those would flip this back to false while the customer was still typing their new
      // password, and ResetPassword.tsx renders its actual password form directly off this flag
      // — so the form would vanish mid-reset and drop them back on the "invalid/expired link"
      // state with their recovery session silently unused. That is the reset-never-completes bug.
      //
      // A stray already-logged-in session in the same browser still can't trigger this: nothing
      // but a genuine recovery link makes supabase-js emit PASSWORD_RECOVERY in the first place.
      if (event === 'PASSWORD_RECOVERY') {
        // Set synchronously (a ref, not just the state above) so the in-flight startup session
        // check can see it immediately — see its own comment on the race this prevents.
        recoveryDetectedRef.current = true;
        setPasswordRecoveryActive(true);
      } else if (event === 'SIGNED_OUT') {
        recoveryDetectedRef.current = false;
        // resetPassword's own scope:'global' sign-out lands here once the new password is saved,
        // which is exactly when the recovery window should close.
        setPasswordRecoveryActive(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  const needsEmailVerification = Boolean(user && !user.email_confirmed_at);

  async function signUp(email: string, password: string, fullName: string, phone: string): Promise<AuthResult> {
    // Enforced here, not only in the form, so the rule holds for every caller of this context —
    // this is the single place the customer website actually submits a new account to Supabase.
    // Google sign-in never reaches this function (see signInWithGoogle), so OAuth customers on a
    // non-Gmail Google Workspace address are unaffected.
    if (!isAllowedRegistrationEmail(email)) {
      return { error: REGISTRATION_EMAIL_ERROR };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Contact information only — see this function's own doc comment on the interface above.
        // Never used for SMS/OTP; nothing in this app sends a text message.
        data: { full_name: fullName, phone },
        // Without this, Supabase falls back to the project's Dashboard-configured Site URL for
        // the confirmation email's link — and since this Supabase project is shared with the
        // separate RMS/Admin app, that fallback can land a customer confirming their signup on
        // the admin app instead of back here. Same customer-origin guard signInWithGoogle and
        // requestPasswordReset already use, applied to the one auth email call that was missing
        // it. Always /login (never a deeper path) for the same reason resolveCustomerOrigin's own
        // callers already use /login — it's the one path guaranteed reachable regardless of SPA
        // routing/hosting rewrites.
        emailRedirectTo: `${resolveCustomerOrigin()}/login`,
      },
    });

    if (error) return { error: friendlyAuthError(error.message) };

    // Supabase returns an empty identities array (instead of a distinct error) when the email
    // is already registered — a deliberate anti-enumeration behavior on newer projects. The
    // message here mirrors that same anti-enumeration intent: never states outright that this
    // exact email already has an account.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return {
        error: "We couldn't complete this registration. If you already have an account with this email, try logging in instead.",
      };
    }

    // Email confirmation enabled: signUp succeeds but no session is issued until confirmed.
    if (data.user && !data.session) {
      return { error: null, needsEmailConfirmation: true };
    }

    return { error: null };
  }

  async function signIn(email: string, password: string): Promise<AuthResult> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: friendlyAuthError(error.message) };
    return { error: null };
  }

  async function resendEmailConfirmation(email: string): Promise<AuthResult> {
    // Same emailRedirectTo reasoning as signUp above — the resend must land the customer back
    // here too, not wherever the Dashboard's Site URL fallback happens to point.
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${resolveCustomerOrigin()}/login` },
    });
    if (error) return { error: friendlyAuthError(error.message) };
    return { error: null };
  }

  async function signInWithGoogle(redirectPath = '/'): Promise<AuthResult> {
    // Same identity architecture as email/password: Supabase issues the same shape of session and
    // access token regardless of provider, and the RMS resolves the customer from that token's
    // verified auth user id exactly the same way either way (see linkOrCreateCustomer server-side)
    // — nothing provider-specific to plumb through anywhere else in this app.
    try {
      sessionStorage.setItem(OAUTH_RETURN_PATH_KEY, redirectPath);
    } catch {
      // Storage unavailable — the customer just lands on /login itself after signing in, same as
      // visiting /login with nowhere in particular to return to.
    }
    // Always /login on the CUSTOMER origin — never the RMS/Admin app, which shares this Supabase
    // project but is a separate application (see resolveCustomerOrigin). Also always /login rather
    // than redirectPath itself — see this function's own doc comment on the interface above.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${resolveCustomerOrigin()}/login`,
        // Without this, Google silently re-authenticates using whatever Google account session
        // already exists in this browser — no picker, no confirmation — if the customer (or
        // anyone else on a shared device) was previously signed into a *different* Google account
        // there. That's a real, silent way to end up authenticated as an unintended Supabase Auth
        // identity: two different Google accounts sharing an email history can each become their
        // own separate Supabase auth.users row, and nothing on this screen would show the mismatch
        // until a booking under the wrong account turns up. Forcing the chooser every time costs
        // one extra click but makes "which Google account am I using" an explicit choice instead
        // of an invisible one.
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) return { error: friendlyAuthError(error.message) };
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function requestPasswordReset(email: string): Promise<void> {
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        // Same customer-origin rule as the Google flow above — a recovery link must never land a
        // customer on the RMS/Admin app. /reset-password (not /forgot-password) — a dedicated
        // page whose only job is "a recovery session exists, set a new password," so it can never
        // be confused with the request-a-reset form or any other page's own auth-state logic.
        // IMPORTANT: this exact URL (or a matching wildcard, e.g. `<origin>/**`) must be present in
        // the Supabase Dashboard's Authentication -> URL Configuration -> Redirect URLs allowlist.
        // Supabase silently ignores any redirectTo that isn't on that allowlist and falls back to
        // the project's Site URL instead — which is the most likely reason a customer clicking the
        // email link previously landed somewhere else entirely with no reset form in sight.
        redirectTo: `${resolveCustomerOrigin()}/reset-password`,
      });
    } catch {
      // Ignored — resetPasswordForEmail already resolves the same way regardless of whether the
      // email has an account (Supabase's own anti-enumeration behavior for this method); this
      // catch is only a defensive backstop against a network-level failure.
    }
  }

  async function resetPassword(newPassword: string): Promise<AuthResult> {
    // A recovery session (established by the customer clicking the emailed link) is what
    // authorizes this change — checked explicitly so an expired/already-used link produces an
    // actionable message instead of Supabase's raw "Auth session missing!" text.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return {
        error: 'Your password reset request has expired or is no longer valid. Please request a new one.',
      };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: friendlyAuthError(error.message) };
    // The real "invalidate previous sessions" step: Supabase's own scope:'global' sign-out revokes
    // every refresh token for this account — including the one this very recovery flow just
    // established — server-side. A compromised session from before the reset can never remain
    // valid; the customer simply logs back in fresh with the new password afterward.
    await supabase.auth.signOut({ scope: 'global' });
    return { error: null };
  }

  async function updateProfile(fullName: string, phone: string): Promise<AuthResult> {
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName, phone } });
    if (error) return { error: friendlyAuthError(error.message) };
    return { error: null };
  }

  // useCallback (not a plain function like its siblings above) because, unlike them, it closes
  // over `user` — without this its identity would change every render regardless of whether `user`
  // actually did, which would make it a "changed" dependency of the value memo below on every
  // render and defeat the memoization entirely.
  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
      if (!user?.email) return { error: 'You must be logged in to change your password.' };
      // Reauthentication step: confirms the customer actually knows their current password before
      // a change is allowed to proceed, using Supabase's own signInWithPassword — never a custom
      // check. Signing in again on the same account doesn't disturb the current session; it's
      // simply Supabase's standard mechanism for "prove you still are who you say you are."
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthError) return { error: 'Current password is incorrect.' };

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { error: friendlyAuthError(error.message) };
      return { error: null };
    },
    [user],
  );

  // Memoized so every one of this context's many consumers (nearly every page — Navbar, checkout,
  // My Bookings, Profile, the route guard in App.tsx) doesn't re-render on a fresh object identity
  // whenever AuthProvider itself re-renders for a reason unrelated to auth (e.g. its parent
  // re-rendering). signUp/signIn/signInWithGoogle/signOut/resendEmailConfirmation/
  // requestPasswordReset/resetPassword/updateProfile close over no per-render value (they only call
  // supabase.auth directly), so they don't need to be listed here.
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      displayName: getDisplayName(user),
      loading,
      needsEmailVerification,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      resendEmailConfirmation,
      requestPasswordReset,
      passwordRecoveryActive,
      resetPassword,
      updateProfile,
      changePassword,
    }),
    [user, loading, needsEmailVerification, passwordRecoveryActive, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
