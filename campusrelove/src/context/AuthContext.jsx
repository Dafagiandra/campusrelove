import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI, isBackendAvailable } from '../services/api'

const AuthContext = createContext(null)

const TOKEN_KEY   = 'cr_token'
const SESSION_KEY = 'cr_session'

// ── localStorage fallback (for demo/GitHub Pages without backend) ─────────────
const getStoredUsers = () => { try { return JSON.parse(localStorage.getItem('cr_users') || '[]') } catch { return [] } }
const saveUsers = (u) => localStorage.setItem('cr_users', JSON.stringify(u))
const ADMIN_ACCOUNTS = [
  { id: 'admin-001', email: 'admin@preloved.id', password: 'admin123', name: 'Admin Preloved', role: 'admin', verified: true, verificationStatus: 'approved', balance: 0 },
]

const getStoredSession = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') }
  catch { return null }
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(getStoredSession)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // On mount: if token exists AND backend available, refresh user data
  useEffect(() => {
    if (!isBackendAvailable()) return  // GitHub Pages / offline mode

    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return

    ;(async () => {
      try {
        const data = await authAPI.me()
        if (data.success && data.user) {
          const mapped = mapUser(data.user)
          setUser(mapped)
          localStorage.setItem(SESSION_KEY, JSON.stringify(mapped))
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(SESSION_KEY)
        setUser(null)
      }
    })()
  }, [])

  // Keep session in sync so page reload is instant
  useEffect(() => {
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(SESSION_KEY)
    }
  }, [user])

  /** Map snake_case DB fields → camelCase to keep components unchanged */
  const mapUser = (u) => ({
    id:                 u.id,
    name:               u.name,
    email:              u.email,
    role:               u.role,
    city:               u.city               || '',
    phone:              u.phone              || '',
    avatar:             u.avatar             || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.name)}`,
    balance:            Number(u.balance)    || 0,
    rating:             Number(u.rating)     || 0,
    totalSales:         u.total_sales        ?? u.totalSales ?? 0,
    verified:           Boolean(u.verified),
    verificationStatus: u.verification_status ?? u.verificationStatus ?? 'pending',
    rejectionNote:      u.rejection_note     ?? u.rejectionNote ?? null,
    joinDate:           u.join_date          ?? u.joinDate ?? '',
  })

  const login = async (email, password) => {
    setLoading(true)
    setError('')

    // ── Offline/demo mode (no backend) ────────────────────────────────────────
    if (!isBackendAvailable()) {
      // Check admin
      const admin = ADMIN_ACCOUNTS.find(a => a.email === email && a.password === password)
      if (admin) {
        const { password: _, ...safeAdmin } = admin
        localStorage.setItem(SESSION_KEY, JSON.stringify(safeAdmin))
        setUser(safeAdmin); setLoading(false)
        return { success: true, role: 'admin' }
      }
      // Check stored users
      const users = getStoredUsers()
      const found = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password)
      if (found) {
        const { password: _, ...safe } = found
        localStorage.setItem(SESSION_KEY, JSON.stringify(safe))
        setUser(safe); setLoading(false)
        return { success: true, role: found.role }
      }
      setError('Email atau password salah'); setLoading(false)
      return { success: false }
    }

    // ── Online mode ───────────────────────────────────────────────────────────
    try {
      const data = await authAPI.login({ email, password })
      if (data.success) {
        localStorage.setItem(TOKEN_KEY, data.token)
        const mapped = mapUser(data.user)
        setUser(mapped); setLoading(false)
        return { success: true, role: mapped.role }
      }
      setError(data.message || 'Login gagal'); setLoading(false)
      return { success: false }
    } catch (err) {
      const msg = err.message?.includes('fetch')
        ? 'Tidak dapat terhubung ke server. Pastikan backend aktif.'
        : (err.message || 'Login gagal')
      setError(msg); setLoading(false)
      return { success: false }
    }
  }

  const register = async ({ name, email, password, role, city, phone,
                             ktpPhoto, selfiePhoto, verificationStatus }) => {
    setLoading(true)
    setError('')

    // ── Offline/demo mode ─────────────────────────────────────────────────────
    if (!isBackendAvailable()) {
      const users = getStoredUsers()
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        setError('Email sudah terdaftar'); setLoading(false)
        return { success: false, message: 'Email sudah terdaftar' }
      }
      const newUser = {
        id: `u${Date.now()}`, name, email, password, role,
        city: city || '', phone: phone || '',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
        balance: 0, rating: 0, totalSales: 0, verified: false,
        verificationStatus: 'pending',
        ktpPhoto: ktpPhoto || null, selfiePhoto: selfiePhoto || null,
        joinDate: new Date().toISOString().split('T')[0],
      }
      users.push(newUser)
      saveUsers(users)
      const { password: _, ...safe } = newUser
      localStorage.setItem(SESSION_KEY, JSON.stringify(safe))
      setUser(safe); setLoading(false)
      return { success: true, role }
    }

    // ── Online mode ───────────────────────────────────────────────────────────
    try {
      const data = await authAPI.register({
        name, email, password, role,
        city: city || undefined, phone: phone || undefined,
        ktpPhoto: ktpPhoto || undefined, selfiePhoto: selfiePhoto || undefined,
      })
      if (data.success) {
        localStorage.setItem(TOKEN_KEY, data.token)
        const mapped = mapUser(data.user)
        setUser(mapped); setLoading(false)
        return { success: true, role: mapped.role }
      }
      setError(data.message || 'Registrasi gagal'); setLoading(false)
      return { success: false, message: data.message }
    } catch (err) {
      const msg = err.message?.includes('fetch')
        ? 'Tidak dapat terhubung ke server. Pastikan backend aktif.'
        : (err.message || 'Registrasi gagal')
      setError(msg); setLoading(false)
      return { success: false, message: msg }
    }
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
    setError('')
  }

  const updateProfile = async (updates) => {
    if (!user) return
    // Always update local session first
    const updatedUser = { ...user, ...updates }
    setUser(updatedUser)
    localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser))

    if (!isBackendAvailable()) {
      // Offline: update localStorage users array
      const users = getStoredUsers()
      const idx = users.findIndex(u => u.id === user.id)
      if (idx !== -1) { users[idx] = { ...users[idx], ...updates }; saveUsers(users) }
      return { success: true }
    }

    try {
      const data = await authAPI.update(updates)
      if (data.success && data.user) {
        const mapped = mapUser(data.user)
        setUser(mapped)
        localStorage.setItem(SESSION_KEY, JSON.stringify(mapped))
      }
      return { success: true }
    } catch {
      return { success: false, offline: true }
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, setError, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
