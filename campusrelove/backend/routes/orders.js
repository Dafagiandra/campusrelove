const express  = require('express')
const { pool } = require('../database/db')
const { authMiddleware, adminOnly } = require('../middleware/auth')

const router = express.Router()

const PLATFORM_FEE_PERCENT = 0  // Pemasukan admin hanya dari biaya listing, bukan komisi transaksi

// ── POST /api/orders ──────────────────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { productId, meetupPoint, paymentMethod, isOfflinePayment } = req.body
    const [products] = await pool.query('SELECT * FROM products WHERE id = ? AND is_sold = 0', [productId])
    if (products.length === 0) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan atau sudah terjual' })

    const product = products[0]
    if (product.seller_id === req.user.id) return res.status(400).json({ success: false, message: 'Tidak bisa membeli produk sendiri' })

    const sellerAmount = product.price  // 0% komisi, penjual terima penuh
    const isCodCash    = paymentMethod === 'cod_cash'

    // cod_cash = transaksi offline, langsung completed + product marked sold
    const initialStatus = isCodCash ? 'completed' : 'pending_payment'

    const [result] = await pool.query(
      `INSERT INTO orders (buyer_id, buyer_name, seller_id, product_id, product_title,
        price, platform_fee_percent, platform_fee, seller_amount, meetup_point, status, payment_method)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`,
      [req.user.id, req.user.name || 'Pembeli', product.seller_id, productId,
       product.title, product.price, sellerAmount,
       meetupPoint || null, initialStatus, paymentMethod || 'transfer_escrow']
    )

    // cod_cash: tandai produk terjual langsung (transaksi sudah selesai di tempat)
    if (isCodCash) {
      await pool.query('UPDATE products SET is_sold = 1 WHERE id = ?', [productId])
    }

    // Notif ke admin (kecuali cod_cash yang offline)
    if (!isCodCash) {
      await pool.query(
        `INSERT INTO notifications (recipient_id, type, message, order_id)
         VALUES ('admin-001', 'order_new', ?, LAST_INSERT_ID())`,
        [`📦 Pesanan baru dari ${req.user.name} untuk "${product.title}" — Rp ${product.price.toLocaleString('id-ID')}`]
      )
    }

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

    const platformFee  = 0  // 0% komisi — penjual terima penuh
    const sellerAmount = order.price

    await pool.query(
      "UPDATE orders SET status = 'completed', delivered_at = NOW(), completed_at = NOW(), escrow_status = 'released' WHERE id = ?",
      [req.params.id]
    )
    // Tambah saldo penjual
    await pool.query('UPDATE users SET balance = balance + ?, total_sales = total_sales + 1 WHERE id = ?', [sellerAmount, order.seller_id])
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

// ── POST /api/orders/:id/complain (buyer) ─────────────────────────────────────
// Pembeli ajukan komplain SEBELUM konfirmasi terima — dana ditahan admin
router.post('/:id/complain', authMiddleware, async (req, res) => {
  try {
    const { reason, description } = req.body
    if (!reason) return res.status(400).json({ success: false, message: 'Alasan komplain wajib diisi' })

    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' })

    const order = rows[0]
    if (order.buyer_id !== req.user.id) return res.status(403).json({ success: false, message: 'Bukan pesananmu' })
    if (!['shipped', 'processing', 'paid'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Komplain hanya bisa diajukan saat pesanan aktif' })
    }

    // Cek komplain aktif sudah ada
    const [existing] = await pool.query(
      "SELECT id FROM complaints WHERE order_id = ? AND status = 'open'", [req.params.id]
    )
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Sudah ada komplain aktif untuk pesanan ini' })
    }

    await pool.query(
      `INSERT INTO complaints (order_id, buyer_id, seller_id, reason, description)
       VALUES (?, ?, ?, ?, ?)`,
      [order.id, order.buyer_id, order.seller_id, reason, description || null]
    )

    // Notif ke admin
    await pool.query(
      `INSERT INTO notifications (recipient_id, type, message, order_id)
       VALUES ('admin-001', 'complaint', ?, ?)`,
      [`⚠️ Komplain masuk dari ${req.user.name} untuk pesanan "${order.product_title}". Alasan: ${reason}`, order.id]
    )
    // Notif ke penjual
    await pool.query(
      `INSERT INTO notifications (recipient_id, type, message, order_id)
       VALUES (?, 'complaint', ?, ?)`,
      [order.seller_id, `⚠️ Pembeli mengajukan komplain untuk pesanan "${order.product_title}". Admin sedang meninjau.`, order.id]
    )

    res.status(201).json({ success: true, message: 'Komplain berhasil diajukan. Admin akan meninjau dalam 1×24 jam.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── GET /api/orders/complaints (admin only) ────────────────────────────────────
router.get('/complaints/all', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' })
    const [rows] = await pool.query(
      `SELECT c.*, o.product_title, o.price, o.status as order_status,
              ub.name as buyer_name, us.name as seller_name
       FROM complaints c
       JOIN orders o ON c.order_id = o.id
       JOIN users ub ON c.buyer_id = ub.id
       JOIN users us ON c.seller_id = us.id
       ORDER BY c.created_at DESC`
    )
    res.json({ success: true, complaints: rows })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── PUT /api/orders/complaints/:id/resolve (admin only) ───────────────────────
// Admin putuskan: refund ke pembeli ATAU teruskan ke penjual
router.put('/complaints/:id/resolve', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' })
    const { decision, adminNote } = req.body  // decision: 'refund' | 'release'
    if (!['refund', 'release'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision harus "refund" atau "release"' })
    }

    const [rows] = await pool.query(
      'SELECT c.*, o.price, o.seller_id, o.buyer_id, o.product_title FROM complaints c JOIN orders o ON c.order_id = o.id WHERE c.id = ?',
      [req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Komplain tidak ditemukan' })
    const complaint = rows[0]
    if (complaint.status !== 'open') return res.status(400).json({ success: false, message: 'Komplain sudah diselesaikan' })

    const resolvedStatus = decision === 'refund' ? 'resolved_refund' : 'resolved_release'

    // Update complaint
    await pool.query(
      `UPDATE complaints SET status = ?, admin_note = ?, resolved_at = NOW() WHERE id = ?`,
      [resolvedStatus, adminNote || null, req.params.id]
    )

    if (decision === 'release') {
      // Teruskan dana ke penjual — sama seperti confirm-delivery
      await pool.query(
        "UPDATE orders SET status = 'completed', completed_at = NOW(), escrow_status = 'released' WHERE id = ?",
        [complaint.order_id]
      )
      await pool.query(
        'UPDATE users SET balance = balance + ?, total_sales = total_sales + 1 WHERE id = ?',
        [complaint.price, complaint.seller_id]
      )
      await pool.query('UPDATE products SET is_sold = 1 WHERE id = (SELECT product_id FROM orders WHERE id = ?)', [complaint.order_id])

      // Notif ke penjual
      await pool.query(
        `INSERT INTO notifications (recipient_id, type, message, order_id) VALUES (?, 'complaint_resolved', ?, ?)`,
        [complaint.seller_id, `✅ Admin memutuskan dana untuk "${complaint.product_title}" dicairkan ke kamu. Terima kasih!`, complaint.order_id]
      )
      // Notif ke pembeli
      await pool.query(
        `INSERT INTO notifications (recipient_id, type, message, order_id) VALUES (?, 'complaint_resolved', ?, ?)`,
        [complaint.buyer_id, `ℹ️ Admin memutuskan: dana untuk "${complaint.product_title}" diteruskan ke penjual. ${adminNote ? 'Catatan: ' + adminNote : ''}`, complaint.order_id]
      )
    } else {
      // Refund ke pembeli — batalkan order, kembalikan dana
      await pool.query(
        "UPDATE orders SET status = 'cancelled', cancel_reason = ?, cancelled_by = 'admin', cancelled_at = NOW(), escrow_status = 'refunded' WHERE id = ?",
        [`Refund: ${adminNote || 'Keputusan admin setelah komplain'}`, complaint.order_id]
      )
      // Kembalikan saldo ke pembeli
      await pool.query(
        'UPDATE users SET balance = balance + ? WHERE id = ?',
        [complaint.price, complaint.buyer_id]
      )
      // Notif ke pembeli
      await pool.query(
        `INSERT INTO notifications (recipient_id, type, message, order_id) VALUES (?, 'complaint_resolved', ?, ?)`,
        [complaint.buyer_id, `✅ Komplain kamu untuk "${complaint.product_title}" disetujui. Dana Rp ${Number(complaint.price).toLocaleString('id-ID')} dikembalikan ke saldo kamu.`, complaint.order_id]
      )
      // Notif ke penjual
      await pool.query(
        `INSERT INTO notifications (recipient_id, type, message, order_id) VALUES (?, 'complaint_resolved', ?, ?)`,
        [complaint.seller_id, `ℹ️ Admin memutuskan refund untuk "${complaint.product_title}". ${adminNote ? 'Catatan: ' + adminNote : ''}`, complaint.order_id]
      )
    }

    res.json({ success: true, message: `Komplain diselesaikan: ${decision === 'refund' ? 'dana dikembalikan ke pembeli' : 'dana diteruskan ke penjual'}` })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})
