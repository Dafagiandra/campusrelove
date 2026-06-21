import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { productAPI } from '../services/api'
import { useAuth } from './AuthContext'

const ProductContext = createContext(null)

/** Map snake_case DB row → camelCase expected by components */
const mapProduct = (p) => ({
  id:            p.id,
  title:         p.title,
  description:   p.description   || '',
  price:         Number(p.price) || 0,
  originalPrice: p.original_price  != null ? Number(p.original_price)  : (p.originalPrice != null ? Number(p.originalPrice) : null),
  category:      p.category      || '',
  condition:     p.condition     || '',
  conditionScore: p.condition_score ?? p.conditionScore ?? 75,
  sellerId:      p.seller_id     ?? p.sellerId,
  images:        parseJSON(p.images,  []),
  tags:          parseJSON(p.tags,    []),
  views:         p.views         || 0,
  isHot:         Boolean(p.is_hot         ?? p.isHot),
  isNew:         Boolean(p.is_new         ?? p.isNew),
  isAlmostSold:  Boolean(p.is_almost_sold ?? p.isAlmostSold),
  isSold:        Boolean(p.is_sold        ?? p.isSold),
  postedDate:    p.created_at ? p.created_at.split('T')[0] : (p.postedDate || ''),
  stock:         p.stock ?? 1,
  meetupPoints:  parseJSON(p.meetupPoints, ['Mall Terdekat', 'Stasiun', 'Kampus']),
})

function parseJSON(value, fallback) {
  if (Array.isArray(value)) return value
  if (value == null) return fallback
  try { return JSON.parse(value) } catch { return fallback }
}

export function ProductProvider({ children }) {
  const { user } = useAuth()
  const [allProducts, setAllProducts] = useState([])
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  /** Fetch all products from backend */
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await productAPI.getAll()
      if (data.success) {
        setAllProducts(data.products.map(mapProduct))
      }
    } catch (err) {
      setError(
        err.message?.includes('fetch')
          ? 'Tidak dapat terhubung ke server.'
          : (err.message || 'Gagal memuat produk')
      )
    } finally {
      setLoading(false)
    }
  }, [])

  // Load products on mount
  useEffect(() => { fetchProducts() }, [fetchProducts])

  /** Products belonging to current logged-in user */
  const userProducts = user
    ? allProducts.filter((p) => p.sellerId === user.id)
    : []

  const addProduct = async (product) => {
    try {
      const data = await productAPI.create({
        title:          product.title,
        description:    product.description || '',
        price:          product.price,
        originalPrice:  product.originalPrice || null,
        category:       product.category || null,
        condition:      product.condition || null,
        conditionScore: product.conditionScore || 75,
        images:         product.images || [],
        tags:           product.tags   || [],
      })
      if (data.success) {
        const mapped = mapProduct(data.product)
        setAllProducts((prev) => [mapped, ...prev])
        return mapped
      }
      throw new Error(data.message || 'Gagal menambah produk')
    } catch (err) {
      throw err
    }
  }

  const deleteProduct = async (productId) => {
    try {
      await productAPI.delete(productId)
      setAllProducts((prev) => prev.filter((p) => p.id !== productId))
    } catch (err) {
      throw err
    }
  }

  /** updateProduct: optimistic local update */
  const updateProduct = (productId, updates) => {
    setAllProducts((prev) =>
      prev.map((p) => p.id === productId ? { ...p, ...updates } : p)
    )
  }

  const getSellerProducts = (sellerId) => {
    return allProducts.filter((p) => p.sellerId === sellerId)
  }

  // Async version for when you need fresh data from API
  const fetchSellerProducts = async (sellerId) => {
    try {
      const data = await productAPI.getBySeller(sellerId)
      if (data.success) return data.products.map(mapProduct)
      return allProducts.filter((p) => p.sellerId === sellerId)
    } catch {
      return allProducts.filter((p) => p.sellerId === sellerId)
    }
  }

  return (
    <ProductContext.Provider value={{
      allProducts,
      userProducts,
      loading,
      error,
      addProduct,
      deleteProduct,
      updateProduct,
      getSellerProducts,
      fetchSellerProducts,
      refreshProducts: fetchProducts,
    }}>
      {children}
    </ProductContext.Provider>
  )
}

export function useProducts() {
  return useContext(ProductContext)
}
