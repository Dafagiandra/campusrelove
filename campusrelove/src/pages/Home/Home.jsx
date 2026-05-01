import { Link } from 'react-router-dom'
import { categories } from '../../data/products'
import { useProducts } from '../../context/ProductContext'
import ProductCard from '../../components/ProductCard/ProductCard'
import styles from './Home.module.css'

function HeroSection() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroContent}>
        <div className={styles.heroBadge}>✅ Terverifikasi & Terpercaya</div>
        <h1 className={styles.heroTitle}>
          Barang Bekas,<br />
          <span className={styles.heroAccent}>Nilai Baru.</span>
        </h1>
        <p className={styles.heroDesc}>
          Marketplace jual beli barang preloved terpercaya. Temukan barang berkualitas dengan harga terjangkau, atau jual barang yang sudah tidak terpakai. 🌱
        </p>
        <div className={styles.heroActions}>
          <Link to="/browse" className="btn-primary">
            🛍️ Mulai Belanja
          </Link>
          <Link to="/dashboard" className="btn-secondary">
            📦 Jual Barangmu
          </Link>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.stat}>
            <span className={styles.statNum}>24K+</span>
            <span className={styles.statLabel}>Barang Terjual</span>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.stat}>
            <span className={styles.statNum}>12K+</span>
            <span className={styles.statLabel}>Pengguna Aktif</span>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.stat}>
            <span className={styles.statNum}>98%</span>
            <span className={styles.statLabel}>Transaksi Aman</span>
          </div>
        </div>
      </div>
      <div className={styles.heroVisual}>
        <div className={styles.floatingCard} style={{ '--delay': '0s', '--x': '10%', '--y': '15%' }}>
          <span>👕</span> Jaket Denim<br /><strong>Rp 120.000</strong>
        </div>
        <div className={styles.floatingCard} style={{ '--delay': '0.5s', '--x': '60%', '--y': '5%' }}>
          <span>💻</span> Laptop ASUS<br /><strong>Rp 3.200.000</strong>
        </div>
        <div className={styles.floatingCard} style={{ '--delay': '1s', '--x': '75%', '--y': '55%' }}>
          <span>🪑</span> Lemari 2 Pintu<br /><strong>Rp 350.000</strong>
        </div>
        <div className={styles.heroIllustration}>
          <div className={styles.circle1}></div>
          <div className={styles.circle2}></div>
          <div className={styles.circle3}></div>
          <div className={styles.heroEmoji}>♻️</div>
        </div>
      </div>
    </section>
  )
}

function CategorySection() {
  const catDetails = [
    { id: 'fashion',    icon: '👕', label: 'Fashion',    desc: 'Baju, sepatu, tas & aksesoris',  count: 312, gradient: 'linear-gradient(135deg, #EC4899, #F43F5E)' },
    { id: 'electronic', icon: '💻', label: 'Electronic', desc: 'Laptop, HP, gadget & elektronik', count: 189, gradient: 'linear-gradient(135deg, #10B981, #059669)' },
    { id: 'furniture',  icon: '🪑', label: 'Furniture',  desc: 'Lemari, meja, kasur & dekorasi',  count: 124, gradient: 'linear-gradient(135deg, #7C3AED, #2563EB)' },
    { id: 'hobi',       icon: '🎮', label: 'Hobi',       desc: 'Game, olahraga, koleksi & seni',  count: 98,  gradient: 'linear-gradient(135deg, #F59E0B, #EF4444)' },
    { id: 'otomotif',   icon: '🏍️', label: 'Otomotif',   desc: 'Sparepart, aksesoris kendaraan',  count: 67,  gradient: 'linear-gradient(135deg, #EF4444, #DC2626)' },
  ]

  return (
    <section className={styles.categories}>
      <div className="container">
        <h2 className="section-title">Kategori Populer</h2>
        <p className="section-subtitle">Temukan barang yang kamu butuhkan berdasarkan kategori</p>
        <div className={styles.catGrid}>
          {catDetails.map((cat) => (
            <Link key={cat.id} to={`/browse?cat=${cat.id}`} className={styles.catCard}>
              <div className={styles.catIcon} style={{ background: cat.gradient }}>
                {cat.icon}
              </div>
              <div className={styles.catInfo}>
                <h3>{cat.label}</h3>
                <p>{cat.desc}</p>
                <span className={styles.catCount}>{cat.count} barang</span>
              </div>
              <span className={styles.catArrow}>→</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function HotItemsSection() {
  const { allProducts } = useProducts()
  const hotProducts = allProducts.filter((p) => p.isHot).slice(0, 4)

  return (
    <section className={styles.hotItems}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <div>
            <h2 className="section-title">🔥 Hot Items</h2>
            <p className="section-subtitle">Barang paling banyak dilihat & hampir terjual!</p>
          </div>
          <Link to="/browse" className="btn-secondary">Lihat Semua →</Link>
        </div>
        <div className={styles.productGrid}>
          {hotProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  )
}

function NewArrivalsSection() {
  const { allProducts } = useProducts()
  const newProducts = allProducts
    .filter((p) => p.isNew || p.id.startsWith('up_'))
    .slice(0, 4)

  return (
    <section className={styles.newArrivals}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <div>
            <h2 className="section-title">✨ Baru Masuk</h2>
            <p className="section-subtitle">Barang fresh yang baru diposting hari ini</p>
          </div>
          <Link to="/browse" className="btn-secondary">Lihat Semua →</Link>
        </div>
        <div className={styles.productGrid}>
          {newProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureSection() {
  const features = [
    { icon: '✅', title: 'Verifikasi Identitas', desc: 'Semua penjual & pembeli terverifikasi dengan KTP/ID. Transaksi lebih aman dan terpercaya.', color: '#7C3AED' },
    { icon: '📍', title: 'Meet-up Planner', desc: 'Pilih titik temu aman di lokasi publik. COD di tempat yang ramai dan mudah dijangkau.', color: '#2563EB' },
    { icon: '🚚', title: 'Preloved-Carry', desc: 'Jasa angkut barang lokal ke seluruh kota. Estimasi biaya transparan dan carrier terverifikasi.', color: '#10B981' },
    { icon: '⭐', title: 'Rating & Reputasi', desc: 'Sistem rating dan ulasan dari sesama pengguna. Pilih penjual terpercaya dengan mudah.', color: '#F59E0B' },
  ]

  return (
    <section className={styles.features}>
      <div className="container">
        <h2 className="section-title" style={{ textAlign: 'center' }}>Kenapa Preloved?</h2>
        <p className="section-subtitle" style={{ textAlign: 'center' }}>Platform jual beli barang bekas yang aman, mudah, dan terpercaya untuk semua orang</p>
        <div className={styles.featGrid}>
          {features.map((f) => (
            <div key={f.title} className={styles.featCard}>
              <div className={styles.featIcon} style={{ background: `${f.color}20`, color: f.color }}>
                {f.icon}
              </div>
              <h3 className={styles.featTitle}>{f.title}</h3>
              <p className={styles.featDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTASection() {
  return (
    <section className={styles.cta}>
      <div className="container">
        <div className={styles.ctaBox}>
          <div className={styles.ctaContent}>
            <h2>Punya barang yang nggak terpakai?</h2>
            <p>Jual sekarang dan dapatkan uang tambahan. Proses mudah, aman, dan cepat. Barang bekasmu bisa jadi rezeki orang lain!</p>
            <div className={styles.ctaActions}>
              <Link to="/dashboard" className={styles.ctaBtn}>
                📦 Mulai Jual Sekarang
              </Link>
              <Link to="/browse" className={styles.ctaBtnOutline}>
                🛍️ Lihat Barang
              </Link>
            </div>
          </div>
          <div className={styles.ctaEmojis}>
            <span>👕</span><span>💻</span><span>🪑</span><span>🎮</span><span>🏍️</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <div>
      <HeroSection />
      <CategorySection />
      <HotItemsSection />
      <FeatureSection />
      <NewArrivalsSection />
      <CTASection />
    </div>
  )
}
