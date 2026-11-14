import { lazy, Suspense, useEffect, useLayoutEffect, useRef, type ComponentType } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import BackToTop from './components/BackToTop';
import CookieConsent from './components/CookieConsent';
import AccessibilityWidget from './components/AccessibilityWidget';
import { readCookieConsent } from './utils/cookieConsent';
import ErrorBoundary from './components/ErrorBoundary';
import FloatingHelp from './components/FloatingHelp';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CatalogProvider } from './context/CatalogContext';
import { PromoProvider } from './context/PromoContext';
import { RentalProvider } from './context/RentalContext';
import { useCatalog } from './context/useCatalog';
import type { CatalogSnapshot, ModelContext } from './utils/webMcp';

// LandingPage stays a static import because it is the entry route for a typical first visit.
// Every other route is code-split so customers do not load unnecessary page code up front.
import LandingPage from './pages/LandingPage';

/**
 * Retries lazy route imports when a transient network failure prevents a chunk
 * from loading. After the retries are exhausted, ErrorBoundary handles the failure.
 */
function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  delayMs = 500,
) {
  return lazy(async () => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await factory();
      } catch (err) {
        lastError = err;

        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError;
  });
}

const AboutUs = lazyWithRetry(() => import('./pages/AboutUs'));
const Cart = lazyWithRetry(() => import('./pages/Cart'));
const CatalogChooser = lazyWithRetry(() => import('./pages/CatalogChooser'));
const Checkout = lazyWithRetry(() => import('./pages/Checkout'));
const EventPlan = lazyWithRetry(() => import('./pages/EventPlan'));
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'));
const Login = lazyWithRetry(() => import('./pages/Login'));
const MyBookings = lazyWithRetry(() => import('./pages/MyBookings'));
const NotFound = lazyWithRetry(() => import('./pages/NotFound'));
const PathACatalog = lazyWithRetry(() => import('./pages/PathACatalog'));
const PathBCatalog = lazyWithRetry(() => import('./pages/PathBCatalog'));
const PrivacyPolicy = lazyWithRetry(() => import('./pages/PrivacyPolicy'));
const DataDeletion = lazyWithRetry(() => import('./pages/DataDeletion'));
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'));
const Terms = lazyWithRetry(() => import('./pages/Terms'));
const TermsOfService = lazyWithRetry(() => import('./pages/TermsOfService'));

/**
 * Placeholder displayed while a lazy route's JavaScript chunk is loading.
 */
function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center gap-2.5 text-sm text-ink-muted">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand-forest"
        aria-hidden="true"
      />
      Loading…
    </div>
  );
}

/**
 * App-wide enforcement of email verification.
 */
const VERIFICATION_GATE_EXEMPT_PATHS = new Set([
  '/login',
  '/forgot-password',
  '/reset-password',
]);

function VerificationGate() {
  const { user, needsEmailVerification, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user || !needsEmailVerification) return;
    if (VERIFICATION_GATE_EXEMPT_PATHS.has(location.pathname)) return;

    navigate('/login', { replace: true });
  }, [loading, user, needsEmailVerification, location.pathname, navigate]);

  return null;
}

/** "/catalog/camping-packages/stargazer-kit" -> "/catalog/camping-packages": a product's details
 *  open over its catalog page, so moving between the two keeps the catalog's scroll position. */
const catalogOf = (pathname: string) => pathname.match(/^\/catalog\/(camping-packages|build-your-own)(?=\/|$)/)?.[0] ?? null;

/**
 * Resets the window scroll position whenever the route changes.
 * Hash URLs scroll to that section instead (e.g. /about-us#contact).
 */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const previousPath = useRef(pathname);

  useLayoutEffect(() => {
    const from = previousPath.current;
    previousPath.current = pathname;
    if (hash) {
      // Once the page (often a lazy-loaded one) has rendered that section; gives up after 3s.
      let tries = 0;
      const timer = window.setInterval(() => {
        const target = document.getElementById(decodeURIComponent(hash.slice(1)));
        if (target) target.scrollIntoView();
        if (target || ++tries >= 30) window.clearInterval(timer);
      }, 100);
      return () => window.clearInterval(timer);
    }
    if (from !== pathname && catalogOf(from) !== null && catalogOf(from) === catalogOf(pathname)) return;

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    });
  }, [pathname, hash]);

  return null;
}

/**
 * Registers the read-only WebMCP tools (search the catalog, item details, rental policies) once,
 * on page load, for AI agents in browsers that support them. They read the catalog as it is when
 * called, so they never need re-registering. The tools' code is only downloaded by browsers that
 * have WebMCP.
 */
function WebMcpTools() {
  const { kits, gearKinds } = useCatalog();
  const catalog = useRef<CatalogSnapshot>({ kits, gearKinds });
  catalog.current = { kits, gearKinds };

  useEffect(() => {
    const modelContext = (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
    if (!modelContext) return;
    let unregister: (() => void) | null = null;
    let unmounted = false;
    import('./utils/webMcp')
      .then(({ registerRentalTools }) => {
        if (!unmounted) unregister = registerRentalTools(modelContext, () => catalog.current);
      })
      .catch(() => {}); // Offline or a stale deploy: the site works the same without the tools.
    return () => {
      unmounted = true;
      unregister?.();
    };
  }, []);

  return null;
}

/**
 * Meta Pixel PageView for each page change inside the site. The snippet in index.html already
 * counts the first page; the site then switches pages without reloading, so later pages would
 * otherwise never be counted. Does nothing where the pixel isn't loaded (local development).
 */
function MetaPixelPageViews() {
  const { pathname } = useLocation();
  const firstPage = useRef(true);
  useEffect(() => {
    if (firstPage.current) {
      firstPage.current = false;
      return;
    }
    // Only with the visitor's consent (the pixel isn't even loaded without it).
    if (readCookieConsent() === 'granted') window.fbq?.('track', 'PageView');
  }, [pathname]);
  return null;
}

function App() {
  return (
    <AuthProvider>
      <CatalogProvider>
        <RentalProvider>
          <BrowserRouter>
            <PromoProvider>
            <div className="min-h-screen">
              <VerificationGate />
              <ScrollToTop />
              <MetaPixelPageViews />
              <WebMcpTools />
              <CookieConsent />
              <AccessibilityWidget />
              <Navbar />

              <ErrorBoundary>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <Routes>
                    <Route path="/" element={<LandingPage />} />

                    <Route path="/catalog" element={<CatalogChooser />} />
                    {/* With a slug, a product's own address: its catalog page with that product's
                        details open. One route each, so the catalog keeps its dates and filters
                        while details open and close. */}
                    <Route
                      path="/catalog/camping-packages/:slug?"
                      element={<PathACatalog />}
                    />
                    <Route
                      path="/catalog/build-your-own/:slug?"
                      element={<PathBCatalog />}
                    />

                    <Route path="/cart" element={<Cart />} />
                    <Route path="/checkout" element={<Checkout />} />

                    <Route
                      path="/plan-an-event"
                      element={<EventPlan />}
                    />

                    <Route path="/about-us" element={<AboutUs />} />

                    <Route path="/login" element={<Login />} />
                    <Route
                      path="/forgot-password"
                      element={<ForgotPassword />}
                    />
                    <Route
                      path="/reset-password"
                      element={<ResetPassword />}
                    />

                    <Route
                      path="/my-bookings"
                      element={<MyBookings />}
                    />
                    <Route path="/profile" element={<Profile />} />

                    <Route path="/terms" element={<Terms />} />
                    <Route
                      path="/terms-of-service"
                      element={<TermsOfService />}
                    />
                    <Route
                      path="/privacy-policy"
                      element={<PrivacyPolicy />}
                    />
                    <Route path="/data-deletion" element={<DataDeletion />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>

              <Footer />

              <BackToTop />
              <FloatingHelp />
            </div>
            </PromoProvider>
          </BrowserRouter>
        </RentalProvider>
      </CatalogProvider>
    </AuthProvider>
  );
}

export default App;