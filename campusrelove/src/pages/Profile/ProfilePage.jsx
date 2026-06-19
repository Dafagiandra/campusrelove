import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useOrders } from '../../context/OrderContext'
import { useProducts } from '../../context/ProductContext'
import styles from './ProfilePage.module.css'

// ── Avatar Upload ─────────────────────────────────────────────────────────────
function AvatarUpload({ current, onUpload }) {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)

  const handleChange = (e) => {
    const f = e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = ev => {
      setPreview(ev.target.result)
      onUpload(ev.target.result)
    }
    reader.readAsDataURL(f)
  }

  return (
    <div className={styles.avatarWrapper}>
      <img
        src={preview || current}
        alt="Avatar"
        className={styles.avatarImg}
        onError={e => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=user` }}
      />
      <button
        type="button"
        className={styles.avatarEditBtn}
        onClick={() => inputRef.current?.click()}
        title="Ganti foto profil"
      >
        📷
      </button>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleChange} style={{ display: 'none' }} />
    </div>
  )
}

// ── Testimoni Card ────────────────────────────────────────────────────────────
function TestimoniCard({ review }) {
  return (
    <div className={styles.testimoniCard}>
      <div className={styles.testimoniHeader}>
        <img
          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${review.buyerName}`}
          alt={review.buyerName}
          className={styles.testimoniAvatar}
        />
        <div className={styles.testimoniMeta}>
          <strong>{review.buyerName}</strong>
          <span>{new Date(review.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
        <div className={styles.testimoniStars}>
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={i < review.rating ? styles.starFilled : styles.starEmpty}>★</span>
          ))}
        </div>
      </div>
      <p className={styles.testimoniText}>{review.text}</p>
      {review.productTitle && (
        <span className={styles.testimoniProduct}>📦 {review.productTitle}</span>
      )}
    </div>
  )
}

// ── Seller Profile Section ────────────────────────────────────────────────────
function SellerProfile({ user, onSave }) {
  const { allProducts } = useProducts()
  const { getOrdersBySeller } = useOrders()
  const myProducts = allProducts.filter(p => p.sellerId === user.id)
  const completedOrders = getOrdersBySeller(user.id).filter(o => o.status === 'completed')

  const reviews = user.reviews || []
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null

  const [form, setForm] = useState({
    name:     user.name  || '',
    city:     user.city  || '',
    phone:    user.phone || '',
    bio:      user.bio   || '',
    instagram: user.instagram || '',
    whatsapp:  user.whatsapp  || user.phone || '',
  })
  const [avatar, setAvatar]     = useState(user.avatar)
  const [saved, setSaved]       = useState(false)
  const [saving, setSaving]     = useState(false)
  const [activeTab, setActiveTab] = useState('profile')

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    await onSave({ ...form, avatar })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const tabs = [
    { id: 'profile',    label: '👤 Profil' },
    { id: 'testimoni',  label: `⭐ Testimoni (${reviews.length})` },
    { id: 'stats',      label: '📊 Statistik' },
  ]

  return (
    <div>
      {/* Profile Header */}
      <div className={styles.profileHero}>
        <AvatarUpload current={avatar} onUpload={setAvatar} />
        <div className={styles.heroInfo}>
          <div className={styles.heroName}>
            {user.name}
            {user.verified && <span className={styles.verifiedBadge}>✓ Terverifikasi</span>}
            {user.verificationStatus === 'rejected' && <span className={styles.rejectedBadge}>⚠️ Belum Terverifikasi</span>}
          </div>
          <div className={styles.heroRole}>📦 Penjual</div>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <strong>{myProducts.length}</strong><span>Listing</span>
            </div>
            <div className={styles.heroStat}>
              <strong>{completedOrders.length}</strong><span>Terjual</span>
            </div>
            <div className={styles.heroStat}>
              <strong>{avgRating ? `⭐ ${avgRating}` : '–'}</strong><span>Rating</span>
            </div>
            <div className={styles.heroStat}>
              <strong>Rp {(user.balance || 0).toLocaleString('id-ID')}</strong><span>Saldo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {tabs.map(t => (
          <button key={t.id}
            className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Edit Profil */}
      {activeTab === 'profile' && (
        <form className={styles.editForm} onSubmit={handleSave}>
          <h3 className={styles.sectionTitle}>✏️ Edit Profil Penjual</h3>

          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label>👤 Nama Toko / Nama Lengkap</label>
              <input name="name" value={form.name} onChange={handleChange} placeholder="Nama kamu" required />
            </div>
            <div className={styles.formField}>
              <label>🏙️ Kota</label>
              <input name="city" value={form.city} onChange={handleChange} placeholder="Jakarta, Bandung..." />
            </div>
            <div className={styles.formField}>
              <label>📱 No. WhatsApp</label>
              <input name="whatsapp" value={form.whatsapp} onChange={handleChange} placeholder="08xxxxxxxxxx" />
            </div>
            <div className={styles.formField}>
              <label>📸 Instagram</label>
              <input name="instagram" value={form.instagram} onChange={handleChange} placeholder="@username (opsional)" />
            </div>
          </div>

          <div className={styles.formFieldFull}>
            <label>📝 Bio / Deskripsi Toko</label>
            <textarea
              name="bio"
              value={form.bio}
              onChange={handleChange}
              rows={3}
              placeholder="Ceritakan tentang dirimu atau tokomu... misal: jual barang bekas berkualitas, fast respon, COD area Bandung"
            />
          </div>

          <div className={styles.trustBadges}>
            <div className={styles.trustTitle}>🏆 Kepercayaan Akun</div>
            <div className={styles.trustGrid}>
              <div className={`${styles.trustItem} ${user.verified ? styles.trustActive : ''}`}>
                {user.verified ? '✅' : '⬜'} Identitas Terverifikasi
              </div>
              <div className={`${styles.trustItem} ${completedOrders.length >= 5 ? styles.trustActive : ''}`}>
                {completedOrders.length >= 5 ? '✅' : '⬜'} 5+ Transaksi Selesai
              </div>
              <div className={`${styles.trustItem} ${avgRating >= 4.5 ? styles.trustActive : ''}`}>
                {avgRating >= 4.5 ? '✅' : '⬜'} Rating ≥ 4.5
              </div>
              <div className={`${styles.trustItem} ${reviews.length >= 3 ? styles.trustActive : ''}`}>
                {reviews.length >= 3 ? '✅' : '⬜'} 3+ Testimoni
              </div>
            </div>
          </div>

          {saved && <div className={styles.savedMsg}>✅ Profil berhasil disimpan!</div>}

          <button type="submit" className={styles.saveBtn} disabled={saving}>
            {saving ? '⏳ Menyimpan...' : '💾 Simpan Perubahan'}
          </button>
        </form>
      )}

      {/* Tab: Testimoni */}
      {activeTab === 'testimoni' && (
        <div>
          <div className={styles.testimoniSummary}>
            <div className={styles.ratingBig}>
              <span className={styles.ratingNum}>{avgRating || '–'}</span>
              <div className={styles.ratingStars}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={i < Math.round(avgRating) ? styles.starFilled : styles.starEmpty}>★</span>
                ))}
              </div>
              <span className={styles.ratingCount}>dari {reviews.length} ulasan</span>
            </div>
          </div>

          {reviews.length === 0 ? (
            <div className={styles.emptyTestimoni}>
              <span>💬</span>
              <p>Belum ada testimoni</p>
              <small>Testimoni dari pembeli akan muncul setelah transaksi selesai</small>
            </div>
          ) : (
            <div className={styles.testimoniList}>
              {reviews.map((r, i) => <TestimoniCard key={i} review={r} />)}
            </div>
          )}
        </div>
      )}

      {/* Tab: Statistik */}
      {activeTab === 'stats' && (
        <div className={styles.statsSection}>
          <div className={styles.statsGrid}>
            {[
              { icon: '📦', label: 'Total Listing',    value: myProducts.length,             color: '#7C3AED' },
              { icon: '🎉', label: 'Terjual',          value: completedOrders.length,         color: '#10B981' },
              { icon: '⭐', label: 'Rating',           value: avgRating ? `${avgRating}/5` : 'Belum ada', color: '#F59E0B' },
              { icon: '💬', label: 'Testimoni',        value: reviews.length,                 color: '#2563EB' },
              { icon: '💰', label: 'Total Pendapatan', value: `Rp ${(user.balance||0).toLocaleString('id-ID')}`, color: '#059669' },
            ].map(s => (
              <div key={s.label} className={styles.statCard} style={{ '--c': s.color }}>
                <div className={styles.statIcon}>{s.icon}</div>
                <div className={styles.statValue}>{s.value}</div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className={styles.productPreview}>
            <h4 className={styles.sectionTitle}>📋 Listing Aktif</h4>
            {myProducts.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.88rem' }}>Belum ada produk yang diupload.</p>
            ) : (
              <div className={styles.productList}>
                {myProducts.slice(0, 4).map(p => (
                  <Link key={p.id} to={`/product/${p.id}`} className={styles.productRow}>
                    <img src={p.images?.[0]} alt={p.title} className={styles.productThumb}
                      onError={e => { e.target.src = 'https://via.placeholder.com/48x48?text=?'}} />
                    <div className={styles.productRowInfo}>
                      <strong>{p.title}</strong>
                      <span>Rp {p.price.toLocaleString('id-ID')}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Buyer Profile Section ─────────────────────────────────────────────────────
function BuyerProfile({ user, onSave }) {
  const { getOrdersByBuyer } = useOrders()
  const myOrders = getOrdersByBuyer(user.id)
  const completedOrders = myOrders.filter(o => o.status === 'completed')
  const totalSpent = completedOrders.reduce((s, o) => s + (o.price || 0), 0)

  const [form, setForm]       = useState({
    name:     user.name  || '',
    city:     user.city  || '',
    phone:    user.phone || '',
    bio:      user.bio   || '',
  })
  const [avatar, setAvatar]   = useState(user.avatar)
  const [saved, setSaved]     = useState(false)
  const [saving, setSaving]   = useState(false)
  const [activeTab, setActiveTab] = useState('profile')

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    await onSave({ ...form, avatar })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const tabs = [
    { id: 'profile', label: '👤 Profil' },
    { id: 'history', label: `🛍️ Riwayat Beli (${myOrders.length})` },
  ]

  return (
    <div>
      {/* Profile Header */}
      <div className={styles.profileHero}>
        <AvatarUpload current={avatar} onUpload={setAvatar} />
        <div className={styles.heroInfo}>
          <div className={styles.heroName}>
            {user.name}
            {user.verified && <span className={styles.verifiedBadge}>✓ Terverifikasi</span>}
          </div>
          <div className={styles.heroRole}>🛍️ Pembeli</div>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <strong>{myOrders.length}</strong><span>Pesanan</span>
            </div>
            <div className={styles.heroStat}>
              <strong>{completedOrders.length}</strong><span>Selesai</span>
            </div>
            <div className={styles.heroStat}>
              <strong>Rp {totalSpent.toLocaleString('id-ID')}</strong><span>Total Beli</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {tabs.map(t => (
          <button key={t.id}
            className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Edit Profil */}
      {activeTab === 'profile' && (
        <form className={styles.editForm} onSubmit={handleSave}>
          <h3 className={styles.sectionTitle}>✏️ Edit Profil Pembeli</h3>

          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label>👤 Nama Lengkap</label>
              <input name="name" value={form.name} onChange={handleChange} placeholder="Nama lengkap" required />
            </div>
            <div className={styles.formField}>
              <label>🏙️ Kota</label>
              <input name="city" value={form.city} onChange={handleChange} placeholder="Jakarta, Bandung..." />
            </div>
            <div className={styles.formField}>
              <label>📱 No. WhatsApp</label>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="08xxxxxxxxxx" />
            </div>
          </div>

          <div className={styles.formFieldFull}>
            <label>📝 Bio Singkat</label>
            <textarea
              name="bio"
              value={form.bio}
              onChange={handleChange}
              rows={2}
              placeholder="Ceritakan sedikit tentang dirimu (opsional)"
            />
          </div>

          <div className={styles.trustBadges}>
            <div className={styles.trustTitle}>🏆 Kepercayaan Akun</div>
            <div className={styles.trustGrid}>
              <div className={`${styles.trustItem} ${user.verified ? styles.trustActive : ''}`}>
                {user.verified ? '✅' : '⬜'} Identitas Terverifikasi
              </div>
              <div className={`${styles.trustItem} ${completedOrders.length >= 3 ? styles.trustActive : ''}`}>
                {completedOrders.length >= 3 ? '✅' : '⬜'} 3+ Transaksi Selesai
              </div>
              <div className={`${styles.trustItem} ${myOrders.length > 0 ? styles.trustActive : ''}`}>
                {myOrders.length > 0 ? '✅' : '⬜'} Pernah Bertransaksi
              </div>
            </div>
          </div>

          {saved && <div className={styles.savedMsg}>✅ Profil berhasil disimpan!</div>}

          <button type="submit" className={styles.saveBtn} disabled={saving}>
            {saving ? '⏳ Menyimpan...' : '💾 Simpan Perubahan'}
          </button>
        </form>
      )}

      {/* Tab: Riwayat Beli */}
      {activeTab === 'history' && (
        <div>
          {myOrders.length === 0 ? (
            <div className={styles.emptyTestimoni}>
              <span>🛍️</span>
              <p>Belum ada riwayat pembelian</p>
              <Link to="/browse" className={styles.saveBtn} style={{ display: 'inline-block', textDecoration: 'none', marginTop: 12 }}>
                🛍️ Mulai Belanja
              </Link>
            </div>
          ) : (
            <div className={styles.historyList}>
              {myOrders
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map(o => {
                  const statusMap = {
                    pending_payment: { label: '⏳ Menunggu', color: '#F59E0B', bg: '#FEF3C7' },
                    paid:            { label: '🔒 Dibayar',  color: '#2563EB', bg: '#DBEAFE' },
                    processing:      { label: '📦 Diproses', color: '#7C3AED', bg: '#EDE9FE' },
                    shipped:         { label: '🚚 Dikirim',  color: '#059669', bg: '#D1FAE5' },
                    completed:       { label: '🎉 Selesai',  color: '#065f46', bg: '#D1FAE5' },
                    cancelled:       { label: '❌ Batal',    color: '#DC2626', bg: '#FEE2E2' },
                  }
                  const st = statusMap[o.status] || statusMap.pending_payment
                  return (
                    <div key={o.orderId} className={styles.historyRow}>
                      <div className={styles.historyInfo}>
                        <strong>{o.productTitle}</strong>
                        <span>{new Date(o.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                      <div className={styles.historyRight}>
                        <span className={styles.historyPrice}>Rp {o.price.toLocaleString('id-ID')}</span>
                        <span className={styles.historyStatus} style={{ color: st.color, background: st.bg }}>
                          {st.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, updateProfile } = useAuth()
  const navigate = useNavigate()

  if (!user) {
    return (
      <div className={styles.center}>
        <div className={styles.centerIcon}>🔐</div>
        <h2>Login dulu yuk!</h2>
        <button className={styles.saveBtn} onClick={() => navigate('/auth', { state: { mode: 'login' } })}>
          Login Sekarang
        </button>
      </div>
    )
  }

  if (user.role === 'admin') {
    navigate('/admin')
    return null
  }

  const handleSave = async (updates) => {
    await updateProfile(updates)
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.breadcrumb}>
          <Link to="/">Home</Link> › <span>Profil Saya</span>
        </div>

        {user.role === 'seller'
          ? <SellerProfile user={user} onSave={handleSave} />
          : <BuyerProfile  user={user} onSave={handleSave} />
        }
      </div>
    </div>
  )
}
