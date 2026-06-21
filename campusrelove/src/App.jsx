import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProductProvider } from './context/ProductContext'
import { OrderProvider } from './context/OrderContext'
import Navbar from './components/Navbar/Navbar'
import Footer from './components/Footer/Footer'
import Home from './pages/Home/Home'
import Browse from './pages/Browse/Browse'
import ProductDetail from './pages/ProductDetail/ProductDetail'
import SellerDashboard from './pages/SellerDashboard/SellerDashboard'
import AuthPage, { VerificationBanner } from './pages/Auth/AuthPage'
import AdminDashboard from './pages/Admin/AdminDashboard'
import CheckoutPage from './pages/Checkout/CheckoutPage'
import OrdersPage from './pages/Orders/OrdersPage'
import ChatPage from './pages/Chat/ChatPage'
import ProfilePage from './pages/Profile/ProfilePage'
import PendingGate from './components/PendingGate/PendingGate'
import { Component } from 'react'
import './App.css'

// ── Error Boundary — mencegah blank page saat ada crash ──────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, background: '#f8fafc', fontFamily: 'Poppins,sans-serif' }}>
          <div style={{ fontSize: '3rem' }}>⚠️</div>
          <h2 style={{ color: '#1a1a2e', margin: 0 }}>Terjadi kesalahan</h2>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', maxWidth: 400, textAlign: 'center' }}>
            {this.state.error?.message || 'Something went wrong'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '12px 24px', background: 'linear-gradient(135deg,#7C3AED,#2563EB)', color: 'white', border: 'none', borderRadius: 12, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}
          >
            🔄 Muat Ulang
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function AdminLayout() {
  return <AdminDashboard />
}

function MainLayout() {
  return (
    <div className="app">
      <Navbar />
      <VerificationBanner />
      <main className="main-content">
        <Routes>
          <Route path="/"             element={<Home />} />
          <Route path="/browse"       element={<Browse />} />
          <Route path="/product/:id"  element={<ProductDetail />} />
          <Route path="/checkout/:id" element={<PendingGate><CheckoutPage /></PendingGate>} />
          <Route path="/orders"       element={<PendingGate><OrdersPage /></PendingGate>} />
          <Route path="/chat"         element={<PendingGate><ChatPage /></PendingGate>} />
          <Route path="/dashboard"    element={<PendingGate><SellerDashboard /></PendingGate>} />
          <Route path="/profile"      element={<PendingGate><ProfilePage /></PendingGate>} />
          <Route path="/auth"         element={<AuthPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ProductProvider>
          <OrderProvider>
            <Routes>
              <Route path="/admin" element={<ErrorBoundary><AdminLayout /></ErrorBoundary>} />
              <Route path="/*"     element={<ErrorBoundary><MainLayout /></ErrorBoundary>} />
            </Routes>
          </OrderProvider>
        </ProductProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
