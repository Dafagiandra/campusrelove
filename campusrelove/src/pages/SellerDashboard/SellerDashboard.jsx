import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProducts } from '../../context/ProductContext'
import { useOrders } from '../../context/OrderContext'
import styles from './SellerDashboard.module.css'

// ─── ID Verification ─────────────────────────────────────────────────────────
function KTMVerification({ onVerified }) {
  const [step, setStep] = useState(1) // 1=upload, 2=review, 3=done
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleFileChange = (e) => {
    const f = e.target.files[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { alert('File terlalu besar. Maksimal 5MB.'); return }
    setFile(f)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target.result)
    reader.readAsDataURL(f)
  }

  const handleSubmit = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setStep(3)
      onVerified()
    }, 1800)
  }

  if (step === 3) {
    return (
      <div className={styles.ktmSuccessCard}>
        <div className={styles.ktmSuccessIcon}>🎉</div>
        <div className={styles.ktmSuccessText}>
          <h3>Identitas Terverifikasi!</h3>
          <p>Akun kamu sudah terverifikasi. Kamu bisa mulai berjualan sekarang.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.ktmCard}>
      {/* Header */}
      <div className={styles.ktmCardHeader}>
        <div className={styles.ktmCardIcon}>🪪</div>
        <div className={styles.ktmCardTitle}>
          <h3>Verifikasi Identitas</h3>
          <p>Upload foto KTP/SIM/Paspor — hanya sekali</p>
        </div>
        <div className={styles.ktmStepIndicator}>
          {[1, 2].map(s => (
            <div key={s} className={`${styles.ktmDot} ${step >= s ? styles.ktmDotActive : ''}`} />
          ))}
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className={styles.ktmBody}>
          <label className={styles.ktmDropzone} htmlFor="ktm-file">
            {preview ? (
              <img src={preview} alt="ID Preview" className={styles.ktmPreviewImg} />
            ) : (
              <div className={styles.ktmDropzoneInner}>
                <span className={styles.ktmDropzoneIcon}>📷</span>
                <span className={styles.ktmDropzoneText}>Klik untuk pilih foto KTP/SIM/Paspor</span>
                <span className={styles.ktmDropzoneHint}>JPG / PNG · Maks 5MB</span>
              </div>
            )}
          </label>
          <input id="ktm-file" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />

          <div className={styles.ktmTipsList}>
            <span>✅ Foto jelas</span>
            <span>✅ Semua teks terbaca</span>
            <span>✅ Tidak terpotong</span>
          </div>

          <button
            className={styles.ktmBtn}
            onClick={() => file && setStep(2)}
            disabled={!file}
          >
            Lanjut Review →
          </button>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 2 && (
        <div className={styles.ktmBody}>
          <div className={styles.ktmReviewRow}>
            <img src={preview} alt="ID" className={styles.ktmReviewImg} />
            <div className={styles.ktmReviewMeta}>
              <div className={styles.ktmReviewFile}>
                <span>📄</span>
                <div>
                  <strong>{file?.name}</strong>
                  <span>{(file?.size / 1024).toFixed(0)} KB</span>
                </div>
              </div>
              <p className={styles.ktmReviewNote}>
                Pastikan foto identitas kamu jelas dan semua informasi terbaca sebelum submit.
              </p>
            </div>
          </div>
          <div className={styles.ktmReviewActions}>
            <button className={styles.ktmBtnOutline} onClick={() => setStep(1)}>← Ganti Foto</button>
            <button className={styles.ktmBtn} onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <span className={styles.ktmLoading}>
                  <span className={styles.ktmSpinner}></span> Memverifikasi...
                </span>
              ) : '✅ Submit Verifikasi'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Photo Upload Slot ────────────────────────────────────────────────────────
function PhotoSlot({ index, preview, onFileChange, onRemove }) {
  const inputRef = useRef(null)

  return (
    <div className={styles.photoSlotWrapper}>
      {preview ? (
        <div className={styles.photoSlotFilled}>
          <img src={preview} alt={`Foto ${index + 1}`} className={styles.photoSlotImg} />
          <button
            type="button"
            className={styles.photoRemoveBtn}
            onClick={() => onRemove(index)}
            title="Hapus foto"
          >
            ✕
          </button>
          {index === 0 && <span className={styles.photoMainBadge}>Utama</span>}
        </div>
      ) : (
        <label className={styles.photoSlotEmpty} htmlFor={`photo-input-${index}`}>
          <span className={styles.photoSlotIcon}>{index === 0 ? '📷' : '+'}</span>
          <span className={styles.photoSlotLabel}>{index === 0 ? 'Foto Utama *' : `Foto ${index + 1}`}</span>
          <input
            id={`photo-input-${index}`}
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => onFileChange(index, e.target.files[0])}
          />
        </label>
      )}
    </div>
  )
}

// ─── Upload Product Form ──────────────────────────────────────────────────────
function UploadProduct({ sellerId, sellerName }) {
  const { addProduct } = useProducts()
  const [form, setForm] = useState({
    title: '',
    category: '',
    price: '',
    originalPrice: '',
    condition: '',
    description: '',
    tags: '',
  })
  const [photoPreviews, setPhotoPreviews] = useState([null, null, null, null, null])
  const [photoDataURLs, setPhotoDataURLs] = useState([null, null, null, null, null])
  const [submitted, setSubmitted] = useState(null) // null | product object
  const [error, setError] = useState('')

  const conditionScoreMap = {
    'Bekas - Sangat Baik': 90,
    'Bekas - Baik': 78,
    'Bekas - Cukup': 58,
  }

  const handleChange = (e) => {
    setError('')
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleFileChange = (index, file) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError(`Foto ${index + 1} terlalu besar. Maksimal 5MB.`)
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataURL = ev.target.result
      setPhotoPreviews((prev) => {
        const next = [...prev]
        next[index] = dataURL
        return next
      })
      setPhotoDataURLs((prev) => {
        const next = [...prev]
        next[index] = dataURL
        return next
      })
    }
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = (index) => {
    setPhotoPreviews((prev) => { const n = [...prev]; n[index] = null; return n })
    setPhotoDataURLs((prev) => { const n = [...prev]; n[index] = null; return n })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    const images = photoDataURLs.filter(Boolean)
    if (images.length === 0) {
      setError('Upload minimal 1 foto barang!')
      return
    }
    if (!form.title || !form.category || !form.price || !form.condition) {
      setError('Lengkapi semua field yang wajib diisi!')
      return
    }

    const price = Number(form.price)
    const originalPrice = Number(form.originalPrice) || Math.round(price * 1.8)

    const newProduct = addProduct({
      title: form.title.trim(),
      category: form.category,
      price,
      originalPrice,
      condition: form.condition,
      conditionScore: conditionScoreMap[form.condition] || 75,
      description: form.description.trim(),
      images,
      sellerId,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : [form.category],
    })

    setSubmitted(newProduct)
  }

  const handleReset = () => {
    setForm({ title: '', category: '', price: '', originalPrice: '', condition: '', description: '', tags: '' })
    setPhotoPreviews([null, null, null, null, null])
    setPhotoDataURLs([null, null, null, null, null])
    setSubmitted(null)
    setError('')
  }

  if (submitted) {
    return (
      <div className={styles.uploadSuccess}>
        <div className={styles.uploadSuccessIcon}>🎉</div>
        <h3>Barang Berhasil Diupload!</h3>
        <p>
          <strong>{submitted.title}</strong> sudah aktif dan bisa dilihat oleh pembeli di Browse.
        </p>
        <div className={styles.uploadSuccessActions}>
          <Link to="/browse" className={styles.ktmBtn} style={{ textDecoration: 'none', display: 'inline-block', textAlign: 'center' }}>
            🛍️ Lihat di Browse
          </Link>
          <button className={styles.ktmBtnOutline} onClick={handleReset}>
            + Upload Barang Lagi
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className={styles.uploadForm} onSubmit={handleSubmit}>
      <h2 className={styles.formTitle}>📦 Upload Barang Baru</h2>

      {/* Photo Upload */}
      <div className={styles.formFieldFull}>
        <label className={styles.fieldLabel}>📷 Foto Barang <span className={styles.required}>*</span></label>
        <div className={styles.photoGrid}>
          {photoPreviews.map((preview, i) => (
            <PhotoSlot
              key={i}
              index={i}
              preview={preview}
              onFileChange={handleFileChange}
              onRemove={handleRemovePhoto}
            />
          ))}
        </div>
        <p className={styles.photoHint}>
          Upload minimal 1 foto, maksimal 5 foto. Format JPG/PNG, max 5MB per foto.
          Foto pertama akan jadi foto utama.
        </p>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Nama Barang <span className={styles.required}>*</span></label>
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="Contoh: Lemari 2 Pintu Kayu Jati"
            required
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Kategori <span className={styles.required}>*</span></label>
          <select name="category" value={form.category} onChange={handleChange} required>
            <option value="">Pilih kategori...</option>
            <option value="furniture">🪑 Furniture</option>
            <option value="electronic">💻 Electronic</option>
            <option value="academic">📚 Academic Supplies</option>
          </select>
        </div>

        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Harga Jual (Rp) <span className={styles.required}>*</span></label>
          <input
            name="price"
            type="number"
            min="1000"
            value={form.price}
            onChange={handleChange}
            placeholder="Contoh: 350000"
            required
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Harga Asli/Beli (Rp)</label>
          <input
            name="originalPrice"
            type="number"
            min="1000"
            value={form.originalPrice}
            onChange={handleChange}
            placeholder="Contoh: 800000 (opsional)"
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Kondisi Barang <span className={styles.required}>*</span></label>
          <select name="condition" value={form.condition} onChange={handleChange} required>
            <option value="">Pilih kondisi...</option>
            <option value="Bekas - Sangat Baik">⭐ Bekas - Sangat Baik (85-100%)</option>
            <option value="Bekas - Baik">👍 Bekas - Baik (70-84%)</option>
            <option value="Bekas - Cukup">✅ Bekas - Cukup (50-69%)</option>
          </select>
        </div>

        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Tags (pisah dengan koma)</label>
          <input
            name="tags"
            value={form.tags}
            onChange={handleChange}
            placeholder="Contoh: lemari, kayu, kos"
          />
        </div>

        <div className={`${styles.formField} ${styles.formFieldFull}`}>
          <label className={styles.fieldLabel}>Deskripsi <span className={styles.required}>*</span></label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Ceritakan kondisi barang secara detail: ukuran, warna, kelengkapan, alasan jual, dll..."
            rows={4}
            required
          />
        </div>
      </div>

      {error && <div className={styles.errorMsg}>⚠️ {error}</div>}

      <button type="submit" className={styles.submitBtn}>
        🚀 Upload Barang Sekarang
      </button>
    </form>
  )
}

// ─── My Listings ─────────────────────────────────────────────────────────────
function MyListings({ sellerId }) {
  const { getSellerProducts, deleteProduct } = useProducts()
  const myProducts = getSellerProducts(sellerId)
  const [confirmDelete, setConfirmDelete] = useState(null)

  if (myProducts.length === 0) {
    return (
      <div className={styles.listings}>
        <h2 className={styles.formTitle}>📋 Barang Saya</h2>
        <div className={styles.emptyListings}>
          <span>📦</span>
          <p>Belum ada barang yang diupload</p>
          <small>Upload barang pertamamu sekarang!</small>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.listings}>
      <h2 className={styles.formTitle}>📋 Barang Saya ({myProducts.length})</h2>
      <div className={styles.listingGrid}>
        {myProducts.map((p) => (
          <div key={p.id} className={styles.listingCard}>
            <img
              src={p.images[0]}
              alt={p.title}
              className={styles.listingImg}
              onError={(e) => { e.target.src = 'https://via.placeholder.com/80x60?text=No+Image' }}
            />
            <div className={styles.listingInfo}>
              <h4>{p.title}</h4>
              <p className={styles.listingPrice}>Rp {p.price.toLocaleString('id-ID')}</p>
              <div className={styles.listingMeta}>
                <span className={styles.listingViews}>👁 {p.views}</span>
                <span className={`${styles.listingStatus} ${p.isAlmostSold ? styles.statusAlmost : styles.statusActive}`}>
                  {p.isAlmostSold ? '⚡ Hampir Habis' : '✅ Aktif'}
                </span>
                {p.isNew && <span className={styles.statusNew}>✨ Baru</span>}
              </div>
            </div>
            <div className={styles.listingActions}>
              <Link to={`/product/${p.id}`} className={styles.listingView}>👁 Lihat</Link>
              {/* Only allow delete for user-uploaded products */}
              {p.id.startsWith('up_') && (
                confirmDelete === p.id ? (
                  <div className={styles.confirmDelete}>
                    <span>Hapus?</span>
                    <button className={styles.confirmYes} onClick={() => { deleteProduct(p.id); setConfirmDelete(null) }}>Ya</button>
                    <button className={styles.confirmNo} onClick={() => setConfirmDelete(null)}>Tidak</button>
                  </div>
                ) : (
                  <button className={styles.listingDelete} onClick={() => setConfirmDelete(p.id)}>🗑️</button>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function SellerDashboard() {
  const { user, updateProfile } = useAuth()
  const { getSellerProducts } = useProducts()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('upload')

  if (!user) {
    return (
      <div className={styles.accessDenied}>
        <div className={styles.accessIcon}>🔐</div>
        <h2>Kamu belum login</h2>
        <p>Login dulu untuk mengakses dashboard penjual</p>
        <button className={styles.ktmBtn} onClick={() => navigate('/auth', { state: { mode: 'login' } })}>
          Login Sekarang
        </button>
      </div>
    )
  }

  if (user.role !== 'seller') {
    return (
      <div className={styles.accessDenied}>
        <div className={styles.accessIcon}>🚫</div>
        <h2>Akses Ditolak</h2>
        <p>Dashboard ini hanya untuk penjual. Daftar sebagai penjual untuk mengakses fitur ini.</p>
        <button className={styles.ktmBtn} onClick={() => navigate('/auth', { state: { mode: 'register' } })}>
          Daftar sebagai Penjual
        </button>
      </div>
    )
  }

  // Baca verified langsung dari localStorage agar tidak reset saat navigasi
  const isVerified = (() => {
    if (user.verified) return true
    try {
      const users = JSON.parse(localStorage.getItem('cr_users') || '[]')
      const found = users.find(u => u.id === user.id)
      return found?.verified || false
    } catch { return false }
  })()

  const handleVerified = () => {
    // Simpan verified ke localStorage dan update session
    updateProfile({ verified: true })
  }

  const seller = {
    ...user,
    rating: user.rating || 0,
    totalSales: user.totalSales || 0,
    reviews: user.reviews || [],
  }

  const myProducts = getSellerProducts(user.id)
  const totalViews = myProducts.reduce((sum, p) => sum + (p.views || 0), 0)

  // Baca saldo & totalSales terbaru langsung dari localStorage
  // (karena confirmDelivery update localStorage, bukan React state)
  const freshSellerData = (() => {
    try {
      const users = JSON.parse(localStorage.getItem('cr_users') || '[]')
      return users.find(u => u.id === user.id) || {}
    } catch { return {} }
  })()
  const sellerBalance   = freshSellerData.balance    || 0
  const sellerTotalSales = freshSellerData.totalSales || 0

  // Riwayat pendapatan dari orders yang completed milik seller ini
  const { getOrdersBySeller } = useOrders()
  const myOrders       = getOrdersBySeller(user.id)
  const completedOrders = myOrders.filter(o => o.status === 'completed')
  const pendingEarnings = myOrders
    .filter(o => ['paid', 'processing', 'shipped'].includes(o.status))
    .reduce((sum, o) => sum + (o.sellerAmount ?? o.price), 0)

  const tabs = [
    { id: 'upload',   label: '📦 Upload Barang' },
    { id: 'listings', label: `📋 Barang Saya (${myProducts.length})` },
    { id: 'saldo',    label: `💰 Saldo${sellerBalance > 0 ? ` (${(sellerBalance/1000).toFixed(0)}K)` : ''}` },
    { id: 'stats',    label: '📊 Statistik' },
  ]

  return (
    <div className={styles.page}>
      <div className="container">
        {/* Profile Header */}
        <div className={styles.profileHeader}>
          <img
            src={seller.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${seller.name}`}
            alt={seller.name}
            className={styles.profileAvatar}
          />
          <div className={styles.profileInfo}>
            <div className={styles.profileNameRow}>
              <h1 className={styles.profileName}>{seller.name}</h1>
              {isVerified ? (
                <span className={styles.verifiedBadge}>✓ Terverifikasi</span>
              ) : (
                <span className={styles.unverifiedBadge}>⚠️ Belum Terverifikasi</span>
              )}
            </div>
            <p className={styles.profileUni}>
              {seller.faculty && `${seller.faculty} · `}
              {seller.city || seller.university || ''}
              {seller.phone && ` · ${seller.phone}`}
            </p>
            <div className={styles.profileStats}>
              <div className={styles.profileStat}>
                <span className={styles.profileStatNum}>⭐ {seller.rating || '–'}</span>
                <span>Rating</span>
              </div>
              <div className={styles.profileStat}>
                <span className={styles.profileStatNum}>{myProducts.length}</span>
                <span>Listing</span>
              </div>
              <div className={styles.profileStat}>
                <span className={styles.profileStatNum}>{sellerTotalSales}</span>
                <span>Terjual</span>
              </div>
              <div className={styles.profileStat}>
                <span className={styles.profileStatNum}>{totalViews}</span>
                <span>Views</span>
              </div>
            </div>

            {/* Saldo highlight di header */}
            <div className={styles.balanceChip}>
              <span className={styles.balanceChipIcon}>💰</span>
              <div>
                <span className={styles.balanceChipLabel}>Saldo Kamu</span>
                <span className={styles.balanceChipValue}>Rp {sellerBalance.toLocaleString('id-ID')}</span>
              </div>
              {pendingEarnings > 0 && (
                <div className={styles.balancePending}>
                  <span>+Rp {pendingEarnings.toLocaleString('id-ID')}</span>
                  <span className={styles.balancePendingLabel}>menunggu</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* KTM Verification — hanya tampil jika belum verified */}
        {!isVerified && (
          <KTMVerification onVerified={handleVerified} />
        )}

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

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {activeTab === 'upload' && (
            <UploadProduct sellerId={user.id} sellerName={user.name} />
          )}
          {activeTab === 'listings' && (
            <MyListings sellerId={user.id} />
          )}
          {activeTab === 'saldo' && (
            <div className={styles.saldoTab}>
              {/* Saldo cards */}
              <div className={styles.saldoCards}>
                <div className={styles.saldoCard} style={{ '--c': '#10B981' }}>
                  <div className={styles.saldoCardIcon}>💰</div>
                  <div className={styles.saldoCardInfo}>
                    <span className={styles.saldoCardLabel}>Saldo Tersedia</span>
                    <strong className={styles.saldoCardValue}>Rp {sellerBalance.toLocaleString('id-ID')}</strong>
                    <span className={styles.saldoCardSub}>Siap ditarik</span>
                  </div>
                </div>
                <div className={styles.saldoCard} style={{ '--c': '#F59E0B' }}>
                  <div className={styles.saldoCardIcon}>⏳</div>
                  <div className={styles.saldoCardInfo}>
                    <span className={styles.saldoCardLabel}>Menunggu Cair</span>
                    <strong className={styles.saldoCardValue}>Rp {pendingEarnings.toLocaleString('id-ID')}</strong>
                    <span className={styles.saldoCardSub}>Dari {myOrders.filter(o => ['paid','processing','shipped'].includes(o.status)).length} pesanan aktif</span>
                  </div>
                </div>
                <div className={styles.saldoCard} style={{ '--c': '#7C3AED' }}>
                  <div className={styles.saldoCardIcon}>📊</div>
                  <div className={styles.saldoCardInfo}>
                    <span className={styles.saldoCardLabel}>Total Terjual</span>
                    <strong className={styles.saldoCardValue}>{sellerTotalSales} barang</strong>
                    <span className={styles.saldoCardSub}>{completedOrders.length} transaksi selesai</span>
                  </div>
                </div>
              </div>

              {/* Riwayat pendapatan */}
              <h3 className={styles.saldoHistTitle}>📜 Riwayat Pendapatan</h3>
              {completedOrders.length === 0 ? (
                <div className={styles.saldoEmpty}>
                  <span>💸</span>
                  <p>Belum ada pendapatan</p>
                  <small>Pendapatan akan muncul setelah pembeli konfirmasi pesanan selesai</small>
                </div>
              ) : (
                <div className={styles.saldoHistory}>
                  {completedOrders
                    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
                    .map(o => {
                      const feePercent  = o.platformFeePercent ?? 2
                      const platformFee = o.platformFee  ?? Math.round(o.price * feePercent / 100)
                      const received    = o.sellerAmount ?? (o.price - platformFee)
                      return (
                        <div key={o.orderId} className={styles.saldoHistRow}>
                          <div className={styles.saldoHistIcon}>✅</div>
                          <div className={styles.saldoHistInfo}>
                            <strong>{o.productTitle}</strong>
                            <span>Pembeli: {o.buyerName}</span>
                            <span className={styles.saldoHistDate}>
                              {new Date(o.completedAt).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                            </span>
                          </div>
                          <div className={styles.saldoHistRight}>
                            <span className={styles.saldoHistAmount}>+Rp {received.toLocaleString('id-ID')}</span>
                            <span className={styles.saldoHistFee}>
                              Harga Rp {o.price.toLocaleString('id-ID')} − komisi {feePercent}%
                            </span>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}

              {/* Pending orders */}
              {myOrders.filter(o => ['paid','processing','shipped'].includes(o.status)).length > 0 && (
                <>
                  <h3 className={styles.saldoHistTitle} style={{ marginTop: 28 }}>⏳ Sedang Diproses</h3>
                  <div className={styles.saldoHistory}>
                    {myOrders
                      .filter(o => ['paid','processing','shipped'].includes(o.status))
                      .map(o => {
                        const feePercent  = o.platformFeePercent ?? 2
                        const platformFee = o.platformFee  ?? Math.round(o.price * feePercent / 100)
                        const willReceive = o.sellerAmount ?? (o.price - platformFee)
                        const statusLabel = { paid: '✅ Dibayar', processing: '📦 Diproses', shipped: '🚚 Dikirim' }
                        return (
                          <div key={o.orderId} className={`${styles.saldoHistRow} ${styles.saldoHistPending}`}>
                            <div className={styles.saldoHistIcon}>⏳</div>
                            <div className={styles.saldoHistInfo}>
                              <strong>{o.productTitle}</strong>
                              <span>Pembeli: {o.buyerName}</span>
                              <span className={styles.saldoHistStatus}>{statusLabel[o.status]}</span>
                            </div>
                            <div className={styles.saldoHistRight}>
                              <span className={styles.saldoHistAmountPending}>+Rp {willReceive.toLocaleString('id-ID')}</span>
                              <span className={styles.saldoHistFee}>Menunggu konfirmasi pembeli</span>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </>
              )}
            </div>
          )}
          {activeTab === 'stats' && (
            <div className={styles.statsGrid}>
              {[
                { icon: '💰', label: 'Total Pendapatan', value: `Rp ${sellerBalance.toLocaleString('id-ID')}`, color: '#10B981' },
                { icon: '👁',  label: 'Total Views',     value: totalViews.toLocaleString('id-ID'),            color: '#7C3AED' },
                { icon: '📦',  label: 'Barang Aktif',    value: myProducts.length,                             color: '#2563EB' },
                { icon: '🎉',  label: 'Terjual',         value: sellerTotalSales,                              color: '#F59E0B' },
              ].map((stat) => (
                <div key={stat.label} className={styles.statCard} style={{ '--color': stat.color }}>
                  <div className={styles.statIcon}>{stat.icon}</div>
                  <div className={styles.statValue}>{stat.value}</div>
                  <div className={styles.statLabel}>{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
