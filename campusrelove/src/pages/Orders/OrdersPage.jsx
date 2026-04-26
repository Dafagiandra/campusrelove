import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOrders } from '../../context/OrderContext'
import { useCarrier, CARRY_STATUS } from '../../context/CarrierContext'
import { useProducts } from '../../context/ProductContext'
import styles from './OrdersPage.module.css'

// ── Status labels ─────────────────────────────────────────────────────────────
const ORDER_STATUS = {
  pending_payment: { label: '⏳ Menunggu Validasi', color: '#F59E0B', bg: '#FEF3C7' },
  paid:            { label: '🔒 Escrow — Dibayar',  color: '#2563EB', bg: '#DBEAFE' },
  processing:      { label: '📦 Diproses',          color: '#7C3AED', bg: '#EDE9FE' },
  shipped:         { label: '🚚 Dikirim',           color: '#059669', bg: '#D1FAE5' },
  delivered:       { label: '📬 Diterima',          color: '#10B981', bg: '#D1FAE5' },
  completed:       { label: '🎉 Selesai',           color: '#065f46', bg: '#D1FAE5' },
  cancelled:       { label: '❌ Dibatalkan',        color: '#DC2626', bg: '#FEE2E2' },
}

// ── Carry Order Card (Relove-Carry) ───────────────────────────────────────────
function CarryOrderCard({ order, role, onConfirm }) {
  const st = CARRY_STATUS[order.status] || CARRY_STATUS.available
  const [showRating, setShowRating] = useState(false)
  const [rating, setRating] = useState(5)
  const [showConfirm, setShowConfirm] = useState(false)

  const feePercent = order.adminFeePercent ?? 10
  const netFee     = Math.round((order.estimatedFee || 0) * (1 - feePercent / 100))
  const adminFee   = (order.estimatedFee || 0) - netFee

  const waLink    = (num) => `https://wa.me/${(num || '').replace(/\D/g, '')}`
  const mapsLink  = (addr) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`

  return (
    <div className={`${styles.orderCard} ${styles.carryCard}`}>
      {/* Header */}
      <div className={styles.orderHeader}>
        <div className={styles.orderMeta}>
          <span className={styles.carryBadge}>🚚 Relove-Carry</span>
          <span className={styles.orderId}>#{order.carryOrderId.slice(-8).toUpperCase()}</span>
          <span className={styles.orderDate}>
            {new Date(order.createdAt).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}
          </span>
        </div>
        <span className={styles.statusBadge} style={{ color: st.color, background: st.bg }}>
          {st.label}
        </span>
      </div>

      {/* Route info */}
      <div className={styles.carryRoute}>
        <div className={styles.carryRouteRow}>
          <span className={styles.carryDot} style={{ background: '#10B981' }}></span>
          <div className={styles.carryRouteInfo}>
            <span className={styles.carryRouteLabel}>Jemput dari</span>
            <strong>{order.pickupPoint}</strong>
          </div>
          <a href={mapsLink(order.pickupPoint)} target="_blank" rel="noreferrer" className={styles.mapsSmallBtn}>🗺️</a>
        </div>
        <div className={styles.carryRouteLine}></div>
        <div className={styles.carryRouteRow}>
          <span className={styles.carryDot} style={{ background: '#7C3AED' }}></span>
          <div className={styles.carryRouteInfo}>
            <span className={styles.carryRouteLabel}>Antar ke</span>
            <strong>{order.dropoffPoint}</strong>
          </div>
          <a href={mapsLink(order.dropoffPoint)} target="_blank" rel="noreferrer" className={styles.mapsSmallBtn}>🗺️</a>
        </div>
      </div>

      {/* Details */}
      <div className={styles.carryDetails}>
        <div className={styles.carryDetailRow}><span>📦</span><span>{order.itemDescription}</span></div>
        <div className={styles.carryDetailRow}><span>📅</span><span>{order.scheduledDate} · {order.scheduledTime}</span></div>
        {order.carrierName && (
          <div className={styles.carryDetailRow}>
            <span>🚚</span>
            <span>Carrier: <strong>{order.carrierName}</strong></span>
            {order.buyerWhatsapp && role === 'carrier' && (
              <a href={waLink(order.buyerWhatsapp)} target="_blank" rel="noreferrer" className={styles.waSmallBtn}>💬 WA Pembeli</a>
            )}
          </div>
        )}
        <div className={styles.carryDetailRow}>
          <span>💰</span>
          <span>Estimasi: <strong>Rp {(order.estimatedFee || 0).toLocaleString('id-ID')}</strong></span>
        </div>
      </div>

      {/* Progress bar */}
      <div className={styles.carryProgress}>
        {['available','claimed','heading_to_seller','loading','in_transit','arrived','completed'].map((s, i) => {
          const all = ['available','claimed','heading_to_seller','loading','in_transit','arrived','completed']
          const cur = all.indexOf(order.status)
          const done = i < cur
          const active = i === cur
          const labels = ['Tersedia','Diklaim','Menuju','Muat','Diantar','Tiba','Selesai']
          return (
            <div key={s} className={`${styles.carryProgressStep} ${done ? styles.carryProgressDone : active ? styles.carryProgressActive : ''}`}>
              <div className={styles.carryProgressDot}>{done ? '✓' : i + 1}</div>
              <span>{labels[i]}</span>
            </div>
          )
        })}
      </div>

      {/* Proof photo */}
      {order.proofPhotoUrl && (
        <div className={styles.carryProof}>
          <img src={order.proofPhotoUrl} alt="Bukti pengiriman" className={styles.carryProofImg} />
          <span>📸 Foto bukti dari carrier</span>
        </div>
      )}

      {/* ── BUYER ACTIONS ── */}
      {role === 'buyer' && (
        <div className={styles.orderActions}>
          {/* Status info saat masih proses */}
          {['available','claimed','heading_to_seller','loading','in_transit'].includes(order.status) && (
            <div className={styles.carryStatusInfo}>
              <span className={styles.carryStatusInfoIcon}>ℹ️</span>
              <span>
                {order.status === 'available' && 'Menunggu carrier mengambil tugas...'}
                {order.status === 'claimed' && `Carrier ${order.carrierName} sudah mengambil tugas. Menunggu penjemputan.`}
                {order.status === 'heading_to_seller' && `Carrier ${order.carrierName} sedang menuju lokasi penjual.`}
                {order.status === 'loading' && `Carrier ${order.carrierName} sedang memuat barang.`}
                {order.status === 'in_transit' && `Barang sedang dalam perjalanan ke kamu!`}
              </span>
            </div>
          )}

          {/* Konfirmasi terima — muncul saat arrived + ada foto bukti */}
          {order.status === 'arrived' && order.proofPhotoUrl && !showConfirm && (
            <button className={styles.btnGreen} onClick={() => setShowConfirm(true)}>
              ✅ Konfirmasi Barang Diterima
            </button>
          )}

          {order.status === 'arrived' && !order.proofPhotoUrl && (
            <div className={styles.carryStatusInfo}>
              <span>⏳ Carrier sudah tiba. Menunggu upload foto bukti dari carrier...</span>
            </div>
          )}

          {showConfirm && !showRating && (
            <div className={styles.confirmBox}>
              <p>Konfirmasi barang sudah kamu terima?</p>
              <p className={styles.confirmNote}>
                Komisi <strong>Rp {netFee.toLocaleString('id-ID')}</strong> akan cair ke carrier.
                Potongan admin <strong>Rp {adminFee.toLocaleString('id-ID')}</strong> ({feePercent}%).
              </p>
              <div className={styles.confirmActions}>
                <button className={styles.btnGreen} onClick={() => setShowRating(true)}>
                  ✅ Ya, Sudah Diterima
                </button>
                <button className={styles.btnOutline} onClick={() => setShowConfirm(false)}>Batal</button>
              </div>
            </div>
          )}

          {/* Rating step */}
          {showRating && (
            <div className={styles.ratingBox}>
              <h4>⭐ Beri Rating Carrier</h4>
              <p>Bagaimana pelayanan <strong>{order.carrierName}</strong>?</p>
              <div className={styles.ratingStars}>
                {[1,2,3,4,5].map(s => (
                  <button
                    key={s}
                    className={`${styles.ratingStar} ${s <= rating ? styles.ratingStarActive : ''}`}
                    onClick={() => setRating(s)}
                  >★</button>
                ))}
              </div>
              <p className={styles.ratingLabel}>
                {['','Sangat Buruk','Buruk','Cukup','Bagus','Sangat Bagus'][rating]}
              </p>
              <div className={styles.confirmActions}>
                <button className={styles.btnGreen} onClick={() => {
                  onConfirm(order.carryOrderId, rating)
                  setShowRating(false)
                  setShowConfirm(false)
                }}>
                  🎉 Selesai & Kirim Rating
                </button>
                <button className={styles.btnOutline} onClick={() => {
                  onConfirm(order.carryOrderId, null)
                  setShowRating(false)
                  setShowConfirm(false)
                }}>Lewati Rating</button>
              </div>
            </div>
          )}

          {/* Completed */}
          {order.status === 'completed' && (
            <div className={styles.carryCompleted}>
              <span>🎉 Jasa angkut selesai!</span>
              {order.carrierRating && (
                <span>Rating kamu: {'★'.repeat(order.carrierRating)}{'☆'.repeat(5 - order.carrierRating)}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── SELLER ACTIONS (info only) ── */}
      {role === 'seller' && (
        <div className={styles.orderActions}>
          <div className={styles.carryStatusInfo}>
            <span className={styles.carryStatusInfoIcon}>ℹ️</span>
            <span>
              {order.status === 'available' && 'Menunggu carrier mengambil tugas angkut.'}
              {order.status === 'claimed' && `Carrier ${order.carrierName} akan menjemput barang kamu.`}
              {order.status === 'heading_to_seller' && `Carrier ${order.carrierName} sedang menuju ke kamu!`}
              {order.status === 'loading' && 'Carrier sedang memuat barang.'}
              {order.status === 'in_transit' && 'Barang sedang diantar ke pembeli.'}
              {order.status === 'arrived' && 'Barang sudah tiba di tujuan.'}
              {order.status === 'completed' && 'Pengiriman selesai.'}
            </span>
          </div>
          {order.status === 'heading_to_seller' && order.carrierId && (
            <a
              href={`https://wa.me/${(order.buyerWhatsapp || '').replace(/\D/g,'')}`}
              target="_blank" rel="noreferrer"
              className={styles.btnOutline}
            >
              💬 Chat Carrier
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ── Regular Order Card (Produk) ───────────────────────────────────────────────
function OrderCard({ order, role, onAction }) {
  const { allProducts } = useProducts()
  const { PLATFORM_FEE_PERCENT } = useOrders()
  const product = allProducts.find(p => p.id === order.productId)
  const st = ORDER_STATUS[order.status] || ORDER_STATUS.pending_payment
  const [shipForm, setShipForm]     = useState({ method: 'cod', resi: '', codSchedule: '' })
  const [showShip, setShowShip]     = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const feePercent  = order.platformFeePercent ?? PLATFORM_FEE_PERCENT
  const platformFee = order.platformFee  ?? Math.round(order.price * feePercent / 100)
  const sellerAmt   = order.sellerAmount ?? (order.price - platformFee)

  return (
    <div className={styles.orderCard}>
      <div className={styles.orderHeader}>
        <div className={styles.orderMeta}>
          <span className={styles.orderId}>#{order.orderId.slice(-8).toUpperCase()}</span>
          <span className={styles.orderDate}>
            {new Date(order.createdAt).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}
          </span>
        </div>
        <span className={styles.statusBadge} style={{ color: st.color, background: st.bg }}>
          {st.label}
        </span>
      </div>

      <div className={styles.orderBody}>
        {product && (
          <img src={product.images[0]} alt={product.title} className={styles.orderImg}
            onError={e => { e.target.src = 'https://via.placeholder.com/80x60?text=No+Image' }} />
        )}
        <div className={styles.orderInfo}>
          <h4>{order.productTitle}</h4>
          <p className={styles.orderPrice}>Rp {order.price.toLocaleString('id-ID')}</p>
          {order.meetupPoint && <p className={styles.orderMeetup}>📍 COD: {order.meetupPoint}</p>}
          {order.resi && <p className={styles.orderResi}>📦 Resi: <strong>{order.resi}</strong></p>}
          {order.codSchedule && <p className={styles.orderResi}>📅 COD: <strong>{order.codSchedule}</strong></p>}
          {order.cancelReason && <p className={styles.orderCancel}>Alasan: {order.cancelReason}</p>}
          {role === 'buyer'  && <p className={styles.orderParty}>Penjual ID: {order.sellerId.slice(0,8)}...</p>}
          {role === 'seller' && <p className={styles.orderParty}>Pembeli: <strong>{order.buyerName}</strong></p>}
        </div>
      </div>

      {/* Escrow info */}
      {role === 'buyer' && ['paid','processing','shipped'].includes(order.status) && (
        <div className={styles.escrowInfo}>
          <span className={styles.escrowIcon}>🔒</span>
          <div className={styles.escrowText}>
            <strong>Dana Rp {order.price.toLocaleString('id-ID')} aman di Escrow</strong>
            <span>Akan cair ke penjual setelah kamu konfirmasi terima barang</span>
          </div>
        </div>
      )}

      {/* Fund breakdown seller */}
      {role === 'seller' && order.status === 'completed' && (
        <div className={styles.fundBreakdown}>
          <div className={styles.fundRow}><span>Harga barang</span><span>Rp {order.price.toLocaleString('id-ID')}</span></div>
          <div className={`${styles.fundRow} ${styles.fundFee}`}>
            <span>Komisi platform ({feePercent}%)</span><span>− Rp {platformFee.toLocaleString('id-ID')}</span>
          </div>
          <div className={styles.fundDivider}></div>
          <div className={`${styles.fundRow} ${styles.fundTotal}`}>
            <span>Kamu terima</span><strong>Rp {sellerAmt.toLocaleString('id-ID')}</strong>
          </div>
        </div>
      )}

      <div className={styles.orderActions}>
        {/* BUYER: konfirmasi selesai */}
        {role === 'buyer' && order.status === 'shipped' && (
          <>
            {!showConfirm ? (
              <button className={styles.btnGreen} onClick={() => setShowConfirm(true)}>
                ✅ Pesanan Selesai
              </button>
            ) : (
              <div className={styles.confirmBox}>
                <p>Konfirmasi barang sudah kamu terima?</p>
                <p className={styles.confirmNote}>
                  Dana <strong>Rp {sellerAmt.toLocaleString('id-ID')}</strong> langsung cair ke penjual.
                  Komisi platform <strong>Rp {platformFee.toLocaleString('id-ID')}</strong> ({feePercent}%).
                </p>
                <div className={styles.confirmActions}>
                  <button className={styles.btnGreen} onClick={() => { onAction('confirmDelivery', order.orderId); setShowConfirm(false) }}>
                    ✅ Ya, Barang Sudah Diterima
                  </button>
                  <button className={styles.btnOutline} onClick={() => setShowConfirm(false)}>Batal</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* SELLER: proses */}
        {role === 'seller' && order.status === 'paid' && (
          <>
            <button className={styles.btnPrimary} onClick={() => onAction('processOrder', order.orderId)}>
              ▶️ Proses Pesanan
            </button>
            {!showReject ? (
              <button className={styles.btnRed} onClick={() => setShowReject(true)}>❌ Tolak</button>
            ) : (
              <div className={styles.rejectForm}>
                <input placeholder="Alasan penolakan..." value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)} />
                <button className={styles.btnRed} onClick={() => {
                  onAction('rejectOrder', order.orderId, rejectReason || 'Stok habis')
                  setShowReject(false)
                }}>Konfirmasi Tolak</button>
                <button className={styles.btnOutline} onClick={() => setShowReject(false)}>Batal</button>
              </div>
            )}
          </>
        )}

        {/* SELLER: kirim */}
        {role === 'seller' && order.status === 'processing' && (
          <>
            {!showShip ? (
              <button className={styles.btnPrimary} onClick={() => setShowShip(true)}>🚚 Input Pengiriman</button>
            ) : (
              <div className={styles.shipForm}>
                <div className={styles.shipMethodRow}>
                  <button className={`${styles.shipMethodBtn} ${shipForm.method === 'cod' ? styles.shipMethodActive : ''}`}
                    onClick={() => setShipForm({...shipForm, method:'cod'})}>📍 COD</button>
                  <button className={`${styles.shipMethodBtn} ${shipForm.method === 'ekspedisi' ? styles.shipMethodActive : ''}`}
                    onClick={() => setShipForm({...shipForm, method:'ekspedisi'})}>📦 Ekspedisi</button>
                </div>
                {shipForm.method === 'ekspedisi' ? (
                  <input placeholder="Nomor resi..." value={shipForm.resi}
                    onChange={e => setShipForm({...shipForm, resi: e.target.value})} />
                ) : (
                  <input placeholder="Jadwal COD (misal: Sabtu 10 Jan, 14:00 di Perpus)"
                    value={shipForm.codSchedule}
                    onChange={e => setShipForm({...shipForm, codSchedule: e.target.value})} />
                )}
                <div className={styles.shipActions}>
                  <button className={styles.btnPrimary} onClick={() => {
                    if (shipForm.method === 'ekspedisi' && !shipForm.resi.trim()) return
                    if (shipForm.method === 'cod' && !shipForm.codSchedule.trim()) return
                    onAction('shipOrder', order.orderId, shipForm)
                    setShowShip(false)
                  }}>✅ Konfirmasi Kirim</button>
                  <button className={styles.btnOutline} onClick={() => setShowShip(false)}>Batal</button>
                </div>
              </div>
            )}
          </>
        )}

        <Link to={`/product/${order.productId}`} className={styles.btnOutline}>👁 Lihat Produk</Link>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const { user } = useAuth()
  const { getOrdersByBuyer, getOrdersBySeller, processOrder, rejectOrder, shipOrder, confirmDelivery } = useOrders()
  const { getBuyerCarryOrders, confirmCarryReceived } = useCarrier()
  const navigate = useNavigate()
  const [tab, setTab] = useState('all')   // 'all' | 'produk' | 'carry'

  if (!user) {
    return (
      <div className={styles.center}>
        <div className={styles.centerIcon}>🔐</div>
        <h2>Login dulu yuk!</h2>
        <button className={styles.btnPrimary} onClick={() => navigate('/auth', { state: { mode: 'login' } })}>
          Login Sekarang
        </button>
      </div>
    )
  }

  // Produk orders
  const productOrders = user.role === 'seller'
    ? getOrdersBySeller(user.id)
    : getOrdersByBuyer(user.id)

  // Carry orders (buyer only — seller lihat di carry card sebagai info)
  const carryOrders = user.role === 'buyer'
    ? getBuyerCarryOrders(user.id)
    : []

  // Seller juga bisa lihat carry orders yang melibatkan mereka sebagai penjual
  const sellerCarryOrders = user.role === 'seller'
    ? (() => {
        try {
          const all = JSON.parse(localStorage.getItem('cr_carry_orders') || '[]')
          return all.filter(o => o.sellerId === user.id)
        } catch { return [] }
      })()
    : []

  const allCarryOrders = user.role === 'buyer' ? carryOrders : sellerCarryOrders

  const handleProductAction = (action, orderId, extra) => {
    if (action === 'processOrder')    processOrder(orderId)
    if (action === 'rejectOrder')     rejectOrder(orderId, extra)
    if (action === 'shipOrder')       shipOrder(orderId, extra)
    if (action === 'confirmDelivery') confirmDelivery(orderId)
  }

  const handleCarryConfirm = (carryOrderId, rating) => {
    confirmCarryReceived(carryOrderId, rating)
  }

  const tabs = [
    { id: 'all',    label: `Semua (${productOrders.length + allCarryOrders.length})` },
    { id: 'produk', label: `🛍️ Produk (${productOrders.length})` },
    { id: 'carry',  label: `🚚 Jasa Angkut (${allCarryOrders.length})` },
  ]

  const showProduct = tab === 'all' || tab === 'produk'
  const showCarry   = tab === 'all' || tab === 'carry'

  const pageTitle = {
    buyer:  '🛍️ Pesanan Saya',
    seller: '📦 Pesanan Masuk',
  }[user.role] || '📋 Pesanan'

  return (
    <div className={styles.page}>
      <div className="container">
        <h1 className={styles.pageTitle}>{pageTitle}</h1>

        {/* Type tabs */}
        <div className={styles.filterTabs}>
          {tabs.map(t => (
            <button key={t.id}
              className={`${styles.filterTab} ${tab === t.id ? styles.filterTabActive : ''}`}
              onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {productOrders.length === 0 && allCarryOrders.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📭</div>
            <h3>Belum ada pesanan</h3>
            <p>{user.role === 'seller' ? 'Pesanan dari pembeli akan muncul di sini.' : 'Yuk mulai belanja!'}</p>
            {user.role === 'buyer' && <Link to="/browse" className={styles.btnPrimary}>🛍️ Browse Barang</Link>}
          </div>
        ) : (
          <div className={styles.orderList}>
            {/* Carry orders */}
            {showCarry && allCarryOrders.length > 0 && (
              <>
                {tab === 'all' && allCarryOrders.length > 0 && (
                  <div className={styles.sectionDivider}>🚚 Pesanan Jasa Angkut</div>
                )}
                {allCarryOrders
                  .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .map(o => (
                    <CarryOrderCard
                      key={o.carryOrderId}
                      order={o}
                      role={user.role}
                      onConfirm={handleCarryConfirm}
                    />
                  ))}
              </>
            )}

            {/* Product orders */}
            {showProduct && productOrders.length > 0 && (
              <>
                {tab === 'all' && productOrders.length > 0 && (
                  <div className={styles.sectionDivider}>🛍️ Pesanan Produk</div>
                )}
                {productOrders
                  .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .map(o => (
                    <OrderCard
                      key={o.orderId}
                      order={o}
                      role={user.role}
                      onAction={handleProductAction}
                    />
                  ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
