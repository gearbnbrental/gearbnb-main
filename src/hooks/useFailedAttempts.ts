import { useCallback, useEffect, useState } from 'react';

/**
 * Failed-attempt pacing for the auth forms.
 *
 * READ THIS BEFORE RELYING ON IT AS A SECURITY CONTROL — IT IS NOT ONE.
 *
 * This lives entirely in the browser (React state mirrored into sessionStorage so a refresh
 * doesn't silently reset the count). Anyone who wants to bypass it can clear storage, open a
 * private window, or skip this UI and call the Supabase auth endpoint directly. It exists to give
 * an honest customer immediate, readable feedback — "you've mistyped this five times, wait a
 * moment" — not to stop an attacker.
 *
 * The ACTUAL brute-force protection for this app is Supabase Auth's own server-side rate limiting,
 * which applies per IP regardless of what this browser does and cannot be cleared from the client.
 * A genuinely enforced N-attempts-then-lock rule would need server-side state (an attempts table
 * plus an Edge Function to read/write it), which this project does not have and which cannot be
 * added without backend/database changes.
 *
 * Keep that distinction intact: do not describe this to a customer, or in a report, as if it were
 * the security boundary.
 */

export const MAX_FAILED_ATTEMPTS = 5;

/** How long the form stays paced-out once MAX_FAILED_ATTEMPTS is reached. */
const LOCKOUT_MS = 60_000;

interface StoredState {
  failures: number;
  lockedUntil: number;
}

function read(storageKey: string): StoredState {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return { failures: 0, lockedUntil: 0 };
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      failures: typeof parsed.failures === 'number' ? parsed.failures : 0,
      lockedUntil: typeof parsed.lockedUntil === 'number' ? parsed.lockedUntil : 0,
    };
  } catch {
    // Storage unavailable or holding something unparseable — pacing simply starts over. Never a
    // reason to block the customer, since this was never the real control.
    return { failures: 0, lockedUntil: 0 };
  }
}

function write(storageKey: string, state: StoredState): void {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Ignored for the same reason as above.
  }
}

/**
 * @param storageKey distinct per form, so mistyping a password on the login form never paces out
 *        the registration form (and vice versa).
 */
export function useFailedAttempts(storageKey: string) {
  const [lockedUntil, setLockedUntil] = useState(() => read(storageKey).lockedUntil);
  const [now, setNow] = useState(() => Date.now());

  // Ticks only while a lockout is actually in effect, so the countdown stays live without leaving
  // an interval running for the whole time this form is mounted.
  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const lockoutRemainingSeconds = Math.max(0, Math.ceil((lockedUntil - now) / 1000));

  const registerFailedAttempt = useCallback(() => {
    const current = read(storageKey);
    const failures = current.failures + 1;
    const next: StoredState =
      failures >= MAX_FAILED_ATTEMPTS
        ? { failures: 0, lockedUntil: Date.now() + LOCKOUT_MS }
        : { failures, lockedUntil: 0 };
    write(storageKey, next);
    setLockedUntil(next.lockedUntil);
    setNow(Date.now());
  }, [storageKey]);

  const clearFailedAttempts = useCallback(() => {
    write(storageKey, { failures: 0, lockedUntil: 0 });
    setLockedUntil(0);
  }, [storageKey]);

  return { lockoutRemainingSeconds, registerFailedAttempt, clearFailedAttempts };
}
