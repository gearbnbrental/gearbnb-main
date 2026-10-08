import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { normalizePromoResponse, promoAudience, isPromoBookable, type PromoAudience } from '../utils/promo';
import { devPromoFixture, promoResponseFixture } from '../utils/promoFixtures';
import { fetchPublicPromo, type RmsPublicPromo, type RmsPublicPromoResponse } from '../utils/rmsApi';

/** Re-read the promo when it's older than this (on a route change or the timer below). */
const CACHE_TTL_MS = 45_000;
/** How often the promo is re-read (and the booking deadline re-checked) while the tab is open. */
const REFRESH_INTERVAL_MS = 60_000;
const TIMEOUT_MS = 8_000;

interface PromoContextValue {
  /** The live promo, or null. Null also while the answer for the current visitor is loading, and
   *  after any failure: the site then behaves exactly as it did before promos existed. */
  promo: RmsPublicPromo | null;
  eligibleForYou: boolean | undefined;
  /** Null whenever no discount UI should appear at all. */
  audience: Exclude<PromoAudience, 'not-eligible'> | null;
  /** Current time as of the last refresh tick, for deadline checks during render. */
  nowMs: number;
}

const NO_PROMO: PromoContextValue = { promo: null, eligibleForYou: undefined, audience: null, nowMs: 0 };

const PromoContext = createContext<PromoContextValue>(NO_PROMO);

/**
 * Reads the RMS's public promo once, shares it with every screen, and keeps it fresh: re-read on
 * route change when older than CACHE_TTL_MS, on a timer, and immediately when the signed-in
 * customer changes (their token decides `eligibleForYou`). An answer fetched for a different
 * visitor is never used, so logging in as a returning renter can't leave a stale discount on
 * screen while the new answer loads. Any failure is "no promo".
 */
export function PromoProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { pathname } = useLocation();
  const visitorKey = authLoading ? null : (user?.id ?? 'guest');
  const [state, setState] = useState<{ visitorKey: string; response: RmsPublicPromoResponse; fetchedAt: number } | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
      setTick((n) => n + 1);
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!visitorKey) return;
    if (state && state.visitorKey === visitorKey && Date.now() - state.fetchedAt < CACHE_TTL_MS) return;

    const fixture = import.meta.env.DEV ? devPromoFixture() : null;
    if (fixture) {
      setState({ visitorKey, response: promoResponseFixture(fixture.name, fixture.eligibility), fetchedAt: Date.now() });
      return;
    }

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    fetchPublicPromo(controller.signal)
      .then((raw) => normalizePromoResponse(raw))
      .catch(() => ({ promo: null }) as RmsPublicPromoResponse)
      .then((response) => {
        if (controller.signal.aborted && inFlight.current !== controller) return;
        setState({ visitorKey, response, fetchedAt: Date.now() });
        setNowMs(Date.now());
      })
      .finally(() => window.clearTimeout(timeout));
    // `state` is read only to decide whether a refresh is due; re-running when it changes would
    // re-fetch right after every answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitorKey, pathname, tick]);

  useEffect(() => () => inFlight.current?.abort(), []);

  const value = useMemo<PromoContextValue>(() => {
    if (!state || state.visitorKey !== visitorKey) return NO_PROMO;
    const { promo, eligibleForYou } = state.response;
    if (!promo || !isPromoBookable(promo, nowMs)) return { ...NO_PROMO, nowMs };
    const audience = promoAudience(promo, eligibleForYou);
    if (audience === 'not-eligible') return { ...NO_PROMO, nowMs };
    return { promo, eligibleForYou, audience, nowMs };
  }, [state, visitorKey, nowMs]);

  return <PromoContext.Provider value={value}>{children}</PromoContext.Provider>;
}

/** The live promo for this visitor. `promo` is null (show nothing) unless there's a live, still
 *  bookable promo this visitor can get. */
export function usePromo(): PromoContextValue {
  return useContext(PromoContext);
}
