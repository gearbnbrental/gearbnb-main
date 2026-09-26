import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { keepIfUnchanged, shouldRefreshCatalog } from '../utils/catalogRefresh';
import { applyPackageSelectability, fetchCatalogItems, fetchCatalogPackages } from '../data/supabaseCatalog';
import { fetchBookableGearCatalog } from '../data/rmsGearCatalog';
import { orderPackageKits } from '../utils/gearOrder';
import { fetchPackageCatalogFromRms, fetchPaymentQrConfig, type RmsPaymentQrConfig } from '../utils/rmsApi';
import type { BookableGearKind, IndividualItem, PackageKit } from '../types/gearbnb';
import { useAuth } from './AuthContext';

/** Loading/error state for the package/item catalog — same shape as GearCatalogState below (and
 * the same reasoning): no mock/demo fallback on failure, a real error state instead. */
type PackageCatalogState = 'loading' | 'ready' | 'error';

/** Loading/error state for the Build Your Own gear catalog. Kept as its own type/state (not
 * merged with PackageCatalogState) since the two are independent fetches that can succeed/fail on
 * their own schedule — a BYO gear outage must never block the package catalog from rendering, or
 * vice versa. */
type GearCatalogState = 'loading' | 'ready' | 'error';

/** Loading/error state for the live payment-QR config — see `paymentQr`'s own doc comment below
 * on why 'error' (unlike a genuinely-fetched `null`) is the only case a caller should fall back to
 * its own static QR image for. */
type PaymentQrState = 'loading' | 'ready' | 'error';

export interface CatalogContextValue {
  /** The real, authoritative RMS/Supabase package catalog — empty until catalogState is 'ready'.
   *  Never mock/demo data; see fetchCatalogPackages. */
  kits: PackageKit[];
  /** Same authoritative-only contract as `kits` — see fetchCatalogItems. */
  items: IndividualItem[];
  catalogState: PackageCatalogState;
  /** Re-runs the package/item catalog fetch after a failure — mirrors retryGearCatalog below.
   *  Safe to call while already loading (a no-op, guarded by catalogState). */
  retryCatalog: () => void;
  /**
   * True only once the live fetch has actually succeeded. Consumers that prune against the
   * catalog must wait for this — an empty or still-loading catalog would otherwise look like a
   * catalog that omits every real entry, and a restored cart would be discarded before the real
   * rows ever arrived. Stays false on a fetch failure (see catalogState) for the same reason: a
   * transient error must never wipe a customer's restored selection.
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
  /** The RMS Settings page's currently-configured GCash/MariBank QR images (GET
   * /api/customer/payment-qr) — `null` while `paymentQrState` isn't 'ready' yet, since there is
   * nothing genuine to show until the fetch actually resolves. See PaymentInstructionsSection
   * (DepositProofUpload.tsx), the one shared place every payment-proof flow renders these. */
  paymentQr: RmsPaymentQrConfig | null;
  paymentQrState: PaymentQrState;
}

/**
 * Fetches the real, authoritative RMS/Supabase package/item catalog on mount and exposes it once
 * it resolves. No mock/demo fallback: a failed or errored fetch surfaces as `catalogState ===
 * 'error'` (with `retryCatalog()` to try again), never a silent substitution of fictional
 * packages a customer could select and attempt to book. `kits`/`items` start empty and stay empty
 * until a real fetch actually succeeds. Also fetches the RMS-configured payment QR codes (see
 * `paymentQr`) — unrelated data, but the same "fetch once per app load, no polling" shape, so it
 * lives in this same provider rather than a second one.
 */
// Exported (not module-private) so useCatalog.ts — the hook's own dedicated file, see its doc
// comment for why it was split out — can read from this exact same context object.
export const CatalogContext = createContext<CatalogContextValue | undefined>(undefined);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [kits, setKits] = useState<PackageKit[]>([]);
  const [items, setItems] = useState<IndividualItem[]>([]);
  const [catalogState, setCatalogState] = useState<PackageCatalogState>('loading');
  // Bumped by retryCatalog to re-run the fetch effect below on demand — a plain re-render can't
  // do that on its own since the effect's own dependencies wouldn't otherwise change. Mirrors
  // gearCatalogRetryCount below exactly.
  const [catalogRetryCount, setCatalogRetryCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [gearKinds, setGearKinds] = useState<BookableGearKind[]>([]);
  const [gearCatalogState, setGearCatalogState] = useState<GearCatalogState>('loading');
  // Bumped by retryGearCatalog to re-run the fetch effect below on demand — a plain re-render
  // can't do that on its own since the effect's own dependencies wouldn't otherwise change.
  const [gearCatalogRetryCount, setGearCatalogRetryCount] = useState(0);
  const [paymentQr, setPaymentQr] = useState<RmsPaymentQrConfig | null>(null);
  const [paymentQrState, setPaymentQrState] = useState<PaymentQrState>('loading');
  // Both catalog fetches below go through the shared Supabase client, which attaches whatever
  // session is currently in localStorage to every request it makes — including these, even
  // though browsing the catalog itself needs no login at all. A left-over session from an
  // expired/revoked refresh token still looks present (just not yet verified) the instant this
  // provider mounts; firing these fetches before AuthContext has had a chance to validate and
  // clear a broken one would attach that broken token, get an auth error back for what should
  // have been a plain public read — surfacing as a real, retryable error state (catalogState)
  // rather than a silent fallback. Waiting for `authLoading` to resolve first closes that race.
  const { loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setCatalogState('loading');

    // Resolved together so the catalog flips from loading to ready in one step. Deliberately does
    // NOT fall back to mock/demo data on failure — same reasoning as the gear catalog fetch just
    // below: a customer must never see (and be able to select) a package that doesn't actually
    // exist in RMS.
    Promise.all([fetchCatalogPackages(), fetchCatalogItems()])
      .then(async ([kitData, itemData]) => {
        if (cancelled) return;

        // Enriches the Supabase-sourced kits with RMS's own canSelect signal (see
        // applyPackageSelectability's own doc comment). Deliberately a SEPARATE try/catch from the
        // Promise.all above: this signal is advisory only (the real, date-aware gate is the
        // availability check re-run at submission — see RmsCatalogPackage.canSelect's own doc
        // comment), so a transient failure here must never block the whole package catalog —
        // which IS authoritative and must render — from becoming ready.
        let kitsWithSelectability = kitData;
        try {
          const { packages: rmsPackages } = await fetchPackageCatalogFromRms();
          if (cancelled) return;
          kitsWithSelectability = applyPackageSelectability(kitData, rmsPackages);
        } catch (error) {
          console.warn(
            '[CatalogContext] package canSelect fetch failed, packages will show as in-stock until the next successful refresh:',
            error,
          );
        }

        if (cancelled) return;
        setKits(orderPackageKits(kitsWithSelectability));
        setItems(itemData);
        setCatalogState('ready');
        setReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn('[CatalogContext] package/item catalog fetch failed:', error);
        setCatalogState('error');
      });

    return () => {
      cancelled = true;
    };
    // catalogRetryCount is otherwise unused inside — its only job is forcing this effect to
    // re-run on demand (see retryCatalog below).
  }, [authLoading, catalogRetryCount]);

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

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    // Every fresh page load re-fetches this (no polling, no long-lived cache beyond this one
    // provider's lifetime) — an admin who replaces a QR on the RMS Settings page becomes visible
    // here the next time a customer loads/reloads the site, without a Main redeploy.
    fetchPaymentQrConfig()
      .then((config) => {
        if (cancelled) return;
        setPaymentQr(config);
        setPaymentQrState('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn('[CatalogContext] payment QR config fetch failed:', error);
        setPaymentQrState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading]);

  // Quiet refresh when a customer comes back to a tab that's been open a while, so stock, prices
  // and out-of-stock flags don't stay frozen at whatever they were when the page first loaded.
  // Deliberately conservative: it only runs once both catalogs have loaded, never touches
  // catalogState/gearCatalogState (so no spinner and nothing unmounts), and on ANY failure keeps
  // exactly what's already on screen. A package refresh whose RMS enrichment fails is dropped
  // entirely rather than replacing richer data with a plainer copy. Unchanged data keeps the same
  // reference, so nothing re-renders and no cart re-check runs. When something did change, the
  // cart re-validates itself against it, exactly as it does after a reload.
  const catalogsReady = catalogState === 'ready' && gearCatalogState === 'ready';
  useEffect(() => {
    if (authLoading || !catalogsReady) return;
    let cancelled = false;
    let inFlight = false;
    let lastLoadedAt = Date.now();

    async function refreshQuietly() {
      inFlight = true;
      try {
        const [kitData, itemData, gearData, rmsPackages] = await Promise.all([
          fetchCatalogPackages(),
          fetchCatalogItems(),
          fetchBookableGearCatalog(),
          fetchPackageCatalogFromRms(),
        ]);
        if (cancelled) return;
        const nextKits = orderPackageKits(applyPackageSelectability(kitData, rmsPackages.packages));
        setKits((current) => keepIfUnchanged(current, nextKits));
        setItems((current) => keepIfUnchanged(current, itemData));
        setGearKinds((current) => keepIfUnchanged(current, gearData));
        lastLoadedAt = Date.now();
      } catch (error) {
        console.warn('[CatalogContext] quiet catalog refresh failed, keeping the current catalog:', error);
        lastLoadedAt = Date.now();
      } finally {
        inFlight = false;
      }
    }

    function handleVisibilityChange() {
      if (shouldRefreshCatalog(Date.now(), lastLoadedAt, document.visibilityState === 'visible', inFlight)) {
        void refreshQuietly();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authLoading, catalogsReady]);

  // useCallback (not a plain function) so this has a stable identity across renders except when
  // gearCatalogState actually changes — otherwise it would recreate a fresh function every render
  // and defeat the value memoization below (a new function reference is a changed dependency).
  const retryGearCatalog = useCallback(() => {
    // Guarded so a customer mashing "Try Again" (or a stray double-fire) can't stack up parallel
    // requests — a retry only ever makes sense while the last attempt actually failed.
    if (gearCatalogState !== 'error') return;
    setGearCatalogRetryCount((count) => count + 1);
  }, [gearCatalogState]);

  // Mirrors retryGearCatalog above exactly, for the package/item catalog.
  const retryCatalog = useCallback(() => {
    if (catalogState !== 'error') return;
    setCatalogRetryCount((count) => count + 1);
  }, [catalogState]);

  // Memoized for the same reason as AuthContext's own value — useCatalog() is consumed by every
  // catalog-browsing page (PathACatalog, PathBCatalog, LandingPage, EventPlan), and an unstable
  // object identity here would re-render all of them whenever CatalogProvider re-rendered for any
  // unrelated reason, not just when the catalog data itself actually changed.
  const value = useMemo<CatalogContextValue>(
    () => ({
      kits,
      items,
      catalogState,
      retryCatalog,
      ready,
      gearKinds,
      gearCatalogState,
      retryGearCatalog,
      paymentQr,
      paymentQrState,
    }),
    [kits, items, catalogState, retryCatalog, ready, gearKinds, gearCatalogState, retryGearCatalog, paymentQr, paymentQrState],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

// useCatalog() itself now lives in ./useCatalog.ts — see that file's own doc comment for why.
