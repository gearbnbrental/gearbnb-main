import { describe, expect, it } from 'vitest';
import { formatPhoneNumberForDisplay, isValidPhoneNumber, normalizePhoneNumber } from './phone';

describe('normalizePhoneNumber', () => {
  it('normalizes a local PH mobile number (09XXXXXXXXX)', () => {
    expect(normalizePhoneNumber('09171234567')).toBe('+639171234567');
  });

  it('normalizes a PH mobile number without the leading 0', () => {
    expect(normalizePhoneNumber('9171234567')).toBe('+639171234567');
  });

  it('normalizes a PH mobile number already carrying the country code but no +', () => {
    expect(normalizePhoneNumber('639171234567')).toBe('+639171234567');
  });

  it('accepts common formatting characters (spaces, dashes, parens)', () => {
    expect(normalizePhoneNumber('0917 123 4567')).toBe('+639171234567');
    expect(normalizePhoneNumber('0917-123-4567')).toBe('+639171234567');
    expect(normalizePhoneNumber('+63 917 123 4567')).toBe('+639171234567');
  });

  it('normalizes an already-E.164 PH number', () => {
    expect(normalizePhoneNumber('+639171234567')).toBe('+639171234567');
  });

  it('normalizes a non-PH number that already carries an explicit country code', () => {
    expect(normalizePhoneNumber('+12025551234')).toBe('+12025551234');
    expect(normalizePhoneNumber('0012025551234')).toBe('+12025551234');
  });

  it('rejects an ambiguous number with no country code and no PH-shaped pattern', () => {
    expect(normalizePhoneNumber('5551234')).toBeNull();
  });

  it('rejects empty/whitespace input', () => {
    expect(normalizePhoneNumber('')).toBeNull();
    expect(normalizePhoneNumber('   ')).toBeNull();
  });

  it('rejects a too-short or too-long country-coded number', () => {
    expect(normalizePhoneNumber('+123')).toBeNull();
    expect(normalizePhoneNumber('+1234567890123456')).toBeNull();
  });
});

describe('isValidPhoneNumber', () => {
  it('mirrors normalizePhoneNumber success/failure', () => {
    expect(isValidPhoneNumber('09171234567')).toBe(true);
    expect(isValidPhoneNumber('not a phone')).toBe(false);
  });
});

describe('formatPhoneNumberForDisplay', () => {
  it('adds PH grouping to a normalized PH number', () => {
    expect(formatPhoneNumberForDisplay('+639171234567')).toBe('+63 917 123 4567');
  });

  it('leaves a non-PH E.164 number as-is', () => {
    expect(formatPhoneNumberForDisplay('+12025551234')).toBe('+12025551234');
  });
});
