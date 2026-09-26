/** Least time between two silent catalog refreshes. Short tab switches never trigger one. */
export const CATALOG_REFRESH_MIN_INTERVAL_MS = 2 * 60_000;

/** Whether a tab that just became visible should quietly re-fetch the catalog. */
export function shouldRefreshCatalog(now: number, lastLoadedAt: number, visible: boolean, inFlight: boolean): boolean {
  return visible && !inFlight && now - lastLoadedAt >= CATALOG_REFRESH_MIN_INTERVAL_MS;
}

/** Keeps the current value (same reference, so nothing re-renders and no cart re-check runs) when
 *  a refresh brought back identical data. */
export function keepIfUnchanged<T>(current: T, next: T): T {
  return JSON.stringify(current) === JSON.stringify(next) ? current : next;
}
