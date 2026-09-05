import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import { AuthProvider } from './context/AuthContext';
import { CatalogProvider } from './context/CatalogContext';
import { RentalProvider } from './context/RentalContext';
import About from './pages/About';
import Cart from './pages/Cart';
import CatalogChooser from './pages/CatalogChooser';
import Checkout from './pages/Checkout';
import EventPlan from './pages/EventPlan';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import MyBookings from './pages/MyBookings';
import PathACatalog from './pages/PathACatalog';
import PathBCatalog from './pages/PathBCatalog';
import Terms from './pages/Terms';

function App() {
  return (
    <AuthProvider>
      <CatalogProvider>
        <RentalProvider>
          <BrowserRouter>
            <div className="min-h-screen">
              <Navbar />

              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/catalog" element={<CatalogChooser />} />
                <Route path="/catalog/path-a" element={<PathACatalog />} />
                <Route path="/catalog/path-b" element={<PathBCatalog />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/event-plan" element={<EventPlan />} />
                <Route path="/about" element={<About />} />
                <Route path="/login" element={<Login />} />
                <Route path="/my-bookings" element={<MyBookings />} />
                <Route path="/terms" element={<Terms />} />
              </Routes>
            </div>
          </BrowserRouter>
        </RentalProvider>
      </CatalogProvider>
    </AuthProvider>
  );
}

export default App;
