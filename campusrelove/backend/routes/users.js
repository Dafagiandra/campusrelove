const express  = require('express')
const { pool } = require('../database/db')
const { authMiddleware, adminOnly } = require('../middleware/auth')

const router = express.Router()

// ── GET /api/users (admin only) ───────────────────────────────────────────────
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, city, phone, avatar, balance, verified, verification_status, rejection_note, join_date, created_at FROM users ORDER BY created_at DESC'
    )
    res.json({ success: true, users: rows })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── GET /api/users/pending-verif (admin only) ─────────────────────────────────
router.get('/pending-verif', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, role, city, phone, avatar, verification_status, ktp_photo, selfie_photo, join_date FROM users WHERE verification_status = 'pending' AND (ktp_photo IS NOT NULL OR selfie_photo IS NOT NULL)"
    )
    res.json({ success: true, users: rows })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── PUT /api/users/:id/approve (admin only) ───────────────────────────────────
router.put('/:id/approve', authMiddleware, adminOnly, async (req, res) => {
  try {
    await pool.query(
      "UPDATE users SET verified = 1, verification_status = 'approved', verification_date = NOW() WHERE id = ?",
      [req.params.id]
    )
    // Notif ke user
    await pool.query(
      "INSERT INTO notifications (recipient_id, type, message) VALUES (?, 'verif', ?)",
      [req.params.id, '✅ Identitas kamu sudah diverifikasi oleh Admin! Akun kamu kini aktif penuh.']
    )
    res.json({ success: true, message: 'User diverifikasi' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── PUT /api/users/:id/reject (admin only) ────────────────────────────────────
router.put('/:id/reject', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { note } = req.body
    const rejectionNote = note || 'Identitas tidak valid'
    await pool.query(
      "UPDATE users SET verified = 0, verification_status = 'rejected', rejection_note = ?, verification_date = NOW() WHERE id = ?",
      [rejectionNote, req.params.id]
    )
    // Notif ke user
    await pool.query(
      "INSERT INTO notifications (recipient_id, type, message) VALUES (?, 'verif', ?)",
      [req.params.id, `❌ Verifikasi identitas ditolak. Alasan: ${rejectionNote}. Silakan upload ulang dokumen.`]
    )
    res.json({ success: true, message: 'User ditolak' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── GET /api/users/notifications (current user) ───────────────────────────────
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    )
    res.json({ success: true, notifications: rows })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── PUT /api/users/notifications/:id/read ─────────────────────────────────────
router.put('/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_id = ?', [req.params.id, req.user.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

module.exports = router
