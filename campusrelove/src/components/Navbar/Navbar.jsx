import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOrders } from '../../context/OrderContext'
import styles from './Navbar.module.css'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { getUserNotifs, getUnreadCount, getUnreadChatCount, markNotifRead, markAllRead } = useOrders()

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/browse', label: 'Browse' },
    { to: '/relove-carry', label: 'Preloved-Carry 🚚' },
  ]

  const handleLogout = () => {
    logout()
    setDropdownOpen(false)
    navigate('/auth')   // ← selalu ke /auth setelah logout
  }

  const roleLabel = {
    admin:   '🛡️ Admin',
    seller:  '📦 Penjual',
    buyer:   '🛍️ Pembeli',
    carrier: '🚚 Carrier',
  }

  const unreadNotif = user ? getUnreadCount(user.id) : 0
  const unreadChat  = user ? getUnreadChatCount(user.id) : 0
  const myNotifs    = user ? getUserNotifs(user.id).slice(0, 8) : []

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <Link to="/" className={styles.logo}>
          <span className={styles.logoIcon}>♻️</span>
          <span className={styles.logoText}>
            Pre<span className={styles.logoAccent}>loved</span>
          </span>
        </Link>

        <div className={`${styles.navLinks} ${menuOpen ? styles.open : ''}`}>
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`${styles.navLink} ${location.pathname === link.to ? styles.active : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}

          {/* Show Dashboard only for seller/admin/carrier */}
          {user && (user.role === 'seller' || user.role === 'admin' || user.role === 'carrier') && (
            <Link
              to={user.role === 'admin' ? '/admin' : user.role === 'carrier' ? '/carrier' : '/dashboard'}
              className={`${styles.navLink} ${(location.pathname === '/dashboard' || location.pathname === '/admin' || location.pathname === '/carrier') ? styles.active : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {user.role === 'admin' ? '🛡️ Admin' : user.role === 'carrier' ? '🚚 Carrier' : '📊 Dashboard'}
            </Link>
          )}

          {/* Orders link for buyer/seller */}
          {user && user.role !== 'admin' && (
            <Link
              to="/orders"
              className={`${styles.navLink} ${location.pathname === '/orders' ? styles.active : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              📋 Pesanan
            </Link>
          )}

          {/* Auth section */}
          {user ? (
            <div className={styles.rightGroup}>
              {/* Chat icon */}
              {user.role !== 'admin' && (
                <Link to="/chat" className={styles.iconBtn} title="Pesan">
                  💬
                  {unreadChat > 0 && <span className={styles.iconBadge}>{unreadChat}</span>}
                </Link>
              )}

              {/* Notification bell */}
              <div className={styles.notifWrapper}>
                <button
                  className={styles.iconBtn}
                  onClick={() => { setNotifOpen(!notifOpen); setDropdownOpen(false) }}
                  title="Notifikasi"
                >
                  🔔
                  {unreadNotif > 0 && <span className={styles.iconBadge}>{unreadNotif}</span>}
                </button>

                {notifOpen && (
                  <div className={styles.notifDropdown}>
                    <div className={styles.notifHeader}>
                      <span>🔔 Notifikasi</span>
                      {unreadNotif > 0 && (
                        <button className={styles.markAllBtn} onClick={() => markAllRead(user.id)}>
                          Tandai semua dibaca
                        </button>
                      )}
                    </div>
                    {myNotifs.length === 0 ? (
                      <div className={styles.notifEmpty}>Belum ada notifikasi</div>
                    ) : (
                      myNotifs.map(n => (
                        <div
                          key={n.notifId}
                          className={`${styles.notifItem} ${!n.isRead ? styles.notifUnread : ''}`}
                          onClick={() => {
                            markNotifRead(n.notifId)
                            setNotifOpen(false)
                            if (n.orderId) navigate('/orders')
                          }}
                        >
                          <p className={styles.notifMsg}>{n.message}</p>
                          <span className={styles.notifTime}>
                            {new Date(n.createdAt).toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                    <Link to="/orders" className={styles.notifFooter} onClick={() => setNotifOpen(false)}>
                      Lihat semua pesanan →
                    </Link>
                  </div>
                )}
              </div>

              {/* User avatar dropdown */}
              <div className={styles.userMenu}>
                <button
                  className={styles.userBtn}
                  onClick={() => { setDropdownOpen(!dropdownOpen); setNotifOpen(false) }}
                >
                  <img src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} alt={user.name} className={styles.userAvatar} />
                  <span className={styles.userName}>{user.name.split(' ')[0]}</span>
                  <span className={styles.chevron}>{dropdownOpen ? '▲' : '▼'}</span>
                </button>

                {dropdownOpen && (
                  <div className={styles.dropdown}>
                    <div className={styles.dropdownHeader}>
                      <img src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} alt={user.name} className={styles.dropdownAvatar} />
                      <div>
                        <div className={styles.dropdownName}>{user.name}</div>
                        <div className={styles.dropdownEmail}>{user.email}</div>
                        <span className={styles.dropdownRole}>{roleLabel[user.role]}</span>
                      </div>
                    </div>
                    <div className={styles.dropdownDivider}></div>
                    {user.role === 'seller' && (
                      <Link to="/dashboard" className={styles.dropdownItem} onClick={() => { setDropdownOpen(false); setMenuOpen(false) }}>
                        📊 Dashboard Penjual
                      </Link>
                    )}
                    {user.role === 'carrier' && (
                      <Link to="/carrier" className={styles.dropdownItem} onClick={() => { setDropdownOpen(false); setMenuOpen(false) }}>
                        🚚 Carrier Dashboard
                      </Link>
                    )}
                    {user.role !== 'admin' && (
                      <Link to="/orders" className={styles.dropdownItem} onClick={() => { setDropdownOpen(false); setMenuOpen(false) }}>
                        📋 Pesanan Saya
                      </Link>
                    )}
                    {user.role === 'admin' && (
                      <Link to="/admin" className={styles.dropdownItem} onClick={() => { setDropdownOpen(false); setMenuOpen(false) }}>
                        🛡️ Admin Panel
                      </Link>
                    )}
                    <button className={styles.dropdownLogout} onClick={handleLogout}>
                      🚪 Keluar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.authBtns}>
              <Link to="/auth" state={{ mode: 'login' }} className={styles.btnLogin} onClick={() => setMenuOpen(false)}>
                Masuk
              </Link>
              <Link to="/auth" state={{ mode: 'register' }} className={styles.btnRegister} onClick={() => setMenuOpen(false)}>
                Daftar
              </Link>
            </div>
          )}

          {/* Sell button - only for logged in sellers */}
          {user && user.role === 'seller' && (
            <Link to="/dashboard" className={styles.btnSell} onClick={() => setMenuOpen(false)}>
              + Jual Barang
            </Link>
          )}
          {!user && (
            <Link to="/auth" state={{ mode: 'register' }} className={styles.btnSell} onClick={() => setMenuOpen(false)}>
              + Jual Barang
            </Link>
          )}
        </div>

        <button
          className={styles.hamburger}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span className={menuOpen ? styles.barOpen : styles.bar}></span>
          <span className={menuOpen ? styles.barOpen : styles.bar}></span>
          <span className={menuOpen ? styles.barOpen : styles.bar}></span>
        </button>
      </div>
    </nav>
  )
}
