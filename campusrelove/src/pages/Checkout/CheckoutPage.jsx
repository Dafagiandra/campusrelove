import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProducts } from '../../context/ProductContext'
import { useOrders } from '../../context/OrderContext'
import { meetupPoints } from '../../data/products'
import styles from './CheckoutPage.module.css'
const PAYMENT_METHODS = [
  { id: 'transfer', label: '🏦 Transfer Bank', desc: 'BCA / Mandiri / BNI / BRI' },
  { id: 'gopay',    label: '💚 GoPay',          desc: 'Dompet digital GoPay' },
  { id: 'ovo',      label: '💜 OVO',             desc: 'Dompet digital OVO' },
  { id: 'dana',     label: '💙 DANA',            desc: 'Dompet digital DANA' },
]

export default function CheckoutPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { allProducts } = useProducts()
  const { createOrder, isProductSold } = useOrders()
  const navigate = useNavigate()

  const product = allProducts.find(p => p.id === id)
  const [payMethod, setPayMethod] = useState('transfer')
  const [meetup, setMeetup] = useState('')
  const [step, setStep] = useState(1)
  const [order, setOrder] = useState(null)

  // Cek sold out
  const sold = product ? isProductSold(product.id) : false

  if (!user) {    return (
      <div className={styles.center}>
        <div className={styles.centerIcon}>🔐</div>
        <h2>Login dulu yuk!</h2>
        <p>Kamu perlu login sebagai pembeli untuk checkout.</p>
        <Link to="/auth" state={{ mode: 'login', from: `/checkout/${id}` }} className={styles.btnPrimary}>
          Login Sekarang
        </Link>
      </div>
    )
  }

  if (user.role === 'seller') {
    return (
      <div className={styles.center}>
        <div className={styles.centerIcon}>🚫</div>
        <h2>Kamu adalah Penjual</h2>
        <p>Akun penjual tidak bisa melakukan pembelian. Gunakan akun pembeli.</p>
        <Link to={`/product/${id}`} className={styles.btnOutline}>← Kembali</Link>
      </div>
    )
  }

  // Block rejected users
  if (user.verificationStatus === 'rejected') {
    return (
      <div className={styles.center}>
        <div className={styles.centerIcon}>🔒</div>
        <h2>Akun Dibatasi</h2>
        <p style={{ marginBottom: 8 }}>Verifikasi identitasmu ditolak oleh admin.</p>
        {user.rejectionNote && (
          <p style={{ fontSize: '0.85rem', color: '#dc2626', marginBottom: 16 }}>
            Alasan: <strong>{user.rejectionNote}</strong>
          </p>
        )}
        <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 20 }}>
          Upload ulang foto KTP dan selfie untuk mengaktifkan kembali akun kamu.
        </p>
        <Link to="/auth" state={{ mode: 'reverify' }} className={styles.btnPrimary}>
          🔄 Verifikasi Ulang
        </Link>
      </div>
    )
  }

  if (!product) {
    return (
      <div className={styles.center}>
        <div className={styles.centerIcon}>😕</div>
        <h2>Produk tidak ditemukan</h2>
        <Link to="/browse" className={styles.btnPrimary}>← Browse</Link>
      </div>
    )
  }

  if (product.sellerId === user.id) {
    return (
      <div className={styles.center}>
        <div className={styles.centerIcon}>🚫</div>
        <h2>Ini barang kamu sendiri!</h2>
        <p>Kamu tidak bisa membeli barang yang kamu jual sendiri.</p>
        <Link to={`/product/${id}`} className={styles.btnOutline}>← Kembali</Link>
      </div>
    )
  }

  if (sold) {
    return (
      <div className={styles.center}>
        <div className={styles.centerIcon}>🔴</div>
        <h2>Barang Sudah Terjual</h2>
        <p>Maaf, barang ini sudah dibeli oleh orang lain.</p>
        <Link to="/browse" className={styles.btnPrimary}>🛍️ Cari Barang Lain</Link>
      </div>
    )
  }

  const handleOrder = () => {
    const newOrder = createOrder({
      buyerId:      user.id,
      buyerName:    user.name,
      sellerId:     product.sellerId,
      productId:    product.id,
      productTitle: product.title,
      price:        product.price,
      meetupPoint:  meetup || null,
    })
    setOrder(newOrder)
    setStep(3)
  }

  // ── Step 3: Sukses ────────────────────────────────────────────────────────
  if (step === 3 && order) {
    return (
      <div className={styles.page}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>🎉</div>
          <h2>Pesanan Berhasil Dibuat!</h2>
          <p>Pesanan kamu sedang menunggu konfirmasi pembayaran dari Admin.</p>

          <div className={styles.orderSummary}>
            <div className={styles.orderRow}>
              <span>ID Pesanan</span>
              <strong className={styles.orderId}>{order.orderId}</strong>
            </div>
            <div className={styles.orderRow}>
              <span>Barang</span>
              <strong>{product.title}</strong>
            </div>
            <div className={styles.orderRow}>
              <span>Total</span>
              <strong className={styles.orderPrice}>Rp {product.price.toLocaleString('id-ID')}</strong>
            </div>
            <div className={styles.orderRow}>
              <span>Status</span>
              <span className={styles.statusBadge}>⏳ Menunggu Validasi Admin</span>
            </div>
          </div>

          <div className={styles.payInfo}>
            <h4>📋 Instruksi Pembayaran</h4>
            <p>Transfer ke rekening bersama CampusRelove:</p>
            <div className={styles.bankInfo}>
              <div>🏦 BCA: <strong>1234-5678-90</strong> a.n. CampusRelove Escrow</div>
              <div>💚 GoPay: <strong>0812-3456-7890</strong></div>
            </div>
            <p className={styles.payNote}>
              Cantumkan ID Pesanan <strong>{order.orderId}</strong> pada keterangan transfer.
              Admin akan memvalidasi dalam 1×24 jam.
            </p>
          </div>

          <div className={styles.successActions}>
            <Link to="/orders" className={styles.btnPrimary}>📋 Lihat Pesanan Saya</Link>
            <Link to="/browse" className={styles.btnOutline}>🛍️ Lanjut Belanja</Link>
          </div>
        </div>
      </div>
    )
  }

  const discount = product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.breadcrumb}>
          <Link to="/">Home</Link> › <Link to="/browse">Browse</Link> ›{' '}
          <Link to={`/product/${id}`}>{product.title}</Link> › <span>Checkout</span>
        </div>

        <h1 className={styles.pageTitle}>🛒 Checkout</h1>

        {/* Step indicator */}
        <div className={styles.steps}>
          {['Detail Pesanan', 'Metode Bayar', 'Konfirmasi'].map((s, i) => (
            <div key={s} className={`${styles.step} ${step > i ? styles.stepDone : step === i+1 ? styles.stepActive : ''}`}>
              <div className={styles.stepNum}>{step > i+1 ? '✓' : i+1}</div>
              <span>{s}</span>
            </div>
          ))}
        </div>

        <div className={styles.layout}>
          {/* Left: form */}
          <div className={styles.formCol}>

            {/* Step 1: Detail */}
            {step === 1 && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>📍 Pilih Titik Temu (COD)</h3>
                <p className={styles.cardDesc}>Opsional — pilih lokasi COD di kampus</p>
                <div className={styles.meetupList}>
                  {meetupPoints.map(mp => (
                    <button
                      key={mp.id}
                      className={`${styles.meetupBtn} ${meetup === mp.name ? styles.meetupBtnActive : ''}`}
                      onClick={() => setMeetup(meetup === mp.name ? '' : mp.name)}
                    >
                      <span className={styles.meetupIcon}>{mp.icon}</span>
                      <div>
                        <div className={styles.meetupName}>{mp.name}</div>
                        <div className={styles.meetupDesc}>{mp.description}</div>
                      </div>
                      {meetup === mp.name && <span className={styles.meetupCheck}>✓</span>}
                    </button>
                  ))}
                </div>
                <button className={styles.btnPrimary} onClick={() => setStep(2)}>
                  Lanjut ke Pembayaran →
                </button>
              </div>
            )}

            {/* Step 2: Metode Bayar */}
            {step === 2 && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>💳 Metode Pembayaran</h3>
                <p className={styles.cardDesc}>Pilih metode pembayaran ke rekening Escrow CampusRelove</p>
                <div className={styles.payMethods}>
                  {PAYMENT_METHODS.map(pm => (
                    <button
                      key={pm.id}
                      className={`${styles.payBtn} ${payMethod === pm.id ? styles.payBtnActive : ''}`}
                      onClick={() => setPayMethod(pm.id)}
                    >
                      <span className={styles.payLabel}>{pm.label}</span>
                      <span className={styles.payDesc}>{pm.desc}</span>
                      {payMethod === pm.id && <span className={styles.payCheck}>✓</span>}
                    </button>
                  ))}
                </div>

                <div className={styles.escrowNote}>
                  🔒 <strong>Sistem Escrow:</strong> Dana kamu aman di rekening bersama CampusRelove.
                  Penjual hanya menerima dana setelah kamu konfirmasi barang diterima.
                </div>

                <div className={styles.stepActions}>
                  <button className={styles.btnOutline} onClick={() => setStep(1)}>← Kembali</button>
                  <button className={styles.btnPrimary} onClick={handleOrder}>
                    ✅ Buat Pesanan
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: order summary */}
          <div className={styles.summaryCol}>
            <div className={styles.summaryCard}>
              <h3 className={styles.summaryTitle}>📋 Ringkasan Pesanan</h3>
              <img
                src={product.images[0]}
                alt={product.title}
                className={styles.summaryImg}
                onError={e => { e.target.src = 'https://via.placeholder.com/300x200?text=No+Image' }}
              />
              <div className={styles.summaryInfo}>
                <h4>{product.title}</h4>
                <p className={styles.summaryCondition}>{product.condition}</p>
                {meetup && <p className={styles.summaryMeetup}>📍 COD: {meetup}</p>}
              </div>
              <div className={styles.summaryPrices}>
                <div className={styles.summaryRow}>
                  <span>Harga barang</span>
                  <span>Rp {product.price.toLocaleString('id-ID')}</span>
                </div>
                {discount > 0 && (
                  <div className={styles.summaryRow + ' ' + styles.summaryDiscount}>
                    <span>Hemat</span>
                    <span>-{discount}%</span>
                  </div>
                )}
                <div className={styles.summaryDivider}></div>
                <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                  <span>Total</span>
                  <strong>Rp {product.price.toLocaleString('id-ID')}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
