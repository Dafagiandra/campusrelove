import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProducts } from '../../context/ProductContext'
import { useOrders } from '../../context/OrderContext'
import { meetupPoints } from '../../data/products'
import styles from './CheckoutPage.module.css'

// NO LEAFLET here — map only used in Chat & Orders pages
// Checkout uses preset list + custom text input for meetup

const PAYMENT_METHODS = [
  {
    id: 'transfer_escrow',
    label: '🏦 Transfer Escrow',
    desc: 'Transfer ke rekening admin — dana aman di escrow',
    detail: 'Admin verifikasi → dana ditahan → penjual proses → kamu konfirmasi terima → dana cair ke penjual.',
    color: '#2563EB', bg: '#DBEAFE',
  },
  {
    id: 'cod',
    label: '🤝 COD — Bayar di Tempat',
    desc: 'Bayar langsung ke penjual saat bertemu',
    detail: 'Bertemu di titik temu → cek barang → bayar → penjual konfirmasi → komisi 2% tercatat.',
    color: '#059669', bg: '#D1FAE5',
  },
]

export default function CheckoutPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { allProducts } = useProducts()
  const { createOrder, isProductSold } = useOrders()
  const navigate = useNavigate()

  const product = allProducts.find(p => p.id === id)
  const sold = product ? isProductSold(product.id) : false

  const [step, setStep]              = useState(1)
  const [order, setOrder]            = useState(null)
  const [payMethod, setPayMethod]    = useState('transfer_escrow')
  const [selectedPreset, setSelected] = useState(null)
  const [customLocation, setCustom]  = useState('')

  const meetupDisplayName = selectedPreset
    ? `${selectedPreset.icon} ${selectedPreset.name}`
    : customLocation.trim() || null

  const meetupPointData = selectedPreset
    ? JSON.stringify({ lat: selectedPreset.lat, lng: selectedPreset.lng, name: selectedPreset.name })
    : customLocation.trim() || null

  const handleOrder = async () => {
    try {
      const newOrder = await createOrder({
        buyerId: user.id, buyerName: user.name,
        sellerId: product.sellerId,
        productId: product.id, productTitle: product.title,
        price: product.price,
        meetupPoint: meetupPointData,
        paymentMethod: payMethod,
      })
      setOrder(newOrder)
      setStep(4)
    } catch (err) {
      alert('Gagal membuat pesanan: ' + (err.message || 'Coba lagi'))
    }
  }

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (!user) return (
    <div className={styles.center}>
      <div className={styles.centerIcon}>🔐</div>
      <h2>Login dulu yuk!</h2>
      <Link to="/auth" state={{ mode: 'login', from: `/checkout/${id}` }} className={styles.btnPrimary}>
        Login Sekarang
      </Link>
    </div>
  )

  if (user.role === 'seller') return (
    <div className={styles.center}>
      <div className={styles.centerIcon}>🚫</div>
      <h2>Akun Penjual</h2>
      <p>Akun penjual tidak bisa melakukan pembelian.</p>
      <Link to={`/product/${id}`} className={styles.btnOutline}>← Kembali</Link>
    </div>
  )

  if (user.verificationStatus === 'rejected') return (
    <div className={styles.center}>
      <div className={styles.centerIcon}>🔒</div>
      <h2>Akun Dibatasi</h2>
      <p>Verifikasi identitasmu ditolak.</p>
      <Link to="/auth" state={{ mode: 'reverify' }} className={styles.btnPrimary}>🔄 Verifikasi Ulang</Link>
    </div>
  )

  if (!product) return (
    <div className={styles.center}>
      <div className={styles.centerIcon}>😕</div>
      <h2>Produk tidak ditemukan</h2>
      <Link to="/browse" className={styles.btnPrimary}>← Browse</Link>
    </div>
  )

  if (product.sellerId === user.id) return (
    <div className={styles.center}>
      <div className={styles.centerIcon}>🚫</div>
      <h2>Ini barang kamu sendiri!</h2>
      <Link to={`/product/${id}`} className={styles.btnOutline}>← Kembali</Link>
    </div>
  )

  if (sold) return (
    <div className={styles.center}>
      <div className={styles.centerIcon}>🔴</div>
      <h2>Barang Sudah Terjual</h2>
      <Link to="/browse" className={styles.btnPrimary}>🛍️ Cari Barang Lain</Link>
    </div>
  )

  const selectedPayMethod = PAYMENT_METHODS.find(m => m.id === payMethod)
  const discount = product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0

  // ── Step 4: Sukses ─────────────────────────────────────────────────────────
  if (step === 4 && order) {
    const isEscrow = payMethod === 'transfer_escrow'
    return (
      <div className={styles.page}>
        <div className="container">
          <div className={styles.successCard}>
            <div className={styles.successIcon}>{isEscrow ? '🎉' : '🤝'}</div>
            <h2>Pesanan Berhasil Dibuat!</h2>
            <p>{isEscrow
              ? 'Selesaikan transfer ke rekening Escrow Preloved.'
              : 'Hubungi penjual lewat chat untuk atur jadwal COD.'
            }</p>

            <div className={styles.orderSummary}>
              <div className={styles.orderRow}>
                <span>ID Pesanan</span>
                <strong className={styles.orderId}>#{order.orderId?.slice(-8).toUpperCase()}</strong>
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
                <span>Metode</span>
                <strong>{selectedPayMethod?.label}</strong>
              </div>
              {meetupDisplayName && (
                <div className={styles.orderRow}>
                  <span>Titik Temu</span>
                  <strong>📍 {meetupDisplayName}</strong>
                </div>
              )}
            </div>

            {isEscrow ? (
              <div className={styles.payInfo}>
                <h4>📋 Instruksi Transfer Escrow</h4>
                <div className={styles.bankInfo}>
                  <div>🏦 BCA: <strong>1234-5678-90</strong> a.n. Preloved Escrow</div>
                  <div>💚 GoPay: <strong>0812-3456-7890</strong></div>
                </div>
                <p className={styles.payNote}>
                  Cantumkan ID <strong>#{order.orderId?.slice(-8).toUpperCase()}</strong> pada keterangan.
                  Admin validasi dalam 1×24 jam.
                </p>
              </div>
            ) : (
              <div className={styles.payInfo} style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <h4 style={{ color: '#065f46' }}>🤝 Instruksi COD</h4>
                <div className={styles.bankInfo} style={{ borderColor: '#bbf7d0' }}>
                  <div>1️⃣ Chat penjual untuk konfirmasi jadwal</div>
                  <div>2️⃣ Datang ke: <strong>{meetupDisplayName || 'titik temu yang disepakati'}</strong></div>
                  <div>3️⃣ Cek barang, bayar langsung ke penjual</div>
                  <div>4️⃣ Penjual klik "COD Selesai" di aplikasi</div>
                </div>
              </div>
            )}

            <div className={styles.successActions}>
              <Link to="/orders" className={styles.btnPrimary}>📋 Lihat Pesanan</Link>
              <Link to="/chat" className={styles.btnOutline}>💬 Chat Penjual</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Steps 1-3 ──────────────────────────────────────────────────────────────
  const STEPS = ['Titik Temu', 'Metode Bayar', 'Konfirmasi']

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.breadcrumb}>
          <Link to="/">Home</Link> › <Link to="/browse">Browse</Link> ›{' '}
          <Link to={`/product/${id}`}>{product.title}</Link> › <span>Checkout</span>
        </div>
        <h1 className={styles.pageTitle}>🛒 Checkout</h1>

        {/* Step bar */}
        <div className={styles.steps}>
          {STEPS.map((s, i) => (
            <div key={s} className={`${styles.step} ${step > i+1 ? styles.stepDone : step === i+1 ? styles.stepActive : ''}`}>
              <div className={styles.stepNum}>{step > i+1 ? '✓' : i+1}</div>
              <span>{s}</span>
            </div>
          ))}
        </div>

        <div className={styles.layout}>
          <div className={styles.formCol}>

            {/* ── STEP 1: Titik Temu ──────────────────────────────────── */}
            {step === 1 && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>📍 Pilih Titik Temu</h3>
                <p className={styles.cardDesc}>Pilih lokasi untuk bertemu penjual (COD)</p>

                {/* Preset locations */}
                <div className={styles.meetupList}>
                  {meetupPoints.map(mp => (
                    <button
                      key={mp.id}
                      className={`${styles.meetupBtn} ${selectedPreset?.id === mp.id ? styles.meetupBtnActive : ''}`}
                      onClick={() => { setSelected(selectedPreset?.id === mp.id ? null : mp); setCustom('') }}
                    >
                      <span className={styles.meetupIcon}>{mp.icon}</span>
                      <div>
                        <div className={styles.meetupName}>{mp.name}</div>
                        <div className={styles.meetupDesc}>{mp.description}</div>
                      </div>
                      {selectedPreset?.id === mp.id && <span className={styles.meetupCheck}>✓</span>}
                    </button>
                  ))}
                </div>

                {/* Custom location input */}
                <div style={{ marginTop: 16, marginBottom: 20 }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                    📝 Atau ketik lokasi sendiri (opsional):
                  </label>
                  <input
                    type="text"
                    value={customLocation}
                    onChange={e => { setCustom(e.target.value); if (e.target.value) setSelected(null) }}
                    placeholder="Misal: Indomaret Jl. Sudirman No.5, Bandung"
                    style={{
                      width: '100%', padding: '11px 14px',
                      border: '2px solid #e5e7eb', borderRadius: 12,
                      fontSize: '0.9rem', fontFamily: 'Poppins,sans-serif',
                      outline: 'none', boxSizing: 'border-box',
                      borderColor: customLocation ? '#7C3AED' : '#e5e7eb',
                    }}
                  />
                </div>

                {meetupDisplayName && (
                  <div style={{
                    background: '#eff6ff', border: '1px solid #bfdbfe',
                    borderRadius: 10, padding: '10px 14px',
                    fontSize: '0.85rem', color: '#1d4ed8',
                    fontWeight: 600, marginBottom: 16,
                  }}>
                    📍 Dipilih: {meetupDisplayName}
                  </div>
                )}

                <div className={styles.stepActions}>
                  <button className={styles.btnPrimary} onClick={() => setStep(2)}>
                    Lanjut ke Pembayaran →
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2: Metode Pembayaran ─────────────────────────────── */}
            {step === 2 && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>💳 Metode Pembayaran</h3>
                <p className={styles.cardDesc}>Pilih cara bayar yang sesuai</p>

                <div className={styles.payMethods}>
                  {PAYMENT_METHODS.map(pm => (
                    <button
                      key={pm.id}
                      className={`${styles.payBtn} ${payMethod === pm.id ? styles.payBtnActive : ''}`}
                      onClick={() => setPayMethod(pm.id)}
                      style={payMethod === pm.id ? { borderColor: pm.color, background: pm.bg } : {}}
                    >
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div className={styles.payLabel}>{pm.label}</div>
                        <div className={styles.payDesc}>{pm.desc}</div>
                      </div>
                      {payMethod === pm.id && <span className={styles.payCheck}>✓</span>}
                    </button>
                  ))}
                </div>

                {selectedPayMethod && (
                  <div className={styles.escrowNote} style={{
                    background: selectedPayMethod.bg,
                    borderColor: selectedPayMethod.color + '60',
                    color: selectedPayMethod.color,
                  }}>
                    ℹ️ {selectedPayMethod.detail}
                  </div>
                )}

                <div className={styles.stepActions}>
                  <button className={styles.btnOutline} onClick={() => setStep(1)}>← Kembali</button>
                  <button className={styles.btnPrimary} onClick={() => setStep(3)}>Konfirmasi →</button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Konfirmasi ────────────────────────────────────── */}
            {step === 3 && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>✅ Konfirmasi Pesanan</h3>
                <p className={styles.cardDesc}>Periksa kembali sebelum melanjutkan</p>

                <div className={styles.confirmDetails}>
                  <div className={styles.confirmRow}>
                    <span className={styles.confirmLabel}>📦 Barang</span>
                    <strong className={styles.confirmVal}>{product.title}</strong>
                  </div>
                  <div className={styles.confirmRow}>
                    <span className={styles.confirmLabel}>💰 Harga</span>
                    <strong className={styles.confirmVal} style={{ color: '#7C3AED' }}>
                      Rp {product.price.toLocaleString('id-ID')}
                    </strong>
                  </div>
                  <div className={styles.confirmRow}>
                    <span className={styles.confirmLabel}>📍 Titik Temu</span>
                    <strong className={styles.confirmVal}>
                      {meetupDisplayName || <em style={{ color: '#9ca3af' }}>Tidak dipilih</em>}
                    </strong>
                  </div>
                  <div className={styles.confirmRow}>
                    <span className={styles.confirmLabel}>💳 Metode</span>
                    <strong className={styles.confirmVal}>{selectedPayMethod?.label}</strong>
                  </div>
                </div>

                {/* Alur penjelasan */}
                {payMethod === 'transfer_escrow' ? (
                  <div className={styles.escrowExplain}>
                    <div className={styles.escrowExplainTitle}>🔒 Alur Escrow</div>
                    {['Transfer ke rekening admin Preloved','Admin verifikasi → dana ditahan escrow','Penjual proses & antar barang ke titik temu','Kamu konfirmasi terima → dana cair ke penjual'].map((s,i) => (
                      <div key={i} className={styles.escrowStep}>
                        <span className={styles.escrowStepNum}>{i+1}</span><span>{s}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.escrowExplain} style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                    <div className={styles.escrowExplainTitle} style={{ color: '#065f46' }}>🤝 Alur COD</div>
                    {['Penjual terima dan konfirmasi pesanan','Chat untuk atur jadwal ketemu','Cek barang, bayar langsung ke penjual','Penjual klik "COD Selesai" → komisi 2% tercatat'].map((s,i) => (
                      <div key={i} className={styles.escrowStep}>
                        <span className={styles.escrowStepNum} style={{ background: '#10B981' }}>{i+1}</span><span>{s}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className={styles.stepActions}>
                  <button className={styles.btnOutline} onClick={() => setStep(2)}>← Kembali</button>
                  <button className={styles.btnPrimary} onClick={handleOrder}>✅ Buat Pesanan</button>
                </div>
              </div>
            )}
          </div>

          {/* Right: summary */}
          <div className={styles.summaryCol}>
            <div className={styles.summaryCard}>
              <h3 className={styles.summaryTitle}>📋 Ringkasan</h3>
              <img
                src={product.images[0]} alt={product.title}
                className={styles.summaryImg}
                onError={e => { e.target.src = 'https://via.placeholder.com/300x200?text=No+Image' }}
              />
              <div className={styles.summaryInfo}>
                <h4>{product.title}</h4>
                <p className={styles.summaryCondition}>{product.condition}</p>
                {meetupDisplayName && <p className={styles.summaryMeetup}>📍 {meetupDisplayName}</p>}
                {payMethod && <p className={styles.summaryMeetup}>{selectedPayMethod?.label}</p>}
              </div>
              <div className={styles.summaryPrices}>
                <div className={styles.summaryRow}>
                  <span>Harga barang</span>
                  <span>Rp {product.price.toLocaleString('id-ID')}</span>
                </div>
                {discount > 0 && (
                  <div className={`${styles.summaryRow} ${styles.summaryDiscount}`}>
                    <span>Hemat</span><span>-{discount}%</span>
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
