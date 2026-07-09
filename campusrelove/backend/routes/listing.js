/**
 * listing.js — Endpoint untuk sistem biaya listing
 *
 * Logika:
 * - Penjual baru dapat 1 kuota upload GRATIS, listing aktif 7 hari
 * - Upload ke-2 atau listing kadaluarsa → wajib bayar sesuai kategori
 * - Admin bisa atur harga per kategori
 * - H-1 sebelum kadaluarsa → notifikasi otomatis (cek via cron/trigger)
 */
const express  = require('express')
const { pool } = require('../database/db')
const { authMiddleware, adminOnly } = require('../middleware/auth')

const router = express.Router()

// ── GET /api/listing/fees ─────────────────────────────────────────────────────
// Ambil semua harga listing per kategori (publik)
router.get('/fees', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM listing_fees ORDER BY category ASC')
    res.json({ success: true, fees: rows })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── PUT /api/listing/fees/:category (admin only) ──────────────────────────────
// Admin ubah harga listing untuk kategori tertentu
router.put('/fees/:category', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { price, duration_days } = req.body
    const { category } = req.params

    if (price === undefined || price < 0) {
      return res.status(400).json({ success: false, message: 'Harga tidak valid' })
    }

    await pool.query(
      `INSERT INTO listing_fees (category, price, duration_days)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE price = ?, duration_days = ?`,
      [category, price, duration_days || 7, price, duration_days || 7]
    )

    res.json({ success: true, message: `Harga listing kategori "${category}" berhasil diperbarui` })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── GET /api/listing/quota ────────────────────────────────────────────────────
// Cek kuota listing penjual yang sedang login
// Response: { hasFreeQuota, totalProducts, activeListings, expiringSoon }
router.get('/quota', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'seller') {
      return res.status(403).json({ success: false, message: 'Hanya untuk penjual' })
    }

    // Hitung total produk yang pernah diupload (termasuk yang sudah terjual)
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM products WHERE seller_id = ?',
      [req.user.id]
    )

    // Hitung listing aktif
    const [[{ active }]] = await pool.query(
      "SELECT COUNT(*) as active FROM products WHERE seller_id = ? AND is_sold = 0 AND listing_status = 'active'",
      [req.user.id]
    )

    // Listing yang mau kadaluarsa dalam 24 jam
    const [expiring] = await pool.query(
      `SELECT id, title, listing_expires_at FROM products
       WHERE seller_id = ? AND listing_status = 'active'
         AND listing_expires_at IS NOT NULL
         AND listing_expires_at <= DATE_ADD(NOW(), INTERVAL 24 HOUR)
         AND listing_expires_at > NOW()`,
      [req.user.id]
    )

    // Listing yang sudah kadaluarsa
    const [expired] = await pool.query(
      "SELECT id, title FROM products WHERE seller_id = ? AND listing_status = 'expired'",
      [req.user.id]
    )

    // Punya kuota gratis kalau belum pernah upload sama sekali
    const hasFreeQuota = Number(total) === 0

    res.json({
      success:       true,
      hasFreeQuota,
      totalProducts: Number(total),
      activeListings: Number(active),
      expiringSoon:  expiring,
      expiredListings: expired,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── GET /api/listing/fee-for/:category ───────────────────────────────────────
// Ambil harga listing untuk kategori tertentu
router.get('/fee-for/:category', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM listing_fees WHERE category = ?',
      [req.params.category]
    )
    if (rows.length === 0) {
      // Default kalau kategori belum ada di tabel
      return res.json({ success: true, fee: { category: req.params.category, price: 5000, duration_days: 7 } })
    }
    res.json({ success: true, fee: rows[0] })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── POST /api/listing/pay ─────────────────────────────────────────────────────
// Penjual simulasi bayar biaya listing (dalam produksi, ini terima bukti transfer)
// Admin yang confirm, mirip flow escrow produk
router.post('/pay', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'seller') {
      return res.status(403).json({ success: false, message: 'Hanya untuk penjual' })
    }

    const { category, productId, notes } = req.body
    if (!category) {
      return res.status(400).json({ success: false, message: 'Kategori wajib diisi' })
    }

    // Ambil harga listing untuk kategori ini
    const [feeRows] = await pool.query('SELECT * FROM listing_fees WHERE category = ?', [category])
    const fee = feeRows[0] || { price: 5000, duration_days: 7 }

    // Buat record pembayaran listing dengan status pending
    const [result] = await pool.query(
      `INSERT INTO listing_payments (seller_id, product_id, category, amount, status, notes)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [req.user.id, productId || null, category, fee.price, notes || null]
    )

    // Notif ke admin
    await pool.query(
      `INSERT INTO notifications (recipient_id, type, message)
       VALUES ('admin-001', 'listing_payment', ?)`,
      [`💳 ${req.user.name} mengajukan pembayaran listing kategori "${category}" Rp ${Number(fee.price).toLocaleString('id-ID')}. Harap verifikasi.`]
    )

    const [[payment]] = await pool.query('SELECT * FROM listing_payments WHERE id = LAST_INSERT_ID()')

    res.status(201).json({
      success:  true,
      payment,
      fee:      Number(fee.price),
      duration: 30,  // Masa aktif berbayar = 30 hari
      message:  `Pengajuan pembayaran listing berhasil dikirim. Admin akan memverifikasi dalam 1×24 jam. Listing aktif 30 hari setelah dikonfirmasi.`
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── PUT /api/listing/pay/:id/confirm (admin only) ─────────────────────────────
// Admin konfirmasi pembayaran listing → aktifkan listing produk
router.put('/pay/:id/confirm', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM listing_payments WHERE id = ?', [req.params.id])
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment tidak ditemukan' })
    }

    const payment = rows[0]
    if (payment.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Payment sudah diproses' })
    }

    // Ambil durasi dari fee tabel
    const [feeRows] = await pool.query('SELECT * FROM listing_fees WHERE category = ?', [payment.category])
    const duration = 30  // Listing berbayar aktif 30 hari (bukan 7 hari default gratis)

    // Update status payment
    await pool.query(
      "UPDATE listing_payments SET status = 'paid', paid_at = NOW() WHERE id = ?",
      [req.params.id]
    )

    // Kalau ada product_id, perpanjang/aktifkan listing-nya
    if (payment.product_id) {
      await pool.query(
        `UPDATE products SET
           listing_status = 'active',
           listing_expires_at = DATE_ADD(NOW(), INTERVAL ? DAY)
         WHERE id = ? AND seller_id = ?`,
        [duration, payment.product_id, payment.seller_id]
      )
    }

    // Simpan ke admin wallet (pemasukan dari biaya listing)
    await pool.query(
      `INSERT INTO admin_wallet (order_id, product_title, amount, type)
       VALUES (?, ?, ?, 'listing_fee')`,
      [payment.id, `Listing ${payment.category}`, payment.amount]
    )

    // Notif ke penjual
    await pool.query(
      `INSERT INTO notifications (recipient_id, type, message)
       VALUES (?, 'listing_confirmed', ?)`,
      [payment.seller_id, `✅ Pembayaran listing kamu untuk kategori "${payment.category}" sudah dikonfirmasi! Listing aktif selama ${duration} hari.`]
    )

    res.json({ success: true, message: 'Pembayaran listing dikonfirmasi' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── PUT /api/listing/pay/:id/reject (admin only) ──────────────────────────────
router.put('/pay/:id/reject', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { note } = req.body
    const [rows] = await pool.query('SELECT * FROM listing_payments WHERE id = ?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Payment tidak ditemukan' })

    const payment = rows[0]
    await pool.query(
      "UPDATE listing_payments SET status = 'pending', notes = ? WHERE id = ?",
      [`DITOLAK: ${note || 'Bukti pembayaran tidak valid'}`, req.params.id]
    )

    await pool.query(
      `INSERT INTO notifications (recipient_id, type, message)
       VALUES (?, 'listing_rejected', ?)`,
      [payment.seller_id, `❌ Pembayaran listing kamu ditolak. Alasan: ${note || 'Bukti tidak valid'}. Silakan ajukan ulang.`]
    )

    res.json({ success: true, message: 'Pembayaran listing ditolak' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── GET /api/listing/payments (admin only) ────────────────────────────────────
// Semua pembayaran listing yang masuk
router.get('/payments', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT lp.*, u.name as seller_name, u.email as seller_email, p.title as product_title
       FROM listing_payments lp
       LEFT JOIN users u ON lp.seller_id = u.id
       LEFT JOIN products p ON lp.product_id = p.id
       ORDER BY lp.created_at DESC`
    )
    res.json({ success: true, payments: rows })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── POST /api/listing/renew/:productId ────────────────────────────────────────
// Penjual minta perpanjang listing produk yang hampir/sudah kadaluarsa
router.post('/renew/:productId', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ? AND seller_id = ?', [req.params.productId, req.user.id])
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' })

    const product = rows[0]

    // Buat payment request untuk perpanjangan
    const [feeRows] = await pool.query('SELECT * FROM listing_fees WHERE category = ?', [product.category])
    const fee = feeRows[0] || { price: 5000, duration_days: 7 }

    const [result] = await pool.query(
      `INSERT INTO listing_payments (seller_id, product_id, category, amount, status, notes)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [req.user.id, product.id, product.category, fee.price, `Perpanjangan listing: ${product.title}`]
    )

    await pool.query(
      `INSERT INTO notifications (recipient_id, type, message)
       VALUES ('admin-001', 'listing_renew', ?)`,
      [`🔄 ${req.user.name} mengajukan perpanjangan listing "${product.title}" (${product.category}) Rp ${Number(fee.price).toLocaleString('id-ID')}.`]
    )

    res.status(201).json({
      success:  true,
      fee:      Number(fee.price),
      duration: 30,  // Perpanjangan berbayar = 30 hari
      message:  'Pengajuan perpanjangan berhasil. Admin akan verifikasi dalam 1×24 jam. Listing aktif 30 hari setelah dikonfirmasi.',
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── POST /api/listing/check-expiry (internal/cron) ───────────────────────────
// Cek listing yang kadaluarsa dan kirim notifikasi H-1
// Bisa dipanggil dari cron job atau saat penjual buka dashboard
router.post('/check-expiry', authMiddleware, async (req, res) => {
  try {
    // Update listing yang sudah kadaluarsa ke status 'expired'
    const [expiredResult] = await pool.query(
      `UPDATE products SET listing_status = 'expired'
       WHERE listing_status = 'active'
         AND listing_expires_at IS NOT NULL
         AND listing_expires_at < NOW()
         AND is_sold = 0`
    )

    // Kirim notifikasi H-1 (belum dapat notif hari ini)
    const [soonExpiring] = await pool.query(
      `SELECT p.id, p.title, p.seller_id, p.listing_expires_at, u.name as seller_name
       FROM products p
       JOIN users u ON p.seller_id = u.id
       WHERE p.listing_status = 'active'
         AND p.listing_expires_at IS NOT NULL
         AND p.listing_expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 25 HOUR)
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.recipient_id = p.seller_id
             AND n.type = 'listing_expiry_warning'
             AND n.message LIKE CONCAT('%', p.id, '%')
             AND n.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
         )`
    )

    for (const p of soonExpiring) {
      const expiresAt = new Date(p.listing_expires_at).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
      await pool.query(
        `INSERT INTO notifications (recipient_id, type, message)
         VALUES (?, 'listing_expiry_warning', ?)`,
        [p.seller_id, `⏰ Listing "${p.title}" (ID: ${p.id}) akan kadaluarsa besok (${expiresAt}). Segera perpanjang agar tetap tampil di Browse!`]
      )
    }

    res.json({
      success: true,
      expiredCount: expiredResult.affectedRows,
      notificationsSent: soonExpiring.length,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

module.exports = router
