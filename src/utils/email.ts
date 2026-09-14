/**
 * Email rules for customer accounts created with an email + password on this site.
 *
 * Deliberately scoped to *registration*: a Google sign-in never goes through these checks (Supabase
 * receives that identity straight from Google — see AuthContext.signInWithGoogle), so a Google
 * Workspace customer whose address isn't @gmail.com is unaffected. Sign-in is likewise not gated,
 * so an account that predates this rule can still reach its own bookings.
 */

/** The one domain email/password registration accepts. */
export const ALLOWED_EMAIL_DOMAIN = 'gmail.com';

const BASIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Shape check only — never a claim the mailbox exists. */
export function isValidEmailFormat(email: string): boolean {
  return BASIC_EMAIL_PATTERN.test(email.trim());
}

/**
 * True only for a well-formed address on the allowed domain. Case-insensitive (addresses are
 * typed however the customer types them) and whitespace-tolerant, and checks the domain as the
 * whole part after the final "@" rather than a suffix match — "evil-gmail.com" and
 * "gmail.com.attacker.net" both end up rejected, where an endsWith('gmail.com') test would let the
 * first one through.
 */
export function isAllowedRegistrationEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  if (!isValidEmailFormat(trimmed)) return false;
  const domain = trimmed.slice(trimmed.lastIndexOf('@') + 1);
  return domain === ALLOWED_EMAIL_DOMAIN;
}

/** The single piece of copy shown wherever a non-Gmail address is rejected, so the wording can't
 *  drift between the form and the auth layer's own guard. */
export const REGISTRATION_EMAIL_ERROR = `Please register with a Gmail address (ending in @${ALLOWED_EMAIL_DOMAIN}).`;
