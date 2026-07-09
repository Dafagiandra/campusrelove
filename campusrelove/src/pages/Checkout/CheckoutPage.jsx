import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProducts } from '../../context/ProductContext'
import { useOrders } from '../../context/OrderContext'
import { meetupPoints } from '../../data/products'
import styles from './CheckoutPage.module.css'

// ── Transfer Escrow Instructions + Proof Upload (Bagian 4) ───────────────────
function TransferEscrowInstructions({ orderId, price }) {
  const [proofFile, setProofFile]     = useState(null)
  const [proofPreview, setProofPreview] = useState(null)
  const [submitted, setSubmitted]     = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const shortId = orderId?.slice(-8).toUpperCase()

  const handleFileChange = (e) => {
    const f = e.target.files[0]; if (!f) return
    setProofFile(f)
    const reader = new FileReader()
    reader.onload = ev => setProofPreview(ev.target.result)
    reader.readAsDataURL(f)
  }

  const handleSubmitProof = async () => {
    setSubmitting(true)
    const proofs = JSON.parse(localStorage.getItem('cr_transfer_proofs') || '[]')
    proofs.push({ orderId, shortId, proof: proofPreview, submittedAt: new Date().toISOString() })
    localStorage.setItem('cr_transfer_proofs', JSON.stringify(proofs))
    await new Promise(r => setTimeout(r, 800))
    setSubmitted(true); setSubmitting(false)
  }

  if (submitted) return (
    <div className={styles.payInfo} style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
      <h4 style={{ color: '#065f46' }}>✅ Bukti Transfer Dikirim!</h4>
      <p style={{ fontSize: '0.85rem', color: '#047857' }}>
        Admin akan memverifikasi dalam <strong>1×24 jam</strong>. Setelah diverifikasi, status pesanan berubah jadi "Dibayar" dan escrow aktif.
      </p>
    </div>
  )

  return (
    <div className={styles.payInfo}>
      <h4>📋 Instruksi Transfer Escrow</h4>
      <div style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
        <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 4 }}>Transfer sejumlah:</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#7C3AED', marginBottom: 10 }}>
          Rp {price.toLocaleString('id-ID')}
        </div>
        <div className={styles.bankInfo}>
          <div>🏦 <strong>BCA</strong> — 1234-5678-90 a.n. Admin Preloved</div>
          <div>💚 <strong>GoPay</strong> — 0812-3456-7890</div>
          <div>💜 <strong>OVO</strong> — 0812-3456-7890</div>
          <div>💙 <strong>DANA</strong> — 0812-3456-7890</div>
        </div>
        <div style={{ marginTop: 10, background: '#fef3c7', borderRadius: 8, padding: '8px 12px', fontSize: '0.78rem', color: '#92400e' }}>
          ⚠️ Wajib cantumkan kode <strong>#{shortId}</strong> pada keterangan transfer
        </div>
      </div>

      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 8 }}>📸 Upload Bukti Transfer</div>
      <div style={{ border: `2px dashed ${proofPreview ? '#10B981' : '#d1d5db'}`, borderRadius: 10, padding: 16, textAlign: 'center', cursor: 'pointer', background: proofPreview ? '#f0fdf4' : '#fafafa' }}
        onClick={() => document.getElementById('proof-upload').click()}>
        {proofPreview
          ? <img src={proofPreview} alt="Bukti" style={{ maxHeight: 140, borderRadius: 8, objectFit: 'contain' }} />
          : <><div style={{ fontSize: '1.8rem', marginBottom: 6 }}>📷</div><div style={{ fontSize: '0.82rem', color: '#6b7280' }}>Klik untuk upload screenshot bukti transfer</div></>
        }
      </div>
      <input id="proof-upload" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />

      <button onClick={handleSubmitProof} disabled={!proofFile || submitting}
        style={{ marginTop: 14, width: '100%', padding: '12px', background: proofFile ? 'linear-gradient(135deg,#7C3AED,#2563EB)' : '#e5e7eb', color: proofFile ? 'white' : '#9ca3af', border: 'none', borderRadius: 12, fontSize: '0.92rem', fontWeight: 700, cursor: proofFile ? 'pointer' : 'not-allowed', fontFamily: 'Poppins,sans-serif' }}>
        {submitting ? '⏳ Mengirim...' : '📤 Kirim Bukti Transfer'}
      </button>
      <p className={styles.payNote} style={{ marginTop: 10 }}>
        Status pesanan: <strong>⏳ Menunggu Verifikasi Admin</strong> — Admin validasi dalam 1×24 jam.
      </p>
    </div>
  )
}

const PAYMENT_METHODS = [
  {
    id: 'transfer_escrow',
    label: '🏦 Transfer Escrow',
    desc: 'Transfer ke rekening admin — dana aman di escrow',
    detail: 'Admin verifikasi → dana ditahan → penjual proses → kamu konfirmasi terima → dana cair ke penjual.',
    color: '#2563EB', bg: '#DBEAFE',
    isProtected: true,
  },
  {
    id: 'cod_escrow',
    label: '🤝 COD + Bayar via Aplikasi',
    desc: 'Ketemu penjual, bayar lewat sistem (escrow)',
    detail: 'Bertemu → cek barang → konfirmasi terima di aplikasi → dana yang sudah ditahan cair ke penjual.',
    color: '#059669', bg: '#D1FAE5',
    isProtected: true,
  },
  {
    id: 'cod_cash',
    label: '💵 COD + Bayar Cash Langsung',
    desc: 'Ketemu penjual, bayar tunai langsung ke penjual',
    detail: 'Bertemu → cek barang → bayar tunai ke penjual. Transaksi TIDAK tercatat di sistem.',
    color: '#D97706', bg: '#FEF3C7',
    isProtected: false,
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
  const [specificLocation, setSpecific] = useState('')  // WAJIB diisi nama/alamat spesifik

  // meetupDisplayName — tampil di ringkasan
  const meetupDisplayName = selectedPreset && specificLocation.trim()
    ? `${selectedPreset.icon} ${selectedPreset.name} — ${specificLocation.trim()}`
    : selectedPreset
      ? `${selectedPreset.icon} ${selectedPreset.name}` // belum isi spesifik
      : specificLocation.trim() || null

  // meetupPointData — disimpan ke order
  const meetupPointData = selectedPreset
    ? JSON.stringify({ lat: selectedPreset.lat, lng: selectedPreset.lng, name: selectedPreset.name, specificLocation: specificLocation.trim(), fullName: `${selectedPreset.name}${specificLocation.trim() ? ' — ' + specificLocation.trim() : ''}` })
    : specificLocation.trim() ? specificLocation.trim() : null

  // Step 1 bisa lanjut hanya jika kategori & lokasi spesifik sudah diisi
  const canProceedStep1 = selectedPreset && specificLocation.trim().length >= 3

  const handleOrder = async () => {
    try {
      const newOrder = await createOrder({
        buyerId: user.id, buyerName: user.name,
        sellerId: product.sellerId,
        productId: product.id, productTitle: product.title,
        price: product.price,
        meetupPoint: meetupPointData,
        paymentMethod: payMethod,
        // cod_cash = tidak tercatat di sistem (offline transaction)
        isOfflinePayment: payMethod === 'cod_cash',
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
  const discount = product.originalPrice && product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0

  // ── Step 4: Sukses ─────────────────────────────────────────────────────────
  if (step === 4 && order) {
    const isEscrow = payMethod === 'transfer_escrow' || payMethod === 'cod_escrow'
    const isCodCash = payMethod === 'cod_cash'
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

            {isEscrow && payMethod === 'transfer_escrow' ? (
              <TransferEscrowInstructions orderId={order.orderId} price={product.price} />
            ) : isEscrow && payMethod === 'cod_escrow' ? (
              <div>
                <TransferEscrowInstructions orderId={order.orderId} price={product.price} />
                <div className={styles.payInfo} style={{ background: '#f0fdf4', borderColor: '#bbf7d0', marginTop: 12 }}>
                  <h4 style={{ color: '#065f46' }}>🤝 Langkah Selanjutnya (COD + Escrow)</h4>
                  <div className={styles.bankInfo} style={{ borderColor: '#bbf7d0' }}>
                    <div>2️⃣ Chat penjual untuk atur jadwal ketemu</div>
                    <div>3️⃣ Datang ke: <strong>{meetupDisplayName || 'titik temu'}</strong></div>
                    <div>4️⃣ Cek barang → konfirmasi terima → dana cair ke penjual</div>
                  </div>
                  <p className={styles.payNote} style={{ color: '#059669' }}>✅ Dilindungi sistem. Bisa komplain jika barang tidak sesuai.</p>
                </div>
              </div>
            ) : (
              <div className={styles.payInfo} style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                <h4 style={{ color: '#92400e' }}>💵 Instruksi COD Cash Langsung</h4>
                <div className={styles.bankInfo} style={{ borderColor: '#fde68a' }}>
                  <div>1️⃣ Chat penjual untuk atur jadwal ketemu</div>
                  <div>2️⃣ Datang ke: <strong>{meetupDisplayName || 'titik temu yang disepakati'}</strong></div>
                  <div>3️⃣ Cek kondisi barang secara langsung</div>
                  <div>4️⃣ Bayar tunai langsung ke penjual jika setuju</div>
                </div>
                <p className={styles.payNote} style={{ color: '#92400e' }}>
                  ⚠️ Transaksi ini tidak melalui sistem — tidak ada perlindungan platform. Tidak bisa beri rating/ulasan.
                </p>
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
                <p className={styles.cardDesc}>Pilih kategori tempat, lalu isi nama/alamat spesifiknya</p>

                {/* Step 1a: Pilih kategori */}
                <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: 8 }}>
                  1. Pilih jenis tempat:
                </p>
                <div className={styles.meetupList}>
                  {meetupPoints.map(mp => (
                    <button
                      key={mp.id}
                      className={`${styles.meetupBtn} ${selectedPreset?.id === mp.id ? styles.meetupBtnActive : ''}`}
                      onClick={() => { setSelected(selectedPreset?.id === mp.id ? null : mp); setSpecific('') }}
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

                {/* Step 1b: Wajib isi nama spesifik */}
                {selectedPreset && (
                  <div style={{ marginTop: 18, marginBottom: 8 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                      2. Isi nama / alamat spesifik <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={specificLocation}
                      onChange={e => setSpecific(e.target.value)}
                      placeholder={`Contoh: ${selectedPreset.name === 'Mall Terdekat' ? 'Mall SKA Pekanbaru, lantai 1 pintu utara' : selectedPreset.name === 'Alfamart/Indomaret' ? 'Alfamart Jl. Sudirman No.5' : selectedPreset.name + ' (nama & alamat lengkap)'}`}
                      style={{
                        width: '100%', padding: '12px 14px',
                        border: `2px solid ${specificLocation.trim().length >= 3 ? '#10B981' : '#e5e7eb'}`,
                        borderRadius: 12, fontSize: '0.9rem',
                        fontFamily: 'Poppins,sans-serif', outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                    {specificLocation.trim().length > 0 && specificLocation.trim().length < 3 && (
                      <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: 4 }}>⚠️ Minimal 3 karakter</p>
                    )}
                    {specificLocation.trim().length >= 3 && (
                      <p style={{ fontSize: '0.75rem', color: '#10B981', marginTop: 4 }}>✅ Lokasi tercatat</p>
                    )}
                  </div>
                )}

                {/* Preview lokasi lengkap */}
                {canProceedStep1 && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', fontSize: '0.85rem', color: '#065f46', fontWeight: 600, marginBottom: 4 }}>
                    📍 {selectedPreset.icon} {selectedPreset.name} — {specificLocation.trim()}
                  </div>
                )}

                {!selectedPreset && (
                  <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '12px 0' }}>
                    👆 Pilih salah satu kategori tempat di atas terlebih dahulu
                  </p>
                )}

                <div className={styles.stepActions} style={{ marginTop: 16 }}>
                  <button
                    className={styles.btnPrimary}
                    onClick={() => setStep(2)}
                    disabled={!canProceedStep1}
                    style={{ opacity: canProceedStep1 ? 1 : 0.5, cursor: canProceedStep1 ? 'pointer' : 'not-allowed' }}
                  >
                    Lanjut ke Pembayaran →
                  </button>
                  {selectedPreset && !specificLocation.trim() && (
                    <p style={{ fontSize: '0.78rem', color: '#dc2626', margin: '6px 0 0' }}>
                      ⚠️ Wajib isi nama/alamat spesifik dulu
                    </p>
                  )}
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

                {/* Alur penjelasan + perbandingan proteksi */}
                {payMethod === 'transfer_escrow' && (
                  <div className={styles.escrowExplain}>
                    <div className={styles.escrowExplainTitle}>🔒 Alur Transfer Escrow</div>
                    {['Transfer ke rekening admin Preloved','Admin verifikasi → dana ditahan escrow','Penjual proses & kirim/antar barang','Kamu konfirmasi terima → dana cair ke penjual'].map((s,i) => (
                      <div key={i} className={styles.escrowStep}><span className={styles.escrowStepNum}>{i+1}</span><span>{s}</span></div>
                    ))}
                    <div style={{ marginTop: 10, padding: '8px 12px', background: '#dbeafe', borderRadius: 8, fontSize: '0.78rem', color: '#1d4ed8' }}>
                      ✅ <strong>Transaksi dilindungi platform.</strong> Dana kamu aman tertahan sampai barang diterima sesuai. Transaksi tercatat, kamu bisa beri rating/ulasan.
                    </div>
                  </div>
                )}

                {payMethod === 'cod_escrow' && (
                  <div className={styles.escrowExplain} style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                    <div className={styles.escrowExplainTitle} style={{ color: '#065f46' }}>🤝 Alur COD + Bayar via Aplikasi</div>
                    {['Konfirmasi pesanan & bayar lewat sistem','Chat penjual untuk atur jadwal ketemu','Bertemu, cek kondisi barang','Konfirmasi terima di aplikasi → dana cair ke penjual'].map((s,i) => (
                      <div key={i} className={styles.escrowStep}><span className={styles.escrowStepNum} style={{ background: '#10B981' }}>{i+1}</span><span>{s}</span></div>
                    ))}
                    <div style={{ marginTop: 10, padding: '8px 12px', background: '#d1fae5', borderRadius: 8, fontSize: '0.78rem', color: '#065f46' }}>
                      ✅ <strong>Transaksi dilindungi platform.</strong> Dana kamu aman tertahan sampai kamu konfirmasi barang sesuai. Transaksi tercatat, kamu bisa beri rating/ulasan.
                    </div>
                  </div>
                )}

                {payMethod === 'cod_cash' && (
                  <div className={styles.escrowExplain} style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                    <div className={styles.escrowExplainTitle} style={{ color: '#92400e' }}>💵 Alur COD + Bayar Cash Langsung</div>
                    {['Hubungi penjual via chat untuk atur ketemu','Bertemu di titik temu yang disepakati','Cek kondisi barang secara langsung','Bayar tunai langsung ke penjual jika setuju'].map((s,i) => (
                      <div key={i} className={styles.escrowStep}><span className={styles.escrowStepNum} style={{ background: '#D97706' }}>{i+1}</span><span>{s}</span></div>
                    ))}
                    <div style={{ marginTop: 10, padding: '10px 12px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, fontSize: '0.78rem', color: '#92400e' }}>
                      ⚠️ <strong>Transaksi ini tidak melalui sistem.</strong> Tidak ada perlindungan platform jika barang tidak sesuai atau bermasalah. Transaksi tidak tercatat secara resmi, sehingga <strong>tidak bisa memberi rating/ulasan</strong> dan tidak menambah jumlah transaksi sukses di profil penjual.
                    </div>
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
