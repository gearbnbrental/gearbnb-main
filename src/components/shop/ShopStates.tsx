import { useEffect, useState } from 'react';
import type { ShopLoadError } from '../../utils/shop';

export const SHOP_EMPTY_MESSAGE = 'Nothing for sale right now, check back soon!';

export function ShopLoading() {
  return (
    <div className="grid animate-pulse grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3" aria-busy="true" aria-label="Loading the shop">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <div className="aspect-square w-full bg-surface-strong" />
          <div className="flex flex-col gap-2 p-4">
            <div className="h-2.5 w-1/3 rounded bg-surface-strong" />
            <div className="h-3.5 w-3/4 rounded bg-surface-strong" />
            <div className="mt-2 h-5 w-1/2 rounded bg-surface-strong" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ShopEmpty() {
  return <p className="rounded-xl border border-line bg-surface-muted p-6 text-center text-sm text-ink-muted">{SHOP_EMPTY_MESSAGE}</p>;
}

export function ShopNoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface-muted p-6 text-center">
      <p className="text-sm text-ink-muted">Nothing matches your search. Try another word or category.</p>
      <button
        type="button"
        onClick={onClear}
        className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-surface-strong"
      >
        Clear search and filters
      </button>
    </div>
  );
}

/** Whole seconds left until `until`, never below 0. */
const secondsLeft = (until: number) => Math.max(0, Math.ceil((until - Date.now()) / 1000));

/** The load failed. After a 429, Try again stays off (with a countdown) until the RMS's
 *  Retry-After has passed; the countdown is a local timer and never calls the RMS. */
export function ShopError({ error, onRetry }: { error: ShopLoadError; onRetry: () => void }) {
  const [until] = useState(() => (error.retryAfterMs ? Date.now() + error.retryAfterMs : 0));
  const [wait, setWait] = useState(() => (error.retryAfterMs ? Math.ceil(error.retryAfterMs / 1000) : 0));

  useEffect(() => {
    if (!until) return;
    const timer = window.setInterval(() => {
      const left = secondsLeft(until);
      setWait(left);
      if (left === 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [until]);

  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-6 text-center">
      <p className="text-sm text-red-700">{error.message}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={wait > 0}
        className="rounded-lg border border-red-300 bg-surface px-4 py-2 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {wait > 0 ? `Try again in ${wait}s` : 'Try again'}
      </button>
    </div>
  );
}
