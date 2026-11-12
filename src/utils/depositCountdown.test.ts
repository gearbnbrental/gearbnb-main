import { describe, expect, it } from 'vitest';
import { clockOffsetMs, timeLeft } from './depositCountdown';

const NOW = Date.parse('2026-11-12T07:00:00Z');
const H = 60 * 60 * 1000;
const M = 60 * 1000;

describe('timeLeft', () => {
  it('a fresh booking has the full 24 hours', () => {
    expect(timeLeft(NOW + 24 * H, NOW)).toEqual({ ms: 24 * H, clock: '24:00:00', spoken: '24 hours 0 minutes', urgency: 'normal' });
  });

  it('turns amber under 3 hours', () => {
    const left = timeLeft(NOW + 2 * H + 59 * M + 5000, NOW);
    expect(left.clock).toBe('02:59:05');
    expect(left.urgency).toBe('soon');
  });

  it('turns red under 1 hour', () => {
    const left = timeLeft(NOW + 59 * M, NOW);
    expect(left).toMatchObject({ clock: '00:59:00', spoken: '59 minutes', urgency: 'urgent' });
  });

  it('says 1 minute in the final minute rather than 0', () => {
    expect(timeLeft(NOW + 20_000, NOW).spoken).toBe('1 minute');
  });

  it("is expired at and after the deadline, never negative", () => {
    expect(timeLeft(NOW, NOW)).toMatchObject({ ms: 0, clock: '00:00:00', urgency: 'expired' });
    expect(timeLeft(NOW - 5 * M, NOW).ms).toBe(0);
  });
});

describe('clockOffsetMs', () => {
  it('corrects a phone clock that is an hour behind the RMS', () => {
    const phoneNow = NOW - H;
    const offset = clockOffsetMs(new Date(NOW).toISOString(), phoneNow);
    expect(offset).toBe(H);
    // With the correction, the countdown matches the RMS's view of the time left.
    expect(timeLeft(NOW + 10 * H, phoneNow + offset).clock).toBe('10:00:00');
  });

  it('is 0 when the RMS sent no time or an unreadable one', () => {
    expect(clockOffsetMs(undefined, NOW)).toBe(0);
    expect(clockOffsetMs('not a date', NOW)).toBe(0);
  });
});
