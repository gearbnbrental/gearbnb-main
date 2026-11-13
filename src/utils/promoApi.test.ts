import { afterEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
vi.mock('../supabase', () => ({ supabase: { auth: { getSession, getUser: vi.fn(), refreshSession: vi.fn() } } }));

const signedIn = { data: { session: { access_token: 'tok', expires_at: Math.floor(Date.now() / 1000) + 3600 } } };
const signedOut = { data: { session: null } };

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('fetchPublicPromo', () => {
  it('works signed out, with no Authorization header', async () => {
    const { fetchPublicPromo } = await import('./rmsApi');
    getSession.mockResolvedValue(signedOut);
    const fetchMock = stubFetch(200, { promo: null });
    await expect(fetchPublicPromo()).resolves.toEqual({ promo: null });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/customer\/promo$/);
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('sends the Bearer token when signed in', async () => {
    const { fetchPublicPromo } = await import('./rmsApi');
    getSession.mockResolvedValue(signedIn);
    const fetchMock = stubFetch(200, { promo: null, eligibleForYou: false });
    await fetchPublicPromo();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('rejects on a non-200 answer (the site then treats it as no promo)', async () => {
    const { fetchPublicPromo } = await import('./rmsApi');
    getSession.mockResolvedValue(signedOut);
    stubFetch(503, { error: 'down' });
    await expect(fetchPublicPromo()).rejects.toMatchObject({ status: 503 });
  });
});

describe('fetchPromoQuote', () => {
  it('POSTs the availability-shaped body and returns the quote', async () => {
    const { fetchPromoQuote } = await import('./rmsApi');
    getSession.mockResolvedValue(signedIn);
    const answer = { applied: false, reason: 'NO_PROMO', eligibility: 'ELIGIBLE', discountCentavos: 0 };
    const fetchMock = stubFetch(200, answer);
    const body = { pickupAt: '2026-10-15T16:00:00.000Z', returnAt: '2026-10-17T16:00:00.000Z', packageCode: 'PKG-0001' };
    await expect(fetchPromoQuote(body)).resolves.toEqual(answer);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/customer\/promo\/quote$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it('surfaces a 429 as an error (the checkout then hides or estimates the saving)', async () => {
    const { fetchPromoQuote } = await import('./rmsApi');
    getSession.mockResolvedValue(signedOut);
    stubFetch(429, { error: 'Too many requests' });
    await expect(fetchPromoQuote({ pickupAt: 'a', returnAt: 'b' })).rejects.toMatchObject({ status: 429 });
  });
});
