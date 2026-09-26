import { describe, expect, it } from 'vitest';
import { CATALOG_REFRESH_MIN_INTERVAL_MS, keepIfUnchanged, shouldRefreshCatalog } from './catalogRefresh';

describe('shouldRefreshCatalog', () => {
  const t0 = 1_000_000;
  it('waits for the minimum interval', () => {
    expect(shouldRefreshCatalog(t0 + CATALOG_REFRESH_MIN_INTERVAL_MS - 1, t0, true, false)).toBe(false);
    expect(shouldRefreshCatalog(t0 + CATALOG_REFRESH_MIN_INTERVAL_MS, t0, true, false)).toBe(true);
  });
  it('never refreshes a hidden tab or while one is already running', () => {
    expect(shouldRefreshCatalog(t0 + CATALOG_REFRESH_MIN_INTERVAL_MS, t0, false, false)).toBe(false);
    expect(shouldRefreshCatalog(t0 + CATALOG_REFRESH_MIN_INTERVAL_MS, t0, true, true)).toBe(false);
  });
});

describe('keepIfUnchanged', () => {
  it('keeps the same reference when the data is identical, and swaps when it differs', () => {
    const current = [{ a: 1 }];
    expect(keepIfUnchanged(current, [{ a: 1 }])).toBe(current);
    const next = [{ a: 2 }];
    expect(keepIfUnchanged(current, next)).toBe(next);
  });
});
