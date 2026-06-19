import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../services/api'

const AuthContext = createContext(null)

const TOKEN_KEY   = 'cr_token'
const SESSION_KEY = 'cr_session'

const getStoredSession = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') }
  catch { return null }
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(getStoredSession)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // On mount: if token exists, refresh user data from /api/auth/me
  useEffect(() => {
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
        // Token expired or backend offline — clear stale token
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
    try {
      const data = await authAPI.login({ email, password })
      if (data.success) {
        localStorage.setItem(TOKEN_KEY, data.token)
        const mapped = mapUser(data.user)
        setUser(mapped)
        setLoading(false)
        return { success: true, role: mapped.role }
      }
      setError(data.message || 'Login gagal')
      setLoading(false)
      return { success: false }
    } catch (err) {
      const msg = err.message?.includes('fetch')
        ? 'Tidak dapat terhubung ke server. Pastikan backend aktif.'
        : (err.message || 'Login gagal')
      setError(msg)
      setLoading(false)
      return { success: false }
    }
  }

  const register = async ({ name, email, password, role, city, phone,
                             ktpPhoto, selfiePhoto, verificationStatus }) => {
    setLoading(true)
    setError('')
    try {
      const data = await authAPI.register({
        name, email, password, role,
        city:        city        || undefined,
        phone:       phone       || undefined,
        ktpPhoto:    ktpPhoto    || undefined,
        selfiePhoto: selfiePhoto || undefined,
      })
      if (data.success) {
        localStorage.setItem(TOKEN_KEY, data.token)
        const mapped = mapUser(data.user)
        setUser(mapped)
        setLoading(false)
        return { success: true, role: mapped.role }
      }
      setError(data.message || 'Registrasi gagal')
      setLoading(false)
      return { success: false, message: data.message }
    } catch (err) {
      const msg = err.message?.includes('fetch')
        ? 'Tidak dapat terhubung ke server. Pastikan backend aktif.'
        : (err.message || 'Registrasi gagal')
      setError(msg)
      setLoading(false)
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
    try {
      const data = await authAPI.update(updates)
      if (data.success && data.user) {
        const mapped = mapUser(data.user)
        setUser(mapped)
        return { success: true }
      }
      return { success: false }
    } catch {
      // Optimistic update even when offline
      setUser((prev) => ({ ...prev, ...updates }))
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
