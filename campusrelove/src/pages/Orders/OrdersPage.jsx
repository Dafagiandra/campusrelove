import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOrders } from '../../context/OrderContext'
import { useProducts } from '../../context/ProductContext'
import { isBackendAvailable, chatAPI } from '../../services/api'
import { MapEmbed, OpenInMapsBtn } from '../../components/Map/GoogleMapsEmbed'
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

// ── Timeline ──────────────────────────────────────────────────────────────────
const ESCROW_STEPS = [
  { key: 'created',    label: 'Dibuat',   icon: '📋', statuses: ['pending_payment'] },
  { key: 'paid',       label: 'Dibayar',  icon: '🔒', statuses: ['paid'] },
  { key: 'processing', label: 'Diproses', icon: '📦', statuses: ['processing'] },
  { key: 'shipped',    label: 'Dikirim',  icon: '🚚', statuses: ['shipped', 'delivered'] },
  { key: 'completed',  label: 'Selesai',  icon: '🎉', statuses: ['completed'] },
]
const COD_STEPS = [
  { key: 'created',    label: 'Dibuat',   icon: '📋', statuses: ['pending_payment'] },
  { key: 'processing', label: 'Diproses', icon: '📦', statuses: ['processing'] },
  { key: 'meetup',     label: 'COD',      icon: '🤝', statuses: ['shipped', 'delivered'] },
  { key: 'completed',  label: 'Selesai',  icon: '🎉', statuses: ['completed'] },
]

const STATUS_ORDER = ['pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'completed', 'cancelled']

function getStepState(step, order) {
  if (order.status === 'cancelled') return step.statuses.includes('pending_payment') ? 'done' : 'inactive'
  const currentIdx = STATUS_ORDER.indexOf(order.status)
  const stepMaxIdx = Math.max(...step.statuses.map(s => STATUS_ORDER.indexOf(s)))
  if (currentIdx > stepMaxIdx) return 'done'
  if (step.statuses.includes(order.status)) return 'active'
  return 'inactive'
}

function OrderTimeline({ order }) {
  const steps = order.paymentMethod === 'cod' ? COD_STEPS : ESCROW_STEPS
  return (
    <div className={styles.timeline}>
      {steps.map((step, i) => {
        const state = getStepState(step, order)
        return (
          <div key={step.key} className={styles.timelineStep}>
            <div className={`${styles.timelineDot} ${state === 'done' ? styles.timelineDotDone : state === 'active' ? styles.timelineDotActive : ''}`}>
              {state === 'done' ? '✓' : step.icon}
            </div>
            <span className={`${styles.timelineLabel} ${state === 'active' ? styles.timelineLabelActive : state === 'done' ? styles.timelineLabelDone : ''}`}>
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <div className={`${styles.timelineLine} ${state === 'done' ? styles.timelineLineDone : ''}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Meetup Map ────────────────────────────────────────────────────────────────
function MeetupMap({ meetupPoint }) {
  if (!meetupPoint) return null
  let coords = null
  let name = meetupPoint
  try {
    const p = JSON.parse(meetupPoint)
    if (p.lat && p.lng) { coords = { lat: p.lat, lng: p.lng }; name = p.name || meetupPoint }
  } catch { /* plain text */ }

  if (!coords) return <p className={styles.orderMeetup}>📍 COD: {name}</p>

  return (
    <div className={styles.meetupMapWrapper}>
      <MapEmbed lat={coords.lat} lng={coords.lng} name={name} height={160} />
      <div style={{ padding: '8px 12px', background: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className={styles.meetupMapLabel} style={{ margin: 0 }}>📍 {name}</p>
        <OpenInMapsBtn lat={coords.lat} lng={coords.lng} name={name} />
      </div>
    </div>
  )
}

// ── Order Card ────────────────────────────────────────────────────────────────
function OrderCard({ order, role, onAction }) {
  const { allProducts, getProductById } = useProducts()
  const { PLATFORM_FEE_PERCENT } = useOrders()
  const navigate = useNavigate()

  // Try to find product in allProducts first; if not found (sold/removed), fetch from API
  const [product, setProduct] = useState(() => allProducts.find(p => p.id === order.productId) || null)

  useEffect(() => {
    if (!product && order.productId) {
      getProductById(order.productId).then(p => { if (p) setProduct(p) }).catch(() => {})
    }
  }, [order.productId]) // eslint-disable-line
  const st = ORDER_STATUS[order.status] || ORDER_STATUS.pending_payment
  const isCOD = order.paymentMethod === 'cod_escrow' || order.paymentMethod === 'cod'
  const isCodCash = order.paymentMethod === 'cod_cash'
  const isProtected = !isCodCash // transfer_escrow and cod_escrow are both protected

  const [shipForm, setShipForm]         = useState({ method: 'cod', resi: '', codSchedule: '' })
  const [showShip, setShowShip]         = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject]     = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [showCancel, setShowCancel]     = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showComplaint, setShowComplaint] = useState(false)
  const [complaintReason, setComplaintReason] = useState('')
  const [complaintDesc, setComplaintDesc]   = useState('')
  const [complaintSent, setComplaintSent]   = useState(false)

  const feePercent  = 0  // 0% komisi — penjual terima penuh
  const platformFee = 0
  const sellerAmt   = order.price

  const buyerCanCancel  = role === 'buyer'  && ['pending_payment', 'paid'].includes(order.status)
  const sellerCanCancel = role === 'seller' && ['paid', 'processing'].includes(order.status)
  const canCancel = buyerCanCancel || sellerCanCancel

  const handleChatClick = async () => {
    try {
      if (isBackendAvailable()) {
        const data = await chatAPI.getOrCreate({ buyerId: order.buyerId, sellerId: order.sellerId, productId: order.productId, productTitle: order.productTitle })
        if (data.success) navigate(`/chat?conv=${data.conversation.id}`)
        else navigate('/chat')
      } else {
        const convs = JSON.parse(localStorage.getItem('cr_chats') || '[]')
        const conv = convs.find(c => c.productId === order.productId && c.buyerId === order.buyerId)
        if (conv) { navigate(`/chat?conv=${conv.conversationId}`) }
        else {
          const newConv = { conversationId: `conv_${Date.now()}`, buyerId: order.buyerId, sellerId: order.sellerId, productId: order.productId, productTitle: order.productTitle, messages: [], createdAt: new Date().toISOString() }
          localStorage.setItem('cr_chats', JSON.stringify([newConv, ...convs]))
          navigate(`/chat?conv=${newConv.conversationId}`)
        }
      }
    } catch { navigate('/chat') }
  }

  return (
    <div className={styles.orderCard}>
      {/* Header */}
      <div className={styles.orderHeader}>
        <div className={styles.orderMeta}>
          <span className={styles.orderId}>#{order.orderId.slice(-8).toUpperCase()}</span>
          <span className={styles.orderDate}>
            {new Date(order.createdAt).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}
          </span>
          {isCOD && <span className={styles.codBadge}>🤝 COD via Aplikasi</span>}
          {isCodCash && <span className={styles.codBadge} style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>💵 Cash Langsung</span>}
        </div>
        <span className={styles.statusBadge} style={{ color: st.color, background: st.bg }}>{st.label}</span>
      </div>

      {/* Timeline */}
      <OrderTimeline order={order} />

      {/* Body */}
      <div className={styles.orderBody}>
        {product && (
          <img src={product.images[0]} alt={product.title} className={styles.orderImg}
            onError={e => { e.target.src = 'https://via.placeholder.com/80x60?text=No+Image' }} />
        )}
        <div className={styles.orderInfo}>
          <h4>{order.productTitle}</h4>
          <p className={styles.orderPrice}>Rp {order.price.toLocaleString('id-ID')}</p>
          {order.resi && <p className={styles.orderResi}>📦 Resi: <strong>{order.resi}</strong></p>}
          {order.codSchedule && <p className={styles.orderResi}>📅 <strong>{order.codSchedule}</strong></p>}
          {order.cancelReason && <p className={styles.orderCancel}>Alasan: {order.cancelReason}</p>}
          {role === 'buyer'  && <p className={styles.orderParty}>Penjual: {order.sellerId.slice(0,8)}...</p>}
          {role === 'seller' && <p className={styles.orderParty}>Pembeli: <strong>{order.buyerName}</strong></p>}
        </div>
      </div>

      {/* Meetup map */}
      {order.meetupPoint && <MeetupMap meetupPoint={order.meetupPoint} />}

      {/* COD cash info — tidak dilindungi sistem */}
      {isCodCash && (
        <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, fontSize: '0.82rem', color: '#92400e', marginBottom: 8 }}>
          ⚠️ <strong>Transaksi Cash Langsung</strong> — Tidak melalui sistem. Tidak ada perlindungan platform dan tidak bisa memberi rating/ulasan.
        </div>
      )}

      {/* Escrow info + proof upload reminder for pending_payment */}
      {!isCOD && !isCodCash && role === 'buyer' && order.status === 'pending_payment' && (
        <div className={styles.escrowInfo} style={{ background: '#fef3c7', borderColor: '#fde68a' }}>
          <span className={styles.escrowIcon}>💳</span>
          <div className={styles.escrowText}>
            <strong style={{ color: '#92400e' }}>Selesaikan Transfer Escrow</strong>
            <span style={{ color: '#92400e' }}>
              Transfer Rp {order.price.toLocaleString('id-ID')} ke rekening admin, lalu upload bukti di halaman Pesanan ini atau di halaman Checkout.
            </span>
          </div>
        </div>
      )}

      {/* Escrow active info */}
      {isProtected && !isCodCash && role === 'buyer' && ['paid','processing','shipped'].includes(order.status) && (
        <div className={styles.escrowInfo}>
          <span className={styles.escrowIcon}>🔒</span>
          <div className={styles.escrowText}>
            <strong>Dana Rp {order.price.toLocaleString('id-ID')} aman di Escrow</strong>
            <span>Cair ke penjual setelah kamu konfirmasi terima barang</span>
          </div>
        </div>
      )}

      {/* COD info */}
      {isCOD && order.status === 'pending_payment' && (
        <div className={styles.escrowInfo} style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
          <span className={styles.escrowIcon}>🤝</span>
          <div className={styles.escrowText}>
            <strong style={{ color: '#065f46' }}>COD — Bayar di Tempat</strong>
            <span style={{ color: '#059669' }}>
              {role === 'buyer' ? '⏳ Menunggu penjual konfirmasi' : 'Terima dan proses pesanan ini'}
            </span>
          </div>
        </div>
      )}

      {/* Fund breakdown seller — 0% komisi, terima 100% */}
      {role === 'seller' && order.status === 'completed' && (
        <div className={styles.fundBreakdown}>
          <div className={styles.fundRow}><span>Harga barang</span><span>Rp {order.price.toLocaleString('id-ID')}</span></div>
          <div className={styles.fundDivider}></div>
          <div className={`${styles.fundRow} ${styles.fundTotal}`}>
            <span>Kamu terima</span>
            <strong style={{ color: '#10B981' }}>Rp {order.price.toLocaleString('id-ID')} (100%)</strong>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: 4, textAlign: 'right' }}>
            ✅ Tidak ada potongan komisi
          </div>
        </div>
      )}

      {/* Actions */}
      <div className={styles.orderActions}>

        {/* BUYER: konfirmasi terima (non-COD) */}
        {!isCOD && role === 'buyer' && order.status === 'shipped' && (
          <>
            {!showConfirm ? (
              <button className={styles.btnGreen} onClick={() => setShowConfirm(true)}>✅ Pesanan Selesai</button>
            ) : (
              <div className={styles.confirmBox}>
                <p>Konfirmasi barang sudah kamu terima?</p>
                <p className={styles.confirmNote}>
                  Dana <strong>Rp {order.price.toLocaleString('id-ID')}</strong> langsung cair ke penjual (100%, tanpa potongan).
                </p>
                <div className={styles.confirmActions}>
                  <button className={styles.btnGreen} onClick={() => { onAction('confirmDelivery', order.orderId); setShowConfirm(false) }}>
                    ✅ Ya, Barang Sudah Diterima
                  </button>
                  <button className={styles.btnOutline} onClick={() => setShowConfirm(false)}>Batal</button>
                </div>
              </div>
            )}

            {/* Tombol komplain */}
            {!showComplaint && !complaintSent && (
              <button className={styles.btnCancel} style={{ background: '#fff7ed', color: '#c2410c', borderColor: '#fed7aa' }}
                onClick={() => setShowComplaint(true)}>
                ⚠️ Ada Masalah? Komplain
              </button>
            )}
            {complaintSent && (
              <div style={{ padding: '10px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, fontSize: '0.82rem', color: '#92400e', fontWeight: 600 }}>
                ⏳ Komplain terkirim. Admin sedang meninjau. Dana ditahan sampai ada keputusan.
              </div>
            )}
            {showComplaint && !complaintSent && (
              <div style={{ border: '2px solid #fed7aa', borderRadius: 14, padding: 16, background: '#fff7ed', width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontWeight: 700, color: '#c2410c', margin: 0, fontSize: '0.9rem' }}>⚠️ Ajukan Komplain</p>
                <p style={{ fontSize: '0.78rem', color: '#78350f', margin: 0 }}>Dana tetap ditahan admin sampai ada keputusan. Gunakan jika barang tidak sesuai atau tidak sampai.</p>
                <input placeholder="Alasan komplain (wajib)..." value={complaintReason} onChange={e => setComplaintReason(e.target.value)}
                  style={{ padding: '9px 13px', border: '1.5px solid #fed7aa', borderRadius: 9, fontSize: '0.85rem', fontFamily: 'Poppins,sans-serif', outline: 'none' }} />
                <textarea placeholder="Detail masalah (opsional)..." value={complaintDesc} onChange={e => setComplaintDesc(e.target.value)} rows={3}
                  style={{ padding: '9px 13px', border: '1.5px solid #fed7aa', borderRadius: 9, fontSize: '0.85rem', fontFamily: 'Poppins,sans-serif', outline: 'none', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button disabled={!complaintReason.trim()}
                    onClick={async () => {
                      try { await onAction('submitComplaint', order.orderId, complaintReason, complaintDesc); setComplaintSent(true); setShowComplaint(false) }
                      catch (err) { alert(err?.message || 'Gagal mengirim komplain') }
                    }}
                    style={{ padding: '9px 18px', background: '#D97706', color: 'white', border: 'none', borderRadius: 9, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins,sans-serif', opacity: complaintReason.trim() ? 1 : 0.5 }}>
                    📤 Kirim Komplain
                  </button>
                  <button onClick={() => { setShowComplaint(false); setComplaintReason(''); setComplaintDesc('') }}
                    style={{ padding: '9px 16px', background: 'white', color: '#6b7280', border: '2px solid #e5e7eb', borderRadius: 9, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}>
                    Batal
                  </button>
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
                <input placeholder="Alasan penolakan..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                <button className={styles.btnRed} onClick={() => { onAction('rejectOrder', order.orderId, rejectReason || 'Stok habis'); setShowReject(false) }}>
                  Konfirmasi Tolak
                </button>
                <button className={styles.btnOutline} onClick={() => setShowReject(false)}>Batal</button>
              </div>
            )}
          </>
        )}

        {/* COD via Aplikasi: seller confirm complete — not for cash offline */}
        {isCOD && !isCodCash && role === 'seller' && order.status === 'processing' && (
          <button className={styles.btnGreen} onClick={() => onAction('confirmCOD', order.orderId)}>
            ✅ Konfirmasi COD Selesai
          </button>
        )}

        {/* COD: buyer pending */}
        {isCOD && role === 'buyer' && order.status === 'pending_payment' && (
          <div className={styles.codPendingInfo}>⏳ Menunggu Penjual Konfirmasi</div>
        )}

        {/* SELLER: kirim (non-COD) */}
        {!isCOD && role === 'seller' && order.status === 'processing' && (
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
                  <input placeholder="Nomor resi..." value={shipForm.resi} onChange={e => setShipForm({...shipForm, resi: e.target.value})} />
                ) : (
                  <input placeholder="Jadwal COD (misal: Sabtu 10 Jan, 14:00)" value={shipForm.codSchedule} onChange={e => setShipForm({...shipForm, codSchedule: e.target.value})} />
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

        {/* Cancel */}
        {canCancel && !showCancel && (
          <button className={styles.btnCancel} onClick={() => setShowCancel(true)}>🚫 Batalkan</button>
        )}
        {canCancel && showCancel && (
          <div className={styles.cancelBox}>
            <p className={styles.cancelTitle}>⚠️ Batalkan Pesanan?</p>
            {role === 'buyer' && <p className={styles.cancelWarning}>Dana akan diproses refund.</p>}
            {role === 'seller' && <p className={styles.cancelWarning}>Pembeli mendapat notifikasi & dana dikembalikan.</p>}
            <input className={styles.cancelInput} placeholder="Alasan pembatalan (wajib)..."
              value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
            <div className={styles.cancelActions}>
              <button className={styles.btnRed} disabled={!cancelReason.trim()}
                onClick={() => { onAction('cancelOrder', order.orderId, cancelReason, role); setShowCancel(false) }}>
                ✅ Ya, Batalkan
              </button>
              <button className={styles.btnOutline} onClick={() => { setShowCancel(false); setCancelReason('') }}>Kembali</button>
            </div>
          </div>
        )}

        {/* Chat + View */}
        <button className={styles.btnOutline} onClick={handleChatClick}>💬 Hubungi</button>
        <Link to={`/product/${order.productId}`} className={styles.btnOutline}>👁 Lihat Produk</Link>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const { user } = useAuth()
  const { getOrdersByBuyer, getOrdersBySeller, processOrder, rejectOrder,
          shipOrder, confirmDelivery, cancelOrder, confirmCOD, submitComplaint } = useOrders()
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

  const orders = user.role === 'seller' ? getOrdersBySeller(user.id) : getOrdersByBuyer(user.id)
  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  const handleAction = async (action, orderId, extra, extra2) => {
    if (action === 'processOrder')    processOrder(orderId)
    if (action === 'rejectOrder')     rejectOrder(orderId, extra)
    if (action === 'shipOrder')       shipOrder(orderId, extra)
    if (action === 'confirmDelivery') confirmDelivery(orderId)
    if (action === 'confirmCOD')      confirmCOD(orderId)
    if (action === 'cancelOrder')     cancelOrder(orderId, extra, extra2)
    if (action === 'submitComplaint') return submitComplaint(orderId, extra, extra2)
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

  return (
    <div className={styles.page}>
      <div className="container">
        <h1 className={styles.pageTitle}>
          {user.role === 'seller' ? '📦 Pesanan Masuk' : '🛍️ Pesanan Saya'}
        </h1>
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
                <OrderCard key={order.orderId} order={order} role={user.role} onAction={handleAction} />
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

