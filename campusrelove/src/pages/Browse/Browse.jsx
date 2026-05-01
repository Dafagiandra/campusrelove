import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { categories } from '../../data/products'
import { useProducts } from '../../context/ProductContext'
import ProductCard from '../../components/ProductCard/ProductCard'
import styles from './Browse.module.css'

const sortOptions = [
  { value: 'newest', label: '🕐 Terbaru' },
  { value: 'price-asc', label: '💰 Harga Terendah' },
  { value: 'price-desc', label: '💎 Harga Tertinggi' },
  { value: 'popular', label: '🔥 Terpopuler' },
]

export default function Browse() {
  const { allProducts } = useProducts()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState(searchParams.get('cat') || 'all')
  const [sort, setSort] = useState('newest')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [conditionFilter, setConditionFilter] = useState('all')

  useEffect(() => {
    const cat = searchParams.get('cat')
    if (cat) setActiveCategory(cat)
  }, [searchParams])

  const filtered = useMemo(() => {
    let result = [...allProducts]

    if (activeCategory !== 'all') {
      result = result.filter((p) => p.category === activeCategory)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.tags || []).some((t) => t.includes(q))
      )
    }

    if (priceMin) result = result.filter((p) => p.price >= Number(priceMin))
    if (priceMax) result = result.filter((p) => p.price <= Number(priceMax))

    if (conditionFilter !== 'all') {
      result = result.filter((p) => p.conditionScore >= Number(conditionFilter))
    }

    switch (sort) {
      case 'price-asc': result.sort((a, b) => a.price - b.price); break
      case 'price-desc': result.sort((a, b) => b.price - a.price); break
      case 'popular': result.sort((a, b) => b.views - a.views); break
      default: result.sort((a, b) => new Date(b.postedDate) - new Date(a.postedDate))
    }

    return result
  }, [allProducts, activeCategory, search, sort, priceMin, priceMax, conditionFilter])

  const handleCategoryClick = (catId) => {
    setActiveCategory(catId)
    if (catId !== 'all') {
      setSearchParams({ cat: catId })
    } else {
      setSearchParams({})
    }
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className="container">
          <h1 className={styles.title}>Browse Barang</h1>
          <p className={styles.subtitle}>
            {filtered.length} barang ditemukan{activeCategory !== 'all' ? ` di kategori ${categories.find(c => c.id === activeCategory)?.label}` : ''}
          </p>

          {/* Search */}
          <div className={styles.searchBar}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Cari barang, misal: laptop, lemari, buku kalkulus..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
            {search && (
              <button className={styles.clearSearch} onClick={() => setSearch('')}>✕</button>
            )}
          </div>
        </div>
      </div>

      <div className="container">
        <div className={styles.layout}>
          {/* Sidebar Filters */}
          <aside className={styles.sidebar}>
            <div className={styles.filterSection}>
              <h3 className={styles.filterTitle}>📂 Kategori</h3>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`${styles.catBtn} ${activeCategory === cat.id ? styles.catBtnActive : ''}`}
                  onClick={() => handleCategoryClick(cat.id)}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span className={styles.catBtnCount}>
                    {cat.id === 'all'
                      ? allProducts.length
                      : allProducts.filter(p => p.category === cat.id).length}                  </span>
                </button>
              ))}
            </div>

            <div className={styles.filterSection}>
              <h3 className={styles.filterTitle}>💰 Rentang Harga</h3>
              <div className={styles.priceInputs}>
                <input
                  type="number"
                  placeholder="Min"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className={styles.priceInput}
                />
                <span>–</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className={styles.priceInput}
                />
              </div>
            </div>

            <div className={styles.filterSection}>
              <h3 className={styles.filterTitle}>🔧 Kondisi Minimum</h3>
              {[
                { value: 'all', label: 'Semua Kondisi' },
                { value: '85', label: '⭐ Sangat Baik (85%+)' },
                { value: '70', label: '👍 Baik (70%+)' },
                { value: '50', label: '✅ Cukup (50%+)' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.catBtn} ${conditionFilter === opt.value ? styles.catBtnActive : ''}`}
                  onClick={() => setConditionFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              className={styles.resetBtn}
              onClick={() => {
                setSearch('')
                setActiveCategory('all')
                setSort('newest')
                setPriceMin('')
                setPriceMax('')
                setConditionFilter('all')
                setSearchParams({})
              }}
            >
              🔄 Reset Filter
            </button>
          </aside>

          {/* Main Content */}
          <div className={styles.main}>
            {/* Sort Bar */}
            <div className={styles.sortBar}>
              <span className={styles.resultCount}>{filtered.length} barang</span>
              <div className={styles.sortOptions}>
                {sortOptions.map((opt) => (
                  <button
                    key={opt.value}
                    className={`${styles.sortBtn} ${sort === opt.value ? styles.sortBtnActive : ''}`}
                    onClick={() => setSort(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            {filtered.length > 0 ? (
              <div className={styles.grid}>
                {filtered.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🔍</div>
                <h3>Barang tidak ditemukan</h3>
                <p>Coba ubah filter atau kata kunci pencarian kamu</p>
                <button
                  className="btn-primary"
                  onClick={() => {
                    setSearch('')
                    setActiveCategory('all')
                    setSearchParams({})
                  }}
                >
                  Reset Pencarian
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
