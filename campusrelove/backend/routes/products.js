const express  = require('express')
const { pool } = require('../database/db')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

// ── GET /api/products ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { category, search, limit = 50, offset = 0 } = req.query
    let sql    = 'SELECT * FROM products WHERE is_sold = 0'
    const params = []

    if (category) { sql += ' AND category = ?'; params.push(category) }
    if (search)   { sql += ' AND title LIKE ?';  params.push(`%${search}%`) }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(limit), parseInt(offset))

    const [rows] = await pool.query(sql, params)
    res.json({ success: true, products: rows })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── GET /api/products/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' })
    // Increment views
    await pool.query('UPDATE products SET views = views + 1 WHERE id = ?', [req.params.id])
    res.json({ success: true, product: rows[0] })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── POST /api/products ────────────────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'seller') {
      return res.status(403).json({ success: false, message: 'Hanya penjual yang bisa upload produk' })
    }
    const { title, description, price, originalPrice, category, condition, conditionScore, images, tags } = req.body
    if (!title || !price) {
      return res.status(400).json({ success: false, message: 'Judul dan harga wajib diisi' })
    }

    const [result] = await pool.query(
      `INSERT INTO products (title, description, price, original_price, category, \`condition\`,
        condition_score, seller_id, images, tags, is_new)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [title, description || null, price, originalPrice || null, category || null,
       condition || null, conditionScore || 75, req.user.id,
       JSON.stringify(images || []), JSON.stringify(tags || [])]
    )

    const [rows] = await pool.query('SELECT * FROM products WHERE id = LAST_INSERT_ID()')
    res.status(201).json({ success: true, product: rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── DELETE /api/products/:id ──────────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT seller_id FROM products WHERE id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' })
    if (rows[0].seller_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Tidak punya akses' })
    }
    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id])
    res.json({ success: true, message: 'Produk dihapus' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── GET /api/products/seller/:sellerId ────────────────────────────────────────
router.get('/seller/:sellerId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM products WHERE seller_id = ? ORDER BY created_at DESC',
      [req.params.sellerId]
    )
    res.json({ success: true, products: rows })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

module.exports = router
