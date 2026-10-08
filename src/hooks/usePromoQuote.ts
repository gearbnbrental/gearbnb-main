import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { PromoLine } from '../utils/promo';
import { devPromoFixture, promoQuoteFixture, promoResponseFixture } from '../utils/promoFixtures';
import { fetchPromoQuote, RmsApiError, type RmsAvailabilityRequest, type RmsPromoQuote } from '../utils/rmsApi';

const DEBOUNCE_MS = 350;
const TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 30_000;

const cache = new Map<string, { quote: RmsPromoQuote; expiresAt: number }>();

function readCache(signature: string): RmsPromoQuote | null {
  const hit = cache.get(signature);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(signature);
    return null;
  }
  return hit.quote;
}

export type PromoQuoteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; quote: RmsPromoQuote }
  /** 429, 503, a timeout or any other failure. Callers hide the saving or fall back to an
   *  estimate; checkout is never blocked by this. */
  | { status: 'error' };

/**
 * The RMS's authoritative "what would this basket save" for the checkout. Same lifecycle as
 * useDateAwareGearKinds: debounced, one cached request per basket (and per signed-in customer,
 * whose token decides eligibility), a bounded timeout, never retried automatically (the endpoint
 * is rate limited). Pass null to skip (no promo, no dates, empty basket).
 *
 * `lines` is only used by the dev-only fixture switch, which answers from the shared math.
 */
export function usePromoQuote(request: RmsAvailabilityRequest | null, lines: PromoLine[]): PromoQuoteState {
  const { user } = useAuth();
  const signature = request ? `${user?.id ?? 'guest'}|${JSON.stringify(request)}` : null;
  const [fetched, setFetched] = useState<{ signature: string; state: PromoQuoteState } | null>(null);

  useEffect(() => {
    if (!request || !signature || readCache(signature)) return;

    const fixture = import.meta.env.DEV ? devPromoFixture() : null;
    if (fixture) {
      const state: PromoQuoteState =
        fixture.quote === 'ok'
          ? { status: 'success', quote: promoQuoteFixture(promoResponseFixture(fixture.name, fixture.eligibility), request, lines) }
          : { status: 'error' };
      setFetched({ signature, state });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let cancelled = false;
    setFetched({ signature, state: { status: 'loading' } });
    const timer = setTimeout(() => {
      fetchPromoQuote(request, controller.signal)
        .then((quote) => {
          if (cancelled) return;
          cache.set(signature, { quote, expiresAt: Date.now() + CACHE_TTL_MS });
          setFetched({ signature, state: { status: 'success', quote } });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          // Logged in dev only, to tell a rate limit from an outage while testing.
          if (import.meta.env.DEV) console.warn('[promo quote] failed', err instanceof RmsApiError ? err.status : err);
          setFetched({ signature, state: { status: 'error' } });
        })
        .finally(() => clearTimeout(timeout));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(timeout);
      controller.abort();
    };
    // `request`/`lines` are rebuilt by the caller every render; the signature identifies them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (!signature) return { status: 'idle' };
  const cached = readCache(signature);
  if (cached) return { status: 'success', quote: cached };
  if (fetched && fetched.signature === signature) return fetched.state;
  return { status: 'loading' };
}
