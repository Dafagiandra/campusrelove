import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOrders } from '../../context/OrderContext'
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
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')

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

  const orders = user.role === 'seller'
    ? getOrdersBySeller(user.id)
    : getOrdersByBuyer(user.id)

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  const handleAction = (action, orderId, extra) => {
    if (action === 'processOrder')    processOrder(orderId)
    if (action === 'rejectOrder')     rejectOrder(orderId, extra)
    if (action === 'shipOrder')       shipOrder(orderId, extra)
    if (action === 'confirmDelivery') confirmDelivery(orderId)
  }

  const filterTabs = [
    { id: 'all',             label: 'Semua' },
    { id: 'pending_payment', label: '⏳ Menunggu' },
    { id: 'paid',            label: '✅ Dibayar' },
    { id: 'processing',      label: '📦 Diproses' },
    { id: 'shipped',         label: '🚚 Dikirim' },
    { id: 'completed',       label: '🎉 Selesai' },
    { id: 'cancelled',       label: '❌ Dibatalkan' },
  ]

  const pageTitle = user.role === 'seller' ? '📦 Pesanan Masuk' : '🛍️ Pesanan Saya'

  return (
    <div className={styles.page}>
      <div className="container">
        <h1 className={styles.pageTitle}>{pageTitle}</h1>

        <div className={styles.filterTabs}>
          {filterTabs.map(t => (
            <button key={t.id}
              className={`${styles.filterTab} ${filter === t.id ? styles.filterTabActive : ''}`}
              onClick={() => setFilter(t.id)}>
              {t.label}
              <span className={styles.filterCount}>
                {t.id === 'all' ? orders.length : orders.filter(o => o.status === t.id).length}
              </span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📭</div>
            <h3>Belum ada pesanan</h3>
            <p>{user.role === 'seller' ? 'Pesanan dari pembeli akan muncul di sini.' : 'Yuk mulai belanja!'}</p>
            {user.role === 'buyer' && <Link to="/browse" className={styles.btnPrimary}>🛍️ Browse Barang</Link>}
          </div>
        ) : (
          <div className={styles.orderList}>
            {filtered
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .map(order => (
                <OrderCard
                  key={order.orderId}
                  order={order}
                  role={user.role}
                  onAction={handleAction}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
