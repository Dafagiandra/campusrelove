import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProducts } from '../../context/ProductContext'
import { useOrders } from '../../context/OrderContext'
import { userAPI, listingAPI, orderAPI, withdrawalAPI } from '../../services/api'
import styles from './AdminDashboard.module.css'

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
          getEscrowBalance } = useOrders()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [users, setUsers] = useState([])

  // ── Fetch users from API ───────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    try {
      const data = await userAPI.getAll()
      if (data.success) setUsers(data.users)
    } catch { /* ignore if offline */ }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // ── KTP Verification handlers ──────────────────────────────────────────────
  const [ktpModal, setKtpModal] = useState(null)
  const [rejectNote, setRejectNote] = useState('')

  // Map snake_case API response → camelCase for display
  const mapUser = (u) => ({
    ...u,
    verificationStatus: u.verification_status ?? u.verificationStatus ?? 'pending',
    ktpPhoto:      u.ktp_photo    ? String(u.ktp_photo)    : null,
    selfiePhoto:   u.selfie_photo ? String(u.selfie_photo) : null,
    rejectionNote: u.rejection_note ?? u.rejectionNote ?? null,
    joinDate:      u.join_date    ?? u.joinDate    ?? '',
    totalSales:    u.total_sales  ?? u.totalSales  ?? 0,
  })

  const mappedUsers   = users.map(mapUser)
  // Only sellers need KYC — buyers are auto-approved via OTP
  const pendingVerif  = mappedUsers.filter(u => u.role === 'seller' && u.verificationStatus === 'pending')
  const approvedVerif = mappedUsers.filter(u => u.role === 'seller' && u.verificationStatus === 'approved')
  const rejectedVerif = mappedUsers.filter(u => u.role === 'seller' && u.verificationStatus === 'rejected')

  const handleApproveKtp = async (userId) => {
    try {
      await userAPI.approve(userId)
      await fetchUsers()
    } catch (err) { console.error(err) }
  }

  const handleRejectKtp = async (userId, note) => {
    try {
      await userAPI.reject(userId, note || 'Identitas tidak valid')
      await fetchUsers()
      setRejectNote('')
    } catch (err) { console.error(err) }
  }

  const handleLogout = () => {
    logout()
    navigate('/auth')
  }

  // ── Listing fees & payments ────────────────────────────────────────────────
  const [listingFees, setListingFees] = useState([])
  const [listingPayments, setListingPayments] = useState([])
  const [editingFee, setEditingFee] = useState(null)
  const [complaints, setComplaints] = useState([])

  const fetchListingData = useCallback(async () => {
    try {
      const [feesData, paymentsData] = await Promise.all([
        listingAPI.getFees(),
        listingAPI.getAllPayments(),
      ])
      if (feesData.success)     setListingFees(feesData.fees)
      if (paymentsData.success) setListingPayments(paymentsData.payments)
    } catch { /* ignore */ }
    // Fetch complaints separately
    try {
      const cData = await orderAPI.getAllComplaints()
      if (cData.success) setComplaints(cData.complaints)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchListingData() }, [fetchListingData])

  const listingPaymentsPending = listingPayments.filter(p => p.status === 'pending').length

  // ── Date filter for listing income ────────────────────────────────────────
  const [listingDateFilter, setListingDateFilter] = useState('all') // 'today'|'week'|'month'|'all'

  const filterByDate = (payments, filter) => {
    const paid = payments.filter(p => p.status === 'paid')
    if (filter === 'all') return paid
    const now = new Date()
    return paid.filter(p => {
      const d = new Date(p.paid_at || p.created_at)
      if (filter === 'today') {
        return d.toDateString() === now.toDateString()
      }
      if (filter === 'week') {
        const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)
        return d >= weekAgo
      }
      if (filter === 'month') {
        const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1)
        return d >= monthAgo
      }
      return true
    })
  }

  const filteredListingHistory = filterByDate(listingPayments, listingDateFilter)
  const filteredListingIncome  = filteredListingHistory.reduce((s, p) => s + Number(p.amount || 0), 0)

  const handleSaveFee = async (category) => {
    if (!editingFee) return
    try {
      await listingAPI.updateFee(category, { price: editingFee.price, duration_days: editingFee.duration_days })
      setEditingFee(null)
      fetchListingData()
    } catch (err) { alert(err?.message || 'Gagal menyimpan') }
  }

  const handleConfirmListingPayment = async (id) => {
    try {
      await listingAPI.confirmPayment(id)
      fetchListingData()
    } catch (err) { alert(err?.message || 'Gagal konfirmasi') }
  }

  const handleRejectListingPayment = async (id) => {
    const note = prompt('Alasan penolakan:') || 'Bukti tidak valid'
    try {
      await listingAPI.rejectPayment(id, note)
      fetchListingData()
    } catch (err) { alert(err?.message || 'Gagal tolak') }
  }

  const openComplaints = complaints.filter(c => c.status === 'open')

  const handleResolveComplaint = async (id, decision) => {
    const adminNote = decision === 'release'
      ? (prompt('Catatan untuk keputusan (teruskan ke penjual):') || '')
      : (prompt('Catatan untuk refund pembeli:') || '')
    try {
      await orderAPI.resolveComplaint(id, { decision, adminNote })
      fetchListingData()
    } catch (err) { alert(err?.message || 'Gagal menyelesaikan komplain') }
  }

  const buyers   = mappedUsers.filter((u) => u.role === 'buyer')
  const sellers  = mappedUsers.filter((u) => u.role === 'seller')
  const allOrders = getAllOrders()
  const pendingOrders   = allOrders.filter(o => o.status === 'pending_payment')
  const deliveredOrders = allOrders.filter(o => o.status === 'delivered')
  const completedOrders = allOrders.filter(o => o.status === 'completed')
  const overdueOrders   = allOrders.filter(o => isOverdue(o))
  const adminUnread = getUnreadCount('admin1')
  const adminNotifs = getUserNotifs('admin1').slice(0, 10)

  // Dana
  const escrowBalance    = getEscrowBalance()
  // Pendapatan listing = total dari listing_payments yang sudah lunas
  const listingIncome    = listingPayments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0)
  const listingIncomeHistory = listingPayments.filter(p => p.status === 'paid').slice(0, 10)
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

  // ── Withdrawals ────────────────────────────────────────────────────────────
  const [withdrawals, setWithdrawals]       = useState([])
  const [rejectWithdrawId, setRejectWithdrawId] = useState(null)
  const [rejectWithdrawNote, setRejectWithdrawNote] = useState('')
  const [withdrawLoading, setWithdrawLoading] = useState(false)

  const fetchWithdrawals = useCallback(async () => {
    try {
      const data = await withdrawalAPI.getAll()
      if (data.success) setWithdrawals(data.withdrawals)
    } catch { /* ignore offline */ }
  }, [])

  useEffect(() => { fetchWithdrawals() }, [fetchWithdrawals])

  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending')

  const handleCompleteWithdrawal = async (id) => {
    if (!window.confirm('Tandai pengajuan ini sebagai SUDAH DITRANSFER? Pastikan transfer ke rekening penjual sudah dilakukan.')) return
    setWithdrawLoading(true)
    try {
      await withdrawalAPI.complete(id)
      fetchWithdrawals()
    } catch (err) { alert(err?.message || 'Gagal') }
    finally { setWithdrawLoading(false) }
  }

  const handleRejectWithdrawal = async () => {
    if (!rejectWithdrawNote.trim()) { alert('Alasan penolakan wajib diisi'); return }
    setWithdrawLoading(true)
    try {
      await withdrawalAPI.reject(rejectWithdrawId, rejectWithdrawNote)
      setRejectWithdrawId(null)
      setRejectWithdrawNote('')
      fetchWithdrawals()
    } catch (err) { alert(err?.message || 'Gagal') }
    finally { setWithdrawLoading(false) }
  }

  const tabs = [
    { id: 'overview',   label: '📊 Overview' },
    { id: 'verifikasi', label: `🪪 Verifikasi KTP${pendingVerif.length > 0 ? ` (${pendingVerif.length})` : ''}` },
    { id: 'komplain',   label: `⚠️ Komplain${openComplaints.length > 0 ? ` (${openComplaints.length})` : ''}` },
    { id: 'listing',    label: `💳 Biaya Listing${listingPaymentsPending > 0 ? ` (${listingPaymentsPending})` : ''}` },
    { id: 'withdraw',   label: `💸 Penarikan${pendingWithdrawals.length > 0 ? ` (${pendingWithdrawals.length})` : ''}` },
    { id: 'dana',       label: `💰 Dana${escrowBalance > 0 ? ` (${(escrowBalance/1000).toFixed(0)}K)` : ''}` },
    { id: 'orders',     label: `📋 Pesanan${pendingOrders.length > 0 ? ` (${pendingOrders.length})` : ''}` },
    { id: 'notifs',     label: `🔔 Notifikasi${adminUnread > 0 ? ` (${adminUnread})` : ''}` },
    { id: 'users',      label: '👥 Pengguna' },
    { id: 'products',   label: '📦 Produk' },
    { id: 'reports',    label: '📋 Laporan' },
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
              <StatCard icon="👥" label="Total Pengguna"    value={mappedUsers.length}          color="#7C3AED" />
              <StatCard icon="🛍️" label="Pembeli"           value={buyers.length}         color="#2563EB" />
              <StatCard icon="📦" label="Penjual"           value={sellers.length}        color="#10B981" />
              <StatCard icon="🪪" label="Pending Verifikasi" value={pendingVerif.length}  color="#F59E0B" />
              <StatCard icon="⚠️" label="Komplain Aktif"    value={openComplaints.length} color="#EF4444" />
              <StatCard icon="💳" label="Listing Pending"   value={listingPaymentsPending} color="#EC4899" />
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
                <div className={styles.danaCardIcon}>💳</div>
                <div className={styles.danaCardInfo}>
                  <span className={styles.danaCardLabel}>Pendapatan Biaya Listing</span>
                  <strong className={styles.danaCardValue}>Rp {listingIncome.toLocaleString('id-ID')}</strong>
                  <span className={styles.danaCardSub}>{listingPayments.filter(p => p.status === 'paid').length} transaksi listing</span>
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
              {mappedUsers.length === 0 ? (
                <div className={styles.emptyState}><span>😴</span><p>Belum ada pengguna yang mendaftar</p></div>
              ) : (
                <div className={styles.userList}>
                  {mappedUsers.slice(-5).reverse().map((u) => (
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
            {/* Header + refresh */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
                🪪 Verifikasi Identitas Pengguna
              </h2>
              <button
                onClick={fetchUsers}
                style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#7C3AED,#2563EB)', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}
              >
                🔄 Refresh
              </button>
            </div>

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

        {/* Komplain Tab */}
        {activeTab === 'komplain' && (
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>⚠️ Komplain Pembeli</h2>
            <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 24 }}>
              Dana tetap ditahan escrow sampai kamu putuskan. Pilih <strong>Teruskan ke Penjual</strong> jika valid,
              atau <strong>Refund ke Pembeli</strong> jika terbukti bermasalah.
            </p>

            {/* Open complaints */}
            <h3 className={styles.sectionTitle}>⏳ Menunggu Keputusan ({openComplaints.length})</h3>
            {openComplaints.length === 0 ? (
              <div className={styles.emptyState}><span>✅</span><p>Tidak ada komplain aktif</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
                {openComplaints.map(c => (
                  <div key={c.id} style={{ background: 'white', border: '2px solid #fed7aa', borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a1a2e', marginBottom: 3 }}>
                          📦 {c.product_title}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                          Pembeli: <strong>{c.buyer_name}</strong> · Penjual: <strong>{c.seller_name}</strong>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
                          {new Date(c.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#7C3AED' }}>
                          Rp {Number(c.price).toLocaleString('id-ID')}
                        </div>
                        <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 6, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600 }}>
                          🔒 Dana ditahan escrow
                        </span>
                      </div>
                    </div>

                    <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#c2410c', marginBottom: 4 }}>Alasan Komplain:</div>
                      <div style={{ fontSize: '0.88rem', color: '#78350f' }}>{c.reason}</div>
                      {c.description && <div style={{ fontSize: '0.8rem', color: '#92400e', marginTop: 6, fontStyle: 'italic' }}>{c.description}</div>}
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleResolveComplaint(c.id, 'release')}
                        style={{ flex: 1, minWidth: 160, padding: '10px 18px', background: 'linear-gradient(135deg,#10B981,#059669)', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}
                      >
                        ✅ Teruskan ke Penjual
                      </button>
                      <button
                        onClick={() => handleResolveComplaint(c.id, 'refund')}
                        style={{ flex: 1, minWidth: 160, padding: '10px 18px', background: 'linear-gradient(135deg,#EF4444,#DC2626)', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}
                      >
                        🔄 Refund ke Pembeli
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Resolved complaints */}
            {complaints.filter(c => c.status !== 'open').length > 0 && (
              <>
                <h3 className={styles.sectionTitle}>✅ Riwayat Penyelesaian Komplain</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {complaints.filter(c => c.status !== 'open').slice(0, 20).map(c => (
                    <div key={c.id} style={{ background: 'white', borderRadius: 12, padding: '12px 16px', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1a1a2e' }}>{c.product_title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {c.buyer_name} → {c.seller_name} · {new Date(c.resolved_at || c.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        {c.admin_note && <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontStyle: 'italic' }}>{c.admin_note}</div>}
                      </div>
                      <span style={{
                        background: c.status === 'resolved_refund' ? '#fee2e2' : '#d1fae5',
                        color: c.status === 'resolved_refund' ? '#991b1b' : '#065f46',
                        borderRadius: 8, padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700,
                      }}>
                        {c.status === 'resolved_refund' ? '🔄 Direfund' : '✅ Diteruskan'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Listing Tab */}
        {activeTab === 'listing' && (
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a1a2e', marginBottom: 24 }}>
              💳 Biaya Listing per Kategori
            </h2>

            {/* Fee table */}
            <div style={{ background: 'white', borderRadius: 16, padding: 20, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: 32 }}>
              <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 16 }}>
                Atur biaya tayang listing per kategori. Penjual bayar sekali, listing aktif sesuai durasi.
                Klik ✏️ untuk edit.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 0 }}>
                {/* Header */}
                {['Kategori', 'Harga (Rp)', 'Durasi (hari)', ''].map(h => (
                  <div key={h} style={{ padding: '10px 14px', background: 'linear-gradient(135deg,#7C3AED,#2563EB)', color: 'white', fontSize: '0.8rem', fontWeight: 700 }}>
                    {h}
                  </div>
                ))}
                {/* Rows */}
                {listingFees.map(fee => (
                  editingFee?.category === fee.category ? (
                    <>
                      <div key={`cat-${fee.category}`} style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', fontSize: '0.88rem', display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                        {fee.category}
                      </div>
                      <div key={`price-${fee.category}`} style={{ padding: '6px 14px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center' }}>
                        <input
                          type="number" min="0"
                          value={editingFee.price}
                          onChange={e => setEditingFee({...editingFee, price: Number(e.target.value)})}
                          style={{ width: 100, padding: '5px 8px', border: '1.5px solid #7C3AED', borderRadius: 8, fontSize: '0.85rem', fontFamily: 'Poppins,sans-serif', outline: 'none' }}
                        />
                      </div>
                      <div key={`dur-${fee.category}`} style={{ padding: '6px 14px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center' }}>
                        <input
                          type="number" min="1" max="90"
                          value={editingFee.duration_days}
                          onChange={e => setEditingFee({...editingFee, duration_days: Number(e.target.value)})}
                          style={{ width: 70, padding: '5px 8px', border: '1.5px solid #7C3AED', borderRadius: 8, fontSize: '0.85rem', fontFamily: 'Poppins,sans-serif', outline: 'none' }}
                        />
                      </div>
                      <div key={`act-${fee.category}`} style={{ padding: '6px 14px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button onClick={() => handleSaveFee(fee.category)}
                          style={{ background: '#10B981', color: 'white', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}>
                          ✅ Simpan
                        </button>
                        <button onClick={() => setEditingFee(null)}
                          style={{ background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}>
                          Batal
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div key={`cat-${fee.category}`} style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', fontSize: '0.88rem', fontWeight: 600 }}>
                        {fee.category}
                      </div>
                      <div key={`price-${fee.category}`} style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', fontSize: '0.88rem', color: '#7C3AED', fontWeight: 700 }}>
                        Rp {Number(fee.price).toLocaleString('id-ID')}
                      </div>
                      <div key={`dur-${fee.category}`} style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', fontSize: '0.88rem', color: '#6b7280' }}>
                        {fee.duration_days} hari
                      </div>
                      <div key={`act-${fee.category}`} style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6' }}>
                        <button onClick={() => setEditingFee({ category: fee.category, price: Number(fee.price), duration_days: fee.duration_days })}
                          style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 7, padding: '4px 10px', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'Poppins,sans-serif', color: '#374151' }}>
                          ✏️ Edit
                        </button>
                      </div>
                    </>
                  )
                ))}
              </div>
            </div>

            {/* Pending payments */}
            <h3 className={styles.sectionTitle}>
              ⏳ Pembayaran Listing Menunggu Konfirmasi ({listingPayments.filter(p => p.status === 'pending').length})
            </h3>
            {listingPayments.filter(p => p.status === 'pending').length === 0 ? (
              <div className={styles.emptyState}><span>✅</span><p>Tidak ada pembayaran listing yang menunggu</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
                {listingPayments.filter(p => p.status === 'pending').map(pay => (
                  <div key={pay.id} style={{ background: 'white', borderRadius: 14, padding: '16px 20px', border: '2px solid #fef3c7', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1a1a2e', marginBottom: 3 }}>
                        {pay.seller_name || pay.seller_id?.slice(0,8)}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{pay.seller_email}</div>
                      <div style={{ fontSize: '0.82rem', color: '#374151', marginTop: 4 }}>
                        Kategori: <strong>{pay.category}</strong>
                        {pay.product_title && <span> · {pay.product_title}</span>}
                      </div>
                      {pay.notes && <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 2, fontStyle: 'italic' }}>{pay.notes}</div>}
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
                        {new Date(pay.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 100 }}>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#7C3AED' }}>
                        Rp {Number(pay.amount).toLocaleString('id-ID')}
                      </div>
                      <span style={{ fontSize: '0.72rem', background: '#fef3c7', color: '#92400e', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
                        ⏳ Pending
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleConfirmListingPayment(pay.id)}
                        style={{ background: '#10B981', color: 'white', border: 'none', borderRadius: 9, padding: '8px 16px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}>
                        ✅ Konfirmasi
                      </button>
                      <button onClick={() => handleRejectListingPayment(pay.id)}
                        style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}>
                        ❌ Tolak
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Confirmed payments history */}
            <h3 className={styles.sectionTitle}>✅ Riwayat Pembayaran Listing</h3>
            {listingPayments.filter(p => p.status === 'paid').length === 0 ? (
              <div className={styles.emptyState}><span>💳</span><p>Belum ada pembayaran listing yang dikonfirmasi</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {listingPayments.filter(p => p.status === 'paid').slice(0, 20).map(pay => (
                  <div key={pay.id} style={{ background: 'white', borderRadius: 12, padding: '12px 16px', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1a1a2e' }}>{pay.seller_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {pay.category} · {new Date(pay.paid_at || pay.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <strong style={{ color: '#10B981' }}>+Rp {Number(pay.amount).toLocaleString('id-ID')}</strong>
                      <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: 6, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600 }}>✅ Lunas</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Dana Tab */}
        {activeTab === 'dana' && (
          <div>
            {/* Cards: Escrow + Listing Income */}
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
                <div className={styles.danaCardIcon}>💳</div>
                <div className={styles.danaCardInfo}>
                  <span className={styles.danaCardLabel}>Pendapatan Biaya Listing</span>
                  <strong className={styles.danaCardValue}>Rp {listingIncome.toLocaleString('id-ID')}</strong>
                  <span className={styles.danaCardSub}>{listingPayments.filter(p => p.status === 'paid').length} transaksi listing dikonfirmasi</span>
                </div>
              </div>
            </div>

            {/* Alur escrow — tanpa komisi */}
            <div className={styles.danaFlowCard}>
              <h3>📊 Alur Dana Preloved (Escrow — 0% Komisi)</h3>
              <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 20 }}>
                Platform <strong>tidak memotong komisi</strong> dari hasil penjualan. Penjual menerima 100% harga barang.
                Sumber pendapatan platform hanya dari <strong>biaya listing</strong>.
              </p>
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
                  <div className={styles.danaFlowIcon} style={{ background: '#D1FAE5', color: '#059669' }}>💸</div>
                  <div className={styles.danaFlowText}>
                    <strong>4. Dana Cair 100%</strong>
                    <span>Penjual terima utuh</span>
                  </div>
                </div>
              </div>

              {/* Contoh */}
              <div className={styles.danaExample}>
                <h4>Contoh Transaksi Rp 100.000</h4>
                <div className={styles.danaExampleTable}>
                  <div className={`${styles.danaExRow} ${styles.danaExHeader}`}>
                    <span>Kondisi</span><span>Escrow Admin</span><span>Diterima Penjual</span><span>Keterangan</span>
                  </div>
                  <div className={styles.danaExRow}>
                    <span>Baru Bayar</span>
                    <span className={styles.danaExEscrow}>Rp 100.000 (ditahan)</span>
                    <span>Rp 0</span>
                    <span>Dana aman di escrow admin</span>
                  </div>
                  <div className={styles.danaExRow}>
                    <span>Pesanan Selesai</span>
                    <span>Rp 0 (cair)</span>
                    <span className={styles.danaExSeller}>Rp 100.000 (100%)</span>
                    <span>Tidak ada potongan komisi</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Riwayat Pendapatan Listing dengan filter tanggal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
              <h3 className={styles.sectionTitle} style={{ margin: 0 }}>📜 Riwayat Pendapatan Biaya Listing</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { id: 'today', label: 'Hari Ini' },
                  { id: 'week',  label: '7 Hari' },
                  { id: 'month', label: '30 Hari' },
                  { id: 'all',   label: 'Semua' },
                ].map(f => (
                  <button key={f.id} onClick={() => setListingDateFilter(f.id)}
                    style={{ padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'Poppins,sans-serif', fontSize: '0.78rem', fontWeight: 600,
                      background: listingDateFilter === f.id ? 'linear-gradient(135deg,#7C3AED,#2563EB)' : '#f3f4f6',
                      color: listingDateFilter === f.id ? 'white' : '#374151' }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#065f46', fontWeight: 600 }}>
                Total ({listingDateFilter === 'today' ? 'Hari Ini' : listingDateFilter === 'week' ? '7 Hari Terakhir' : listingDateFilter === 'month' ? '30 Hari Terakhir' : 'Semua Waktu'}):
              </span>
              <strong style={{ color: '#10B981', fontSize: '1rem' }}>Rp {filteredListingIncome.toLocaleString('id-ID')}</strong>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 16 }}>
              Satu-satunya sumber pendapatan platform — biaya yang dibayar penjual saat upload/perpanjang listing barang.
            </p>
            {filteredListingHistory.length === 0 ? (
              <div className={styles.emptyState}><span>💳</span><p>Tidak ada pendapatan listing di periode ini</p></div>
            ) : (
              <div className={styles.walletHistory}>
                {filteredListingHistory.slice(0, 50).map(h => (
                  <div key={h.id} className={styles.walletRow}>
                    <div className={styles.walletIcon}>💳</div>
                    <div className={styles.walletInfo}>
                      <strong>{h.seller_name || 'Penjual'}</strong>
                      <span>Listing {h.category} · {new Date(h.paid_at || h.created_at).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}</span>
                    </div>
                    <div className={styles.walletAmount}>+Rp {Number(h.amount).toLocaleString('id-ID')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Withdrawal Tab */}
        {activeTab === 'withdraw' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>💸 Pengajuan Penarikan Saldo</h2>
              <button onClick={fetchWithdrawals}
                style={{ padding: '7px 14px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}>
                🔄 Refresh
              </button>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '14px 18px' }}>
                <div style={{ fontSize: '0.75rem', color: '#D97706', fontWeight: 600 }}>⏳ Menunggu Proses</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#92400e', marginTop: 4 }}>{pendingWithdrawals.length}</div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 2 }}>
                  Total: Rp {pendingWithdrawals.reduce((s, w) => s + Number(w.amount), 0).toLocaleString('id-ID')}
                </div>
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '14px 18px' }}>
                <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>✅ Selesai Bulan Ini</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#065f46', marginTop: 4 }}>
                  {withdrawals.filter(w => w.status === 'completed' && new Date(w.processed_at) > new Date(new Date().setDate(1))).length}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 2 }}>
                  Total: Rp {withdrawals.filter(w => w.status === 'completed' && new Date(w.processed_at) > new Date(new Date().setDate(1))).reduce((s, w) => s + Number(w.amount), 0).toLocaleString('id-ID')}
                </div>
              </div>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, padding: '14px 18px' }}>
                <div style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 600 }}>⚠️ Perlu Perhatian</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#991b1b', marginTop: 4 }}>
                  {pendingWithdrawals.filter(w => w.name_mismatch).length}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 2 }}>Nama rekening tidak sesuai</div>
              </div>
            </div>

            {/* Reject modal */}
            {rejectWithdrawId && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: 'white', borderRadius: 16, padding: 24, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                  <h3 style={{ margin: '0 0 16px', color: '#DC2626' }}>❌ Tolak Pengajuan</h3>
                  <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 12px' }}>
                    Saldo akan otomatis dikembalikan ke penjual setelah ditolak.
                  </p>
                  <textarea
                    value={rejectWithdrawNote}
                    onChange={e => setRejectWithdrawNote(e.target.value)}
                    placeholder="Alasan penolakan (wajib)..."
                    rows={3}
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #fecaca', borderRadius: 10, fontSize: '0.85rem', fontFamily: 'Poppins,sans-serif', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <button onClick={handleRejectWithdrawal} disabled={!rejectWithdrawNote.trim() || withdrawLoading}
                      style={{ flex: 1, padding: '10px', background: '#DC2626', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins,sans-serif', opacity: (!rejectWithdrawNote.trim() || withdrawLoading) ? 0.6 : 1 }}>
                      {withdrawLoading ? '⏳...' : '✅ Konfirmasi Tolak'}
                    </button>
                    <button onClick={() => { setRejectWithdrawId(null); setRejectWithdrawNote('') }}
                      style={{ padding: '10px 16px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}>
                      Batal
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Pending withdrawals */}
            {pendingWithdrawals.length > 0 && (
              <>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#92400e', marginBottom: 10 }}>⏳ Perlu Ditransfer ({pendingWithdrawals.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                  {pendingWithdrawals.map(w => (
                    <div key={w.id} style={{ background: 'white', border: `2px solid ${w.name_mismatch ? '#fde68a' : '#e5e7eb'}`, borderRadius: 16, padding: '16px 20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#111827' }}>
                              Rp {Number(w.amount).toLocaleString('id-ID')}
                            </span>
                            {w.name_mismatch ? (
                              <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 8 }}>
                                ⚠️ NAMA BERBEDA
                              </span>
                            ) : null}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#374151', marginBottom: 4 }}>
                            <strong>Penjual:</strong> {w.seller_name}
                            {w.seller_email && <span style={{ color: '#6b7280', marginLeft: 6 }}>({w.seller_email})</span>}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#374151', marginBottom: 4 }}>
                            <strong>Rekening:</strong> {w.bank_name} · {w.account_number} a.n. <strong>{w.account_name}</strong>
                          </div>
                          {w.name_mismatch ? (
                            <div style={{ fontSize: '0.75rem', color: '#92400e', background: '#fffbeb', padding: '6px 10px', borderRadius: 8, marginBottom: 4 }}>
                              ⚠️ Nama rekening "<strong>{w.account_name}</strong>" berbeda dari nama akun penjual "<strong>{w.seller_name}</strong>". Verifikasi manual sebelum transfer.
                            </div>
                          ) : null}
                          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                            Diajukan: {new Date(w.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <button onClick={() => handleCompleteWithdrawal(w.id)} disabled={withdrawLoading}
                            style={{ padding: '8px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins,sans-serif', whiteSpace: 'nowrap' }}>
                            ✅ Sudah Transfer
                          </button>
                          <button onClick={() => { setRejectWithdrawId(w.id); setRejectWithdrawNote('') }}
                            style={{ padding: '8px 16px', background: 'white', color: '#DC2626', border: '2px solid #fecaca', borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins,sans-serif', whiteSpace: 'nowrap' }}>
                            ❌ Tolak
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* All withdrawals history */}
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#374151', marginBottom: 10 }}>📜 Semua Riwayat Penarikan</h3>
            {withdrawals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af', background: '#f9fafb', borderRadius: 12 }}>
                Belum ada pengajuan penarikan
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: '#374151' }}>Penjual</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: '#374151' }}>Nominal</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: '#374151' }}>Rekening Tujuan</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: '#374151' }}>Tanggal</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: '#374151' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map(w => {
                      const cfg = {
                        pending:   { label: '⏳ Diproses', color: '#D97706', bg: '#FEF3C7' },
                        completed: { label: '✅ Selesai',  color: '#059669', bg: '#D1FAE5' },
                        rejected:  { label: '❌ Ditolak',  color: '#DC2626', bg: '#FEE2E2' },
                      }[w.status] || {}
                      return (
                        <tr key={w.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '10px 12px', color: '#111827', fontWeight: 600 }}>
                            {w.seller_name}
                            {w.name_mismatch ? <span style={{ marginLeft: 4, color: '#D97706', fontSize: '0.72rem' }}>⚠️</span> : null}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#7C3AED' }}>
                            Rp {Number(w.amount).toLocaleString('id-ID')}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#374151' }}>
                            {w.bank_name} {w.account_number}<br/>
                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>a.n. {w.account_name}</span>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                            {new Date(w.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {w.admin_note && w.status === 'rejected' && (
                              <div style={{ fontSize: '0.72rem', color: '#DC2626', marginTop: 2 }}>Alasan: {w.admin_note}</div>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 8, padding: '3px 9px', fontWeight: 700, fontSize: '0.75rem' }}>
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div>
            {/* Transfer Proof Verification — from localStorage */}
            {(() => {
              const proofs = (() => { try { return JSON.parse(localStorage.getItem('cr_transfer_proofs') || '[]') } catch { return [] } })()
              const pending = proofs.filter(p => !p.verified && !p.rejected)
              if (pending.length === 0) return null
              return (
                <div style={{ background: '#fef3c7', border: '2px solid #fde68a', borderRadius: 16, padding: 20, marginBottom: 24 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#92400e', marginBottom: 16 }}>
                    💳 Bukti Transfer Menunggu Verifikasi ({pending.length})
                  </h3>
                  {pending.map((p, i) => (
                    <div key={i} style={{ background: 'white', borderRadius: 12, padding: '14px 16px', marginBottom: 10, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                      <img src={p.proof} alt="Bukti" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Pesanan #{p.shortId}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{new Date(p.submittedAt).toLocaleString('id-ID')}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => {
                          const all = JSON.parse(localStorage.getItem('cr_transfer_proofs') || '[]')
                          all[all.findIndex(x => x.orderId === p.orderId)].verified = true
                          localStorage.setItem('cr_transfer_proofs', JSON.stringify(all))
                          confirmPayment(p.orderId)
                        }} style={{ padding: '8px 14px', background: '#10B981', color: 'white', border: 'none', borderRadius: 9, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}>
                          ✅ Verifikasi
                        </button>
                        <button onClick={() => {
                          const all = JSON.parse(localStorage.getItem('cr_transfer_proofs') || '[]')
                          all[all.findIndex(x => x.orderId === p.orderId)].rejected = true
                          localStorage.setItem('cr_transfer_proofs', JSON.stringify(all))
                        }} style={{ padding: '8px 14px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 9, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}>
                          ❌ Tolak
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}

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
                            Penjual: Rp {(o.sellerAmount ?? o.price).toLocaleString('id-ID')} (100% — tanpa potongan)
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
              <h3 className={styles.sectionTitle}>👥 Semua Pengguna ({mappedUsers.length})</h3>
            </div>
            {mappedUsers.length === 0 ? (
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
                {mappedUsers.map((u) => (
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
                <strong>{mappedUsers.length}</strong>
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
              {['fashion','electronic','furniture','hobi','otomotif','buku','olahraga','kesehatan','dapur','bayi','lainnya'].map((cat) => {
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
