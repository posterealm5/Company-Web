import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';
import { Navbar, Footer } from './components/Navigation';
import { OfferTicker } from './components/OfferTicker';
import { Notification } from './components/Notification';
import { CartProvider } from './context/CartContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WishlistProvider } from './context/WishlistContext';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { LoadingScreen } from './components/ui/LoadingScreen';

import Home from './pages/Home';

const Customize = lazy(() => import('./pages/Customize'));
const Collections = lazy(() => import('./pages/Collections'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const Cart = lazy(() => import('./pages/Cart'));
const Account = lazy(() => import('./pages/Account'));
const UserOrders = lazy(() => import('./pages/UserOrders'));
const Checkout = lazy(() => import('./pages/Checkout'));
const OrderSummary = lazy(() => import('./pages/OrderSummary'));
const Payment = lazy(() => import('./pages/Payment'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Login = lazy(() => import('./pages/Login'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const FAQ = lazy(() => import('./pages/FAQ'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));

// Admin lazy loaded components
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const AdminOrders = lazy(() => import('./pages/admin/Orders'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminOffers = lazy(() => import('./pages/admin/Offers'));
const AdminReviews = lazy(() => import('./pages/admin/Reviews'));
const AdminShowcase = lazy(() => import('./pages/admin/Showcase'));
const AdminCoupons = lazy(() => import('./pages/admin/Coupons'));

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

import { HelmetProvider } from 'react-helmet-async';

export default function App() {
  return (
    <HelmetProvider>
      <ErrorBoundary>
        <Router>
          <NotificationProvider>
            <AuthProvider>
              <CartProvider>
                <WishlistProvider>
                  <AppContent />
                </WishlistProvider>
              </CartProvider>
            </AuthProvider>
          </NotificationProvider>
        </Router>
      </ErrorBoundary>
    </HelmetProvider>
  );
}

import { AlertCircle, RefreshCw } from 'lucide-react';

import { useContentProtection } from './hooks/useContentProtection';

function AppContent() {
  useContentProtection();
  
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');
  const [hasActiveOffers, setHasActiveOffers] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const { user } = useAuth();
  const { triggerNotification } = useNotification();

  useEffect(() => {
    if (user) {
      const pendingGoogle = sessionStorage.getItem('pending_google_login');
      if (pendingGoogle === 'true') {
        sessionStorage.removeItem('pending_google_login');
        setTimeout(() => {
          triggerNotification('Welcome Back!', "You've successfully signed in with Google.", 'success');
        }, 500);
      }
    }
  }, [user, triggerNotification]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOffline) {
    return (
      <div className="min-h-screen bg-brand-white flex items-center justify-center px-4 z-[9999] relative">
        <div className="max-w-md w-full bg-white comic-border border-2 border-brand-black p-8 text-center space-y-6 shadow-[8px_8px_0px_0px_rgba(230,57,70,1)]">
          <div className="w-16 h-16 bg-red-50 border-2 border-brand-red flex items-center justify-center mx-auto text-brand-red rotate-[-3deg]">
            <AlertCircle size={32} />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black uppercase tracking-tight">Connection issue detected.</h3>
            <p className="text-gray-500 font-medium text-xs">Please check your internet connection.</p>
          </div>
          <button
            onClick={() => {
              if (navigator.onLine) {
                setIsOffline(false);
                window.location.reload();
              }
            }}
            className="w-full py-3 bg-brand-red text-white font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 comic-border border-white hover:bg-brand-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen grunge-texture overflow-x-hidden">
      <ScrollToTop />
      {!isAdminPage && (
        <>
          <div className="fixed top-0 left-0 w-full z-50">
            <OfferTicker onVisibilityChange={setHasActiveOffers} />
          </div>
          <Navbar isShifted={hasActiveOffers} />
        </>
      )}
      <main className={`flex-grow transition-all duration-300 ${!isAdminPage && hasActiveOffers ? 'mt-10' : ''}`}>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<ErrorBoundary><Home /></ErrorBoundary>} />
            <Route path="/customize" element={<ErrorBoundary><Customize /></ErrorBoundary>} />
            <Route path="/collections" element={
              <ErrorBoundary>
                <Collections />
              </ErrorBoundary>
            } />
            <Route path="/products/:slug" element={
              <ErrorBoundary>
                <ProductDetail />
              </ErrorBoundary>
            } />
            <Route path="/how-it-works" element={<ErrorBoundary><HowItWorks /></ErrorBoundary>} />
            <Route path="/cart" element={<ErrorBoundary><Cart /></ErrorBoundary>} />
            <Route path="/wishlist" element={<ErrorBoundary><Wishlist /></ErrorBoundary>} />
            <Route path="/reset-password" element={<ErrorBoundary><ResetPassword /></ErrorBoundary>} />
            <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />
            <Route path="/faq" element={<ErrorBoundary><FAQ /></ErrorBoundary>} />
            <Route path="/privacy-policy" element={<ErrorBoundary><PrivacyPolicy /></ErrorBoundary>} />
            <Route path="/terms-of-service" element={<ErrorBoundary><TermsOfService /></ErrorBoundary>} />
            
            {/* Admin Routes */}
            <Route 
              path="/admin" 
              element={
                <AdminRoute>
                  <ErrorBoundary>
                    <AdminLayout />
                  </ErrorBoundary>
                </AdminRoute>
              }
            >
              <Route index element={<ErrorBoundary><AdminDashboard /></ErrorBoundary>} />
              <Route path="products" element={<ErrorBoundary><AdminProducts /></ErrorBoundary>} />
              <Route path="orders" element={<ErrorBoundary><AdminOrders /></ErrorBoundary>} />
              <Route path="users" element={<ErrorBoundary><AdminUsers /></ErrorBoundary>} />
              <Route path="coupons" element={<ErrorBoundary><AdminCoupons /></ErrorBoundary>} />
              <Route path="offers" element={<ErrorBoundary><AdminOffers /></ErrorBoundary>} />
              <Route path="reviews" element={<ErrorBoundary><AdminReviews /></ErrorBoundary>} />
              <Route path="showcase" element={<ErrorBoundary><AdminShowcase /></ErrorBoundary>} />
            </Route>

            <Route 
              path="/account" 
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <Account />
                  </ErrorBoundary>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/orders" 
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <UserOrders />
                  </ErrorBoundary>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/account/orders" 
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <UserOrders />
                  </ErrorBoundary>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/account/order/:id" 
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <UserOrders />
                  </ErrorBoundary>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/checkout" 
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <Checkout />
                  </ErrorBoundary>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/order-summary" 
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <OrderSummary />
                  </ErrorBoundary>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/payment" 
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <Payment />
                  </ErrorBoundary>
                </ProtectedRoute>
              } 
            />
            
            {/* Wildcard 404 Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      {!isAdminPage && <Footer />}
      <Notification />
    </div>
  );
}
