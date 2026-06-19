const express  = require('express')
const { pool } = require('../database/db')
const { authMiddleware, adminOnly } = require('../middleware/auth')

const router = express.Router()

const PLATFORM_FEE_PERCENT = 2

// ── POST /api/orders ──────────────────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { productId, meetupPoint } = req.body
    const [products] = await pool.query('SELECT * FROM products WHERE id = ? AND is_sold = 0', [productId])
    if (products.length === 0) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan atau sudah terjual' })

    const product = products[0]
    if (product.seller_id === req.user.id) return res.status(400).json({ success: false, message: 'Tidak bisa membeli produk sendiri' })

    const platformFee  = Math.round(product.price * PLATFORM_FEE_PERCENT / 100)
    const sellerAmount = product.price - platformFee

    const [result] = await pool.query(
      `INSERT INTO orders (buyer_id, buyer_name, seller_id, product_id, product_title,
        price, platform_fee_percent, platform_fee, seller_amount, meetup_point, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment')`,
      [req.user.id, req.user.name || 'Pembeli', product.seller_id, productId,
       product.title, product.price, PLATFORM_FEE_PERCENT, platformFee, sellerAmount,
       meetupPoint || null]
    )

    // Notif ke admin
    await pool.query(
      `INSERT INTO notifications (recipient_id, type, message, order_id)
       VALUES ('admin-001', 'order_new', ?, LAST_INSERT_ID())`,
      [`📦 Pesanan baru dari ${req.user.name} untuk "${product.title}" — Rp ${product.price.toLocaleString('id-ID')}`]
    )

    const [order] = await pool.query('SELECT * FROM orders WHERE id = LAST_INSERT_ID()')
    res.status(201).json({ success: true, order: order[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── GET /api/orders/my ────────────────────────────────────────────────────────
router.get('/my', authMiddleware, async (req, res) => {
  try {
    let rows
    if (req.user.role === 'seller') {
      ;[rows] = await pool.query('SELECT * FROM orders WHERE seller_id = ? ORDER BY created_at DESC', [req.user.id])
    } else {
      ;[rows] = await pool.query('SELECT * FROM orders WHERE buyer_id = ? ORDER BY created_at DESC', [req.user.id])
    }
    res.json({ success: true, orders: rows })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── GET /api/orders/all (admin only) ─────────────────────────────────────────
router.get('/all', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC')
    res.json({ success: true, orders: rows })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── PUT /api/orders/:id/confirm-payment (admin) ───────────────────────────────
router.put('/:id/confirm-payment', authMiddleware, adminOnly, async (req, res) => {
  try {
    await pool.query(
      "UPDATE orders SET status = 'paid', paid_at = NOW(), escrow_status = 'holding' WHERE id = ? AND status = 'pending_payment'",
      [req.params.id]
    )
    const [order] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id])
    res.json({ success: true, order: order[0] })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── PUT /api/orders/:id/process (seller) ─────────────────────────────────────
router.put('/:id/process', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' })
    if (rows[0].seller_id !== req.user.id) return res.status(403).json({ success: false, message: 'Akses ditolak' })

    await pool.query("UPDATE orders SET status = 'processing', processed_at = NOW() WHERE id = ?", [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── PUT /api/orders/:id/ship (seller) ─────────────────────────────────────────
router.put('/:id/ship', authMiddleware, async (req, res) => {
  try {
    const { resi, codSchedule } = req.body
    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' })
    if (rows[0].seller_id !== req.user.id) return res.status(403).json({ success: false, message: 'Akses ditolak' })

    await pool.query(
      "UPDATE orders SET status = 'shipped', shipped_at = NOW(), resi = ?, cod_schedule = ? WHERE id = ?",
      [resi || null, codSchedule || null, req.params.id]
    )
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── PUT /api/orders/:id/confirm-delivery (buyer) ──────────────────────────────
router.put('/:id/confirm-delivery', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' })
    const order = rows[0]
    if (order.buyer_id !== req.user.id) return res.status(403).json({ success: false, message: 'Akses ditolak' })

    const platformFee  = order.platform_fee  || Math.round(order.price * PLATFORM_FEE_PERCENT / 100)
    const sellerAmount = order.seller_amount || (order.price - platformFee)

    await pool.query(
      "UPDATE orders SET status = 'completed', delivered_at = NOW(), completed_at = NOW(), escrow_status = 'released' WHERE id = ?",
      [req.params.id]
    )
    // Tambah saldo penjual
    await pool.query('UPDATE users SET balance = balance + ?, total_sales = total_sales + 1 WHERE id = ?', [sellerAmount, order.seller_id])
    // Tambah admin wallet
    await pool.query(
      'INSERT INTO admin_wallet (order_id, product_title, amount, type) VALUES (?, ?, ?, ?)',
      [order.id, order.product_title, platformFee, 'platform_fee']
    )
    // Tandai produk terjual
    await pool.query('UPDATE products SET is_sold = 1 WHERE id = ?', [order.product_id])

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── PUT /api/orders/:id/cancel ────────────────────────────────────────────────
router.put('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const { reason } = req.body
    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' })

    const order = rows[0]
    const cancellableStatuses = ['pending_payment', 'paid', 'processing']
    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Pesanan tidak bisa dibatalkan pada status ini' })
    }

    const isBuyer  = order.buyer_id  === req.user.id
    const isSeller = order.seller_id === req.user.id
    const isAdmin  = req.user.role   === 'admin'
    if (!isBuyer && !isSeller && !isAdmin) return res.status(403).json({ success: false, message: 'Akses ditolak' })

    const cancelledBy = isBuyer ? 'buyer' : isSeller ? 'seller' : 'admin'

    await pool.query(
      "UPDATE orders SET status = 'cancelled', cancel_reason = ?, cancelled_by = ?, cancelled_at = NOW(), escrow_status = 'refunded' WHERE id = ?",
      [reason || 'Dibatalkan', cancelledBy, req.params.id]
    )

    // Notif ke pembeli
    await pool.query(
      'INSERT INTO notifications (recipient_id, type, message, order_id) VALUES (?, ?, ?, ?)',
      [order.buyer_id, 'order_cancelled',
       `❌ Pesanan "${order.product_title}" dibatalkan. Alasan: ${reason || 'Tidak disebutkan'}. Dana akan dikembalikan.`,
       order.id]
    )
    // Notif ke penjual
    await pool.query(
      'INSERT INTO notifications (recipient_id, type, message, order_id) VALUES (?, ?, ?, ?)',
      [order.seller_id, 'order_cancelled',
       `❌ Pesanan "${order.product_title}" dari pembeli dibatalkan. Alasan: ${reason || 'Tidak disebutkan'}.`,
       order.id]
    )

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

module.exports = router
