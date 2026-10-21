import { describe, expect, it, vi } from 'vitest';
import { buildMetaTracking, leadEventIdFor, trackLead, type MetaTrackingEnvironment } from './metaTracking';

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
