import { useEffect, useMemo, useState } from 'react';
import { useCatalog } from '../context/useCatalog';
import { fetchBookableGearStockForDates } from '../data/rmsGearCatalog';
import type { BookableGearKind } from '../types/gearbnb';
import { applyGearDateStock } from '../utils/gearDateStock';

const DEBOUNCE_MS = 350;
const TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 30_000;

const cache = new Map<string, { kinds: BookableGearKind[]; expiresAt: number }>();

function readCache(signature: string): BookableGearKind[] | null {
  const hit = cache.get(signature);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(signature);
    return null;
  }
  return hit.kinds;
}

/**
 * The gear catalog as the customer should see it once they've chosen dates: stock counted for
 * those dates, not "free right now" (a unit that's rented today but back before their trip is
 * available to them). Same catalog otherwise, only the stock fields change.
 *
 * Read-only and display-only, one cached request per dates. With no dates, while loading, or on ANY
 * failure (timeout, rate limit, an older RMS that ignores dates) it returns the ordinary catalog
 * unchanged, so the page can only ever behave as it did before. The result is tied to the dates it
 * was fetched for, so a render right after the dates change never shows the previous dates' stock.
 */
export function useDateAwareGearKinds(dates: { pickupAt: string; returnAt: string } | null): BookableGearKind[] {
  const { gearKinds } = useCatalog();
  const signature = dates ? `${dates.pickupAt}|${dates.returnAt}` : null;
  const [fetched, setFetched] = useState<{ signature: string; kinds: BookableGearKind[] } | null>(null);

  useEffect(() => {
    if (!dates || !signature || readCache(signature)) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchBookableGearStockForDates(dates, controller.signal)
        .then((response) => {
          if (cancelled || !response.dateAware) return;
          cache.set(signature, { kinds: response.kinds, expiresAt: Date.now() + CACHE_TTL_MS });
          setFetched({ signature, kinds: response.kinds });
        })
        .catch(() => {})
        .finally(() => clearTimeout(timeout));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(timeout);
      controller.abort();
    };
    // `dates` is rebuilt by the caller; the signature is what identifies the dates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const dated = signature ? (readCache(signature) ?? (fetched && fetched.signature === signature ? fetched.kinds : null)) : null;
  return useMemo(() => (dated ? applyGearDateStock(gearKinds, dated) : gearKinds), [gearKinds, dated]);
}
