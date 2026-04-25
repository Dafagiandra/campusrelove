import { Link } from 'react-router-dom'
import { categories } from '../../data/products'
import { useProducts } from '../../context/ProductContext'
import ProductCard from '../../components/ProductCard/ProductCard'
import styles from './Home.module.css'

function HeroSection() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroContent}>
        <div className={styles.heroBadge}>🎓 Khusus Mahasiswa Terverifikasi</div>
        <h1 className={styles.heroTitle}>
          Dari Kakak Tingkat,<br />
          <span className={styles.heroAccent}>Untuk Adik Tingkat.</span>
        </h1>
        <p className={styles.heroDesc}>
          Marketplace thrifting & furniture antar mahasiswa. Hemat lebih banyak, bantu sesama, dan jaga lingkungan kampus tetap hijau. 🌱
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
            <span className={styles.statNum}>2.4K+</span>
            <span className={styles.statLabel}>Barang Terjual</span>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.stat}>
            <span className={styles.statNum}>1.2K+</span>
            <span className={styles.statLabel}>Mahasiswa Aktif</span>
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
          <span>🪑</span> Lemari 2 Pintu<br /><strong>Rp 350.000</strong>
        </div>
        <div className={styles.floatingCard} style={{ '--delay': '0.5s', '--x': '60%', '--y': '5%' }}>
          <span>💻</span> Laptop ASUS<br /><strong>Rp 3.200.000</strong>
        </div>
        <div className={styles.floatingCard} style={{ '--delay': '1s', '--x': '75%', '--y': '55%' }}>
          <span>📚</span> Buku Kalkulus<br /><strong>Rp 120.000</strong>
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
  const cats = categories.filter((c) => c.id !== 'all')
  const catDetails = [
    { id: 'furniture', icon: '🪑', label: 'Furniture', desc: 'Lemari, meja, kasur & lebih', count: 124, gradient: 'linear-gradient(135deg, #7C3AED, #2563EB)' },
    { id: 'electronic', icon: '💻', label: 'Electronic', desc: 'Laptop, kipas, rice cooker', count: 89, gradient: 'linear-gradient(135deg, #10B981, #059669)' },
    { id: 'academic', icon: '📚', label: 'Academic Supplies', desc: 'Buku, alat tulis & lebih', count: 67, gradient: 'linear-gradient(135deg, #F59E0B, #EF4444)' },
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
  // Show newest products: user-uploaded first, then static new ones
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
    { icon: '🎓', title: 'Verifikasi KTM', desc: 'Semua penjual & pembeli terverifikasi dengan KTM kampus. Transaksi lebih aman dan terpercaya.', color: '#7C3AED' },
    { icon: '📍', title: 'Meet-up Planner', desc: 'Pilih titik temu aman di kampus. COD di lokasi yang sudah dikenal dan ramai.', color: '#2563EB' },
    { icon: '🚚', title: 'Relove-Carry', desc: 'Jasa angkut lokal antar kos di sekitar kampus. Estimasi biaya transparan.', color: '#10B981' },
    { icon: '⭐', title: 'Rating & Reputasi', desc: 'Sistem rating dan ulasan dari sesama mahasiswa. Pilih penjual terpercaya.', color: '#F59E0B' },
  ]

  return (
    <section className={styles.features}>
      <div className="container">
        <h2 className="section-title" style={{ textAlign: 'center' }}>Kenapa CampusRelove?</h2>
        <p className="section-subtitle" style={{ textAlign: 'center' }}>Dirancang khusus untuk kebutuhan mahasiswa</p>
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
            <p>Jual sekarang dan bantu adik tingkat yang membutuhkan. Proses mudah, aman, dan cepat!</p>
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
            <span>🪑</span><span>💻</span><span>📚</span><span>🍳</span><span>🎒</span>
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
