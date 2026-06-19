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
import './App.css'

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
          <Route path="/checkout/:id" element={<CheckoutPage />} />
          <Route path="/orders"       element={<OrdersPage />} />
          <Route path="/chat"         element={<ChatPage />} />
          <Route path="/dashboard"    element={<SellerDashboard />} />
          <Route path="/profile"      element={<ProfilePage />} />
          <Route path="/auth"         element={<AuthPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <ProductProvider>
        <OrderProvider>
          <Routes>
            <Route path="/admin" element={<AdminLayout />} />
            <Route path="/*"     element={<MainLayout />} />
          </Routes>
        </OrderProvider>
      </ProductProvider>
    </AuthProvider>
  )
}

export default App
