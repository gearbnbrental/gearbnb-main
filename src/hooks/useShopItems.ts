import { useCallback, useEffect, useState } from 'react';
import { fetchShopFromRms } from '../utils/rmsApi';
import { createShopCache, describeShopError, normalizeShopItems, type ShopItem, type ShopLoadError } from '../utils/shop';

export type ShopState = { status: 'loading' } | { status: 'ready'; items: ShopItem[] } | { status: 'error'; error: ShopLoadError };

/** One cache for the whole site, so going from the list to an item and back within a minute
 *  doesn't ask the RMS again. */
const shopCache = createShopCache(async () => normalizeShopItems(await fetchShopFromRms()));

/** The shop's items, fetched when the page opens (or reused from the last minute), never polled.
 *  `retry` asks again after an error. */
export function useShopItems(): { state: ShopState; retry: () => void } {
  const [state, setState] = useState<ShopState>(() => {
    const items = shopCache.peek();
    return items ? { status: 'ready', items } : { status: 'loading' };
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    shopCache.load().then(
      (items) => active && setState({ status: 'ready', items }),
      (err: unknown) => active && setState({ status: 'error', error: describeShopError(err) }),
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  return { state, retry };
}
