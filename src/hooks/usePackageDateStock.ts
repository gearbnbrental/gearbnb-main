import { useEffect, useState } from 'react';
import { fetchPackageStockForDates } from '../utils/rmsApi';
import type { PackageDateStock } from '../utils/packageDateStock';

const DEBOUNCE_MS = 350;
const TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 30_000;

const cache = new Map<string, { canSelect: ReadonlyMap<string, boolean>; expiresAt: number }>();

function readCache(signature: string): ReadonlyMap<string, boolean> | null {
  const hit = cache.get(signature);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(signature);
    return null;
  }
  return hit.canSelect;
}

/**
 * One request for "which packages are free for these dates?", shared by every package card, so a
 * date change costs one call instead of one availability check per card. Read-only and advisory:
 * a package card only trusts a positive answer (see decidePackageCheck) and otherwise runs its own
 * check, so a failure here (timeout, rate limit, older RMS that ignores dates) simply leaves the
 * page behaving exactly as it did before this existed. `null` = no dates chosen yet.
 *
 * The result is tied to the dates it was fetched for, so a render right after the dates change can
 * never show the previous dates' answer.
 */
export function usePackageDateStock(dates: { pickupAt: string; returnAt: string } | null): PackageDateStock {
  const signature = dates ? `${dates.pickupAt}|${dates.returnAt}` : null;
  const [fetched, setFetched] = useState<{ signature: string; value: PackageDateStock } | null>(null);

  useEffect(() => {
    if (!dates || !signature || readCache(signature)) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchPackageStockForDates(dates, controller.signal)
        .then((response) => {
          if (cancelled) return;
          if (response.dateAware !== true) {
            setFetched({ signature, value: { status: 'failed' } });
            return;
          }
          const canSelect = new Map(response.packages.map((pkg) => [pkg.packageNumber, pkg.canSelect]));
          cache.set(signature, { canSelect, expiresAt: Date.now() + CACHE_TTL_MS });
          setFetched({ signature, value: { status: 'ready', canSelect } });
        })
        .catch(() => {
          if (!cancelled) setFetched({ signature, value: { status: 'failed' } });
        })
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

  if (!signature) return { status: 'idle' };
  const cached = readCache(signature);
  if (cached) return { status: 'ready', canSelect: cached };
  if (fetched && fetched.signature === signature) return fetched.value;
  return { status: 'loading' };
}
