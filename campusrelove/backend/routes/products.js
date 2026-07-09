const express  = require('express')
const { pool } = require('../database/db')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

// ── GET /api/products ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { category, search, limit = 50, offset = 0 } = req.query
    // Hanya tampilkan produk aktif (belum terjual, listing belum kadaluarsa)
    let sql    = "SELECT * FROM products WHERE is_sold = 0 AND (listing_status = 'active' OR listing_status IS NULL)"
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
// Ambil produk by ID — TIDAK filter is_sold, supaya produk terjual tetap bisa dilihat
// untuk keperluan riwayat pesanan, rating, dll
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' })
    // Increment views hanya untuk produk yang masih aktif
    if (!rows[0].is_sold) {
      await pool.query('UPDATE products SET views = views + 1 WHERE id = ?', [req.params.id])
    }
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

    // ── Cek kuota listing ────────────────────────────────────────────────────
    // Hitung total produk seller (termasuk yang sudah terjual/expired)
    const [[{ totalUploads }]] = await pool.query(
      'SELECT COUNT(*) as totalUploads FROM products WHERE seller_id = ?',
      [req.user.id]
    )

    const isFree = Number(totalUploads) === 0  // kuota gratis hanya untuk upload pertama

    // Kalau bukan upload pertama, cek apakah ada listing_payment yang sudah dibayar
    // dan belum dipakai untuk upload produk baru
    if (!isFree) {
      const [unusedPayments] = await pool.query(
        `SELECT lp.* FROM listing_payments lp
         WHERE lp.seller_id = ?
           AND lp.status = 'paid'
           AND lp.product_id IS NULL
           AND lp.category = ?
         ORDER BY lp.paid_at DESC
         LIMIT 1`,
        [req.user.id, category || 'lainnya']
      )

      if (unusedPayments.length === 0) {
        // Tidak punya kuota — cek berapa harganya dan kasih pesan informatif
        const [feeRows] = await pool.query('SELECT * FROM listing_fees WHERE category = ?', [category || 'lainnya'])
        const fee = feeRows[0] || { price: 5000, duration_days: 7 }
        return res.status(402).json({
          success:        false,
          requiresPayment: true,
          fee:            Number(fee.price),
          duration:       fee.duration_days,
          category:       category,
          message:        `Upload produk ke-${Number(totalUploads) + 1} memerlukan biaya listing Rp ${Number(fee.price).toLocaleString('id-ID')} untuk kategori "${category}". Ajukan pembayaran listing terlebih dahulu.`
        })
      }
    }

    // ── Hitung tanggal kadaluarsa listing ────────────────────────────────────
    // Gratis (upload pertama) = 7 hari | Berbayar = 30 hari
    const durationDays = isFree ? 7 : 30

    const [result] = await pool.query(
      `INSERT INTO products (title, description, price, original_price, category, \`condition\`,
        condition_score, seller_id, images, tags, is_new,
        is_free_listing, listing_status, listing_expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'active', DATE_ADD(NOW(), INTERVAL ? DAY))`,
      [title, description || null, price, originalPrice || null, category || null,
       condition || null, conditionScore || 75, req.user.id,
       JSON.stringify(images || []), JSON.stringify(tags || []),
       isFree ? 1 : 0,
       durationDays]
    )

    const insertedId = result.insertId

    // Kalau bukan gratis, tandai payment sudah dipakai untuk produk ini
    if (!isFree) {
      const [unusedPayments] = await pool.query(
        `SELECT id FROM listing_payments
         WHERE seller_id = ? AND status = 'paid' AND product_id IS NULL AND category = ?
         ORDER BY paid_at DESC LIMIT 1`,
        [req.user.id, category || 'lainnya']
      )
      if (unusedPayments.length > 0) {
        await pool.query(
          'UPDATE listing_payments SET product_id = LAST_INSERT_ID() WHERE id = ?',
          [unusedPayments[0].id]
        )
      }
    }

    const [rows] = await pool.query('SELECT * FROM products WHERE id = LAST_INSERT_ID()')
    res.status(201).json({ success: true, product: rows[0], isFree })
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
// Ambil SEMUA produk seller (termasuk yang sudah terjual) untuk riwayat penjualan
router.get('/seller/:sellerId', async (req, res) => {
  try {
    const includeSold = req.query.includeSold === 'true'
    let sql = 'SELECT * FROM products WHERE seller_id = ?'
    if (!includeSold) sql += ' AND is_sold = 0'
    sql += ' ORDER BY created_at DESC'
    const [rows] = await pool.query(sql, [req.params.sellerId])
    res.json({ success: true, products: rows })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

module.exports = router
