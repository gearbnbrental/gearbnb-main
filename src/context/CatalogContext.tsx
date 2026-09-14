import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchCatalogItems, fetchCatalogPackages } from '../data/supabaseCatalog';
import { fetchBookableGearCatalog } from '../data/rmsGearCatalog';
import { mockIndividualItems, mockPackages } from '../data/mockData';
import type { BookableGearKind, IndividualItem, PackageKit } from '../types/gearbnb';
import { useAuth } from './AuthContext';

/** Loading/error state for the Build Your Own gear catalog specifically — kept separate from
 * `ready` (which covers the mock-fallback package/item catalog) because this one has no mock
 * fallback: a failure here is a real error state the BYO page must show, not a silent fallback. */
type GearCatalogState = 'loading' | 'ready' | 'error';

interface CatalogContextValue {
  kits: PackageKit[];
  items: IndividualItem[];
  /**
   * False until the live fetch has resolved. Consumers that prune against the catalog must wait
   * for this — the initial mock data would otherwise look like a catalog that omits every real
   * entry, and a restored cart would be discarded before the real rows ever arrived.
   */
  ready: boolean;
  /** The real Build Your Own gear catalog (GET /api/customer/catalog/gear) — empty until
   * gearCatalogState is 'ready'. Never mock data; see fetchBookableGearCatalog. */
  gearKinds: BookableGearKind[];
  gearCatalogState: GearCatalogState;
  /** Re-runs the gear catalog fetch after a failure — the actual "Try Again" the BYO catalog's
   * error state needs (Part 7): this must re-issue the real request, never just re-render the
   * same stale error. Safe to call while already loading (a no-op, guarded by gearCatalogState). */
  retryGearCatalog: () => void;
}

/**
 * Starts from the mock catalog so pages render immediately with no loading state, then swaps in
 * live Supabase data once it resolves. Falls back to (and stays on) mock data if a table errors
 * or is still empty, so the site stays demoable while the RMS side seeds real inventory.
 */
const CatalogContext = createContext<CatalogContextValue | undefined>(undefined);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [kits, setKits] = useState<PackageKit[]>(mockPackages);
  const [items, setItems] = useState<IndividualItem[]>(mockIndividualItems);
  const [ready, setReady] = useState(false);
  const [gearKinds, setGearKinds] = useState<BookableGearKind[]>([]);
  const [gearCatalogState, setGearCatalogState] = useState<GearCatalogState>('loading');
  // Bumped by retryGearCatalog to re-run the fetch effect below on demand — a plain re-render
  // can't do that on its own since the effect's own dependencies wouldn't otherwise change.
  const [gearCatalogRetryCount, setGearCatalogRetryCount] = useState(0);
  // Both catalog fetches below go through the shared Supabase client, which attaches whatever
  // session is currently in localStorage to every request it makes — including these, even
  // though browsing the catalog itself needs no login at all. A left-over session from an
  // expired/revoked refresh token still looks present (just not yet verified) the instant this
  // provider mounts; firing these fetches before AuthContext has had a chance to validate and
  // clear a broken one would attach that broken token, get an auth error back for what should
  // have been a plain public read, and permanently fall back to mock data for the rest of this
  // page's lifetime (see the fallback branches below — neither fetch retries once it's picked a
  // source). Waiting for `authLoading` to resolve first closes that race.
  const { loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    // Resolved together so the catalog flips from mock to live in one step; both fetches handle
    // their own failures and fall back to mock, so this never rejects.
    Promise.all([fetchCatalogPackages(), fetchCatalogItems()]).then(([kitData, itemData]) => {
      if (cancelled) return;
      setKits(kitData);
      setItems(itemData);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [authLoading]);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setGearCatalogState('loading');

    // Independent of the package/item fetch above — and, deliberately, does NOT fall back to
    // mock data on failure. A customer must never be able to select and submit a booking against
    // Build Your Own inventory that doesn't actually exist.
    fetchBookableGearCatalog()
      .then((kinds) => {
        if (cancelled) return;
        setGearKinds(kinds);
        setGearCatalogState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn('[CatalogContext] gear catalog fetch failed:', error);
        setGearCatalogState('error');
      });

    return () => {
      cancelled = true;
    };
    // gearCatalogRetryCount is otherwise unused inside — its only job is forcing this effect to
    // re-run on demand (see retryGearCatalog below).
  }, [authLoading, gearCatalogRetryCount]);

  function retryGearCatalog() {
    // Guarded so a customer mashing "Try Again" (or a stray double-fire) can't stack up parallel
    // requests — a retry only ever makes sense while the last attempt actually failed.
    if (gearCatalogState !== 'error') return;
    setGearCatalogRetryCount((count) => count + 1);
  }

  return (
    <CatalogContext.Provider value={{ kits, items, ready, gearKinds, gearCatalogState, retryGearCatalog }}>
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog(): CatalogContextValue {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error('useCatalog must be used within a CatalogProvider');
  }
  return context;
}
