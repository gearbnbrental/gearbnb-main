/**
 * The only password rule this app can confirm Supabase Auth actually enforces server-side is a
 * minimum length — this mirrors the existing `minLength={6}` already on the signup password
 * input (Login.tsx), which is the one piece of real evidence of the configured policy available
 * from this codebase. There is no Supabase dashboard read-API reachable from the browser to
 * confirm anything stricter, so nothing else here is ever treated as a submission-blocking
 * requirement — see isPasswordValid and each PasswordRequirement's own `required` flag. Character-
 * class criteria are shown to the customer as strength guidance only, never invented as a hard
 * Supabase-side rule.
 */
export const MIN_PASSWORD_LENGTH = 6;

export interface PasswordRequirement {
  key: 'length' | 'uppercase' | 'lowercase' | 'number' | 'special';
  label: string;
  met: boolean;
  /** True only for the one rule Supabase actually enforces (`length`) — everything else is
   * advisory strength guidance the UI must present as "recommended," never as required. */
  required: boolean;
}

/** Live checklist shown while the customer types. Only `length` is `required: true` — see the
 * module comment for why nothing else is ever treated as a real submission requirement. */
export function evaluatePasswordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      key: 'length',
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      met: password.length >= MIN_PASSWORD_LENGTH,
      required: true,
    },
    { key: 'uppercase', label: 'Use uppercase letters', met: /[A-Z]/.test(password), required: false },
    { key: 'lowercase', label: 'Use lowercase letters', met: /[a-z]/.test(password), required: false },
    { key: 'number', label: 'Use a number', met: /[0-9]/.test(password), required: false },
    { key: 'special', label: 'Use a special character', met: /[^A-Za-z0-9]/.test(password), required: false },
  ];
}

/** The actual, enforced submission gate — matches Supabase's real configured minimum
 * (MIN_PASSWORD_LENGTH). A password that satisfies this is a password Supabase's own signUp call
 * would accept on length grounds; this function never rejects anything Supabase itself would
 * allow, and never requires anything beyond length. */
export function isPasswordValid(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

export type PasswordStrength = 'empty' | 'weak' | 'acceptable' | 'strong';

/** Purely advisory scoring for the "weak / acceptable / strong" indicator — never used to block
 * submission (see isPasswordValid). A password that doesn't even meet the real minimum length is
 * always 'weak' regardless of how many other (advisory) criteria it happens to satisfy — calling
 * an unsubmittable password "acceptable" or "strong" would be misleading. Otherwise scores by how
 * many of the 5 checklist criteria (length included) are met. */
export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) return 'empty';
  if (!isPasswordValid(password)) return 'weak';
  const metCount = evaluatePasswordRequirements(password).filter((r) => r.met).length;
  if (metCount >= 5) return 'strong';
  if (metCount >= 3) return 'acceptable';
  return 'weak';
}
