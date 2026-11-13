/**
 * The countdown to a booking's deposit deadline (RMS `depositDueAt`, 24 hours after checkout): an
 * unpaid booking is cancelled automatically once it passes and its gear released.
 *
 * The deadline always comes from the RMS. The phone's own clock may be off, so the RMS also sends
 * its current time (`serverNow`); clockOffsetMs turns that into a correction applied on every tick.
 */

const HOUR_MS = 60 * 60 * 1000;

export type CountdownUrgency = 'normal' | 'soon' | 'urgent' | 'expired';

export interface TimeLeft {
  /** Milliseconds left, never negative. */
  ms: number;
  /** "23:41:05" (hours can go past 24). */
  clock: string;
  /** "23 hours 41 minutes", for screen readers (no seconds, so it can be announced once a minute). */
  spoken: string;
  /** normal: 3 hours or more; soon: under 3 hours; urgent: under 1 hour; expired: time's up. */
  urgency: CountdownUrgency;
}

/** How far the phone's clock is behind the RMS's (add it to Date.now()). 0 when the RMS didn't send
 *  its time or sent something unreadable. `receivedAtMs` is when the response arrived. */
export function clockOffsetMs(serverNow: string | undefined, receivedAtMs: number): number {
  if (!serverNow) return 0;
  const server = Date.parse(serverNow);
  return Number.isNaN(server) ? 0 : server - receivedAtMs;
}

const pad = (n: number) => String(n).padStart(2, '0');
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function timeLeft(dueAtMs: number, nowMs: number): TimeLeft {
  const ms = Math.max(0, dueAtMs - nowMs);
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const urgency: CountdownUrgency = ms === 0 ? 'expired' : ms < HOUR_MS ? 'urgent' : ms < 3 * HOUR_MS ? 'soon' : 'normal';
  const spoken =
    ms === 0
      ? 'no time'
      : hours > 0
        ? `${plural(hours, 'hour')} ${plural(minutes, 'minute')}`
        : plural(Math.max(1, minutes), 'minute');
  return { ms, clock: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`, spoken, urgency };
}
