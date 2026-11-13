/**
 * Build-time only (never shipped to the browser): renders each public page to plain HTML so search
 * engines and link previews get the real headings, copy, FAQ answers, links and product cards
 * without running JavaScript. Loaded by prerenderRouteMeta in vite.config.ts.
 *
 * The page is rendered the way a first-time, signed-out visitor with an empty cart sees it, with
 * the catalog as it was at build time and no promo. Browser-only extras (cookie notice,
 * accessibility widget, chat bubble, back-to-top, Meta Pixel) are left out; they appear once the
 * app loads. main.tsx uses createRoot, which replaces this markup with the live app (live prices,
 * promo, sign-in state), so there is no hydration step that could mismatch.
 */
import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import { AuthProvider } from './context/AuthContext';
import { CatalogContext, type CatalogContextValue } from './context/CatalogContext';
import { RentalProvider } from './context/RentalContext';
import { fetchBookableGearCatalog } from './data/rmsGearCatalog';
import { applyPackageSelectability, fetchCatalogItems, fetchCatalogPackages } from './data/supabaseCatalog';
import AboutUs from './pages/AboutUs';
import CatalogChooser from './pages/CatalogChooser';
import DataDeletion from './pages/DataDeletion';
import EventPlan from './pages/EventPlan';
import LandingPage from './pages/LandingPage';
import PathACatalog from './pages/PathACatalog';
import PathBCatalog from './pages/PathBCatalog';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import type { BookableGearKind, IndividualItem, PackageKit } from './types/gearbnb';
import { orderPackageKits } from './utils/gearOrder';
import { fetchPackageCatalogFromRms } from './utils/rmsApi';

/** The pages that get full HTML. Must match PRERENDERED_PAGES in config/pageMeta.ts. */
const PAGES: Record<string, ComponentType> = {
  '/': LandingPage,
  '/catalog': CatalogChooser,
  '/catalog/camping-packages': PathACatalog,
  '/catalog/build-your-own': PathBCatalog,
  '/plan-an-event': EventPlan,
  '/about-us': AboutUs,
  '/privacy-policy': PrivacyPolicy,
  '/terms-of-service': TermsOfService,
  '/data-deletion': DataDeletion,
};

export interface PrerenderCatalog {
  kits: PackageKit[];
  items: IndividualItem[];
  gearKinds: BookableGearKind[];
  /** Why a part of the catalog is missing, for the build log. */
  warnings: string[];
}

const FETCH_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), FETCH_TIMEOUT_MS)),
  ]);
}

/**
 * Reads the public catalog the same way CatalogProvider does (Supabase with the public key, the
 * RMS's public catalog endpoints). Never throws: a part that fails is left empty, so those pages
 * are built without product cards instead of failing the build.
 */
export async function fetchPrerenderCatalog(): Promise<PrerenderCatalog> {
  const warnings: string[] = [];
  let kits: PackageKit[] = [];
  let items: IndividualItem[] = [];
  let gearKinds: BookableGearKind[] = [];

  try {
    const [kitData, itemData] = await withTimeout(Promise.all([fetchCatalogPackages(), fetchCatalogItems()]), 'package catalog');
    items = itemData;
    try {
      const { packages } = await withTimeout(fetchPackageCatalogFromRms(), 'RMS package details');
      kits = orderPackageKits(applyPackageSelectability(kitData, packages));
    } catch (error) {
      kits = orderPackageKits(kitData);
      warnings.push(`RMS package details unavailable (${String(error)})`);
    }
  } catch (error) {
    warnings.push(`package catalog unavailable, package cards left out (${String(error)})`);
  }

  try {
    gearKinds = await withTimeout(fetchBookableGearCatalog(), 'gear catalog');
  } catch (error) {
    warnings.push(`gear catalog unavailable, gear cards left out (${String(error)})`);
  }

  return { kits, items, gearKinds, warnings };
}

function catalogValue(catalog: PrerenderCatalog): CatalogContextValue {
  const packagesReady = catalog.kits.length > 0;
  const gearReady = catalog.gearKinds.length > 0;
  return {
    kits: catalog.kits,
    items: catalog.items,
    // 'loading' (not 'error') when a part is missing, so the HTML never shows a "couldn't load" message.
    catalogState: packagesReady ? 'ready' : 'loading',
    retryCatalog: () => {},
    ready: packagesReady,
    packageDetailsFailed: false,
    gearKinds: catalog.gearKinds,
    gearCatalogState: gearReady ? 'ready' : 'loading',
    retryGearCatalog: () => {},
    paymentQr: null,
    paymentQrState: 'loading',
  };
}

/** The markup that goes inside <div id="root"> for one page. */
export function renderPage(path: string, catalog: PrerenderCatalog): string {
  const Page = PAGES[path];
  if (!Page) throw new Error(`prerender: no page registered for ${path}`);
  return renderToStaticMarkup(
    <AuthProvider>
      <CatalogContext.Provider value={catalogValue(catalog)}>
        <RentalProvider>
          <MemoryRouter initialEntries={[path]}>
            {/* Same layout as App.tsx, minus the browser-only extras. */}
            <div className="min-h-screen">
              <Navbar />
              <ErrorBoundary>
                <Page />
              </ErrorBoundary>
              <Footer />
            </div>
          </MemoryRouter>
        </RentalProvider>
      </CatalogContext.Provider>
    </AuthProvider>,
  );
}
