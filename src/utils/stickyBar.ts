import { useCallback, useRef, useSyncExternalStore } from 'react';

/**
 * The live height of the page's sticky bottom bar (the catalog pages' cart summary, the Cart
 * page's checkout footer), so the floating corner buttons (accessibility, "Need Help?", back to
 * top) can sit just above it. The bar's height isn't fixed: it grows from one line to three or
 * four once items, a rental length or a promo price show up, and a fixed offset let the buttons
 * end up on top of it. 0 when the current page has no bar.
 */
let barHeight = 0;
const listeners = new Set<() => void>();

function setBarHeight(next: number) {
  if (next === barHeight) return;
  barHeight = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** For the floating buttons: the current bar height in px (0 when there's no bar). */
export function useStickyBarHeight(): number {
  return useSyncExternalStore(subscribe, () => barHeight, () => 0);
}

/** For the sticky bar itself: attach as its `ref` so its height is tracked while it's on screen. */
export function useStickyBarRef(): (element: HTMLElement | null) => void {
  const observer = useRef<ResizeObserver | null>(null);
  return useCallback((element: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!element) {
      setBarHeight(0);
      return;
    }
    const measure = () => setBarHeight(Math.ceil(element.getBoundingClientRect().height));
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      observer.current = new ResizeObserver(measure);
      observer.current.observe(element);
    }
  }, []);
}
