import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { sellers, meetupPoints } from '../../data/products'
import { useProducts } from '../../context/ProductContext'
import { useAuth } from '../../context/AuthContext'
import { useOrders } from '../../context/OrderContext'
import { isBackendAvailable, chatAPI } from '../../services/api'
import { getSellerTrustBadges, TRANSACTION_PROTECTION } from '../../utils/trustBadge'
import styles from './ProductDetail.module.css'

function getSellerInfo(sellerId) {
  const staticSeller = sellers.find((s) => s.id === sellerId)
  if (staticSeller) return staticSeller
  try {
    const users = JSON.parse(localStorage.getItem('cr_users') || '[]')
    return users.find((u) => u.id === sellerId) || null
  } catch { return null }
}

function StarRating({ rating, size = 'md' }) {
  return (
    <span className={`${styles.stars} ${styles[`stars${size}`]}`}>
      {'★'.repeat(Math.floor(rating))}{'☆'.repeat(5 - Math.floor(rating))}
      <span className={styles.ratingNum}>{rating}</span>
    </span>
  )
}

function ImageGallery({ images, title }) {
  const [active, setActive] = useState(0)

  return (
    <div className={styles.gallery}>
      <div className={styles.mainImage}>
        <img src={images[active]} alt={title} />
      </div>
      {images.length > 1 && (
        <div className={styles.thumbnails}>
          {images.map((img, i) => (
            <button
              key={i}
              className={`${styles.thumb} ${active === i ? styles.thumbActive : ''}`}
              onClick={() => setActive(i)}
            >
              <img src={img} alt={`${title} ${i + 1}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MeetupPlanner({ points, productTitle, buyerId, sellerId, productId, user }) {
  const [selected, setSelected] = useState(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [sending, setSending] = useState(false)

  const handleConfirm = async () => {
    if (!selected || !date || !time) return
    const point = meetupPoints.find((m) => m.id === selected)
    setSending(true)
    try {
      // 1. Get or create conversation
      let convId = null
      if (isBackendAvailable() && buyerId && sellerId) {
        const data = await chatAPI.getOrCreate({ buyerId, sellerId, productId, productTitle })
        if (data.success) convId = data.conversation.id
      }
      // 2. Send meetup schedule as chat message
      const msg = `📅 [MEETUP_SCHEDULE] Jadwal Meet-up:\n📍 Lokasi: ${point?.name || selected}\n📅 Tanggal: ${date}\n⏰ Waktu: ${time} WIB\n\nMohon konfirmasi penjual ya!`
      if (convId && isBackendAvailable()) {
        await chatAPI.sendMessage(convId, msg)
      } else if (convId) {
        const all = JSON.parse(localStorage.getItem('cr_chats') || '[]')
        const idx = all.findIndex(c => c.conversationId === convId)
        if (idx !== -1) { all[idx].messages.push({ messageId: `m${Date.now()}`, senderId: user?.id || buyerId, text: msg, sentAt: new Date().toISOString(), isRead: false }); localStorage.setItem('cr_chats', JSON.stringify(all)) }
      }
      setConfirmed(true)
    } catch { setConfirmed(true) /* still show confirmed even if chat fails */ }
    setSending(false)
  }

  if (confirmed) {
    const point = meetupPoints.find((m) => m.id === selected)
    return (
      <div className={styles.meetupConfirmed}>
        <div className={styles.confirmedIcon}>✅</div>
        <h3>Meet-up Terjadwal!</h3>
        <p><strong>{point?.name}</strong><br />📅 {date} pukul {time} WIB</p>
        <p className={styles.confirmedNote}>
          Jadwal sudah terkirim ke chat dengan penjual. Tunggu konfirmasi ya!
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className={styles.resetMeetup} onClick={() => setConfirmed(false)}>Ubah Jadwal</button>
          {isBackendAvailable() && buyerId && sellerId && (
            <Link to={`/chat`} style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#7C3AED,#2563EB)', color: 'white', borderRadius: 10, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 700 }}>💬 Buka Chat</Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.meetup}>
      <h3 className={styles.meetupTitle}>📍 Meet-up Planner</h3>
      <p className={styles.meetupDesc}>Atur jadwal ketemu langsung dengan penjual untuk COD</p>

      <div className={styles.meetupPoints}>
        {points.map((pointId) => {
          const point = meetupPoints.find((m) => m.name === pointId)
          if (!point) return null
          return (
            <button key={point.id} className={`${styles.meetupPoint} ${selected === point.id ? styles.meetupPointActive : ''}`} onClick={() => setSelected(point.id)}>
              <span className={styles.meetupPointIcon}>{point.icon}</span>
              <div className={styles.meetupPointInfo}>
                <span className={styles.meetupPointName}>{point.name}</span>
                <span className={styles.meetupPointDesc}>{point.description}</span>
                {point.hours && <span className={styles.meetupPointHours}>⏰ {point.hours}</span>}
              </div>
              {selected === point.id && <span className={styles.meetupCheck}>✓</span>}
            </button>
          )
        })}
      </div>

      <div className={styles.meetupDateTime}>
        <div className={styles.dateTimeField}>
          <label>📅 Tanggal</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
        </div>
        <div className={styles.dateTimeField}>
          <label>⏰ Waktu</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} />
        </div>
      </div>

      <button className={styles.meetupBtn} onClick={handleConfirm} disabled={!selected || !date || !time || sending}>
        {sending ? '⏳ Mengirim...' : '📅 Jadwalkan & Kirim ke Chat Penjual'}
      </button>
    </div>
  )
}

function SellerProfile({ seller }) {
  const [showReviews, setShowReviews] = useState(false)
  const trustBadges = getSellerTrustBadges(seller)

  return (
    <div className={styles.sellerCard}>
      <div className={styles.sellerHeader}>
        <img src={seller.avatar} alt={seller.name} className={styles.sellerAvatar} />
        <div className={styles.sellerMeta}>
          <div className={styles.sellerNameRow}>
            <h3 className={styles.sellerName}>{seller.name}</h3>
            {seller.verified && (
              <span className={styles.verifiedBadge}>✓ Terverifikasi</span>
            )}
          </div>
          <p className={styles.sellerUni}>{seller.city || seller.university || ''}</p>
          <div className={styles.sellerStats}>
            <div className={styles.sellerStat}>
              <StarRating rating={seller.rating} />
            </div>
            <span className={styles.sellerStatDivider}>·</span>
            <span className={styles.sellerSales}>{seller.totalSales || 0} terjual</span>
            <span className={styles.sellerStatDivider}>·</span>
            <span className={styles.sellerJoin}>Bergabung {seller.joinDate ? new Date(seller.joinDate).getFullYear() : '–'}</span>
          </div>

          {/* Trust Badges */}
          {trustBadges.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {trustBadges.map(b => (
                <span key={b.id} title={b.desc} style={{ background: b.bg, color: b.color, border: `1px solid ${b.color}40`, borderRadius: 8, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {b.icon} {b.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {seller.reviews?.length > 0 && (
        <>
          <button className={styles.reviewToggle} onClick={() => setShowReviews(!showReviews)}>
            {showReviews ? '▲' : '▼'} {seller.reviews.length} Ulasan
          </button>
          {showReviews && (
            <div className={styles.reviews}>
              {seller.reviews.map((review, i) => (
                <div key={i} className={styles.review}>
                  <div className={styles.reviewHeader}>
                    <span className={styles.reviewUser}>{review.user}</span>
                    <span className={styles.reviewStars}>{'★'.repeat(review.rating)}</span>
                    <span className={styles.reviewDate}>{review.date}</span>
                  </div>
                  <p className={styles.reviewComment}>{review.comment}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Transaction Protection Banner */}
      <div style={{ marginTop: 14, background: 'linear-gradient(135deg,#eff6ff,#f0fdf4)', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 14px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1d4ed8', marginBottom: 8 }}>
          {TRANSACTION_PROTECTION.icon} {TRANSACTION_PROTECTION.title}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {TRANSACTION_PROTECTION.items.map((item, i) => (
            <div key={i} style={{ fontSize: '0.75rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{item.icon}</span><span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ProductDetail() {
  const { id } = useParams()
  const { allProducts } = useProducts()
  const { user } = useAuth()
  const { isProductSold } = useOrders()
  const navigate = useNavigate()
  const product = allProducts.find((p) => p.id === id)
  const seller = product ? getSellerInfo(product.sellerId) : null
  const [chatOpen, setChatOpen] = useState(false)
  const [chatConvId, setChatConvId] = useState(null)
  const [chatMsg, setChatMsg] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  // Cek apakah produk sudah terjual
  const sold = product ? isProductSold(product.id) : false

  const handleBuyNow = () => {
    if (sold) return
    if (!user) {
      navigate('/auth', { state: { mode: 'login', from: `/checkout/${id}` } })
      return
    }
    if (user.role === 'seller') {
      alert('Akun penjual tidak bisa membeli. Gunakan akun pembeli.')
      return
    }
    navigate(`/checkout/${id}`)
  }

  const handleChatSeller = async () => {
    if (!user) { navigate('/auth', { state: { mode: 'login' } }); return }
    if (user.role === 'seller' && user.id === product.sellerId) { alert('Ini barang kamu sendiri!'); return }
    setChatLoading(true)
    try {
      const buyerId  = user.role === 'buyer' ? user.id : product.sellerId
      const sellerId = product.sellerId
      if (isBackendAvailable()) {
        const data = await chatAPI.getOrCreate({ buyerId, sellerId, productId: product.id, productTitle: product.title })
        if (data.success) { setChatConvId(data.conversation.id); setChatOpen(true) }
      } else {
        const all = JSON.parse(localStorage.getItem('cr_chats') || '[]')
        let conv = all.find(c => c.buyerId === buyerId && c.sellerId === sellerId && c.productId === product.id)
        if (!conv) {
          conv = { conversationId: `conv_${Date.now()}`, buyerId, sellerId, productId: product.id, productTitle: product.title, messages: [], createdAt: new Date().toISOString() }
          all.push(conv); localStorage.setItem('cr_chats', JSON.stringify(all))
        }
        setChatConvId(conv.conversationId); setChatOpen(true)
      }
    } catch { /* ignore */ }
    setChatLoading(false)
  }

  const handleSendChat = async () => {
    if (!chatMsg.trim() || !chatConvId) return
    try {
      if (isBackendAvailable()) {
        await chatAPI.sendMessage(chatConvId, chatMsg.trim())
      } else {
        const all = JSON.parse(localStorage.getItem('cr_chats') || '[]')
        const idx = all.findIndex(c => c.conversationId === chatConvId)
        if (idx !== -1) {
          all[idx].messages.push({ messageId: `m${Date.now()}`, senderId: user.id, text: chatMsg.trim(), sentAt: new Date().toISOString(), isRead: false })
          localStorage.setItem('cr_chats', JSON.stringify(all))
        }
      }
      setChatMsg('')
    } catch { /* ignore */ }
  }

  if (!product) {
    return (
      <div className={styles.notFound}>
        <div className={styles.notFoundIcon}>😕</div>
        <h2>Barang tidak ditemukan</h2>
        <p>Mungkin sudah terjual atau dihapus oleh penjual</p>
        <Link to="/browse" className="btn-primary">← Kembali Browse</Link>
      </div>
    )
  }

  // originalPrice sekarang opsional — hanya tampil jika ada dan lebih besar dari harga jual
  const hasDiscount = product.originalPrice && product.originalPrice > product.price
  const discount = hasDiscount
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0

  const categoryColors = {
    furniture:  { bg: '#EDE9FE', color: '#7C3AED', label: '🪑 Furniture' },
    electronic: { bg: '#D1FAE5', color: '#059669', label: '💻 Electronic' },
    fashion:    { bg: '#FCE7F3', color: '#DB2777', label: '👕 Fashion' },
    hobi:       { bg: '#FEF3C7', color: '#D97706', label: '🎮 Hobi' },
    otomotif:   { bg: '#FEE2E2', color: '#DC2626', label: '🏍️ Otomotif' },
    buku:       { bg: '#EDE9FE', color: '#8B5CF6', label: '📚 Buku & Alat Tulis' },
    olahraga:   { bg: '#D1FAE5', color: '#059669', label: '⚽ Olahraga' },
    kesehatan:  { bg: '#FCE7F3', color: '#F472B6', label: '🏥 Kesehatan' },
    dapur:      { bg: '#FEF3C7', color: '#D97706', label: '🍳 Dapur' },
    bayi:       { bg: '#DBEAFE', color: '#2563EB', label: '👶 Bayi' },
    academic:   { bg: '#FEF3C7', color: '#D97706', label: '📚 Lainnya' },
    lainnya:    { bg: '#F3F4F6', color: '#6B7280', label: '📦 Lainnya' },
  }
  const cat = categoryColors[product.category] || { bg: '#F3F4F6', color: '#6B7280', label: product.category }

  return (
    <div className={styles.page}>
      <div className="container">
        {/* Breadcrumb */}
        <div className={styles.breadcrumb}>
          <Link to="/">Home</Link>
          <span>›</span>
          <Link to="/browse">Browse</Link>
          <span>›</span>
          <span>{product.title}</span>
        </div>

        <div className={styles.layout}>
          {/* Left: Images */}
          <div className={styles.leftCol}>
            <ImageGallery images={product.images} title={product.title} />
          </div>

          {/* Right: Info */}
          <div className={styles.rightCol}>
            <div className={styles.productInfo}>
              {/* Badges */}
              <div className={styles.badgeRow}>
                <span className={styles.catBadge} style={{ background: cat.bg, color: cat.color }}>
                  {cat.label}
                </span>
                {product.isHot && <span className="badge badge-hot">🔥 Hot</span>}
                {product.isAlmostSold && <span className="badge badge-almost-sold">⚡ Hampir Habis</span>}
                {product.isNew && <span className="badge badge-new">✨ Baru Masuk</span>}
              </div>

              <h1 className={styles.productTitle}>{product.title}</h1>

              {/* Price */}
              <div className={styles.priceSection}>
                <span className={styles.price}>Rp {product.price.toLocaleString('id-ID')}</span>
                {hasDiscount && (
                  <>
                    <span className={styles.originalPrice}>Rp {product.originalPrice.toLocaleString('id-ID')}</span>
                    <span className={styles.discountBadge}>Hemat {discount}%</span>
                  </>
                )}
              </div>

              {/* Condition */}
              <div className={styles.conditionSection}>
                <div className={styles.conditionLabel}>
                  <span>Kondisi:</span>
                  <strong>{product.condition}</strong>
                </div>
                <div className={styles.conditionBar}>
                  <div
                    className={styles.conditionFill}
                    style={{
                      width: `${product.conditionScore}%`,
                      background: product.conditionScore >= 85
                        ? 'linear-gradient(90deg, #10B981, #059669)'
                        : product.conditionScore >= 70
                        ? 'linear-gradient(90deg, #F59E0B, #D97706)'
                        : 'linear-gradient(90deg, #EF4444, #DC2626)'
                    }}
                  ></div>
                </div>
                <span className={styles.conditionScore}>{product.conditionScore}% kondisi</span>
              </div>

              {/* Stats */}
              <div className={styles.statsRow}>
                <span>👁 {product.views} dilihat</span>
                <span>📅 {product.postedDate}</span>
                <span>📦 {sold ? '🔴 Sold Out' : `Stok: ${product.stock}`}</span>
              </div>

              {/* Description */}
              <div className={styles.description}>
                <h3>Deskripsi</h3>
                <p>{product.description}</p>
              </div>

              {/* Tags */}
              <div className={styles.tags}>
                {product.tags.map((tag) => (
                  <span key={tag} className={styles.tag}>#{tag}</span>
                ))}
              </div>

              {/* Action Buttons */}
              {sold ? (
                <div className={styles.soldOutBox}>
                  <div className={styles.soldOutBadge}>🔴 SOLD OUT</div>
                  <p>Barang ini sudah terjual. Cari barang serupa di Browse!</p>
                  <Link to="/browse" className={styles.btnBrowse}>🛍️ Cari Barang Lain</Link>
                </div>
              ) : (
                <div className={styles.actions}>
                  <button className={styles.btnBuy} onClick={handleBuyNow}>
                    🛒 Beli Sekarang
                  </button>
                  <button className={styles.btnChat} onClick={handleChatSeller}>
                    💬 Chat Penjual
                  </button>
                </div>
              )}

              {chatOpen && chatConvId && (
                <div className={styles.chatBox}>
                  <div className={styles.chatBoxHeader}>
                    <span>💬 Chat dengan {seller?.name || 'Penjual'}</span>
                    <button className={styles.chatBoxClose} onClick={() => setChatOpen(false)}>✕</button>
                  </div>
                  <div className={styles.chatMessages}>
                    <div className={styles.chatBubbleSeller}>
                      Halo! Ada yang mau ditanyakan tentang {product.title}? 😊
                    </div>
                  </div>
                  <div className={styles.chatInput}>
                    <input
                      type="text"
                      placeholder="Tulis pesan..."
                      value={chatMsg}
                      onChange={e => setChatMsg(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                    />
                    <button onClick={handleSendChat}>Kirim</button>
                  </div>
                  <Link to={`/chat?conv=${chatConvId}`} className={styles.chatBoxFull}>
                    Buka chat penuh →
                  </Link>
                </div>
              )}
            </div>

            {/* Meet-up Planner — only show for buyers, pass chat context */}
            {user && user.role !== 'admin' && product.sellerId !== user.id && (
              <MeetupPlanner
                points={product.meetupPoints || []}
                productTitle={product.title}
                buyerId={user.role === 'buyer' ? user.id : null}
                sellerId={product.sellerId}
                productId={product.id}
                user={user}
              />
            )}

            {/* Seller Profile */}
            {seller && <SellerProfile seller={seller} />}
          </div>
        </div>
      </div>
    </div>
  )
}
