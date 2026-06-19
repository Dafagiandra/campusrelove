import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProducts } from '../../context/ProductContext'
import { useOrders } from '../../context/OrderContext'
import styles from './AdminDashboard.module.css'

const getStoredUsers = () => {
  try { return JSON.parse(localStorage.getItem('cr_users') || '[]') }
  catch { return [] }
}

const saveStoredUsers = (users) => {
  localStorage.setItem('cr_users', JSON.stringify(users))
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className={styles.statCard} style={{ '--color': color }}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  )
}

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const { allProducts, userProducts, deleteProduct } = useProducts()
  const { getAllOrders, confirmPayment, rejectPayment, releaseFund, isOverdue,
          getUnreadCount, getUserNotifs, markNotifRead,
          getEscrowBalance, getAdminWalletBalance, getAdminWalletHistory,
          PLATFORM_FEE_PERCENT } = useOrders()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [users, setUsers] = useState(getStoredUsers())

  // ── KTP Verification handlers ──────────────────────────────────────────────
  const [ktpModal, setKtpModal] = useState(null) // { user, type: 'ktp'|'selfie' }
  const [rejectNote, setRejectNote] = useState('')

  const pendingVerif = users.filter(u => u.verificationStatus === 'pending' && (u.ktpPhoto || u.selfiePhoto))
  const approvedVerif = users.filter(u => u.verificationStatus === 'approved')
  const rejectedVerif = users.filter(u => u.verificationStatus === 'rejected')

  const handleApproveKtp = (userId) => {
    const updated = getStoredUsers().map(u =>
      u.id === userId ? { ...u, verified: true, verificationStatus: 'approved', verificationDate: new Date().toISOString() } : u
    )
    saveStoredUsers(updated)
    setUsers(updated)
    // Push notification to user
    const notifs = JSON.parse(localStorage.getItem('cr_notifications') || '[]')
    notifs.unshift({
      notifId: `n${Date.now()}`,
      recipientId: userId,
      type: 'verif',
      message: '✅ Identitas kamu sudah diverifikasi oleh Admin! Akun kamu kini aktif penuh.',
      isRead: false,
      createdAt: new Date().toISOString(),
    })
    localStorage.setItem('cr_notifications', JSON.stringify(notifs))
  }

  const handleRejectKtp = (userId, note) => {
    const rejectionNote = note || 'Identitas tidak valid'
    const updated = getStoredUsers().map(u =>
      u.id === userId
        ? { ...u, verified: false, verificationStatus: 'rejected', rejectionNote, verificationDate: new Date().toISOString() }
        : u
    )
    saveStoredUsers(updated)
    setUsers(updated)
    setRejectNote('')
    // Push notification to user with rejection reason
    const notifs = JSON.parse(localStorage.getItem('cr_notifications') || '[]')
    notifs.unshift({
      notifId: `n${Date.now()}`,
      recipientId: userId,
      type: 'verif',
      message: `❌ Verifikasi identitas kamu ditolak. Alasan: ${rejectionNote}. Silakan upload ulang dokumen kamu.`,
      isRead: false,
      createdAt: new Date().toISOString(),
    })
    localStorage.setItem('cr_notifications', JSON.stringify(notifs))
  }

  const handleLogout = () => {
    logout()
    navigate('/auth')   // ← redirect ke /auth setelah logout admin
  }

  const buyers   = users.filter((u) => u.role === 'buyer')
  const sellers  = users.filter((u) => u.role === 'seller')
  const allOrders = getAllOrders()
  const pendingOrders   = allOrders.filter(o => o.status === 'pending_payment')
  const deliveredOrders = allOrders.filter(o => o.status === 'delivered')
  const completedOrders = allOrders.filter(o => o.status === 'completed')
  const overdueOrders   = allOrders.filter(o => isOverdue(o))
  const adminUnread = getUnreadCount('admin1')
  const adminNotifs = getUserNotifs('admin1').slice(0, 10)

  // Dana
  const escrowBalance    = getEscrowBalance()
  const adminWalletBal   = getAdminWalletBalance()
  const adminWalletHist  = getAdminWalletHistory().slice(0, 10)
  const totalTransacted  = completedOrders.reduce((s, o) => s + (o.price || 0), 0)

  const STATUS_LABEL = {
    pending_payment: { label: '⏳ Menunggu Bayar', color: '#F59E0B', bg: '#FEF3C7' },
    paid:            { label: '✅ Dibayar',        color: '#2563EB', bg: '#DBEAFE' },
    processing:      { label: '📦 Diproses',       color: '#7C3AED', bg: '#EDE9FE' },
    shipped:         { label: '🚚 Dikirim',        color: '#059669', bg: '#D1FAE5' },
    delivered:       { label: '📬 Diterima',       color: '#10B981', bg: '#D1FAE5' },
    completed:       { label: '🎉 Selesai',        color: '#065f46', bg: '#D1FAE5' },
    cancelled:       { label: '❌ Dibatalkan',     color: '#DC2626', bg: '#FEE2E2' },
  }

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'verifikasi', label: `🪪 Verifikasi KTP${pendingVerif.length > 0 ? ` (${pendingVerif.length})` : ''}` },
    { id: 'dana',     label: `💰 Dana${escrowBalance > 0 ? ` (${(escrowBalance/1000).toFixed(0)}K)` : ''}` },
    { id: 'orders',   label: `📋 Pesanan${pendingOrders.length > 0 ? ` (${pendingOrders.length})` : ''}` },
    { id: 'notifs',   label: `🔔 Notifikasi${adminUnread > 0 ? ` (${adminUnread})` : ''}` },
    { id: 'users',    label: '👥 Pengguna' },
    { id: 'products', label: '📦 Produk' },
    { id: 'reports',  label: '📋 Laporan' },
  ]

  return (
    <div className={styles.page}>
      {/* Admin Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.adminBadge}>🛡️ Admin Panel</div>
          <h1 className={styles.headerTitle}>Preloved Admin</h1>
          <p className={styles.headerSub}>Selamat datang, <strong>{user?.name}</strong></p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.adminInfo}>
            <span className={styles.adminEmail}>{user?.email}</span>
            <span className={styles.adminRole}>Super Admin</span>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </div>

      <div className={styles.container}>
        {/* Tabs */}
        <div className={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div>
            <div className={styles.statsGrid}>
              <StatCard icon="👥" label="Total Pengguna"    value={users.length}          color="#7C3AED" />
              <StatCard icon="🛍️" label="Pembeli"           value={buyers.length}         color="#2563EB" />
              <StatCard icon="📦" label="Penjual"           value={sellers.length}        color="#10B981" />
              <StatCard icon="🪪" label="Pending Verifikasi" value={pendingVerif.length}  color="#F59E0B" />
              <StatCard icon="🏷️" label="Total Produk"      value={allProducts.length}    color="#EC4899" />
              <StatCard icon="📋" label="Total Pesanan"     value={allOrders.length}      color="#EF4444" />
            </div>

            {/* Dana summary cards */}
            <div className={styles.danaCards}>
              <div className={styles.danaCard} style={{ '--c': '#2563EB' }}>
                <div className={styles.danaCardIcon}>🔒</div>
                <div className={styles.danaCardInfo}>
                  <span className={styles.danaCardLabel}>Dana di Escrow (Ditahan)</span>
                  <strong className={styles.danaCardValue}>Rp {escrowBalance.toLocaleString('id-ID')}</strong>
                  <span className={styles.danaCardSub}>Dari {allOrders.filter(o => ['paid','processing','shipped'].includes(o.status)).length} pesanan aktif</span>
                </div>
              </div>
              <div className={styles.danaCard} style={{ '--c': '#10B981' }}>
                <div className={styles.danaCardIcon}>💰</div>
                <div className={styles.danaCardInfo}>
                  <span className={styles.danaCardLabel}>Komisi Platform ({PLATFORM_FEE_PERCENT}%)</span>
                  <strong className={styles.danaCardValue}>Rp {adminWalletBal.toLocaleString('id-ID')}</strong>
                  <span className={styles.danaCardSub}>Total terkumpul</span>
                </div>
              </div>
              <div className={styles.danaCard} style={{ '--c': '#7C3AED' }}>
                <div className={styles.danaCardIcon}>📊</div>
                <div className={styles.danaCardInfo}>
                  <span className={styles.danaCardLabel}>Total Transaksi Selesai</span>
                  <strong className={styles.danaCardValue}>Rp {totalTransacted.toLocaleString('id-ID')}</strong>
                  <span className={styles.danaCardSub}>{completedOrders.length} pesanan</span>
                </div>
              </div>
            </div>

            {/* Overdue warning */}
            {overdueOrders.length > 0 && (
              <div className={styles.overdueAlert}>
                ⚠️ <strong>{overdueOrders.length} pesanan overdue</strong> — penjual belum merespon lebih dari 48 jam!
              </div>
            )}

            <div className={styles.recentSection}>
              <h3 className={styles.sectionTitle}>👤 Pengguna Terbaru</h3>
              {users.length === 0 ? (
                <div className={styles.emptyState}><span>😴</span><p>Belum ada pengguna yang mendaftar</p></div>
              ) : (
                <div className={styles.userList}>
                  {users.slice(-5).reverse().map((u) => (
                    <div key={u.id} className={styles.userRow}>
                      <img src={u.avatar} alt={u.name} className={styles.userAvatar} />
                      <div className={styles.userInfo}>
                        <span className={styles.userName}>{u.name}</span>
                        <span className={styles.userEmail}>{u.email}</span>
                      </div>
                      <span className={`${styles.rolePill} ${u.role === 'seller' ? styles.roleSeller : styles.roleBuyer}`}>
                        {u.role === 'seller' ? '📦 Penjual' : '🛍️ Pembeli'}
                      </span>
                      <span className={styles.joinDate}>{u.joinDate}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Verifikasi KTP Tab */}
        {activeTab === 'verifikasi' && (
          <div>
            {/* Stats row */}
            <div className={styles.verifStats}>
              <div className={styles.verifStat} style={{ '--c': '#F59E0B' }}>
                <span className={styles.verifStatNum}>{pendingVerif.length}</span>
                <span>⏳ Menunggu</span>
              </div>
              <div className={styles.verifStat} style={{ '--c': '#10B981' }}>
                <span className={styles.verifStatNum}>{approvedVerif.length}</span>
                <span>✅ Disetujui</span>
              </div>
              <div className={styles.verifStat} style={{ '--c': '#EF4444' }}>
                <span className={styles.verifStatNum}>{rejectedVerif.length}</span>
                <span>❌ Ditolak</span>
              </div>
            </div>

            {/* Pending verifications */}
            <h3 className={styles.sectionTitle}>⏳ Menunggu Verifikasi ({pendingVerif.length})</h3>
            {pendingVerif.length === 0 ? (
              <div className={styles.emptyState}><span>✅</span><p>Semua identitas sudah diverifikasi</p></div>
            ) : (
              <div className={styles.verifList}>
                {pendingVerif.map(u => (
                  <div key={u.id} className={styles.verifCard}>
                    <div className={styles.verifCardHeader}>
                      <img src={u.avatar} alt={u.name} className={styles.verifAvatar} />
                      <div className={styles.verifUserInfo}>
                        <strong>{u.name}</strong>
                        <span>{u.email}</span>
                        <span className={`${styles.rolePill} ${u.role === 'seller' ? styles.roleSeller : styles.roleBuyer}`}>
                          {u.role === 'seller' ? '📦 Penjual' : '🛍️ Pembeli'}
                        </span>
                        <span className={styles.verifDate}>Daftar: {u.joinDate}</span>
                      </div>
                      <span className={styles.verifPendingBadge}>⏳ Pending</span>
                    </div>

                    <div className={styles.verifPhotos}>
                      {u.ktpPhoto && (
                        <div className={styles.verifPhotoBox}>
                          <p className={styles.verifPhotoLabel}>🪪 Foto KTP / Identitas</p>
                          <img
                            src={u.ktpPhoto}
                            alt="KTP"
                            className={styles.verifPhotoImg}
                            onClick={() => setKtpModal({ user: u, type: 'ktp' })}
                          />
                          <button className={styles.verifZoomBtn} onClick={() => setKtpModal({ user: u, type: 'ktp' })}>
                            🔍 Lihat Full
                          </button>
                        </div>
                      )}
                      {u.selfiePhoto && (
                        <div className={styles.verifPhotoBox}>
                          <p className={styles.verifPhotoLabel}>🤳 Foto Selfie</p>
                          <img
                            src={u.selfiePhoto}
                            alt="Selfie"
                            className={styles.verifPhotoImg}
                            onClick={() => setKtpModal({ user: u, type: 'selfie' })}
                          />
                          <button className={styles.verifZoomBtn} onClick={() => setKtpModal({ user: u, type: 'selfie' })}>
                            🔍 Lihat Full
                          </button>
                        </div>
                      )}
                    </div>

                    <div className={styles.verifInfo}>
                      <span>📱 WA: {u.phone || '-'}</span>
                      <span>🏙️ Kota: {u.city || '-'}</span>
                    </div>

                    <div className={styles.verifActions}>
                      <input
                        type="text"
                        placeholder="Alasan penolakan (jika ditolak)..."
                        className={styles.rejectInput}
                        id={`reject-${u.id}`}
                      />
                      <button
                        className={styles.btnApproveVerif}
                        onClick={() => handleApproveKtp(u.id)}
                      >
                        ✅ Setujui
                      </button>
                      <button
                        className={styles.btnRejectVerif}
                        onClick={() => {
                          const note = document.getElementById(`reject-${u.id}`)?.value
                          handleRejectKtp(u.id, note)
                        }}
                      >
                        ❌ Tolak
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Approved */}
            {approvedVerif.length > 0 && (
              <>
                <h3 className={styles.sectionTitle} style={{ marginTop: 32 }}>✅ Sudah Diverifikasi ({approvedVerif.length})</h3>
                <div className={styles.verifDoneList}>
                  {approvedVerif.map(u => (
                    <div key={u.id} className={styles.verifDoneRow}>
                      <img src={u.avatar} alt={u.name} className={styles.tableAvatar} />
                      <div className={styles.verifDoneInfo}>
                        <strong>{u.name}</strong>
                        <span>{u.email}</span>
                      </div>
                      <span className={`${styles.rolePill} ${u.role === 'seller' ? styles.roleSeller : styles.roleBuyer}`}>
                        {u.role === 'seller' ? '📦 Penjual' : '🛍️ Pembeli'}
                      </span>
                      <span className={styles.verifApprovedBadge}>✅ Verified</span>
                      {u.verificationDate && (
                        <span className={styles.verifDate}>
                          {new Date(u.verificationDate).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Rejected */}
            {rejectedVerif.length > 0 && (
              <>
                <h3 className={styles.sectionTitle} style={{ marginTop: 32 }}>❌ Ditolak ({rejectedVerif.length})</h3>
                <div className={styles.verifDoneList}>
                  {rejectedVerif.map(u => (
                    <div key={u.id} className={styles.verifDoneRow}>
                      <img src={u.avatar} alt={u.name} className={styles.tableAvatar} />
                      <div className={styles.verifDoneInfo}>
                        <strong>{u.name}</strong>
                        <span>{u.email}</span>
                      </div>
                      <span className={`${styles.rolePill} ${u.role === 'seller' ? styles.roleSeller : styles.roleBuyer}`}>
                        {u.role === 'seller' ? '📦 Penjual' : '🛍️ Pembeli'}
                      </span>
                      <span className={styles.verifRejectedBadge}>❌ Ditolak</span>
                      {u.rejectionNote && <span className={styles.rejectionNote}>Alasan: {u.rejectionNote}</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Dana Tab */}
        {activeTab === 'dana' && (
          <div>
            <div className={styles.danaCards} style={{ marginBottom: 32 }}>
              <div className={styles.danaCard} style={{ '--c': '#2563EB' }}>
                <div className={styles.danaCardIcon}>🔒</div>
                <div className={styles.danaCardInfo}>
                  <span className={styles.danaCardLabel}>Dana di Escrow (Ditahan)</span>
                  <strong className={styles.danaCardValue}>Rp {escrowBalance.toLocaleString('id-ID')}</strong>
                  <span className={styles.danaCardSub}>Dari {allOrders.filter(o => ['paid','processing','shipped'].includes(o.status)).length} pesanan aktif</span>
                </div>
              </div>
              <div className={styles.danaCard} style={{ '--c': '#10B981' }}>
                <div className={styles.danaCardIcon}>💰</div>
                <div className={styles.danaCardInfo}>
                  <span className={styles.danaCardLabel}>Saldo Komisi Admin ({PLATFORM_FEE_PERCENT}%)</span>
                  <strong className={styles.danaCardValue}>Rp {adminWalletBal.toLocaleString('id-ID')}</strong>
                  <span className={styles.danaCardSub}>Profit platform terkumpul</span>
                </div>
              </div>
            </div>

            <div className={styles.danaFlowCard}>
              <h3>📊 Alur Dana Preloved (Escrow)</h3>
              <div className={styles.danaFlow}>
                <div className={styles.danaFlowStep}>
                  <div className={styles.danaFlowIcon} style={{ background: '#FEF3C7', color: '#D97706' }}>💳</div>
                  <div className={styles.danaFlowText}>
                    <strong>1. Pembeli Bayar</strong>
                    <span>Dana masuk Escrow Admin</span>
                  </div>
                </div>
                <div className={styles.danaFlowArrow}>→</div>
                <div className={styles.danaFlowStep}>
                  <div className={styles.danaFlowIcon} style={{ background: '#DBEAFE', color: '#2563EB' }}>🔒</div>
                  <div className={styles.danaFlowText}>
                    <strong>2. Escrow Aktif</strong>
                    <span>Penjual proses & kirim</span>
                  </div>
                </div>
                <div className={styles.danaFlowArrow}>→</div>
                <div className={styles.danaFlowStep}>
                  <div className={styles.danaFlowIcon} style={{ background: '#D1FAE5', color: '#059669' }}>✅</div>
                  <div className={styles.danaFlowText}>
                    <strong>3. Pembeli Konfirmasi</strong>
                    <span>Klik "Pesanan Selesai"</span>
                  </div>
                </div>
                <div className={styles.danaFlowArrow}>→</div>
                <div className={styles.danaFlowStep}>
                  <div className={styles.danaFlowIcon} style={{ background: '#EDE9FE', color: '#7C3AED' }}>💸</div>
                  <div className={styles.danaFlowText}>
                    <strong>4. Dana Cair Otomatis</strong>
                    <span>Penjual ({100-PLATFORM_FEE_PERCENT}%) + Admin ({PLATFORM_FEE_PERCENT}%)</span>
                  </div>
                </div>
              </div>
              <div className={styles.danaExample}>
                <h4>Contoh Transaksi Rp 100.000</h4>
                <div className={styles.danaExampleTable}>
                  <div className={`${styles.danaExRow} ${styles.danaExHeader}`}>
                    <span>Kondisi</span><span>Saldo Admin</span><span>Saldo Penjual</span><span>Keterangan</span>
                  </div>
                  <div className={styles.danaExRow}>
                    <span>Baru Bayar</span>
                    <span className={styles.danaExEscrow}>Rp 100.000 (Escrow)</span>
                    <span>Rp 0</span>
                    <span>Dana aman di tangan Admin</span>
                  </div>
                  <div className={styles.danaExRow}>
                    <span>Pesanan Selesai</span>
                    <span className={styles.danaExProfit}>Rp {Math.round(100000 * PLATFORM_FEE_PERCENT / 100).toLocaleString('id-ID')} (komisi)</span>
                    <span className={styles.danaExSeller}>Rp {(100000 - Math.round(100000 * PLATFORM_FEE_PERCENT / 100)).toLocaleString('id-ID')}</span>
                    <span>Admin ambil {PLATFORM_FEE_PERCENT}%, sisanya ke Penjual</span>
                  </div>
                </div>
              </div>
            </div>

            <h3 className={styles.sectionTitle} style={{ marginTop: 32 }}>📜 Riwayat Komisi Platform</h3>
            {adminWalletHist.length === 0 ? (
              <div className={styles.emptyState}><span>💰</span><p>Belum ada komisi terkumpul</p></div>
            ) : (
              <div className={styles.walletHistory}>
                {adminWalletHist.map(h => (
                  <div key={h.id} className={styles.walletRow}>
                    <div className={styles.walletIcon}>💰</div>
                    <div className={styles.walletInfo}>
                      <strong>{h.productTitle}</strong>
                      <span>Komisi Produk · #{h.orderId.slice(-8).toUpperCase()}</span>
                    </div>
                    <div className={styles.walletAmount}>+Rp {h.amount.toLocaleString('id-ID')}</div>
                    <div className={styles.walletDate}>
                      {new Date(h.createdAt).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div>
            <h3 className={styles.sectionTitle}>📋 Semua Pesanan ({allOrders.length})</h3>
            {allOrders.length === 0 ? (
              <div className={styles.emptyState}><span>📭</span><p>Belum ada pesanan</p></div>
            ) : (
              <div className={styles.orderTable}>
                {allOrders.map(o => {
                  const st = STATUS_LABEL[o.status] || STATUS_LABEL.pending_payment
                  const overdue = isOverdue(o)
                  return (
                    <div key={o.orderId} className={`${styles.orderRow} ${overdue ? styles.orderRowOverdue : ''}`}>
                      <div className={styles.orderMeta}>
                        <span className={styles.orderId}>#{o.orderId.slice(-8).toUpperCase()}</span>
                        <span className={styles.orderDate}>{new Date(o.createdAt).toLocaleDateString('id-ID')}</span>
                        {overdue && <span className={styles.overdueBadge}>⚠️ Overdue</span>}
                      </div>
                      <div className={styles.orderProduct}>
                        <strong>{o.productTitle}</strong>
                        <span>Pembeli: {o.buyerName}</span>
                        <span>Rp {o.price.toLocaleString('id-ID')}</span>
                        {o.status === 'completed' && (
                          <span className={styles.orderFundSplit}>
                            Penjual: Rp {(o.sellerAmount ?? o.price - (o.platformFee ?? 0)).toLocaleString('id-ID')} |
                            Komisi: Rp {(o.platformFee ?? 0).toLocaleString('id-ID')}
                          </span>
                        )}
                      </div>
                      <span className={styles.orderStatus} style={{ color: st.color, background: st.bg }}>
                        {st.label}
                      </span>
                      <div className={styles.orderAdminActions}>
                        {o.status === 'pending_payment' && (
                          <>
                            <button className={styles.btnConfirm} onClick={() => confirmPayment(o.orderId)}>
                              ✅ Konfirmasi Bayar
                            </button>
                            <button className={styles.btnReject} onClick={() => rejectPayment(o.orderId, 'Pembayaran tidak valid')}>
                              ❌ Tolak
                            </button>
                          </>
                        )}
                        {o.status === 'completed' && (
                          <span className={styles.autoReleasedBadge}>✅ Dana Otomatis Cair</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifs' && (
          <div>
            <h3 className={styles.sectionTitle}>🔔 Notifikasi Admin</h3>
            {adminNotifs.length === 0 ? (
              <div className={styles.emptyState}><span>🔔</span><p>Belum ada notifikasi</p></div>
            ) : (
              <div className={styles.notifList}>
                {adminNotifs.map(n => (
                  <div
                    key={n.notifId}
                    className={`${styles.notifItem} ${!n.isRead ? styles.notifUnread : ''}`}
                    onClick={() => { markNotifRead(n.notifId); setActiveTab('orders') }}
                  >
                    <p className={styles.notifMsg}>{n.message}</p>
                    <span className={styles.notifTime}>
                      {new Date(n.createdAt).toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <div className={styles.tableHeader}>
              <h3 className={styles.sectionTitle}>👥 Semua Pengguna ({users.length})</h3>
            </div>
            {users.length === 0 ? (
              <div className={styles.emptyState}>
                <span>😴</span>
                <p>Belum ada pengguna yang mendaftar</p>
                <small>Pengguna akan muncul setelah ada yang register</small>
              </div>
            ) : (
              <div className={styles.table}>
                <div className={styles.tableHead}>
                  <span>Pengguna</span>
                  <span>Email</span>
                  <span>Role</span>
                  <span>Universitas</span>
                  <span>Bergabung</span>
                  <span>Status</span>
                </div>
                {users.map((u) => (
                  <div key={u.id} className={styles.tableRow}>
                    <div className={styles.tableUser}>
                      <img src={u.avatar} alt={u.name} className={styles.tableAvatar} />
                      <span>{u.name}</span>
                    </div>
                    <span className={styles.tableEmail}>{u.email}</span>
                    <span className={`${styles.rolePill} ${u.role === 'seller' ? styles.roleSeller : styles.roleBuyer}`}>
                      {u.role === 'seller' ? '📦 Penjual' : '🛍️ Pembeli'}
                    </span>
                    <span className={styles.tableUni}>{u.university || '-'}</span>
                    <span className={styles.tableDate}>{u.joinDate}</span>
                    <span className={`${styles.statusPill} ${u.verified ? styles.statusVerified : styles.statusPending}`}>
                      {u.verified ? '✓ Verified' : '⏳ Pending'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div>
            <h3 className={styles.sectionTitle}>📦 Semua Produk ({allProducts.length})</h3>
            {userProducts.length > 0 && (
              <div className={styles.newProductsBanner}>
                ✨ <strong>{userProducts.length} produk baru</strong> diupload oleh penjual
              </div>
            )}
            <div className={styles.productGrid}>
              {allProducts.map((p) => (
                <div key={p.id} className={`${styles.productCard} ${p.id.startsWith('up_') ? styles.productCardNew : ''}`}>
                  <img
                    src={p.images[0]}
                    alt={p.title}
                    className={styles.productImg}
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/200x150?text=No+Image' }}
                  />
                  <div className={styles.productInfo}>
                    <h4>{p.title}</h4>
                    <p className={styles.productPrice}>Rp {p.price.toLocaleString('id-ID')}</p>
                    <div className={styles.productMeta}>
                      <span className={styles.productCat}>{p.category}</span>
                      <span className={styles.productViews}>👁 {p.views || 0}</span>
                    </div>
                    {p.isHot && <span className={styles.hotBadge}>🔥 Hot</span>}
                    {p.id.startsWith('up_') && <span className={styles.newBadge}>✨ Baru</span>}
                    {p.id.startsWith('up_') && (
                      <button
                        className={styles.deleteProductBtn}
                        onClick={() => deleteProduct(p.id)}
                        title="Hapus produk"
                      >
                        🗑️ Hapus
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className={styles.reportsGrid}>
            <div className={styles.reportCard}>
              <h3>📊 Ringkasan Platform</h3>
              <div className={styles.reportItem}>
                <span>Total Pengguna Terdaftar</span>
                <strong>{users.length}</strong>
              </div>
              <div className={styles.reportItem}>
                <span>Pembeli Aktif</span>
                <strong>{buyers.length}</strong>
              </div>
              <div className={styles.reportItem}>
                <span>Penjual Aktif</span>
                <strong>{sellers.length}</strong>
              </div>
              <div className={styles.reportItem}>
                <span>Total Listing Produk</span>
                <strong>{allProducts.length}</strong>
              </div>
              <div className={styles.reportItem}>
                <span>Produk dari Penjual</span>
                <strong>{userProducts.length}</strong>
              </div>
              <div className={styles.reportItem}>
                <span>Produk Hot Items</span>
                <strong>{allProducts.filter(p => p.isHot).length}</strong>
              </div>
            </div>

            <div className={styles.reportCard}>
              <h3>📦 Distribusi Kategori</h3>
              {['furniture', 'electronic', 'academic'].map((cat) => {
                const count = allProducts.filter(p => p.category === cat).length
                const pct = allProducts.length > 0 ? Math.round((count / allProducts.length) * 100) : 0
                return (
                  <div key={cat} className={styles.reportItem}>
                    <span style={{ textTransform: 'capitalize' }}>{cat}</span>
                    <div className={styles.barWrapper}>
                      <div className={styles.bar} style={{ width: `${pct}%` }}></div>
                      <strong>{count} ({pct}%)</strong>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* KTP / Selfie Photo Modal */}
      {ktpModal && (
        <div className={styles.modalOverlay} onClick={() => setKtpModal(null)}>
          <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{ktpModal.type === 'ktp' ? '🪪 Foto KTP / Identitas' : '🤳 Foto Selfie'}</h3>
              <button className={styles.modalClose} onClick={() => setKtpModal(null)}>✕</button>
            </div>
            <div className={styles.modalUserMeta}>
              <img src={ktpModal.user.avatar} alt="" className={styles.modalAvatar} />
              <div>
                <strong>{ktpModal.user.name}</strong>
                <span>{ktpModal.user.email}</span>
              </div>
            </div>
            <img
              src={ktpModal.type === 'ktp' ? ktpModal.user.ktpPhoto : ktpModal.user.selfiePhoto}
              alt={ktpModal.type}
              className={styles.modalPhoto}
            />
            <div className={styles.modalActions}>
              <button className={styles.btnApproveVerif} onClick={() => { handleApproveKtp(ktpModal.user.id); setKtpModal(null) }}>
                ✅ Setujui Identitas
              </button>
              <button className={styles.btnRejectVerif} onClick={() => {
                const note = prompt('Alasan penolakan?', 'Foto identitas tidak jelas')
                handleRejectKtp(ktpModal.user.id, note)
                setKtpModal(null)
              }}>
                ❌ Tolak
              </button>
              <button className={styles.btnOutline} onClick={() => setKtpModal(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
