/**
 * Meta (Facebook) ads tracking for a booking request: the browser half of the "Lead" event.
 *
 * Only for visitors who accepted cookies on the banner (the same rule that decides whether Meta Pixel loads at all).
 * Two things happen when a booking request is submitted successfully:
 *   1. The browser Pixel fires "Lead" with an event id (trackLead below).
 *   2. The same event id, plus Meta's two browser identifiers (_fbp, _fbc) and the page address, travel with the booking
 *      request to the RMS, which sends the matching server-side "Lead" to Meta's Conversions API. Meta sees the same
 *      event id twice and counts it once. The secret access token stays on the RMS server; nothing secret is here.
 *
 * Nothing in this file can stop a booking: every function returns quietly when there is nothing to do.
 */
import { readCookieConsent, type CookieConsent } from './cookieConsent';

export interface MetaBookingTracking {
  /** The event id shared by the browser Pixel's Lead and the server's Lead. */
  eventId: string;
  fbp?: string;
  fbc?: string;
  /** The page the booking was submitted from, without any query string. */
  eventSourceUrl: string;
}

/** Everything read from the browser, gathered in one place so the logic can be tested without a browser. */
export interface MetaTrackingEnvironment {
  consent: CookieConsent | null;
  hostname: string;
  origin: string;
  pathname: string;
  search: string;
  /** document.cookie */
  cookies: string;
  now: number;
}

/** The same test index.html uses before loading the pixel: nothing is tracked from local or preview copies of the site. */
const LIVE_HOST = /(^|\.)gearbnbrental\.com$/;

/** Stable per submission (it comes from the booking's own idempotency key), so a retried request is never counted twice. */
export const leadEventIdFor = (idempotencyKey: string): string => `lead-${idempotencyKey}`.slice(0, 128);

function readCookie(cookies: string, name: string): string | undefined {
  for (const part of cookies.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

/**
 * The tracking details to send with the booking request, or undefined when the visitor did not accept cookies (or this
 * is not the live site), in which case nothing at all is sent to Meta for this booking.
 */
export function buildMetaTracking(idempotencyKey: string, env: MetaTrackingEnvironment): MetaBookingTracking | undefined {
  if (env.consent !== 'granted' || !LIVE_HOST.test(env.hostname)) return undefined;

  const fbp = readCookie(env.cookies, '_fbp');
  // _fbc is set by the Pixel when the visitor arrives from an ad (the link carries ?fbclid=...). If the cookie is not there
  // but this very page still has the click id, build it the way Meta documents: fb.1.<time in ms>.<click id>.
  let fbc = readCookie(env.cookies, '_fbc');
  if (!fbc) {
    const clickId = new URLSearchParams(env.search).get('fbclid');
    if (clickId) fbc = `fb.1.${env.now}.${clickId}`;
  }

  return {
    eventId: leadEventIdFor(idempotencyKey),
    ...(fbp ? { fbp } : {}),
    ...(fbc ? { fbc } : {}),
    eventSourceUrl: `${env.origin}${env.pathname}`,
  };
}

/** Reads the real browser. Kept separate from the logic above so tests do not need one. */
export function browserEnvironment(): MetaTrackingEnvironment {
  return {
    consent: readCookieConsent(),
    hostname: window.location.hostname,
    origin: window.location.origin,
    pathname: window.location.pathname,
    search: window.location.search,
    cookies: document.cookie,
    now: Date.now(),
  };
}

/**
 * The browser Pixel's Lead for a booking request that was just saved. The value is the booking's rental fee after any
 * discount (the deposit is not part of it), in pesos. Does nothing when the Pixel is not loaded (no consent, ad blocker).
 */
export function trackLead(
  eventId: string,
  valueCentavos: number,
  env: Pick<MetaTrackingEnvironment, 'consent'> & { fbq?: (...args: unknown[]) => void } = {
    consent: readCookieConsent(),
    fbq: typeof window !== 'undefined' ? window.fbq : undefined,
  },
): void {
  if (env.consent !== 'granted' || typeof env.fbq !== 'function') return;
  env.fbq('track', 'Lead', { value: Math.max(0, valueCentavos) / 100, currency: 'PHP' }, { eventID: eventId });
}
