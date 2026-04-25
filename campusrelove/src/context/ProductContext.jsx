import { createContext, useContext, useState, useEffect } from 'react'
import { products as defaultProducts } from '../data/products'

const ProductContext = createContext(null)

const STORAGE_KEY = 'cr_products'

// Ambil produk user dari localStorage
const getStoredProducts = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

const saveProducts = (products) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products))
}

export function ProductProvider({ children }) {
  // userProducts = produk yang diupload penjual (disimpan di localStorage)
  const [userProducts, setUserProducts] = useState(getStoredProducts)

  // allProducts = gabungan produk bawaan + produk user
  const allProducts = [...defaultProducts, ...userProducts]

  const addProduct = (product) => {
    const newProduct = {
      ...product,
      id: `up_${Date.now()}`,
      views: 0,
      isHot: false,
      isAlmostSold: false,
      isNew: true,
      postedDate: new Date().toISOString().split('T')[0],
      stock: 1,
      tags: product.tags || [],
      meetupPoints: product.meetupPoints || ['Perpustakaan Pusat', 'Gerbang Utama'],
    }
    const updated = [newProduct, ...userProducts]
    setUserProducts(updated)
    saveProducts(updated)
    return newProduct
  }

  const deleteProduct = (productId) => {
    const updated = userProducts.filter((p) => p.id !== productId)
    setUserProducts(updated)
    saveProducts(updated)
  }

  const updateProduct = (productId, updates) => {
    const updated = userProducts.map((p) =>
      p.id === productId ? { ...p, ...updates } : p
    )
    setUserProducts(updated)
    saveProducts(updated)
  }

  const getSellerProducts = (sellerId) => {
    return allProducts.filter((p) => p.sellerId === sellerId)
  }

  return (
    <ProductContext.Provider value={{
      allProducts,
      userProducts,
      addProduct,
      deleteProduct,
      updateProduct,
      getSellerProducts,
    }}>
      {children}
    </ProductContext.Provider>
  )
}

export function useProducts() {
  return useContext(ProductContext)
}
