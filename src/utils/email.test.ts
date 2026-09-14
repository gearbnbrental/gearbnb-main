import { describe, expect, it } from 'vitest';
import { isAllowedRegistrationEmail, isValidEmailFormat } from './email';

describe('isValidEmailFormat', () => {
  it('accepts an ordinary address', () => {
    expect(isValidEmailFormat('customer@gmail.com')).toBe(true);
  });

  it('rejects addresses missing an @, a domain, or a TLD', () => {
    expect(isValidEmailFormat('customer')).toBe(false);
    expect(isValidEmailFormat('customer@')).toBe(false);
    expect(isValidEmailFormat('customer@gmail')).toBe(false);
    expect(isValidEmailFormat('')).toBe(false);
  });
});

describe('isAllowedRegistrationEmail', () => {
  it('accepts gmail addresses', () => {
    expect(isAllowedRegistrationEmail('customer@gmail.com')).toBe(true);
  });

  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(isAllowedRegistrationEmail('  Customer@GMAIL.com  ')).toBe(true);
  });

  it('rejects other providers', () => {
    expect(isAllowedRegistrationEmail('customer@yahoo.com')).toBe(false);
    expect(isAllowedRegistrationEmail('customer@hotmail.com')).toBe(false);
    expect(isAllowedRegistrationEmail('customer@outlook.com')).toBe(false);
    expect(isAllowedRegistrationEmail('customer@example.com')).toBe(false);
  });

  // The reason the check compares the whole domain rather than using endsWith().
  it('rejects lookalike domains that merely contain or end with gmail.com', () => {
    expect(isAllowedRegistrationEmail('customer@evil-gmail.com')).toBe(false);
    expect(isAllowedRegistrationEmail('customer@gmail.com.attacker.net')).toBe(false);
    expect(isAllowedRegistrationEmail('customer@notgmail.com')).toBe(false);
  });

  it('rejects malformed input outright', () => {
    expect(isAllowedRegistrationEmail('gmail.com')).toBe(false);
    expect(isAllowedRegistrationEmail('')).toBe(false);
  });
});
