import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProducts } from '../../context/ProductContext'
import { useOrders } from '../../context/OrderContext'
import { listingAPI, withdrawalAPI, isBackendAvailable } from '../../services/api'
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
    condition: '',
    description: '',
    tags: '',
  })
  const [photoPreviews, setPhotoPreviews] = useState([null, null, null, null, null])
  const [photoDataURLs, setPhotoDataURLs] = useState([null, null, null, null, null])
  const [submitted, setSubmitted] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  // Payment required state
  const [paymentRequired, setPaymentRequired] = useState(null) // { fee, duration, category }
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentSubmitted, setPaymentSubmitted] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)

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
      setPhotoPreviews((prev) => { const next = [...prev]; next[index] = dataURL; return next })
      setPhotoDataURLs((prev) => { const next = [...prev]; next[index] = dataURL; return next })
    }
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = (index) => {
    setPhotoPreviews((prev) => { const n = [...prev]; n[index] = null; return n })
    setPhotoDataURLs((prev) => { const n = [...prev]; n[index] = null; return n })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const images = photoDataURLs.filter(Boolean)
    if (images.length === 0) { setError('Upload minimal 1 foto barang!'); return }
    if (!form.title || !form.category || !form.price || !form.condition) {
      setError('Lengkapi semua field yang wajib diisi!'); return
    }

    const price = Number(form.price)

    setUploading(true)
    try {
      const newProduct = await addProduct({
        title: form.title.trim(),
        category: form.category,
        price,
        originalPrice: null, // tidak ada harga asli — harga jual langsung
        condition: form.condition,
        conditionScore: conditionScoreMap[form.condition] || 75,
        description: form.description.trim(),
        images,
        sellerId,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : [form.category],
      })
      setSubmitted(newProduct)
    } catch (err) {
      // err might be an object { requiresPayment: true } or an Error instance
      const needsPayment = err?.requiresPayment === true || err?.message?.includes('requiresPayment')
      if (needsPayment || (err?.fee && err?.category)) {
        // Butuh bayar listing dulu
        setPaymentRequired({ fee: err.fee, duration: err.duration || 30, category: err.category || form.category })
      } else {
        setError(err?.message || 'Gagal upload barang')
      }
    } finally {
      setUploading(false)
    }
  }

  // Ajukan pembayaran listing
  const handleSubmitPayment = async () => {
    if (!paymentRequired) return
    setPaymentLoading(true)
    try {
      await listingAPI.submitPayment({
        category: paymentRequired.category,
        notes: paymentNote || `Upload produk: ${form.title}`,
      })
      setPaymentSubmitted(true)
    } catch (err) {
      setError(err?.message || 'Gagal mengajukan pembayaran')
    } finally {
      setPaymentLoading(false)
    }
  }

  const handleReset = () => {
    setForm({ title: '', category: '', price: '', condition: '', description: '', tags: '' })
    setPhotoPreviews([null, null, null, null, null])
    setPhotoDataURLs([null, null, null, null, null])
    setSubmitted(null)
    setError('')
    setPaymentRequired(null)
    setPaymentSubmitted(false)
    setPaymentNote('')
  }

  // ── Tampilkan halaman setelah ajukan pembayaran ─────────────────────────────
  if (paymentRequired && paymentSubmitted) {
    return (
      <div className={styles.uploadSuccess}>
        <div className={styles.uploadSuccessIcon}>⏳</div>
        <h3>Pembayaran Listing Diajukan!</h3>
        <p>
          Admin akan memverifikasi pembayaran biaya listing kamu untuk kategori{' '}
          <strong>"{paymentRequired.category}"</strong> dalam 1×24 jam.
        </p>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '14px 18px', margin: '16px 0', fontSize: '0.85rem', color: '#1d4ed8', lineHeight: 1.6 }}>
          <strong>💡 Langkah selanjutnya:</strong><br/>
          1. Transfer Rp {paymentRequired.fee?.toLocaleString('id-ID')} ke rekening admin Preloved<br/>
          2. Cantumkan nama kamu sebagai keterangan<br/>
          3. Setelah dikonfirmasi, kamu bisa upload barang untuk kategori ini<br/>
          Listing akan aktif selama <strong>{paymentRequired.duration} hari</strong>.
        </div>
        <div className={styles.uploadSuccessActions}>
          <button className={styles.ktmBtn} onClick={handleReset}>
            ← Kembali ke Upload
          </button>
        </div>
      </div>
    )
  }

  // ── Tampilkan halaman pembayaran listing ────────────────────────────────────
  if (paymentRequired) {
    return (
      <div className={styles.uploadSuccess}>
        <div className={styles.uploadSuccessIcon}>💳</div>
        <h3>Biaya Listing Diperlukan</h3>
        <p>
          Untuk upload barang di kategori <strong>"{paymentRequired.category}"</strong>,
          kamu perlu membayar biaya listing.
        </p>

        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 14, padding: 18, margin: '16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>Biaya listing ({paymentRequired.category})</span>
            <strong style={{ color: '#7C3AED' }}>Rp {paymentRequired.fee?.toLocaleString('id-ID')}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>Masa tayang</span>
            <strong>{paymentRequired.duration} hari</strong>
          </div>
        </div>

        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 16px', fontSize: '0.82rem', color: '#92400e', marginBottom: 16 }}>
          🏦 <strong>Cara Bayar:</strong><br/>
          Transfer ke rekening admin Preloved:<br/>
          <strong>BCA: 1234-5678-90</strong> a.n. Admin Preloved<br/>
          <strong>GoPay/OVO/DANA: 0812-3456-7890</strong><br/>
          Cantumkan nama akun kamu sebagai keterangan transfer.
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
            📝 Catatan (opsional)
          </label>
          <input
            type="text"
            value={paymentNote}
            onChange={e => setPaymentNote(e.target.value)}
            placeholder="Misal: sudah transfer via BCA tanggal..."
            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: '0.88rem', fontFamily: 'Poppins,sans-serif', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {error && <div className={styles.errorMsg}>⚠️ {error}</div>}

        <div className={styles.uploadSuccessActions}>
          <button className={styles.ktmBtn} onClick={handleSubmitPayment} disabled={paymentLoading}>
            {paymentLoading ? '⏳ Mengajukan...' : '💳 Ajukan Pembayaran Listing'}
          </button>
          <button className={styles.ktmBtnOutline} onClick={() => setPaymentRequired(null)}>
            ← Kembali
          </button>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className={styles.uploadSuccess}>
        <div className={styles.uploadSuccessIcon}>🎉</div>
        <h3>Barang Berhasil Diupload!</h3>
        <p>
          <strong>{submitted.title}</strong> sudah aktif dan bisa dilihat oleh pembeli di Browse.
          {submitted.isFree && <span style={{ display: 'block', marginTop: 6, color: '#059669', fontSize: '0.82rem', fontWeight: 600 }}>✨ Listing gratis pertamamu digunakan!</span>}
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
            <option value="fashion">👕 Fashion</option>
            <option value="electronic">💻 Electronic</option>
            <option value="furniture">🪑 Furniture</option>
            <option value="hobi">🎮 Hobi</option>
            <option value="otomotif">🏍️ Otomotif</option>
            <option value="buku">📚 Buku & Alat Tulis</option>
            <option value="olahraga">⚽ Olahraga</option>
            <option value="kesehatan">🏥 Kesehatan & Kecantikan</option>
            <option value="dapur">🍳 Dapur & Perabot Rumah</option>
            <option value="bayi">👶 Perlengkapan Bayi</option>
            <option value="lainnya">📦 Lainnya</option>
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

      <button type="submit" className={styles.submitBtn} disabled={uploading}>
        {uploading ? '⏳ Mengupload...' : '🚀 Upload Barang Sekarang'}
      </button>
    </form>
  )
}

// ─── Withdrawal Tab ──────────────────────────────────────────────────────────
const MIN_WITHDRAWAL = 50000

function WithdrawalTab({ user }) {
  const [data, setData]           = useState(null) // { balance, withdrawals, hasPending, savedBank }
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({
    amount: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
    saveBank: true,
  })

  const load = async () => {
    setLoading(true)
    try {
      const res = await withdrawalAPI.getMy()
      if (res.success) {
        setData(res)
        // Pre-fill form jika ada rekening tersimpan
        if (res.savedBank) {
          setForm(f => ({ ...f, bankName: res.savedBank.bankName, accountNumber: res.savedBank.accountNumber, accountName: res.savedBank.accountName }))
        }
      }
    } catch { /* offline / no backend */ }
    finally { setLoading(false) }
  }

  useEffect(() => { if (isBackendAvailable()) load() }, []) // eslint-disable-line

  const balance    = data?.balance ?? user.balance ?? 0
  const hasPending = data?.hasPending ?? false

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const amt = Number(form.amount)
    if (!amt || amt < MIN_WITHDRAWAL) { setError(`Nominal minimum Rp ${MIN_WITHDRAWAL.toLocaleString('id-ID')}`); return }
    if (amt > balance) { setError('Nominal melebihi saldo tersedia'); return }
    if (!form.bankName.trim() || !form.accountNumber.trim() || !form.accountName.trim()) {
      setError('Lengkapi semua data rekening'); return
    }
    setSubmitting(true)
    try {
      const res = await withdrawalAPI.request({
        amount: amt,
        bankName: form.bankName.trim(),
        accountNumber: form.accountNumber.trim(),
        accountName: form.accountName.trim(),
        saveBank: form.saveBank,
      })
      if (res.success) {
        setSuccess(`✅ Pengajuan penarikan Rp ${amt.toLocaleString('id-ID')} berhasil diajukan! Admin akan memproses dalam 1×24 jam.`)
        setShowForm(false)
        setForm(f => ({ ...f, amount: '' }))
        load() // refresh data
      }
    } catch (err) {
      setError(err?.message || 'Gagal mengajukan penarikan')
    } finally {
      setSubmitting(false)
    }
  }

  const statusConfig = {
    pending:   { label: '⏳ Sedang Diproses', color: '#D97706', bg: '#FEF3C7' },
    completed: { label: '✅ Selesai',          color: '#059669', bg: '#D1FAE5' },
    rejected:  { label: '❌ Ditolak',          color: '#DC2626', bg: '#FEE2E2' },
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>⏳ Memuat data saldo...</div>
  )

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Saldo cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #bbf7d0', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, marginBottom: 4 }}>💰 Saldo Tersedia</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#065f46' }}>
            Rp {balance.toLocaleString('id-ID')}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 4 }}>Siap ditarik</div>
        </div>
        <div style={{ background: hasPending ? 'linear-gradient(135deg,#fffbeb,#fef3c7)' : '#f9fafb', border: `1px solid ${hasPending ? '#fde68a' : '#e5e7eb'}`, borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: '0.75rem', color: '#D97706', fontWeight: 600, marginBottom: 4 }}>⏳ Dalam Proses</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#92400e' }}>
            {hasPending
              ? `Rp ${(data?.withdrawals?.find(w => w.status === 'pending')?.amount || 0).toLocaleString('id-ID')}`
              : '—'
            }
          </div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 4 }}>
            {hasPending ? 'Sedang diverifikasi admin' : 'Tidak ada proses aktif'}
          </div>
        </div>
      </div>

      {/* Success message */}
      {success && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 16px', fontSize: '0.85rem', color: '#065f46', marginBottom: 16, fontWeight: 600 }}>
          {success}
        </div>
      )}

      {/* Tombol / form tarik saldo */}
      {!showForm ? (
        <div style={{ marginBottom: 24 }}>
          {balance < MIN_WITHDRAWAL ? (
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px', fontSize: '0.85rem', color: '#6b7280', textAlign: 'center' }}>
              🔒 Saldo minimum untuk penarikan adalah <strong>Rp {MIN_WITHDRAWAL.toLocaleString('id-ID')}</strong>
            </div>
          ) : hasPending ? (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 18px', fontSize: '0.85rem', color: '#92400e', textAlign: 'center' }}>
              ⏳ Masih ada pengajuan yang sedang diproses. Tunggu sampai selesai sebelum mengajukan lagi.
            </div>
          ) : (
            <button
              onClick={() => { setShowForm(true); setSuccess(''); setError('') }}
              style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: 'white', border: 'none', borderRadius: 12, fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}
            >
              💸 Tarik Saldo Sekarang
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1rem', color: '#111827' }}>💸 Ajukan Penarikan Saldo</h3>

          {/* Nominal */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Nominal Penarikan (Rp) <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="number"
              min={MIN_WITHDRAWAL}
              max={balance}
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder={`Min. Rp ${MIN_WITHDRAWAL.toLocaleString('id-ID')}`}
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: '0.9rem', fontFamily: 'Poppins,sans-serif', outline: 'none', boxSizing: 'border-box' }}
              required
            />
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4 }}>
              Saldo tersedia: <strong>Rp {balance.toLocaleString('id-ID')}</strong>
              {balance > 0 && <button type="button" onClick={() => setForm(f => ({ ...f, amount: String(balance) }))} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#7C3AED', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Tarik semua</button>}
            </div>
          </div>

          {/* Bank info */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Bank / E-Wallet <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <select
              value={form.bankName}
              onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))}
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: '0.9rem', fontFamily: 'Poppins,sans-serif', outline: 'none', boxSizing: 'border-box', background: 'white' }}
              required
            >
              <option value="">Pilih bank/e-wallet...</option>
              <option value="BCA">🏦 BCA</option>
              <option value="BRI">🏦 BRI</option>
              <option value="BNI">🏦 BNI</option>
              <option value="Mandiri">🏦 Mandiri</option>
              <option value="BSI">🏦 BSI</option>
              <option value="CIMB Niaga">🏦 CIMB Niaga</option>
              <option value="GoPay">📱 GoPay</option>
              <option value="OVO">📱 OVO</option>
              <option value="DANA">📱 DANA</option>
              <option value="ShopeePay">📱 ShopeePay</option>
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Nomor Rekening / No. HP <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="text"
              value={form.accountNumber}
              onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))}
              placeholder="Contoh: 1234567890"
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: '0.9rem', fontFamily: 'Poppins,sans-serif', outline: 'none', boxSizing: 'border-box' }}
              required
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Nama Pemilik Rekening <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="text"
              value={form.accountName}
              onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))}
              placeholder="Nama sesuai rekening"
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: '0.9rem', fontFamily: 'Poppins,sans-serif', outline: 'none', boxSizing: 'border-box' }}
              required
            />
            {form.accountName && user.name && form.accountName.toLowerCase().trim() !== user.name.toLowerCase().trim() && (
              <div style={{ fontSize: '0.75rem', color: '#D97706', marginTop: 4 }}>
                ⚠️ Nama berbeda dari nama akun kamu (<strong>{user.name}</strong>). Pastikan data rekening benar.
              </div>
            )}
          </div>

          {/* Simpan rekening */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#6b7280', marginBottom: 16, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.saveBank} onChange={e => setForm(f => ({ ...f, saveBank: e.target.checked }))} />
            Simpan rekening ini untuk penarikan berikutnya
          </label>

          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', color: '#DC2626', fontSize: '0.82rem', marginBottom: 14 }}>⚠️ {error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={submitting}
              style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.9rem', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'Poppins,sans-serif', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? '⏳ Mengajukan...' : '💸 Ajukan Penarikan'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError('') }}
              style={{ padding: '12px 18px', background: 'white', color: '#6b7280', border: '2px solid #e5e7eb', borderRadius: 10, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}>
              Batal
            </button>
          </div>
        </form>
      )}

      {/* Riwayat penarikan */}
      <h3 style={{ fontSize: '0.95rem', color: '#111827', marginBottom: 12 }}>📜 Riwayat Penarikan</h3>
      {(!data?.withdrawals || data.withdrawals.length === 0) ? (
        <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '0.85rem', background: '#f9fafb', borderRadius: 12 }}>
          💸 Belum ada riwayat penarikan
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.withdrawals.map(w => {
            const cfg = statusConfig[w.status] || statusConfig.pending
            return (
              <div key={w.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                    Rp {Number(w.amount).toLocaleString('id-ID')}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>
                    {w.bank_name} · {w.account_number} a.n. {w.account_name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
                    Diajukan: {new Date(w.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {w.status === 'completed' && w.processed_at && (
                    <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: 2 }}>
                      ✅ Ditransfer: {new Date(w.processed_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                  {w.status === 'rejected' && w.admin_note && (
                    <div style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: 4, background: '#fef2f2', padding: '4px 8px', borderRadius: 6 }}>
                      Alasan ditolak: {w.admin_note}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: cfg.color, background: cfg.bg, borderRadius: 8, padding: '3px 9px', whiteSpace: 'nowrap' }}>
                  {cfg.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Listing Countdown ───────────────────────────────────────────────────────
function ListingCountdown({ expiresAt, status }) {
  const [display, setDisplay] = useState('')
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    if (!expiresAt) return

    const update = () => {
      const now = Date.now()
      const exp = new Date(expiresAt).getTime()
      const diff = exp - now

      if (diff <= 0) {
        setIsExpired(true)
        setDisplay('Kadaluarsa')
        return
      }

      const totalMinutes = Math.floor(diff / 60000)
      const totalHours   = Math.floor(diff / 3600000)
      const days         = Math.floor(diff / 86400000)
      const hours        = Math.floor((diff % 86400000) / 3600000)
      const minutes      = Math.floor((diff % 3600000) / 60000)

      if (days >= 1) {
        setDisplay(`Sisa ${days} hari ${hours} jam`)
      } else if (totalHours >= 1) {
        setDisplay(`Sisa ${totalHours} jam ${minutes} menit`)
      } else {
        setDisplay(`Sisa ${totalMinutes} menit`)
      }
      setIsExpired(false)
    }

    update()
    const interval = setInterval(update, 60000) // update tiap menit
    return () => clearInterval(interval)
  }, [expiresAt])

  if (!expiresAt) return null
  if (status === 'expired' || isExpired) {
    return <span style={{ fontSize: '0.72rem', background: '#fee2e2', color: '#dc2626', borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>❌ Kadaluarsa</span>
  }

  // Warna berdasarkan sisa waktu
  const exp = new Date(expiresAt).getTime()
  const diff = exp - Date.now()
  const urgentColor = diff < 86400000 ? '#dc2626' : diff < 3 * 86400000 ? '#d97706' : '#059669'
  const urgentBg    = diff < 86400000 ? '#fee2e2'   : diff < 3 * 86400000 ? '#fef3c7'   : '#d1fae5'

  return (
    <span style={{ fontSize: '0.72rem', background: urgentBg, color: urgentColor, borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>
      ⏱ {display}
    </span>
  )
}

// ─── My Listings ─────────────────────────────────────────────────────────────
function MyListings({ sellerId }) {
  const { fetchSellerProducts, deleteProduct } = useProducts()
  const [myProducts, setMyProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    if (!sellerId) return
    setLoadingProducts(true)
    // includeSold=true so sold products appear in listing history
    fetchSellerProducts(sellerId, true)
      .then(products => setMyProducts(products))
      .catch(() => setMyProducts([]))
      .finally(() => setLoadingProducts(false))
  }, [sellerId]) // eslint-disable-line

  if (loadingProducts) {
    return (
      <div className={styles.listings}>
        <h2 className={styles.formTitle}>📋 Barang Saya</h2>
        <div className={styles.emptyListings}><span>⏳</span><p>Memuat daftar barang...</p></div>
      </div>
    )
  }

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

  const activeProducts = myProducts.filter(p => !p.isSold)
  const soldProducts   = myProducts.filter(p => p.isSold)

  return (
    <div className={styles.listings}>
      <h2 className={styles.formTitle}>📋 Barang Saya ({myProducts.length})</h2>

      {/* Active listings */}
      {activeProducts.length > 0 && (
        <>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 8, fontWeight: 600 }}>
            ✅ Aktif ({activeProducts.length})
          </p>
          <div className={styles.listingGrid}>
            {activeProducts.map((p) => (
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
                    <ListingCountdown expiresAt={p.listingExpiresAt || p.listing_expires_at} status={p.listingStatus || p.listing_status} />
                  </div>
                </div>
                <div className={styles.listingActions}>
                  <Link to={`/product/${p.id}`} className={styles.listingView}>👁 Lihat</Link>
                  {confirmDelete === p.id ? (
                    <div className={styles.confirmDelete}>
                      <span>Hapus?</span>
                      <button className={styles.confirmYes} onClick={() => {
                        deleteProduct(p.id)
                        setMyProducts(prev => prev.filter(x => x.id !== p.id))
                        setConfirmDelete(null)
                      }}>Ya</button>
                      <button className={styles.confirmNo} onClick={() => setConfirmDelete(null)}>Tidak</button>
                    </div>
                  ) : (
                    <button className={styles.listingDelete} onClick={() => setConfirmDelete(p.id)}>🗑️</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Sold listings history */}
      {soldProducts.length > 0 && (
        <>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '16px 0 8px', fontWeight: 600 }}>
            🏷️ Sudah Terjual ({soldProducts.length})
          </p>
          <div className={styles.listingGrid}>
            {soldProducts.map((p) => (
              <div key={p.id} className={styles.listingCard} style={{ opacity: 0.75 }}>
                <img
                  src={p.images[0]}
                  alt={p.title}
                  className={styles.listingImg}
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/80x60?text=No+Image' }}
                  style={{ filter: 'grayscale(30%)' }}
                />
                <div className={styles.listingInfo}>
                  <h4>{p.title}</h4>
                  <p className={styles.listingPrice}>Rp {p.price.toLocaleString('id-ID')}</p>
                  <div className={styles.listingMeta}>
                    <span style={{ fontSize: '0.72rem', background: '#d1fae5', color: '#065f46', borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>
                      🎉 Terjual
                    </span>
                  </div>
                </div>
                <div className={styles.listingActions}>
                  <Link to={`/product/${p.id}`} className={styles.listingView}>👁 Detail</Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Listing Quota Info Banner ────────────────────────────────────────────────
function ListingQuotaInfo({ sellerId }) {
  const [quota, setQuota] = useState(null)

  useEffect(() => {
    // Only call if backend available
    try {
      listingAPI.getQuota()
        .then(d => { if (d?.success) setQuota(d) })
        .catch(() => {})
      listingAPI.checkExpiry().catch(() => {})
    } catch { /* ignore if offline */ }
  }, [])

  if (!quota) return null

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Info kuota gratis */}
      {quota.hasFreeQuota && (
        <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #bbf7d0', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: '1.5rem' }}>🎁</span>
          <div>
            <strong style={{ color: '#065f46', fontSize: '0.9rem' }}>Kamu masih punya 1 kuota upload GRATIS!</strong>
            <p style={{ color: '#059669', fontSize: '0.8rem', margin: '2px 0 0' }}>
              Upload produk pertamamu sekarang — gratis, listing aktif 7 hari.
            </p>
          </div>
        </div>
      )}

      {/* Warning listing hampir kadaluarsa */}
      {quota.expiringSoon?.length > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 14, padding: '14px 18px', marginBottom: 10 }}>
          <strong style={{ color: '#92400e', fontSize: '0.88rem' }}>⏰ {quota.expiringSoon.length} listing akan kadaluarsa dalam 24 jam!</strong>
          {quota.expiringSoon.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, padding: '8px 0', borderTop: '1px solid #fde68a' }}>
              <span style={{ fontSize: '0.82rem', color: '#78350f' }}>📦 {p.title}</span>
              <button
                onClick={() => listingAPI.renewListing(p.id).then(() => alert('Pengajuan perpanjangan berhasil! Admin akan verifikasi dalam 1×24 jam.')).catch(e => alert(e?.message || 'Gagal'))}
                style={{ background: '#D97706', color: 'white', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}
              >
                🔄 Perpanjang
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Listing kadaluarsa */}
      {quota.expiredListings?.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, padding: '14px 18px' }}>
          <strong style={{ color: '#991b1b', fontSize: '0.88rem' }}>❌ {quota.expiredListings.length} listing sudah kadaluarsa (tidak tampil di Browse)</strong>
          {quota.expiredListings.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, padding: '8px 0', borderTop: '1px solid #fecaca' }}>
              <span style={{ fontSize: '0.82rem', color: '#7f1d1d' }}>📦 {p.title}</span>
              <button
                onClick={() => listingAPI.renewListing(p.id).then(() => alert('Pengajuan perpanjangan berhasil! Admin akan verifikasi.')).catch(e => alert(e?.message || 'Gagal'))}
                style={{ background: '#DC2626', color: 'white', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins,sans-serif' }}
              >
                🔄 Perpanjang
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function SellerDashboard() {
  const { user, updateProfile } = useAuth()
  const { getSellerProducts, fetchSellerProducts } = useProducts()
  const { getOrdersBySeller } = useOrders()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('upload')
  // All products including sold — for stats/header counts
  const [allSellerProducts, setAllSellerProducts] = useState([])

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

  // Block if verification rejected
  if (user.verificationStatus === 'rejected') {
    return (
      <div className={styles.accessDenied}>
        <div className={styles.accessIcon}>🔒</div>
        <h2>Akun Dibatasi</h2>
        <p>Verifikasi identitasmu ditolak. Kamu tidak bisa berjualan sampai verifikasi ulang disetujui.</p>
        {user.rejectionNote && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', margin: '12px 0', fontSize: '0.85rem', color: '#991b1b', maxWidth: 400 }}>
            <strong>Alasan penolakan:</strong> {user.rejectionNote}
          </div>
        )}
        <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '8px 0 20px' }}>
          Upload ulang foto KTP dan selfie yang lebih jelas untuk mengaktifkan kembali akun kamu.
        </p>
        <button className={styles.ktmBtn} onClick={() => navigate('/auth', { state: { mode: 'reverify' } })}>
          🔄 Verifikasi Ulang Sekarang
        </button>
      </div>
    )
  }

  const isVerified = user.verified || user.verificationStatus === 'approved'

  // Load all products including sold ones for accurate stats
  useEffect(() => {
    if (user?.id) {
      fetchSellerProducts(user.id, true)
        .then(products => setAllSellerProducts(products))
        .catch(() => setAllSellerProducts(getSellerProducts(user.id)))
    }
  }, [user?.id]) // eslint-disable-line

  const handleVerified = () => {
    updateProfile({ verified: true, verificationStatus: 'approved' })
  }

  const seller = {
    ...user,
    rating: user.rating || 0,
    totalSales: user.totalSales || 0,
    reviews: user.reviews || [],
  }

  const myProducts      = allSellerProducts.filter(p => !p.isSold) // active only for tab count
  const soldProducts    = allSellerProducts.filter(p => p.isSold)
  const totalViews      = allSellerProducts.reduce((sum, p) => sum + (p.views || 0), 0)
  const sellerBalance   = user.balance    || 0
  const sellerTotalSales = user.totalSales || 0

  const myOrders        = getOrdersBySeller(user.id)
  const completedOrders = myOrders.filter(o => o.status === 'completed')
  const pendingEarnings = myOrders
    .filter(o => ['paid', 'processing', 'shipped'].includes(o.status))
    .reduce((sum, o) => sum + (o.sellerAmount ?? o.price), 0)

  const tabs = [
    { id: 'upload',    label: '📦 Upload Barang' },
    { id: 'listings',  label: `📋 Barang Saya (${myProducts.length}${soldProducts.length > 0 ? `+${soldProducts.length} terjual` : ''})` },
    { id: 'withdraw',  label: '💸 Tarik Saldo' },
    { id: 'saldo',     label: `💰 Saldo${sellerBalance > 0 ? ` (${(sellerBalance/1000).toFixed(0)}K)` : ''}` },
    { id: 'stats',     label: '📊 Statistik' },
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
                <span className={styles.profileStatNum}>{soldProducts.length || sellerTotalSales}</span>
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

        {/* Listing Quota Info — tampil untuk seller */}
        <ListingQuotaInfo sellerId={user.id} />

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
          {activeTab === 'withdraw' && (
            <WithdrawalTab user={user} />
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
                { icon: '🎉',  label: 'Terjual',         value: soldProducts.length || sellerTotalSales,       color: '#F59E0B' },
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
