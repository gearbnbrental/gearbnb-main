import { describe, expect, it, vi } from 'vitest';
import {
  buildMetaTracking,
  leadEventIdFor,
  newOAuthRegistration,
  trackAddToCart,
  trackCompleteRegistration,
  trackInitiateCheckout,
  trackLead,
  type MetaTrackingEnvironment,
} from './metaTracking';

const KEY = '7f3a9c2e-1b4d-4f6a-9d21-0a8b5c3e7f10';
const FBP = 'fb.1.1761100000000.1234567890';
const FBC = 'fb.1.1761100000000.IwAR0abcDEF-123';

const env = (over: Partial<MetaTrackingEnvironment> = {}): MetaTrackingEnvironment => ({
  consent: 'granted',
  hostname: 'gearbnbrental.com',
  origin: 'https://gearbnbrental.com',
  pathname: '/checkout',
  search: '',
  cookies: `_fbp=${FBP}; _fbc=${FBC}; other=1`,
  now: 1761200000000,
  ...over,
});

describe('buildMetaTracking: only for visitors who accepted cookies, only on the live site', () => {
  it('a visitor who accepted: event id from the booking key, both Meta cookies, and the page address without any query string', () => {
    expect(buildMetaTracking(KEY, env({ search: '?fbclid=zzz&utm_source=x' }))).toEqual({
      eventId: `lead-${KEY}`,
      fbp: FBP,
      fbc: FBC,
      eventSourceUrl: 'https://gearbnbrental.com/checkout',
    });
  });

  it('declined, or never answered the banner: nothing at all is sent', () => {
    expect(buildMetaTracking(KEY, env({ consent: 'denied' }))).toBeUndefined();
    expect(buildMetaTracking(KEY, env({ consent: null }))).toBeUndefined();
  });

  it('local copies, previews and look-alike addresses never send anything; the live site (with or without www) does', () => {
    for (const hostname of ['localhost', '127.0.0.1', 'gearbnb.pages.dev', 'gearbnbrental.com.evil.io', 'notgearbnbrental.com']) {
      expect(buildMetaTracking(KEY, env({ hostname })), hostname).toBeUndefined();
    }
    for (const hostname of ['gearbnbrental.com', 'www.gearbnbrental.com']) {
      expect(buildMetaTracking(KEY, env({ hostname })), hostname).toBeDefined();
    }
  });

  it('leaves out the cookies the visitor does not have, instead of sending empty values', () => {
    const r = buildMetaTracking(KEY, env({ cookies: 'session=abc' }))!;
    expect(r).toEqual({ eventId: `lead-${KEY}`, eventSourceUrl: 'https://gearbnbrental.com/checkout' });
    expect('fbp' in r).toBe(false);
    expect('fbc' in r).toBe(false);
  });

  it('no _fbc cookie but the page still carries the ad click id: builds fbc the way Meta documents (fb.1.<ms>.<click id>)', () => {
    const r = buildMetaTracking(KEY, env({ cookies: `_fbp=${FBP}`, search: '?fbclid=AbC123xyz', now: 1761200000123 }))!;
    expect(r.fbc).toBe('fb.1.1761200000123.AbC123xyz');
  });

  it('the cookie wins over the address when both exist', () => {
    expect(buildMetaTracking(KEY, env({ search: '?fbclid=other' }))!.fbc).toBe(FBC);
  });

  it('reads cookies correctly among others, including encoded values', () => {
    expect(buildMetaTracking(KEY, env({ cookies: 'a=1; _fbp=fb.1.1.2%2B3 ;b=2' }))!.fbp).toBe('fb.1.1.2+3');
  });
});

describe('the event id', () => {
  it('is the same every time for the same booking key (so a retried request is counted once) and different for another booking', () => {
    expect(leadEventIdFor(KEY)).toBe(leadEventIdFor(KEY));
    expect(leadEventIdFor(KEY)).not.toBe(leadEventIdFor('another-key-0000'));
  });

  it('always fits what the RMS accepts (8 to 128 letters, digits, - _ : .)', () => {
    expect(leadEventIdFor(KEY)).toMatch(/^[A-Za-z0-9_\-:.]{8,128}$/);
    expect(leadEventIdFor('x'.repeat(300)).length).toBe(128);
  });
});

describe('trackLead: the browser Pixel half', () => {
  it('fires Lead with the shared event id and the value in pesos (centavos / 100), in PHP', () => {
    const fbq = vi.fn();
    trackLead(`lead-${KEY}`, 400050, { consent: 'granted', fbq });
    expect(fbq).toHaveBeenCalledTimes(1);
    expect(fbq).toHaveBeenCalledWith('track', 'Lead', { value: 4000.5, currency: 'PHP' }, { eventID: `lead-${KEY}` });
  });

  it('does nothing without consent, even if the Pixel script happens to be loaded', () => {
    const fbq = vi.fn();
    trackLead('lead-x1234567', 100, { consent: 'denied', fbq });
    trackLead('lead-x1234567', 100, { consent: null, fbq });
    expect(fbq).not.toHaveBeenCalled();
  });

  it('does nothing, and does not fail, when the Pixel is not loaded (ad blocker, local copy)', () => {
    expect(() => trackLead('lead-x1234567', 100, { consent: 'granted', fbq: undefined })).not.toThrow();
  });

  it('a negative value is sent as zero, never a negative amount', () => {
    const fbq = vi.fn();
    trackLead('lead-x1234567', -500, { consent: 'granted', fbq });
    expect(fbq.mock.calls[0][2]).toEqual({ value: 0, currency: 'PHP' });
  });
});

describe('funnel events: sign-up, add to cart, checkout', () => {
  it('fire only for a visitor who accepted cookies and only when the Pixel is loaded', () => {
    for (const run of [
      (e: { consent: 'granted' | 'denied' | null; fbq?: (...a: unknown[]) => void }) => trackAddToCart('package', e),
      (e: { consent: 'granted' | 'denied' | null; fbq?: (...a: unknown[]) => void }) => trackInitiateCheckout(1000, e),
      (e: { consent: 'granted' | 'denied' | null; fbq?: (...a: unknown[]) => void }) => trackCompleteRegistration('email', e),
    ]) {
      const fbq = vi.fn();
      run({ consent: 'denied', fbq });
      run({ consent: null, fbq });
      run({ consent: 'granted' });
      expect(fbq).not.toHaveBeenCalled();
      run({ consent: 'granted', fbq });
      expect(fbq).toHaveBeenCalledTimes(1);
    }
  });

  it('send only a category, an amount or a method: nothing personal', () => {
    const fbq = vi.fn();
    trackAddToCart('build_your_own', { consent: 'granted', fbq });
    trackInitiateCheckout(2040.5, { consent: 'granted', fbq });
    trackCompleteRegistration('google', { consent: 'granted', fbq });
    expect(fbq.mock.calls).toEqual([
      ['track', 'AddToCart', { content_category: 'build_your_own' }],
      ['track', 'InitiateCheckout', { value: 2040.5, currency: 'PHP' }],
      ['track', 'CompleteRegistration', { content_name: 'google' }],
    ]);
  });

  it('a Pixel that throws never breaks the caller', () => {
    const fbq = vi.fn(() => {
      throw new Error('blocked');
    });
    expect(() => trackAddToCart('gear', { consent: 'granted', fbq })).not.toThrow();
  });

  it('a negative checkout amount is reported as 0', () => {
    const fbq = vi.fn();
    trackInitiateCheckout(-5, { consent: 'granted', fbq });
    expect(fbq.mock.calls[0][2]).toEqual({ value: 0, currency: 'PHP' });
  });
});

describe('newOAuthRegistration: only a Google or Facebook sign-in that just created the account', () => {
  const NOW = Date.parse('2026-10-25T03:00:00Z');
  const user = (over: Record<string, unknown> = {}) => ({
    id: 'u1',
    created_at: '2026-10-25T02:59:30Z',
    last_sign_in_at: '2026-10-25T02:59:31Z',
    app_metadata: { provider: 'google' },
    ...over,
  });

  it('a brand-new Google or Facebook account is reported with its method', () => {
    expect(newOAuthRegistration(user(), NOW)).toBe('google');
    expect(newOAuthRegistration(user({ app_metadata: { provider: 'facebook' } }), NOW)).toBe('facebook');
  });

  it('a returning customer (account created long ago) is not reported', () => {
    expect(newOAuthRegistration(user({ created_at: '2026-10-01T00:00:00Z' }), NOW)).toBeNull();
  });

  it('an email account, a signed-out visitor, or a first sign-in that is not the creation is not reported', () => {
    expect(newOAuthRegistration(user({ app_metadata: { provider: 'email' } }), NOW)).toBeNull();
    expect(newOAuthRegistration(null, NOW)).toBeNull();
    expect(newOAuthRegistration(user({ last_sign_in_at: '2026-10-25T02:59:55Z' }), NOW)).toBeNull();
    expect(newOAuthRegistration(user({ created_at: undefined }), NOW)).toBeNull();
  });
});
