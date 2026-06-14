import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

// Akun admin default
const ADMIN_ACCOUNTS = [
  { id: 'admin1', email: 'admin@preloved.id', password: 'admin123', name: 'Admin Preloved', role: 'admin' },
  // Fallback email lama agar tidak error jika ada yang masih pakai
  { id: 'admin1', email: 'admin@campusrelove.id', password: 'admin123', name: 'Admin Preloved', role: 'admin' },
]

// Simulasi database user di localStorage
const getStoredUsers = () => {
  try {
    return JSON.parse(localStorage.getItem('cr_users') || '[]')
  } catch {
    return []
  }
}

const saveUsers = (users) => {
  localStorage.setItem('cr_users', JSON.stringify(users))
}

const getStoredSession = () => {
  try {
    return JSON.parse(localStorage.getItem('cr_session') || 'null')
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredSession)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Simpan session ke localStorage setiap kali user berubah
  useEffect(() => {
    if (user) {
      localStorage.setItem('cr_session', JSON.stringify(user))
    } else {
      localStorage.removeItem('cr_session')
    }
  }, [user])

  const login = (email, password) => {
    setLoading(true)
    setError('')

    // Cek admin
    const adminAccount = ADMIN_ACCOUNTS.find(
      (a) => a.email === email && a.password === password
    )
    if (adminAccount) {
      const { password: _, ...safeAdmin } = adminAccount
      setUser(safeAdmin)
      setLoading(false)
      return { success: true, role: 'admin' }
    }

    // Cek user biasa
    const users = getStoredUsers()
    const found = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    )

    if (found) {
      const { password: _, ...safeUser } = found
      setUser(safeUser)
      setLoading(false)
      return { success: true, role: found.role }
    }
    setError('Email atau password salah')
    setLoading(false)
    return { success: false }
  }

  const register = ({ name, email, password, role, city, phone,
                       ktpPhoto, selfiePhoto, verificationStatus }) => {
    setLoading(true)
    setError('')

    const users = getStoredUsers()

    if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
      setError('Email sudah terdaftar')
      setLoading(false)
      return { success: false, message: 'Email sudah terdaftar' }
    }

    const newUser = {
      id: `u${Date.now()}`,
      name,
      email,
      password,
      role,
      city:   city  || '',
      phone:  phone || '',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
      rating: 0,
      totalSales: 0,
      reviews: [],
      verified: false,              // admin yang approve setelah cek KTP
      balance: 0,
      joinDate: new Date().toISOString().split('T')[0],
      // Identity verification data
      ktpPhoto:           ktpPhoto           || null,
      selfiePhoto:        selfiePhoto        || null,
      verificationStatus: verificationStatus || 'pending',  // pending | approved | rejected
      verificationDate:   null,
    }

    users.push(newUser)
    saveUsers(users)

    const { password: _, ...safeUser } = newUser
    setUser(safeUser)
    setLoading(false)
    return { success: true, role }
  }

  const logout = () => {
    setUser(null)
    setError('')
  }

  const updateProfile = (updates) => {
    if (!user) return
    const updatedUser = { ...user, ...updates }
    setUser(updatedUser)

    // Update di "database"
    const users = getStoredUsers()
    const idx = users.findIndex((u) => u.id === user.id)
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...updates }
      saveUsers(users)
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
