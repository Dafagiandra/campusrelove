const express  = require('express')
const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const { pool } = require('../database/db')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, city, phone, ktpPhoto, selfiePhoto } = req.body

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Nama, email, password, dan role wajib diisi' })
    }
    if (!['buyer', 'seller'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role harus buyer atau seller' })
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password minimal 6 karakter' })
    }

    // Cek email duplikat
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()])
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email sudah terdaftar' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`

    const [result] = await pool.query(
      `INSERT INTO users (name, email, password, role, city, phone, avatar,
        ktp_photo, selfie_photo, verification_status, verified, join_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
      [name, email.toLowerCase(), hashedPassword, role,
       city || null, phone || null, avatar,
       null, null,  // KTP/selfie hanya untuk penjual via /api/kyc/submit
       role === 'buyer' ? 'approved' : 'pending',  // buyer langsung aktif
       role === 'buyer' ? 1 : 0]
    )

    const [user] = await pool.query(
      `SELECT id, name, email, role, city, phone, avatar, balance, verified,
              verification_status, join_date
       FROM users WHERE id = LAST_INSERT_ID()`,
    )

    const token = jwt.sign(
      { id: user[0].id, email: user[0].email, role: user[0].role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    res.status(201).json({ success: true, token, user: user[0] })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email dan password wajib diisi' })
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()])
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' })
    }

    const user = rows[0]
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' })
    }

    const { password: _, ktp_photo, selfie_photo, ...safeUser } = user

    const token = jwt.sign(
      { id: safeUser.id, email: safeUser.email, role: safeUser.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    res.json({ success: true, token, user: safeUser })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, email, role, city, phone, avatar, balance, rating,
              total_sales, verified, verification_status, rejection_note, join_date
       FROM users WHERE id = ?`,
      [req.user.id]
    )
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'User tidak ditemukan' })
    res.json({ success: true, user: rows[0] })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ── PUT /api/auth/profile ─────────────────────────────────────────────────────
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, city, phone, avatar } = req.body
    await pool.query(
      'UPDATE users SET name = COALESCE(?, name), city = COALESCE(?, city), phone = COALESCE(?, phone), avatar = COALESCE(?, avatar) WHERE id = ?',
      [name, city, phone, avatar, req.user.id]
    )
    const [rows] = await pool.query(
      'SELECT id, name, email, role, city, phone, avatar, balance, verified, verification_status FROM users WHERE id = ?',
      [req.user.id]
    )
    res.json({ success: true, user: rows[0] })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

module.exports = router
