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
import type { ComponentType, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import GearDetailsDialog from './components/GearDetailsDialog';
import PackageDetailsDialog from './components/PackageDetailsDialog';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import { AuthProvider } from './context/AuthContext';
import { CatalogContext, type CatalogContextValue } from './context/CatalogContext';
import { RentalProvider } from './context/RentalContext';
import { fetchBookableGearCatalog } from './data/rmsGearCatalog';
import { applyPackageSelectability, fetchCatalogItems, fetchCatalogPackages } from './data/supabaseCatalog';
import AboutUs from './pages/AboutUs';
import CampsiteDetail from './pages/CampsiteDetail';
import Campsites from './pages/Campsites';
import CatalogChooser from './pages/CatalogChooser';
import DataDeletion from './pages/DataDeletion';
import EventPlan from './pages/EventPlan';
import LandingPage from './pages/LandingPage';
import NotFound from './pages/NotFound';
import PathACatalog from './pages/PathACatalog';
import PathBCatalog from './pages/PathBCatalog';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Shop from './pages/Shop';
import Terms from './pages/Terms';
import TermsOfService from './pages/TermsOfService';
import type { PageMeta } from './config/pageMeta';
import { catalogJsonLd, gearPageMeta, packagePageMeta } from './config/productMeta';
import { BUILD_YOUR_OWN_PATH, PACKAGES_PATH, gearPath, packagePath } from './utils/productSlug';
import { cleanGearName } from './utils/gearName';
import { sizeCapacityToShow, withDefaultVariant } from './utils/gearVariants';
import type { BookableGearKind, IndividualItem, PackageKit } from './types/gearbnb';
import { orderPackageKits } from './utils/gearOrder';
import { fetchPackageCatalogFromRms } from './utils/rmsApi';
import { CampsiteDataContext } from './context/CampsiteData';
import { USING_CAMPSITE_SAMPLES, fetchCampsiteDetail, fetchCampsiteList } from './data/campsites';
import { CAMPSITES_COMING_SOON } from './config/features';
import CampsitesComingSoon from './pages/CampsitesComingSoon';
import { campsitePageMeta, campsitesListJsonLd, provincePageMeta } from './config/campsiteMeta';
import type { Campsite } from './types/campsite';
import {
  CAMPSITES_PATH,
  CAMPSITE_PROVINCE_PATH,
  campsiteHighlights,
  campsitePath,
  campsiteSummarySentence,
  provinceGroups,
  provinceIntro,
  provincePath,
} from './utils/campsites';

/** The pages that get full HTML. Must match PRERENDERED_PAGES in config/pageMeta.ts. */
const PAGES: Record<string, ComponentType> = {
  '/': LandingPage,
  '/catalog': CatalogChooser,
  '/catalog/camping-packages': PathACatalog,
  '/catalog/build-your-own': PathBCatalog,
  '/shop': Shop,
  '/plan-an-event': EventPlan,
  '/about-us': AboutUs,
  '/campsites': CAMPSITES_COMING_SOON ? CampsitesComingSoon : Campsites,
  '/privacy-policy': PrivacyPolicy,
  '/terms': Terms,
  '/terms-of-service': TermsOfService,
  '/data-deletion': DataDeletion,
};

/** The page served (with a 404 status) for every address the site doesn't have. */
export const NOT_FOUND_PATH = '/404';

/** Which page renders an address, and the route pattern it's matched with (so useParams works). */
function routeFor(path: string): { pattern: string; Page: ComponentType } {
  if (PAGES[path]) return { pattern: path, Page: PAGES[path] };
  if (path.startsWith(`${PACKAGES_PATH}/`)) return { pattern: `${PACKAGES_PATH}/:slug`, Page: PathACatalog };
  if (path.startsWith(`${BUILD_YOUR_OWN_PATH}/`)) return { pattern: `${BUILD_YOUR_OWN_PATH}/:slug`, Page: PathBCatalog };
  if (path.startsWith(`${CAMPSITE_PROVINCE_PATH}/`)) return { pattern: `${CAMPSITE_PROVINCE_PATH}/:province`, Page: Campsites };
  if (path.startsWith(`${CAMPSITES_PATH}/`)) return { pattern: `${CAMPSITES_PATH}/:slug`, Page: CampsiteDetail };
  if (path === NOT_FOUND_PATH) return { pattern: '*', Page: NotFound };
  throw new Error(`prerender: no page registered for ${path}`);
}

export interface PrerenderCatalog {
  kits: PackageKit[];
  items: IndividualItem[];
  gearKinds: BookableGearKind[];
  /** Every published Find A Campsite campsite, with its photos and reviews. */
  campsites: Campsite[];
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

  const campsites = await fetchPrerenderCampsites(warnings);

  return { kits, items, gearKinds, campsites, warnings };
}

/** Every published campsite with its full details, a few requests at a time. A campsite that
 *  fails is left out (with a warning); if the list itself fails, the directory is built empty. */
async function fetchPrerenderCampsites(warnings: string[]): Promise<Campsite[]> {
  // Coming Soon: no campsite pages, schema or llms.txt lines (see config/features.ts).
  if (CAMPSITES_COMING_SOON) return [];
  if (USING_CAMPSITE_SAMPLES) warnings.push('VITE_CAMPSITE_SAMPLES=1: built with SAMPLE campsites. Never upload this build.');
  let list;
  try {
    list = await withTimeout(fetchCampsiteList(), 'campsite list');
  } catch (error) {
    warnings.push(`campsites unavailable, the directory is built without campsites (${String(error)})`);
    return [];
  }
  const campsites: Campsite[] = [];
  for (let start = 0; start < list.length; start += 4) {
    const batch = await Promise.all(
      list.slice(start, start + 4).map((summary) =>
        withTimeout(fetchCampsiteDetail(summary.slug), `campsite ${summary.slug}`).catch((error: unknown) => {
          warnings.push(`campsite ${summary.slug} left out (${String(error)})`);
          return null;
        }),
      ),
    );
    campsites.push(...batch.filter((campsite): campsite is Campsite => campsite !== null));
  }
  return campsites;
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

function Providers({ catalog, children }: { catalog: PrerenderCatalog; children: ReactNode }) {
  return (
    <AuthProvider>
      <CatalogContext.Provider value={catalogValue(catalog)}>
        <CampsiteDataContext.Provider
          value={{ list: catalog.campsites, details: Object.fromEntries(catalog.campsites.map((campsite) => [campsite.slug, campsite])) }}
        >
          <RentalProvider>{children}</RentalProvider>
        </CampsiteDataContext.Provider>
      </CatalogContext.Provider>
    </AuthProvider>
  );
}

/**
 * The markup that goes inside <div id="root"> for one page. `chrome: false` leaves out the navbar
 * and footer (for the page's Markdown version).
 */
export function renderPage(path: string, catalog: PrerenderCatalog, { chrome = true }: { chrome?: boolean } = {}): string {
  const { pattern, Page } = routeFor(path);
  return renderToStaticMarkup(
    <Providers catalog={catalog}>
      <MemoryRouter initialEntries={[path]}>
        {/* Same layout as App.tsx, minus the browser-only extras. */}
        <div className="min-h-screen">
          {chrome && <Navbar />}
          <ErrorBoundary>
            <Routes>
              <Route path={pattern} element={<Page />} />
            </Routes>
          </ErrorBoundary>
          {chrome && <Footer />}
        </div>
      </MemoryRouter>
    </Providers>,
  );
}

export interface ProductPage {
  path: string;
  meta: PageMeta;
  name: string;
  image: string | null;
  /** One line for lists (llms.txt, the catalog's Markdown): prices, deposit, size. */
  summary: string;
  /** The product's details on their own (for its Markdown version). */
  render: () => string;
}

const noop = () => {};
const peso = (amount: number) => `₱${amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
const prices = (pricing: { '48h': number; '72h': number }) => `${peso(pricing['48h'])} for 48 hours, ${peso(pricing['72h'])} for 72 hours`;

/** One page per package and per Build Your Own gear kind, in catalog order. */
export function productPages(catalog: PrerenderCatalog): ProductPage[] {
  const pages: ProductPage[] = [];
  const seen = new Set<string>();
  const add = (page: ProductPage) => {
    if (seen.has(page.path)) return;
    seen.add(page.path);
    pages.push(page);
  };
  const details = (dialog: ReactNode) => () =>
    renderToStaticMarkup(
      <Providers catalog={catalog}>
        <MemoryRouter>{dialog}</MemoryRouter>
      </Providers>,
    );

  for (const kit of catalog.kits) {
    add({
      path: packagePath(kit),
      meta: packagePageMeta(kit),
      name: kit.name,
      image: kit.imageUrl || null,
      summary: [`${prices(kit.pricing)}, ${peso(kit.depositAmount)} security deposit.`, kit.paxRange && `For ${kit.paxRange}.`]
        .filter(Boolean)
        .join(' '),
      render: details(
        <PackageDetailsDialog
          name={kit.name}
          imageUrl={kit.imageUrl}
          images={kit.images}
          description={kit.description}
          includedItems={kit.includedItems}
          components={kit.components}
          paxRange={kit.paxRange}
          pricing={kit.pricing}
          depositAmount={kit.depositAmount}
          isOutOfStock={kit.isOutOfStock ?? false}
          isSelected={false}
          onToggleSelected={noop}
          onClose={noop}
          headingLevel="h1"
        />,
      ),
    });
  }
  for (const kind of catalog.gearKinds) {
    add({
      path: gearPath(kind),
      meta: gearPageMeta(kind),
      name: cleanGearName(kind.name),
      image: kind.imageUrl,
      summary: [`${kind.category}.`, `${prices(kind.pricing)}.`, sizeCapacityToShow(kind) && `Size/capacity: ${sizeCapacityToShow(kind)}.`]
        .filter(Boolean)
        .join(' '),
      render: details(
        <GearDetailsDialog kind={withDefaultVariant(kind)} quantity={0} onQuantityChange={noop} onClose={noop} headingLevel="h1" />,
      ),
    });
  }
  return pages;
}

/** The two catalog pages' CollectionPage + ItemList schema, linking each product page. */
export function catalogPagesJsonLd(products: ProductPage[]): Record<string, object> {
  const list = (base: string) => products.filter((product) => product.path.startsWith(`${base}/`));
  return {
    [PACKAGES_PATH]: catalogJsonLd(PACKAGES_PATH, 'Camping Packages for Rent', list(PACKAGES_PATH)),
    [BUILD_YOUR_OWN_PATH]: catalogJsonLd(BUILD_YOUR_OWN_PATH, 'Camping Gear for Rent by the Piece', list(BUILD_YOUR_OWN_PATH)),
  };
}

export interface CampsitePage {
  path: string;
  meta: PageMeta;
  name: string;
  /** One line for llms.txt. */
  summary: string;
  /** YYYY-MM-DD (Manila) the campsite or its reviews last changed, for the sitemap. */
  dataChanged: string;
}

const manilaDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const latest = (dates: string[]) => dates.reduce((max, date) => (date > max ? date : max), '');

/** One page per campsite and one per province with enough campsites, in that order. */
export function campsitePages(catalog: PrerenderCatalog): CampsitePage[] {
  const provinces = provinceGroups(catalog.campsites, { withPagesOnly: true });
  const withPage = new Set(provinces.map((group) => group.province));
  const campsitePagesList = [...catalog.campsites]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((campsite) => {
      const highlights = campsiteHighlights(campsite);
      const rating = campsite.rating.count && campsite.rating.average !== null ? ` Rated ${campsite.rating.average}/5 by ${campsite.rating.count} campers.` : '';
      return {
        path: campsitePath(campsite),
        meta: campsitePageMeta(campsite, withPage.has(campsite.province.trim())),
        name: campsite.name,
        summary: `${campsiteSummarySentence(campsite)}${highlights.length ? ` Has: ${highlights.join(', ')}.` : ''}${rating}`,
        dataChanged: manilaDate(campsite.updatedAt),
      };
    });
  const provincePagesList = provinces.map((group) => ({
    path: provincePath(group.province),
    meta: provincePageMeta(group),
    name: `Camping sites in ${group.province}`,
    summary: provinceIntro(group),
    dataChanged: latest(group.campsites.map((campsite) => manilaDate(campsite.updatedAt))),
  }));
  return [...campsitePagesList, ...provincePagesList];
}

/** The directory's CollectionPage + ItemList schema, and the date its list last changed. */
export function campsiteDirectory(catalog: PrerenderCatalog) {
  return {
    // Coming Soon: the page lists no campsites, so it gets no ItemList either.
    jsonLd: CAMPSITES_COMING_SOON ? undefined : campsitesListJsonLd(catalog.campsites),
    dataChanged: latest(catalog.campsites.map((campsite) => manilaDate(campsite.updatedAt))),
  };
}
