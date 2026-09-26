import { afterEach, describe, expect, it } from 'vitest';
import { dropStaleTripDates, latestBookableDateISO, toAvailabilityTimestamp, toTimestamp } from './duration';

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

describe('stale and out-of-range trip dates', () => {
  const trip = { startDate: '2026-10-01', returnDate: '2026-10-03', preferredTime: '10:00' };
  it('clears dates that have passed but keeps the rest of the trip details', () => {
    expect(dropStaleTripDates(trip, '2026-10-02')).toEqual({ startDate: '', returnDate: '', preferredTime: '10:00' });
  });
  it('keeps today and future dates, and empty dates, untouched', () => {
    expect(dropStaleTripDates(trip, '2026-10-01')).toBe(trip);
    expect(dropStaleTripDates(trip, '2026-09-20')).toBe(trip);
    const empty = { startDate: '', returnDate: '', preferredTime: '' };
    expect(dropStaleTripDates(empty, '2026-10-02')).toBe(empty);
  });
  it('the latest bookable date stays inside the RMS one-year limit', () => {
    expect(latestBookableDateISO('2026-09-27')).toBe('2027-09-22');
  });
});
