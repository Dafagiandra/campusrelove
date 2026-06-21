import { Link } from 'react-router-dom'
import { sellers } from '../../data/products'
import { useOrders } from '../../context/OrderContext'
import styles from './ProductCard.module.css'

// Get seller info: first check static sellers, then localStorage users
function getSellerInfo(sellerId) {
  // Check static sellers
  const staticSeller = sellers.find((s) => s.id === sellerId)
  if (staticSeller) return staticSeller

  // Check localStorage users
  try {
    const users = JSON.parse(localStorage.getItem('cr_users') || '[]')
    const user = users.find((u) => u.id === sellerId)
    if (user) return user
  } catch {}

  return null
}

function StarRating({ rating }) {
  if (!rating || rating === 0) {
    return <span className={styles.stars}>☆☆☆☆☆ <span className={styles.ratingNum}>Baru</span></span>
  }
  return (
    <span className={styles.stars}>
      {'★'.repeat(Math.floor(rating))}{'☆'.repeat(5 - Math.floor(rating))}
      <span className={styles.ratingNum}>{rating}</span>
    </span>
  )
}

export default function ProductCard({ product }) {
  const { isProductSold } = useOrders()
  const seller = getSellerInfo(product.sellerId)
  const sold = isProductSold(product.id)
  const discount = product.originalPrice > product.price
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

  const avatarSrc = seller?.avatar
    || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seller?.name || 'user')}`

  return (
    <Link to={`/product/${product.id}`} className={`${styles.card} ${sold ? styles.cardSold : ''}`}>
      <div className={styles.imageWrapper}>
        <img
          src={product.images[0]}
          alt={product.title}
          className={styles.image}
          loading="lazy"
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/400x300?text=No+Image'
          }}
        />

        {/* Sold out overlay */}
        {sold && (
          <div className={styles.soldOverlay}>
            <span className={styles.soldLabel}>SOLD OUT</span>
          </div>
        )}

        {!sold && (
          <div className={styles.badges}>
            {product.isHot && <span className={`badge badge-hot ${styles.badge}`}>🔥 Hot</span>}
            {product.isAlmostSold && <span className={`badge badge-almost-sold ${styles.badge}`}>⚡ Hampir Habis</span>}
            {product.isNew && <span className={`badge badge-new ${styles.badge}`}>✨ Baru Masuk</span>}
          </div>
        )}

        {!sold && discount > 0 && (
          <div className={styles.discount}>-{discount}%</div>
        )}

        <div className={styles.views}>👁 {product.views || 0}</div>
      </div>

      <div className={styles.body}>
        <span
          className={styles.category}
          style={{ background: cat.bg, color: cat.color }}
        >
          {cat.label}
        </span>

        <h3 className={styles.title}>{product.title}</h3>

        <div className={styles.condition}>
          <span
            className={styles.conditionDot}
            style={{
              background: product.conditionScore >= 85
                ? '#10B981'
                : product.conditionScore >= 70
                ? '#F59E0B'
                : '#EF4444'
            }}
          ></span>
          {product.condition}
        </div>

        <div className={styles.priceRow}>
          <span className={styles.price}>Rp {product.price.toLocaleString('id-ID')}</span>
          {product.originalPrice > product.price && (
            <span className={styles.originalPrice}>Rp {product.originalPrice.toLocaleString('id-ID')}</span>
          )}
        </div>

        {seller && (
          <div className={styles.seller}>
            <img
              src={avatarSrc}
              alt={seller.name}
              className={styles.avatar}
              onError={(e) => {
                e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=fallback`
              }}
            />
            <div className={styles.sellerInfo}>
              <span className={styles.sellerName}>
                {seller.name}
                {seller.verified && <span className={styles.verified}>✓</span>}
              </span>
              <StarRating rating={seller.rating} />
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}
