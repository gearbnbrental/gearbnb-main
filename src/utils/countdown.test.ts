import { describe, expect, it } from 'vitest';
import { passwordResetError } from '../context/AuthContext';
import { formatCountdown, secondsUntil } from './countdown';

describe('countdown', () => {
  it('formats minutes and seconds', () => {
    expect(formatCountdown(60)).toBe('1:00');
    expect(formatCountdown(59)).toBe('0:59');
    expect(formatCountdown(5)).toBe('0:05');
    expect(formatCountdown(300)).toBe('5:00');
  });

  it('counts whole seconds down to 0', () => {
    expect(secondsUntil(60_000, 0)).toBe(60);
    expect(secondsUntil(60_000, 59_001)).toBe(1);
    expect(secondsUntil(60_000, 60_000)).toBe(0);
    expect(secondsUntil(60_000, 90_000)).toBe(0);
  });
});

describe('passwordResetError', () => {
  it("uses Supabase's own wait", () => {
    expect(passwordResetError('For security purposes, you can only request this after 37 seconds.')).toEqual({
      error: 'Please wait 37 seconds before asking for another link.',
      retryAfterSeconds: 37,
    });
  });

  it('asks for a valid address when Supabase rejects its format', () => {
    expect(passwordResetError('Unable to validate email address: invalid format')).toEqual({ error: 'Enter a valid email address.' });
  });

  it('explains a dropped connection instead of showing raw browser text', () => {
    for (const raw of ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.']) {
      expect(passwordResetError(raw).error).toBe("We couldn't send the email right now. Check your connection and try again.");
    }
  });

  it('explains a rate limit and an email service failure in plain words', () => {
    expect(passwordResetError('email rate limit exceeded').retryAfterSeconds).toBe(300);
    expect(passwordResetError('Error sending recovery email').error).toBe(
      "We couldn't send the email right now. Please try again in a moment, or message us for help.",
    );
  });
});
