import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCarrier, CARRY_STATUS } from '../../context/CarrierContext'
import styles from './CarrierDashboard.module.css'

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = CARRY_STATUS[status] || CARRY_STATUS.available
  return (
    <span className={styles.statusBadge} style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  )
}

// ─── Order Pool Card (available orders) ──────────────────────────────────────
function PoolCard({ order, carrierId, carrierName, onClaim }) {
  const [claiming, setClaiming] = useState(false)

  const handleClaim = () => {
    setClaiming(true)
    setTimeout(() => {
      onClaim(order.carryOrderId, carrierId, carrierName)
      setClaiming(false)
    }, 600)
  }

  return (
    <div className={styles.poolCard}>
      <div className={styles.poolCardHeader}>
        <div className={styles.poolCardId}>#{order.carryOrderId.slice(-8).toUpperCase()}</div>
        <StatusBadge status={order.status} />
      </div>

      <div className={styles.poolCardBody}>
        <div className={styles.poolRoute}>
          <div className={styles.poolRoutePoint}>
            <span className={styles.poolRouteDot} style={{ background: '#10B981' }}></span>
            <div>
              <span className={styles.poolRouteLabel}>Jemput dari</span>
              <strong>{order.pickupPoint}</strong>
              <span className={styles.poolRouteName}>{order.sellerName}</span>
            </div>
          </div>
          <div className={styles.poolRouteLine}></div>
          <div className={styles.poolRoutePoint}>
            <span className={styles.poolRouteDot} style={{ background: '#7C3AED' }}></span>
            <div>
              <span className={styles.poolRouteLabel}>Antar ke</span>
              <strong>{order.dropoffPoint}</strong>
              <span className={styles.poolRouteName}>{order.buyerName}</span>
            </div>
          </div>
        </div>

        <div className={styles.poolMeta}>
          <div className={styles.poolMetaItem}>
            <span>📦</span>
            <span>{order.itemDescription}</span>
          </div>
          <div className={styles.poolMetaItem}>
            <span>📅</span>
            <span>{order.scheduledDate} · {order.scheduledTime}</span>
          </div>
          <div className={styles.poolMetaItem}>
            <span>💰</span>
            <span className={styles.poolFee}>Rp {order.estimatedFee.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>

      <button
        className={styles.claimBtn}
        onClick={handleClaim}
        disabled={claiming}
      >
        {claiming ? '⏳ Mengambil...' : '🤝 Ambil Tugas Ini'}
      </button>
    </div>
  )
}

// ─── Active Task Card ─────────────────────────────────────────────────────────
function ActiveTaskCard({ order, onUpdateStatus, onUploadProof }) {
  const [proofFile, setProofFile] = useState(null)
  const [proofPreview, setProofPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const NEXT_STATUS = {
    claimed:           { next: 'heading_to_seller', label: '🛵 Mulai Perjalanan ke Penjual' },
    heading_to_seller: { next: 'loading',           label: '📦 Mulai Muat Barang' },
    loading:           { next: 'in_transit',        label: '🚚 Mulai Antar ke Pembeli' },
    in_transit:        { next: 'arrived',           label: '📍 Tiba di Tujuan' },
  }

  const nextAction = NEXT_STATUS[order.status]

  const handleProofChange = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setProofFile(f)
    const reader = new FileReader()
    reader.onload = ev => setProofPreview(ev.target.result)
    reader.readAsDataURL(f)
  }

  const handleUploadProof = () => {
    if (!proofPreview) return
    setUploading(true)
    setTimeout(() => {
      onUploadProof(order.carryOrderId, proofPreview)
      setUploading(false)
    }, 800)
  }

  const waLink = (number) => `https://wa.me/${number?.replace(/\D/g, '')}`
  const mapsLink = (addr) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`

  return (
    <div className={styles.activeCard}>
      <div className={styles.activeCardHeader}>
        <div>
          <div className={styles.activeCardId}>#{order.carryOrderId.slice(-8).toUpperCase()}</div>
          <div className={styles.activeCardItem}>{order.itemDescription}</div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Route */}
      <div className={styles.activeRoute}>
        <div className={styles.activeRouteRow}>
          <span className={styles.activeRouteDot} style={{ background: '#10B981' }}></span>
          <div className={styles.activeRouteInfo}>
            <span className={styles.activeRouteLabel}>Jemput</span>
            <strong>{order.pickupPoint}</strong>
            <span>{order.sellerName}</span>
          </div>
          <div className={styles.activeRouteActions}>
            {order.sellerWhatsapp && (
              <a href={waLink(order.sellerWhatsapp)} target="_blank" rel="noreferrer" className={styles.waBtn}>
                💬 WA
              </a>
            )}
            <a href={mapsLink(order.pickupPoint)} target="_blank" rel="noreferrer" className={styles.mapsBtn}>
              🗺️ Maps
            </a>
          </div>
        </div>
        <div className={styles.activeRouteLine}></div>
        <div className={styles.activeRouteRow}>
          <span className={styles.activeRouteDot} style={{ background: '#7C3AED' }}></span>
          <div className={styles.activeRouteInfo}>
            <span className={styles.activeRouteLabel}>Antar</span>
            <strong>{order.dropoffPoint}</strong>
            <span>{order.buyerName}</span>
          </div>
          <div className={styles.activeRouteActions}>
            {order.buyerWhatsapp && (
              <a href={waLink(order.buyerWhatsapp)} target="_blank" rel="noreferrer" className={styles.waBtn}>
                💬 WA
              </a>
            )}
            <a href={mapsLink(order.dropoffPoint)} target="_blank" rel="noreferrer" className={styles.mapsBtn}>
              🗺️ Maps
            </a>
          </div>
        </div>
      </div>

      {/* Schedule & fee */}
      <div className={styles.activeMeta}>
        <span>📅 {order.scheduledDate} · {order.scheduledTime}</span>
        <span className={styles.activeFee}>💰 Rp {order.estimatedFee.toLocaleString('id-ID')}</span>
      </div>

      {/* Progress steps */}
      <div className={styles.progressSteps}>
        {['claimed','heading_to_seller','loading','in_transit','arrived','completed'].map((s, i) => {
          const statuses = ['claimed','heading_to_seller','loading','in_transit','arrived','completed']
          const currentIdx = statuses.indexOf(order.status)
          const isDone = i < currentIdx
          const isCurrent = i === currentIdx
          const labels = ['Diklaim','Menuju Penjual','Muat Barang','Diantar','Tiba','Selesai']
          return (
            <div key={s} className={`${styles.progressStep} ${isDone ? styles.progressDone : isCurrent ? styles.progressCurrent : ''}`}>
              <div className={styles.progressDot}>{isDone ? '✓' : i + 1}</div>
              <span>{labels[i]}</span>
            </div>
          )
        })}
      </div>

      {/* Next action button */}
      {nextAction && (
        <button
          className={styles.nextStatusBtn}
          onClick={() => onUpdateStatus(order.carryOrderId, nextAction.next)}
        >
          {nextAction.label}
        </button>
      )}

      {/* Upload proof photo when arrived */}
      {order.status === 'arrived' && !order.proofPhotoUrl && (
        <div className={styles.proofUpload}>
          <h4>📸 Upload Foto Bukti Pengiriman</h4>
          <p>Upload foto barang yang sudah sampai sebagai bukti sah</p>
          <label className={styles.proofDropzone} htmlFor="proof-photo">
            {proofPreview ? (
              <img src={proofPreview} alt="Bukti" className={styles.proofPreview} />
            ) : (
              <div className={styles.proofDropzoneInner}>
                <span>📷</span>
                <span>Klik untuk pilih foto</span>
              </div>
            )}
          </label>
          <input id="proof-photo" type="file" accept="image/*" onChange={handleProofChange} style={{ display: 'none' }} ref={fileRef} />
          <button
            className={styles.uploadProofBtn}
            onClick={handleUploadProof}
            disabled={!proofFile || uploading}
          >
            {uploading ? '⏳ Mengupload...' : '✅ Upload Foto Bukti'}
          </button>
        </div>
      )}

      {/* Proof uploaded */}
      {order.proofPhotoUrl && order.status === 'arrived' && (
        <div className={styles.proofDone}>
          <img src={order.proofPhotoUrl} alt="Bukti" className={styles.proofDoneImg} />
          <p>✅ Foto bukti sudah diupload. Menunggu konfirmasi pembeli.</p>
        </div>
      )}
    </div>
  )
}

// ─── History Card ─────────────────────────────────────────────────────────────
function HistoryCard({ order }) {
  const feePercent = order.adminFeePercent ?? 10
  const netFee = Math.round(order.estimatedFee * (1 - feePercent / 100))

  return (
    <div className={styles.histCard}>
      <div className={styles.histHeader}>
        <div>
          <span className={styles.histId}>#{order.carryOrderId.slice(-8).toUpperCase()}</span>
          <span className={styles.histDate}>
            {order.completedAt
              ? new Date(order.completedAt).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })
              : new Date(order.createdAt).toLocaleDateString('id-ID')}
          </span>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <div className={styles.histBody}>
        <div className={styles.histItem}>{order.itemDescription}</div>
        <div className={styles.histRoute}>{order.pickupPoint} → {order.dropoffPoint}</div>
        {order.status === 'completed' && (
          <div className={styles.histEarning}>
            <span>Komisi diterima:</span>
            <strong>+Rp {netFee.toLocaleString('id-ID')}</strong>
          </div>
        )}
        {order.carrierRating && (
          <div className={styles.histRating}>
            {'★'.repeat(order.carrierRating)}{'☆'.repeat(5 - order.carrierRating)} {order.carrierRating}/5
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function CarrierDashboard() {
  const { user, logout } = useAuth()
  const {
    getAvailableOrders, getCarrierOrders,
    claimOrder, updateCarryStatus, uploadProofPhoto,
    CARRIER_FEE_PERCENT,
  } = useCarrier()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('pool')

  if (!user) {
    return (
      <div className={styles.accessDenied}>
        <div className={styles.accessIcon}>🔐</div>
        <h2>Login dulu yuk!</h2>
        <p>Kamu perlu login sebagai Carrier untuk mengakses dashboard ini.</p>
        <button className={styles.btnPrimary} onClick={() => navigate('/auth', { state: { mode: 'login' } })}>
          Login Sekarang
        </button>
      </div>
    )
  }

  if (user.role !== 'carrier') {
    return (
      <div className={styles.accessDenied}>
        <div className={styles.accessIcon}>🚫</div>
        <h2>Akses Ditolak</h2>
        <p>Halaman ini hanya untuk Carrier. Daftar sebagai Carrier untuk mengakses.</p>
        <button className={styles.btnPrimary} onClick={() => navigate('/auth', { state: { mode: 'register' } })}>
          Daftar sebagai Carrier
        </button>
      </div>
    )
  }

  // Baca data terbaru dari localStorage
  const freshUser = (() => {
    try {
      const users = JSON.parse(localStorage.getItem('cr_users') || '[]')
      return users.find(u => u.id === user.id) || user
    } catch { return user }
  })()

  const availableOrders = getAvailableOrders()
  const myOrders        = getCarrierOrders(user.id)
  const activeOrders    = myOrders.filter(o => ['claimed','heading_to_seller','loading','in_transit','arrived'].includes(o.status))
  const historyOrders   = myOrders.filter(o => ['completed','cancelled'].includes(o.status))
  const balance         = freshUser.balance    || 0
  const totalTrips      = freshUser.totalTrips || 0
  const carrierRating   = freshUser.carrierRating || 0

  const totalEarned = historyOrders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + Math.round(o.estimatedFee * (1 - (o.adminFeePercent ?? 10) / 100)), 0)

  const tabs = [
    { id: 'pool',    label: `🟢 Tugas Tersedia (${availableOrders.length})` },
    { id: 'active',  label: `🚚 Tugas Aktif (${activeOrders.length})` },
    { id: 'history', label: `📜 Riwayat (${historyOrders.length})` },
    { id: 'wallet',  label: `💰 Saldo` },
  ]

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerBadge}>🚚 Carrier Dashboard</div>
          <h1 className={styles.headerTitle}>{user.name}</h1>
          <p className={styles.headerSub}>
            {freshUser.vehicleType} · {freshUser.serviceArea}
          </p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.headerStats}>
            <div className={styles.headerStat}>
              <strong>⭐ {carrierRating || '–'}</strong>
              <span>Rating</span>
            </div>
            <div className={styles.headerStat}>
              <strong>{totalTrips}</strong>
              <span>Perjalanan</span>
            </div>
            <div className={styles.headerStat}>
              <strong className={styles.headerBalance}>Rp {balance.toLocaleString('id-ID')}</strong>
              <span>Saldo</span>
            </div>
          </div>
          <button className={styles.logoutBtn} onClick={() => { logout(); navigate('/auth') }}>
            🚪 Keluar
          </button>
        </div>
      </div>

      <div className={styles.container}>
        {/* Tabs */}
        <div className={styles.tabs}>
          {tabs.map(t => (
            <button
              key={t.id}
              className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Pool Tab */}
        {activeTab === 'pool' && (
          <div>
            {availableOrders.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>📭</div>
                <h3>Belum ada tugas tersedia</h3>
                <p>Tugas angkut baru akan muncul di sini saat pembeli memesan jasa angkut.</p>
              </div>
            ) : (
              <div className={styles.poolGrid}>
                {availableOrders.map(o => (
                  <PoolCard
                    key={o.carryOrderId}
                    order={o}
                    carrierId={user.id}
                    carrierName={user.name}
                    onClaim={claimOrder}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Active Tab */}
        {activeTab === 'active' && (
          <div>
            {activeOrders.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🚚</div>
                <h3>Tidak ada tugas aktif</h3>
                <p>Ambil tugas dari tab "Tugas Tersedia" untuk mulai bekerja.</p>
              </div>
            ) : (
              <div className={styles.activeList}>
                {activeOrders.map(o => (
                  <ActiveTaskCard
                    key={o.carryOrderId}
                    order={o}
                    onUpdateStatus={updateCarryStatus}
                    onUploadProof={uploadProofPhoto}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div>
            {historyOrders.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>📜</div>
                <h3>Belum ada riwayat</h3>
                <p>Riwayat tugas yang sudah selesai akan muncul di sini.</p>
              </div>
            ) : (
              <div className={styles.histList}>
                {historyOrders
                  .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))
                  .map(o => <HistoryCard key={o.carryOrderId} order={o} />)}
              </div>
            )}
          </div>
        )}

        {/* Wallet Tab */}
        {activeTab === 'wallet' && (
          <div className={styles.walletTab}>
            <div className={styles.walletCards}>
              <div className={styles.walletCard} style={{ '--c': '#10B981' }}>
                <div className={styles.walletCardIcon}>💰</div>
                <div>
                  <span className={styles.walletCardLabel}>Saldo Tersedia</span>
                  <strong className={styles.walletCardValue}>Rp {balance.toLocaleString('id-ID')}</strong>
                </div>
              </div>
              <div className={styles.walletCard} style={{ '--c': '#7C3AED' }}>
                <div className={styles.walletCardIcon}>📊</div>
                <div>
                  <span className={styles.walletCardLabel}>Total Komisi Diterima</span>
                  <strong className={styles.walletCardValue}>Rp {totalEarned.toLocaleString('id-ID')}</strong>
                </div>
              </div>
              <div className={styles.walletCard} style={{ '--c': '#F59E0B' }}>
                <div className={styles.walletCardIcon}>🚚</div>
                <div>
                  <span className={styles.walletCardLabel}>Total Perjalanan</span>
                  <strong className={styles.walletCardValue}>{totalTrips} trip</strong>
                </div>
              </div>
            </div>

            <div className={styles.walletInfo}>
              <h3>ℹ️ Cara Kerja Komisi</h3>
              <div className={styles.walletInfoRow}>
                <span>Biaya jasa yang kamu terima</span>
                <span>Estimasi fee dari pembeli</span>
              </div>
              <div className={styles.walletInfoRow}>
                <span>Potongan admin platform</span>
                <span className={styles.walletFee}>{CARRIER_FEE_PERCENT}%</span>
              </div>
              <div className={styles.walletInfoDivider}></div>
              <div className={styles.walletInfoRow + ' ' + styles.walletInfoTotal}>
                <span>Kamu terima</span>
                <span>{100 - CARRIER_FEE_PERCENT}% dari estimasi fee</span>
              </div>
              <p className={styles.walletNote}>
                Komisi otomatis masuk ke saldo setelah pembeli konfirmasi "Barang Diterima & Jasa Selesai".
              </p>
            </div>

            {/* Earning history */}
            <h3 className={styles.walletHistTitle}>📜 Riwayat Komisi</h3>
            {historyOrders.filter(o => o.status === 'completed').length === 0 ? (
              <div className={styles.empty} style={{ padding: '32px' }}>
                <p>Belum ada komisi yang diterima</p>
              </div>
            ) : (
              <div className={styles.walletHistList}>
                {historyOrders
                  .filter(o => o.status === 'completed')
                  .map(o => {
                    const net = Math.round(o.estimatedFee * (1 - (o.adminFeePercent ?? 10) / 100))
                    return (
                      <div key={o.carryOrderId} className={styles.walletHistRow}>
                        <div className={styles.walletHistIcon}>✅</div>
                        <div className={styles.walletHistInfo}>
                          <strong>{o.itemDescription}</strong>
                          <span>{o.pickupPoint} → {o.dropoffPoint}</span>
                          <span className={styles.walletHistDate}>
                            {o.completedAt && new Date(o.completedAt).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}
                          </span>
                        </div>
                        <span className={styles.walletHistAmount}>+Rp {net.toLocaleString('id-ID')}</span>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
