import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProducts } from '../../context/ProductContext'
import { useOrders } from '../../context/OrderContext'
import { useCarrier, CARRY_STATUS } from '../../context/CarrierContext'
import styles from './AdminDashboard.module.css'

const getStoredUsers = () => {
  try { return JSON.parse(localStorage.getItem('cr_users') || '[]') }
  catch { return [] }
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
  const { getAllCarryOrders, CARRIER_FEE_PERCENT, getCarryEscrowBalance, getCarryEscrowHistory } = useCarrier()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [users] = useState(getStoredUsers())

  const handleLogout = () => {
    logout()
    navigate('/auth')   // ← redirect ke /auth setelah logout admin
  }

  const buyers   = users.filter((u) => u.role === 'buyer')
  const sellers  = users.filter((u) => u.role === 'seller')
  const carriers = users.filter((u) => u.role === 'carrier')
  const allOrders = getAllOrders()
  const allCarryOrders = getAllCarryOrders()
  const pendingOrders   = allOrders.filter(o => o.status === 'pending_payment')
  const deliveredOrders = allOrders.filter(o => o.status === 'delivered')
  const completedOrders = allOrders.filter(o => o.status === 'completed')
  const overdueOrders   = allOrders.filter(o => isOverdue(o))
  const activeCarryOrders = allCarryOrders.filter(o => !['completed','cancelled'].includes(o.status))
  const adminUnread = getUnreadCount('admin1')
  const adminNotifs = getUserNotifs('admin1').slice(0, 10)

  // Dana
  const escrowBalance    = getEscrowBalance()
  const carryEscrow      = getCarryEscrowBalance()
  const totalEscrow      = escrowBalance + carryEscrow
  const adminWalletBal   = getAdminWalletBalance()
  const adminWalletHist  = getAdminWalletHistory().slice(0, 10)
  const carryEscrowHist  = getCarryEscrowHistory()
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
    { id: 'dana',     label: `💰 Dana${escrowBalance > 0 ? ` (${(escrowBalance/1000).toFixed(0)}K)` : ''}` },
    { id: 'orders',   label: `📋 Pesanan${pendingOrders.length > 0 ? ` (${pendingOrders.length})` : ''}` },
    { id: 'carry',    label: `🚚 Jasa Angkut${activeCarryOrders.length > 0 ? ` (${activeCarryOrders.length})` : ''}` },
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
          <h1 className={styles.headerTitle}>CampusRelove Admin</h1>
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
              <StatCard icon="👥" label="Total Pengguna"   value={users.length}       color="#7C3AED" />
              <StatCard icon="🛍️" label="Pembeli"          value={buyers.length}      color="#2563EB" />
              <StatCard icon="📦" label="Penjual"          value={sellers.length}     color="#10B981" />
              <StatCard icon="🚚" label="Carrier"          value={carriers.length}    color="#F59E0B" />
              <StatCard icon="📋" label="Total Pesanan"    value={allOrders.length}   color="#EF4444" />
              <StatCard icon="⏳" label="Menunggu Validasi" value={pendingOrders.length} color="#EC4899" />
            </div>

            {/* Dana summary cards */}
            <div className={styles.danaCards}>
              <div className={styles.danaCard} style={{ '--c': '#2563EB' }}>
                <div className={styles.danaCardIcon}>🔒</div>
                <div className={styles.danaCardInfo}>
                  <span className={styles.danaCardLabel}>Total Escrow (Ditahan)</span>
                  <strong className={styles.danaCardValue}>Rp {totalEscrow.toLocaleString('id-ID')}</strong>
                  <span className={styles.danaCardSub}>
                    Produk: Rp {escrowBalance.toLocaleString('id-ID')} · Carry: Rp {carryEscrow.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
              <div className={styles.danaCard} style={{ '--c': '#10B981' }}>
                <div className={styles.danaCardIcon}>💰</div>
                <div className={styles.danaCardInfo}>
                  <span className={styles.danaCardLabel}>Komisi Platform</span>
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

        {/* Dana Tab */}
        {activeTab === 'dana' && (
          <div>
            {/* Escrow + Wallet summary */}
            <div className={styles.danaCards} style={{ marginBottom: 32 }}>
              <div className={styles.danaCard} style={{ '--c': '#2563EB' }}>
                <div className={styles.danaCardIcon}>🔒</div>
                <div className={styles.danaCardInfo}>
                  <span className={styles.danaCardLabel}>Escrow Produk (Ditahan)</span>
                  <strong className={styles.danaCardValue}>Rp {escrowBalance.toLocaleString('id-ID')}</strong>
                  <span className={styles.danaCardSub}>Dari {allOrders.filter(o => ['paid','processing','shipped'].includes(o.status)).length} pesanan produk aktif</span>
                </div>
              </div>
              <div className={styles.danaCard} style={{ '--c': '#10B981' }}>
                <div className={styles.danaCardIcon}>🚚</div>
                <div className={styles.danaCardInfo}>
                  <span className={styles.danaCardLabel}>Escrow Carry (Ditahan)</span>
                  <strong className={styles.danaCardValue}>Rp {carryEscrow.toLocaleString('id-ID')}</strong>
                  <span className={styles.danaCardSub}>Dari {allCarryOrders.filter(o => !['completed','cancelled'].includes(o.status)).length} pesanan jasa angkut aktif</span>
                </div>
              </div>
              <div className={styles.danaCard} style={{ '--c': '#F59E0B' }}>
                <div className={styles.danaCardIcon}>💰</div>
                <div className={styles.danaCardInfo}>
                  <span className={styles.danaCardLabel}>Saldo Komisi Admin</span>
                  <strong className={styles.danaCardValue}>Rp {adminWalletBal.toLocaleString('id-ID')}</strong>
                  <span className={styles.danaCardSub}>Produk {PLATFORM_FEE_PERCENT}% + Carry {CARRIER_FEE_PERCENT}%</span>
                </div>
              </div>
            </div>

            {/* Alur dana explanation */}
            <div className={styles.danaFlowCard}>
              <h3>📊 Alur Dana — Prinsip Escrow CampusRelove</h3>

              {/* Produk flow */}
              <h4 style={{ fontSize:'0.88rem', color:'#7C3AED', marginBottom:12 }}>🛍️ Pesanan Produk</h4>
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
                    <strong>4. Dana Cair</strong>
                    <span>Penjual ({100-PLATFORM_FEE_PERCENT}%) + Admin ({PLATFORM_FEE_PERCENT}%)</span>
                  </div>
                </div>
              </div>

              {/* Carry flow */}
              <h4 style={{ fontSize:'0.88rem', color:'#10B981', margin:'20px 0 12px' }}>🚚 Jasa Angkut (Relove-Carry)</h4>
              <div className={styles.danaFlow}>
                <div className={styles.danaFlowStep}>
                  <div className={styles.danaFlowIcon} style={{ background: '#FEF3C7', color: '#D97706' }}>💳</div>
                  <div className={styles.danaFlowText}>
                    <strong>1. Pembeli Bayar Ongkir</strong>
                    <span>Ongkir masuk Escrow Admin. Carrier saldo = Rp 0</span>
                  </div>
                </div>
                <div className={styles.danaFlowArrow}>→</div>
                <div className={styles.danaFlowStep}>
                  <div className={styles.danaFlowIcon} style={{ background: '#DBEAFE', color: '#2563EB' }}>🚚</div>
                  <div className={styles.danaFlowText}>
                    <strong>2. Carrier Bekerja</strong>
                    <span>Jemput → Muat → Antar → Tiba. Saldo masih Rp 0</span>
                  </div>
                </div>
                <div className={styles.danaFlowArrow}>→</div>
                <div className={styles.danaFlowStep}>
                  <div className={styles.danaFlowIcon} style={{ background: '#D1FAE5', color: '#059669' }}>📸</div>
                  <div className={styles.danaFlowText}>
                    <strong>3. Upload Foto Bukti</strong>
                    <span>Carrier upload foto → Pembeli bisa konfirmasi</span>
                  </div>
                </div>
                <div className={styles.danaFlowArrow}>→</div>
                <div className={styles.danaFlowStep}>
                  <div className={styles.danaFlowIcon} style={{ background: '#EDE9FE', color: '#7C3AED' }}>💸</div>
                  <div className={styles.danaFlowText}>
                    <strong>4. Pembeli Konfirmasi → Cair</strong>
                    <span>Carrier ({100-CARRIER_FEE_PERCENT}%) + Admin ({CARRIER_FEE_PERCENT}%)</span>
                  </div>
                </div>
              </div>

              {/* Example table */}
              <div className={styles.danaExample}>
                <h4>Contoh: Ongkir Rp 50.000</h4>
                <div className={styles.danaExampleTable}>
                  <div className={`${styles.danaExRow} ${styles.danaExHeader}`}>
                    <span>Kondisi</span>
                    <span>Escrow Admin</span>
                    <span>Saldo Carrier</span>
                    <span>Keterangan</span>
                  </div>
                  <div className={styles.danaExRow}>
                    <span>Baru Pesan</span>
                    <span className={styles.danaExEscrow}>Rp 50.000 (Ditahan)</span>
                    <span>Rp 0</span>
                    <span>Carrier belum terima apa-apa</span>
                  </div>
                  <div className={styles.danaExRow}>
                    <span>Carrier Bekerja</span>
                    <span className={styles.danaExEscrow}>Rp 50.000 (Masih Ditahan)</span>
                    <span>Rp 0</span>
                    <span>Saldo carrier tetap 0 selama proses</span>
                  </div>
                  <div className={styles.danaExRow}>
                    <span>Pembeli Konfirmasi</span>
                    <span className={styles.danaExProfit}>Rp {Math.round(50000 * CARRIER_FEE_PERCENT / 100).toLocaleString('id-ID')} (komisi)</span>
                    <span className={styles.danaExSeller}>Rp {(50000 - Math.round(50000 * CARRIER_FEE_PERCENT / 100)).toLocaleString('id-ID')}</span>
                    <span>Escrow cair otomatis ke carrier & admin</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Carry Escrow History */}
            <h3 className={styles.sectionTitle} style={{ marginTop: 32 }}>🚚 Riwayat Escrow Jasa Angkut</h3>
            {carryEscrowHist.length === 0 ? (
              <div className={styles.emptyState}><span>🚚</span><p>Belum ada transaksi jasa angkut</p></div>
            ) : (
              <div className={styles.walletHistory}>
                {carryEscrowHist.map(h => (
                  <div key={h.id} className={styles.walletRow}>
                    <div className={styles.walletIcon}>
                      {h.type === 'hold' ? '🔒' : h.type === 'release' ? '💸' : '↩️'}
                    </div>
                    <div className={styles.walletInfo}>
                      <strong>{h.itemDescription}</strong>
                      <span>
                        {h.type === 'hold'    && `Ditahan dari ${h.buyerName}`}
                        {h.type === 'release' && `Dicairkan ke ${h.carrierName}`}
                        {h.type === 'refund'  && `Dikembalikan ke ${h.buyerName}`}
                      </span>
                    </div>
                    <div className={`${styles.walletAmount} ${h.type === 'hold' ? '' : h.type === 'release' ? styles.walletRelease : styles.walletRefund}`}>
                      {h.type === 'hold' ? '+' : '−'}Rp {h.amount.toLocaleString('id-ID')}
                    </div>
                    <div className={styles.walletDate}>
                      {new Date(h.createdAt).toLocaleDateString('id-ID', { day:'numeric', month:'short' })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Product Komisi History */}
            <h3 className={styles.sectionTitle} style={{ marginTop: 32 }}>📜 Riwayat Komisi Platform</h3>
            {adminWalletHist.length === 0 ? (
              <div className={styles.emptyState}><span>💰</span><p>Belum ada komisi terkumpul</p></div>
            ) : (
              <div className={styles.walletHistory}>
                {adminWalletHist.map(h => (
                  <div key={h.id} className={styles.walletRow}>
                    <div className={styles.walletIcon}>{h.type === 'carry_fee' ? '🚚' : '💰'}</div>
                    <div className={styles.walletInfo}>
                      <strong>{h.productTitle}</strong>
                      <span>{h.type === 'carry_fee' ? 'Komisi Jasa Angkut' : 'Komisi Produk'} · #{h.orderId.slice(-8).toUpperCase()}</span>
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

        {/* Carry Orders Tab */}
        {activeTab === 'carry' && (
          <div>
            <h3 className={styles.sectionTitle}>🚚 Semua Pesanan Jasa Angkut ({allCarryOrders.length})</h3>

            {/* Carrier list */}
            <div className={styles.carrierAdminList}>
              <h4 style={{ fontSize:'0.9rem', fontWeight:700, color:'#1a1a2e', marginBottom:12 }}>
                👤 Carrier Terdaftar ({carriers.length})
              </h4>
              {carriers.length === 0 ? (
                <div className={styles.emptyState}><span>🚚</span><p>Belum ada carrier yang mendaftar</p></div>
              ) : (
                <div className={styles.carrierAdminGrid}>
                  {carriers.map(c => {
                    const busy = allCarryOrders.some(o => o.carrierId === c.id &&
                      ['claimed','heading_to_seller','loading','in_transit','arrived'].includes(o.status))
                    return (
                      <div key={c.id} className={styles.carrierAdminCard}>
                        <img src={c.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.name}`}
                          alt={c.name} className={styles.carrierAdminAvatar} />
                        <div className={styles.carrierAdminInfo}>
                          <strong>{c.name}</strong>
                          <span>{c.vehicleType || 'Motor'} · {c.serviceArea || '-'}</span>
                          <span>⭐ {c.carrierRating || '–'} · {c.totalTrips || 0} trip</span>
                        </div>
                        <div className={styles.carrierAdminRight}>
                          <span className={`${styles.carrierAdminStatus} ${busy ? styles.carrierBusy : styles.carrierFree}`}>
                            {busy ? '🔴 Sibuk' : '🟢 Tersedia'}
                          </span>
                          <span className={styles.carrierAdminBalance}>
                            Saldo: Rp {(c.balance || 0).toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Carry orders list */}
            <h4 style={{ fontSize:'0.9rem', fontWeight:700, color:'#1a1a2e', margin:'24px 0 12px' }}>
              📋 Riwayat Pesanan Jasa Angkut
            </h4>
            {allCarryOrders.length === 0 ? (
              <div className={styles.emptyState}><span>📭</span><p>Belum ada pesanan jasa angkut</p></div>
            ) : (
              <div className={styles.orderTable}>
                {allCarryOrders.map(o => {
                  const st = CARRY_STATUS[o.status] || CARRY_STATUS.available
                  const netFee = Math.round((o.estimatedFee || 0) * (1 - (o.adminFeePercent || 10) / 100))
                  return (
                    <div key={o.carryOrderId} className={styles.orderRow}>
                      <div className={styles.orderMeta}>
                        <span className={styles.orderId}>#{o.carryOrderId.slice(-8).toUpperCase()}</span>
                        <span className={styles.orderDate}>{new Date(o.createdAt).toLocaleDateString('id-ID')}</span>
                      </div>
                      <div className={styles.orderProduct}>
                        <strong>{o.itemDescription}</strong>
                        <span>Pembeli: {o.buyerName}</span>
                        <span>{o.pickupPoint} → {o.dropoffPoint}</span>
                        {o.carrierName && <span>Carrier: {o.carrierName}</span>}
                        <span>Fee: Rp {(o.estimatedFee||0).toLocaleString('id-ID')} → Carrier Rp {netFee.toLocaleString('id-ID')}</span>
                      </div>
                      <span className={styles.orderStatus} style={{ color: st.color, background: st.bg }}>
                        {st.label}
                      </span>
                      <div className={styles.orderAdminActions}>
                        {o.status === 'completed' && (
                          <span className={styles.autoReleasedBadge}>✅ Komisi Cair</span>
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
                    <span className={`${styles.rolePill} ${u.role === 'seller' ? styles.roleSeller : u.role === 'carrier' ? styles.roleCarrier : styles.roleBuyer}`}>
                      {u.role === 'seller' ? '📦 Penjual' : u.role === 'carrier' ? '🚚 Carrier' : '🛍️ Pembeli'}
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
    </div>
  )
}
