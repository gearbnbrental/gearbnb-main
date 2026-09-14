import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import BackToTop from './components/BackToTop';
import FloatingHelp from './components/FloatingHelp';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CatalogProvider } from './context/CatalogContext';
import { RentalProvider } from './context/RentalContext';
import AboutUs from './pages/AboutUs';
import Cart from './pages/Cart';
import CatalogChooser from './pages/CatalogChooser';
import Checkout from './pages/Checkout';
import EventPlan from './pages/EventPlan';
import ForgotPassword from './pages/ForgotPassword';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import MyBookings from './pages/MyBookings';
import PathACatalog from './pages/PathACatalog';
import PathBCatalog from './pages/PathBCatalog';
import Profile from './pages/Profile';
import Terms from './pages/Terms';

/**
 * App-wide enforcement of "signed up but hasn't confirmed their email yet" — Login.tsx already
 * shows the mandatory verify screen when reached directly, but a customer who somehow holds a
 * session with an unconfirmed email (see needsEmailVerification's own doc comment — a defensive
 * backstop, since a fresh signup normally never gets a session at all until confirmed) and
 * navigated straight to another route would otherwise browse the rest of the site as if fully
 * verified. Redirects to /login, which renders that same mandatory screen, rather than
 * duplicating it here. /forgot-password is also exempt: a customer mid password-recovery holds a
 * real (if temporary) session there too, and must never be bounced away from setting their new
 * password.
 */
function VerificationGate() {
  const { user, needsEmailVerification, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user || !needsEmailVerification) return;
    if (location.pathname === '/login' || location.pathname === '/forgot-password') return;
    navigate('/login', { replace: true });
  }, [loading, user, needsEmailVerification, location.pathname, navigate]);

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
              <Navbar />

              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/catalog" element={<CatalogChooser />} />
                <Route path="/catalog/path-a" element={<PathACatalog />} />
                <Route path="/catalog/path-b" element={<PathBCatalog />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/event-plan" element={<EventPlan />} />
                <Route path="/about-us" element={<AboutUs />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/my-bookings" element={<MyBookings />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/terms" element={<Terms />} />
              </Routes>

              {/* One shared footer for every route above, rather than each page carrying its own
                  copy — see Footer's own doc comment. */}
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
