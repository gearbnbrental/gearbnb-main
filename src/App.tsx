import { lazy, Suspense, useEffect, useLayoutEffect, type ComponentType } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import BackToTop from './components/BackToTop';
import ErrorBoundary from './components/ErrorBoundary';
import FloatingHelp from './components/FloatingHelp';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CatalogProvider } from './context/CatalogContext';
import { RentalProvider } from './context/RentalContext';

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
const PathACatalog = lazyWithRetry(() => import('./pages/PathACatalog'));
const PathBCatalog = lazyWithRetry(() => import('./pages/PathBCatalog'));
const PrivacyPolicy = lazyWithRetry(() => import('./pages/PrivacyPolicy'));
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

/**
 * Resets the window scroll position whenever the route changes.
 * Hash URLs are preserved for intentional section links.
 */
function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useLayoutEffect(() => {
    if (hash) return;

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    });
  }, [pathname, hash]);

  return null;
}

function App() {
  return (
    <AuthProvider>
      <CatalogProvider>
        <RentalProvider>
          <BrowserRouter>
            <div className="min-h-screen">
              <VerificationGate />
              <ScrollToTop />
              <Navbar />

              <ErrorBoundary>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <Routes>
                    <Route path="/" element={<LandingPage />} />

                    <Route path="/catalog" element={<CatalogChooser />} />
                    <Route
                      path="/catalog/camping-packages"
                      element={<PathACatalog />}
                    />
                    <Route
                      path="/catalog/build-your-own"
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
                  </Routes>
                </Suspense>
              </ErrorBoundary>

              <Footer />

              <BackToTop />
              <FloatingHelp />
            </div>
          </BrowserRouter>
        </RentalProvider>
      </CatalogProvider>
    </AuthProvider>
  );
}

export default App;