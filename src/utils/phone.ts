/**
 * Normalizes a customer-entered mobile number to E.164 (`+<countrycode><number>`, digits only
 * after the leading `+`), or null if it can't be confidently normalized. Philippine mobile numbers
 * get first-class handling of the shapes customers actually type locally (09XXXXXXXXX, 9XXXXXXXXX,
 * 639XXXXXXXXX) — this app's primary market — but is not hardcoded to PH-only: any number already
 * given with an explicit country code (a leading `+` or `00`) is normalized generically instead, so
 * a non-Philippine customer isn't locked out. An ambiguous number with no recognizable country code
 * and no PH-shaped local pattern is rejected rather than silently assumed to be Philippine.
 */
export function normalizePhoneNumber(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (trimmed.startsWith('00')) {
    const digits = trimmed.slice(2).replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  const digitsOnly = trimmed.replace(/\D/g, '');

  // Local PH mobile: 09XXXXXXXXX (11 digits).
  if (/^09\d{9}$/.test(digitsOnly)) {
    return `+63${digitsOnly.slice(1)}`;
  }
  // PH mobile without the leading 0: 9XXXXXXXXX (10 digits).
  if (/^9\d{9}$/.test(digitsOnly)) {
    return `+63${digitsOnly}`;
  }
  // PH mobile already carrying the country code but no +: 639XXXXXXXXX.
  if (/^639\d{9}$/.test(digitsOnly)) {
    return `+${digitsOnly}`;
  }

  return null;
}

export function isValidPhoneNumber(raw: string): boolean {
  return normalizePhoneNumber(raw) !== null;
}

/** Formats an already-normalized E.164 number for display — Philippine numbers get the familiar
 *  "+63 9XX XXX XXXX" spacing; anything else is shown as-is (a generic E.164 string is still
 *  readable without invented grouping this code can't confidently apply to an unknown country). */
export function formatPhoneNumberForDisplay(e164: string): string {
  const phMatch = e164.match(/^\+63(9\d{2})(\d{3})(\d{4})$/);
  if (phMatch) return `+63 ${phMatch[1]} ${phMatch[2]} ${phMatch[3]}`;
  return e164;
}
