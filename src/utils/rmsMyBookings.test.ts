import { afterEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const getUser = vi.fn();
vi.mock('../supabase', () => ({ supabase: { auth: { getSession, getUser, refreshSession: vi.fn() } } }));

const okSession = { data: { session: { access_token: 't', expires_at: Math.floor(Date.now() / 1000) + 3600 } } };

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('fetchMyBookingsFromRms — account with no Customer row yet', () => {
  it('treats a 401 as "no bookings" when Supabase confirms the session is valid', async () => {
    const { fetchMyBookingsFromRms } = await import('./rmsApi');
    getSession.mockResolvedValue(okSession);
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    stubFetch(401, { error: 'Not authenticated' });
    await expect(fetchMyBookingsFromRms()).resolves.toEqual({ bookings: [] });
  });

  it('still throws the 401 when the session is genuinely invalid', async () => {
    const { fetchMyBookingsFromRms } = await import('./rmsApi');
    getSession.mockResolvedValue(okSession);
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } });
    stubFetch(401, { error: 'Not authenticated' });
    await expect(fetchMyBookingsFromRms()).rejects.toMatchObject({ status: 401 });
  });

  it('returns the RMS list unchanged on success', async () => {
    const { fetchMyBookingsFromRms } = await import('./rmsApi');
    getSession.mockResolvedValue(okSession);
    stubFetch(200, { bookings: [{ bookingId: 'b1' }] });
    await expect(fetchMyBookingsFromRms()).resolves.toEqual({ bookings: [{ bookingId: 'b1' }] });
  });
});

describe('fetchMyBookingsFromRms — error provenance', () => {
  it('a missing VITE_RMS_API_URL throws the tagged not-configured error (and makes no request)', async () => {
    vi.resetModules();
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_RMS_API_URL', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const { fetchMyBookingsFromRms, RMS_NOT_CONFIGURED_CODE } = await import('./rmsApi');
      await expect(fetchMyBookingsFromRms()).rejects.toMatchObject({ status: 500, code: RMS_NOT_CONFIGURED_CODE });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it('a genuine RMS 500 (and 502/503/504) is thrown untagged, so it is never read as "not configured"', async () => {
    const { fetchMyBookingsFromRms, RMS_NOT_CONFIGURED_CODE } = await import('./rmsApi');
    getSession.mockResolvedValue(okSession);
    for (const status of [500, 502, 503, 504]) {
      stubFetch(status, { error: 'Booking could not be created' });
      const err = await fetchMyBookingsFromRms().catch((e: unknown) => e);
      expect(err).toMatchObject({ status });
      expect((err as { code?: string }).code).not.toBe(RMS_NOT_CONFIGURED_CODE);
    }
  }, 20000);
});
