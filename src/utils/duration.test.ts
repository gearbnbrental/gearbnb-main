import { afterEach, describe, expect, it } from 'vitest';
import { toAvailabilityTimestamp, toTimestamp } from './duration';

// The project has no @types/node; process.env.TZ is only used here to simulate other browser timezones.
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const originalTz = env.TZ;
afterEach(() => {
  if (originalTz === undefined) delete env.TZ;
  else env.TZ = originalTz;
});

describe('rental timestamps are anchored to Asia/Manila (UTC+8), not the browser timezone', () => {
  it('Sep 20 2026 10:00 → 02:00Z; Sep 22 2026 10:00 → 02:00Z', () => {
    expect(toTimestamp('2026-09-20', '10:00')).toBe('2026-09-20T02:00:00.000Z');
    expect(toTimestamp('2026-09-22', '10:00')).toBe('2026-09-22T02:00:00.000Z');
  });

  it.each(['Asia/Manila', 'UTC', 'America/Los_Angeles', 'Europe/London', 'Australia/Sydney'])(
    'produces the same instant when the browser timezone is %s',
    (tz) => {
      env.TZ = tz;
      expect(toTimestamp('2026-09-20', '10:00')).toBe('2026-09-20T02:00:00.000Z');
    },
  );

  it('availability and booking submission use the identical instant once a time exists', () => {
    expect(toAvailabilityTimestamp('2026-09-20', '10:00')).toBe(toTimestamp('2026-09-20', '10:00'));
  });

  it('the availability midnight fallback is Manila midnight (16:00Z the previous day)', () => {
    expect(toAvailabilityTimestamp('2026-09-20', '')).toBe('2026-09-19T16:00:00.000Z');
  });

  it('stays strict: missing time or date is null', () => {
    expect(toTimestamp('2026-09-20', '')).toBeNull();
    expect(toTimestamp('', '10:00')).toBeNull();
  });
});
