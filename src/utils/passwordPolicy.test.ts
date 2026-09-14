import { describe, expect, it } from 'vitest';
import { evaluatePasswordRequirements, getPasswordStrength, isPasswordValid, MIN_PASSWORD_LENGTH } from './passwordPolicy';

describe('isPasswordValid', () => {
  it('matches the real Supabase minimum length', () => {
    expect(isPasswordValid('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe(false);
    expect(isPasswordValid('a'.repeat(MIN_PASSWORD_LENGTH))).toBe(true);
  });

  it('is empty by default', () => {
    expect(isPasswordValid('')).toBe(false);
  });
});

describe('evaluatePasswordRequirements', () => {
  it('reports every criterion unmet for an empty password', () => {
    expect(evaluatePasswordRequirements('').every((r) => !r.met)).toBe(true);
  });

  it('reports every criterion met for a password satisfying all of them', () => {
    expect(evaluatePasswordRequirements('Abcdef1!').every((r) => r.met)).toBe(true);
  });

  it('flags a lowercase-only password as missing uppercase/number/special', () => {
    const results = evaluatePasswordRequirements('abcdefgh');
    const byKey = Object.fromEntries(results.map((r) => [r.key, r.met]));
    expect(byKey.length).toBe(true);
    expect(byKey.lowercase).toBe(true);
    expect(byKey.uppercase).toBe(false);
    expect(byKey.number).toBe(false);
    expect(byKey.special).toBe(false);
  });

  it('only marks length as an actually-required rule — everything else is advisory', () => {
    const results = evaluatePasswordRequirements('abcdefgh');
    const byKey = Object.fromEntries(results.map((r) => [r.key, r.required]));
    expect(byKey.length).toBe(true);
    expect(byKey.uppercase).toBe(false);
    expect(byKey.lowercase).toBe(false);
    expect(byKey.number).toBe(false);
    expect(byKey.special).toBe(false);
  });

  it('uses the real Supabase minimum, not an invented stricter length, for the length label', () => {
    const [lengthRequirement] = evaluatePasswordRequirements('');
    expect(lengthRequirement.label).toContain(String(MIN_PASSWORD_LENGTH));
  });
});

describe('getPasswordStrength', () => {
  it('is empty for an empty password', () => {
    expect(getPasswordStrength('')).toBe('empty');
  });

  it('is weak when few criteria are met', () => {
    expect(getPasswordStrength('abc')).toBe('weak');
  });

  it('is acceptable when 3-4 criteria are met', () => {
    expect(getPasswordStrength('abcdefgh1')).toBe('acceptable');
  });

  it('is strong when all 5 criteria are met', () => {
    expect(getPasswordStrength('Abcdef1!')).toBe('strong');
  });

  it('never scores above weak when the real minimum length is not met, even with every other criterion satisfied', () => {
    expect(getPasswordStrength('Ab1!')).toBe('weak');
  });
});
