import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRoute, googleDirectionsUrl, routeTimeText } from './routing';

describe('route wording and links', () => {
  it('reads the drive time like a person would', () => {
    expect(routeTimeText(62)).toBe('about 1 hr');
    expect(routeTimeText(87)).toBe('about 1 hr 25 min');
    expect(routeTimeText(38)).toBe('about 40 min');
    expect(routeTimeText(1)).toBe('about 5 min');
  });

  it('opens Google Maps driving directions with both ends filled in', () => {
    expect(googleDirectionsUrl({ lat: 14.676, lng: 121.0437 }, { lat: 14.53, lng: 121.36 })).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=14.676,121.0437&destination=14.53,121.36&travelmode=driving',
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('falls back to a marked straight-line estimate when the route service is down', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    const route = await getRoute({ lat: 14.676, lng: 121.0437 }, { lat: 14.53, lng: 121.36 });
    expect(route.estimated).toBe(true);
    expect(route.path).toHaveLength(2);
  });
});
